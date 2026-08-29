"use server";

import { desc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { subscriptions } from "@/lib/db/schema";
import { isStripeConfigured, stripe } from "@/lib/stripe/client";
import { requireOrg } from "@/lib/tenant";

function appUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_APP_URL is not set");
  }
  return url.replace(/\/$/, "");
}

export type PortalResult = { url: string } | { error: string };

/**
 * Opens the Stripe Customer Portal for the caller's organization.
 *
 * Upgrades, downgrades, cancellations, card updates and invoice history all
 * happen there rather than in our UI: every one of those is a billing flow
 * Stripe already handles correctly (proration, tax, SCA, dunning), and each
 * emits the webhooks that keep our subscription row in sync.
 *
 * The customer is never created here. A user with no customer id has never
 * checked out, so there is nothing to manage - they are sent to checkout
 * instead.
 */
export async function createPortalSession(): Promise<PortalResult> {
  const { orgId } = await requireOrg();

  if (!isStripeConfigured()) {
    return { error: "Payments are not configured yet." };
  }

  const [row] = await db
    .select({ customerId: subscriptions.stripeCustomerId })
    .from(subscriptions)
    .where(eq(subscriptions.organizationId, orgId))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);

  if (!row?.customerId) {
    return { error: "No billing account yet. Choose a plan first." };
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: row.customerId,
    return_url: `${appUrl()}/billing`,
  });

  return { url: session.url };
}
