"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { checkoutProviderOps } from "@/lib/billing/checkout-providers";
import {
  beginCheckout,
  markCheckoutFailed,
  recordCheckoutRequest,
  recordCheckoutStarted,
} from "@/lib/billing/checkouts";
import { syncPayPalSubscription } from "@/lib/billing/paypal-events";
import { db } from "@/lib/db";
import { plans, subscriptions, websites } from "@/lib/db/schema";
import { isPayPalConfigured, PayPalError } from "@/lib/paypal/client";
import {
  cancelSubscription,
  createSubscription,
  reviseSubscription,
} from "@/lib/paypal/subscriptions";
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

export async function isPayPalAvailable(): Promise<boolean> {
  return isPayPalConfigured();
}

/**
 * Starts a PayPal subscription for a website - or revises the plan of the
 * one it already has.
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

  const [plan] = await db
    .select({
      id: plans.id,
      name: plans.name,
      paypalPlanId: plans.paypalPlanId,
      isActive: plans.isActive,
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

  const base = appUrl();
  const returnUrl = `${base}${checkoutReturnPath(origin, "success", websiteId, "paypal")}`;
  const cancelUrl = `${base}${checkoutReturnPath(origin, "cancelled", websiteId, "paypal")}`;

  let begun: Awaited<ReturnType<typeof beginCheckout>>;
  try {
    begun = await beginCheckout(
      db,
      { organizationId: orgId, websiteId, provider: "paypal", planId: plan.id },
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
      The same subscription, revised: PayPal asks the buyer to approve the
      new price and the UPDATED webhook records it. Never a second one.
    */
    try {
      const revised = await reviseSubscription({
        subscriptionId: begun.current.providerSubscriptionId,
        planId: plan.paypalPlanId,
        returnUrl,
        cancelUrl,
      });
      return { url: revised.approveUrl ?? returnUrl };
    } catch (error) {
      if (error instanceof PayPalError) {
        return { error: "PayPal could not change the plan." };
      }
      throw error;
    }
  }

  const { checkoutId } = begun;
  const idempotencyKey = `checkout:${checkoutId}`;
  try {
    await recordCheckoutRequest(db, checkoutId, {
      idempotencyKey,
      params: { plan: plan.paypalPlanId },
    });
    const result = await createSubscription({
      planId: plan.paypalPlanId,
      organizationId: orgId,
      websiteId,
      checkoutId,
      returnUrl,
      cancelUrl,
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
  if (row.status === "canceled") {
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
