import { bundleCouponOf, repgetFirstPaymentCents, type OfferPlan } from "@/lib/billing/repget-offer";

/**
 * The price a plan screen shows - /pricing, Billing's plan cards and the
 * onboarding plan step all read it - and the regular price struck through
 * beside it. ONE function, so the screens cannot drift from each other or from
 * what checkout charges:
 *
 *  - REPGET's launch price (lib/billing/repget-offer.ts), only while the offer
 *    is on (REPGET_OFFER_ENABLED=1) and only for a plan at the exact catalogue
 *    price its coupon was made for: checkout then carries LP40_* on every
 *    payment (lib/billing/checkouts.ts automaticRepgetCoupon). Any other price
 *    shows no discount, because checkout gives none.
 *  - The Grow + Visibility bundle: EUR 129 a month, shown as just that - no
 *    struck EUR 299 and no saving (owner, 2026-11-27). Its Stripe price is
 *    still EUR 299 with the REPGET_GV129_M coupon bringing every payment to
 *    the EUR 129 charged (bundleCouponFor); PayPal charges EUR 129 outright.
 *  - Anything else: the plan's own price, nothing struck.
 *
 * The win-back offer is not here: it is one account's, for its first payment
 * only, and its own notice says so (components/billing/offer-code-field.tsx).
 *
 * No server import: client screens use it too.
 */
export type PlanDisplayPrice = {
  /** What each payment is, in cents: what checkout charges. */
  chargedCents: number;
  /** The regular price shown struck through beside it, or null when nothing is taken off. */
  strikeCents: number | null;
  /** Which discount, for the wording around it. */
  discount: "repget" | null;
};

export function planDisplayPrice(plan: OfferPlan, offerOn: boolean): PlanDisplayPrice {
  const bundle = bundleCouponOf(plan);
  if (bundle) return { chargedCents: plan.priceCents, strikeCents: null, discount: null };
  const launch = offerOn ? repgetFirstPaymentCents(plan) : null;
  if (launch !== null) return { chargedCents: launch, strikeCents: plan.priceCents, discount: "repget" };
  return { chargedCents: plan.priceCents, strikeCents: null, discount: null };
}

/** A yearly figure quoted per month, as /pricing quotes it (EUR 590 a year -> EUR 49.17 a month). */
export function perMonthOfYear(cents: number): number {
  return Math.round(cents / 12);
}
