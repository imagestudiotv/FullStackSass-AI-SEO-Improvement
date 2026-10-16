import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { LOCALES } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";
import { CASE_STUDY_COPY, IMAGE_STUDIO } from "@/lib/marketing/case-study-image-studio";

import LocalisedImageStudioCaseStudyPage from "../../[locale]/success-stories/image-studio/page";
import { SuccessStoriesContent } from "../../success-stories-content";
import { CaseStudyPage, caseStudyMetadata, clicksChart, dates } from "./case-study";

/**
 * The first case study (client, 2026-10-15): Image Studio, in every language,
 * with real numbers only, the same-owner line always shown, and the Success
 * Stories page leading with it.
 */

beforeAll(() => {
  process.env.NEXT_PUBLIC_APP_URL = "https://www.repget.com";
});
afterAll(() => {
  delete process.env.NEXT_PUBLIC_APP_URL;
});

const render = (locale: (typeof LOCALES)[number]) => renderToStaticMarkup(createElement(CaseStudyPage, { locale }));
const esc = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
const jsonLd = (html: string) => JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)?.[1] ?? "[]");

describe("the Image Studio case study", () => {
  it("says, near the top, that Image Studio and RepGet have the same owner", () => {
    for (const locale of LOCALES) {
      const html = render(locale);
      const disclosure = html.indexOf(esc(CASE_STUDY_COPY[locale].disclosure));
      expect(disclosure, locale).toBeGreaterThan(0);
      // Before any number or the quote.
      expect(disclosure, locale).toBeLessThan(html.indexOf("<dl"));
    }
  });

  it("claims no growth in its headline", () => {
    for (const locale of LOCALES) expect(CASE_STUDY_COPY[locale].title, locale).toMatch(/RepGet/);
    expect(CASE_STUDY_COPY.en.title).not.toMatch(/growth|grow/i);
    expect(CASE_STUDY_COPY.de.title).not.toMatch(/wächst/);
  });

  it("shows the real figures, formatted for the language", () => {
    const en = render("en");
    expect(en).toContain(">291<");
    expect(en).toContain("articles written in two weeks (2 live, 14 scheduled)");
    expect(en).toContain("≈ 4,500");
    expect(en).toContain("About 1,400 words each.");
    expect(en).toContain("2 pages kept out of Google by a noindex tag.");
    expect(en).toContain("scored the site 94 out of 100 on the 25 pages it read");
    const it = render("it");
    // Italian groups digits from five up (CLDR): 4500, 12.500.
    expect(it).toContain("≈ 4500");
    expect(it).toContain("Circa 1400 parole ciascuno.");
    expect(it).toContain("articoli scritti in due settimane (2 pubblicati, 14 in programma)");
    expect(it).toContain(">13,5<");
  });

  it("writes the first of the month the way each language does", () => {
    expect(dates("fr").long("2026-10-01")).toBe("1er octobre 2026");
    expect(dates("fr").long("2026-10-12")).toBe("12 octobre 2026");
    expect(dates("it").dayMonth("2026-10-01")).toBe("1° ottobre");
    expect(dates("en").long("2026-10-01")).toBe("1 October 2026");
    expect(render("fr")).toContain("Étude de cas · depuis le 1er octobre 2026");
  });

  it("draws the weekly clicks to scale, marking RepGet's first day", () => {
    const chart = clicksChart();
    expect(chart.axisMax).toBe(160);
    expect(chart.ticks).toEqual([40, 80, 120, 160]);
    // 1 October: three days into the ninth of ten weeks.
    expect(chart.startAt).toBeCloseTo(((8 + 3 / 7) / 10) * 100, 5);
    // The range before RepGet: whole weeks only.
    expect([chart.min, chart.max]).toEqual([41, 105]);
    // Only a week that began on or after the first day is highlighted.
    expect(chart.bars.filter((bar) => bar.after).map((bar) => bar.start)).toEqual(["2026-10-05"]);
    // The bars end on the last week's Sunday.
    expect(chart.end).toBe("2026-10-11");

    const html = render("en");
    const bars = [...html.matchAll(/data-week="([\d-]+)"[^>]*style="height:([\d.]+)%"/g)].map((match) => [match[1], Number(match[2])]);
    expect(bars).toHaveLength(IMAGE_STUDIO.weeks.length);
    expect(bars.at(-1)).toEqual(["2026-10-05", (146 / 160) * 100]);
    expect(html).toContain("Weekly clicks from Google, 3 August to 11 October 2026:");
    // Each month is named once, under its first week.
    const labels = /<div aria-hidden="true" class="ml-9 grid[^"]*"[^>]*>([\s\S]*?)<\/div>/.exec(html)?.[1] ?? "";
    expect([...labels.matchAll(/<br\/>([A-Za-z]+)<\/span>/g)].map((match) => match[1])).toEqual(["Aug", "Sept", "Oct"]);
    // Every value is also in the table under "Show the numbers".
    expect(html.match(/<tr class="border-b last:border-0">/g)).toHaveLength(IMAGE_STUDIO.weeks.length);
  });

  it("keeps the starting point in line with the weeks it comes from", () => {
    const weeks = IMAGE_STUDIO.weeks.filter((week) => week.start >= IMAGE_STUDIO.baselineFrom && week.start <= IMAGE_STUDIO.baselineTo);
    expect(weeks).toHaveLength(8);
    const average = (pick: (week: (typeof weeks)[number]) => number) => weeks.reduce((sum, week) => sum + pick(week), 0) / weeks.length;
    expect(Math.round(average((week) => week.clicks))).toBe(IMAGE_STUDIO.baseline.clicks);
    expect(Math.round(average((week) => week.impressions) / 100) * 100).toBe(IMAGE_STUDIO.baseline.impressions);
    expect(Math.round(average((week) => week.position))).toBe(IMAGE_STUDIO.baseline.position);
  });

  /*
    The sentences written for this month's counts. When a count changes, its
    test fails until the words in every language are brought up to date
    (then change the expected value here).
  */
  it("has words that still match this month's counts", () => {
    const daysWriting = (Date.parse(IMAGE_STUDIO.writtenTo) - Date.parse(IMAGE_STUDIO.started)) / 86_400_000;
    expect(daysWriting, 'figures.written says "in two weeks"').toBeLessThanOrEqual(14);
    expect(IMAGE_STUDIO.aiMentions, 'figures.ai says "no mentions yet", aiStart "in none of"').toBe(0);
    expect(IMAGE_STUDIO.liveArticles, 'the FAQ says "the two that are live"').toHaveLength(2);
    expect(IMAGE_STUDIO.aiChecks).toBeGreaterThan(0);
  });

  it("quotes the owner by name, as the owner of both, with the first day's numbers", () => {
    const en = render("en");
    expect(en).toContain("291 keywords and a plan for 35 articles");
    expect(en).toContain(">Dimitri Kuliuk, owner of Image Studio and RepGet<");
    expect(render("it")).toContain(">Dimitri Kuliuk, proprietario di Image Studio e di RepGet<");
  });

  it("links the live articles, marked English on other languages and announced as opening a new tab", () => {
    const en = render("en");
    const it = render("it");
    const literal = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const newTab = esc(getMessages("en").home.opensInNewTab);
    for (const article of IMAGE_STUDIO.liveArticles) {
      expect(en).toMatch(
        new RegExp(`<a href="${literal(article.url)}" target="_blank" rel="noopener"[^>]*><span>${literal(article.title)}</span><span class="sr-only"> ${literal(newTab)}</span></a>`),
      );
      expect(it).toContain(`<span lang="en">${article.title}</span>`);
    }
  });

  it("links within its language, with the same trail in the page and its structured data", () => {
    const html = render("it");
    expect(html).toContain('href="/it/audit"');
    expect(html).toContain('href="/it/pricing"');
    expect(html).toContain('href="/it/success-stories"');
    const [article, breadcrumbs] = jsonLd(html);
    expect(article).toMatchObject({
      "@type": "Article",
      headline: CASE_STUDY_COPY.it.title,
      inLanguage: "it",
      url: "https://www.repget.com/it/success-stories/image-studio",
      datePublished: IMAGE_STUDIO.published,
      dateModified: IMAGE_STUDIO.updated,
      about: { "@type": "Organization", name: "Image Studio", url: "https://imagestudio.com" },
    });
    expect(breadcrumbs.itemListElement.map((item: { item: string }) => item.item)).toEqual([
      "https://www.repget.com/it",
      "https://www.repget.com/it/success-stories",
      "https://www.repget.com/it/success-stories/image-studio",
    ]);
    // The names Google is given are the ones the visible trail shows.
    const trail = /<nav aria-label="[^"]*" class="flex flex-wrap[^"]*">([\s\S]*?)<\/nav>/.exec(html)?.[1] ?? "";
    const visible = [...trail.matchAll(/<a [^>]*>([^<]+)<\/a>/g)].map((match) => match[1]).concat("Image Studio");
    expect(breadcrumbs.itemListElement.map((item: { name: string }) => item.name)).toEqual(visible);
  });

  it("is one page in five languages for search engines", () => {
    const meta = caseStudyMetadata("it");
    expect(meta.title).toBe("Caso di studio: Image Studio");
    expect(meta.alternates?.canonical).toBe("/it/success-stories/image-studio");
    expect(Object.keys(meta.alternates?.languages ?? {}).sort()).toEqual(["de", "en", "es", "fr", "it", "x-default"]);
  });

  it("is a 404 under /en and under a language the site does not have", async () => {
    for (const locale of ["en", "xx"]) {
      await expect(LocalisedImageStudioCaseStudyPage({ params: Promise.resolve({ locale }) })).rejects.toThrow(/NEXT_HTTP_ERROR_FALLBACK;404/);
    }
  });

  it("has every placeholder of the English text in every language, and no other", () => {
    const placeholders = (value: unknown, path = ""): string[] =>
      typeof value === "string"
        ? [...value.matchAll(/\{(\w+)\}/g)].map((match) => `${path}:${match[1]}`)
        : Array.isArray(value)
          ? value.flatMap((entry, index) => placeholders(entry, `${path}[${index}]`))
          : value && typeof value === "object"
            ? Object.entries(value).flatMap(([key, entry]) => placeholders(entry, `${path}.${key}`))
            : [];
    const english = placeholders(CASE_STUDY_COPY.en).sort();
    for (const locale of LOCALES) expect(placeholders(CASE_STUDY_COPY[locale]).sort(), locale).toEqual(english);
  });
});

describe("the Success Stories page", () => {
  it("leads with the case study, in the page's language", () => {
    const html = renderToStaticMarkup(createElement(SuccessStoriesContent, { t: getMessages("it"), locale: "it" }));
    expect(html).toContain(esc(CASE_STUDY_COPY.it.card.label));
    expect(html).toMatch(/<a [^>]*href="\/it\/success-stories\/image-studio"[^>]*>[\s\S]*?Leggi il caso di studio/);
    // The card comes before what RepGet measures.
    const card = html.indexOf("<article");
    expect(card).toBeGreaterThan(0);
    expect(card).toBeLessThan(html.indexOf(esc(getMessages("it").successStories.resultsTitle)));
    // Its buttons stay in the language.
    expect(html).toContain('href="/it/audit"');
    expect(html).toContain('href="/it/pricing"');
  });
});
