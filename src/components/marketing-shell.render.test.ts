import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * The public site's frame declares the address's language around the whole
 * page - banner, header, the page itself and the footer - because the root
 * layout's <html lang="en"> is shared by every route and cannot be told it.
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

import { resolveBannerCopy, type LiveBanner } from "@/lib/promo-banner/banner";

import { MarketingShell } from "./marketing-shell";

function render(pathname: string) {
  nav.pathname = pathname;
  const html = renderToStaticMarkup(createElement(MarketingShell, null, createElement("p", null, "The page")));
  // The header logo's image preloads, which React hoists ahead of the markup (Next puts them in <head>).
  return html.replace(/^(<link [^>]*\/>)+/, "");
}

describe("the marketing frame", () => {
  it("on /es/pricing is one Spanish element around the header, the page and the footer", () => {
    const html = render("/es/pricing");
    expect(html).toMatch(/^<div lang="es" [^>]*>/);
    expect(html.endsWith("</div>")).toBe(true);
    const open = html.indexOf(">") + 1;
    const inside = html.slice(open);
    for (const part of ["<header", "<main", "<footer"]) expect(inside).toContain(part);
    expect(inside).toContain("<p>The page</p>");
    // Apart from the switcher's links (each language's name, in that language), nothing else declares one.
    const withoutSwitcher = html.replace(/<a\s[^>]*hreflang="[^"]+"[^>]*>/gi, "");
    expect(withoutSwitcher.match(/\slang="/g)).toHaveLength(1);
  });

  it("the header's logo is named in Spanish", () => {
    expect(render("/es/pricing")).toContain('aria-label="Inicio de RepGet"');
  });

  it("on an English address is English", () => {
    const html = render("/pricing");
    expect(html).toMatch(/^<div lang="en" [^>]*>/);
    expect(html).toContain('aria-label="RepGet home"');
  });
});

describe("the offer bar above the header (Admin -> Site banner)", () => {
  const banner: LiveBanner = {
    tone: "red",
    endsAt: "2026-11-28T23:59:00.000Z",
    copy: resolveBannerCopy({
      en: { label: "BLACK FRIDAY", message: "Lifetime Premium 67% off", linkText: "" },
      es: { label: "BLACK FRIDAY", message: "Premium de por vida -67%", linkText: "" },
    }),
  };
  const withBanner = (pathname: string) => {
    nav.pathname = pathname;
    // createElement types `children` as a prop; the shell gets them as an argument like everywhere else.
    const Shell = MarketingShell as (props: { banner: LiveBanner; children?: ReactNode }) => ReactNode;
    return renderToStaticMarkup(createElement(Shell, { banner }, createElement("p", null, "The page")));
  };

  it("comes before the header and links to the pricing page in the visitor's language", () => {
    const html = withBanner("/es/blog");
    const bar = html.indexOf('href="/es/pricing"');
    expect(bar).toBeGreaterThan(-1);
    expect(bar).toBeLessThan(html.indexOf("<header"));
    expect(html).toContain('data-tone="red"');
    expect(html).toContain("Premium de por vida -67%");
    expect(html).toContain("Ver precios");
    // The countdown waits for the browser's clock, so the prebuilt page never shows a wrong time.
    expect(html).toContain('aria-hidden="true"');
    expect(html).toMatch(/--<small>D<\/small>/);
  });

  it("where a language has no words of its own, is the English bar, marked as English", () => {
    const html = withBanner("/de/blog");
    const bar = html.match(/<a [^>]*data-tone="red"[^>]*>/)?.[0] ?? "";
    expect(bar).toContain('href="/de/pricing"');
    expect(bar).toContain('lang="en"');
    expect(html).toContain("See pricing");
    expect(html).toMatch(/--<small>S<\/small>/);
    expect(html).not.toContain("Sek");
  });

  it("is absent when none is on", () => {
    nav.pathname = "/pricing";
    expect(renderToStaticMarkup(createElement(MarketingShell, null, createElement("p", null, "The page")))).not.toContain("data-tone");
  });
});
