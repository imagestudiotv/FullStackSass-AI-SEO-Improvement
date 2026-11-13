import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { auditLandingCopy } from "@/lib/i18n/audit-landing";
import { LOCALES, localePath, splitLocale } from "@/lib/i18n/config";
import { TRIAL_DAYS } from "@/lib/plans/features";

/**
 * The free audit's landing page (client's design, 2026-11-05). What must hold:
 * every language is complete, the forms lead to the real check, the sample is
 * labelled as one, and nothing promises what the backend does not grant.
 */

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode; [key: string]: unknown }) =>
    createElement("a", { href, ...rest }, children),
}));
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => createElement("img", { src, alt }),
}));
const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { AuditLanding } from "./audit-landing";
import { AUDIT_FIELD_ID } from "./audit-start-form";

const render = (locale: (typeof LOCALES)[number]) => renderToStaticMarkup(createElement(AuditLanding, { locale }));
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");

/** Every string in a language's copy, however deep. */
function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

describe("the audit landing page", () => {
  it.each(LOCALES)("in %s fills every placeholder and leaves no markup in the words", (locale) => {
    const words = text(render(locale));
    expect(words).not.toMatch(/\{(count|days|pages)\}/);
    expect(words).not.toContain("**");
  });

  it.each(LOCALES.filter((l) => l !== "en"))("in %s is translated: no English sentence is left", (locale) => {
    const english = new Set(strings(auditLandingCopy("en")));
    const same = strings(auditLandingCopy(locale)).filter((word) => english.has(word));
    // The address drawn in the sample's browser bar is the same in every language.
    expect(same.filter((word) => word !== "repget.com / audit")).toEqual([]);
  });

  it.each(LOCALES)("in %s keeps the same shape as English", (locale) => {
    const t = auditLandingCopy(locale);
    expect(t.faq.items).toHaveLength(auditLandingCopy("en").faq.items.length);
    expect(strings(t)).toHaveLength(strings(auditLandingCopy("en")).length);
  });

  it.each(LOCALES)("in %s has two real forms, the first being the field every link returns to", (locale) => {
    const html = render(locale);
    expect(html.match(/<form/g)).toHaveLength(2);
    expect(html).toContain(`id="${AUDIT_FIELD_ID}"`);
    const focusLinks = html.match(new RegExp(`href="#${AUDIT_FIELD_ID}"`, "g"));
    expect(focusLinks).toHaveLength(2);
    expect(html.match(/name="website"/g)).toHaveLength(2);
  });

  it.each(LOCALES)("in %s labels the sample as a sample, everywhere it appears", (locale) => {
    const t = auditLandingCopy(locale);
    const words = text(render(locale));
    for (const label of [t.device.label, t.device.pill, t.device.footerRight, t.report.sampleBadge, t.report.navNote, t.report.overview.issuesNote, t.report.seo.cardBody, t.report.ai.cardBody, t.report.under]) {
      expect(words).toContain(label);
    }
  });

  it.each(LOCALES)("in %s renders all four sample panels for the tabs, one open", (locale) => {
    const html = render(locale);
    expect(html.match(/role="tab"/g)).toHaveLength(4);
    expect(html.match(/role="tabpanel"/g)).toHaveLength(4);
    expect(html.match(/aria-selected="true"/g)).toHaveLength(1);
    expect(html.match(/hidden=""/g)).toHaveLength(3);
  });

  it.each(LOCALES)("in %s promises no free backlink, and quotes the real offer: the 3-day trial", (locale) => {
    const t = auditLandingCopy(locale);
    // Backlinks are named only as what paid plans and the plan-starting offer say they are.
    for (const inclusion of t.hero.inclusions) expect(`${inclusion.title} ${inclusion.body}`.toLowerCase()).not.toContain("backlink");
    expect(`${t.hero.includedTitle} ${t.hero.assurances.join(" ")}`.toLowerCase()).not.toContain("backlink");
    const words = text(render(locale));
    expect(words).toContain(t.offer.title[1].replace("{count}", String(TRIAL_DAYS)));
    expect(words).toContain(t.offer.body.replace("{days}", String(TRIAL_DAYS)));
    // Never the free articles the trial replaced (2026-11-13).
    expect(words).not.toMatch(/free articles?|artículos? gratis|articles? gratuits?|articoli gratis|kostenlose[nr]? Artikel/i);
  });

  it.each(LOCALES)("in %s stays in the language wherever the page exists in it", (locale) => {
    for (const [, href] of render(locale).matchAll(/href="([^"#][^"]*)"/g)) {
      if (href.startsWith("/")) expect(href).toBe(localePath(locale, splitLocale(href).path));
    }
  });
});
