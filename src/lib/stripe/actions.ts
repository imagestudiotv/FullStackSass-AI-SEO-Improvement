"use server";

import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { plans, websites } from "@/lib/db/schema";
import { isStripeConfigured, stripe } from "@/lib/stripe/client";
import { getOrCreateCustomer } from "@/lib/stripe/customer";
import { stripeErrorMessage } from "@/lib/stripe/errors";
import { requireOrg } from "@/lib/tenant";
import { TRIAL_DAYS } from "@/lib/plans/features";
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
 * Creates a hosted Checkout session for the caller's organization.
 *
 * Access is never granted from the success redirect — the user can close the
 * tab, or simply navigate to the success URL by hand. Every state change comes
 * from the webhook. This only produces a URL to send them to.
 */
export async function createCheckoutSession(
  planId: string,
  /**
   * The website this subscription pays for.
   *
   * Each site is billed separately, so a checkout has to name one — without
   * it the webhook cannot tell which of a customer's sites just became paid.
   * Ownership is re-checked below: the id arrives from the browser.
   */
  websiteId: string,
  /**
   * Where the customer started, so paying returns them there.
   *
   * Defaults to "billing", which is what every existing caller meant. Only
   * the onboarding plan step passes "onboarding".
   */
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

  /**
   * Everything that talks to Stripe is inside the try.
   *
   * An error escaping a server action reaches the browser as an unhandled
   * rejection: in a production build React strips the message and reports
   * error #441, so the console shows a 500 and a number while Stripe's actual
   * explanation is discarded. Returning it as a value puts the real reason in
   * front of whoever is configuring this.
   */
  try {
    const customerId = await getOrCreateCustomer(orgId);
    const base = appUrl();

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      /*
        Back where they started, not always /billing. Someone paying during
        setup was dropped into the dashboard's billing screen — the sidebar
        and the whole app — part-way through a flow that deliberately hides
        it, with nothing saying what came next.
      */
      success_url: `${base}${checkoutReturnPath(origin, "success", websiteId)}`,
      cancel_url: `${base}${checkoutReturnPath(origin, "cancelled", websiteId)}`,
      allow_promotion_codes: true,
      // Metadata on the SESSION identifies this checkout...
      metadata: { organizationId: orgId, planId: plan.id, websiteId },
      // ...but session metadata does NOT propagate to the subscription. Without
      // this second copy, a customer.subscription.updated arriving weeks later
      // (say, after a portal upgrade) has no way to identify the organization
      // or the website it pays for.
      subscription_data: {
        metadata: { organizationId: orgId, planId: plan.id, websiteId },
        /**
         * A real trial, because the page promises one.
         *
         * The plan screen says "3 days free · EUR 0 today". Without this
         * Stripe would charge the full amount immediately and that line
         * would be a false statement about money, on the screen where the
         * card is entered.
         *
         * The customer IS entitled during the trial: "trialing" is in the
         * ENTITLED set in billing-shared.ts, so articles generate from day
         * one rather than after the first charge — which is the point of
         * offering it.
         *
         * Stripe collects the card up front and charges automatically when
         * the trial ends, so nothing else has to remember to bill them.
         */
        trial_period_days: TRIAL_DAYS,
      },
    });

    if (!session.url) {
      return { error: "Stripe did not return a Checkout URL" };
    }
    return { url: session.url };
  } catch (error) {
    // Logged in full server-side; the caller gets a message safe to display.
    console.error("[stripe] checkout session failed", error);
    return { error: stripeErrorMessage(error) };
  }
}
