import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { PlanRow } from "@/lib/billing-shared";
import { LOCALES, localePath, type Locale } from "@/lib/i18n/config";
import { homeRedesignCopy } from "@/lib/i18n/home-redesign";
import { getMessages } from "@/lib/i18n/messages";
import type { Testimonial } from "@/lib/marketing/testimonials";

/**
 * The redesigned homepage (client's design, 2026-11-03) as each language
 * first renders it: the design's section order, one h1, nothing from YouTube
 * on the first paint, and the honest states - no reviews while none is
 * published, no counter without a real count, no invented figures.
 */

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode; [key: string]: unknown }) =>
    createElement("a", { href, ...rest }, children),
}));
vi.mock("next/image", () => ({
  default: ({ src, alt, ...rest }: { src: string; alt: string; [key: string]: unknown }) =>
    createElement("img", { src, alt, width: rest.width, height: rest.height }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/" }));

import { ClosingCta } from "./home-sections";
import { HomePageSections } from "./home-page";
import { PricingPreview } from "./pricing-preview";
import { Testimonials } from "./testimonials-section";

/** Static markup escapes quotes and apostrophes; compare against the escaped form. */
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;").replace(/</g, "&lt;");
/** The copy's `*accent*` / `**bold**` marks removed: what a reader sees. */
const plain = (s: string) => s.replace(/\*\*([^*]+)\*\*|\*([^*]+)\*/g, (_m, b?: string, a?: string) => b ?? a ?? "");

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
// A fixture, never shipped: the homepage passes the cards published in Admin -> Testimonials.
const REVIEW: Testimonial = { name: "Fixture Studio", role: "Fixture role", quote: "Fixture quote.", avatar: null };

function renderHome(
  locale: Locale,
  { plans = PLANS, testimonials = [], contentCount = null }: { plans?: PlanRow[]; testimonials?: Testimonial[]; contentCount?: number | null } = {},
) {
  const href = (path: string) => (locale === "en" ? path : localePath(locale, path));
  return renderToStaticMarkup(createElement(HomePageSections, { locale, href, plans, testimonials, contentCount }));
}

/** Where each marker first appears, so the order can be compared. */
function positions(html: string, markers: string[]) {
  return markers.map((marker) => {
    const at = html.indexOf(marker);
    if (at < 0) throw new Error(`missing: ${marker}`);
    return at;
  });
}

const sectionIds = (html: string) => [...html.matchAll(/<section[^>]*?id="([^"]+)"/g)].map((m) => m[1]);

describe("homepage sections", () => {
  it.each(LOCALES)("%s: follows the design's order", (locale) => {
    const c = homeRedesignCopy(locale);
    const html = renderHome(locale, { testimonials: [REVIEW], contentCount: 1234 });
    const order = positions(html, [
      "<h1",
      esc(c.ribbon.counterLabel),
      'id="features"',
      'id="growth-engines"',
      'id="repget-demo-video"',
      'id="how-it-works"',
      'id="repget-copilot"',
      'id="repget-founder"',
      'id="repget-reviews"',
      'id="pricing"',
      'id="faq"',
      esc(plain(c.cta.overline)),
    ]);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it.each(LOCALES)("%s: has exactly one h1", (locale) => {
    expect(renderHome(locale).match(/<h1[\s>]/g)).toHaveLength(1);
  });

  it("gives every language the same sections", () => {
    const english = sectionIds(renderHome("en"));
    expect(english).toEqual(["features", "growth-engines", "repget-demo-video", "how-it-works", "repget-copilot", "repget-founder", "pricing", "faq"]);
    for (const locale of LOCALES) expect(sectionIds(renderHome(locale))).toEqual(english);
  });

  it("keeps the anchors the header and the hero link to", () => {
    const html = renderHome("en", { testimonials: [REVIEW] });
    // Header "How it works" (/#how-it-works), the hero's watch link and reviews pill, the Social tool (/#features).
    for (const id of ["how-it-works", "repget-demo-video", "repget-reviews", "features"]) expect(html).toContain(`id="${id}"`);
    expect(html).toContain('href="#repget-demo-video"');
    expect(html).toContain('href="#repget-reviews"');
  });

  it("loads nothing from YouTube on the first paint, and still links to the video", () => {
    const html = renderHome("en");
    expect(html).not.toContain("<iframe");
    expect(html).not.toContain("youtube-nocookie");
    expect(html).toContain("PqNu8DzBlTQ");
  });

  it.each(LOCALES)("%s: shows the reassurances under the hero", (locale) => {
    const html = renderHome(locale);
    for (const item of getMessages(locale).home.heroAssurances) expect(html).toContain(esc(item));
  });

  it("shows the content counter only with a real count", () => {
    const c = homeRedesignCopy("en");
    expect(renderHome("en", { contentCount: null })).not.toContain(esc(c.ribbon.counterLabel));
    const html = renderHome("en", { contentCount: 1234 });
    expect(html).toContain(esc(c.ribbon.counterLabel));
    // The true figure is in the first paint; the count-up is motion on top.
    expect(html).toContain("1,234");
  });

  it("invents no figures from the design", () => {
    // The visible words only: icon drawings are full of coordinates like 4.9.
    const text = renderHome("en", { testimonials: [REVIEW], contentCount: 1234 }).replace(/<[^>]*>/g, " ");
    for (const made of ["4.9", "12,840", "+200%", "90+"]) expect(text).not.toContain(made);
  });

  it.each(LOCALES)("%s: names no platform RepGet does not connect to in its copy", (locale) => {
    const c = homeRedesignCopy(locale);
    expect(JSON.stringify({ ...c, founder: undefined })).not.toMatch(/linkedin|business profile/i);
  });

  it("leaves out the reviews and the reviewer pill while none is published", () => {
    const html = renderHome("en");
    expect(html).not.toContain('id="repget-reviews"');
    expect(html).not.toContain('href="#repget-reviews"');
    const withReview = renderHome("it", { testimonials: [REVIEW] });
    expect(withReview).toContain('id="repget-reviews"');
    expect(withReview).toContain("Fixture quote.");
  });

  it("marks testimonial quotes as English on a translated homepage", () => {
    expect(renderHome("it", { testimonials: [REVIEW] })).toMatch(/lang="en"[^>]*>(?:<[^>]+>)*Fixture quote\./);
  });

  it("uses the real plan prices, and says so when there is no monthly plan", () => {
    const html = renderHome("en");
    expect(html).toContain("€99");
    expect(html).toContain("€299");
    expect(renderHome("en", { plans: [plan({ interval: "year" })] })).toContain(esc(getMessages("en").home.unavailable));
  });

  it("publishes no FAQ markup of its own - /faq carries it", () => {
    const html = renderHome("en");
    expect(html).toContain(esc(getMessages("en").faq.items[0].question));
    expect(html).not.toContain("FAQPage");
  });

  it("keeps the contact link in the reader's language", () => {
    expect(renderHome("de")).toContain('href="/de/contact"');
    expect(renderHome("en")).toContain('href="/contact"');
  });
});

/** The closing panel on the blog and every article (client's design, 7RRq4-suyqqc.jpg). */
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
    const html = renderToStaticMarkup(createElement(ClosingCta, { t, href: (path: string) => (locale === "en" ? path : localePath(locale, path)) }));
    const panel = html.slice(html.lastIndexOf("<h2", html.indexOf(esc(t.closingSub))));
    expect(panel).toContain(`<span style="color:#ff5a1f">${esc(t.closingTitleAccent)}</span>`);
    expect(panel).toMatch(new RegExp(`href="(?:/[a-z]{2})?/sign-up"[^>]*>${esc(t.createFreeArticles)}`));
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
    expect(renderToStaticMarkup(createElement(Testimonials, { t, href: (path: string) => path, testimonials: [], reviewScore: null }))).toBe("");
  });

  it("shows quotes with initials and the verified mark only where set", () => {
    // Test fixtures only - never shipped (lib/marketing/testimonials.ts holds the real list).
    const html = renderToStaticMarkup(
      createElement(Testimonials, {
        t,
        href: (path: string) => path,
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

  it("shows nine cards, then the rest behind View more, with their pictures in the pill", () => {
    // Test fixtures only - never shipped.
    const items = Array.from({ length: 11 }, (_, i) => ({
      quote: `Fixture quote ${i + 1}.`,
      name: `Fixture ${i + 1}`,
      role: "Fixture role",
      avatar: i >= 9 ? `/images/fixture-${i + 1}.webp` : null,
    }));
    const html = renderToStaticMarkup(createElement(Testimonials, { t, href: (path: string) => path, testimonials: items, reviewScore: null }));
    const [before, after] = html.split("<details");
    expect(before.match(/<li /g)).toHaveLength(9);
    expect(before).toContain(esc(t.testimonialsTitle));
    expect(before).toContain(esc(t.testimonialsSub));
    expect(after).toContain(t.testimonialsMore);
    expect(after.match(/<li /g)).toHaveLength(2);
    expect(after).toContain('src="/images/fixture-10.webp"');
    // Both pictures appear twice: in the pill and on their cards.
    expect(html.split('src="/images/fixture-11.webp"').length - 1).toBe(2);
  });

  it("links the case study from the section, and from the card of the quote it is about (client, 2026-10-15)", () => {
    // Test fixtures only - never shipped. "Image Studio" is the name the case study links from (CASE_STUDY_TESTIMONIAL), as typed in the admin.
    const html = renderToStaticMarkup(
      createElement(Testimonials, {
        t,
        href: (path: string) => `/it${path}`,
        testimonials: [
          { quote: "Fixture quote one.", name: " image studio ", role: "Fixture role" },
          { quote: "Fixture quote two.", name: "Grace", role: "Fixture role" },
        ],
        reviewScore: null,
      }),
    );
    const links = [...html.matchAll(/<a [^>]*href="\/it\/success-stories\/image-studio"[^>]*>([\s\S]*?)<\/a>/g)].map((match) => match[1]);
    expect(links).toHaveLength(2);
    expect(links[0]).toContain(esc(t.testimonialsCaseStudy));
    expect(links[1]).toContain(t.testimonialsCaseStudyCard);
    // Only on the card it is about.
    const [imageStudio, grace] = html.split("<li ").slice(1);
    expect(imageStudio).toContain(t.testimonialsCaseStudyCard);
    expect(grace).not.toContain(t.testimonialsCaseStudyCard);
  });

  it("does not offer the case study's numbers when its quote is not shown", () => {
    // Test fixtures only - never shipped.
    const html = renderToStaticMarkup(
      createElement(Testimonials, {
        t,
        href: (path: string) => path,
        testimonials: [{ quote: "Fixture quote two.", name: "Grace", role: "Fixture role" }],
        reviewScore: null,
      }),
    );
    expect(html).toContain("Fixture quote two.");
    expect(html).not.toContain("/success-stories/image-studio");
    expect(html).not.toContain(esc(t.testimonialsCaseStudy));
  });
});

describe("the headline's moving last word (client, 2026-10-13)", () => {

  it.each(LOCALES)("%s: the template ends with {engine}, so a short name never leaves a gap", (locale) => {

    const template = getMessages(locale).home.titleAccentTemplate;

    expect(template.split("{engine}")).toHaveLength(2);

    expect(template).toMatch(/\{engine\}[.!?]?$/);

  });

});
