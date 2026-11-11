import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { PlanRow } from "@/lib/billing-shared";
import { LOCALES } from "@/lib/i18n/config";
import { pricingPageCopy } from "@/lib/i18n/pricing-page";
import type { Testimonial } from "@/lib/marketing/testimonials";
import { catalogRows } from "../../../../scripts/plan-catalog.mjs";

/**
 * The pricing page (client's design of 2026-11-11) as each language renders
 * it, from the catalogue's own rows: the offer prices the design shows, the
 * links it names, the bundle only while it is on sale, and every figure from
 * the plan rows.
 */

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode; [key: string]: unknown }) =>
    createElement("a", { href, ...rest, prefetch: undefined }, children),
}));
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => createElement("img", { src, alt }),
}));

import { bundleSavingPercent, cardPrices } from "./prices";
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
  const month = (cents: number) => ({ priceCents: cents, currency: "eur" });

  it("monthly: 40% off rounded down to the euro, against the regular price", () => {
    expect([9900, 14900, 34900].map((cents) => cardPrices(month(cents), null, true).monthly)).toEqual([
      { regular: "€99", price: "€59" },
      { regular: "€149", price: "€89" },
      { regular: "€349", price: "€209" },
    ]);
  });

  it("yearly: per month as the design quotes it, and the first year's total", () => {
    expect(cardPrices(month(9900), month(99000), true).yearly).toEqual({ regular: "€82.50", price: "€49.17", total: "€590", regularTotal: "€990" });
    expect(cardPrices(month(14900), month(149000), true).yearly).toEqual({ regular: "€124.17", price: "€74.17", total: "€890", regularTotal: "€1,490" });
    expect(cardPrices(month(34900), month(349000), true).yearly).toEqual({ regular: "€290.83", price: "€174.17", total: "€2,090", regularTotal: "€3,490" });
  });

  it("without the offer, the regular prices only", () => {
    expect(cardPrices(month(9900), month(99000), false)).toEqual({
      monthly: { regular: "€99", price: "€99" },
      yearly: { regular: "€82.50", price: "€82.50", total: "€990", regularTotal: "€990" },
    });
  });

  it("the bundle saves 67% against EUR 299", () => {
    expect(bundleSavingPercent(9900, 29900)).toBe(67);
    expect(bundleSavingPercent(9900, 9900)).toBe(0);
  });
});

describe("the pricing page", () => {
  it("shows the design's monthly and yearly figures, from the plan rows", () => {
    const html = render();
    for (const text of ["€59", "€89", "€209", "€99", "€149", "€349", "€49.17", "€74.17", "€174.17", "€82.50", "€124.17", "€290.83"]) {
      expect(html).toContain(`>${text}<`);
    }
    expect(html).toContain("Billed €590/year · was €990/year");
    expect(html).toContain("Billed €890/year · was €1,490/year");
    expect(html).toContain("Billed €2,090/year · was €3,490/year");
    expect(html.match(/40% off regular price · billed monthly/g)).toHaveLength(3);
    expect(html.match(/>40% OFF</g)).toHaveLength(3);
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

  it("the Grow + Visibility bundle: its price against EUR 299, a direct purchase straight to its own checkout", () => {
    const html = render();
    expect(html).toContain("SAVE 67% ON THE FULL BUNDLE");
    expect(html).toContain("<del>€299</del><strong>€99</strong>");
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
    expect(html).not.toContain("SAVE 67%");
    expect(html).not.toContain("grow_visibility");
    expect(html).not.toContain("Grow + Visibility");
    expect(html).toContain("23 answers to explore");
  });

  it("without the REPGET offer, no discount is claimed", () => {
    const html = render({ offer: false });
    expect(html).not.toContain("40% OFF");
    expect(html).not.toContain("plus 40% off");
    expect(html).toContain("Billed €990/year");
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
