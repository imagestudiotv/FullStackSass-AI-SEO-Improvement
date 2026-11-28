import type { MetadataRoute } from "next";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { blogCategories, blogPosts, successStories } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";

/**
 * The faster sitemap (2026-11-28: 3.4-6.5 s live) lists EXACTLY what the old
 * one did: the same addresses, priorities and dates, in the same order, and
 * still no hreflang alternates of its own (the pages declare those). The old
 * one is kept below as it was - a full listPosts read per language, one
 * after the other - and both run on the same real database.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
  isDatabaseConfigured: () => true,
}));

import { blogPath, categoryPath } from "@/lib/blog/locale";
import { listPosts } from "@/lib/blog/posts";
import { discoverPath } from "@/lib/discover/paths";
import { discoverSitemapProfiles } from "@/lib/discover/profiles";
import { localePath, PREFIXED_LOCALES, TRANSLATED_PATHS } from "@/lib/i18n/config";
import { INTEGRATION_DOC_PAGES, PUBLIC_PAGES, TOOL_PAGES } from "@/lib/seo/public-pages";
import { siteUrl } from "@/lib/site-url";
import { successStoryPath } from "@/lib/success-stories/fields";
import { listPublishedSuccessStories } from "@/lib/success-stories/stories";

import sitemap, { revalidate } from "./sitemap";

/** The sitemap as it was before 2026-11-28 (app/sitemap.ts at 89604a23), comments removed. */
async function legacySitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const now = new Date();
  const pages: MetadataRoute.Sitemap = PUBLIC_PAGES.map((page) => ({ url: `${base}${page.path}`, lastModified: now, priority: page.priority }));
  const tools: MetadataRoute.Sitemap = TOOL_PAGES.map((path) => ({ url: `${base}${path}`, lastModified: now, priority: 0.6 }));
  const docs: MetadataRoute.Sitemap = INTEGRATION_DOC_PAGES.map((path) => ({ url: `${base}${path}`, lastModified: now, priority: 0.5 }));
  const published = await listPosts();
  const posts: MetadataRoute.Sitemap = published.map((post) => ({
    url: `${base}/blog/${post.slug}`,
    lastModified: new Date(`${post.updatedAt ?? post.publishedAt}T00:00:00Z`),
    priority: 0.7,
  }));
  const newestBySlug = new Map<string, string>();
  for (const post of published) {
    const date = post.updatedAt ?? post.publishedAt;
    const seen = newestBySlug.get(post.categorySlug);
    if (!seen || date > seen) newestBySlug.set(post.categorySlug, date);
  }
  const categories: MetadataRoute.Sitemap = [...newestBySlug].map(([slug, date]) => ({
    url: `${base}/blog/category/${slug}`,
    lastModified: new Date(`${date}T00:00:00Z`),
    priority: 0.5,
  }));
  const translated: MetadataRoute.Sitemap = PREFIXED_LOCALES.flatMap((locale) =>
    [...TRANSLATED_PATHS].map((path) => ({
      url: `${base}${localePath(locale, path)}`,
      lastModified: now,
      priority: path === "/" ? 0.9 : path === "/pricing" ? 0.7 : 0.5,
    })),
  );
  const otherLanguages = await Promise.all(PREFIXED_LOCALES.map(async (locale) => ({ locale, posts: await listPosts(locale) })));
  const translatedPosts: MetadataRoute.Sitemap = otherLanguages.flatMap(({ locale, posts: list }) => [
    ...list.map((post) => ({
      url: `${base}${blogPath(locale, post.slug)}`,
      lastModified: new Date(`${post.updatedAt ?? post.publishedAt}T00:00:00Z`),
      priority: 0.6,
    })),
  ]);
  const translatedCategories: MetadataRoute.Sitemap = otherLanguages.flatMap(({ locale, posts: list }) => {
    const newest = new Map<string, string>();
    for (const post of list) {
      const date = post.updatedAt ?? post.publishedAt;
      const seen = newest.get(post.categorySlug);
      if (!seen || date > seen) newest.set(post.categorySlug, date);
    }
    return [...newest].map(([slug, date]) => ({ url: `${base}${categoryPath(locale, slug)}`, lastModified: new Date(`${date}T00:00:00Z`), priority: 0.4 }));
  });
  const profiles: MetadataRoute.Sitemap = (await discoverSitemapProfiles()).map((profile) => ({
    url: `${base}${discoverPath(profile.locale, profile.slug)}`,
    lastModified: profile.updatedAt,
    priority: 0.5,
  }));
  const stories: MetadataRoute.Sitemap = (await listPublishedSuccessStories()).map((story) => ({
    url: `${base}${successStoryPath("en", story.slug)}`,
    lastModified: story.updatedAt,
    priority: 0.6,
  }));
  return [...pages, ...tools, ...docs, ...posts, ...categories, ...translated, ...translatedPosts, ...translatedCategories, ...profiles, ...stories];
}

let test: TestDb;
const NOW = new Date("2026-11-28T10:00:00Z");
const at = (iso: string) => new Date(iso);

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);

  // The migrations seed some of these already.
  await test.db
    .insert(blogCategories)
    .values([
      { name: "Guides", slug: "guides" },
      { name: "Comparisons", slug: "comparisons" },
      { name: "Customer stories", slug: "customer-stories" },
    ])
    .onConflictDoNothing();
  const post = (values: Partial<typeof blogPosts.$inferInsert> & { slug: string }) => ({
    title: values.slug,
    category: "Guides",
    author: "RepGet Team",
    bodyHtml: "<p>A long body the sitemap never needed.</p>".repeat(50),
    status: "published",
    ...values,
  });
  await test.db.insert(blogPosts).values([
    // Revised on a later day: dated by the revision.
    post({ slug: "what-is-llms-txt", publishedAt: at("2026-09-01T08:00:00Z"), revisedAt: at("2026-09-20T12:00:00Z") }),
    // Revised the same day: dated by publication.
    post({ slug: "rank-trackers-compared", category: "Comparisons", publishedAt: at("2026-09-10T08:00:00Z"), revisedAt: at("2026-09-10T18:00:00Z") }),
    // Published at the same moment as the next: ordered by id, as listPosts does.
    post({ slug: "same-moment-a", publishedAt: at("2026-10-05T09:00:00Z") }),
    post({ slug: "same-moment-b", publishedAt: at("2026-10-05T09:00:00Z") }),
    // A category with no row: its address is made from the name.
    post({ slug: "orphan-category", category: "Old Things", publishedAt: at("2026-08-01T08:00:00Z") }),
    // Never listed: a draft, and one marked published without a date.
    post({ slug: "a-draft", status: "draft", publishedAt: null }),
    post({ slug: "no-date", publishedAt: null }),
    // Other languages, their categories with them.
    post({ slug: "cos-e-llms-txt", locale: "it", publishedAt: at("2026-10-01T08:00:00Z") }),
    post({ slug: "vergleich", locale: "de", category: "Comparisons", publishedAt: at("2026-10-02T08:00:00Z"), revisedAt: at("2026-11-02T08:00:00Z") }),
    post({ slug: "guia", locale: "es", publishedAt: at("2026-10-03T08:00:00Z") }),
    // A directory profile, in English and Italian.
    post({ slug: "studio-story", category: "Customer stories", businessSlug: "image-studio", publishedAt: at("2026-10-10T08:00:00Z") }),
    post({ slug: "studio-storia", locale: "it", category: "Customer stories", businessSlug: "image-studio", publishedAt: at("2026-10-11T08:00:00Z") }),
  ]);
  await test.db.insert(successStories).values([
    { slug: "lake-como-weddings", name: "Lake Como Weddings", title: "How a wedding studio grew", summary: "A summary.", published: true, publishedAt: at("2026-11-01T08:00:00Z"), updatedAt: at("2026-11-02T08:00:00Z") },
    { slug: "a-draft-story", name: "Draft", title: "Not yet", summary: "A summary.", published: false },
  ]);
});
afterAll(() => {
  vi.useRealTimers();
});

describe("the sitemap", () => {
  it("lists exactly what it listed before the speed-up: the same addresses, priorities and dates, in order", async () => {
    const [now, before] = [await sitemap(), await legacySitemap()];
    expect(now).toEqual(before);
    // The test means something: posts in four languages, their categories, profiles and a story.
    const urls = now.map((entry) => entry.url.replace(siteUrl(), ""));
    for (const url of [
      "/blog/what-is-llms-txt",
      "/blog/category/old-things",
      "/it/blog/cos-e-llms-txt",
      "/de/blog/vergleich",
      "/es/blog/guia",
      "/discover/image-studio",
      "/it/discover/image-studio",
      "/success-stories/lake-como-weddings",
    ]) {
      expect(urls, url).toContain(url);
    }
    expect(urls.some((url) => url.includes("a-draft") || url.includes("no-date"))).toBe(false);
    expect(now.find((entry) => entry.url.endsWith("/blog/what-is-llms-txt"))?.lastModified).toEqual(at("2026-09-20T00:00:00Z"));
    // No alternates of its own: hreflang stays in each page's metadata.
    expect(now.every((entry) => entry.alternates === undefined)).toBe(true);
  });

  it("has no repeated address", async () => {
    const urls = (await sitemap()).map((entry) => entry.url);
    expect(urls.filter((url, i) => urls.indexOf(url) !== i)).toEqual([]);
  });

  it("is built ahead and refreshed hourly, not rendered for every crawl", () => {
    expect(revalidate).toBe(3600);
  });
});
