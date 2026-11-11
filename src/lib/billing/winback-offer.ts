import { isDirectPurchaseTier } from "@/lib/plans/features";

import type { OfferPlan } from "./repget-offer";

/**
 * The win-back offer (client ticket 2026-11-11, "Email Autopilot": "get extra
 * credits, and 20% off - for clients that leave or pause our program").
 *
 * WHO. Someone whose subscription ENDED after they cancelled it - a paid plan
 * that ran out, or a free period cancelled or ended without a plan starting -
 * and who has no other subscription running. They get the "winback" email
 * about two days later, once per person ever (lib/email/lifecycle-triggers.ts
 * emailWinback). RepGet has no pause feature, so "pause" is not a case.
 *
 * WHAT. 20% off the FIRST payment of a restarted Launch, Grow or Scale plan,
 * monthly or yearly, plus WINBACK_BONUS_CREDITS credits added once that
 * restarted plan's first payment goes through (lib/billing/winback.ts).
 *
 * APPLIED AUTOMATICALLY, like REPGET: an account whose owner was SENT the
 * email gets it at checkout, server-chosen, one use per account
 * (lib/billing/checkouts.ts automaticOffer). Never stacked: a checkout
 * carrying it has no promotion-code box (no partner code), and while the
 * REPGET launch price is on, a plan it covers gets REPGET - the bigger
 * discount, on every payment - instead, the 20% not applied - but the 100
 * credits still follow that restart, as the email promised
 * (lib/billing/winback.ts), and the offer is then used.
 *
 *  - Stripe: one percent coupon, WINBACK20, 20% off once, limited to the
 *    Launch, Grow and Scale products (scripts/stripe-setup.mjs makes it).
 *  - PayPal: the REPGET offer plans already made (scripts/paypal-setup.mjs),
 *    whose one intro cycle is priced per subscription - here at 80% of the
 *    price. No new PayPal plan is needed; a plan without them is card-only.
 *  - The Grow + Visibility bundle (a direct purchase) never takes it, as it
 *    never takes REPGET.
 *
 * OFF until WINBACK_OFFER_ENABLED=1: until then the email is not sent and no
 * checkout carries the coupon, so nothing is promised before the Stripe
 * coupon exists.
 *
 * No server import: the plan screens read the same rules to say what applies.
 */
export const WINBACK_CODE = "WINBACK";

/** The Stripe coupon: 20% off, duration once (scripts/stripe-setup.mjs). */
export const WINBACK_COUPON = "WINBACK20";

export const WINBACK_PERCENT_OFF = 20;

/** Credits added when the restarted plan's first payment goes through. */
export const WINBACK_BONUS_CREDITS = 100;

/** The plans it covers: the subscription tiers, never the bundle. */
export const WINBACK_TIERS: readonly string[] = ["launch", "grow", "scale"];

/** To a customer whose Checkout could not carry the coupon: Stripe refused it, so nothing was started. */
export const WINBACK_UNAVAILABLE =
  "We could not apply your welcome-back discount just now, so nothing was started and you have not been charged. Our team has been told. Please try again later.";

export function winbackOfferEnabled(): boolean {
  return process.env.WINBACK_OFFER_ENABLED === "1";
}

export function winbackCovers(plan: Pick<OfferPlan, "tier">): boolean {
  return WINBACK_TIERS.includes(plan.tier) && !isDirectPurchaseTier(plan.tier);
}

/** The discount in cents on the first payment (what Stripe's 20% coupon takes, rounded to the cent). Null when not covered. */
export function winbackDiscountCents(plan: OfferPlan): number | null {
  if (!winbackCovers(plan) || !(plan.priceCents > 0)) return null;
  return Math.round((plan.priceCents * WINBACK_PERCENT_OFF) / 100);
}

/** What the first payment is with the offer (PayPal's intro cycle, and the plan screens). Null when not covered. */
export function winbackFirstPaymentCents(plan: OfferPlan): number | null {
  const off = winbackDiscountCents(plan);
  return off === null ? null : plan.priceCents - off;
}
