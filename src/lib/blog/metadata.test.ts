import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BlogPost } from "./shared";

/**
 * A post's search fields on the public page (client, 2026-10-08): the SEO
 * title is the <title> and the shared-link title, the article title stays the
 * one H1, and an empty SEO title leaves every existing post as it was.
 */

const state = vi.hoisted(() => ({ post: null as unknown }));
vi.mock("./posts", () => ({ getPost: async () => state.post, relatedPosts: async () => [] }));
vi.mock("./sponsorship", () => ({ sponsorshipConfigured: () => false }));
vi.mock("@/components/blog-sponsorship", () => ({ BlogSponsorship: () => null }));
vi.mock("@/app/(marketing)/home-sections", () => ({ ClosingCta: () => null }));
vi.mock("@/components/post-cover", () => ({ PostCover: () => null }));

import { generateMetadata } from "@/app/(marketing)/blog/[slug]/page";
import { BlogArticle } from "@/components/blog-article";
import { BlogPagination } from "@/components/blog-pagination";

import { blogPage, blogPageHref, pageSuffix } from "./pagination";

let post: BlogPost;

beforeEach(() => {
  post = {
    slug: "example",
    title: "Visible article heading",
    seoTitle: "Search engine title",
    description: "An original description.",
    category: "Guides",
    categorySlug: "guides",
    publishedAt: "2026-10-08",
    readingMinutes: 1,
    author: "RepGet team",
    body: "<h2>Section</h2><p>Article body.</p>",
  };
  state.post = post;
});

/** The links in some markup, each as its attributes. */
function links(html: string): Record<string, string>[] {
  return [...html.matchAll(/<a\s([^>]*)>/g)].map((match) =>
    Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map((attribute) => [attribute[1], attribute[2]])),
  );
}

const metadataFor = () => generateMetadata({ params: Promise.resolve({ slug: "example" }), searchParams: Promise.resolve({}) });

describe("a blog post's title, for search engines and on the page", () => {
  it("uses the SEO title, exactly as written, for the <title> and the shared-link titles", async () => {
    const metadata = await metadataFor();
    expect(metadata.title).toEqual({ absolute: "Search engine title" });
    expect(metadata.description).toBe(post.description);
    expect(metadata.alternates?.canonical).toBe("/blog/example");
    expect(metadata.openGraph).toMatchObject({ title: "Search engine title", description: post.description, url: "/blog/example", type: "article" });
    expect(metadata.twitter).toMatchObject({ title: "Search engine title", description: post.description });
  });

  it("without an SEO title, uses the article title with the site's usual suffix, as posts always had", async () => {
    post.seoTitle = null;
    const metadata = await metadataFor();
    // A plain string: the root layout's "%s | RepGet" template applies.
    expect(metadata.title).toBe("Visible article heading");
    expect(metadata.openGraph?.title).toBe("Visible article heading");
  });

  it("keeps the article title as the page's only H1, and never shows the SEO title", () => {
    const html = renderToStaticMarkup(createElement(BlogArticle, { post }));
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(html).toContain("Visible article heading</h1>");
    expect(html).not.toContain("Search engine title");
  });

  it("links the team's byline, in any letter case, to its author page; other names stay text", () => {
    for (const author of ["RepGet team", "RepGet Team", "REPGET TEAM"]) {
      const html = renderToStaticMarkup(createElement(BlogArticle, { post: { ...post, author } }));
      expect(links(html), author).toContainEqual(expect.objectContaining({ href: "/blog/author/repget-team", rel: "author" }));
    }
    const html = renderToStaticMarkup(createElement(BlogArticle, { post: { ...post, author: "Jane Doe" } }));
    expect(html).not.toContain("/blog/author/");
    expect(html).toContain("Jane Doe");
  });
});

describe("the blog's pages of 30", () => {
  it("reads only a plain page number from ?page=, and page 1 is the plain address", () => {
    for (const value of [undefined, "0", "-1", "abc", "01", "1.5", "999999999", ["2", "3"]]) expect(blogPage(value)).toBe(1);
    expect(blogPage("42")).toBe(42);
    expect(blogPageHref("/blog", 1)).toBe("/blog");
    expect(blogPageHref("/blog", 2)).toBe("/blog?page=2");
    expect(pageSuffix(1)).toBe("");
    expect(pageSuffix(3)).toBe(" — Page 3");
  });

  it("draws the client's pager: Newer greyed out on the first page, 1 2 3 4 5 … 23, Older", () => {
    const html = renderToStaticMarkup(createElement(BlogPagination, { page: 1, total: 23 * 30, path: "/blog" }));
    // Newer is there, but not a link.
    expect(html).toMatch(/<span aria-disabled="true"[^>]*>.*?Newer<\/span>/);
    expect(html).not.toContain('rel="prev"');
    const numbers = [...html.matchAll(/aria-label="Page (\d+)"/g)].map((match) => Number(match[1]));
    expect(numbers).toEqual([1, 2, 3, 4, 5, 23]);
    expect(html).toContain("…");
    expect(links(html)).toContainEqual(expect.objectContaining({ href: "/blog", "aria-label": "Page 1", "aria-current": "page" }));
    expect(links(html)).toContainEqual(expect.objectContaining({ href: "/blog?page=2", rel: "next" }));
    expect(html).toContain("Page 1 of 23");
  });

  it("greys out Older on the last page, and draws nothing for a single page", () => {
    const last = renderToStaticMarkup(createElement(BlogPagination, { page: 3, total: 61, path: "/blog/category/guides" }));
    expect(last).toMatch(/<span aria-disabled="true"[^>]*>Older/);
    expect(links(last)).toContainEqual(expect.objectContaining({ href: "/blog/category/guides?page=2", rel: "prev" }));
    expect(renderToStaticMarkup(createElement(BlogPagination, { page: 1, total: 30, path: "/blog" }))).toBe("");
  });
});
