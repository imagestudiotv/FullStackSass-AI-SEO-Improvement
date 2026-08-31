"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { plans, subscriptions } from "@/lib/db/schema";
import { isPayPalConfigured, PayPalError } from "@/lib/paypal/client";
import {
  cancelSubscription,
  createSubscription,
} from "@/lib/paypal/subscriptions";
import { requireOrg } from "@/lib/tenant";

/**
 * PayPal checkout actions.
 *
 * Mirrors lib/stripe/actions.ts deliberately: same guard, same result shape,
 * same rule that access is granted only by the webhook. The billing page can
 * then treat the two processors identically.
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
 * Starts a PayPal subscription for the caller's organization.
 *
 * Returns the approval URL. Nothing is charged until the customer approves on
 * PayPal, and nothing is granted until the webhook confirms activation.
 */
export async function createPayPalCheckout(
  planId: string,
): Promise<PayPalResult> {
  const { orgId } = await requireOrg();

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
     * Stripe before it has been mirrored into PayPal, and the customer should
     * be told to use a card rather than shown an error.
     */
    return {
      error: `"${plan.name}" is not available through PayPal yet. Please pay by card.`,
    };
  }

  const base = appUrl();
  try {
    const result = await createSubscription({
      planId: plan.paypalPlanId,
      organizationId: orgId,
      returnUrl: `${base}/billing?paypal=success`,
      cancelUrl: `${base}/billing?paypal=cancelled`,
    });
    return { url: result.approveUrl };
  } catch (error) {
    if (error instanceof PayPalError) {
      return { error: "PayPal could not start the subscription." };
    }
    throw error;
  }
}

export type CancelResult = { ok: true } | { ok: false; error: string };

/**
 * Cancels a PayPal subscription.
 *
 * PayPal has no hosted management portal equivalent to Stripe's, so
 * cancellation happens here. The webhook still writes the resulting state —
 * this only asks PayPal to cancel.
 */
export async function cancelPayPalSubscription(): Promise<CancelResult> {
  const { orgId } = await requireOrg();

  const [row] = await db
    .select({
      provider: subscriptions.provider,
      paypalSubscriptionId: subscriptions.paypalSubscriptionId,
    })
    .from(subscriptions)
    .where(eq(subscriptions.organizationId, orgId))
    .limit(1);

  if (!row || row.provider !== "paypal" || !row.paypalSubscriptionId) {
    return { ok: false, error: "No PayPal subscription to cancel" };
  }

  try {
    await cancelSubscription(row.paypalSubscriptionId);
  } catch (error) {
    if (error instanceof PayPalError) {
      return { ok: false, error: "PayPal could not cancel the subscription." };
    }
    throw error;
  }

  revalidatePath("/billing");
  return { ok: true };
}
