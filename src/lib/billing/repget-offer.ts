/**
 * The REPGET offer, now the LAUNCH PRICE: 40% off EVERY payment of Launch, Grow
 * and Scale, monthly or yearly, for a subscription started while the offer is on
 * (owner and client, 2026-11-11: "to win the first customers"). EUR 59 / 89 /
 * 209 a month instead of 99 / 149 / 349, EUR 590 / 890 / 2,090 a year instead
 * of 990 / 1,490 / 3,490 - the prices the pricing page shows, to the cent.
 * Nothing ends it: the subscription keeps it, through plan changes too
 * (lib/billing/repget-subscription.ts). docs/plan-catalog.md.
 *
 * APPLIED AUTOMATICALLY (client, 2026-11-11: "we auto apply the repget coupon
 * code 40% OFF at the checkout"). Nobody types it: every checkout for a plan it
 * covers carries it, together with the free trial (the discount starts with
 * the first paid invoice), returning customers included - there is no "one use
 * per account" any more (lib/billing/checkouts.ts automaticRepgetCoupon). Off
 * until REPGET_OFFER_ENABLED=1; switching it off stops new checkouts taking it,
 * and subscriptions that have it keep it.
 *
 * WHY THE SERVER PICKS THE COUPON. The discount is a fixed amount per plan and
 * interval, so it is six Stripe coupons, and a Stripe promotion code points at
 * one coupon. So REPGET is not a Stripe promotion code: this picks the coupon.
 * Each is `forever` and limited to its tier's product (scripts/plan-catalog.mjs
 * REPGET_STRIPE_COUPONS, created by scripts/stripe-setup.mjs); monthly and
 * yearly share a product, so it is this table that keeps each interval on its
 * own coupon.
 *
 * A row counts only at the exact catalogue price, because catalog 1's rows at
 * other prices share these products. Credit packs never come here, nor does the
 * Grow + Visibility bundle (a direct purchase at its own price).
 *
 * No server import: the plan screens read the same table to say what applies.
 */
export const REPGET_CODE = "REPGET";

/** The discount is on every payment, not only the first (2026-11-11). For the screens and PayPal to read. */
export const REPGET_EVERY_PAYMENT = true;

/** To a customer whose Checkout could not carry the coupon: Stripe refused it, so nothing was started. */
export const OFFER_UNAVAILABLE = `We could not apply the ${REPGET_CODE} discount just now, so nothing was started and you have not been charged. Our team has been told. Please try again later.`;

/** The Stripe coupon for each plan's monthly price. */
export const REPGET_COUPONS = { launch: "LP40_LAUNCH_M", grow: "LP40_GROW_M", scale: "LP40_SCALE_M" } as const;

/** The Stripe coupon for each plan's yearly price. */
export const REPGET_YEARLY_COUPONS = { launch: "LP40_LAUNCH_Y", grow: "LP40_GROW_Y", scale: "LP40_SCALE_Y" } as const;

/** Every coupon this offer puts on a subscription, whichever interval. */
export const ALL_REPGET_COUPONS: readonly string[] = [...Object.values(REPGET_COUPONS), ...Object.values(REPGET_YEARLY_COUPONS)];

/** The share of the regular price the offer takes off, as the page says it. */
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
  The prices each coupon was made for, and what it takes off: 40% rounded so
  the charge is a whole euro (a month) or ten euros (a year), as the mockup
  shows it. The Stripe coupons must say the same amounts; a test keeps them
  equal to scripts/plan-catalog.mjs.
*/
const COUPONS: Record<keyof typeof REPGET_COUPONS, CouponRow> = {
  launch: { monthCents: 9900, monthOffCents: 4000, yearCents: 99000, yearOffCents: 40000 },
  grow: { monthCents: 14900, monthOffCents: 6000, yearCents: 149000, yearOffCents: 60000 },
  scale: { monthCents: 34900, monthOffCents: 14000, yearCents: 349000, yearOffCents: 140000 },
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

/** The discount in cents on EACH payment: the coupon's fixed amount. Null when not covered. */
export function repgetDiscountCents(plan: OfferPlan): number | null {
  return couponRow(plan)?.offCents ?? null;
}

/**
 * The launch price: what EVERY payment is with the offer (PayPal's price, and
 * the plan screens). The name is from when only the first payment had it. Null
 * when not covered.
 */
export function repgetFirstPaymentCents(plan: OfferPlan): number | null {
  const off = repgetDiscountCents(plan);
  return off === null ? null : plan.priceCents - off;
}

/**
 * The Grow + Visibility bundle's coupon at Stripe (client, 2026-11-12: "In this
 * cases 67% applied ... We need like auto apply coupon code"). Its Stripe price
 * is the struck-through EUR 299 and this `forever` coupon takes EUR 200 off, so
 * Checkout shows "REPGET (67% off)" and charges the row's EUR 99. Not the launch
 * price: on every bundle checkout, REPGET on or off, and never marked as the
 * REPGET offer on the subscription. scripts/plan-catalog.mjs
 * BUNDLE_STRIPE_COUPONS, which a test keeps equal to this.
 */
export const BUNDLE_COUPON = { tier: "grow_visibility", id: "REPGET_GV_M", listCents: 29900, offCents: 20000 } as const;

/**
 * The bundle's coupon for this plan at this Stripe price amount, or null.
 * Only when the price really is the list price the coupon was made for: a
 * bundle row still on its old EUR 99 price takes no coupon (it would charge
 * nothing), and one at any other amount is refused rather than mischarged.
 */
export function bundleCouponFor(plan: OfferPlan, stripeAmountCents: number | null): { coupon: string | null } | { refuse: true } {
  if (plan.tier !== BUNDLE_COUPON.tier || plan.interval !== "month" || plan.currency !== "eur") return { coupon: null };
  if (stripeAmountCents === plan.priceCents) return { coupon: null };
  if (stripeAmountCents === BUNDLE_COUPON.listCents && plan.priceCents === BUNDLE_COUPON.listCents - BUNDLE_COUPON.offCents) return { coupon: BUNDLE_COUPON.id };
  return { refuse: true };
}

/**
 * The offer price the pricing page SHOWS for a regular price: what the coupon
 * for that price and interval charges (EUR 99 -> 59 a month, EUR 990 -> 590 a
 * year), so the page and the charge cannot disagree. A price no coupon was made
 * for gets 40% off, rounded down as the mockup rounds it - to the euro for a
 * month, to ten euros for a year - though checkout does not discount it.
 */
export function offerDisplayCents(regularCents: number, interval: string): number {
  for (const row of Object.values(COUPONS)) {
    if (interval === "month" && regularCents === row.monthCents) return regularCents - row.monthOffCents;
    if (interval === "year" && regularCents === row.yearCents) return regularCents - row.yearOffCents;
  }
  const step = interval === "year" ? 1000 : 100;
  return Math.floor((regularCents * (100 - REPGET_PERCENT_OFF)) / 100 / step) * step;
}
