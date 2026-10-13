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
