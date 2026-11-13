import { formatPrice } from "@/lib/billing-shared";
import { perMonthOfYear, planDisplayPrice } from "@/lib/billing/display-prices";
import type { OfferPlan } from "@/lib/billing/repget-offer";

export type CardPrices = {
  monthly: { regular: string; price: string };
  /** Per month, as the design quotes a yearly plan, with the year's total. Null without a yearly row. */
  yearly: { regular: string; price: string; total: string; regularTotal: string } | null;
};

/**
 * The figures on a plan card, from the plan's own rows (the prices checkout
 * charges). With the REPGET launch price, 40% off every payment as the design
 * shows it, and exactly what its coupon charges - through planDisplayPrice
 * (lib/billing/display-prices.ts), which Billing and the onboarding plan step
 * read too: EUR 99 -> 59 a month, and EUR 990 -> 590 a year, quoted as 49.17 a
 * month against 82.50. A price no coupon covers shows no discount, as checkout
 * gives none.
 */
export function cardPrices(monthly: OfferPlan, annual: OfferPlan | null, offer: boolean): CardPrices {
  const money = (cents: number) => formatPrice(cents, monthly.currency);
  const month = planDisplayPrice(monthly, offer);
  const result: CardPrices = {
    monthly: { regular: money(monthly.priceCents), price: money(month.chargedCents) },
    yearly: null,
  };
  if (annual) {
    const year = annual.priceCents;
    const charged = planDisplayPrice(annual, offer).chargedCents;
    result.yearly = {
      regular: money(perMonthOfYear(year)),
      price: money(perMonthOfYear(charged)),
      total: money(charged),
      regularTotal: money(year),
    };
  }
  return result;
}

/** The bundle's "SAVE 67%": its price against the value the design strikes through, to the whole percent. */
export function bundleSavingPercent(priceCents: number, compareAtCents: number): number {
  if (compareAtCents <= priceCents) return 0;
  return Math.round(((compareAtCents - priceCents) / compareAtCents) * 100);
}
