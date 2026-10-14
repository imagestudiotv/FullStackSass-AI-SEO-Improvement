import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { PublicAuditResult } from "@/lib/audit/public-audit";
import { LOCALES, localePath, splitLocale } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";

/**
 * The free website check's result in every language (client, 2026-10-13).
 * Findings are named and explained as the Website health page explains them
 * in that language; English keeps its own wording.
 */

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode; [key: string]: unknown }) =>
    createElement("a", { href, ...rest }, children),
}));

import { AuditResult } from "./audit-result";
import { AuditProgress } from "./audit-progress";
import { AUDIT_COPY } from "./copy";

const RESULT: PublicAuditResult = {
  domain: "example.com",
  score: 72,
  pagesChecked: 1,
  counts: { critical: 1, warning: 1, info: 0 },
  issues: [
    { type: "missing_title", severity: "critical", detail: "No title tag. This is the headline shown in search results.", urls: ["https://example.com/"], pageCount: 1 },
    {
      type: "title_too_long",
      severity: "warning",
      detail: "Title is 82 characters and will be cut off after about 60.",
      urls: ["https://example.com/a", "https://example.com/b"],
      pageCount: 4,
    },
  ],
  notAssessed: ["Duplicate page titles", "Internal linking"],
  hiddenIssues: 3,
  cached: true,
  siteName: "Example",
  language: null,
  platform: null,
  crawlers: [
    { agent: "GPTBot", owner: "ChatGPT", allowed: true, explicit: false },
    { agent: "ClaudeBot", owner: "Claude", allowed: false, explicit: true },
  ],
  linkedHosts: ["partner.example"],
  previewImage: null,
};

const OFFER = { price: "€29", freeArticles: 3 };
const render = (locale: (typeof LOCALES)[number]) => renderToStaticMarkup(createElement(AuditResult, { result: RESULT, offer: OFFER, locale }));
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");

describe("the free check's result", () => {
  it("in English, as before: its own labels and fixes", () => {
    const html = text(render("en"));
    expect(html).toContain("Title is 82 characters and will be cut off after about 60.");
    expect(html).toContain("Plans start at €29 a month.");
    expect(html).toContain("New accounts get their first 3 articles free.");
    expect(html).toContain("duplicate page titles, internal linking");
  });

  it.each(LOCALES.filter((l) => l !== "en"))("in %s: each finding as the Website health page says it, and nothing left in English", (locale) => {
    const html = render(locale);
    const words = text(html);
    const health = getMessages(locale).app.health;
    // Names and fixes from the health page.
    expect(words).toContain(health.issues.missing_title.label);
    expect(words).toContain(health.issues.title_too_long.fix);
    // The title detail with its numbers, in that language.
    expect(words).toContain("82");
    expect(words).not.toContain("will be cut off");
    // The checks that could not run, named in that language.
    expect(words).toContain(health.crossChecks.duplicateTitles);
    // The page's own words.
    const t = AUDIT_COPY[locale].result;
    for (const phrase of [t.crawlersTitle, t.joinTitle, t.cached, t.seeFull]) expect(words).toContain(phrase);
    // No English sentence from the English page.
    const english = text(render("en"));
    for (const sentence of english.match(/[A-Z][a-z][^.!?]{30,}[.!?]/g) ?? []) {
      if (/example|Example|GPTBot|ClaudeBot/.test(sentence)) continue;
      expect(words, sentence).not.toContain(sentence);
    }
    // Links stay in the language wherever the page exists in it.
    for (const [, href] of html.matchAll(/href="([^"]+)"/g)) {
      if (href.startsWith("/")) expect(href).toBe(localePath(locale, splitLocale(href).path));
    }
  });
});

describe("the join block's count", () => {
  it.each(LOCALES)("in %s says one finding in the singular, and several in the plural", (locale) => {
    const one: PublicAuditResult = { ...RESULT, issues: [RESULT.issues[1]], counts: { critical: 0, warning: 0, info: 1 }, hiddenIssues: 0 };
    const [singular, several] = AUDIT_COPY[locale].result.joinItems[0].body;
    expect(text(renderToStaticMarkup(createElement(AuditResult, { result: one, offer: OFFER, locale })))).toContain(singular);
    // The total of the bar at the top (1 critical + 1 warning), not that plus the 3 hidden issue types.
    expect(text(render(locale))).toContain(several.replace("{count}", "2"));
    expect(singular).not.toContain("{count}");
  });

  it.each(LOCALES)("in %s has its own words for a clean result, never \"0 of them\"", (locale) => {
    const clean: PublicAuditResult = { ...RESULT, issues: [], counts: { critical: 0, warning: 0, info: 0 }, hiddenIssues: 0 };
    const page = text(renderToStaticMarkup(createElement(AuditResult, { result: clean, offer: OFFER, locale })));
    expect(page).toContain(AUDIT_COPY[locale].result.joinItems[0].none);
    expect(page).not.toContain(AUDIT_COPY[locale].result.joinItems[0].body[1].replace("{count}", "0"));
  });
});

describe("the progress screen", () => {
  it.each(LOCALES)("in %s names the three assets and the site", (locale) => {
    const html = renderToStaticMarkup(createElement(AuditProgress, { domain: "example.com", copy: AUDIT_COPY[locale].progress, preview: null }));
    expect(html).toContain(AUDIT_COPY[locale].progress.assets[0].label);
    expect(html).toContain("example.com");
    expect(html).not.toContain("{domain}");
  });
});
