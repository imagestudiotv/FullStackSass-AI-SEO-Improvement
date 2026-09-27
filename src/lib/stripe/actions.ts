"use server";

import { and, eq } from "drizzle-orm";
import type Stripe from "stripe";

import { checkoutProviderOps } from "@/lib/billing/checkout-providers";
import {
  beginCheckout,
  markCheckoutFailed,
  recordCheckoutRequest,
  recordCheckoutStarted,
} from "@/lib/billing/checkouts";
import { db } from "@/lib/db";
import { billingCustomers, plans, websites } from "@/lib/db/schema";
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

  const base = appUrl();

  let begun: Awaited<ReturnType<typeof beginCheckout>>;
  try {
    begun = await beginCheckout(
      db,
      { organizationId: orgId, websiteId, provider: "stripe", planId: plan.id },
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
    return changeStripePlan({
      organizationId: orgId,
      providerSubscriptionId: begun.current.providerSubscriptionId,
      priceId: plan.stripePriceId,
      returnUrl: `${base}${checkoutReturnPath(origin, "success", websiteId)}`,
    });
  }

  const { checkoutId, trialDays } = begun;

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
    allow_promotion_codes: true,
    // Metadata on the SESSION identifies this checkout...
    metadata,
    // ...and so does this, which is what a lost answer is searched by.
    client_reference_id: checkoutId,
    // ...but session metadata does NOT propagate to the subscription, so it
    // is written there too, for every later subscription event.
    subscription_data: {
      metadata,
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
      params: { customer: customerId, price: plan.stripePriceId, trialDays },
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
  returnUrl: string;
}): Promise<CheckoutResult> {
  const [customer] = await db
    .select({ id: billingCustomers.stripeCustomerId })
    .from(billingCustomers)
    .where(eq(billingCustomers.organizationId, input.organizationId))
    .limit(1);

  try {
    const subscription = await stripe.subscriptions.retrieve(input.providerSubscriptionId);
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
        },
        after_completion: { type: "redirect", redirect: { return_url: input.returnUrl } },
      },
    });
    return { url: session.url };
  } catch (error) {
    console.error("[stripe] plan change failed", error);
    return { error: stripeErrorMessage(error) };
  }
}
