"use server";

import { and, eq } from "drizzle-orm";
import type Stripe from "stripe";

import { requireSession } from "@/lib/auth-guard";
import { checkoutProviderOps } from "@/lib/billing/checkout-providers";
import { OFFER_UNAVAILABLE, REPGET_CODE, type OfferPlan } from "@/lib/billing/repget-offer";
import { WINBACK_UNAVAILABLE } from "@/lib/billing/winback-offer";
import { alertStaffAboutOffer, isCouponRefusal, OFFER_KEY, offerForPlanChange } from "@/lib/billing/repget-subscription";
import {
  automaticOffer,
  beginCheckout,
  isTrialEligible,
  markCheckoutFailed,
  recordCheckoutRequest,
  recordCheckoutStarted,
} from "@/lib/billing/checkouts";
import { rememberPayer } from "@/lib/conversions/conversions";
import { db } from "@/lib/db";
import { billingCustomers, plans, websites } from "@/lib/db/schema";
import { CONFIRM_EMAIL_FIRST, isDirectPurchaseTier } from "@/lib/plans/features";
import { isStripeConfigured, stripe } from "@/lib/stripe/client";
import { getOrCreateCustomer } from "@/lib/stripe/customer";
import { stripeErrorMessage } from "@/lib/stripe/errors";
import { requireOrg } from "@/lib/tenant";
import {
  checkoutReturnPath,
  type CheckoutOrigin,
} from "@/lib/billing/return-to";

function appUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_APP_URL is not set");
  }
  return url.replace(/\/$/, "");
}

export type CheckoutResult = { url: string } | { error: string };

/**
 * Whether Stripe definitely refused a request (it answered 4xx), as opposed
 * to a timeout or dropped connection after which it may have acted.
 */
function definitelyRefused(error: unknown): boolean {
  const status = (error as { statusCode?: unknown } | null)?.statusCode;
  return typeof status === "number" && status >= 400 && status < 500;
}

/**
 * Starts paying for a website with a card - or, for a website that already
 * pays by card, changes its plan.
 *
 * Access is never granted from the success redirect — every state change
 * comes from the webhook. This only produces a URL to send the customer to.
 *
 * ONE SUBSCRIPTION PER WEBSITE. beginCheckout (lib/billing/checkouts.ts)
 * serialises checkouts per website and decides: reuse an open checkout for
 * the same plan, change the plan of a subscription that already exists,
 * refuse while another checkout is unsettled, or record a new one. Only the
 * last reaches Stripe, with an idempotency key derived from our checkout id
 * and the request recorded first, so a retried or interrupted create makes
 * one session and a lost answer can be found again.
 */
export async function createCheckoutSession(
  planId: string,
  /**
   * The website this subscription pays for. Ownership is re-checked below:
   * the id arrives from the browser.
   */
  websiteId: string,
  /** Where the customer started, so paying returns them there. */
  origin: CheckoutOrigin = "billing",
): Promise<CheckoutResult> {
  const { orgId } = await requireOrg();

  /**
   * Confirms the website belongs to the caller before it reaches Stripe
   * metadata. A server action is a public endpoint, so an id from another
   * workspace would otherwise attach a paid plan to someone else's site.
   */
  const [site] = await db
    .select({ id: websites.id })
    .from(websites)
    .where(and(eq(websites.id, websiteId), eq(websites.organizationId, orgId)))
    .limit(1);
  if (!site) {
    return { error: "Website not found" };
  }

  // Before Stripe keys exist this is the expected path, not an outage.
  if (!isStripeConfigured()) {
    return { error: "Payments are not configured yet." };
  }

  const [plan] = await db
    .select({
      id: plans.id,
      name: plans.name,
      stripePriceId: plans.stripePriceId,
      tier: plans.tier,
      interval: plans.interval,
      currency: plans.currency,
      priceCents: plans.priceCents,
      isActive: plans.isActive,
    })
    .from(plans)
    .where(eq(plans.id, planId))
    .limit(1);

  if (!plan || !plan.isActive) {
    return { error: "Plan not found" };
  }
  if (!plan.stripePriceId) {
    return { error: `Plan "${plan.name}" has no Stripe price configured` };
  }

  /*
    The free articles go to a PROVEN address (lib/billing/free-articles.ts):
    a workspace that would be given them cannot check out until its email is
    confirmed, so one person cannot collect them again with made-up
    addresses. Refused rather than charged without them - the page said
    "0 today", and changing the terms silently would make that untrue.
  */
  // Not for a plan bought outright: it gives no free articles (lib/plans/features.ts DIRECT_PURCHASE_TIERS).
  const session = await requireSession();
  if (!isDirectPurchaseTier(plan.tier) && session.user.emailVerified !== true && (await isTrialEligible(db, orgId))) {
    return { error: CONFIRM_EMAIL_FIRST };
  }

  /*
    REPGET, applied by itself (2026-11-11): the plan's coupon unless the
    account has used it - or else the win-back discount for an account that
    was sent the win-back email (lib/billing/winback-offer.ts); never both.
    Nothing the browser sends decides it.
  */
  const autoOffer = await automaticOffer(db, orgId, plan);
  const offerCoupon = autoOffer?.coupon ?? null;

  const base = appUrl();

  let begun: Awaited<ReturnType<typeof beginCheckout>>;
  try {
    begun = await beginCheckout(
      db,
      { organizationId: orgId, websiteId, provider: "stripe", planId: plan.id, offer: autoOffer?.code ?? null },
      checkoutProviderOps,
    );
  } catch (error) {
    console.error("[stripe] could not start checkout", error);
    return { error: "We could not start the checkout. Please try again." };
  }

  if (begun.kind === "refuse") return { error: begun.error };
  if (begun.kind === "reuse") return { url: begun.url };

  if (begun.kind === "change_plan") {
    if (begun.current.planId === plan.id) {
      return { error: `This website is already on ${plan.name}.` };
    }
    // A plan change takes no new REPGET discount, only what offerForPlanChange carries over from the subscription.
    return changeStripePlan({
      organizationId: orgId,
      providerSubscriptionId: begun.current.providerSubscriptionId,
      priceId: plan.stripePriceId,
      plan,
      returnUrl: `${base}${checkoutReturnPath(origin, "success", websiteId)}`,
    });
  }

  const { checkoutId, trialDays } = begun;

  // The payer's GA identity, for the purchase reported when the money arrives.
  await rememberPayer(db, checkoutId);

  /*
    Everything that talks to Stripe is inside the try. An error escaping a
    server action reaches the browser as an opaque 500 in production;
    returning it as a value puts the real reason in front of whoever is
    configuring this.
  */
  let customerId: string;
  try {
    customerId = await getOrCreateCustomer(orgId);
  } catch (error) {
    await markCheckoutFailed(db, checkoutId).catch(() => {});
    console.error("[stripe] could not prepare the customer", error);
    return { error: stripeErrorMessage(error) };
  }

  const metadata = { organizationId: orgId, planId: plan.id, websiteId, checkoutId };
  const params: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    /*
      Back where they started, not always /billing: someone paying during
      setup belongs back in that flow.
    */
    success_url: `${base}${checkoutReturnPath(origin, "success", websiteId)}`,
    cancel_url: `${base}${checkoutReturnPath(origin, "cancelled", websiteId)}`,
    /*
      Stripe's code box, for every other code. With the REPGET offer the plan's
      coupon is on the Checkout instead, and Stripe keeps it through a free period
      for the first paid invoice (lib/billing/repget-offer.ts).
    */
    ...(offerCoupon ? { discounts: [{ coupon: offerCoupon }] } : { allow_promotion_codes: true }),
    // Metadata on the SESSION identifies this checkout...
    metadata,
    // ...and so does this, which is what a lost answer is searched by.
    client_reference_id: checkoutId,
    // ...but session metadata does NOT propagate to the subscription, so it
    // is written there too, for every later subscription event.
    subscription_data: {
      metadata: { ...metadata, ...(autoOffer?.code === REPGET_CODE ? { [OFFER_KEY]: REPGET_CODE } : {}) },
      /**
       * A trial ONLY for a workspace that has never had a subscription
       * (isTrialEligible: durable history, decided under a lock). It used to
       * be granted on every checkout, so cancelling and subscribing again,
       * or adding a site, bought another free trial each time. The plan
       * screen shows the trial only when this will grant it.
       */
      ...(trialDays > 0 ? { trial_period_days: trialDays } : {}),
    },
  };
  const idempotencyKey = `checkout:${checkoutId}`;
  const requestedAt = new Date();

  try {
    // Recorded BEFORE the call: a process that dies mid-call leaves what is
    // needed to find the session it made (checkouts.ts findStripeSession).
    await recordCheckoutRequest(db, checkoutId, {
      idempotencyKey,
      params: { customer: customerId, price: plan.stripePriceId, trialDays, ...(autoOffer ? { offer: autoOffer.code } : {}) },
    });

    const session = await stripe.checkout.sessions.create(params, { idempotencyKey });

    await recordCheckoutStarted(db, checkoutId, {
      stripeSessionId: session.id,
      checkoutUrl: session.url ?? null,
      expiresAt: session.expires_at ? new Date(session.expires_at * 1000) : null,
    });

    if (!session.url) {
      return { error: "Stripe did not return a Checkout URL" };
    }
    return { url: session.url };
  } catch (error) {
    /*
      Only a definite refusal marks the checkout failed. After a timeout
      Stripe may have made the session, so it is looked up by our checkout
      id: found, the customer is sent to it; confirmed absent, the checkout
      failed. If even the lookup fails the row stays open - blocking a
      duplicate and a deletion - until reconcileCheckouts settles it.
    */
    console.error("[stripe] checkout session failed", error);
    if (definitelyRefused(error)) {
      await markCheckoutFailed(db, checkoutId).catch((markError) =>
        console.error("[stripe] could not mark checkout failed", markError),
      );
      // Never a checkout without what was promised: nothing was started, and staff are told.
      if (offerCoupon && isCouponRefusal(error)) {
        await alertStaffAboutOffer(error instanceof Error ? error.message : String(error), `Stripe refused coupon ${offerCoupon} at Checkout, so the customer could not start. Website: ${websiteId}.`);
        return { error: autoOffer?.code === REPGET_CODE ? OFFER_UNAVAILABLE : WINBACK_UNAVAILABLE };
      }
      return { error: stripeErrorMessage(error) };
    }
    try {
      const found = await checkoutProviderOps.findStripeSession({
        checkoutId,
        customerId,
        createdAt: requestedAt,
      });
      if (found?.url) {
        await recordCheckoutStarted(db, checkoutId, {
          stripeSessionId: found.sessionId,
          checkoutUrl: found.url,
          expiresAt: found.expiresAt,
        });
        return { url: found.url };
      }
      if (!found) await markCheckoutFailed(db, checkoutId);
    } catch (lookupError) {
      console.error("[stripe] could not look up the checkout session", lookupError);
    }
    return { error: stripeErrorMessage(error) };
  }
}

/**
 * Changes the plan of a website's existing Stripe subscription, through the
 * Customer Portal's update-confirmation screen: Stripe shows the proration,
 * the customer confirms, and customer.subscription.updated records it. The
 * subscription - its id, invoices and history - stays the same one, where
 * "Switch to this plan" used to open a checkout and create a second one.
 */
async function changeStripePlan(input: {
  organizationId: string;
  providerSubscriptionId: string;
  priceId: string;
  plan: OfferPlan;
  returnUrl: string;
}): Promise<CheckoutResult> {
  const [customer] = await db
    .select({ id: billingCustomers.stripeCustomerId })
    .from(billingCustomers)
    .where(eq(billingCustomers.organizationId, input.organizationId))
    .limit(1);

  let offerCoupon: string | undefined;
  try {
    const subscription = await stripe.subscriptions.retrieve(input.providerSubscriptionId, { expand: ["discounts"] });
    const offer = offerForPlanChange(subscription, input.plan);
    if (offer.refuse) return { error: offer.refuse };
    offerCoupon = offer.coupon;
    const item = subscription.items.data[0];
    const customerId =
      customer?.id ??
      (typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id);
    if (!item) return { error: "This subscription has nothing to change." };

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: input.returnUrl,
      flow_data: {
        type: "subscription_update_confirm",
        subscription_update_confirm: {
          subscription: input.providerSubscriptionId,
          items: [{ id: item.id, price: input.priceId, quantity: item.quantity ?? 1 }],
          // In the same request as the change, which can end a free period and charge at once.
          ...(offerCoupon ? { discounts: [{ coupon: offerCoupon }] } : {}),
        },
        after_completion: { type: "redirect", redirect: { return_url: input.returnUrl } },
      },
    });
    return { url: session.url };
  } catch (error) {
    console.error("[stripe] plan change failed", error);
    // Nothing was changed. Better no change than one at full price.
    if (offerCoupon && isCouponRefusal(error)) {
      await alertStaffAboutOffer(error instanceof Error ? error.message : String(error), `Stripe refused coupon ${offerCoupon} on a plan change, so the plan was not changed. Stripe subscription: ${input.providerSubscriptionId}.`);
      return { error: OFFER_UNAVAILABLE };
    }
    return { error: stripeErrorMessage(error) };
  }
}
