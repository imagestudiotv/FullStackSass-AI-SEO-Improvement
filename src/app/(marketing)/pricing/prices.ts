import { formatPrice } from "@/lib/billing-shared";
import { offerDisplayCents } from "@/lib/billing/repget-offer";

/** What a plan row gives the price display. */
type Priced = { priceCents: number; currency: string };

export type CardPrices = {
  monthly: { regular: string; price: string };
  /** Per month, as the design quotes a yearly plan, with the year's total. Null without a yearly row. */
  yearly: { regular: string; price: string; total: string; regularTotal: string } | null;
};

/**
 * The figures on a plan card, from the plan's own rows (the prices checkout
 * charges). With the REPGET launch price, 40% off every payment as the design
 * shows it, and exactly what its coupon charges (lib/billing/repget-offer.ts
 * offerDisplayCents): EUR 99 -> 59 a month, and EUR 990 -> 590 a year, quoted
 * as 49.17 a month against 82.50.
 */
export function cardPrices(monthly: Priced, annual: Priced | null, offer: boolean): CardPrices {
  const money = (cents: number) => formatPrice(cents, monthly.currency);
  const month = monthly.priceCents;
  const result: CardPrices = {
    monthly: { regular: money(month), price: money(offer ? offerDisplayCents(month, "month") : month) },
    yearly: null,
  };
  if (annual) {
    const year = annual.priceCents;
    const charged = offer ? offerDisplayCents(year, "year") : year;
    result.yearly = {
      regular: money(Math.round(year / 12)),
      price: money(Math.round(charged / 12)),
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
