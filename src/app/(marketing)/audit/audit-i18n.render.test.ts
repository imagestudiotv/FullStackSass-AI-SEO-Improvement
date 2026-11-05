import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ACCOUNT_AUDIT_MAX_PAGES, PUBLIC_AUDIT_MAX_PAGES } from "@/lib/audit/limits";
import type { PublicAuditResult } from "@/lib/audit/public-audit";
import { auditEndingCopy } from "@/lib/i18n/audit-ending";
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
    expect(html).toContain("your first 3 articles are free");
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
    for (const phrase of [t.crawlersTitle, t.cached, t.seePricing, auditEndingCopy(locale).finalBody]) expect(words).toContain(phrase);
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

describe("how the report ends (client's design, 2026-11-05)", () => {
  const signUp = `/sign-up?next=${encodeURIComponent("/onboarding/website?domain=example.com")}`;
  const hrefs = (html: string) => [...html.matchAll(/href="([^"]+)"/g)].map(([, href]) => href.replaceAll("&amp;", "&"));

  it.each(LOCALES)("in %s carries the audited website through sign-up, from both sections and nowhere else", (locale) => {
    const links = hrefs(render(locale));
    expect(links.filter((href) => href.startsWith("/sign-up"))).toEqual([signUp, signUp]);
    expect(links).toContain(localePath(locale, "/pricing"));
  });

  it.each(LOCALES)("in %s has one closing offer: the old gate and join block are gone", (locale) => {
    const html = render(locale);
    expect(html.match(/<section/g)).toHaveLength(1);
    expect(text(html).split(auditEndingCopy(locale).title)).toHaveLength(2);
  });

  it.each(LOCALES)("in %s states the real offer, with the numbers read from where they are enforced", (locale) => {
    const words = text(render(locale));
    const t = auditEndingCopy(locale);
    expect(words).toContain(t.noteOffer[1].replace("{count}", "3"));
    expect(words).toContain(t.noteTerms);
    expect(words).toContain(t.deeperAudit.body.replace("{pages}", String(ACCOUNT_AUDIT_MAX_PAGES)).replace("{freePages}", String(PUBLIC_AUDIT_MAX_PAGES)));
    expect(words).toContain(AUDIT_COPY[locale].result.plansStart.replace("{price}", "€29").trim());
    expect(words).not.toMatch(/\{(count|pages|freePages|price)\}/);
    expect(words).not.toContain("**");
    // The design's stale offer, in any language.
    expect(words).not.toMatch(/3[- ](day|días|jours|giorni|Tage)/i);
  });

  it("follows the configured offer, not the number 3", () => {
    const words = text(renderToStaticMarkup(createElement(AuditResult, { result: RESULT, offer: { price: null, freeArticles: 1 }, locale: "en" })));
    expect(words).toContain("your first article is free");
    expect(words).toContain("1 free article");
    expect(words).not.toContain("Plans start at");
  });

  it.each(LOCALES)("in %s shows the real count of what the check did not list, only when there is one", (locale) => {
    const count = AUDIT_COPY[locale].result.hidden[1].replace("{count}", "3");
    expect(text(render(locale))).toContain(count);
    const none = renderToStaticMarkup(createElement(AuditResult, { result: { ...RESULT, hiddenIssues: 0 }, offer: OFFER, locale }));
    expect(text(none)).not.toContain(count);
  });

  it.each(LOCALES)("in %s does not promise a free backlink", (locale) => {
    const copy = AUDIT_COPY[locale];
    for (const label of [...copy.steps.assetLabels, ...copy.progress.assets.map((asset) => asset.label)]) {
      expect(label.toLowerCase()).not.toContain("backlink");
    }
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
