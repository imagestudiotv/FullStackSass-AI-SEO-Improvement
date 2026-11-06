import { and, eq, sql } from "drizzle-orm";

import { billingCheckouts } from "@/lib/db/schema";
import type { Executor } from "@/lib/db/types";

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
 * at the exact price the coupon was made for, so the amount is always 40%, and
 * only monthly: annual handling is undecided, and catalog 1's rows at other prices
 * share these products. Credit packs never come here.
 *
 * Off until REPGET_OFFER_ENABLED=1.
 */
export const REPGET_CODE = "REPGET";

/** To a customer whose Checkout could not carry the coupon: Stripe refused it, so nothing was started. */
export const OFFER_UNAVAILABLE = `We could not apply the ${REPGET_CODE} discount just now, so nothing was started and you have not been charged. Our team has been told. Please try again later.`;

/** The Stripe coupon for each plan. */
export const REPGET_COUPONS = { launch: "LAUNCH40", grow: "GROW40", scale: "SCALE40" } as const;

const COUPONS: Record<string, { coupon: string; priceCents: number }> = {
  launch: { coupon: REPGET_COUPONS.launch, priceCents: 9900 },
  grow: { coupon: REPGET_COUPONS.grow, priceCents: 14900 },
  scale: { coupon: REPGET_COUPONS.scale, priceCents: 34900 },
};

export type OfferPlan = { tier: string; interval: string; currency: string; priceCents: number };

export function repgetOfferEnabled(): boolean {
  return process.env.REPGET_OFFER_ENABLED === "1";
}

/** The Stripe coupon for this plan, or null when the offer does not cover it. */
export function repgetCouponFor(plan: OfferPlan): string | null {
  const row = COUPONS[plan.tier];
  if (!row || plan.interval !== "month" || plan.currency !== "eur" || plan.priceCents !== row.priceCents) return null;
  return row.coupon;
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
  if (!coupon) return { error: `${REPGET_CODE} applies to a monthly Launch, Grow or Scale plan.` };
  return { coupon };
}

/** One redemption per workspace: a checkout that completed with this offer. */
export async function repgetOfferUsed(executor: Pick<Executor, "select">, organizationId: string): Promise<boolean> {
  const [row] = await executor
    .select({ id: billingCheckouts.id })
    .from(billingCheckouts)
    .where(
      and(
        eq(billingCheckouts.organizationId, organizationId),
        eq(billingCheckouts.status, "completed"),
        sql`${billingCheckouts.requestParams} ->> 'offer' = ${REPGET_CODE}`,
      ),
    )
    .limit(1);
  return Boolean(row);
}
