import type Stripe from "stripe";

import { stripe } from "@/lib/stripe/client";

/**
 * A coupon whose month starts with the paid service, not the free period (the
 * owner's decision on the REPGET code, 2026-11-05: 40% for one month, beginning
 * with the paid plan purchase; docs/plan-catalog.md).
 *
 * WHY THIS EXISTS. Stripe counts a "repeating" coupon's months from when it is
 * first applied, and a code typed at Checkout is applied at once, during the free
 * period. No Stripe setting moves that. So the coupon named by
 * STRIPE_PAID_START_COUPON is taken off a subscription still on its free period,
 * remembered in the subscription's metadata, and put back shortly before the first
 * paid invoice:
 *
 *   - customer.subscription.trial_will_end, three days before a free period runs
 *     out. The month then covers the first invoice and ends before the second;
 *   - or in the same update that ends the free period early (end-free-trial.ts).
 *
 * MONTHLY ONLY. Annual handling is undecided, and a discount must not reach a full
 * annual payment, so a subscription moved to an annual price by then gets none.
 *
 * Unset, nothing is taken off. A coupon already taken off is still put back, so
 * unsetting it cannot cost a customer the discount they were shown. Other coupons,
 * and a subscription with no free period, are not touched.
 */
const HELD_KEY = "paid_start_coupon";

function paidStartCouponId(): string | null {
  return process.env.STRIPE_PAID_START_COUPON?.trim() || null;
}

function couponIdOf(discount: string | Stripe.Discount | Stripe.DeletedDiscount): string | null {
  if (typeof discount === "string") return null;
  const coupon = discount.source.coupon;
  return typeof coupon === "string" ? coupon : (coupon?.id ?? null);
}

/** Takes the coupon off a subscription on its free period, and remembers it. Safe to repeat. */
export async function holdPaidStartCoupon(subscriptionId: string): Promise<void> {
  const coupon = paidStartCouponId();
  if (!coupon) return;
  const live = await stripe.subscriptions.retrieve(subscriptionId, { expand: ["discounts"] });
  if (live.status !== "trialing") return;
  const held = live.discounts.filter((discount) => couponIdOf(discount) === coupon);
  if (held.length === 0) return;
  const kept = live.discounts.filter((discount) => couponIdOf(discount) !== coupon);
  await stripe.subscriptions.update(
    subscriptionId,
    {
      discounts: kept.length > 0 ? kept.map((discount) => ({ discount: typeof discount === "string" ? discount : discount.id })) : "",
      metadata: { [HELD_KEY]: coupon },
    },
    { idempotencyKey: `paid-start-coupon-hold:${subscriptionId}` },
  );
}

/**
 * What to add to the update that starts the paid service, or null if nothing is
 * held. Clears the memory either way, so the coupon goes back once at most.
 */
export function paidStartUpdate(
  subscription: Pick<Stripe.Subscription, "metadata" | "items">,
): Pick<Stripe.SubscriptionUpdateParams, "discounts" | "metadata"> | null {
  const coupon = subscription.metadata?.[HELD_KEY];
  if (!coupon) return null;
  const monthly = subscription.items.data.every((item) => item.price.recurring?.interval === "month");
  return { ...(monthly ? { discounts: [{ coupon }] } : {}), metadata: { [HELD_KEY]: "" } };
}

/** Puts the coupon back before a free period runs out. Safe to repeat. */
export async function applyPaidStartCoupon(subscriptionId: string): Promise<void> {
  const live = await stripe.subscriptions.retrieve(subscriptionId);
  if (live.status !== "trialing") return;
  const update = paidStartUpdate(live);
  if (!update) return;
  await stripe.subscriptions.update(subscriptionId, update, { idempotencyKey: `paid-start-coupon-apply:${subscriptionId}` });
}
