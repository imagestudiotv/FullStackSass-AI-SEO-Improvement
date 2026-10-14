import { createElement, type ComponentProps, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { getMessages } from "@/lib/i18n/messages";
import { getIntegrationDoc } from "@/lib/publishing/docs";
import type { BlogPost } from "@/lib/blog/shared";

/**
 * What only a screen reader hears on the translated pages - the breadcrumb's
 * name and the blog's page links - in the page's language. They were English
 * on every page; English pages keep their words.
 */

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode; [key: string]: unknown }) =>
    createElement("a", { href, ...rest }, children),
}));
vi.mock("@/app/(marketing)/home-sections", () => ({ ClosingCta: () => null }));
vi.mock("@/components/post-cover", () => ({ PostCover: () => null }));

import { BlogPagination } from "@/components/blog-pagination";
import { ToolHero } from "@/components/tool-page";

import { BlogPostView } from "./blog/post-view";
import { Guide, GuidesIndex } from "./docs/integrations/guide-pages";

/** The aria-label of the page's breadcrumb trail (the nav holding the Home link). */
function breadcrumbLabel(html: string): string | undefined {
  return /<nav aria-label="([^"]+)"[^>]*>(?:<span[^>]*>)?<a /.exec(html)?.[1];
}

/** "Fil d’Ariane" and friends, as static markup escapes them. */
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");

describe("the breadcrumb's name", () => {
  it("on a German tool page is German, and English on the English one", () => {
    const render = (locale: "de" | "en") =>
      renderToStaticMarkup(
        // children arrive as the third argument; the cast covers the props object without them.
        createElement(ToolHero, { title: "Robots.txt", description: "", locale } as ComponentProps<typeof ToolHero>, null),
      );
    expect(getMessages("de").app.editor.breadcrumbLabel).toBe("Brotkrümelnavigation");
    expect(breadcrumbLabel(render("de"))).toBe("Brotkrümelnavigation");
    expect(breadcrumbLabel(render("en"))).toBe("Breadcrumb");
  });

  it("on the French integration guides is French, and English on the English ones", () => {
    const french = esc(getMessages("fr").app.editor.breadcrumbLabel);
    expect(french).toMatch(/^Fil d/);
    const doc = getIntegrationDoc("ghost", "fr")!;
    expect(breadcrumbLabel(renderToStaticMarkup(createElement(Guide, { doc, locale: "fr" })))).toBe(french);
    expect(breadcrumbLabel(renderToStaticMarkup(createElement(GuidesIndex, { locale: "fr" })))).toBe(french);
    const english = renderToStaticMarkup(createElement(Guide, { doc: getIntegrationDoc("ghost")!, locale: "en" }));
    expect(breadcrumbLabel(english)).toBe("Breadcrumb");
  });

  it("on an Italian blog post is Italian, with the formal 'keep reading'; English on an English post", () => {
    const post: BlogPost = {
      slug: "esempio",
      title: "Un articolo di prova",
      description: "Una descrizione.",
      category: "Guides",
      categorySlug: "guides",
      publishedAt: "2026-10-08",
      readingMinutes: 1,
      author: "RepGet team",
      body: "<p>Testo.</p>",
      locale: "it",
    };
    const related = [{ ...post, slug: "altro", title: "Un altro articolo" }];
    const italian = renderToStaticMarkup(createElement(BlogPostView, { post, versions: [], related }));
    expect(breadcrumbLabel(italian)).toBe("Percorso di navigazione");
    expect(italian).toContain('aria-label="Continui a leggere"');
    const english = renderToStaticMarkup(createElement(BlogPostView, { post: { ...post, locale: "en" }, versions: [], related: [] }));
    expect(breadcrumbLabel(english)).toBe("Breadcrumb");
  });
});

describe("the blog's page links", () => {
  it("on the Italian blog are Italian", () => {
    const html = renderToStaticMarkup(createElement(BlogPagination, { page: 2, total: 90, path: "/it/blog", locale: "it" }));
    expect(html).toContain('<nav aria-label="Pagine"');
    expect(html).toMatch(/<a href="\/it\/blog" rel="prev"[^>]*>.*?Più recenti<\/a>/);
    expect(html).toMatch(/<a href="\/it\/blog\?page=3" rel="next"[^>]*>Meno recenti/);
    expect([...html.matchAll(/aria-label="(Pagina \d+)"/g)].map((match) => match[1])).toEqual(["Pagina 1", "Pagina 2", "Pagina 3"]);
    expect(html).toContain("Pagina 2 di 3");
    expect(html).not.toMatch(/Newer|Older|Page \d/);
  });

  it("stay English where no language is given (the English listings)", () => {
    const html = renderToStaticMarkup(createElement(BlogPagination, { page: 2, total: 90, path: "/blog" }));
    expect(html).toContain('<nav aria-label="Blog pages"');
    expect(html).toContain("Newer");
    expect(html).toContain("Older");
    expect(html).toContain('aria-label="Page 3"');
    expect(html).toContain("Page 2 of 3");
  });
});
