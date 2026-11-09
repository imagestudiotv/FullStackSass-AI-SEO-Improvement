/**
 * The REPGET code: 40% off the first paid month of a monthly plan (the owner's
 * decision, 2026-11-05; docs/plan-catalog.md).
 *
 * WHY THE SERVER PICKS THE COUPON. The discount is a fixed amount per plan, so it
 * is three Stripe coupons, and a Stripe promotion code points at one coupon and
 * must be unique while active. So REPGET is not a Stripe promotion code: the
 * customer gives it to RepGet before Checkout, and this picks the plan's coupon.
 * Stripe's own code box stays on every other checkout, for every other code.
 *
 * Which plans is a table here, not anything the browser sends. A row counts only
 * at the exact catalogue price, monthly or annual (annual gets the same fixed
 * first-month amount, owner's decision 2026-11-07), because catalog 1's rows at
 * other prices share these products. Credit packs never come here. One use per
 * USER ACCOUNT, across every workspace it owns (checkouts.ts beginCheckout).
 *
 * Off until REPGET_OFFER_ENABLED=1.
 */
export const REPGET_CODE = "REPGET";

/** To a customer whose Checkout could not carry the coupon: Stripe refused it, so nothing was started. */
export const OFFER_UNAVAILABLE = `We could not apply the ${REPGET_CODE} discount just now, so nothing was started and you have not been charged. Our team has been told. Please try again later.`;

/** The Stripe coupon for each plan. */
export const REPGET_COUPONS = { launch: "LAUNCH40", grow: "GROW40", scale: "SCALE40" } as const;

/*
  The plan prices each coupon was made for. ANNUAL is included (owner's decision,
  2026-11-07, Daniel's rule): an annual plan gets the SAME fixed first-month
  amount off its first annual payment - Launch EUR 39.60, Grow EUR 59.60, Scale
  EUR 139.60 - not 40% of the year. The coupons are limited by product, and
  monthly and annual share a product, so Stripe applies the same coupon to the
  annual price (shown in test mode: GROW40 on Grow annual = 143040 of 149000).
*/
const COUPONS: Record<string, { coupon: string; priceCents: number; annualCents: number }> = {
  launch: { coupon: REPGET_COUPONS.launch, priceCents: 9900, annualCents: 99000 },
  grow: { coupon: REPGET_COUPONS.grow, priceCents: 14900, annualCents: 149000 },
  scale: { coupon: REPGET_COUPONS.scale, priceCents: 34900, annualCents: 349000 },
};

export type OfferPlan = { tier: string; interval: string; currency: string; priceCents: number };

export function repgetOfferEnabled(): boolean {
  return process.env.REPGET_OFFER_ENABLED === "1";
}

/**
 * The Stripe coupon for this plan, or null when the offer does not cover it: only
 * at the exact catalogue price, monthly or annual, so a row at another price (an
 * older catalogue's) never gets a discount the coupon was not made for.
 */
export function repgetCouponFor(plan: OfferPlan): string | null {
  const row = COUPONS[plan.tier];
  if (!row || plan.currency !== "eur") return null;
  const price = plan.interval === "month" ? row.priceCents : plan.interval === "year" ? row.annualCents : null;
  if (price === null || plan.priceCents !== price) return null;
  return row.coupon;
}

/** The discount in cents for a plan, the same fixed first-month amount monthly or annual. Null when not covered. */
export function repgetDiscountCents(plan: OfferPlan): number | null {
  if (!repgetCouponFor(plan)) return null;
  // 40% of the monthly price: 3960, 5960, 13960.
  return Math.round(COUPONS[plan.tier].priceCents * 0.4);
}

/** What a code given to RepGet means for this plan. Nothing given is simply no offer. */
export function readOfferCode(
  text: string | null | undefined,
  plan: OfferPlan,
): { coupon: string | null; error?: undefined } | { coupon?: undefined; error: string } {
  const code = text?.trim().toUpperCase();
  if (!code) return { coupon: null };
  if (code !== REPGET_CODE || !repgetOfferEnabled()) {
    return { error: "That code is not recognised here. Other promotion codes can be entered on the card payment page." };
  }
  const coupon = repgetCouponFor(plan);
  if (!coupon) return { error: `${REPGET_CODE} applies to the Launch, Grow and Scale plans.` };
  return { coupon };
}

