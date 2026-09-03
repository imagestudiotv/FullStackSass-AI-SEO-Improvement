"use server";

import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { addons } from "@/lib/db/schema";
import { getOrCreateCustomer } from "@/lib/stripe/customer";
import { isStripeConfigured, stripe } from "@/lib/stripe/client";
import { requireOrg } from "@/lib/tenant";
import {
  hasStarterTrial,
  STARTER_TRIAL_SLUG,
  type StarterCheckoutResult,
} from "@/lib/onboarding/shared";

/**
 * Buying the Starter trial.
 *
 * Separate from buyAddon because this one has rules that add-ons do not: it is
 * limited to one per workspace, and it lands the customer in onboarding rather
 * than on the billing page — they have just bought an article, and the next
 * thing they need to do is tell us which site to write it for.
 */

/** Absolute base URL for Stripe's return links. */
function appUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL;
  if (!url) throw new Error("NEXT_PUBLIC_APP_URL is not set");
  return url.replace(/\/+$/, "");
}

export async function buyStarterTrial(): Promise<StarterCheckoutResult> {
  const { orgId } = await requireOrg();

  if (!isStripeConfigured()) {
    return { error: "Payments are not configured yet." };
  }

  /**
   * Checked before charging, not only after.
   *
   * The unique index means a second payment would take the money and grant
   * nothing, which is the worst outcome available — the customer is charged
   * and gets no article. Refusing up front costs them nothing.
   */
  if (await hasStarterTrial(orgId)) {
    return {
      error:
        "You have already used the Starter offer. Choose a plan to keep going.",
    };
  }

  const [addon] = await db
    .select({
      id: addons.id,
      name: addons.name,
      stripePriceId: addons.stripePriceId,
      isActive: addons.isActive,
    })
    .from(addons)
    .where(eq(addons.slug, STARTER_TRIAL_SLUG))
    .limit(1);

  if (!addon || !addon.isActive) {
    return { error: "The Starter offer is not available right now." };
  }
  if (!addon.stripePriceId) {
    return { error: "The Starter offer has no price configured yet." };
  }

  const customerId = await getOrCreateCustomer(orgId);
  const base = appUrl();

  const session = await stripe.checkout.sessions.create({
    // "payment", not "subscription": the offer is explicitly one-time, and
    // the whole appeal is that there is nothing to cancel afterwards.
    mode: "payment",
    customer: customerId,
    line_items: [{ price: addon.stripePriceId, quantity: 1 }],
    success_url: `${base}/onboarding?starter=success`,
    cancel_url: `${base}/onboarding?starter=cancelled`,
    /**
     * The webhook reads both. Without them a completed payment arrives with no
     * way to tell which workspace bought what, and money is taken with nothing
     * granted.
     */
    metadata: { organizationId: orgId, addonId: addon.id },
  });

  if (!session.url) {
    return { error: "Could not start checkout. Please try again." };
  }

  return { url: session.url };
}
