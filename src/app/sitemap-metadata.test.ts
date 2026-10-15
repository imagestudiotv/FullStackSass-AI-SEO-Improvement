import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

import type { Metadata } from "next";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { TRANSLATED_PATHS, splitLocale } from "@/lib/i18n/config";
import { SITE_OPEN_GRAPH } from "@/lib/seo/page-metadata";
import { SHARE_IMAGE } from "@/lib/share-image";

/**
 * Every page the sitemap offers search engines, checked the way Next builds
 * its <head>: the metadata of each layout above it and of the page itself,
 * merged one key deep (generate-metadata docs, "Merging": the last segment to
 * set a key replaces it whole).
 *
 * The client asked for og:url (2026-10-05); it has to name exactly the address
 * <link rel="canonical"> names. Next resolves both against metadataBase with
 * the same function, so equal inputs are equal tags - which is what is
 * compared here, together with the sitemap's own address for the page.
 *
 * Pages are found from the sitemap rather than listed here, so a page added
 * to the sitemap is checked without anyone remembering this file.
 */

const SITE = "https://www.repget.com";
const APP_DIR = __dirname;

const { POSTS, CATEGORIES } = vi.hoisted(() => {
  const CATEGORIES = [
    { name: "Guides", slug: "guides", blurb: "Step-by-step guides." },
    { name: "Comparisons", slug: "comparisons", blurb: "Tools side by side." },
  ];
  const POSTS = [
    {
      slug: "what-is-llms-txt",
      title: "What is llms.txt?",
      description: "The file that tells AI assistants what your site is about.",
      category: "Guides",
      categorySlug: "guides",
      publishedAt: "2026-09-01",
      updatedAt: "2026-09-20",
      author: "Jane Doe",
      readingMinutes: 4,
      body: "<p>Body.</p>",
    },
    {
      slug: "rank-tracker-comparison",
      title: "Rank trackers compared",
      // Its own search title, which is the whole <title> (Admin -> Blog).
      seoTitle: "Rank trackers compared: 5 tools, real prices (2026)",
      description: "Five rank trackers, what they cost and what they miss.",
      category: "Comparisons",
      categorySlug: "comparisons",
      publishedAt: "2026-09-10",
      author: "Jane Doe",
      readingMinutes: 7,
      body: "<p>Body.</p>",
    },
    {
      // In Italian: its page, and its category's Italian page (client, 2026-10-15).
      slug: "cos-e-llms-txt",
      title: "Che cos'è llms.txt?",
      description: "Il file che dice agli assistenti IA di che cosa parla il suo sito.",
      category: "Guides",
      categoryLabel: "Guide",
      categorySlug: "guides",
      publishedAt: "2026-10-01",
      author: "Jane Doe",
      readingMinutes: 4,
      body: "<p>Testo.</p>",
      locale: "it",
    },
  ];
  return { POSTS, CATEGORIES };
});

type MockPost = (typeof POSTS)[number] & { locale?: string };
const inLanguage = (locale = "en") => (POSTS as MockPost[]).filter((post) => (post.locale ?? "en") === locale);

// Blog pages read the database; these stand in for published posts.
vi.mock("@/lib/blog/posts", () => ({
  listPosts: async (locale = "en") => inLanguage(locale),
  publishedLocales: async () => ["it"],
  postVersions: async () => [],
  listPostPage: async (_page: number, filter: { locale?: string; category?: string } = {}) => {
    const posts = inLanguage(filter.locale).filter((post) => !filter.category || post.category === filter.category);
    return { posts, total: posts.length };
  },
  publishedCategoryCounts: async () => ({}),
  publishedCategoryLocales: async (category: string) =>
    ["en", "es", "fr", "it", "de"].filter((locale) => inLanguage(locale).some((post) => post.category === category)),
  getPost: async (slug: string, locale = "en") => inLanguage(locale).find((post) => post.slug === slug) ?? null,
  relatedPosts: async () => [],
}));
// The database's readers only; the hreflang rule (lib/blog/locale.ts) is the real one.
vi.mock("@/lib/blog/categories", () => ({
  listCategories: async () => CATEGORIES,
  categoryBySlug: async (slug: string) => CATEGORIES.find((category) => category.slug === slug) ?? null,
}));
// The root layout loads its fonts through Next's compiler, which tests do not run.
vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "font-geist-sans" }),
  Geist_Mono: () => ({ variable: "font-geist-mono" }),
}));

type Params = Record<string, string | string[]>;

type MetadataModule = {
  metadata?: Metadata;
  generateMetadata?: (props: {
    params: Promise<Params>;
    searchParams: Promise<Record<string, string>>;
  }) => Metadata | Promise<Metadata>;
};

/** The files Next would use for one address: its layouts, outermost first, then the page. */
type Route = { files: string[]; params: Params; rank: number[] };

/**
 * Finds the page.tsx serving `pathname` under app/, with Next's precedence:
 * at each segment a fixed folder beats [param], which beats [...rest], and
 * (group) folders are not part of the address.
 */
function findRoute(pathname: string): Route {
  const found: Route[] = [];

  function walk(dir: string, segments: string[], layouts: string[], params: Params, rank: number[]) {
    const layout = path.join(dir, "layout.tsx");
    const chain = existsSync(layout) ? [...layouts, layout] : layouts;
    const page = path.join(dir, "page.tsx");
    if (segments.length === 0 && existsSync(page)) found.push({ files: [...chain, page], params, rank });

    const [head, ...rest] = segments;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory() || /^[_@]/.test(entry.name)) continue;
      const child = path.join(dir, entry.name);
      const catchAll = /^\[\.\.\.(\w+)\]$/.exec(entry.name);
      const param = /^\[(\w+)\]$/.exec(entry.name);

      if (/^\(.+\)$/.test(entry.name)) walk(child, segments, chain, params, rank);
      else if (head === undefined) continue;
      else if (catchAll) walk(child, [], chain, { ...params, [catchAll[1]]: segments }, [...rank, 2]);
      else if (param) walk(child, rest, chain, { ...params, [param[1]]: head }, [...rank, 1]);
      else if (entry.name === head) walk(child, rest, chain, params, [...rank, 0]);
    }
  }

  walk(APP_DIR, pathname.split("/").filter(Boolean), [], {}, []);
  const byPrecedence = (a: Route, b: Route) => {
    for (let i = 0; i < Math.max(a.rank.length, b.rank.length); i++) {
      const diff = (a.rank[i] ?? -1) - (b.rank[i] ?? -1);
      if (diff !== 0) return diff;
    }
    return 0;
  };
  const [best] = found.sort(byPrecedence);
  if (!best) throw new Error(`No page serves ${pathname}`);
  return best;
}

/** One page's metadata after Next's one-key-deep merge of every segment. */
async function resolvedMetadata(route: Route): Promise<Metadata> {
  const segments: Metadata[] = [];
  for (const file of route.files) {
    const mod = (await import(file)) as MetadataModule;
    if (mod.generateMetadata) {
      segments.push(
        await mod.generateMetadata({
          params: Promise.resolve(route.params),
          searchParams: Promise.resolve({}),
        }),
      );
    } else if (mod.metadata) {
      segments.push(mod.metadata);
    }
  }
  return Object.assign({}, ...segments) as Metadata;
}

type Checked = { url: string; pathname: string; metadata: Metadata };
let pages: Checked[] = [];

beforeAll(async () => {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", SITE);
  const { default: sitemap } = await import("./sitemap");
  const entries = await sitemap();
  pages = await Promise.all(
    entries.map(async ({ url }) => {
      const { pathname } = new URL(url);
      return { url, pathname, metadata: await resolvedMetadata(findRoute(pathname)) };
    }),
  );
}, 120_000);

afterAll(() => {
  vi.unstubAllEnvs();
});

describe("every page in the sitemap", () => {
  it("is found, translated pages and blog posts included", () => {
    const paths = pages.map((page) => page.pathname);
    expect(paths).toEqual(expect.arrayContaining(["/", "/fr", "/it/pricing", "/blog", "/terms"]));
    expect(paths).toEqual(expect.arrayContaining(inLanguage("en").map((post) => `/blog/${post.slug}`)));
    expect(paths).toEqual(expect.arrayContaining(CATEGORIES.map((category) => `/blog/category/${category.slug}`)));
    // An Italian post, and its category's page in Italian - the only Italian category with a post.
    expect(paths).toEqual(expect.arrayContaining(["/it/blog/cos-e-llms-txt", "/it/blog/category/guides"]));
    // The team's author page in every language (client, 2026-10-15).
    expect(paths).toEqual(expect.arrayContaining(["/blog/author/repget-team", "/it/blog/author/repget-team", "/de/blog/author/repget-team"]));
    expect(paths).not.toContain("/it/blog/category/comparisons");
  });

  it("a category's pages in two languages name each other, and themselves, as alternates", () => {
    const languagesOf = (pathname: string) => pages.find((page) => page.pathname === pathname)?.metadata.alternates?.languages;
    const both = { en: "/blog/category/guides", it: "/it/blog/category/guides", "x-default": "/blog/category/guides" };
    expect(languagesOf("/blog/category/guides")).toEqual(both);
    expect(languagesOf("/it/blog/category/guides")).toEqual(both);
    // English only: no alternates.
    expect(languagesOf("/blog/category/comparisons")).toBeUndefined();
  });

  it("has an og:url, and it is exactly its canonical", () => {
    for (const { pathname, metadata } of pages) {
      const canonical = metadata.alternates?.canonical;
      expect(canonical, pathname).toEqual(expect.any(String));
      expect(metadata.openGraph?.url, pathname).toBe(canonical);
    }
  });

  it("names its own sitemap address as its canonical", () => {
    for (const { url, pathname, metadata } of pages) {
      const canonical = String(metadata.alternates?.canonical);
      expect(new URL(canonical, metadata.metadataBase ?? undefined).href, pathname).toBe(new URL(url).href);
    }
  });

  /**
   * A page's own openGraph replaces the root layout's whole object, so these
   * would vanish from any page that built one without them.
   */
  it("keeps the site name and the share picture", () => {
    for (const { pathname, metadata } of pages) {
      expect(metadata.openGraph?.siteName, pathname).toBe(SITE_OPEN_GRAPH.siteName);
      expect(metadata.openGraph?.images, pathname).toEqual([SHARE_IMAGE]);
    }
  });

  /**
   * Next fills og:title/og:description from the page's own; one set by hand
   * must agree. A title written out whole ({ absolute }, a blog post's SEO
   * title) is compared as written.
   */
  it("shares the page's own title and description", () => {
    for (const { pathname, metadata } of pages) {
      const og = metadata.openGraph;
      const title = metadata.title && typeof metadata.title === "object" && "absolute" in metadata.title ? metadata.title.absolute : metadata.title;
      if (og?.title !== undefined) expect(og.title, pathname).toBe(title);
      if (og?.description !== undefined) expect(og.description, pathname).toBe(metadata.description);
    }
  });

  it("lists itself among its hreflang alternates when it exists in every language", () => {
    for (const { pathname, metadata } of pages) {
      if (!TRANSLATED_PATHS.has(splitLocale(pathname).path)) continue;
      const languages = Object.values(metadata.alternates?.languages ?? {});
      expect(languages, pathname).toContain(metadata.alternates?.canonical);
    }
  });

  it("is not marked noindex", () => {
    for (const { pathname, metadata } of pages) {
      const robots = metadata.robots;
      if (robots && typeof robots === "object") expect(robots.index, pathname).not.toBe(false);
    }
  });
});
