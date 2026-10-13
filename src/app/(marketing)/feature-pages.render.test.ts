import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { getMessages } from "@/lib/i18n/messages";
import { LOCALES, localePath } from "@/lib/i18n/config";
import {
  BACKLINKS_EXAMPLE,
  BACKLINKS_PAGE,
  CHATGPT_EXAMPLE,
  featurePageContent,
  type FeatureExample,
  type FeaturePage,
} from "@/lib/marketing/feature-pages";

/**
 * The footer product pages, /backlinks and /rank-on-chatgpt (client,
 * 2026-10-09): one h1, a real Image Studio article, no figure the client has
 * not given us, and questions that match their structured data.
 */

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode; [key: string]: unknown }) =>
    createElement("a", { href, ...rest }, children),
}));
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => createElement("img", { src, alt }),
}));

import { FeaturePageContent } from "./feature-page";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;").replace(/</g, "&lt;");

const PATHS: FeaturePage["path"][] = ["/backlinks", "/rank-on-chatgpt"];
const PAGES = LOCALES.flatMap((locale) => PATHS.map((path) => ({ locale, ...featurePageContent(path, locale) })));

describe("the footer product pages", () => {
  for (const { locale, page, example } of PAGES) {
    describe(`${locale} ${page.path}`, () => {
      const html = renderToStaticMarkup(createElement(FeaturePageContent, { page, example, locale }));

      it("has one h1, and sends people to sign up", () => {
        expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
        expect(html).toContain(esc(page.accent));
        expect(html).toContain('href="/sign-up"');
        // In the visitor's language where that page exists.
        expect(html).toContain(`href="${localePath(locale, page.secondaryCta.href)}"`);
      });

      it("shows the real Image Studio article, opening on its own site", () => {
        expect(example.href).toMatch(/^https:\/\/imagestudio\.com\/editorial\/post\//);
        expect(html).toContain(esc(example.title));
        expect(html).toContain(`href="${example.href}" target="_blank" rel="noopener"`);
        expect(html).toContain(`src="${example.image.src}"`);
      });

      it("shows no Domain Authority and no placed link until there are real ones", () => {
        expect(example.domainAuthority).toBeNull();
        expect(example.placedLink).toBeNull();
        expect(html).not.toContain(page.example.daLabel);
        expect(html).not.toContain(page.example.placedLabel);
      });

      it("publishes the questions it shows as FAQPage data", () => {
        const json = /<script type="application\/ld\+json">(.*?)<\/script>/.exec(html)?.[1];
        const schema = JSON.parse(json!) as { "@type": string; mainEntity: { name: string }[] };
        expect(schema["@type"]).toBe("FAQPage");
        expect(schema.mainEntity.map((q) => q.name)).toEqual(page.faq.map((q) => q.question));
        for (const item of page.faq) expect(html).toContain(esc(item.answer));
      });
    });
  }

  it("shows the Domain Authority and a placed link once they are filled in", () => {
    const example: FeatureExample = {
      ...BACKLINKS_EXAMPLE,
      domainAuthority: 41,
      placedLink: { url: "https://example.com/page", anchor: "an example anchor" },
    };
    const html = renderToStaticMarkup(createElement(FeaturePageContent, { page: BACKLINKS_PAGE, example }));
    expect(html).toContain(`${BACKLINKS_PAGE.example.daLabel} 41`);
    expect(html).toContain('href="https://example.com/page"');
    expect(html).toContain("an example anchor");
  });

  it("claims no figure the product does not back, in any language", () => {
    for (const locale of LOCALES) {
      const words = JSON.stringify(PATHS.map((path) => featurePageContent(path, locale).page));
      // No prices, percentages or customer counts: the only numbers are the free articles and the plan allowances.
      expect(words).not.toMatch(/[$€£]\s?\d|\d+\s?%|\d[\d,]*\+/);
      expect(words.match(/\d+/g)).toEqual(["3", "3", "20", "50"]);
    }
  });

  it("says the same in every language: as many benefits, steps, questions and table rows as the English page", () => {
    const shape = (page: FeaturePage) => ({
      path: page.path,
      benefits: page.benefits.length,
      without: page.compare.without.points.length,
      with: page.compare.with.points.length,
      steps: page.steps.length,
      table: page.table ? [page.table.columns.length, page.table.rows.map((row) => row.cells.length)] : null,
      related: page.related?.href ?? null,
      secondary: page.secondaryCta.href,
      faq: page.faq.length,
    });
    for (const path of PATHS) {
      const english = shape(featurePageContent(path, "en").page);
      for (const locale of LOCALES) expect(shape(featurePageContent(path, locale).page)).toEqual(english);
    }
    expect(featurePageContent("/rank-on-chatgpt", "it").example.highlights).toHaveLength(CHATGPT_EXAMPLE.highlights.length);
  });

  it("keeps the real article's own title and address in every language, and says it is in English", () => {
    for (const locale of LOCALES.filter((l) => l !== "en")) {
      const { page, example } = featurePageContent("/backlinks", locale);
      expect(example.title).toBe(BACKLINKS_EXAMPLE.title);
      expect(example.href).toBe(BACKLINKS_EXAMPLE.href);
      expect(example.about).not.toBe(BACKLINKS_EXAMPLE.about);
      expect(page.example.readLabel).not.toBe(BACKLINKS_PAGE.example.readLabel);
    }
  });

  it("is in every language's footer", () => {
    for (const locale of LOCALES) {
      const footer = getMessages(locale).footer;
      expect(footer.backlinks.trim()).not.toBe("");
      expect(footer.rankOnChatgpt.trim()).not.toBe("");
    }
  });
});
