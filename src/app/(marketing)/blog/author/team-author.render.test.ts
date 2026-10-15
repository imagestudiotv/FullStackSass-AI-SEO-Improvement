import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { BLOG_CHROME } from "@/lib/blog/locale";
import type { BlogPost } from "@/lib/blog/shared";

/**
 * The RepGet team's author page in every language (client, 2026-10-15):
 * /it/blog/author/repget-team names the team, describes it and lists its
 * posts in Italian - or, with none yet, says so and shows the English ones -
 * and an Italian post's byline and structured data point to it.
 */

const { POSTS, state } = vi.hoisted(() => {
  const base = { publishedAt: "2026-10-15", author: "RepGet team", readingMinutes: 5, body: "<p>Testo.</p>", description: "Descrizione." };
  const POSTS = {
    italian: { ...base, slug: "sito-non-compare-su-google", title: "Il tuo sito non compare su Google?", category: "Playbooks", categoryLabel: "Strategie", categorySlug: "playbooks", locale: "it" as const },
    english: { ...base, slug: "keyword-cannibalization", title: "Keyword cannibalization", category: "Guides", categoryLabel: "Guides", categorySlug: "guides", locale: "en" as const },
  };
  /** The team's published posts in each language, for a test. */
  const state = { posts: {} as Record<string, unknown[]> };
  return { POSTS, state };
});

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode; [key: string]: unknown }) =>
    createElement("a", { href, ...rest }, children),
}));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/app/(marketing)/home-sections", () => ({ ClosingCta: () => null }));
vi.mock("@/components/post-cover", () => ({ PostCover: () => null }));
vi.mock("@/lib/blog/posts", async () => {
  const { BLOG_PAGE_SIZE: size } = await import("@/lib/blog/pagination");
  return {
    listPostPage: async (page: number, filter: { locale?: string; author?: string } = {}) => {
      const posts = (state.posts[filter.locale ?? "en"] ?? []) as { author: string }[];
      const mine = posts.filter((post) => !filter.author || post.author.toLowerCase() === filter.author.toLowerCase());
      return { posts: mine.slice((page - 1) * size, page * size), total: mine.length };
    },
  };
});

import { BlogArticle } from "@/components/blog-article";
import { BLOG_PAGE_SIZE } from "@/lib/blog/pagination";

import LocaleTeamAuthorPage, { generateMetadata as localeAuthorMetadata } from "../../[locale]/blog/author/repget-team/page";
import { BlogPostView } from "../post-view";
import TeamAuthorPage, { generateMetadata as englishAuthorMetadata } from "./repget-team/page";

beforeAll(() => vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.repget.com"));
afterAll(() => vi.unstubAllEnvs());
beforeEach(() => {
  state.posts = { en: [POSTS.english], it: [POSTS.italian] };
});

const localeProps = (locale: string, page?: string) => ({
  params: Promise.resolve({ locale }),
  searchParams: Promise.resolve(page ? { page } : {}),
});
const englishProps = (page?: string) => ({ searchParams: Promise.resolve(page ? { page } : {}) });
const html = (node: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(node);
const it_ = BLOG_CHROME.it;

describe("/it/blog/author/repget-team", () => {
  it("names and describes the team in Italian and lists its Italian posts", async () => {
    const page = html(await LocaleTeamAuthorPage(localeProps("it")));
    expect(page).toMatch(new RegExp(`<h1[^>]*>${it_.teamName}</h1>`));
    expect(page).toContain(`>${it_.authorEyebrow}</p>`);
    expect(page).toContain(it_.authorBio);
    expect(page).toContain(`>${it_.articlesHeading}</h2>`);
    expect(page).toContain(">1 articolo</p>");
    expect(page).toContain('href="/it/blog/sito-non-compare-su-google"');
    expect(page).not.toContain(it_.authorNoneYet);
    // The trail: Home and Blog in Italian, then the team.
    expect(page).toMatch(/<a href="\/it"[^>]*>Home<\/a>[\s\S]*<a href="\/it\/blog"[^>]*>Blog<\/a>/);
  });

  it("is a profile page in Italian for search engines, with the same trail", async () => {
    const page = html(await LocaleTeamAuthorPage(localeProps("it")));
    expect(page).toContain('"@type":"ProfilePage","url":"https://www.repget.com/it/blog/author/repget-team"');
    expect(page).toContain(`"name":"${it_.teamName}","inLanguage":"it"`);
    expect(page).toContain(`"name":"${it_.teamName}","item":"https://www.repget.com/it/blog/author/repget-team"`);
  });

  it("with no Italian post yet: says so in Italian and shows the English ones", async () => {
    state.posts.it = [];
    const page = html(await LocaleTeamAuthorPage(localeProps("it")));
    expect(page).toContain(it_.authorNoneYet);
    // The message says it: no "0 articoli" above it.
    expect(page).not.toContain("0 articoli");
    expect(page).toContain(it_.inEnglish);
    expect(page).toMatch(/<ul [^>]*lang="en"[^>]*>[\s\S]*href="\/blog\/keyword-cannibalization"/);
    expect(page).toMatch(new RegExp(`<a href="/blog/author/repget-team"[^>]*>${it_.readInEnglish}</a>`));
  });

  it("is titled and described in Italian, one page in five languages", async () => {
    const metadata = await localeAuthorMetadata(localeProps("it"));
    expect(metadata.title).toBe(it_.teamName);
    expect(metadata.description).toBe(`${it_.authorMetaDescription}.`);
    expect(metadata.alternates?.canonical).toBe("/it/blog/author/repget-team");
    expect(metadata.openGraph?.url).toBe("/it/blog/author/repget-team");
    expect(metadata.alternates?.languages).toMatchObject({
      en: "/blog/author/repget-team",
      it: "/it/blog/author/repget-team",
      de: "/de/blog/author/repget-team",
      "x-default": "/blog/author/repget-team",
    });
  });

  it("from page 2 on: its own Italian title and address, outside the hreflang set", async () => {
    state.posts.it = Array.from({ length: BLOG_PAGE_SIZE + 1 }, (_, i) => ({ ...POSTS.italian, slug: `articolo-${i + 1}` }));
    const metadata = await localeAuthorMetadata(localeProps("it", "2"));
    expect(metadata.title).toBe(`${it_.teamName} — Pagina 2`);
    expect(metadata.description).toBe(`${it_.authorMetaDescription} — Pagina 2.`);
    expect(metadata.alternates?.canonical).toBe("/it/blog/author/repget-team?page=2");
    expect(metadata.alternates?.languages).toBeUndefined();

    const page = html(await LocaleTeamAuthorPage(localeProps("it", "2")));
    expect(page).toContain(`href="/it/blog/articolo-${BLOG_PAGE_SIZE + 1}"`);
    expect(page).toMatch(new RegExp(`<a href="/it/blog/author/repget-team" rel="prev"[^>]*>[\\s\\S]*?${it_.newer}</a>`));
  });

  it("is a 404 for English under a prefix, a language the site does not have, and past the last page", async () => {
    const notFound = /NEXT_HTTP_ERROR_FALLBACK;404/;
    await expect(LocaleTeamAuthorPage(localeProps("en"))).rejects.toThrow(notFound);
    await expect(LocaleTeamAuthorPage(localeProps("xx"))).rejects.toThrow(notFound);
    await expect(LocaleTeamAuthorPage(localeProps("it", "2"))).rejects.toThrow(notFound);
  });
});

describe("/blog/author/repget-team in English", () => {
  it("is as it was", async () => {
    const page = html(await TeamAuthorPage(englishProps()));
    expect(page).toMatch(/<h1[^>]*>RepGet team<\/h1>/);
    expect(page).toContain(">Author</p>");
    expect(page).toContain("The team behind RepGet.");
    expect(page).toContain(">1 article</p>");
    expect(page).toContain('href="/blog/keyword-cannibalization"');
    expect(page).toContain('"@type":"ProfilePage","url":"https://www.repget.com/blog/author/repget-team"');
  });

  it("with no English post: the message it always had", async () => {
    state.posts.en = [];
    const page = html(await TeamAuthorPage(englishProps()));
    expect(page).toContain("Nothing here yet");
    expect(page).toContain("The team&#x27;s first article is on its way.");
  });

  it("names its Italian version, and the others, with hreflang", async () => {
    const metadata = await englishAuthorMetadata(englishProps());
    expect(metadata.title).toBe("RepGet team");
    expect(metadata.description).toBe("Guides and playbooks from the RepGet team on getting found on Google and cited by AI assistants.");
    expect(metadata.alternates?.canonical).toBe("/blog/author/repget-team");
    expect(metadata.alternates?.languages).toMatchObject({ it: "/it/blog/author/repget-team", "x-default": "/blog/author/repget-team" });
  });
});

describe("a post by the team", () => {
  it("in Italian: the byline names the team in Italian and links to its Italian page", () => {
    const article = html(createElement(BlogArticle, { post: POSTS.italian as BlogPost }));
    expect(article).toMatch(new RegExp(`<a href="/it/blog/author/repget-team" rel="author"[^>]*>${it_.teamName}</a>`));
  });

  it("in English: as it was", () => {
    const article = html(createElement(BlogArticle, { post: POSTS.english as BlogPost }));
    expect(article).toMatch(/<a href="\/blog\/author\/repget-team" rel="author"[^>]*>RepGet team<\/a>/);
  });

  it("by someone else: their own name, no link", () => {
    const article = html(createElement(BlogArticle, { post: { ...POSTS.italian, author: "Jane Doe" } as BlogPost }));
    expect(article).toContain("Jane Doe");
    expect(article).not.toContain("/blog/author/");
  });

  it("names the team's Italian page as the author in its structured data", () => {
    const page = html(createElement(BlogPostView, { post: POSTS.italian as BlogPost, versions: [], related: [] }));
    expect(page).toContain(`"author":{"@type":"Organization","name":"${it_.teamName}","url":"https://www.repget.com/it/blog/author/repget-team"}`);
  });
});
