import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { blogPosts } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";

/**
 * A translation's links lead to the same pages in its language (client,
 * 2026-10-20): the language's version of a page that has one, its
 * translation of a blog post when one is published, and no link at all to an
 * English-only article - its words stay.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
}));

import { blogLinkTargets, localizeHref, localizeLinks, type LinkTargets } from "./translation-links";

const TARGETS: LinkTargets = {
  origin: "https://www.repget.com",
  hosts: ["www.repget.com", "repget.com"],
  posts: [
    // local-seo has a Spanish version (seo-local) and an Italian one; keyword-guide has none in Spanish.
    ["local-seo", "seo-local"],
    ["seo-local", "seo-local"],
    ["seo-locale", "seo-local"],
    ["keyword-guide", null],
  ],
};

describe("one link, for a Spanish reader", () => {
  it.each([
    ["the free audit", "https://www.repget.com/audit", "https://www.repget.com/es/audit"],
    ["a tool, written without www and with a trailing slash", "https://repget.com/tools/keyword-density/", "https://www.repget.com/es/tools/keyword-density"],
    ["pricing, as a site path, keeping its #fragment", "/pricing#plans", "https://www.repget.com/es/pricing#plans"],
    ["the home page", "https://www.repget.com/", "https://www.repget.com/es"],
    ["the blog", "https://www.repget.com/blog", "https://www.repget.com/es/blog"],
    ["a post with a Spanish version", "https://www.repget.com/blog/local-seo?ref=x", "https://www.repget.com/es/blog/seo-local?ref=x"],
    ["the Italian version of that post", "https://www.repget.com/it/blog/seo-locale", "https://www.repget.com/es/blog/seo-local"],
    ["a page pointed at another language", "https://www.repget.com/it/audit", "https://www.repget.com/es/audit"],
    ["an English-only page", "https://www.repget.com/privacy", "https://www.repget.com/privacy"],
    ["a category page (no translated address)", "https://www.repget.com/blog/category/guides", "https://www.repget.com/blog/category/guides"],
  ])("%s", (_label, href, expected) => {
    expect(localizeHref(href, "es", TARGETS)).toBe(expected);
  });

  it("goes when the post has no Spanish version", () => {
    expect(localizeHref("https://www.repget.com/blog/keyword-guide", "es", TARGETS)).toBeNull();
  });

  it.each([
    ["another site", "https://developers.google.com/search/docs"],
    ["an anchor on the same page", "#faq"],
    ["an email address", "mailto:hello@repget.com"],
    ["a post RepGet does not know (a draft)", "https://www.repget.com/blog/not-published-yet"],
  ])("is left alone: %s", (_label, href) => {
    expect(localizeHref(href, "es", TARGETS)).toBe(href);
  });
});

describe("a translation's HTML", () => {
  it("has its links pointed at the language's pages, and a link to an English-only post unwrapped", () => {
    const html =
      '<p>Run the <a href="https://www.repget.com/audit">free <strong>audit</strong></a>, read <a href="https://www.repget.com/blog/local-seo">the guide</a> and <a href="https://www.repget.com/blog/keyword-guide">the keyword guide</a>.</p>';
    expect(localizeLinks(html, "es", TARGETS)).toBe(
      '<p>Run the <a href="https://www.repget.com/es/audit">free <strong>audit</strong></a>, read <a href="https://www.repget.com/es/blog/seo-local">the guide</a> and the keyword guide.</p>',
    );
  });

  it("comes back exactly as it was when nothing changes", () => {
    const html = '<p>Already <a href="https://www.repget.com/es/audit">Spanish</a> and <a href="https://example.org">elsewhere</a>.</p>';
    expect(localizeLinks(html, "es", TARGETS)).toBe(html);
    expect(localizeLinks("<p>No links.</p>", "es", TARGETS)).toBe("<p>No links.</p>");
  });

  it("is the same done twice", () => {
    const html = '<p><a href="https://www.repget.com/blog/local-seo">guide</a> <a href="/tools">tools</a> <a href="https://www.repget.com/blog/keyword-guide">keywords</a></p>';
    const once = localizeLinks(html, "it", { ...TARGETS, posts: [["local-seo", "seo-locale"], ["seo-locale", "seo-locale"], ["keyword-guide", null]] });
    expect(localizeLinks(once, "it", { ...TARGETS, posts: [["local-seo", "seo-locale"], ["seo-locale", "seo-locale"], ["keyword-guide", null]] })).toBe(once);
  });
});

describe("the posts a translation can link to", () => {
  let test: TestDb;

  beforeAll(async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.repget.com");
    test = await createTestDb();
    state.db = test.db;
  });

  beforeEach(async () => {
    await test.db.delete(blogPosts);
  });

  const post = async (values: Partial<typeof blogPosts.$inferInsert> & { slug: string }) => {
    const [row] = await test.db
      .insert(blogPosts)
      .values({ title: values.slug, description: "d", category: "Guides", author: "RepGet team", status: "published", publishedAt: new Date(), ...values })
      .returning({ id: blogPosts.id });
    return row.id;
  };

  it("are the published ones, each address leading to its published version in the language", async () => {
    const local = await post({ slug: "local-seo" });
    await post({ slug: "seo-local", locale: "es", translationOf: local });
    await post({ slug: "seo-locale", locale: "it", translationOf: local, status: "draft" });
    await post({ slug: "keyword-guide" });
    await post({ slug: "draft-post", status: "draft" });

    const spanish = await blogLinkTargets("es");
    expect(spanish.origin).toBe("https://www.repget.com");
    expect(spanish.hosts.sort()).toEqual(["repget.com", "www.repget.com"]);
    expect(new Map(spanish.posts)).toEqual(new Map([["local-seo", "seo-local"], ["seo-local", "seo-local"], ["keyword-guide", null]]));

    // The Italian version is a draft: no Italian post to link to yet.
    expect(new Map((await blogLinkTargets("it")).posts)).toEqual(new Map([["local-seo", null], ["seo-local", null], ["keyword-guide", null]]));
    // Back to English: every address leads to the English post.
    expect(new Map((await blogLinkTargets("en")).posts).get("seo-local")).toBe("local-seo");
  });
});
