import { describe, expect, it } from "vitest";

import { cardPrices } from "@/app/(marketing)/pricing/prices";
import { pricingPageCopy } from "@/lib/i18n/pricing-page";

import { defaultTier, growthPlanOffers } from "./plan-offers";

/**
 * The plans the growth plan's last step offers (plan-offers.ts): the
 * onboarding plan step's choice (monthly rows, no bundle bought outright),
 * at /pricing's figures, in the reader's language.
 */

const row = (tier: string, interval: "month" | "year", priceCents: number, extra: { name?: string; paypalPlanId?: string | null; paypalTrialPlanId?: string | null } = {}) => ({
  id: `${tier}-${interval}`,
  tier,
  name: extra.name ?? (interval === "year" ? `${tier[0].toUpperCase()}${tier.slice(1)} (Annual)` : `${tier[0].toUpperCase()}${tier.slice(1)}`),
  priceCents,
  currency: "eur",
  interval,
  articleLimit: 30,
  socialPostLimit: 20,
  keywordLimit: 100,
  siteLimit: 1,
  monthlyCredits: 0,
  paypalPlanId: extra.paypalPlanId === undefined ? `P-${tier}-${interval}` : extra.paypalPlanId,
  paypalTrialPlanId: extra.paypalTrialPlanId === undefined ? `P-${tier}-${interval}-trial` : extra.paypalTrialPlanId,
});

const ROWS = [
  row("launch", "month", 4900),
  row("grow", "month", 9900),
  row("grow", "year", 99000),
  row("scale", "month", 19900, { paypalPlanId: null }),
  row("grow_visibility", "month", 9900),
];

describe("growthPlanOffers", () => {
  it("offers the monthly plans on sale, without the bundle bought outright, in order", () => {
    expect(growthPlanOffers(ROWS, "en", false, true).map((offer) => offer.tier)).toEqual(["launch", "grow", "scale"]);
  });

  it("quotes /pricing's figures, with the yearly price per month when there is one", () => {
    const grow = growthPlanOffers(ROWS, "en", false, true).find((offer) => offer.tier === "grow")!;
    const prices = cardPrices(ROWS[1], ROWS[2], false);
    expect(grow.price).toBe(prices.monthly.price);
    expect(grow.regular).toBeNull();
    expect(grow.yearly).toEqual({ perMonth: prices.yearly!.price, total: prices.yearly!.total });
    expect(grow.dueToday).toBe("€0");
    expect(grow.popular).toBe(true);
    expect(growthPlanOffers(ROWS, "en", false, true).find((offer) => offer.tier === "launch")!.yearly).toBeNull();
  });

  it("strikes the regular price through only while the launch price applies to it", () => {
    for (const offer of growthPlanOffers(ROWS, "en", true, true)) {
      const monthly = ROWS.find((plan) => plan.tier === offer.tier && plan.interval === "month")!;
      const prices = cardPrices(monthly, null, true);
      expect(offer.price).toBe(prices.monthly.price);
      expect(offer.regular).toBe(prices.monthly.regular === prices.monthly.price ? null : prices.monthly.regular);
    }
  });

  it("says PayPal only for a plan PayPal can take with the free trial, while PayPal is on", () => {
    const on = growthPlanOffers(ROWS, "en", false, true);
    expect(on.map((offer) => offer.paypal)).toEqual([true, true, false]);
    expect(growthPlanOffers(ROWS, "en", false, false).every((offer) => !offer.paypal)).toBe(true);
    // No trial PayPal plan: PayPal would charge today, so the "€0 today" summary names the card only.
    expect(growthPlanOffers([row("grow", "month", 9900, { paypalTrialPlanId: null })], "en", false, true)[0].paypal).toBe(false);
  });

  it("uses the pricing page's words in the reader's language", () => {
    const offers = growthPlanOffers(ROWS, "de", false, true);
    const words = pricingPageCopy("de").plans.grow;
    const grow = offers.find((offer) => offer.tier === "grow")!;
    expect(grow.name).toBe("Grow");
    expect(grow.tag).toBe(words.tag);
    expect(grow.description).toBe(words.desc);
    expect(grow.features.length).toBeGreaterThan(0);
    expect(grow.features.length).toBeLessThanOrEqual(5);
    expect(grow.features.join(" ")).not.toMatch(/\{\w+\}/);
  });

  it("leaves out a plan at no price (a Free row is drawn from its own card)", () => {
    expect(growthPlanOffers([row("free", "month", 0), ...ROWS], "en", false, true).map((offer) => offer.tier)).not.toContain("free");
  });
});

describe("defaultTier", () => {
  it("chooses the popular plan, else the first, else none", () => {
    const offers = growthPlanOffers(ROWS, "en", false, true);
    expect(defaultTier(offers)).toBe("grow");
    expect(defaultTier(offers.filter((offer) => offer.tier !== "grow"))).toBe("launch");
    expect(defaultTier([])).toBeNull();
  });
});
