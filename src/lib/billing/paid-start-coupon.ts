import { eq } from "drizzle-orm";
import type Stripe from "stripe";

import { repgetCouponFor } from "@/lib/billing/repget-offer";
import { db } from "@/lib/db";
import { plans } from "@/lib/db/schema";
import { stripe } from "@/lib/stripe/client";

/**
 * The REPGET discount for a customer on a free period (lib/billing/repget-offer.ts).
 *
 * WHY IT WAITS. The discount is for the first paid month, and a coupon on the
 * subscription during the free period could be used up there. So Checkout puts no
 * coupon on: the offer is remembered in the subscription's metadata (PAID_START_KEY)
 * and the coupon goes on just before the first paid invoice:
 *
 *   - customer.subscription.trial_will_end, three days before a free period runs out;
 *   - or in the same update that ends it early (end-free-trial.ts).
 *
 * THE PLAN AT THAT MOMENT DECIDES, not the plan at Checkout, because the coupons are
 * per plan and the customer can change plan meanwhile. On an annual plan by then
 * there is no discount: annual handling is undecided.
 */
export const PAID_START_KEY = "paid_start_offer";

/**
 * What to add to the update that starts the paid service, or null if no offer is
 * waiting. Clears the memory either way, so the coupon goes on once at most.
 */
export async function paidStartUpdate(
  subscription: Pick<Stripe.Subscription, "metadata" | "items">,
): Promise<Pick<Stripe.SubscriptionUpdateParams, "discounts" | "metadata"> | null> {
  if (!subscription.metadata?.[PAID_START_KEY]) return null;
  const priceId = subscription.items.data[0]?.price.id;
  const [plan] = priceId
    ? await db
        .select({ tier: plans.tier, interval: plans.interval, currency: plans.currency, priceCents: plans.priceCents })
        .from(plans)
        .where(eq(plans.stripePriceId, priceId))
        .limit(1)
    : [];
  const coupon = plan ? repgetCouponFor(plan) : null;
  return { ...(coupon ? { discounts: [{ coupon }] } : {}), metadata: { [PAID_START_KEY]: "" } };
}

/** Puts the coupon on before a free period runs out. Safe to repeat. */
export async function applyPaidStartCoupon(subscriptionId: string): Promise<void> {
  const live = await stripe.subscriptions.retrieve(subscriptionId);
  if (live.status !== "trialing") return;
  const update = await paidStartUpdate(live);
  if (!update) return;
  await stripe.subscriptions.update(subscriptionId, update, { idempotencyKey: `paid-start-coupon-apply:${subscriptionId}` });
}
