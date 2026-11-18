import { BUNDLE_COUPON, repgetFirstPaymentCents, type OfferPlan } from "@/lib/billing/repget-offer";

/**
 * The price a plan screen shows - /pricing, Billing's plan cards, the
 * onboarding plan step and the SEO landing pages all read it - and what
 * checkout takes off to get there. ONE function, so the screens cannot drift
 * from each other or from what checkout charges:
 *
 *  - REPGET's launch price (lib/billing/repget-offer.ts), only while the offer
 *    is on (REPGET_OFFER_ENABLED=1) and only for a plan at the exact catalogue
 *    price its coupon was made for: checkout then carries LP40_* on every
 *    payment (lib/billing/checkouts.ts automaticRepgetCoupon). Any other price
 *    shows no discount, because checkout gives none.
 *  - The Grow + Visibility bundle: EUR 99 a month, shown against its EUR 299
 *    list price, which its Stripe price is and its REPGET_GV_M coupon brings
 *    down to the EUR 99 charged (bundleCouponFor) - REPGET on or off. PayPal
 *    charges the same EUR 99 with no discount line.
 *  - Anything else: the plan's own price, nothing struck.
 *
 * The win-back offer is not here: it is one account's, for its first payment
 * only, and its own notice says so (components/billing/offer-code-field.tsx).
 *
 * THE SCREENS SHOW chargedCents ONLY (conservative copy for the ads pilot,
 * 2026-11-18): the owner has no evidence that the regular or list price was
 * ever charged, so no screen strikes it through or quotes a percentage off
 * it. strikeCents and discount still say what checkout takes off - Stripe's
 * own Checkout page lists that coupon line - should that evidence come.
 *
 * No server import: client screens use it too.
 */
export type PlanDisplayPrice = {
  /** What each payment is, in cents: what checkout charges. The one figure the screens show. */
  chargedCents: number;
  /** The Stripe price the coupon is taken from, or null when nothing is taken off. Not shown. */
  strikeCents: number | null;
  /** Which coupon checkout applies, if any. Not shown. */
  discount: "repget" | "bundle" | null;
};

export function planDisplayPrice(plan: OfferPlan, offerOn: boolean): PlanDisplayPrice {
  const bundlePrice = BUNDLE_COUPON.listCents - BUNDLE_COUPON.offCents;
  if (plan.tier === BUNDLE_COUPON.tier && plan.interval === "month" && plan.currency === "eur" && plan.priceCents === bundlePrice) {
    return { chargedCents: plan.priceCents, strikeCents: BUNDLE_COUPON.listCents, discount: "bundle" };
  }
  const launch = offerOn ? repgetFirstPaymentCents(plan) : null;
  if (launch !== null) return { chargedCents: launch, strikeCents: plan.priceCents, discount: "repget" };
  return { chargedCents: plan.priceCents, strikeCents: null, discount: null };
}

/** A yearly figure quoted per month, as /pricing quotes it (EUR 590 a year -> EUR 49.17 a month). */
export function perMonthOfYear(cents: number): number {
  return Math.round(cents / 12);
}
