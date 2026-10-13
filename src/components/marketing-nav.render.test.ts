import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { PREFIXED_LOCALES, TRANSLATED_PATHS } from "@/lib/i18n/config";
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

import { BrandHomeLink } from "./brand-home-link";
import { MarketingFooterLinks, MarketingNav } from "./marketing-nav";

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
