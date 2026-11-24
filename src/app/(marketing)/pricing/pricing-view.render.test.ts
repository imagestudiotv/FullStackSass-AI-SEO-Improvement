import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { PlanRow } from "@/lib/billing-shared";
import { LOCALES } from "@/lib/i18n/config";
import { pricingPageCopy } from "@/lib/i18n/pricing-page";
import type { Testimonial } from "@/lib/marketing/testimonials";
import { freePlanCounter, freePlanDisplay } from "@/lib/plans/free-plan";
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
  const TIER: Record<number, string> = { 9900: "launch", 14900: "grow", 34900: "scale" };
  const month = (cents: number) => ({ tier: TIER[cents] ?? "other", interval: "month", priceCents: cents, currency: "eur" });
  const year = (cents: number) => ({ tier: TIER[cents / 10] ?? "other", interval: "year", priceCents: cents, currency: "eur" });

  it("monthly: 40% off rounded down to the euro, against the regular price", () => {
    expect([9900, 14900, 34900].map((cents) => cardPrices(month(cents), null, true).monthly)).toEqual([
      { regular: "€99", price: "€59" },
      { regular: "€149", price: "€89" },
      { regular: "€349", price: "€209" },
    ]);
  });

  it("yearly: per month as the design quotes it, and the first year's total", () => {
    expect(cardPrices(month(9900), year(99000), true).yearly).toEqual({ regular: "€82.50", price: "€49.17", total: "€590", regularTotal: "€990" });
    expect(cardPrices(month(14900), year(149000), true).yearly).toEqual({ regular: "€124.17", price: "€74.17", total: "€890", regularTotal: "€1,490" });
    expect(cardPrices(month(34900), year(349000), true).yearly).toEqual({ regular: "€290.83", price: "€174.17", total: "€2,090", regularTotal: "€3,490" });
  });

  it("only the discounts checkout applies: a price no coupon covers is shown as it is", () => {
    expect(cardPrices(month(12300), year(123000), true)).toEqual({
      monthly: { regular: "€123", price: "€123" },
      yearly: { regular: "€102.50", price: "€102.50", total: "€1,230", regularTotal: "€1,230" },
    });
  });

  it("without the offer, the regular prices only", () => {
    expect(cardPrices(month(9900), year(99000), false)).toEqual({
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
    for (const text of ["€89", "€209", "€149", "€349", "€74.17", "€174.17", "€124.17", "€290.83"]) {
      expect(html).toContain(`>${text}<`);
    }
    expect(html).toContain("Billed €890/year · was €1,490/year");
    expect(html).toContain("Billed €2,090/year · was €3,490/year");
    // Launch is off sale (2026-11-19): its rows are still active, its card is gone.
    expect(html).not.toContain("Billed €590/year");
    expect(html).not.toContain("<h2>Launch</h2>");
    expect(html.match(/40% off regular price · billed monthly/g)).toHaveLength(2);
    expect(html.match(/>40% OFF</g)).toHaveLength(2);
    // The plan rows' allowances, not the design's numbers written in.
    expect(html).toContain("<strong>300 search terms</strong> researched");
    expect(html).toContain("<strong>180 social posts</strong> across platforms");
    expect(html).toContain(">1,200<");
  });

  it("links each plan through sign-up to its plan step, exactly as the design does, and the rest to the site's pages", () => {
    const html = render();
    for (const tier of ["free", "grow", "scale"]) {
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
    expect(html).toContain("26 answers to explore");
    // Its own allowances, from its row (client, 2026-11-21): 30 articles, one a day; 120 social posts; 400 search terms.
    const stats = [...html.matchAll(/growth-stat[^"]*"><strong>([^<]+)<\/strong><span>([^<]+)<small>([^<]+)<\/small>/g)].map((m) => [m[1], m[2].trim(), m[3]]);
    expect(stats).toEqual([
      ["30", "branded articles / mo", "1 a day"],
      ["120", "social posts / mo", "For your channels"],
      ["400", "search terms", "Researched &amp; clustered"],
    ]);
    // Not one of the standard cards (Grow and Scale; Free says "See full comparison").
    expect(html.match(/Explore full feature comparison/g)).toHaveLength(2);
    expect(html).not.toContain("<h2>Grow + Visibility</h2>");
  });

  it("leaves the bundle, and the questions about it, out while it is not on sale", () => {
    const html = render({ plans: WITHOUT_BUNDLE });
    expect(html).not.toContain("SAVE 67%");
    expect(html).not.toContain("grow_visibility");
    expect(html).not.toContain("Grow + Visibility");
    // The two bundle questions, and the answer that sends a Grow reader to it.
    expect(html).toContain("23 answers to explore");
  });

  it("without the REPGET offer, no discount is claimed", () => {
    const html = render({ offer: false });
    expect(html).not.toContain("40% OFF");
    expect(html).not.toContain("plus 40% off");
    expect(html).toContain("Billed €1,490/year");
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
      expect(html).toContain(">€89<");
      expect(html).toContain(esc(freePlanDisplay(locale).cta));
      expect(t.faq.groups.flatMap((group) => group.items)).toHaveLength(26);
      expect(html).not.toMatch(/\{(articles|posts|terms|price|regular|pct|n)\}/);
    }
  });
});

describe("the Free plan's card (Daniel, 2026-11-19)", () => {
  it("comes first, as the card draws it: €0, no card, its allowances, and the paid features greyed", () => {
    const html = render();
    const free = html.slice(html.indexOf("<h2>Free</h2>"), html.indexOf("</article>", html.indexOf("<h2>Free</h2>")));
    expect(html.indexOf("<h2>Free</h2>")).toBeLessThan(html.indexOf("<h2>Grow</h2>"));
    expect(free).toContain("FREE FOREVER · NO CREDIT CARD");
    expect(free).toContain(">€0<");
    expect(free).toContain("Always free · upgrade anytime");
    expect(free).toContain("Start Free · No card required");
    expect(free).toContain("<strong>4 AI SEO articles</strong> per month");
    expect(free).toContain("<strong>3 Growth Copilot requests</strong> per day");
    expect(free).toContain("<strong>Backlink placements</strong> available on Grow");
    expect(free).toContain('href="#compare"');
    // No counter unless the page could read it.
    expect(free).not.toContain("free spots");
  });

  it("shows the launch counter with its bar, and at the cap sends the button to the paid plans' free trial", () => {
    const open = render({ freeCounter: freePlanCounter(430, 500) });
    expect(open).toContain("430 / 500 free spots taken");
    expect(open).toContain('aria-valuenow="430"');
    expect(open).toContain("width:86%");
    const full = render({ freeCounter: freePlanCounter(500, 500) });
    expect(full).toContain("All 500 free spots are taken");
    expect(full).toContain("Start a 3-day free trial");
    expect(full).toContain('href="/sign-up?next=%2Fonboarding%2Fwebsite%3Fplan%3Dgrow"');
    expect(full).not.toContain("plan%3Dfree");
  });

  it("has its column in the comparison: no backlinks, its limited audit and snapshot", () => {
    const html = render();
    const table = html.slice(html.indexOf('id="compare"'));
    expect(table).toContain("<th>Free</th>");
    expect(table).toContain("1 limited / month");
    expect(table).toContain("1 snapshot");
    expect(table).toContain("3 / day");
    expect(table).not.toContain("<th>Launch</th>");
  });
});

describe("no unverified claims (2026-11-19)", () => {
  it("claims no follower count, domain rating, round-the-clock support or promotion terms", () => {
    for (const locale of LOCALES) {
      const html = render({ locale });
      expect(html, locale).not.toMatch(/40K|DR ?-?60|24\/7|24 ?h\/24|rund um die Uhr/);
      expect(html, locale).not.toMatch(/promotion terms|offer terms|campaign terms|condiciones de (promoción|la oferta|campaña)|conditions (de promotion|de l&#x27;offre|de campagne)|condizioni (di promozione|dell&#x27;offerta|di campagna)|Werbebedingungen|Angebotsbedingungen|Kampagnenbedingungen/);
      // The perks stay listed: Scale and the bundle are sold with them.
      expect(html, locale).toContain(esc(pricingPageCopy(locale).plans.scale.perks![0].strong));
      expect(html, locale).toContain(esc(pricingPageCopy(locale).bundle.bonuses[0].strong));
    }
  });
});

describe("the visibility perks (client, 2026-11-24): Grow + Visibility and Scale only", () => {
  it("are not on Grow's card, which has no empty block for them, and stay on Scale's", () => {
    for (const locale of LOCALES) {
      const t = pricingPageCopy(locale);
      const html = render({ locale });
      const card = (name: string) => html.slice(html.indexOf(`<h2>${name}</h2>`), html.indexOf("</article>", html.indexOf(`<h2>${name}</h2>`)));
      expect(t.plans.grow.perks, locale).toBeUndefined();
      expect(card("Grow"), locale).not.toContain("plan-visibility");
      expect(card("Grow"), locale).not.toContain(esc(t.card.perksTitle));
      // It ends with the link to the comparison, as every card does, and keeps the backlinks.
      expect(card("Grow"), locale).toContain("plan-more");
      expect(card("Grow"), locale).toMatch(/backlink/i);
      for (const perk of t.plans.scale.perks!) expect(card("Scale"), locale).toContain(esc(perk.strong));
      expect(card("Scale"), locale).toContain(t.card.priority);
      expect(t.bundle.bonuses, locale).toHaveLength(3);
    }
  });

  it("are a dash for Grow and Priority for Scale in the comparison, where Grow keeps the backlink network", () => {
    for (const locale of LOCALES) {
      const t = pricingPageCopy(locale);
      const html = render({ locale });
      const table = html.slice(html.indexOf('id="compare"'));
      const cells = (label: string) => {
        const at = table.indexOf(esc(label));
        expect(at, `${locale} ${label}`).toBeGreaterThan(0);
        const row = table.slice(at, table.indexOf("</tr>", at));
        return [...row.matchAll(/<td[^>]*>(.*?)<\/td>/g)].map((m) => m[1].replace(/<[^>]+>/g, "")).slice(-3);
      };
      for (const label of [t.compare.blog.strong, t.compare.channels.strong, t.compare.email.strong]) {
        expect(cells(label), `${locale} ${label}`).toEqual(["\u2014", "\u2014", esc(t.compare.statusPriority)]);
      }
      expect(cells(t.compare.backlinks), locale).toEqual(["\u2014", "✓", "✓"]);
    }
  });

  it("the FAQ says so in every language: never that Grow has them, always where they are", () => {
    for (const locale of LOCALES) {
      const items = pricingPageCopy(locale).faq.groups.at(-1)!.items;
      const [which, priority, bundle] = items;
      expect(which.a, locale).toContain("Grow + Visibility");
      expect(which.a, locale).toMatch(/Grow (does not include|no las incluye|ne les comprend pas|non include|enthält diese Vorteile nicht)/);
      expect(priority.a, locale).not.toContain("Grow");
      expect(bundle.q, locale).toContain("Grow + Visibility");
      expect(bundle.a, locale).toMatch(/Grow (on its own does not|por sí solo no|seule ne|da solo non|allein enthält)/);
      for (const item of items) expect(item.a, locale).not.toMatch(/[\u2013\u2014]/);
    }
  });
});
