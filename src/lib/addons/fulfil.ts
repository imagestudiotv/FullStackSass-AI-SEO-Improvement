import { and, eq, isNull } from "drizzle-orm";

import { recordCredit } from "@/lib/backlinks/credits";
import { projectAnchor, QUOTE_CREDITS_SLUG, UUID_PATTERN } from "@/lib/credits/quote-topup-shared";
import { db } from "@/lib/db";
import { member, user } from "@/lib/db/auth-tables";
import { addonPurchases, addons, creditLedger, creditTopups } from "@/lib/db/schema";
import { ADDON_PAYMENT_FAILED } from "@/lib/i18n/addon-payment";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/config";
import { format } from "@/lib/i18n/format";
import { notify } from "@/lib/notifications/create";

/**
 * Fulfilling a paid add-on.
 *
 * Called from the Stripe webhook, never from the success redirect: someone can
 * close the tab before it loads, or visit the success URL by hand. If it is
 * not recorded here, it was not paid for.
 *
 * Imported by a route handler, so no "use server" directive.
 */

/** Paid by card (a Stripe Checkout session) or with PayPal (our paypal_orders row, review P4): exactly one. */
export type FulfilInput = {
  organizationId: string;
  addonId: string;
  amountTotal: number | null;
  currency: string | null;
  /**
   * Credits bought for a quote (lib/credits/quote-topup.ts): the credit_topups
   * row the payment was started for. Its credits are what is granted - the
   * add-on it is recorded under grants none of its own.
   */
  topupId?: string | null;
} & ({ stripeSessionId: string; paypalOrderId?: undefined } | { paypalOrderId: string; stripeSessionId?: undefined });

/** The purchase row's unique key column and value for this payment. */
function paidBy(input: FulfilInput) {
  return input.paypalOrderId
    ? { column: addonPurchases.paypalOrderId, value: input.paypalOrderId, label: `PayPal order ${input.paypalOrderId}` }
    : { column: addonPurchases.stripeSessionId, value: input.stripeSessionId!, label: `session ${input.stripeSessionId}` };
}

/** The top-up a payment was started for, in the paying workspace only. */
async function topUpFor(input: FulfilInput) {
  if (!input.topupId || !UUID_PATTERN.test(input.topupId)) return null;
  const [row] = await db
    .select({
      id: creditTopups.id,
      credits: creditTopups.credits,
      amountCents: creditTopups.amountCents,
      websiteProjectId: creditTopups.websiteProjectId,
    })
    .from(creditTopups)
    .where(and(eq(creditTopups.id, input.topupId), eq(creditTopups.organizationId, input.organizationId)))
    .limit(1);
  return row ?? null;
}

/**
 * A PayPal order for a quote's credits names its top-up as its reference
 * (lib/credits/quote-topup.ts), where a credit pack's names the pack: the
 * top-up and the add-on it is recorded under, or null for a pack.
 */
export async function topUpOfPayPalOrder(
  referenceId: string,
  organizationId: string,
): Promise<{ topupId: string; addonId: string; websiteProjectId: string | null; quoteRevision: string } | null> {
  // A pack's order names the pack: nothing more to look up.
  const [pack] = await db.select({ id: addons.id }).from(addons).where(eq(addons.id, referenceId)).limit(1);
  if (pack) return null;
  const [row] = await db
    .select({
      topupId: creditTopups.id,
      addonId: addons.id,
      websiteProjectId: creditTopups.websiteProjectId,
      quoteRevision: creditTopups.quoteRevision,
    })
    .from(creditTopups)
    .innerJoin(addons, eq(addons.slug, QUOTE_CREDITS_SLUG))
    .where(and(eq(creditTopups.id, referenceId), eq(creditTopups.organizationId, organizationId)))
    .limit(1);
  return row ?? null;
}

/** The ledger operation id for a purchase's credits. */
export function purchaseCreditKey(purchaseId: string): string {
  return `purchase:${purchaseId}`;
}

/**
 * Records a purchase and grants whatever it includes.
 *
 * WHAT WAS WRONG. The purchase row was committed first and the credits
 * written afterwards, in a separate statement. A failure between the two -
 * a dropped connection, a killed process - left a purchase that looked
 * fulfilled, and the webhook retry saw the purchase row, concluded it was a
 * replay and granted nothing. The customer had paid for credits that never
 * arrived, with nothing anywhere saying so.
 *
 * NOW. The purchase and its credit entry commit in ONE transaction, so a
 * failure rolls both back and the provider's retry starts clean. The credit
 * entry carries a stable idempotency key ("purchase:<id>"), and a replay
 * that finds the purchase already recorded re-checks - with the purchase row
 * locked - that its credits exist, so concurrent or repeated deliveries
 * grant exactly once. Notifications are sent after commit and cannot undo
 * or block the money.
 *
 * Returns whether this call was the one that granted it.
 */
export async function fulfilAddonPurchase(
  input: FulfilInput,
): Promise<boolean> {
  const [addon] = await db
    .select({
      id: addons.id,
      slug: addons.slug,
      name: addons.name,
      kind: addons.kind,
      creditsGranted: addons.creditsGranted,
      priceCents: addons.priceCents,
      currency: addons.currency,
    })
    .from(addons)
    .where(eq(addons.id, input.addonId))
    .limit(1);

  if (!addon) {
    /**
     * Money was taken for something we cannot identify. Logged loudly rather
     * than thrown: throwing would make Stripe retry forever against an add-on
     * that will never exist, and the payment still needs a human to look at.
     */
    console.error(
      `[addons] paid ${paidBy(input).label} references unknown addon ${input.addonId}`,
    );
    return false;
  }

  /*
    Credits for a quote: how many is the top-up row's, written by the server
    before the payment started, for this workspace. A payment naming no such
    row is logged, not granted from a guess - as for an unknown add-on above.
  */
  const isTopUp = addon.slug === QUOTE_CREDITS_SLUG;
  const topUp = isTopUp ? await topUpFor(input) : null;
  if (isTopUp && !topUp) {
    console.error(
      `[addons] paid ${paidBy(input).label} names no credit top-up of ${input.organizationId} (${input.topupId ?? "none"}) - NOT granted; review`,
    );
    return false;
  }
  if (topUp && input.amountTotal !== null && input.amountTotal !== topUp.amountCents) {
    // Not expected (the amount is the server's and the checkout takes no promotion code); what was bought is still the row's credits.
    console.error(`[addons] top-up ${topUp.id}: ${paidBy(input).label} charged ${input.amountTotal}, not ${topUp.amountCents}`);
  }
  const creditsBought = topUp ? topUp.credits : addon.creditsGranted;
  const grantsCredits = addon.kind === "credits" && creditsBought > 0;
  const key = paidBy(input);

  const outcome = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(addonPurchases)
      .values({
        organizationId: input.organizationId,
        addonId: addon.id,
        ...(input.paypalOrderId ? { paypalOrderId: input.paypalOrderId } : { stripeSessionId: input.stripeSessionId }),
        // What was actually charged, from the provider, rather than what the row
        // says now — the price may have changed between purchase and this call.
        pricePaidCents: input.amountTotal ?? addon.priceCents,
        currency: input.currency ?? addon.currency,
        status: "paid",
      })
      .onConflictDoNothing({ target: key.column })
      .returning({ id: addonPurchases.id });

    let purchaseId = inserted?.id ?? null;
    if (!purchaseId) {
      // A replay, or a concurrent delivery that committed first. Lock the
      // purchase so a simultaneous replay waits for this check.
      const [existing] = await tx
        .select({ id: addonPurchases.id, organizationId: addonPurchases.organizationId })
        .from(addonPurchases)
        .where(eq(key.column, key.value))
        .for("update");
      if (!existing || !grantsCredits) return { granted: false, fresh: false };
      purchaseId = existing.id;

      /*
        Credits written before idempotency keys existed carry only the
        purchase id as their reference; either form means already granted.
      */
      const [credited] = await tx
        .select({ id: creditLedger.id })
        .from(creditLedger)
        .where(
          and(
            eq(creditLedger.type, "purchase"),
            eq(creditLedger.referenceId, existing.id),
          ),
        )
        .limit(1);
      if (credited) return { granted: false, fresh: false };
    }

    if (!grantsCredits) return { granted: false, fresh: Boolean(inserted) };

    const granted = await recordCredit(
      input.organizationId,
      {
        type: "purchase",
        amount: creditsBought,
        referenceId: purchaseId,
        idempotencyKey: purchaseCreditKey(purchaseId),
        note: topUp ? `Bought ${creditsBought} credits for a quote` : `Bought ${addon.name}`,
      },
      tx,
    );
    if (topUp) {
      // With the credits, in one transaction: the top-up reads "paid" exactly when they exist.
      await tx
        .update(creditTopups)
        .set({ status: "paid", addonPurchaseId: purchaseId, paidAt: new Date(), updatedAt: new Date() })
        .where(and(eq(creditTopups.id, topUp.id), isNull(creditTopups.addonPurchaseId)));
    }
    return { granted, fresh: Boolean(inserted) };
  });

  if (!outcome.granted && !outcome.fresh) return false;

  /* After commit, and never able to fail the fulfilment. */
  try {
    await notify(
      topUp
        ? {
            // Credits only: the quote itself is still accepted with "Pay in credits".
            organizationId: input.organizationId,
            type: "addon.purchased",
            title: `${creditsBought} credits added`,
            body: 'Your quote is not paid yet: open it and choose "Accept and pay".',
            href: topUp.websiteProjectId ? `/website-projects#${projectAnchor(topUp.websiteProjectId)}` : "/website-projects",
          }
        : grantsCredits
        ? {
            organizationId: input.organizationId,
            type: "addon.purchased",
            title: `${addon.creditsGranted} credits added`,
            body: `Your purchase of ${addon.name} is ready to use.`,
            href: "/billing",
          }
        : {
            /**
             * A service we deliver by hand. Nothing is granted
             * automatically, and the notification says so — telling someone
             * their citations are "ready" when a human has not started yet
             * is the kind of promise that produces a refund request.
             */
            organizationId: input.organizationId,
            type: "addon.purchased",
            title: `${addon.name} - payment received`,
            body: "We will start work and email you when it is done.",
            href: "/billing",
          },
    );
  } catch (error) {
    console.error("[addons] purchase recorded but the notification failed", error);
  }

  return true;
}

/**
 * A delayed payment failed: nothing was recorded for it, so nothing is taken
 * back, and the customer hears that no credits are coming.
 *
 * Only a session an earlier build fulfilled on completion has a purchase here. Its
 * credits stay, and the unpaid grant is logged: they may already be spent, so
 * taking them back is a person's decision.
 */
export async function addonPaymentFailed(input: {
  organizationId: string;
  addonId: string;
  stripeSessionId: string;
  topupId?: string | null;
}): Promise<void> {
  // A quote's top-up that did not clear: its page says so, and nothing is granted.
  if (input.topupId && UUID_PATTERN.test(input.topupId)) {
    await db
      .update(creditTopups)
      .set({ status: "failed", updatedAt: new Date() })
      .where(
        and(eq(creditTopups.id, input.topupId), eq(creditTopups.organizationId, input.organizationId), eq(creditTopups.status, "open")),
      );
  }
  const [purchase] = await db
    .select({ id: addonPurchases.id })
    .from(addonPurchases)
    .where(eq(addonPurchases.stripeSessionId, input.stripeSessionId))
    .limit(1);
  if (purchase) {
    console.error(`[addons] purchase ${purchase.id} was fulfilled, but its delayed payment ${input.stripeSessionId} failed`);
    return;
  }
  const [addon] = await db.select({ name: addons.name }).from(addons).where(eq(addons.id, input.addonId)).limit(1);
  if (!addon) return;
  // Stored once, for everyone in the workspace, in its owner's language.
  const [owner] = await db
    .select({ locale: user.locale })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(and(eq(member.organizationId, input.organizationId), eq(member.role, "owner")))
    .limit(1);
  const copy = ADDON_PAYMENT_FAILED[owner?.locale && isLocale(owner.locale) ? owner.locale : DEFAULT_LOCALE];
  await notify({
    organizationId: input.organizationId,
    type: "addon.payment_failed",
    title: format(copy.title, { name: addon.name }),
    body: copy.body,
    href: "/billing",
  });
}
