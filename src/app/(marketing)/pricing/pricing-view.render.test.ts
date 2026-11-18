import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { PlanRow } from "@/lib/billing-shared";
import { LOCALES } from "@/lib/i18n/config";
import { pricingPageCopy } from "@/lib/i18n/pricing-page";
import type { Testimonial } from "@/lib/marketing/testimonials";
import { referencePriceMatches } from "@/test/reference-price";
import { catalogRows } from "../../../../scripts/plan-catalog.mjs";

/**
 * The pricing page (client's design of 2026-11-11) as each language renders
 * it, from the catalogue's own rows: the prices checkout charges and no
 * other, the links it names, the bundle only while it is on sale, and every
 * figure from the plan rows.
 */

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode; [key: string]: unknown }) =>
    createElement("a", { href, ...rest, prefetch: undefined }, children),
}));
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => createElement("img", { src, alt }),
}));

import { cardPrices } from "./prices";
import { PricingView } from "./pricing-view";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;").replace(/</g, "&lt;");

/** The catalogue's rows (scripts/plan-catalog.mjs), as listPlans returns them on sale. */
const PLANS = catalogRows().map(
  (row, index) =>
    ({
      id: `${row.tier}_${row.interval}`,
      name: row.name,
      tier: row.tier,
      interval: row.interval,
      currency: "eur",
      priceCents: row.priceCents,
      articleLimit: row.articleLimit,
      socialPostLimit: row.socialPostLimit,
      keywordLimit: row.keywordLimit,
      siteLimit: row.siteLimit,
      monthlyCredits: row.monthlyCredits,
      sortOrder: index,
      isActive: true,
    }) as unknown as PlanRow,
);
const WITHOUT_BUNDLE = PLANS.filter((plan) => plan.tier !== "grow_visibility");

const render = (props: Partial<Parameters<typeof PricingView>[0]> = {}) =>
  renderToStaticMarkup(createElement(PricingView, { locale: "en", plans: PLANS, testimonials: [] as Testimonial[], offer: true, ...props }));

describe("the price display", () => {
  const TIER: Record<number, string> = { 9900: "launch", 14900: "grow", 34900: "scale" };
  const month = (cents: number) => ({ tier: TIER[cents] ?? "other", interval: "month", priceCents: cents, currency: "eur" });
  const year = (cents: number) => ({ tier: TIER[cents / 10] ?? "other", interval: "year", priceCents: cents, currency: "eur" });

  it("monthly: the launch price checkout charges, and nothing beside it", () => {
    expect([9900, 14900, 34900].map((cents) => cardPrices(month(cents), null, true).monthly)).toEqual([
      { price: "€59" },
      { price: "€89" },
      { price: "€209" },
    ]);
  });

  it("yearly: per month as the design quotes it, and the first year's total", () => {
    expect(cardPrices(month(9900), year(99000), true).yearly).toEqual({ price: "€49.17", total: "€590" });
    expect(cardPrices(month(14900), year(149000), true).yearly).toEqual({ price: "€74.17", total: "€890" });
    expect(cardPrices(month(34900), year(349000), true).yearly).toEqual({ price: "€174.17", total: "€2,090" });
  });

  it("only the discounts checkout applies: a price no coupon covers is shown as it is", () => {
    expect(cardPrices(month(12300), year(123000), true)).toEqual({
      monthly: { price: "€123" },
      yearly: { price: "€102.50", total: "€1,230" },
    });
  });

  it("without the offer, the plan's own prices", () => {
    expect(cardPrices(month(9900), year(99000), false)).toEqual({
      monthly: { price: "€99" },
      yearly: { price: "€82.50", total: "€990" },
    });
  });

});

describe("the pricing page", () => {
  it("shows the charged monthly and yearly figures, from the plan rows, and no regular price", () => {
    const html = render();
    for (const text of ["€59", "€89", "€209", "€99", "€49.17", "€74.17", "€174.17"]) {
      expect(html).toContain(`>${text}<`);
    }
    // €99 is the bundle's price; the plans' regular figures are not on the page.
    for (const text of ["€149", "€349", "€82.50", "€124.17", "€290.83", "€990", "€1,490", "€3,490"]) {
      expect(html).not.toContain(text);
    }
    expect(html).toContain("Billed €590/year");
    expect(html).toContain("Billed €890/year");
    expect(html).toContain("Billed €2,090/year");
    expect(html.match(/>Billed monthly</g)).toHaveLength(3);
    expect(html).toContain(">Yearly: 2 months free<");
    // The plan rows' allowances, not the design's numbers written in.
    expect(html).toContain("<strong>500 search terms</strong> researched");
    expect(html).toContain("<strong>240 social posts</strong> across platforms");
    expect(html).toContain(">1,500<");
  });

  it("links each plan through sign-up to its plan step, exactly as the design does, and the rest to the site's pages", () => {
    const html = render();
    for (const tier of ["launch", "grow", "scale"]) {
      expect(html).toContain(`href="/sign-up?next=%2Fonboarding%2Fwebsite%3Fplan%3D${tier}"`);
    }
    expect(html).toContain('href="/refunds"');
    expect(html).toContain('href="/contact"');
    expect(html).toContain('href="#compare"');
    expect(html).toContain('href="/sign-up"');
  });

  it("the Grow + Visibility bundle: its price alone, a direct purchase straight to its own checkout", () => {
    const html = render();
    expect(html).toContain("<strong>€99</strong>");
    expect(html).toContain('aria-label="Grow plus Visibility bundle price €99 per month"');
    expect(html).not.toContain("€299");
    expect(html).toContain('href="/sign-up?next=%2Fonboarding%2Fwebsite%3Fplan%3Dgrow_visibility"');
    expect(html).toContain("€99 billed at checkout, then monthly. The 3-day free trial does not apply to this offer.");
    expect(html).toContain("Your first €99 payment is collected at checkout");
    expect(html).toContain("25 answers to explore");
    // Not one of the standard cards.
    expect(html.match(/Explore full feature comparison/g)).toHaveLength(3);
    expect(html).not.toContain("<h2>Grow + Visibility</h2>");
  });

  it("leaves the bundle, and the questions about it, out while it is not on sale", () => {
    const html = render({ plans: WITHOUT_BUNDLE });
    expect(html).not.toContain("grow_visibility");
    expect(html).not.toContain("Grow + Visibility");
    expect(html).toContain("23 answers to explore");
  });

  it("without the REPGET offer, the plan's own prices, said the same way", () => {
    const html = render({ offer: false });
    for (const text of ["€99", "€149", "€349", "€82.50", "€124.17", "€290.83"]) expect(html).toContain(`>${text}<`);
    expect(html).toContain("Billed €990/year");
    expect(html).not.toContain("€59");
  });

  it("shows no customer stories while none is published, and no plans while none is on sale", () => {
    expect(render()).not.toContain("repget-reviews");
    const empty = render({ plans: [] });
    expect(empty).not.toContain('id="plans"');
    expect(empty).toContain("Start with proof.");
  });

  it("renders every language, in its own words, with the same figures", () => {
    for (const locale of LOCALES) {
      const t = pricingPageCopy(locale);
      const html = render({ locale });
      expect(html).toContain(esc(t.hero.titleAccent));
      expect(html).toContain(esc(t.compare.title));
      expect(html).toContain(esc(t.trial.titleLines[0]));
      expect(html).toContain(">€59<");
      expect(t.faq.groups.flatMap((group) => group.items)).toHaveLength(25);
      expect(html).not.toMatch(/\{(articles|posts|terms|price|regular|pct|n)\}/);
    }
  });
});

describe("the charged price only (conservative copy, 2026-11-18)", () => {
  for (const locale of LOCALES) {
    for (const offer of [true, false]) {
      it(`${locale}, REPGET ${offer ? "on" : "off"}: the price checkout charges, nothing struck, no percentage off`, () => {
        const html = render({ locale, offer });
        // Launch: EUR 59 with the launch price, its own EUR 99 without; the bundle is EUR 99 either way.
        expect(html).toContain(offer ? ">€59<" : ">€99<");
        expect(html).toContain("<strong>€99</strong>");
        if (!offer) expect(html).not.toContain("€59");
        expect(html).not.toContain("€299");
        expect(referencePriceMatches(html)).toEqual([]);
      });
    }
  }
});
