import { formatPrice } from "@/lib/billing-shared";
import { perMonthOfYear, planDisplayPrice } from "@/lib/billing/display-prices";
import type { OfferPlan } from "@/lib/billing/repget-offer";

export type CardPrices = {
  monthly: { price: string };
  /** Per month, as the design quotes a yearly plan, with the year's total. Null without a yearly row. */
  yearly: { price: string; total: string } | null;
};

/**
 * The figures on a plan card, from the plan's own rows: what checkout charges,
 * through planDisplayPrice (lib/billing/display-prices.ts), which Billing and
 * the onboarding plan step read too. With the REPGET launch price that is its
 * coupon's charge (EUR 99 -> 59 a month, EUR 990 -> 590 a year, quoted as 49.17
 * a month); without it, or for a price no coupon covers, the plan's own price.
 *
 * Only the charged figure: no regular price beside it (conservative copy,
 * 2026-11-18 - there is no evidence a reference price was ever charged).
 */
export function cardPrices(monthly: OfferPlan, annual: OfferPlan | null, offer: boolean): CardPrices {
  const money = (cents: number) => formatPrice(cents, monthly.currency);
  const result: CardPrices = {
    monthly: { price: money(planDisplayPrice(monthly, offer).chargedCents) },
    yearly: null,
  };
  if (annual) {
    const charged = planDisplayPrice(annual, offer).chargedCents;
    result.yearly = { price: money(perMonthOfYear(charged)), total: money(charged) };
  }
  return result;
}
