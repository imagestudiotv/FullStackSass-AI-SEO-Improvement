import { afterEach, describe, expect, it } from "vitest";

import { cardPrices } from "@/app/(marketing)/pricing/prices";
import { planCardsFor } from "@/app/(app)/billing/plan-cards";
import { formatMoney } from "@/app/(app)/billing/billing-view";
import type { PlanRow } from "@/lib/billing-shared";
import { automaticRepgetCoupon } from "@/lib/billing/checkouts";
import { bundleCouponFor, repgetFirstPaymentCents } from "@/lib/billing/repget-offer";
import { getMessages } from "@/lib/i18n/messages";
import { GROW_VISIBILITY_COMPARE_AT_CENTS } from "@/lib/plans/features";

import { BUNDLE_STRIPE_COUPONS, catalogRows, REPGET_STRIPE_COUPONS, stripeAmountFor } from "../../../scripts/plan-catalog.mjs";
import { perMonthOfYear, planDisplayPrice } from "./display-prices";

/**
 * The price a plan screen shows is the price checkout charges (Daniel,
 * 2026-11-13: the original price struck through beside the discounted one,
 * as /pricing does). For every row of the catalogue on sale, with the REPGET
 * offer on and off, what /pricing, Billing and the onboarding step show is
 * worked out here the way checkout works it out: the row's Stripe price
 * amount, less the coupon checkout attaches by itself.
 */

afterEach(() => {
  delete process.env.REPGET_OFFER_ENABLED;
});

type Row = { tier: string; interval: string; priceCents: number };

/** What one Stripe checkout for this row charges per payment: the price's amount less the coupon checkout attaches. */
function checkoutCharge(row: Row, offerOn: boolean): number {
  if (offerOn) process.env.REPGET_OFFER_ENABLED = "1";
  else delete process.env.REPGET_OFFER_ENABLED;
  const plan = { tier: row.tier, interval: row.interval, currency: "eur", priceCents: row.priceCents };
  const amount = stripeAmountFor({ tier: row.tier, interval: row.interval, price_cents: row.priceCents }) as number;
  const repget = automaticRepgetCoupon(plan);
  const repgetOff = repget ? REPGET_STRIPE_COUPONS.find((coupon) => coupon.id === repget)!.amountOffCents : 0;
  const bundle = bundleCouponFor(plan, amount);
  const bundleId = "coupon" in bundle ? bundle.coupon : null;
  const bundleOff = bundleId ? BUNDLE_STRIPE_COUPONS.find((coupon) => coupon.id === bundleId)!.amountOffCents : 0;
  // REPGET and the bundle coupon never meet: one covers Launch/Grow/Scale, the other only the bundle.
  expect(repgetOff > 0 && bundleOff > 0).toBe(false);
  return amount - repgetOff - bundleOff;
}

const rows = catalogRows() as Row[];
const t = getMessages("en").app.billing;
const asPlanRow = (row: Row, index: number) =>
  ({
    id: `plan_${row.tier}_${row.interval}`,
    tier: row.tier,
    interval: row.interval,
    name: row.tier,
    currency: "eur",
    priceCents: row.priceCents,
    articleLimit: 30,
    socialPostLimit: 60,
    keywordLimit: 300,
    siteLimit: 1,
    monthlyCredits: 250,
    sortOrder: index,
    paypalTrialPlanId: null,
  }) as unknown as PlanRow;

describe("the price on every plan screen is the price checkout charges", () => {
  for (const offerOn of [true, false]) {
    for (const row of rows) {
      it(`${row.tier} ${row.interval}, REPGET ${offerOn ? "on" : "off"}`, () => {
        const charged = checkoutCharge(row, offerOn);
        const plan = { tier: row.tier, interval: row.interval, currency: "eur", priceCents: row.priceCents };
        const shown = planDisplayPrice(plan, offerOn);

        expect(shown.chargedCents).toBe(charged);
        // Struck through only when something really is taken off, and then the regular price.
        if (charged === row.priceCents && row.tier !== "grow_visibility") expect(shown.strikeCents).toBeNull();
        else expect(shown.strikeCents).toBe(row.tier === "grow_visibility" ? GROW_VISIBILITY_COMPARE_AT_CENTS : row.priceCents);
        // PayPal's REPGET plans are priced at the launch price, and the bundle's at its row's price: the same figure.
        if (offerOn && repgetFirstPaymentCents(plan) !== null) expect(repgetFirstPaymentCents(plan)).toBe(charged);

        // Billing's card: the same figure, per month for a yearly plan, as /pricing quotes it.
        const card = planCardsFor([asPlanRow(row, 0)], { offerOn, trialEligible: false, locale: "en", t })[`plan_${row.tier}_${row.interval}`];
        expect(card.price).toBe(formatMoney(row.interval === "year" ? perMonthOfYear(charged) : charged, "eur", "en"));
        expect(card.strike === null).toBe(shown.strikeCents === null);
      });
    }
  }

  it("/pricing's cards agree, monthly and yearly", () => {
    for (const offerOn of [true, false]) {
      for (const tier of ["launch", "grow", "scale"]) {
        const month = rows.find((row) => row.tier === tier && row.interval === "month")!;
        const year = rows.find((row) => row.tier === tier && row.interval === "year")!;
        const prices = cardPrices({ ...month, currency: "eur" }, { ...year, currency: "eur" }, offerOn);
        const money = (cents: number) => `€${(cents / 100).toLocaleString("en-IE", { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
        expect(prices.monthly.price).toBe(money(checkoutCharge(month, offerOn)));
        expect(prices.yearly?.total).toBe(money(checkoutCharge(year, offerOn)));
      }
    }
  });

  it("the bundle is EUR 99 against EUR 299 whether REPGET is on or not, and never takes the launch price", () => {
    const bundle = { tier: "grow_visibility", interval: "month", currency: "eur", priceCents: 9900 };
    expect(planDisplayPrice(bundle, true)).toEqual({ chargedCents: 9900, strikeCents: 29900, discount: "bundle" });
    expect(planDisplayPrice(bundle, false)).toEqual({ chargedCents: 9900, strikeCents: 29900, discount: "bundle" });
  });

  it("a price no coupon was made for is shown as it is, offer or not", () => {
    expect(planDisplayPrice({ tier: "grow", interval: "month", currency: "eur", priceCents: 9900 }, true)).toEqual({
      chargedCents: 9900,
      strikeCents: null,
      discount: null,
    });
  });
});

describe("the plan cards' terms", () => {
  const launch = rows.find((row) => row.tier === "launch" && row.interval === "month")!;
  const bundle = rows.find((row) => row.tier === "grow_visibility")!;

  it("the free articles only for a workspace that has never subscribed, then the price charged on every payment", () => {
    const [plan] = [asPlanRow(launch, 0)];
    const card = planCardsFor([plan], { offerOn: true, trialEligible: true, locale: "en", t })[plan.id];
    expect(card.terms).toEqual([
      "Your first 3 articles are free: nothing is charged until they are written (30 days at most).",
      "Then €59 a month, renewing until you cancel.",
    ]);
    expect(card.strike).toBe("€99");
    expect(card.badge).toBe("40% OFF");
    // PayPal without its free-articles plan starts at once, and says so.
    expect(card.paypalNote).toBe("PayPal starts this plan straight away, without the free articles.");
    const later = planCardsFor([plan], { offerOn: false, trialEligible: false, locale: "en", t })[plan.id];
    expect(later.terms).toEqual(["€99 charged today, then every month until you cancel."]);
    expect(later.strike).toBeNull();
  });

  it("Grow + Visibility: a direct purchase, never a free trial", () => {
    const plan = asPlanRow(bundle, 0);
    const card = planCardsFor([plan], { offerOn: true, trialEligible: true, locale: "en", t })[plan.id];
    expect(card.terms).toEqual(["€99 billed at checkout, then monthly. The 3-day free trial does not apply to this offer."]);
    expect(card.directBadge).toBe("Direct purchase");
    expect(card.strike).toBe("€299");
    expect(card.paypalNote).toBeNull();
    expect(card.perks.map((perk) => perk.strong)).toEqual(["40K+ social followers", "DR 60 blog feature", "Email spotlight"]);
  });

  it("lists social posts, videos, AI Growth Copilot and AI Social Opportunities, in every language", () => {
    for (const locale of ["en", "es", "fr", "it", "de"] as const) {
      for (const row of [launch, bundle]) {
        const plan = asPlanRow(row, 0);
        const card = planCardsFor([plan], { offerOn: false, trialEligible: false, locale, t: getMessages(locale).app.billing })[plan.id];
        const text = card.features.join("\n");
        expect(text).toMatch(/Growth Copilot/);
        expect(text).toMatch(/Social Opportunities/);
        expect(text).toMatch(/60/); // the plan's social posts
        expect(text).toMatch(/20/); // the daily video ideas
        expect(text).toMatch(/250/); // the plan's credits each month
      }
    }
  });
});
