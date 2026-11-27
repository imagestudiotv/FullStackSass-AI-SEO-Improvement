import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { PlanRow } from "@/lib/billing-shared";
import { planDisplayPrice } from "@/lib/billing/display-prices";
import { formatPrice } from "@/lib/billing-shared";
import { aiBlogWriterCopy, type AiBlogWriterCopy } from "@/lib/i18n/ai-blog-writer";
import { LOCALES, localePath, type Locale } from "@/lib/i18n/config";
import { AI_BLOG_WRITER_SAMPLE, sampleStats } from "@/lib/marketing/ai-blog-writer-sample";
import { FREE_PLAN } from "@/lib/plans/free-plan";
import { SUPPORTED_LANGUAGES } from "@/lib/websites/languages";
import { catalogRows } from "../../../scripts/plan-catalog.mjs";

/**
 * /ai-blog-writer (client ticket, 2026-11-27): the reference page's sections
 * in RepGet's words, the owner-approved writing sample, prices from the plan
 * rows exactly as /pricing shows them (never the bundle's struck-through
 * EUR 299), and questions that match their FAQPage data.
 */

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode; [key: string]: unknown }) =>
    createElement("a", { href, ...rest, prefetch: undefined }, children),
}));
vi.mock("next/image", () => ({
  default: ({ src, alt, loading }: { src: string; alt: string; loading?: string }) => createElement("img", { src, alt, loading }),
}));

import { AiBlogWriterPageContent, faqItems, languageList, teaserPlans } from "./ai-blog-writer-page";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The catalogue's rows (scripts/plan-catalog.mjs), as listPlans returns them on sale, the bundle included. */
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
const monthly = (tier: string) => PLANS.find((plan) => plan.tier === tier && plan.interval === "month")!;

const render = (locale: Locale, { plans = PLANS, offer = true }: { plans?: PlanRow[]; offer?: boolean } = {}) =>
  renderToStaticMarkup(createElement(AiBlogWriterPageContent, { locale, plans, offer }));

const SECTIONS = ["hero", "values", "compare", "steps", "quality", "brand", "sample", "platform", "mid-cta", "pricing", "agency", "faq", "closing"];

describe.each(["en", "it"] as const)("the %s page", (locale) => {
  const t = aiBlogWriterCopy(locale);
  const html = render(locale);
  const href = (path: string) => localePath(locale, path);

  it("has every section, in the reference page's order, and one h1", () => {
    const found = [...html.matchAll(/data-section="([^"]+)"/g)].map((m) => m[1]);
    expect(found).toEqual(SECTIONS);
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(html).toContain(esc(t.hero.accent));
  });

  it("starts free at sign-up, and links the free blog writer, pricing and the real pages it names", () => {
    expect(html).toContain(`href="/sign-up"`);
    for (const path of ["/tools/blog-writer", "/pricing", "/backlinks", "/rank-on-chatgpt", "/audit", "/contact", "/success-stories/image-studio"]) {
      expect(html, path).toContain(`href="${href(path)}"`);
    }
  });

  it("names the five tools and Growth Copilot, and no AI engine", () => {
    expect(html).toContain("Growth Copilot");
    expect(t.platform.tools).toHaveLength(4);
    for (const tool of t.platform.tools) expect(html).toContain(esc(tool.title));
    expect(html).not.toMatch(/ChatGPT|Gemini|Perplexity|Claude|Bing/);
  });

  it("prices the plans /pricing sells exactly as it does, with the launch price, and never the bundle's 299", () => {
    for (const tier of ["grow", "scale"]) {
      const plan = monthly(tier);
      const price = formatPrice(planDisplayPrice(plan, true).chargedCents, plan.currency);
      expect(html, tier).toMatch(new RegExp(`data-plan="${plan.name}"[\\s\\S]*?${price.replace(/[.]/g, "\\.")}`));
      expect(html).toContain(esc(t.pricing.articles.replace("{n}", String(plan.articleLimit))));
    }
    expect(html).toContain(esc(t.pricing.launchPrice));
    expect(html).toContain(esc(t.pricing.articles.replace("{n}", String(FREE_PLAN.articlesPerMonth))));
    expect(html).not.toContain("299");
    expect(html).not.toContain("Grow + Visibility");
    expect(html).not.toContain("<del");
  });

  it("publishes the questions it shows as FAQPage data, holes filled", () => {
    const json = /<script type="application\/ld\+json">(.*?)<\/script>/.exec(html)?.[1];
    const schema = JSON.parse(json!) as { "@type": string; mainEntity: { "@type": string; name: string; acceptedAnswer: { "@type": string; text: string } }[] };
    expect(schema["@type"]).toBe("FAQPage");
    expect(schema.mainEntity.length).toBeGreaterThanOrEqual(8);
    expect(schema.mainEntity.length).toBeLessThanOrEqual(10);
    for (const entry of schema.mainEntity) {
      expect(entry["@type"]).toBe("Question");
      expect(entry.acceptedAnswer["@type"]).toBe("Answer");
      expect(entry.acceptedAnswer.text).not.toMatch(/[{}]/);
      expect(html).toContain(esc(entry.name));
      expect(html).toContain(esc(entry.acceptedAnswer.text));
    }
    expect(schema.mainEntity.map((q) => q.name)).toEqual(t.faq.items.map((q) => q.question));
    // The articles each plan includes, from the rows.
    const articles = schema.mainEntity.find((q) => q.acceptedAnswer.text.includes("Grow"))!.acceptedAnswer.text;
    expect(articles).toContain(String(FREE_PLAN.articlesPerMonth));
    expect(articles).toContain(String(monthly("grow").articleLimit));
    expect(articles).toContain(String(monthly("scale").articleLimit));
  });

  it("shows the writing sample whole: answer, contents that jump to its headings, picture with alt text, FAQ and stats", () => {
    const sample = AI_BLOG_WRITER_SAMPLE;
    expect(html).toContain(`<article lang="en"`);
    expect(html).toContain(esc(sample.title));
    expect(html).toContain(esc(sample.tldr));
    expect(html).toContain(esc(sample.intro));
    for (const section of sample.sections) {
      expect(html).toContain(`href="#${section.id}"`);
      expect(html).toContain(`id="${section.id}"`);
      for (const sub of section.subsections) expect(html).toContain(`id="${sub.id}"`);
    }
    for (const item of sample.faq) expect(html).toContain(esc(item.answer));
    expect(html).toContain(`alt="${esc(sample.image.alt)}" loading="lazy"`);
    for (const item of t.sample.checklist) expect(html).toContain(esc(item.title));
    const stats = sampleStats(sample);
    expect(stats.words).toBeGreaterThan(150);
    expect(html).toMatch(new RegExp(`${esc(t.sample.stats.words)}</dt><dd[^>]*>${stats.words.toLocaleString(locale === "en" ? "en-IE" : locale)}<`));
    expect(html).toContain(esc(t.sample.disclaimer));
    // The sample links nowhere but within itself.
    const article = html.slice(html.indexOf("<article"), html.indexOf("</article>"));
    expect([...article.matchAll(/href="([^"]+)"/g)].every((m) => m[1].startsWith("#"))).toBe(true);
  });

  it("loads no script, video or frame beyond its structured data", () => {
    expect(html.match(/<script/g)).toHaveLength(1);
    expect(html).not.toMatch(/<video|<iframe|autoplay/);
  });
});

describe("the page without plans to read (a build with no database)", () => {
  const html = render("de", { plans: [] });
  const t = aiBlogWriterCopy("de");

  it("shows the Free plan, says the plans are on the pricing page, and states no paid figure", () => {
    expect(html).toContain('data-plan="free"');
    expect(html).not.toContain('data-plan="Grow"');
    expect(html).toContain(esc(t.pricing.unavailable));
    const answer = faqItems(t, "de", []).find((item) => item.question === t.faq.items[4].question)!.answer;
    expect(answer).not.toContain("Grow");
    expect(answer).toContain(String(FREE_PLAN.articlesPerMonth));
  });
});

describe("the price source", () => {
  it("is planDisplayPrice: the regular price with the offer off, the launch price with it on", () => {
    const off = teaserPlans(PLANS, false);
    const on = teaserPlans(PLANS, true);
    expect(off.map((plan) => plan.name)).toEqual(["Grow", "Scale"]);
    expect(off.map((plan) => plan.price)).toEqual(["grow", "scale"].map((tier) => formatPrice(monthly(tier).priceCents, "eur")));
    expect(off.every((plan) => !plan.launch)).toBe(true);
    expect(on.map((plan) => plan.price)).toEqual(["grow", "scale"].map((tier) => formatPrice(planDisplayPrice(monthly(tier), true).chargedCents, "eur")));
    expect(on.every((plan) => plan.launch)).toBe(true);
    expect(render("en", { offer: false })).not.toContain(esc(aiBlogWriterCopy("en").pricing.launchPrice));
  });
});

describe("the words, in every language", () => {
  const shape = (t: AiBlogWriterCopy) => ({
    values: t.values.items.length,
    yourself: t.compare.yourself.points.length,
    repget: t.compare.repget.points.length,
    steps: t.steps.items.map((step) => step.tags.length),
    quality: t.quality.items.length,
    brand: t.brand.points.length,
    checklist: t.sample.checklist.length,
    tools: t.platform.tools.length,
    faq: t.faq.items.length,
    holes: t.faq.items.map((item) => (item.answer.match(/\{\w+\}/g) ?? []).join()),
  });

  it("say the same in every language: as many tiles, points, steps, criteria and questions as English", () => {
    const english = shape(aiBlogWriterCopy("en"));
    expect(english.quality).toBe(6);
    expect(english.faq).toBe(10);
    for (const locale of LOCALES) expect(shape(aiBlogWriterCopy(locale)), locale).toEqual(english);
  });

  it("claim no figure the product does not supply: no prices, percentages, counts or ratings", () => {
    for (const locale of LOCALES) {
      const words = JSON.stringify(aiBlogWriterCopy(locale));
      expect(words, locale).not.toMatch(/[$€£]\s?\d|\d+\s?%|\d[\d,.]*\+|299|★|G2|Trustpilot/);
      // The only digits: "two to four months" is written out; H2/H3 are in the stats labels.
      expect((words.match(/\d+/g) ?? []).filter((n) => n !== "2" && n !== "3"), locale).toEqual([]);
      expect(words, locale).not.toMatch(/ChatGPT|Gemini|Perplexity|Claude|Bing/);
    }
  });

  it("list every language RepGet writes, in the reader's language", () => {
    expect(languageList("en")).toBe("English, Spanish, French, Italian, German, Portuguese, Dutch, Polish, and Romanian");
    for (const locale of LOCALES) expect(languageList(locale).split(/, | \w+ /).length, locale).toBeGreaterThanOrEqual(SUPPORTED_LANGUAGES.length - 1);
  });

  it("keep the meta title and description within the audit's limits", () => {
    for (const locale of LOCALES) {
      const t = aiBlogWriterCopy(locale);
      expect(`${t.metaTitle} | RepGet`.length, locale).toBeLessThanOrEqual(60);
      expect(t.metaDescription.length, locale).toBeGreaterThanOrEqual(70);
      expect(t.metaDescription.length, locale).toBeLessThanOrEqual(158);
    }
  });
});

describe("the writing sample", () => {
  it("keeps the owner-approved title, credit and opening word for word", () => {
    expect(AI_BLOG_WRITER_SAMPLE.title).toBe("How to plan Lake Como wedding portraits around the aperitivo");
    expect(AI_BLOG_WRITER_SAMPLE.credit).toBe("Image Studio / Wedding photography · imagestudio.com");
    expect(AI_BLOG_WRITER_SAMPLE.intro).toMatch(/^Start with the photograph you would hate to miss\./);
    const headings = AI_BLOG_WRITER_SAMPLE.sections.flatMap((section) => [section.heading, ...section.subsections.map((sub) => sub.heading)]);
    expect(headings).toEqual(expect.arrayContaining(["Choose your return time first", "Count the time outside the photograph", "Give the plan a shorter version"]));
  });

  it("states no figure: no times, prices or counts", () => {
    expect(JSON.stringify(AI_BLOG_WRITER_SAMPLE).replace(/"(width|height)":\d+/g, "")).not.toMatch(/\d/);
  });
});
