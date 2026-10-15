import type { MetadataRoute } from "next";

import { blogPath, categoryPath } from "@/lib/blog/locale";
import { listPosts } from "@/lib/blog/posts";
import { localePath, PREFIXED_LOCALES, TRANSLATED_PATHS } from "@/lib/i18n/config";
import { INTEGRATION_DOC_PAGES, PUBLIC_PAGES, TOOL_PAGES } from "@/lib/seo/public-pages";
import { siteUrl as canonicalSiteUrl } from "@/lib/site-url";

/**
 * Sitemap.
 *
 * Only public marketing pages belong here. Signed-in routes are behind auth and
 * would be crawled to a redirect, and /audit takes a query parameter — listing
 * the bare page invites crawls of a form that fetches arbitrary websites.
 *
 * It would be difficult to justify selling SEO from a site with no sitemap.
 */

/** Falls back to the production domain so a missing env var cannot emit localhost URLs. */
function baseUrl(): string {
  return canonicalSiteUrl();
}

/** Reads the published blog posts, so it is built per request like the blog. */
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = baseUrl();
  const now = new Date();

  /** The public pages, from the list the language-prefix redirect also reads (lib/seo/public-pages.ts). */
  const pages: MetadataRoute.Sitemap = PUBLIC_PAGES.map((page) => ({
    url: `${base}${page.path}`,
    lastModified: now,
    priority: page.priority,
  }));

  /**
   * Free tools, from the same registry the hub renders from. Listed here
   * rather than by hand: three of them were missing before, because a tool
   * added to the registry never reached a hardcoded list. The results pages
   * take a query parameter, so only the forms are listed.
   */
  const tools: MetadataRoute.Sitemap = TOOL_PAGES.map((path) => ({
    url: `${base}${path}`,
    lastModified: now,
    priority: 0.6,
  }));

  /** One page per publishing integration, for the same reason. */
  const docs: MetadataRoute.Sitemap = INTEGRATION_DOC_PAGES.map((path) => ({
    url: `${base}${path}`,
    lastModified: now,
    priority: 0.5,
  }));

  const published = await listPosts();

  const posts: MetadataRoute.Sitemap = published.map((post) => ({
    url: `${base}/blog/${post.slug}`,
    // The post's own date, not the build's: a build date on every URL tells a
    // crawler everything changed, which is both false and unhelpful.
    lastModified: new Date(`${post.updatedAt ?? post.publishedAt}T00:00:00Z`),
    priority: 0.7,
  }));

  /**
   * Blog categories that HAVE posts, read from the posts already loaded rather
   * than from the category list: an empty category page is thin content, and
   * advertising one to search engines invites them to judge the blog by it.
   * Dated by its newest post, for the same reason posts carry their own date.
   */
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

  /**
   * Translated pages. Listed so search engines find them without having to
   * discover the prefix by following a switcher link, which they may not.
   * Every page with an app/(marketing)/[locale] route: TRANSLATED_PATHS, the
   * same list that declares hreflang alternates (lib/i18n/config.ts), so a
   * newly translated page is listed without anyone remembering to.
   */
  const translated: MetadataRoute.Sitemap = PREFIXED_LOCALES.flatMap((locale) =>
    [...TRANSLATED_PATHS].map((path) => ({
      url: `${base}${localePath(locale, path)}`,
      lastModified: now,
      // The homepage first, then pricing; the rest are supporting pages.
      priority: path === "/" ? 0.9 : path === "/pricing" ? 0.7 : 0.5,
    })),
  );

  /** Posts in other languages (lib/blog/locale.ts); their blog pages are in `translated` above. */
  const otherLanguages = await Promise.all(PREFIXED_LOCALES.map(async (locale) => ({ locale, posts: await listPosts(locale) })));
  const translatedPosts: MetadataRoute.Sitemap = otherLanguages.flatMap(({ locale, posts: list }) => [
    ...list.map((post) => ({
      url: `${base}${blogPath(locale, post.slug)}`,
      lastModified: new Date(`${post.updatedAt ?? post.publishedAt}T00:00:00Z`),
      priority: 0.6,
    })),
  ]);

  /**
   * Each language's category pages (/it/blog/category/<slug>, client
   * 2026-10-15), by the same rule as the English ones: only those with a post
   * in that language, dated by its newest. A language's page with none in it
   * is marked noindex and is not listed.
   */
  const translatedCategories: MetadataRoute.Sitemap = otherLanguages.flatMap(({ locale, posts: list }) => {
    const newest = new Map<string, string>();
    for (const post of list) {
      const date = post.updatedAt ?? post.publishedAt;
      const seen = newest.get(post.categorySlug);
      if (!seen || date > seen) newest.set(post.categorySlug, date);
    }
    return [...newest].map(([slug, date]) => ({
      url: `${base}${categoryPath(locale, slug)}`,
      lastModified: new Date(`${date}T00:00:00Z`),
      priority: 0.4,
    }));
  });

  return [...pages, ...tools, ...docs, ...posts, ...categories, ...translated, ...translatedPosts, ...translatedCategories];
}
