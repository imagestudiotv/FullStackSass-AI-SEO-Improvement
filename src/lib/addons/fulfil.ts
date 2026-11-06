import { and, eq } from "drizzle-orm";

import { recordCredit } from "@/lib/backlinks/credits";
import { db } from "@/lib/db";
import { member, user } from "@/lib/db/auth-tables";
import { addonPurchases, addons, creditLedger } from "@/lib/db/schema";
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

export type FulfilInput = {
  organizationId: string;
  addonId: string;
  stripeSessionId: string;
  amountTotal: number | null;
  currency: string | null;
};

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
      `[addons] paid session ${input.stripeSessionId} references unknown addon ${input.addonId}`,
    );
    return false;
  }

  const grantsCredits = addon.kind === "credits" && addon.creditsGranted > 0;

  const outcome = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(addonPurchases)
      .values({
        organizationId: input.organizationId,
        addonId: addon.id,
        stripeSessionId: input.stripeSessionId,
        // What was actually charged, from Stripe, rather than what the row
        // says now — the price may have changed between purchase and this call.
        pricePaidCents: input.amountTotal ?? addon.priceCents,
        currency: input.currency ?? addon.currency,
        status: "paid",
      })
      .onConflictDoNothing({ target: addonPurchases.stripeSessionId })
      .returning({ id: addonPurchases.id });

    let purchaseId = inserted?.id ?? null;
    if (!purchaseId) {
      // A replay, or a concurrent delivery that committed first. Lock the
      // purchase so a simultaneous replay waits for this check.
      const [existing] = await tx
        .select({ id: addonPurchases.id, organizationId: addonPurchases.organizationId })
        .from(addonPurchases)
        .where(eq(addonPurchases.stripeSessionId, input.stripeSessionId))
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
        amount: addon.creditsGranted,
        referenceId: purchaseId,
        idempotencyKey: purchaseCreditKey(purchaseId),
        note: `Bought ${addon.name}`,
      },
      tx,
    );
    return { granted, fresh: Boolean(inserted) };
  });

  if (!outcome.granted && !outcome.fresh) return false;

  /* After commit, and never able to fail the fulfilment. */
  try {
    await notify(
      grantsCredits
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
export async function addonPaymentFailed(input: Pick<FulfilInput, "organizationId" | "addonId" | "stripeSessionId">): Promise<void> {
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
