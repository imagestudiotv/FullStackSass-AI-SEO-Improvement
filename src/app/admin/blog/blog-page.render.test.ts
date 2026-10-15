import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * Admin -> Blog, one language at a time (client, 2026-10-15: "add separate
 * language tabs: English | Italian | ... so I can access the blogs from all
 * languages at once"). The posts and categories are replaced with fixtures.
 */

const state = vi.hoisted(() => ({ query: "", editorProps: null as unknown }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/admin/blog",
  useSearchParams: () => new URLSearchParams(state.query),
}));
// Radix draws a closed menu's items nowhere on the server: plain elements show what the menu is given.
vi.mock("@/components/ui/dropdown-menu", () => {
  const plain = ({ children }: { children?: ReactNode }) => createElement("div", null, children);
  return { DropdownMenu: plain, DropdownMenuTrigger: plain, DropdownMenuContent: plain, DropdownMenuItem: plain, DropdownMenuLabel: plain };
});
vi.mock("./blog-categories", () => ({ BlogCategories: () => null }));
vi.mock("./blog-post-editor", () => ({
  BlogPostEditor: (props: unknown) => {
    state.editorProps = props;
    return null;
  },
}));
vi.mock("@/lib/admin/guard", () => ({ requireAdmin: async () => ({ email: "admin@repget.test" }) }));
vi.mock("@/lib/blog/categories", () => ({ listCategories: async () => [] }));
vi.mock("@/lib/admin/blog-sponsorships", () => ({ placementsToReview: async () => 0 }));

const { POSTS, CATEGORIES } = vi.hoisted(() => {
  const at = new Date("2026-10-15T10:00:00Z");
  const row = (id: string, locale: string, title: string, category: string, status: string, extra: Record<string, unknown> = {}) => ({
    id,
    title,
    slug: title.toLowerCase().replace(/[^a-z]+/g, "-"),
    category,
    status,
    publishedAt: status === "published" ? at : null,
    updatedAt: at,
    updatedBy: "admin@repget.test",
    locale,
    translationOf: null,
    needsReview: false,
    ...extra,
  });
  const category = (id: string, name: string, slug: string, it?: string) => ({
    id,
    name,
    slug,
    blurb: "",
    translations: it ? { it: { name: it, blurb: "" } } : {},
    posts: 1,
  });
  return {
    POSTS: [
      row("e1", "en", "How to get cited by ChatGPT", "Guides", "published"),
      row("e2", "en", "Keyword cannibalization", "Playbooks", "draft"),
      row("i1", "it", "Come farsi citare da ChatGPT", "Guides", "published", { translationOf: "e1" }),
      row("i2", "it", "Il tuo sito non compare su Google", "Playbooks", "draft", { translationOf: "e2", needsReview: true }),
      row("i3", "it", "SEO locale per ristoranti", "Local SEO", "published"),
      row("i4", "it", "Confronto tra strumenti SEO", "Comparisons", "published"),
    ],
    CATEGORIES: [
      category("c1", "Guides", "guides", "Guide"),
      category("c2", "Playbooks", "playbooks", "Strategie"),
      // An address that is not just the name in lower case.
      category("c3", "Local SEO", "local-seo", "SEO locale"),
      // No Italian name yet: shown in English.
      category("c4", "Comparisons", "comparisons"),
      // A category may be called "All": its address must not read as "no filter".
      category("c5", "All", "all"),
    ],
  };
});
vi.mock("@/lib/admin/blog", () => ({
  listBlogPostsAdmin: async () => POSTS,
  listBlogCategoriesAdmin: async () => CATEGORIES,
}));

import AdminBlogPage, { generateMetadata } from "./page";
import AdminNewBlogPostPage from "./new/page";

type Params = Record<string, string | string[]>;

async function render(params: Params = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) for (const entry of [value].flat()) query.append(key, entry);
  state.query = query.toString();
  return renderToStaticMarkup(await AdminBlogPage({ searchParams: Promise.resolve(params) }));
}

/** The language tabs, and each tab's link. */
const tabs = (html: string) => /<nav aria-labelledby="blog-language"[\s\S]*?<\/nav>/.exec(html)?.[0] ?? "";
const tab = (html: string, href: string) => tabs(html).split("<a ").find((link) => link.includes(`href="${href}"`)) ?? "";
/** What "Add language" offers: the links after its button. */
const addable = (html: string) => {
  const menu = html.slice(html.indexOf("Add language"), html.indexOf('aria-labelledby="posts-title"'));
  return [...menu.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
};
/** The post titles listed, in order. */
const titles = (html: string) => [...html.matchAll(/<a [^>]*href="\/admin\/blog\/[ei]\d"[^>]*>([^<]+)<\/a>/g)].map((match) => match[1]);
const CLEAR_FILTERS = /<a [^>]*href="\/admin\/blog\?lang=it"[^>]*>Clear filters<\/a>/;

describe("the language tabs", () => {
  it("has a tab for English and each language with posts, with counts, English chosen", async () => {
    const html = await render();
    expect([...tabs(html).matchAll(/href="([^"]+)"/g)].map((match) => match[1])).toEqual(["/admin/blog", "/admin/blog?lang=it"]);
    expect(tab(html, "/admin/blog")).toContain('aria-current="page"');
    expect(tab(html, "/admin/blog?lang=it")).not.toContain("aria-current");
    expect(tab(html, "/admin/blog?lang=it")).toContain('<span lang="it">Italiano</span>');
    expect(tab(html, "/admin/blog?lang=it")).toMatch(/>4<span class="sr-only"> posts<\/span>/);
    // The site's other languages are a click away.
    expect(addable(html)).toEqual(["/admin/blog?lang=es", "/admin/blog?lang=fr", "/admin/blog?lang=de"]);
    expect(html).toContain("It stays once a post is saved in it.");
  });

  it("lists only the chosen language's posts, under their categories' names in it", async () => {
    const html = await render({ lang: "it" });
    expect(tab(html, "/admin/blog?lang=it")).toContain('aria-current="page"');
    expect(html).toContain("Italian posts");
    expect(html).toContain("4 posts · 3 published");
    expect(titles(html)).toEqual(["Come farsi citare da ChatGPT", "Il tuo sito non compare su Google", "SEO locale per ristoranti", "Confronto tra strumenti SEO"]);
    // Titles and category names are marked Italian, for screen readers; a category with no Italian name is shown, and marked, as English.
    expect(/<a [^>]*href="\/admin\/blog\/i1"[^>]*>/.exec(html)?.[0]).toContain('lang="it"');
    expect(html).toContain('<span lang="it">Strategie</span>');
    expect(html).toContain('<span lang="it">SEO locale</span>');
    expect(html).toContain("<span>Comparisons</span>");
    expect(html).toContain(">Translation</span>");
    expect(html).toContain(">Needs review</span>");
    // A new post starts in the language shown, and the button says so.
    expect(html).toMatch(/href="\/admin\/blog\/new\?lang=it"[^>]*>(?:(?!<\/a>)[\s\S])*New Italian post/);
  });

  it("searches and filters within the language, together", async () => {
    const search = await render({ lang: "it", q: "CITARE" });
    expect(titles(search)).toEqual(["Come farsi citare da ChatGPT"]);
    expect(search).toContain("1 matching");

    // By the category's address, which is not its name in lower case.
    expect(titles(await render({ lang: "it", category: "local-seo" }))).toEqual(["SEO locale per ristoranti"]);
    // Both at once: "SEO" is in two titles, one of them in the category.
    expect(titles(await render({ lang: "it", q: "seo", category: "local-seo" }))).toEqual(["SEO locale per ristoranti"]);

    const nothing = await render({ lang: "it", q: "citare", category: "playbooks" });
    expect(nothing).toContain("No posts match");
    expect(nothing).toMatch(CLEAR_FILTERS);
  });

  it("matches nothing for a category that no longer exists, and offers to clear it", async () => {
    const html = await render({ lang: "it", category: "deleted-since" });
    expect(titles(html)).toEqual([]);
    expect(html).toContain("No posts match");
    expect(html).toMatch(CLEAR_FILTERS);
  });

  it("filters by a category called All, and reads only its own value as no filter", async () => {
    expect(titles(await render({ lang: "it", category: "all" }))).toEqual([]);
    expect(titles(await render({ lang: "it", category: "*" }))).toHaveLength(4);
  });

  it("reads a repeated parameter as its first value, as the toolbar shows it", async () => {
    expect(titles(await render({ lang: ["it", "de"], q: ["citare", "nothing"] }))).toEqual(["Come farsi citare da ChatGPT"]);
  });

  it("opens a language with no posts empty, with a button to write the first", async () => {
    const html = await render({ lang: "es" });
    expect(tab(html, "/admin/blog?lang=es")).toContain('aria-current="page"');
    expect(html).toContain("No Spanish posts yet");
    expect(html).toMatch(/href="\/admin\/blog\/new\?lang=es"[^>]*>(?:(?!<\/a>)[\s\S])*New Spanish post/);
    expect(addable(html)).toEqual(["/admin/blog?lang=fr", "/admin/blog?lang=de"]);
  });

  it("shows English for a language the site does not have", async () => {
    const html = await render({ lang: "xx" });
    expect(tab(html, "/admin/blog")).toContain('aria-current="page"');
    expect(html).toContain("English posts");
    expect(html).toMatch(/href="\/admin\/blog\/new"[^>]*>(?:(?!<\/a>)[\s\S])*New post/);
  });

  it("names the language in the page title, so a tab switch is announced", async () => {
    const title = async (params: Params) => (await generateMetadata({ searchParams: Promise.resolve(params) })).title;
    expect(await title({})).toBe("Blog");
    expect(await title({ lang: "it" })).toBe("Blog (Italian)");
    expect(await title({ lang: ["de", "it"] })).toBe("Blog (German)");
  });
});

describe("a new post", () => {
  it("starts in the language of the tab it was started from", async () => {
    const editorLocale = async (lang?: string) => {
      renderToStaticMarkup(await AdminNewBlogPostPage({ searchParams: Promise.resolve(lang === undefined ? {} : { lang }) }));
      return (state.editorProps as { newLocale: string }).newLocale;
    };
    expect(await editorLocale("it")).toBe("it");
    expect(await editorLocale()).toBe("en");
    expect(await editorLocale("xx")).toBe("en");
  });
});
