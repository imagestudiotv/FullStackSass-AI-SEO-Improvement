import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { PlanRow } from "@/lib/billing-shared";
import { LOCALES, localePath, type Locale } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";

/**
 * The homepage as each language first renders it: the section order the
 * client's reference design asks for, one h1, nothing from YouTube until play
 * is pressed, and the honest states (no testimonials while there are none, no
 * prices that are not real).
 */

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode; [key: string]: unknown }) =>
    createElement("a", { href, ...rest }, children),
}));
vi.mock("next/image", () => ({
  default: ({ src, alt, ...rest }: { src: string; alt: string; [key: string]: unknown }) =>
    createElement("img", { src, alt, width: rest.width, height: rest.height }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { HomePageSections } from "./home-page";
import { PricingPreview } from "./pricing-preview";
import { Testimonials } from "./testimonials-section";

/** Static markup escapes quotes and apostrophes; compare against the escaped form. */
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;").replace(/</g, "&lt;");

function plan(over: Partial<PlanRow>): PlanRow {
  return {
    id: over.tier ?? "p",
    name: "Grow",
    tier: "grow",
    interval: "month",
    currency: "eur",
    priceCents: 9900,
    articleLimit: 30,
    keywordLimit: 300,
    siteLimit: 3,
    monthlyCredits: 25,
    sortOrder: 0,
    isActive: true,
    stripePriceId: null,
    paypalPlanId: null,
    ...over,
  } as PlanRow;
}

const PLANS = [plan({ tier: "grow", name: "Grow" }), plan({ tier: "scale", name: "Scale", priceCents: 29900, articleLimit: 100 })];

function renderHome(locale: Locale, plans: PlanRow[] = PLANS) {
  const href = (path: string) => (locale === "en" ? path : localePath(locale, path));
  return renderToStaticMarkup(createElement(HomePageSections, { locale, href, plans }));
}

/** Where each marker first appears, so the order can be compared. */
function positions(html: string, markers: string[]) {
  return markers.map((marker) => {
    const at = html.indexOf(marker);
    if (at < 0) throw new Error(`missing: ${marker}`);
    return at;
  });
}

describe("homepage sections", () => {
  it.each(LOCALES)("%s: follows the reference order", (locale) => {
    const t = getMessages(locale).home;
    const html = renderHome(locale);
    const order = positions(html, [
      esc(t.titleLead),
      'id="how-it-works-video"',
      esc(t.auditIntroTitle),
      'id="how-it-works"',
      'id="traffic-recovery"',
      esc(t.stackTitle),
      esc(t.pillars[0].title),
      'id="content-engine"',
      'id="tracking"',
      'id="authority-network"',
      esc(t.previewTitle),
      'id="pricing"',
      'id="faq"',
      // The heading is split by its orange words; the line under it is one piece.
      esc(t.closingSub),
    ]);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it.each(LOCALES)("%s: has exactly one h1", (locale) => {
    expect(renderHome(locale).match(/<h1[\s>]/g)).toHaveLength(1);
  });

  it("gives every language the same sections", () => {
    const ids = (html: string) => [...html.matchAll(/<section[^>]*id="([^"]+)"/g)].map((m) => m[1]);
    const english = ids(renderHome("en"));
    expect(english).toEqual(["how-it-works-video", "how-it-works", "traffic-recovery", "content-engine", "tracking", "authority-network", "pricing", "faq"]);
    for (const locale of LOCALES) expect(ids(renderHome(locale))).toEqual(english);
  });

  it("loads nothing from YouTube until play is pressed, and links to the video", () => {
    const html = renderHome("en");
    const t = getMessages("en").home;
    expect(html).not.toContain("<iframe");
    expect(html).not.toContain("youtube-nocookie");
    expect(html).toContain(`aria-label="${esc(t.videoPlay)}"`);
    expect(html).toContain('href="https://www.youtube.com/watch?v=PqNu8DzBlTQ"');
    // The poster is a lazy, decorative image; the button carries the name.
    const poster = html.match(/<img[^>]*i\.ytimg\.com\/vi_webp\/PqNu8DzBlTQ[^>]*>/)?.[0] ?? "";
    expect(poster).toContain('loading="lazy"');
    expect(poster).toContain('alt=""');
    expect(html).not.toContain(esc("video is being recorded"));
  });

  it.each(LOCALES)("%s: shows the three reassurances under the hero buttons", (locale) => {
    const html = renderHome(locale);
    for (const item of getMessages(locale).home.heroAssurances) expect(html).toContain(esc(item));
  });

  it("labels every drawing with figures as an example", () => {
    const t = getMessages("en").home;
    const html = renderHome("en");
    // Audit and Grow steps, four analytics cards, the placement card.
    expect(html.split(`>${t.exampleLabel}<`).length - 1).toBeGreaterThanOrEqual(7);
    expect(html).toContain(esc(t.trackedCaption));
    expect(html).toContain(esc(t.previewCaption));
    expect(html).toContain(esc(t.articles.sampleLabel));
  });

  it("names only real integrations, each linking to its setup guide", () => {
    const html = renderHome("de");
    for (const slug of ["wordpress", "ghost", "shopify", "webflow", "wix", "webhook"]) {
      // In German where the guide is translated, otherwise the English guide.
      expect(html).toContain(`href="${localePath("de", `/docs/integrations/${slug}`)}"`);
    }
    expect(html.match(/href="[^"]*\/docs\/integrations\//g)).toHaveLength(6);
  });

  it("keeps the audit field's label, its required check and the locale-aware action", () => {
    const t = getMessages("es").home;
    const html = renderHome("es");
    expect(html).toContain(`>${esc(t.auditFieldLabel)}</label>`);
    expect(html).toMatch(/<input[^>]*id="audit-quick"[^>]*required/);
    // The button starts solid: not disabled before anything is typed.
    expect(html).not.toMatch(/<button[^>]*type="submit"[^>]*disabled/);
  });

  it("publishes no FAQ markup of its own - /faq carries it", () => {
    const html = renderHome("en");
    expect(html).toContain(esc(getMessages("en").faq.items[0].question));
    expect(html).not.toContain("FAQPage");
    expect(html).toMatch(/<h2[^>]*>Frequently asked questions<\/h2>/);
  });

  it("keeps the FAQ's contact link in the reader's language", () => {
    expect(renderHome("de")).toContain('href="/de/contact"');
    expect(renderHome("en")).toContain('href="/contact"');
  });

  it("leaves out the testimonials while there are none approved", () => {
    expect(renderHome("en")).not.toContain(esc(getMessages("en").home.testimonialsTitle));
  });
});

/** The closing panel on the homepage, the blog and every article (client's design, 7RRq4-suyqqc.jpg). */
describe("closing panel", () => {
  it("says exactly what the client's design says, in English", () => {
    const t = getMessages("en").home;
    expect([t.closingTitle, t.closingTitleAccent, t.closingSub, t.checkFree, t.createFreeArticles, t.cancelAnytime, t.setupInMinutes]).toEqual([
      "Your website could be growing faster.",
      "growing faster.",
      "Discover what’s holding your website back with a free SEO audit. No account required.",
      "Check my website for free",
      "Create 3 Articles for Free",
      "Cancel any time",
      "Set up in minutes",
    ]);
  });

  it.each(LOCALES)("%s: the heading's last words in orange, the free check, free articles at sign-up, two reassurances", (locale) => {
    const t = getMessages(locale).home;
    expect(t.closingTitle.endsWith(t.closingTitleAccent)).toBe(true);
    const html = renderHome(locale);
    const panel = html.slice(html.lastIndexOf("<h2", html.indexOf(esc(t.closingSub))));
    expect(panel).toContain(`<span style="color:#ff5a1f">${esc(t.closingTitleAccent)}</span>`);
    expect(panel).toMatch(new RegExp(`href="/sign-up"[^>]*>${esc(t.createFreeArticles)}`));
    expect(panel).toContain(esc(t.checkFree));
    expect(panel).toContain(esc(t.cancelAnytime));
    expect(panel).toContain(esc(t.setupInMinutes));
  });
});

describe("pricing preview", () => {
  const t = getMessages("en").home;
  const render = (plans: PlanRow[]) =>
    renderToStaticMarkup(createElement(PricingPreview, { t, href: (p: string) => p, plans }));

  it("balances the grid for however many monthly plans there are", () => {
    const starter = plan({ tier: "launch", name: "Launch", priceCents: 4900 });
    const extra = plan({ tier: "agency", name: "Agency", priceCents: 59900 });
    expect(render([PLANS[0]])).toContain("max-w-md grid-cols-1");
    expect(render(PLANS)).toContain("sm:grid-cols-2");
    expect(render([starter, ...PLANS])).toContain("md:grid-cols-3");
    expect(render([starter, ...PLANS, extra])).toContain("lg:grid-cols-4");
  });

  it("uses the real prices and marks Grow as most popular", () => {
    const html = render(PLANS);
    expect(html).toContain("€99");
    expect(html).toContain("€299");
    expect(html.split(t.mostPopular).length - 1).toBe(1);
    expect(html).toContain('href="/sign-up"');
    expect(html).toContain('href="/pricing"');
  });

  it("ignores yearly plans and says so when no monthly plan exists", () => {
    const html = render([plan({ interval: "year" })]);
    expect(html).toContain(t.unavailable);
    expect(html).not.toContain("€99");
  });
});

describe("testimonials", () => {
  const t = getMessages("en").home;

  it("renders nothing at all without approved quotes or a review score", () => {
    expect(renderToStaticMarkup(createElement(Testimonials, { t, testimonials: [], reviewScore: null }))).toBe("");
  });

  it("shows quotes with initials and the verified mark only where set", () => {
    // Test fixtures only - never shipped (lib/marketing/testimonials.ts holds the real list).
    const html = renderToStaticMarkup(
      createElement(Testimonials, {
        t,
        testimonials: [
          { quote: "Fixture quote one.", name: "Ada Lovelace", role: "Fixture role", verified: true },
          { quote: "Fixture quote two.", name: "Grace", role: "Fixture role" },
        ],
        reviewScore: { platform: "Example", score: 4.5, outOf: 5, count: 12, url: "https://example.com/reviews" },
      }),
    );
    expect(html).toContain("Fixture quote one.");
    expect(html).toContain(">AL<");
    expect(html).toContain(">G<");
    expect(html.split(t.testimonialsVerified).length - 1).toBe(1);
    expect(html).toContain("4.5/5 on Example, from 12 reviews");
    expect(html).toContain('href="https://example.com/reviews"');
  });
});
