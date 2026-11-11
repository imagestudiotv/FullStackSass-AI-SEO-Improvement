import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The footer's language switcher on a blog post (client, 2026-11-05): a
 * published translation leads to that same article; any other language leads to
 * its blog and says so. Never a made-up address, a draft or another article.
 */

const state = vi.hoisted(() => ({ pathname: "/", versions: null as Record<string, string> | null }));
vi.mock("next/navigation", () => ({ usePathname: () => state.pathname }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode; [key: string]: unknown }) => createElement("a", { href, ...rest }, children),
}));
vi.mock("@/components/post-languages", () => ({ usePostVersions: () => state.versions }));

import { LanguageSwitcher } from "./language-switcher";

function links() {
  const html = renderToStaticMarkup(createElement(LanguageSwitcher, { label: "Change language" }));
  return Object.fromEntries(
    [...html.matchAll(/<a href="([^"]+)" hrefLang="(\w+)"[^>]*>(.*?)<\/a>/g)].map((match) => [match[2], { href: match[1], text: match[3].replace(/<[^>]+>/g, " | ") }]),
  );
}

beforeEach(() => {
  state.versions = null;
});

describe("on an English post, at its unprefixed address", () => {
  beforeEach(() => {
    state.pathname = "/blog/what-to-fix-first";
  });

  it("leads to the same article where a translation is published, and to the language's blog, labelled, where none is", () => {
    state.versions = { en: "/blog/what-to-fix-first", it: "/it/blog/cosa-sistemare-prima" };
    const menu = links();
    expect(menu.en).toEqual({ href: "/blog/what-to-fix-first", text: "English" });
    expect(menu.it).toEqual({ href: "/it/blog/cosa-sistemare-prima", text: "Italiano" });
    expect(menu.de.href).toBe("/de/blog");
    expect(menu.de.text).toContain("Blog auf Deutsch");
    expect(menu.de.text).toContain("Dieser Artikel ist nicht auf Deutsch verfügbar");
    expect(menu.es.href).toBe("/es/blog");
    expect(menu.fr.href).toBe("/fr/blog");
  });

  it("offers no draft: a language counts only when the page says it is published", () => {
    // postVersions (lib/blog/posts.ts) returns published versions only, so a draft is simply not here.
    state.versions = { en: "/blog/what-to-fix-first" };
    const menu = links();
    for (const locale of ["it", "es", "fr", "de"]) expect(menu[locale].href).toBe(`/${locale}/blog`);
  });

  it("before the page has said which exist (no script, first paint), offers each language's blog and claims nothing about the article", () => {
    const menu = links();
    expect(menu.en.href).toBe("/blog/what-to-fix-first");
    expect(menu.it).toEqual({ href: "/it/blog", text: "Blog in italiano" });
    expect(renderToStaticMarkup(createElement(LanguageSwitcher, { label: "x" }))).not.toContain("non è disponibile");
  });
});

describe("on a translated post", () => {
  it("leads back to the English article, and marks the language being read", () => {
    state.pathname = "/de/blog/was-zuerst-beheben";
    state.versions = { en: "/blog/what-to-fix-first", de: "/de/blog/was-zuerst-beheben" };
    const menu = links();
    expect(menu.en.href).toBe("/blog/what-to-fix-first");
    expect(menu.de.href).toBe("/de/blog/was-zuerst-beheben");
    expect(renderToStaticMarkup(createElement(LanguageSwitcher, { label: "x" }))).toMatch(/lang="de" aria-current="true"/);
  });

  it("with no English version, offers the English blog, labelled", () => {
    state.pathname = "/it/blog/solo-italiano";
    state.versions = { it: "/it/blog/solo-italiano" };
    const menu = links();
    expect(menu.en.href).toBe("/blog");
    expect(menu.en.text).toContain("This article is not available in English");
  });
});

describe("elsewhere", () => {
  it("keeps the reader on a translated page, as before", () => {
    state.pathname = "/pricing";
    const menu = links();
    expect(menu.it).toEqual({ href: "/it/pricing", text: "Italiano" });
    state.pathname = "/blog";
    expect(links().de).toEqual({ href: "/de/blog", text: "Deutsch" });
  });

  it.each(["/privacy", "/blog/category/guides", "/blog/sponsorship/thanks", "/blog/category", "/blog/author"])("is absent on %s, as before: no address is invented for it", (path) => {
    state.pathname = path;
    expect(renderToStaticMarkup(createElement(LanguageSwitcher, { label: "x" }))).toBe("");
  });
});

describe("on a business profile (/discover/<slug>)", () => {
  it("leads to the same profile in each language: the address is the same everywhere", () => {
    state.pathname = "/it/discover/image-studio";
    const menu = links();
    expect(menu.en).toEqual({ href: "/discover/image-studio", text: "English" });
    expect(menu.it.href).toBe("/it/discover/image-studio");
    expect(menu.de.href).toBe("/de/discover/image-studio");
  });
});
