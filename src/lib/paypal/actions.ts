"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requireSession } from "@/lib/auth-guard";
import { isEntitled } from "@/lib/billing-shared";
import { checkoutProviderOps } from "@/lib/billing/checkout-providers";
import {
  automaticOffer,
  beginCheckout,
  isTrialEligible,
  markCheckoutFailed,
  recordCheckoutRequest,
  recordCheckoutStarted,
  settlePayPalReturn,
} from "@/lib/billing/checkouts";
import { syncPayPalSubscription } from "@/lib/billing/paypal-events";
import { REPGET_CODE } from "@/lib/billing/repget-offer";
import { rememberPayer } from "@/lib/conversions/conversions";
import { db } from "@/lib/db";
import { plans, subscriptions, websites } from "@/lib/db/schema";
import { isPayPalConfigured, PayPalError, payPalCheckoutPaused } from "@/lib/paypal/client";
import { CONFIRM_EMAIL_FIRST, isDirectPurchaseTier } from "@/lib/plans/features";
import { startPlanChange } from "@/lib/paypal/plan-changes";
import { cancelSubscription, createSubscription } from "@/lib/paypal/subscriptions";
import { requireOrg } from "@/lib/tenant";
import {
  checkoutReturnPath,
  type CheckoutOrigin,
} from "@/lib/billing/return-to";

/**
 * PayPal checkout actions.
 *
 * Mirrors lib/stripe/actions.ts deliberately: same guard, same result shape,
 * same rule that access is granted only by the webhook, and the same
 * one-subscription-per-website decision (beginCheckout).
 */

export type PayPalResult = { url: string } | { error: string };

function appUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL;
  if (!url) throw new Error("NEXT_PUBLIC_APP_URL is not set");
  return url.replace(/\/$/, "");
}

/**
 * Whether to offer PayPal at all: only where a PayPal checkout can complete
 * (credentials, PAYPAL_WEBHOOK_ID and a valid PAYPAL_ENV - client.ts), and
 * while PAYPAL_CHECKOUT is not "off" (payPalCheckoutPaused). A plan without
 * a PayPal plan id gets no PayPal button either; the pages decide that per
 * plan.
 */
export async function isPayPalAvailable(): Promise<boolean> {
  return isPayPalConfigured() && !payPalCheckoutPaused();
}

export type PayPalReturnResult = {
  /** Something was recorded or released: the page should read its state again. */
  changed: boolean;
  /** PayPal reported a checkout paid (live), so it was recorded rather than released. */
  paid: boolean;
  /** PayPal has not finished yet (approval or activation pending): worth asking again shortly. */
  waiting: boolean;
};

/**
 * Settles what PayPal's return or cancel redirect left behind, for ONE
 * website (lib/billing/checkouts.ts settlePayPalReturn). Called by the page
 * the customer lands on (components/paypal-return.tsx), never during its
 * render: it writes.
 *
 * The workspace comes from the session and the website is re-checked against
 * it, as everywhere else. The subscription id PayPal appends to the address
 * is never read: which checkout to look at is our own record, and what
 * happened to it is what PayPal says when asked now.
 */
export async function confirmPayPalReturn(
  websiteId: string,
  outcome: "success" | "cancelled",
): Promise<PayPalReturnResult> {
  const nothing: PayPalReturnResult = { changed: false, paid: false, waiting: false };
  const { orgId } = await requireOrg();
  if ((outcome !== "success" && outcome !== "cancelled") || !isPayPalConfigured()) return nothing;

  const [site] = await db
    .select({ id: websites.id })
    .from(websites)
    .where(and(eq(websites.id, websiteId), eq(websites.organizationId, orgId)))
    .limit(1);
  if (!site) return nothing;

  const settled = await settlePayPalReturn(
    db,
    { organizationId: orgId, websiteId: site.id },
    outcome,
    checkoutProviderOps,
  );

  // A plan started now that PayPal is still activating (awaitsActivation): the free articles show until it has.
  let waiting = settled.awaiting.length > 0;
  if (!waiting && outcome === "success" && (settled.pending.length > 0 || settled.synced.length > 0)) {
    // Approved but not yet active at PayPal: the plan is not there yet.
    const [current] = await db
      .select({ status: subscriptions.status })
      .from(subscriptions)
      .where(eq(subscriptions.websiteId, site.id))
      .limit(1);
    waiting = !isEntitled(current?.status);
  }
  return { changed: settled.synced.length > 0 || settled.released.length > 0, paid: settled.synced.length > 0, waiting };
}

/**
 * Starts a PayPal subscription for a website - or revises the plan of the
 * one it already has. A website on its free articles through PayPal starts
 * the chosen plan NOW ("Start my plan now" on Billing): a new subscription,
 * charged on approval, that takes over from the free one (beginCheckout).
 *
 * Returns the approval URL. Nothing is charged until the customer approves on
 * PayPal, and nothing is granted until the webhook confirms activation.
 */
export async function createPayPalCheckout(
  planId: string,
  /** The website this subscription pays for. */
  websiteId: string,
  /** Where the customer started, so approving returns them there. */
  origin: CheckoutOrigin = "billing",
): Promise<PayPalResult> {
  const { orgId } = await requireOrg();

  /**
   * Ownership re-checked before the id leaves for PayPal, as with Stripe: a
   * server action is a public endpoint and the caller chooses the argument.
   */
  const [site] = await db
    .select({ id: websites.id })
    .from(websites)
    .where(and(eq(websites.id, websiteId), eq(websites.organizationId, orgId)))
    .limit(1);
  if (!site) {
    return { error: "Website not found" };
  }

  // Before credentials exist this is the expected path, not an outage.
  if (!isPayPalConfigured()) {
    return { error: "PayPal is not available yet. Please pay by card." };
  }
  // Paused by the owner (PAYPAL_CHECKOUT=off): no new subscription and no plan change; existing ones carry on.
  if (payPalCheckoutPaused()) {
    return { error: "Paying with PayPal is paused for now. Please pay by card, or try again later." };
  }

  const [plan] = await db
    .select({
      id: plans.id,
      name: plans.name,
      paypalPlanId: plans.paypalPlanId,
      paypalTrialPlanId: plans.paypalTrialPlanId,
      paypalOfferPlanId: plans.paypalOfferPlanId,
      paypalTrialOfferPlanId: plans.paypalTrialOfferPlanId,
      isActive: plans.isActive,
      tier: plans.tier,
      interval: plans.interval,
      currency: plans.currency,
      priceCents: plans.priceCents,
    })
    .from(plans)
    .where(eq(plans.id, planId))
    .limit(1);

  if (!plan || !plan.isActive) {
    return { error: "Plan not found" };
  }
  if (!plan.paypalPlanId) {
    /**
     * Reported plainly rather than failing: a plan can legitimately exist in
     * Stripe before it has been mirrored into PayPal.
     */
    return {
      error: `"${plan.name}" is not available through PayPal yet. Please pay by card.`,
    };
  }

  /*
    The free articles go to a PROVEN address, as with card (lib/stripe/
    actions.ts): a workspace that would be given them cannot check out until
    its email is confirmed. Only where PayPal can give them - a plan without
    its free-articles PayPal plan charges at once, and needs nothing.
  */
  if (plan.paypalTrialPlanId && !isDirectPurchaseTier(plan.tier)) {
    const session = await requireSession();
    if (session.user.emailVerified !== true && (await isTrialEligible(db, orgId))) {
      return { error: CONFIRM_EMAIL_FIRST };
    }
  }

  /*
    REPGET through PayPal: the launch price (2026-11-11), the same as by card,
    on EVERY payment. The plan's own PayPal plan, its regular cycle priced at
    the launch price on THIS subscription only (PayPal's per-subscription
    override), after any free days - so no PayPal plan of its own is needed.
    Applied by itself, as by card, to anyone starting a plan while the offer
    is on (beginCheckout decides).

    The win-back discount (lib/billing/winback-offer.ts) is the first payment
    only, so it rides on the plan's offer plans (scripts/paypal-plans.mjs):
    their one intro cycle at 80% of the price, set per subscription. A plan
    whose offer plans are not made yet gives it by card only, so its PayPal
    checkout says so rather than charge the full price the plan screen did
    not show.
  */
  const autoOffer = await automaticOffer(db, orgId, plan);
  const launchPrice = autoOffer?.code === REPGET_CODE;
  const discount = autoOffer ? autoOffer.discountCents : null;
  const winbackReady = Boolean(plan.paypalOfferPlanId && (!plan.paypalTrialPlanId || plan.paypalTrialOfferPlanId));

  const base = appUrl();
  const returnUrl = `${base}${checkoutReturnPath(origin, "success", websiteId, "paypal")}`;
  const cancelUrl = `${base}${checkoutReturnPath(origin, "cancelled", websiteId, "paypal")}`;

  let begun: Awaited<ReturnType<typeof beginCheckout>>;
  try {
    begun = await beginCheckout(
      db,
      { organizationId: orgId, websiteId, provider: "paypal", planId: plan.id, offer: autoOffer?.code ?? null },
      checkoutProviderOps,
    );
  } catch (error) {
    console.error("[paypal] could not start checkout", error);
    return { error: "We could not start the checkout. Please try again." };
  }

  if (begun.kind === "refuse") return { error: begun.error };
  if (begun.kind === "reuse") return { url: begun.url };

  if (begun.kind === "change_plan") {
    if (begun.current.planId === plan.id) {
      return { error: `This website is already on ${plan.name}.` };
    }
    /*
      The same subscription, revised - never a second one. An upgrade pays
      the prorated difference first, then the buyer approves the revision;
      a downgrade is revised and applies from the next billing date
      (lib/paypal/plan-changes.ts, review P1). A subscription on the REPGET
      launch price keeps it on the new plan (the same file).
    */
    const session = await requireSession();
    try {
      const changed = await startPlanChange({
        organizationId: orgId,
        subscriptionId: begun.current.subscriptionId,
        toPlanId: plan.id,
        userId: session.user.id,
      });
      return changed.kind === "redirect" ? { url: changed.url } : { error: changed.error };
    } catch (error) {
      console.error("[paypal] could not change the plan", error);
      return { error: "PayPal could not change the plan." };
    }
  }

  const { checkoutId, trialDays } = begun;
  // Checked here, not before: a plan change above needs no offer plan. Failing the row gives the discount back.
  if (autoOffer && !launchPrice && !winbackReady) {
    await markCheckoutFailed(db, checkoutId).catch(() => {});
    return { error: `The welcome-back discount is not available with PayPal for "${plan.name}" yet. Please pay by card to get it.` };
  }
  /*
    The free articles (2026-10-22): the checkout granted them, so the plan
    with its free days first (scripts/paypal-plans.mjs); otherwise the plan
    itself, charged at once - as when a plan is started now, in place of
    the free articles.
  */
  const withFreeDays = trialDays > 0 && Boolean(plan.paypalTrialPlanId);
  const winback = discount !== null && !launchPrice;
  const paypalPlanId = winback
    ? withFreeDays
      ? plan.paypalTrialOfferPlanId!
      : plan.paypalOfferPlanId!
    : withFreeDays
      ? plan.paypalTrialPlanId!
      : plan.paypalPlanId;
  /*
    The first paid cycle, after the free days (sequence 2) or first: the
    regular cycle of the plan itself (billed until cancelled) for the launch
    price, the offer plan's one intro cycle for the win-back discount.
  */
  const discounted =
    discount !== null
      ? { sequence: withFreeDays ? 2 : 1, totalCycles: launchPrice ? 0 : 1, priceCents: plan.priceCents - discount, currency: plan.currency }
      : null;
  // The payer's GA identity, for the purchase reported when the money arrives.
  await rememberPayer(db, checkoutId);
  const idempotencyKey = `checkout:${checkoutId}`;
  try {
    await recordCheckoutRequest(db, checkoutId, {
      idempotencyKey,
      /*
        The offer stays on the row: the record of it - what a plan change
        reads to keep the launch price (lib/paypal/plan-changes.ts), and what
        the win-back counts once per person.
      */
      params: {
        plan: paypalPlanId,
        ...(discounted && autoOffer
          ? { offer: autoOffer.code, ...(launchPrice ? { launchCents: discounted.priceCents } : { introCents: discounted.priceCents }) }
          : {}),
      },
    });
    const result = await createSubscription({
      planId: paypalPlanId,
      organizationId: orgId,
      websiteId,
      checkoutId,
      returnUrl,
      cancelUrl,
      prices: discounted ? [discounted] : undefined,
    });
    await recordCheckoutStarted(db, checkoutId, {
      providerSubscriptionId: result.subscriptionId,
      checkoutUrl: result.approveUrl,
    });
    return { url: result.approveUrl };
  } catch (error) {
    /*
      Only a definite refusal marks it failed. A timeout ("unknown") may have
      created an approval at PayPal, which cannot be looked up by our ids: the
      row stays open and becomes unresolved, blocking deletion.
    */
    if (error instanceof PayPalError && error.kind !== "unknown") {
      await markCheckoutFailed(db, checkoutId).catch((markError) =>
        console.error("[paypal] could not mark checkout failed", markError),
      );
    }
    if (error instanceof PayPalError) {
      return { error: "PayPal could not start the subscription." };
    }
    throw error;
  }
}

export type CancelResult = { ok: true } | { ok: false; error: string };

/**
 * Cancels THE PayPal subscription of ONE website.
 *
 * It used to take no argument and cancel whichever PayPal row the workspace
 * query happened to return first - in a workspace paying for several sites,
 * possibly not the one the customer meant. Now the website is named,
 * ownership is checked, and exactly that website's current PayPal
 * subscription is cancelled. Nothing is marked cancelled locally unless
 * PayPal confirms it: after the call the subscription is read back from
 * PayPal through the same sync the webhook uses.
 */
export async function cancelPayPalSubscription(websiteId: string): Promise<CancelResult> {
  const { orgId } = await requireOrg();

  const [row] = await db
    .select({
      provider: subscriptions.provider,
      status: subscriptions.status,
      cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
      paypalSubscriptionId: subscriptions.paypalSubscriptionId,
    })
    .from(subscriptions)
    .innerJoin(websites, eq(websites.id, subscriptions.websiteId))
    .where(
      and(
        eq(subscriptions.websiteId, websiteId),
        // Ownership: the website must belong to the caller's workspace.
        eq(websites.organizationId, orgId),
      ),
    )
    .limit(1);

  if (!row || row.provider !== "paypal" || !row.paypalSubscriptionId) {
    return { ok: false, error: "This website has no PayPal subscription to cancel." };
  }
  // Cancelled already: ended, or running out the time paid for (review M1).
  if (row.status === "canceled" || row.cancelAtPeriodEnd) {
    return { ok: false, error: "This website's PayPal subscription is already cancelled." };
  }

  try {
    await cancelSubscription(row.paypalSubscriptionId);
  } catch (error) {
    if (error instanceof PayPalError) {
      return { ok: false, error: "PayPal could not cancel the subscription." };
    }
    throw error;
  }

  // Read back from PayPal: the local row changes only to what PayPal says.
  await syncPayPalSubscription(row.paypalSubscriptionId).catch((error) =>
    console.error("[paypal] cancelled, but reading it back failed; the webhook will record it", error),
  );

  revalidatePath("/billing");
  return { ok: true };
}
