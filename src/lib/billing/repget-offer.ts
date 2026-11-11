/**
 * The REPGET offer: 40% off the first paid payment of Launch, Grow and Scale,
 * monthly or yearly (owner's decisions, 2026-11-05, and 2026-11-11 for the new
 * pricing page: "implement like the mockup"; docs/plan-catalog.md).
 *
 * APPLIED AUTOMATICALLY (client, 2026-11-11: "we auto apply the repget coupon
 * code 40% OFF at the checkout"). Nobody types it any more: a checkout for a
 * plan it covers carries it, together with the free trial, unless the account
 * has used it (one use per USER ACCOUNT, across every workspace it owns -
 * lib/billing/checkouts.ts repgetOfferState and beginCheckout). Off until
 * REPGET_OFFER_ENABLED=1.
 *
 * WHY THE SERVER PICKS THE COUPON. The discount is a fixed amount per plan and
 * interval, so it is six Stripe coupons, and a Stripe promotion code points at
 * one coupon. So REPGET is not a Stripe promotion code: this picks the coupon.
 *
 *  - MONTHLY: the live coupons LAUNCH40 / GROW40 / SCALE40, EUR 39.60 / 59.60 /
 *    139.60 off once - exactly 40% of the month. The page shows the offer as
 *    EUR 59 / 89 / 209 (rounded down to the euro, as the client's mockup does),
 *    so the first charge is 40 cents more than shown: EUR 59.40 / 89.40 / 209.40.
 *  - YEARLY: 40% off the whole first year, as the mockup bills it: EUR 590 / 890
 *    / 2,090 instead of 990 / 1,490 / 3,490, so LAUNCH40Y / GROW40Y / SCALE40Y,
 *    EUR 400 / 600 / 1,400 off once. Limited to the plan's product like the
 *    monthly ones; monthly and yearly share a product, so it is this table that
 *    keeps each interval on its own coupon.
 *
 * A row counts only at the exact catalogue price, because catalog 1's rows at
 * other prices share these products. Credit packs never come here, nor does the
 * Grow + Visibility bundle (a direct purchase at its own price).
 *
 * No server import: the plan screens read the same table to say what applies.
 */
export const REPGET_CODE = "REPGET";

/** To a customer whose Checkout could not carry the coupon: Stripe refused it, so nothing was started. */
export const OFFER_UNAVAILABLE = `We could not apply the ${REPGET_CODE} discount just now, so nothing was started and you have not been charged. Our team has been told. Please try again later.`;

/** The Stripe coupon for each plan's monthly price. */
export const REPGET_COUPONS = { launch: "LAUNCH40", grow: "GROW40", scale: "SCALE40" } as const;

/** The Stripe coupon for each plan's yearly price (2026-11-11). */
export const REPGET_YEARLY_COUPONS = { launch: "LAUNCH40Y", grow: "GROW40Y", scale: "SCALE40Y" } as const;

/** Every coupon this offer puts on a subscription, whichever interval. */
export const ALL_REPGET_COUPONS: readonly string[] = [...Object.values(REPGET_COUPONS), ...Object.values(REPGET_YEARLY_COUPONS)];

/** The share of the regular price the offer takes off. */
export const REPGET_PERCENT_OFF = 40;

type CouponRow = {
  /** Monthly price the monthly coupon was made for, and that coupon's fixed amount. */
  monthCents: number;
  monthOffCents: number;
  /** Yearly price the yearly coupon was made for, and that coupon's fixed amount. */
  yearCents: number;
  yearOffCents: number;
};

/*
  The prices each coupon was made for, and what it takes off. The Stripe coupons
  must say the same amounts (scripts/stripe-setup.mjs creates the yearly ones);
  a test keeps the yearly amounts equal to the price the page shows.
*/
const COUPONS: Record<keyof typeof REPGET_COUPONS, CouponRow> = {
  launch: { monthCents: 9900, monthOffCents: 3960, yearCents: 99000, yearOffCents: 40000 },
  grow: { monthCents: 14900, monthOffCents: 5960, yearCents: 149000, yearOffCents: 60000 },
  scale: { monthCents: 34900, monthOffCents: 13960, yearCents: 349000, yearOffCents: 140000 },
};

export type OfferPlan = { tier: string; interval: string; currency: string; priceCents: number };

export function repgetOfferEnabled(): boolean {
  return process.env.REPGET_OFFER_ENABLED === "1";
}

function couponRow(plan: OfferPlan): { coupon: string; offCents: number } | null {
  if (plan.currency !== "eur" || !(plan.tier in COUPONS)) return null;
  const tier = plan.tier as keyof typeof COUPONS;
  const row = COUPONS[tier];
  if (plan.interval === "month" && plan.priceCents === row.monthCents) {
    return { coupon: REPGET_COUPONS[tier], offCents: row.monthOffCents };
  }
  if (plan.interval === "year" && plan.priceCents === row.yearCents) {
    return { coupon: REPGET_YEARLY_COUPONS[tier], offCents: row.yearOffCents };
  }
  return null;
}

/**
 * The Stripe coupon for this plan, or null when the offer does not cover it: only
 * Launch, Grow and Scale at their exact catalogue price, the monthly coupon for a
 * monthly price and the yearly coupon for a yearly one.
 */
export function repgetCouponFor(plan: OfferPlan): string | null {
  return couponRow(plan)?.coupon ?? null;
}

/** The discount in cents on the first payment: the coupon's fixed amount. Null when not covered. */
export function repgetDiscountCents(plan: OfferPlan): number | null {
  return couponRow(plan)?.offCents ?? null;
}

/** What the first payment is with the offer (PayPal's intro cycle, and the plan screens). Null when not covered. */
export function repgetFirstPaymentCents(plan: OfferPlan): number | null {
  const off = repgetDiscountCents(plan);
  return off === null ? null : plan.priceCents - off;
}

/**
 * The offer price the pricing page SHOWS for a regular price: 40% off, rounded
 * down as the client's mockup shows it - to the euro for a month (EUR 99 -> 59),
 * to ten euros for a year (EUR 990 -> 590). The yearly figure is what the yearly
 * coupon charges; the monthly one is 40 cents under the monthly coupon's charge
 * (see above).
 */
export function offerDisplayCents(regularCents: number, interval: string): number {
  const step = interval === "year" ? 1000 : 100;
  return Math.floor((regularCents * (100 - REPGET_PERCENT_OFF)) / 100 / step) * step;
}
