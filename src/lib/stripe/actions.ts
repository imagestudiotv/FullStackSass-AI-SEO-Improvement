"use server";

import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { plans } from "@/lib/db/schema";
import { isStripeConfigured, stripe } from "@/lib/stripe/client";
import { getOrCreateCustomer } from "@/lib/stripe/customer";
import { stripeErrorMessage } from "@/lib/stripe/errors";
import { requireOrg } from "@/lib/tenant";

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
): Promise<CheckoutResult> {
  const { orgId } = await requireOrg();

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
      success_url: `${base}/billing?checkout=success`,
      cancel_url: `${base}/billing?checkout=cancelled`,
      allow_promotion_codes: true,
      // Metadata on the SESSION identifies this checkout...
      metadata: { organizationId: orgId, planId: plan.id },
      // ...but session metadata does NOT propagate to the subscription. Without
      // this second copy, a customer.subscription.updated arriving weeks later
      // (say, after a portal upgrade) has no way to identify the organization.
      subscription_data: {
        metadata: { organizationId: orgId, planId: plan.id },
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
