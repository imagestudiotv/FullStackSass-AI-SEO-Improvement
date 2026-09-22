"use server";

import { and, desc, eq, isNotNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { billingCustomers, subscriptions } from "@/lib/db/schema";
import { isStripeConfigured, stripe } from "@/lib/stripe/client";
import { stripeErrorMessage } from "@/lib/stripe/errors";
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
 * Which screen of the portal to open on.
 *
 * "cancel" deep-links straight into Stripe's cancellation flow rather than
 * the portal home, so a customer who pressed "Cancel subscription" here does
 * not have to find it again over there.
 */
export type PortalFlow = "manage" | "cancel";

/**
 * Opens the Stripe Customer Portal for the caller's organization.
 *
 * Upgrades, downgrades, cancellations, card updates and invoice history all
 * happen there rather than in our UI: every one of those is a billing flow
 * Stripe already handles correctly (proration, tax, SCA, dunning), and each
 * emits the webhooks that keep our subscription row in sync.
 *
 * Pausing is deliberately NOT a flow here. Stripe exposes cancellation as a
 * portal deep link but has no equivalent for pause_collection, and setting it
 * through the API instead would skip the portal's confirmation entirely — a
 * single click would silently stop a customer's billing with no way back in
 * the same screen. The pause button opens the portal home, where pausing sits
 * next to resuming.
 *
 * The customer is never created here. A user with no customer id has never
 * checked out, so there is nothing to manage - they are sent to checkout
 * instead.
 */
export async function createPortalSession(
  flow: PortalFlow = "manage",
): Promise<PortalResult> {
  const { orgId } = await requireOrg();

  if (!isStripeConfigured()) {
    return { error: "Payments are not configured yet." };
  }

  /*
    From billing_customers, which is the one place a Stripe customer lives
    now. It used to read the newest subscription row, which broke once a
    workspace could have several: the newest row belonged to whichever site
    was bought most recently, and a row created before the customer id was
    known carried null — sending someone with a perfectly good billing
    account to "choose a plan first".
  */
  const [row] = await db
    .select({ customerId: billingCustomers.stripeCustomerId })
    .from(billingCustomers)
    .where(eq(billingCustomers.organizationId, orgId))
    .limit(1);

  if (!row?.customerId) {
    return { error: "No billing account yet. Choose a plan first." };
  }

  /**
   * The subscription to cancel, needed only for the deep link.
   *
   * Newest first: a workspace can hold one per website, and the cancel flow
   * names exactly one. Falling back to the portal home when there is none is
   * the right outcome — there is nothing to cancel, and the home screen says
   * so better than an error would.
   */
  let subscriptionId: string | null = null;
  if (flow === "cancel") {
    const [active] = await db
      .select({ id: subscriptions.stripeSubscriptionId })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.organizationId, orgId),
          isNotNull(subscriptions.stripeSubscriptionId),
        ),
      )
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);
    subscriptionId = active?.id ?? null;
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: row.customerId,
      return_url: `${appUrl()}/billing`,
      ...(flow === "cancel" && subscriptionId
        ? {
            flow_data: {
              type: "subscription_cancel" as const,
              subscription_cancel: { subscription: subscriptionId },
            },
          }
        : {}),
    });

    return { url: session.url };
  } catch (error) {
    // A customer id from the other Stripe mode fails here exactly as it does
    // in checkout, and would otherwise surface as an opaque 500.
    console.error("[stripe] billing portal failed", error);
    return { error: stripeErrorMessage(error) };
  }
}
