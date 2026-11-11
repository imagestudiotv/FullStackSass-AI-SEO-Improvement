import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { PlanRow } from "@/lib/billing-shared";
import { LOCALES, localePath, type Locale } from "@/lib/i18n/config";
import { guestCopilotCopy } from "@/lib/i18n/guest-copilot";
import { heroCopy } from "@/lib/i18n/home/hero";
import { copilotFounderReviewsCopy } from "@/lib/i18n/home/copilot-founder-reviews";
import { faqCopy } from "@/lib/i18n/home/faq";
import { pricingCopy } from "@/lib/i18n/home/pricing";
import { getMessages } from "@/lib/i18n/messages";
import type { Testimonial } from "@/lib/marketing/testimonials";
import { TIERS } from "../../../scripts/plan-catalog.mjs";

/**
 * The homepage (client's approved design, 2026-11-04) as each language first
 * renders it: the design's section order, one h1, nothing from YouTube on the
 * first paint, no reviews while none is published, and no counter without a
 * real count.
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
/** The catalog on sale (scripts/plan-catalog.mjs), as the plans table gives it. */
const ON_SALE = TIERS.flatMap((tier) => [
  plan({ tier: tier.tier, name: tier.name, priceCents: tier.monthlyCents, articleLimit: tier.articleLimit, socialPostLimit: tier.socialPostLimit, sortOrder: tier.sortOrder }),
  plan({ id: `${tier.tier}-year`, tier: tier.tier, name: `${tier.name} (Annual)`, interval: "year", priceCents: tier.monthlyCents * 10, articleLimit: tier.articleLimit, socialPostLimit: tier.socialPostLimit, sortOrder: tier.sortOrder }),
]);
// A fixture, never shipped: the homepage passes the cards published in Admin -> Testimonials.
const REVIEW: Testimonial = { name: "Fixture Studio", role: "Fixture role", quote: "Fixture quote.", avatar: null };

function renderHome(
  locale: Locale,
  { testimonials = [], contentCount = null, plans = ON_SALE }: { testimonials?: Testimonial[]; contentCount?: number | null; plans?: PlanRow[] } = {},
) {
  const href = (path: string) => (locale === "en" ? path : localePath(locale, path));
  return renderToStaticMarkup(createElement(HomePageSections, { locale, href, testimonials, contentCount, plans }));
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
    const html = renderHome(locale, { testimonials: [REVIEW], contentCount: 1234 });
    const order = positions(html, [
      "<h1",
      esc(heroCopy(locale).ribbon.counterLabel),
      'id="features"',
      'id="growth-engines"',
      'id="repget-demo-video"',
      'id="how-it-works"',
      'id="repget-copilot-connect"',
      'id="repget-founder"',
      'id="repget-reviews"',
      'id="pricing"',
      'id="repget-faq"',
      'id="repget-final-cta"',
    ]);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it.each(LOCALES)("%s: has exactly one h1", (locale) => {
    expect(renderHome(locale).match(/<h1[\s>]/g)).toHaveLength(1);
  });

  it("gives every language the same sections", () => {
    const english = sectionIds(renderHome("en"));
    expect(english).toEqual(["features", "growth-engines", "repget-demo-video", "how-it-works", "repget-copilot-connect", "repget-founder", "pricing", "repget-faq", "repget-final-cta"]);
    for (const locale of LOCALES) expect(sectionIds(renderHome(locale))).toEqual(english);
  });

  it("keeps the anchors the header and the hero link to", () => {
    const html = renderHome("en", { testimonials: [REVIEW] });
    // Header "How it works" (/#how-it-works), the hero's watch link, the Social tool (/#features), the reviews.
    for (const id of ["how-it-works", "repget-demo-video", "repget-reviews", "features"]) expect(html).toContain(`id="${id}"`);
    expect(html).toContain('href="#repget-demo-video"');
  });

  it.each(LOCALES)("%s: the hero's one heading says the name and the promise; the mascots are decoration", (locale) => {
    const t = heroCopy(locale).hero;
    const html = renderHome(locale);
    const h1 = html.match(/<h1[\s\S]*?<\/h1>/)?.[0] ?? "";
    // What a screen reader and a search engine read: the visible words, apart, without the mascots' own.
    const words = h1
      .replace(/<span[^>]*aria-hidden="true"[\s\S]*?(?=<span[^>]*>RepGet\.<\/span>)/, " ")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    expect(words).toBe(esc(`${t.meet} RepGet. ${t.subtitleLine1} ${t.subtitleLine2}`));
    expect(h1).toMatch(/<span[^>]*aria-hidden="true"[^>]*>/);
    expect(h1).not.toContain("<button");
    // The old hero's floating cards and rating pill are gone.
    expect(html).not.toContain("growth features");
  });

  it("loads nothing from YouTube on the first paint, and still links to the video", () => {
    const html = renderHome("en");
    expect(html).not.toContain("<iframe");
    expect(html).not.toContain("youtube-nocookie");
    expect(html).toContain("PqNu8DzBlTQ");
  });

  it.each(LOCALES)("%s: shows the reassurances under the hero", (locale) => {
    const html = renderHome(locale);
    for (const item of heroCopy(locale).hero.benefits) expect(html).toContain(esc(item));
  });

  it("shows the content counter only with a real count", () => {
    const label = esc(heroCopy("en").ribbon.counterLabel);
    expect(renderHome("en", { contentCount: null })).not.toContain(label);
    const html = renderHome("en", { contentCount: 1234 });
    expect(html).toContain(label);
    // The true figure is in the first paint; the count-up is motion on top.
    expect(html).toContain("1,234");
  });

  it("shows the real content count, not the design's ticking 12,840", () => {
    // The counter stays real (lib/marketing/content-count.ts). The hero's
    // rating pill and floating cards with the design's figures (4.9/5, +200%,
    // 90+ ...) gave way to the simpler hero of 2026-11-11.
    // The visible words only: icon drawings are full of coordinates.
    const text = renderHome("en", { testimonials: [REVIEW], contentCount: 1234 }).replace(/<[^>]*>/g, " ");
    expect(text).not.toContain("12,840");
    expect(text).toContain("1,234");
    for (const gone of ["4.9/5", "+200% organic clicks"]) expect(text).not.toContain(gone);
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

  it("always has the platform video between the reviews, with or without many", () => {
    for (const count of [1, 2, 8]) {
      const html = renderHome("en", { testimonials: Array.from({ length: count }, (_, i) => ({ ...REVIEW, name: `Fixture ${i}` })) });
      expect(html).toContain(esc(copilotFounderReviewsCopy("en").reviews.videoTitle));
    }
  });

  it.each(LOCALES)("%s: shows the design's tag for a reviewer it names, none for anyone else", (locale) => {
    const tags = copilotFounderReviewsCopy(locale).reviews.tags;
    expect(renderHome(locale, { testimonials: [{ ...REVIEW, name: "Stefan Coetzer" }] })).toContain(esc(tags["stefan coetzer"]));
    for (const tag of Object.values(tags)) expect(renderHome(locale, { testimonials: [REVIEW] })).not.toContain(`>${esc(tag)}<`);
  });

  it("has both buttons under the stories once there is more than six, and only the second without", () => {
    const { showMore, allFeedback } = copilotFounderReviewsCopy("en").reviews;
    const cards = (count: number) => Array.from({ length: count }, (_, i) => ({ ...REVIEW, name: `Fixture ${i}` }));
    const many = renderHome("en", { testimonials: cards(7) });
    expect(many).toContain(showMore);
    expect(many).toContain(allFeedback);
    const six = renderHome("en", { testimonials: cards(6) });
    expect(six).not.toContain(showMore);
    expect(six).toContain(allFeedback);
  });

  it("sets a card without a photograph in the design's letters, over Admin's drawn-letter file", () => {
    const html = renderHome("en", {
      testimonials: [
        { ...REVIEW, name: "Oxford Magic Tours", avatar: "/preview/testimonials/sample-05.webp" },
        { ...REVIEW, name: "Muhammad Imran", avatar: "/preview/testimonials/sample-04.webp" },
      ],
    });
    expect(html).toContain("<span>OM</span>");
    expect(html).not.toContain("sample-05.webp");
    expect(html).toContain("sample-04.webp");
  });

  it.each(LOCALES)("%s: the guest copilot leads to its free tool and to sign-up, with the chat on the page", (locale) => {
    const html = renderHome(locale);
    const t = guestCopilotCopy(locale);
    const section = html.slice(html.indexOf('id="repget-copilot-connect"'), html.indexOf('id="repget-founder"'));
    expect(section).toContain(esc(t.section.titleAccent));
    expect(section).toMatch(new RegExp(`<a[^>]*href="${localePath(locale, "/tools/growth-copilot")}"[^>]*>${esc(t.section.tryFree).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")}`));
    expect(section).toMatch(new RegExp(`<a[^>]*href="/sign-up"[^>]*>${esc(t.section.unlock)}`));
    expect(section).toContain(`aria-label="${esc(t.chat.label)}"`);
    expect(section).toContain(`aria-label="${esc(t.chat.inputLabel)}"`);
    for (const chip of t.chat.chips) expect(section).toContain(esc(chip));
    // No customer's website anywhere in the example.
    expect(html).not.toContain("imagestudio.com");
  });

  it("shows the founder's chosen photograph", () => {
    expect(renderHome("en")).toContain("/images/home/founder-dumitru-culiuc.webp");
  });

  /** One package's card, as text. */
  const card = (html: string, label: string) => {
    const at = html.indexOf(`aria-label="${esc(label)}"`);
    return html.slice(at, html.indexOf("</article>", at)).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
  };

  it.each(LOCALES)("%s: shows the catalog's three packages, from the plans on sale", (locale) => {
    const html = renderHome(locale);
    const { packages } = pricingCopy(locale);
    expect(card(html, packages.launch.label)).toMatch(/Launch .*€ 99 .* 30 .* 60 /);
    expect(card(html, packages.grow.label)).toMatch(/Grow .*€ 149 .* 60 .* 90 /);
    expect(card(html, packages.scale.label)).toMatch(/Scale .*€ 349 .* 100 .* 240 /);
  });

  it("shows what the plans table charges, not a figure of its own", () => {
    const html = renderHome("en", { plans: [plan({ tier: "launch", name: "Launch", priceCents: 12300, articleLimit: 41, socialPostLimit: 77 })] });
    const text = card(html, pricingCopy("en").packages.launch.label);
    expect(text).toMatch(/€ 123 .* 41 .* 77 /);
    expect(html).not.toContain(pricingCopy("en").packages.grow.label);
  });

  it("leaves out the social posts of a plan that states none, and the cards when no plan can be read", () => {
    const old = renderHome("en", { plans: PLANS });
    expect(old).not.toContain(pricingCopy("en").posts);
    expect(old).toContain("€");
    const none = renderHome("en", { plans: [] });
    expect(none).toContain('id="pricing"');
    expect(none).not.toContain(pricingCopy("en").getStarted);
    expect(none).toContain(pricingCopy("en").talk);
  });

  it("takes each Get Started to its own plan", () => {
    const html = renderHome("en");
    for (const tier of ["launch", "grow", "scale"]) {
      expect(html).toContain(`href="/sign-up?next=%2Fonboarding%2Fwebsite%3Fplan%3D${tier}"`);
    }
  });

  it("makes Join with Google a working link to sign-up before any script runs", () => {
    const html = renderHome("en");
    expect(html).toMatch(new RegExp(`<a[^>]*href="/sign-up"[^>]*>(?:(?!</a>).)*${esc(heroCopy("en").hero.joinGoogle)}`));
  });

  it.each(LOCALES)("%s: asks for a website to be built on the page for that", (locale) => {
    const build = locale === "en" ? "/website-creation" : `/${locale}/website-creation`;
    expect(renderHome(locale)).toContain(`href="${build}"`);
  });

  it.each(LOCALES)("%s: the FAQ's social post figures are the catalog's", (locale) => {
    const answers = faqCopy(locale).groups.flatMap((group) => group.items.map((item) => item.answer));
    const answer = answers.find((text) => text.includes("Launch") && text.includes("Scale"));
    const figures = answer?.match(/\d+/g)?.map(Number);
    // Launch, Grow and Scale, then the 1 credit a post costs (Admin -> Credits).
    expect(figures).toEqual([...TIERS.map((tier) => tier.socialPostLimit), 1]);
  });

  it("publishes no FAQ markup of its own - /faq carries it", () => {
    const html = renderHome("en");
    expect(html).toContain(esc(faqCopy("en").groups[0].items[0].question));
    expect(html).not.toContain("FAQPage");
  });

  it.each(LOCALES)("%s: asks the design's 14 questions in three groups", (locale) => {
    const { groups } = faqCopy(locale);
    expect(groups.map((g) => g.items.length)).toEqual([7, 5, 2]);
    expect(renderHome(locale).match(/<summary/g)).toHaveLength(14);
  });

  it("keeps the contact link in the reader's language", () => {
    expect(renderHome("de")).toContain('href="/de/contact"');
    expect(renderHome("en")).toContain('href="/contact"');
  });
});

/** The words of the old closing panel, kept in messages.ts; the blog now ends with the homepage's banner (blog-closing-cta.render.test.ts). */
describe("closing panel's words", () => {
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
