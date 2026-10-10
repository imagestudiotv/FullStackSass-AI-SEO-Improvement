"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { isEntitled } from "@/lib/billing-shared";
import { checkoutProviderOps } from "@/lib/billing/checkout-providers";
import {
  beginCheckout,
  markCheckoutFailed,
  recordCheckoutRequest,
  recordCheckoutStarted,
  settlePayPalReturn,
} from "@/lib/billing/checkouts";
import { syncPayPalSubscription } from "@/lib/billing/paypal-events";
import { rememberPayer } from "@/lib/conversions/conversions";
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

/**
 * Whether to offer PayPal at all: only where a PayPal checkout can complete
 * (credentials, PAYPAL_WEBHOOK_ID and a valid PAYPAL_ENV - client.ts). A
 * plan without a PayPal plan id gets no PayPal button either; the pages
 * decide that per plan.
 */
export async function isPayPalAvailable(): Promise<boolean> {
  return isPayPalConfigured();
}

export type PayPalReturnResult = {
  /** Something was recorded or released: the page should read its state again. */
  changed: boolean;
  /** PayPal has not finished yet (approval or activation pending): worth asking again shortly. */
  waiting: boolean;
};

/**
 * Settles what PayPal's return or cancel redirect left behind, for ONE
 * website (lib/billing/checkouts.ts settlePayPalReturn). Called by the page
 * the customer lands on (components/paypal-return.tsx), never during its
 * render: it writes.
 *
 * The workspace comes from the session and the website is re-checked against
 * it, as everywhere else. The subscription id PayPal appends to the address
 * is never read: which checkout to look at is our own record, and what
 * happened to it is what PayPal says when asked now.
 */
export async function confirmPayPalReturn(
  websiteId: string,
  outcome: "success" | "cancelled",
): Promise<PayPalReturnResult> {
  const nothing: PayPalReturnResult = { changed: false, waiting: false };
  const { orgId } = await requireOrg();
  if ((outcome !== "success" && outcome !== "cancelled") || !isPayPalConfigured()) return nothing;

  const [site] = await db
    .select({ id: websites.id })
    .from(websites)
    .where(and(eq(websites.id, websiteId), eq(websites.organizationId, orgId)))
    .limit(1);
  if (!site) return nothing;

  const settled = await settlePayPalReturn(
    db,
    { organizationId: orgId, websiteId: site.id },
    outcome,
    checkoutProviderOps,
  );

  let waiting = false;
  if (outcome === "success" && (settled.pending.length > 0 || settled.synced.length > 0)) {
    // Approved but not yet active at PayPal: the plan is not there yet.
    const [current] = await db
      .select({ status: subscriptions.status })
      .from(subscriptions)
      .where(eq(subscriptions.websiteId, site.id))
      .limit(1);
    waiting = !isEntitled(current?.status);
  }
  return { changed: settled.synced.length > 0 || settled.released.length > 0, waiting };
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
  // The payer's GA identity, for the purchase reported when the money arrives.
  await rememberPayer(db, checkoutId);
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
