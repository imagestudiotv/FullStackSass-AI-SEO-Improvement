import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { getIntegrationDoc } from "@/lib/publishing/docs";

/**
 * The integration guides' pages in another language: their words, and links
 * that stay in that language (client, 2026-10-13).
 */

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode; [key: string]: unknown }) =>
    createElement("a", { href, ...rest }, children),
}));

import { Guide, GuidesIndex } from "./guide-pages";

describe("the guides index", () => {
  it("in Italian: Italian words, and every guide linked in Italian", () => {
    const html = renderToStaticMarkup(createElement(GuidesIndex, { locale: "it" }));
    expect(html).toContain("Colleghi il suo sito");
    expect(html).toContain('href="/it/docs/integrations/wordpress-plugin"');
    expect(html).toContain('href="/it/docs/integrations/webhook"');
    expect(html).toContain('href="/it"');
    expect(html).not.toContain('href="/docs/');
  });

  it("in English: unchanged addresses", () => {
    const html = renderToStaticMarkup(createElement(GuidesIndex, { locale: "en" }));
    expect(html).toContain("Connect your website");
    expect(html).toContain('href="/docs/integrations/ghost"');
  });
});

describe("one guide", () => {
  it("in German: the title, the note about Ghost's English admin, and the button the app shows", () => {
    const doc = getIntegrationDoc("ghost", "de")!;
    const html = renderToStaticMarkup(createElement(Guide, { doc, locale: "de" }));
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(html).toContain("Ghost verbinden");
    expect(html).toContain("englischen Oberfläche");
    expect(html).toContain('<span class="font-medium text-foreground">Testartikel veröffentlichen</span>');
    expect(html).toContain('href="/de/docs/integrations"');
    expect(html).not.toContain("{name}");
    expect(html).not.toContain("{button}");
    // The breadcrumb's structured data names the same pages, at their German addresses.
    expect(html).toContain("/de/docs/integrations/ghost");
  });

  it("in English: no note, as before", () => {
    const html = renderToStaticMarkup(createElement(Guide, { doc: getIntegrationDoc("ghost")!, locale: "en" }));
    expect(html).toContain("Connect Ghost");
    expect(html).not.toContain("English interface");
  });
});
