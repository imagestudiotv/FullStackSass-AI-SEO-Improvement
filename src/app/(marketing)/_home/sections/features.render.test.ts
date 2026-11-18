import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { LOCALES, localePath, type Locale } from "@/lib/i18n/config";
import { FEATURE_HIGHLIGHTS, FEATURE_KEYS, featuresCopy } from "@/lib/i18n/home/features";

/**
 * The homepage's "Top features" shell (client's design, 2026-11-18) as each
 * language first renders it: the nine capabilities as a tab pattern with every
 * panel in the HTML, the visitor's language only, the trial button to the
 * localized pricing page, no mascot, and only claims RepGet can back.
 */

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode; [key: string]: unknown }) =>
    createElement("a", { href, ...rest }, children),
}));

import { Features } from "./features";

/** Static markup escapes quotes and apostrophes; compare against the escaped form. */
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;").replace(/</g, "&lt;");

function render(locale: Locale) {
  const href = (path: string) => (locale === "en" ? path : localePath(locale, path));
  return renderToStaticMarkup(createElement(Features, { locale, href }));
}

/** The words a reader (or a crawler) gets: no tags, no drawing coordinates. */
const words = (html: string) => html.replace(/<svg[\s\S]*?<\/svg>/g, " ").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");

describe("top features", () => {
  it.each(LOCALES)("%s: nine tabs, every panel in the HTML, the first one shown", (locale) => {
    const html = render(locale);
    const t = featuresCopy(locale);
    expect(html).toMatch(/^<section id="features"[^>]*aria-labelledby="home-features-heading"/);
    expect(html).toContain(`<h2 id="home-features-heading"`);
    expect(html).toContain(`>${esc(t.eyebrow)}</h2>`);
    expect(html.match(/role="tab"/g)).toHaveLength(9);
    expect(html.match(/aria-selected="true"/g)).toHaveLength(1);
    expect(html.match(/role="tabpanel"/g)).toHaveLength(9);
    expect(html.match(/role="tabpanel"[^>]*hidden=""/g)).toHaveLength(8);
    for (const key of FEATURE_KEYS) {
      const f = t[key];
      for (const text of [f.nav, f.navSub, f.headline[0], f.headline[1], f.description, ...f.perks]) expect(html).toContain(esc(text));
    }
    // Every panel says it is an illustration.
    expect(html.split(esc(t.preview)).length - 1).toBe(9);
  });

  it.each(LOCALES)("%s: starts the free trial on the pricing page in the visitor's language", (locale) => {
    const pricing = locale === "en" ? "/pricing" : `/${locale}/pricing`;
    expect(render(locale)).toMatch(new RegExp(`<a[^>]*href="${pricing}"[^>]*>${esc(featuresCopy(locale).cta)}`));
  });

  it.each(LOCALES)("%s: labels the next button and the four story bullets", (locale) => {
    const html = render(locale);
    const t = featuresCopy(locale);
    expect(html).toContain(`aria-label="${esc(t.next)}"`);
    FEATURE_HIGHLIGHTS.forEach((index, n) => {
      const label = t.jump.replace("{n}", String(n + 1)).replace("{label}", t[FEATURE_KEYS[index]].nav);
      expect(html).toContain(`aria-label="${esc(label)}"`);
    });
  });

  it("renders only the visitor's language", () => {
    const english = featuresCopy("en");
    for (const locale of LOCALES.filter((l) => l !== "en")) {
      const html = render(locale);
      for (const text of [english.social.headline[1], english.ai.description, english.cta]) expect(html).not.toContain(esc(text));
    }
  });

  it("has no mascot any more", () => {
    const html = render("en");
    expect(html).not.toContain("mascot");
    expect(html).not.toContain("<img");
  });

  it.each(LOCALES)("%s: claims only what RepGet does", (locale) => {
    const text = words(render(locale));
    // AI visibility asks Claude only (lib/geo/check.ts); no schema check in the audit (lib/audit/rules.ts).
    for (const unsupported of ["ChatGPT", "Perplexity", "Gemini", "schema", "Schema"]) expect(text).not.toContain(unsupported);
    expect(text).toContain("Claude");
    // The previews' figures are samples, and the board says so.
    expect(text).toContain(featuresCopy(locale).technical.scoreLabel);
    expect(text).toContain(featuresCopy(locale).analytics.change);
  });
});

describe("top features' words", () => {
  /** The copy's shape: keys, and the length of every list. */
  const shape = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(shape)
      : value && typeof value === "object"
        ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shape(v)]))
        : typeof value;

  it("gives every language the same shape", () => {
    const english = shape(featuresCopy("en"));
    for (const locale of LOCALES) expect(shape(featuresCopy(locale))).toEqual(english);
  });

  /** Every string, with where it sits. */
  const strings = (value: unknown, at = ""): [string, string][] =>
    typeof value === "string"
      ? [[at, value]]
      : value && typeof value === "object"
        ? Object.entries(value).flatMap(([k, v]) => strings(v, `${at}.${k}`))
        : [];

  // Names, the brand, and words that are the same in the language ("Mentions · citations · GEO" in French, "↗ 18%" in Italian).
  const SAME = new Set([
    "Reddit · X · Threads",
    "Claude",
    "llms.txt",
    "Growth Copilot",
    "REPGET / STUDIO",
    "YouTube Short",
    "Search Console & Analytics",
    "Illustration",
    "Mentions · citations · GEO",
    "↗ 18%",
  ]);

  it.each(LOCALES.filter((l) => l !== "en"))("%s: translates every word", (locale) => {
    const english = new Map(strings(featuresCopy("en")));
    const untranslated = strings(featuresCopy(locale)).filter(([at, text]) => english.get(at) === text && !SAME.has(text));
    expect(untranslated).toEqual([]);
  });
});
