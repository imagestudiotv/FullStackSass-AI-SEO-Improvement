import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { BLOG_CHROME } from "@/lib/blog/locale";
import type { BlogCategoryInfo, BlogPost } from "@/lib/blog/shared";

/**
 * Categories on every language's blog (client, 2026-10-15): /it/blog shows
 * its categories under their Italian names with Italian counts, an Italian
 * post's card and breadcrumb name its category in Italian and lead to
 * /it/blog/category/<slug>, and that page lists the Italian posts - or, with
 * none yet, says so, shows the English ones and keeps itself out of search
 * results.
 */

const { CATEGORIES, POSTS, state } = vi.hoisted(() => {
  const CATEGORIES = [
    {
      name: "Guides",
      slug: "guides",
      blurb: "Plain-English explanations of how search and AI assistants actually work.",
      translations: { it: { name: "Guide", blurb: "Spiegazioni chiare su come funzionano davvero i motori di ricerca e gli assistenti IA." } },
    },
    {
      name: "Playbooks",
      slug: "playbooks",
      blurb: "Step-by-step work you can do this week, in the order to do it.",
      translations: { it: { name: "Strategie", blurb: "Attività SEO passo dopo passo da svolgere questa settimana, nell’ordine giusto." } },
    },
  ];
  const base = { publishedAt: "2026-10-15", author: "RepGet team", readingMinutes: 5, body: "<p>Testo.</p>", description: "Descrizione." };
  const POSTS = {
    italian: { ...base, slug: "sito-non-compare-su-google", title: "Il tuo sito non compare su Google?", category: "Playbooks", categoryLabel: "Strategie", categorySlug: "playbooks", locale: "it" as const },
    english: { ...base, slug: "keyword-cannibalization", title: "Keyword cannibalization", category: "Guides", categoryLabel: "Guides", categorySlug: "guides", locale: "en" as const },
  };
  /** What the database holds for a test: the published posts in each language, and the languages each category has posts in. */
  const state = { posts: {} as Record<string, unknown[]>, locales: {} as Record<string, string[]> };
  return { CATEGORIES, POSTS, state };
});

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode; [key: string]: unknown }) =>
    createElement("a", { href, ...rest }, children),
}));
vi.mock("@/app/(marketing)/home-sections", () => ({ ClosingCta: () => null }));
vi.mock("@/components/post-cover", () => ({ PostCover: () => null }));
// The database's readers only; the hreflang rule (lib/blog/locale.ts) is the real one.
vi.mock("@/lib/blog/categories", () => ({
  listCategories: async () => CATEGORIES,
  categoryBySlug: async (slug: string) => CATEGORIES.find((category) => category.slug === slug) ?? null,
}));
vi.mock("@/lib/blog/posts", async () => {
  // Pages of the real size, in the order given: page 2 starts at the 31st post.
  const { BLOG_PAGE_SIZE: size } = await import("@/lib/blog/pagination");
  const published = (locale = "en") => (state.posts[locale] ?? []) as { category: string }[];
  return {
    listPostPage: async (page: number, filter: { locale?: string; category?: string } = {}) => {
      const posts = published(filter.locale).filter((post) => !filter.category || post.category === filter.category);
      return { posts: posts.slice((page - 1) * size, page * size), total: posts.length };
    },
    publishedCategoryCounts: async (locale = "en") => {
      const counts: Record<string, number> = {};
      for (const post of published(locale)) counts[post.category] = (counts[post.category] ?? 0) + 1;
      return counts;
    },
    publishedCategoryLocales: async (category: string) => state.locales[category] ?? [],
  };
});

import { PostCard } from "@/components/post-card";
import { BLOG_PAGE_SIZE } from "@/lib/blog/pagination";

import LocaleBlogCategoryPage, { generateMetadata as localeCategoryMetadata } from "../[locale]/blog/category/[category]/page";
import LocaleBlogIndexPage from "../[locale]/blog/page";
import { generateMetadata as englishCategoryMetadata } from "./category/[category]/page";
import { CategoryChips } from "./category-chips";
import { BlogPostView } from "./post-view";

beforeAll(() => vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.repget.com"));
afterAll(() => vi.unstubAllEnvs());
beforeEach(() => {
  state.posts = { en: [POSTS.english], it: [POSTS.italian] };
  state.locales = { Playbooks: ["it"], Guides: ["en"] };
});

const props = (locale: string, category: string, page?: string) => ({
  params: Promise.resolve({ locale, category }),
  searchParams: Promise.resolve(page ? { page } : {}),
});

/** Static markup escapes the apostrophe in "nell’ordine" no further: only quotes and ampersands. */
const html = (node: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(node);

describe("a post's card", () => {
  it("names an Italian post's category in Italian and leads to the Italian category page", () => {
    const card = html(createElement(PostCard, { post: POSTS.italian as BlogPost }));
    expect(card).toContain('href="/it/blog/category/playbooks"');
    expect(card).toMatch(/<a [^>]*href="\/it\/blog\/category\/playbooks"[^>]*>Strategie<\/a>/);
  });

  it("an English post's stays as it was", () => {
    const card = html(createElement(PostCard, { post: POSTS.english as BlogPost }));
    expect(card).toMatch(/<a [^>]*href="\/blog\/category\/guides"[^>]*>Guides<\/a>/);
  });
});

describe("a blog front page's categories", () => {
  it("in Italian: Italian names, Italian counts, Italian pages, and none with nothing in Italian", () => {
    const chips = html(createElement(CategoryChips, { categories: CATEGORIES as BlogCategoryInfo[], counts: { Playbooks: 1 }, locale: "it" }));
    expect(chips).toMatch(/href="\/it\/blog\/category\/playbooks"[^>]*>Strategie<span[^>]*>1<\/span>/);
    expect(chips).not.toContain("guides");
  });

  it("in English, unchanged", () => {
    const chips = html(createElement(CategoryChips, { categories: CATEGORIES as BlogCategoryInfo[], counts: { Guides: 4, Playbooks: 5 }, locale: "en" }));
    expect(chips).toMatch(/href="\/blog\/category\/guides"[^>]*>Guides<span[^>]*>4<\/span>/);
    expect(chips).toMatch(/href="\/blog\/category\/playbooks"[^>]*>Playbooks<span[^>]*>5<\/span>/);
  });

  it("nothing at all when no category has a post in the language", () => {
    expect(html(createElement(CategoryChips, { categories: CATEGORIES as BlogCategoryInfo[], counts: {}, locale: "de" }))).toBe("");
  });

  it("are on /it/blog under its heading", async () => {
    const page = html(await LocaleBlogIndexPage({ params: Promise.resolve({ locale: "it" }), searchParams: Promise.resolve({}) }));
    expect(page).toMatch(/href="\/it\/blog\/category\/playbooks"[^>]*>Strategie<span[^>]*>1<\/span>/);
  });
});

describe("an Italian post's page", () => {
  it("has its category in the breadcrumb, in Italian, linked to the Italian category page - and in its structured data", () => {
    const page = html(createElement(BlogPostView, { post: POSTS.italian as BlogPost, versions: [], related: [] }));
    expect(page).toMatch(/<a href="\/it\/blog\/category\/playbooks"[^>]*>Strategie<\/a>/);
    expect(page).toContain('"name":"Strategie","item":"https://www.repget.com/it/blog/category/playbooks"');
    expect(page).toContain('"articleSection":"Strategie"');
  });

  it("an English post's breadcrumb is as it was", () => {
    const page = html(createElement(BlogPostView, { post: POSTS.english as BlogPost, versions: [], related: [] }));
    expect(page).toMatch(/<a href="\/blog\/category\/guides"[^>]*>Guides<\/a>/);
    expect(page).toContain('"articleSection":"Guides"');
  });
});

describe("/it/blog/category/<slug>", () => {
  it("lists the Italian posts under the Italian name and description", async () => {
    const page = html(await LocaleBlogCategoryPage(props("it", "playbooks")));
    expect(page).toMatch(/<h1[^>]*>Strategie<\/h1>/);
    expect(page).toContain("Attività SEO passo dopo passo");
    expect(page).toContain('href="/it/blog/sito-non-compare-su-google"');
    expect(page).not.toContain(BLOG_CHROME.it.sectionEmpty);
    // The trail: Home, Blog, the category - in Italian, as links then the current page.
    expect(page).toMatch(/<a href="\/it"[^>]*>Home<\/a>[\s\S]*<a href="\/it\/blog"[^>]*>Blog<\/a>[\s\S]*<span class="text-foreground">Strategie<\/span>/);
    expect(page).toContain('"name":"Strategie","item":"https://www.repget.com/it/blog/category/playbooks"');
  });

  it("is titled and described in Italian, with its own address, and indexable", async () => {
    const metadata = await localeCategoryMetadata(props("it", "playbooks"));
    expect(metadata.title).toBe("Strategie");
    expect(metadata.description).toBe(CATEGORIES[1].translations.it.blurb);
    expect(metadata.alternates?.canonical).toBe("/it/blog/category/playbooks");
    expect(metadata.openGraph?.url).toBe("/it/blog/category/playbooks");
    expect(metadata.robots).toBeUndefined();
  });

  it("from page 2 on: its own Italian title, description and address, and Italian page links", async () => {
    // One Italian post in Playbooks more than a page holds: page 2 has the last one.
    state.posts.it = Array.from({ length: BLOG_PAGE_SIZE + 1 }, (_, i) => ({ ...POSTS.italian, slug: `strategia-${i + 1}` }));

    const metadata = await localeCategoryMetadata(props("it", "playbooks", "2"));
    expect(metadata.title).toBe(`Strategie — ${BLOG_CHROME.it.pageN.replace("{page}", "2")}`);
    expect(metadata.description).toBe(`${CATEGORIES[1].translations.it.blurb.replace(/\.$/, "")} — Pagina 2.`);
    expect(metadata.alternates?.canonical).toBe("/it/blog/category/playbooks?page=2");

    const page = html(await LocaleBlogCategoryPage(props("it", "playbooks", "2")));
    expect(page).toContain(`href="/it/blog/strategia-${BLOG_PAGE_SIZE + 1}"`);
    expect(page).not.toContain('href="/it/blog/strategia-1"');
    // Back to page 1 of the Italian category, in Italian.
    expect(page).toMatch(new RegExp(`<a href="/it/blog/category/playbooks" rel="prev"[^>]*>[\\s\\S]*?${BLOG_CHROME.it.newer}</a>`));
  });

  it("links its other languages with hreflang - only the ones with posts in it", async () => {
    state.locales = { Playbooks: ["en", "it"] };
    expect((await localeCategoryMetadata(props("it", "playbooks"))).alternates?.languages).toEqual({
      en: "/blog/category/playbooks",
      it: "/it/blog/category/playbooks",
      "x-default": "/blog/category/playbooks",
    });
    // The English page lists the same set.
    expect((await englishCategoryMetadata(props("en", "playbooks") as never)).alternates?.languages).toEqual({
      en: "/blog/category/playbooks",
      it: "/it/blog/category/playbooks",
      "x-default": "/blog/category/playbooks",
    });
    // Page 2 is outside the set, like the blog's own.
    expect((await localeCategoryMetadata(props("it", "playbooks", "2"))).alternates?.languages).toBeUndefined();

    state.locales = { Playbooks: ["it"] };
    expect((await localeCategoryMetadata(props("it", "playbooks"))).alternates?.languages).toBeUndefined();
    expect((await englishCategoryMetadata(props("en", "playbooks") as never)).alternates?.languages).toBeUndefined();
  });

  it("with nothing in Italian yet: says so in Italian, shows the English ones, and is not for search engines", async () => {
    // Guides: English posts only.
    const page = html(await LocaleBlogCategoryPage(props("it", "guides")));
    expect(page).toMatch(/<h1[^>]*>Guide<\/h1>/);
    expect(page).toContain(BLOG_CHROME.it.sectionEmpty);
    expect(page).toContain(BLOG_CHROME.it.inEnglish);
    expect(page).toMatch(/<ul [^>]*lang="en"[^>]*>[\s\S]*href="\/blog\/keyword-cannibalization"/);
    // The link to the whole English category - not the English card's category chip, which has the same address.
    expect(page).toMatch(new RegExp(`<a href="/blog/category/guides"[^>]*>${BLOG_CHROME.it.readInEnglish}</a>`));

    const metadata = await localeCategoryMetadata(props("it", "guides"));
    expect(metadata.robots).toEqual({ index: false, follow: true });
    expect(metadata.alternates?.languages).toBeUndefined();
  });

  it("a language without a translation shows the English name and description", async () => {
    state.locales = { Playbooks: ["de"] };
    const metadata = await localeCategoryMetadata(props("de", "playbooks"));
    expect(metadata.title).toBe("Playbooks");
    expect(metadata.description).toBe(CATEGORIES[1].blurb);
  });

  it("is a 404 for an unknown category, for English under a prefix, for a language the site does not have, and past the last page", async () => {
    // notFound() throws this; any other failure would be a different error.
    const notFound = /NEXT_HTTP_ERROR_FALLBACK;404/;
    await expect(LocaleBlogCategoryPage(props("it", "no-such-category"))).rejects.toThrow(notFound);
    await expect(LocaleBlogCategoryPage(props("en", "playbooks"))).rejects.toThrow(notFound);
    await expect(LocaleBlogCategoryPage(props("xx", "playbooks"))).rejects.toThrow(notFound);
    await expect(LocaleBlogCategoryPage(props("it", "playbooks", "2"))).rejects.toThrow(notFound);
  });
});
