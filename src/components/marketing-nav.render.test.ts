import { createElement, type ComponentProps, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { LOCALES, PREFIXED_LOCALES, TRANSLATED_PATHS } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";
import { siteChrome } from "@/lib/i18n/site-chrome";

/**
 * The public menu and footer keep a visitor in their language: on /de, every
 * link to a page that exists in German goes to the German page. The desktop
 * menu sent Success stories, Blog and Contact to the English pages (client,
 * 2026-10-13: "translated pages ... are missing").
 */

const nav = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname, useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode; [key: string]: unknown }) =>
    createElement("a", { href, ...rest }, children),
}));
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => createElement("img", { src, alt }),
}));
/*
  Radix portals the sheet and draws nothing on the server, so the phone menu's
  sheet is a plain element here: what it is given is what this checks.
*/
vi.mock("@/components/ui/sheet", () => {
  const plain = ({ children }: { children?: ReactNode }) => createElement("div", null, children);
  return {
    Sheet: plain,
    SheetHeader: plain,
    SheetTitle: plain,
    SheetContent: ({ children, lang, closeLabel }: { children?: ReactNode; lang?: string; closeLabel?: string }) =>
      createElement("div", { "data-slot": "sheet-content", lang }, children, createElement("span", { className: "sr-only" }, closeLabel)),
  };
});

import { BrandHomeLink } from "./brand-home-link";
import { MarketingFooterLinks, MarketingFrame, MarketingNav, MarketingTagline } from "./marketing-nav";
import { MobileNavSheet } from "./mobile-nav-sheet";

const hrefs = (html: string) => [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);

describe.each(PREFIXED_LOCALES)("on the %s pages", (locale) => {
  const chrome = siteChrome();

  it.each([
    ["menu", MarketingNav],
    ["footer", MarketingFooterLinks],
  ] as const)("the %s links to the translated version of every translated page", (_, Component) => {
    nav.pathname = `/${locale}`;
    const links = hrefs(renderToStaticMarkup(createElement(Component, { chrome })));
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      const path = link.split(/[?#]/)[0] || "/";
      if (!path.startsWith("/") || path.startsWith(`/${locale}`)) continue;
      // An unprefixed link is only right for a page that has no translation.
      expect(TRANSLATED_PATHS.has(path), `${link} on /${locale} should be /${locale}${path === "/" ? "" : path}`).toBe(false);
    }
  });
});

describe("the header logo", () => {
  it.each([
    ["/", "/"],
    ["/pricing", "/"],
    ["/tools", "/"],
    ["/de", "/de"],
    ["/es/pricing", "/es"],
    ["/it/blog/some-post", "/it"],
  ])("on %s goes to the homepage in that language (%s)", (pathname, home) => {
    nav.pathname = pathname;
    const html = renderToStaticMarkup(createElement(BrandHomeLink, null, "RepGet"));
    expect(hrefs(html)).toEqual([home]);
  });
});

/**
 * The page's language. The root layout's <html lang="en"> is shared by every
 * route, so the frame around the public pages says which language the
 * address is in - from the same source as the menu's words.
 */
describe("the frame's language", () => {
  it.each([
    ["/", "en"],
    ["/pricing", "en"],
    // The name the cached home page is regenerated under (lib/i18n/config.ts).
    ["/index", "en"],
    ["/_not-found", "en"],
    ["/xx", "en"],
    ["/es", "es"],
    ["/es/index", "es"],
    ["/fr/pricing", "fr"],
    ["/it/blog/some-post", "it"],
    ["/de/tools/robots-checker", "de"],
  ])("on %s is %s", (pathname, lang) => {
    nav.pathname = pathname;
    // children arrive as the third argument; the cast covers the props object without them.
    const html = renderToStaticMarkup(createElement(MarketingFrame, { className: "frame" } as ComponentProps<typeof MarketingFrame>, "page"));
    expect(html).toBe(`<div lang="${lang}" class="frame">page</div>`);
  });
});

describe("the language switcher", () => {
  it("names each language in its own language, and its button in the page's", () => {
    nav.pathname = "/es/pricing";
    const html = renderToStaticMarkup(createElement(MarketingTagline, { chrome: siteChrome() }));
    expect(html).toMatch(new RegExp(`<summary aria-label="${getMessages("es").app.common.changeLanguage}"`));
    const links = [...html.matchAll(/<a\s[^>]*>/g)].map((match) => match[0]);
    expect(links).toHaveLength(LOCALES.length);
    for (const locale of LOCALES) {
      // hreflang as React writes it (hrefLang), and lang as its own attribute, not the tail of hreflang.
      const matching = links.filter(
        (link) => new RegExp(`\\shreflang="${locale}"`, "i").test(link) && new RegExp(`\\slang="${locale}"`).test(link),
      );
      expect(matching, locale).toHaveLength(1);
    }
  });

  it("keeps the English name on English pages", () => {
    nav.pathname = "/pricing";
    expect(renderToStaticMarkup(createElement(MarketingTagline, { chrome: siteChrome() }))).toContain('aria-label="Change language"');
  });
});

/** What only a screen reader hears in the header: in the page's language too. */
describe("the header's screen-reader labels", () => {
  const chrome = siteChrome();
  const homeLabels = Object.fromEntries(Object.entries(chrome).map(([locale, words]) => [locale, words.a11y.brandHome]));

  it.each([
    ["/", "en", "Open menu", "RepGet home"],
    ["/pricing", "en", "Open menu", "RepGet home"],
    ["/es/pricing", "es", "Abrir menú", "Inicio de RepGet"],
    ["/it/blog", "it", "Apri il menu", "Home di RepGet"],
  ] as const)("on %s are in %s", (pathname, locale, openMenu, brandHome) => {
    nav.pathname = pathname;
    expect(getMessages(locale).app.common.openMenu).toBe(openMenu);
    expect(getMessages(locale).app.common.brandHome).toBe(brandHome);
    expect(renderToStaticMarkup(createElement(MarketingNav, { chrome }))).toContain(`aria-label="${openMenu}"`);
    const logo = renderToStaticMarkup(createElement(BrandHomeLink, { labels: homeLabels } as ComponentProps<typeof BrandHomeLink>, "RepGet"));
    expect(logo).toContain(`aria-label="${brandHome}"`);
  });

  it.each([
    ["/", "Dark mode"],
    ["/es/pricing", "Modo oscuro"],
    ["/fr/blog", "Mode sombre"],
    ["/it/blog", "Modalità scura"],
    ["/de", "Dunkelmodus"],
  ] as const)("the night mode button on %s is named %s, in the header and the footer, and starts light", (pathname, label) => {
    nav.pathname = pathname;
    for (const Component of [MarketingNav, MarketingTagline]) {
      const html = renderToStaticMarkup(createElement(Component, { chrome }));
      expect(html).toContain(`aria-label="${label}" aria-pressed="false" title="${label}"`);
    }
  });

  it("the logo stays English for a caller that passes no labels", () => {
    nav.pathname = "/de";
    expect(renderToStaticMarkup(createElement(BrandHomeLink, null, "RepGet"))).toContain('aria-label="RepGet home"');
  });

  it("the phone menu's sheet, portaled outside the frame, declares its language and closes in it", () => {
    const html = renderToStaticMarkup(
      createElement(MobileNavSheet, {
        open: true,
        onOpenChange: () => {},
        returnFocusTo: { current: null },
        lang: "it",
        closeLabel: chrome.it.a11y.close,
        heading: chrome.it.nav.platformHeading,
        platform: [],
        links: [{ href: "/it/pricing", label: chrome.it.nav.pricing }],
      }),
    );
    expect(html).toContain('<div data-slot="sheet-content" lang="it">');
    expect(html).toContain(`<span class="sr-only">${getMessages("it").app.common.close}</span>`);
    expect(getMessages("it").app.common.close).toBe("Chiudi");
  });
});
