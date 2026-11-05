import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { LOCALES, localePath } from "@/lib/i18n/config";
import { format } from "@/lib/i18n/format";
import { finalCtaCopy } from "@/lib/i18n/home/final-cta";

/**
 * The closing banner's button states the real offer (client, 2026-11-05), with
 * its number from the configuration: here 7, so a number typed into the words
 * would show. The rest of the banner goes where it went.
 */

vi.mock("@/lib/plans/features", async (original) => ({ ...(await original<typeof import("@/lib/plans/features")>()), FREE_ARTICLES: 7 }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => createElement("a", { href }, children),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { FinalCta } from "./final-cta";

const render = (locale: (typeof LOCALES)[number]) => renderToStaticMarkup(createElement(FinalCta, { locale, href: (path: string) => localePath(locale, path) }));
const button = (html: string) => /<button[^>]*type="submit"[^>]*>(.*?)<\/button>/.exec(html)?.[1].replace(/<[^>]+>/g, "").trim() ?? "";

const OFFER: Record<(typeof LOCALES)[number], string> = {
  en: "Create 7 free articles",
  es: "Crear 7 artículos gratis",
  fr: "Créer 7 articles gratuits",
  it: "Crei 7 articoli gratis",
  de: "7 Artikel gratis erstellen",
};

describe("the closing banner's button", () => {
  it.each(LOCALES)("%s: says the configured number of free articles, and nothing about a trial", (locale) => {
    const html = render(locale);
    expect(button(html)).toContain(OFFER[locale]);
    expect(html).not.toContain("{n}");
    expect(button(html)).not.toMatch(/trial|prueba|essai|prova|testen/i);
    expect(finalCtaCopy(locale).form.submit).toContain("{n}");
    expect(format(finalCtaCopy(locale).form.submit, { n: 3 })).toMatch(/3/);
  });

  it.each(LOCALES)("%s: still leads to the same places", (locale) => {
    const html = render(locale);
    expect(html).toContain(`href="${localePath(locale, "/audit")}"`);
    expect(html).toContain(`href="${localePath(locale, "/sign-up")}"`);
  });

  it("leaves the support line as it is: its wording is waiting for a review", () => {
    expect(finalCtaCopy("en").points).toContain("24/7 human support");
  });
});
