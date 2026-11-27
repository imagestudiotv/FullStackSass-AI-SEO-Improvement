import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { LOCALES, localePath, type Locale } from "@/lib/i18n/config";
import { featuresPageCopy } from "@/lib/i18n/features-page";
import { featureClip, PRODUCT_TOOLS, TOOL_ANCHORS, TOOL_FEATURES } from "@/lib/marketing/product-tools";

/**
 * The homepage's "Top features" (client, 2026-11-27), right after "Meet
 * RepGet.": the five tools with their recordings, in the visitor's language,
 * each card to its part of /features, and "See all features" - with nothing
 * but lazy posters in the first HTML.
 */

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode; [key: string]: unknown }) =>
    createElement("a", { href, ...rest }, children),
}));
vi.mock("next/image", () => ({
  default: ({ src, alt, loading, sizes }: { src: string; alt: string; loading?: string; sizes?: string }) =>
    createElement("img", { src, alt, loading, sizes }),
}));

import { Features } from "./features";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;").replace(/</g, "&lt;");

function render(locale: Locale) {
  const href = (path: string) => (locale === "en" ? path : localePath(locale, path));
  return renderToStaticMarkup(createElement(Features, { locale, href }));
}

describe("top features on the homepage", () => {
  it.each(LOCALES)("%s: the five tools, in order, each with its name, line and poster", (locale) => {
    const html = render(locale);
    const t = featuresPageCopy(locale);
    expect(html).toMatch(/^<section id="features"[^>]*aria-labelledby="home-features-heading"/);
    expect(html).toContain(`<h2 id="home-features-heading"`);
    expect(html).toContain(esc(t.home.title));
    expect(html.match(/<li /g)).toHaveLength(5);
    const at = PRODUCT_TOOLS.map((tool) => html.indexOf(`>${esc(t.tools[tool].name)}</a>`));
    expect(at.every((i) => i > 0)).toBe(true);
    expect(at).toEqual([...at].sort((a, b) => a - b));
    for (const tool of PRODUCT_TOOLS) {
      expect(html).toContain(esc(t.tools[tool].tagline));
      expect(html).toContain(`src="${featureClip(TOOL_FEATURES[tool][0]).poster}"`);
    }
  });

  it.each(LOCALES)("%s: each card leads to its tool on /features, and See all features to the page", (locale) => {
    const html = render(locale);
    const page = locale === "en" ? "/features" : `/${locale}/features`;
    for (const tool of PRODUCT_TOOLS) expect(html).toContain(`href="${page}#${TOOL_ANCHORS[tool]}"`);
    expect(html).toMatch(new RegExp(`<a href="${page}"[^>]*>${esc(featuresPageCopy(locale).home.seeAll)}`));
  });

  it("starts light: lazy posters only, no video until a card is reached", () => {
    const html = render("en");
    expect(html).not.toContain("<video");
    expect(html.match(/<img [^>]*loading="lazy"/g)).toHaveLength(5);
    // The recordings are labelled pictures for a screen reader.
    expect(html.match(/role="img"/g)).toHaveLength(5);
  });

  it("names Growth Copilot as the assistant, not as a sixth tool", () => {
    const html = render("en");
    expect(html).toContain(">Growth Copilot</b>");
    expect(html).not.toContain(`href="/features#${TOOL_ANCHORS.copilot}"`);
  });

  it("renders only the visitor's language", () => {
    const english = featuresPageCopy("en");
    for (const locale of LOCALES.filter((l) => l !== "en")) {
      const html = render(locale);
      for (const text of [english.home.title, english.home.seeAll, english.tools.websiteHealth.tagline]) expect(html).not.toContain(esc(text));
    }
  });
});
