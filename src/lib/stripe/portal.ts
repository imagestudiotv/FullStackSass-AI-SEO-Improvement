"use server";

import { and, eq, isNotNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { billingCustomers, subscriptions, websites } from "@/lib/db/schema";
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
 * Pausing is NOT offered. Stripe's portal cannot pause a subscription at all
 * ("subscribers can't use the portal to pause subscriptions themselves",
 * docs.stripe.com/billing/subscriptions/pause), trial or not, so the billing
 * page's "Pause billing" button - which only opened the portal home - was
 * removed (2026-09-29). Real pausing would need Stripe's pause API and RepGet
 * stopping work while a subscription is paused.
 *
 * The customer is never created here. A user with no customer id has never
 * checked out, so there is nothing to manage - they are sent to checkout
 * instead.
 */
export async function createPortalSession(
  flow: PortalFlow = "manage",
  /**
   * The website whose subscription a "cancel" is for. Required for cancel:
   * a workspace pays per website, and the deep link names one subscription.
   */
  websiteId?: string | null,
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
   * THE SELECTED WEBSITE'S, never "the newest in the workspace": that used to
   * be picked, and in a workspace paying for several sites the cancel screen
   * could open on a different site's subscription than the one the customer
   * pressed cancel for. The website must belong to the caller, and must be
   * paying through Stripe; otherwise this refuses rather than guessing.
   */
  let subscriptionId: string | null = null;
  if (flow === "cancel") {
    if (!websiteId) {
      return { error: "Choose the website whose subscription you want to cancel." };
    }
    const [target] = await db
      .select({ id: subscriptions.stripeSubscriptionId, provider: subscriptions.provider })
      .from(subscriptions)
      .innerJoin(websites, eq(websites.id, subscriptions.websiteId))
      .where(
        and(
          eq(subscriptions.websiteId, websiteId),
          eq(websites.organizationId, orgId),
          isNotNull(subscriptions.stripeSubscriptionId),
        ),
      )
      .limit(1);
    if (!target?.id) {
      return { error: "This website has no card subscription to cancel." };
    }
    subscriptionId = target.id;
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
