import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { LOCALES, TRANSLATED_PATHS, type Locale } from "@/lib/i18n/config";
import { featuresPageCopy } from "@/lib/i18n/features-page";
import { LIMITS } from "@/lib/audit/rules";
import {
  FEATURE_CLIPS,
  featureClip,
  PRODUCT_TOOL_COUNT,
  PRODUCT_TOOLS,
  TOOL_ANCHORS,
  TOOL_FEATURES,
  TOOL_LINKS,
  type FeatureClipKey,
} from "@/lib/marketing/product-tools";
import { isPublicEnglishPage } from "@/lib/seo/public-pages";

/**
 * /features (client, 2026-11-27): everything RepGet does, the five tools and
 * Growth Copilot, each feature with its dashboard recording, in every
 * language - and the recordings on disk, small enough for the web.
 */

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode; [key: string]: unknown }) =>
    createElement("a", { href, ...rest }, children),
}));
vi.mock("next/image", () => ({
  default: ({ src, alt, loading }: { src: string; alt: string; loading?: string }) => createElement("img", { src, alt, loading }),
}));

import { FeaturesPageContent } from "./features-page";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;").replace(/</g, "&lt;");
const render = (locale: Locale) => renderToStaticMarkup(createElement(FeaturesPageContent, { locale }));
const words = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

describe("/features", () => {
  it.each(LOCALES)("%s: one h1, the index of the five tools, then each tool and Growth Copilot", (locale) => {
    const html = render(locale);
    const t = featuresPageCopy(locale);
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(html).toContain(`>${esc(t.title)}</h1>`);
    expect(html).toContain(`>${esc(t.indexTitle)}</h2>`);
    // The index: five numbered tools, each to its section.
    for (const tool of PRODUCT_TOOLS) expect(html).toContain(`href="#${TOOL_ANCHORS[tool]}"`);
    const sections = [...PRODUCT_TOOLS, "copilot" as const].map((tool) => html.indexOf(`<section id="${TOOL_ANCHORS[tool]}"`));
    expect(sections.every((i) => i > 0)).toBe(true);
    expect(sections).toEqual([...sections].sort((a, b) => a - b));
    expect(html).toContain(esc(t.toolNumber.replace("{n}", "1").replace("{count}", String(PRODUCT_TOOL_COUNT))));
    expect(html).toContain(esc(t.toolNumber.replace("{n}", "5").replace("{count}", "5")));
  });

  it.each(LOCALES)("%s: every feature has its title, words and recording", (locale) => {
    const html = render(locale);
    const t = featuresPageCopy(locale);
    const keys = Object.values(TOOL_FEATURES).flat();
    expect(html.match(/<h3[\s>]/g)).toHaveLength(keys.length);
    for (const key of keys) {
      expect(html).toContain(`>${esc(t.features[key].title)}</h3>`);
      expect(html).toContain(esc(t.features[key].body));
      expect(html).toContain(`src="${featureClip(key).poster}"`);
      expect(html).toContain(`aria-label="${esc(t.clipLabel.replace("{feature}", t.features[key].title))}"`);
    }
    // Posters only in the first HTML; each loop is added when it is reached.
    expect(html).not.toContain("<video");
  });

  it.each(LOCALES)("%s: links stay in the visitor's language and lead to real pages", (locale) => {
    const html = render(locale);
    const links = [...html.matchAll(/<a\s[^>]*href="([^"]+)"/g)].map((m) => m[1]);
    for (const path of Object.values(TOOL_LINKS)) {
      expect(TRANSLATED_PATHS.has(path), path).toBe(true);
      expect(links).toContain(locale === "en" ? path : `/${locale}${path}`);
    }
    expect(links).toContain(locale === "en" ? "/pricing" : `/${locale}/pricing`);
    expect(links).toContain("/sign-up");
  });

  it.each(LOCALES)("%s: a short, honest Coming soon", (locale) => {
    const t = featuresPageCopy(locale);
    const html = render(locale);
    expect(html).toContain(`>${esc(t.comingSoonTitle)}</h2>`);
    for (const item of t.comingSoon) expect(html).toContain(`>${esc(item)}</li>`);
    expect(t.comingSoon.length).toBeLessThanOrEqual(4);
  });

  it.each(LOCALES)("%s: names only the AI assistants the check asks", (locale) => {
    const text = words(render(locale));
    // AI Visibility asks ChatGPT, Gemini and Claude (lib/geo/engines.ts ASKABLE_ENGINE_IDS), never Perplexity or Copilot Search.
    for (const engine of ["Perplexity", "Copilot Search"]) expect(text).not.toContain(engine);
    for (const engine of ["ChatGPT", "Claude", "Gemini"]) expect(text).toContain(engine);
  });

  it("is a public, translated page with titles and descriptions the audit accepts", () => {
    expect(TRANSLATED_PATHS.has("/features")).toBe(true);
    expect(isPublicEnglishPage("/features")).toBe(true);
    for (const locale of LOCALES) {
      const t = featuresPageCopy(locale);
      expect(`${t.metaTitle} | RepGet`.length, locale).toBeLessThanOrEqual(LIMITS.titleMax);
      expect(t.metaDescription.length, locale).toBeGreaterThanOrEqual(LIMITS.metaMin);
      expect(t.metaDescription.length, locale).toBeLessThanOrEqual(LIMITS.metaMax);
    }
  });
});

describe("the recordings", () => {
  const PUBLIC = join(process.cwd(), "public");

  it("every clip has its loop and poster in public/features, the loop at most 3 MB", () => {
    for (const key of Object.keys(FEATURE_CLIPS) as FeatureClipKey[]) {
      const { mp4, poster } = featureClip(key);
      for (const file of [mp4, poster]) expect(existsSync(join(PUBLIC, file)), file).toBe(true);
      expect(statSync(join(PUBLIC, mp4)).size, mp4).toBeLessThanOrEqual(3 * 1024 * 1024);
    }
  });

  it("all of them together stay under 40 MB", () => {
    const total = (Object.keys(FEATURE_CLIPS) as FeatureClipKey[])
      .flatMap((key) => Object.values(featureClip(key)))
      .reduce((sum, file) => sum + statSync(join(PUBLIC, file)).size, 0);
    expect(total).toBeLessThanOrEqual(40 * 1024 * 1024);
  });

  it("every clip is shown on /features", () => {
    expect(new Set(Object.values(TOOL_FEATURES).flat())).toEqual(new Set(Object.keys(FEATURE_CLIPS)));
  });
});
