import type { MetadataRoute } from "next";

import { listPosts } from "@/lib/blog/posts";
import { localePath, PREFIXED_LOCALES } from "@/lib/i18n/config";

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
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "");
  if (configured && !configured.includes("localhost")) return configured;
  return "https://seovision.io";
}

export default function sitemap(): MetadataRoute.Sitemap {
  const base = baseUrl();
  const now = new Date();

  const pages: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, priority: 1 },
    { url: `${base}/audit`, lastModified: now, priority: 0.9 },
    { url: `${base}/pricing`, lastModified: now, priority: 0.8 },
    { url: `${base}/tools`, lastModified: now, priority: 0.8 },
    {
      url: `${base}/tools/snippet-preview`,
      lastModified: now,
      priority: 0.6,
    },
    // The results page takes a query parameter, so only the form is listed.
    {
      url: `${base}/tools/robots-checker`,
      lastModified: now,
      priority: 0.6,
    },
    { url: `${base}/blog`, lastModified: now, priority: 0.8 },
    {
      url: `${base}/backlink-exchange`,
      lastModified: now,
      priority: 0.7,
    },
    { url: `${base}/publishers`, lastModified: now, priority: 0.7 },
    { url: `${base}/affiliate`, lastModified: now, priority: 0.6 },
    { url: `${base}/faq`, lastModified: now, priority: 0.6 },
    { url: `${base}/about`, lastModified: now, priority: 0.5 },
    { url: `${base}/contact`, lastModified: now, priority: 0.4 },
    { url: `${base}/privacy`, lastModified: now, priority: 0.2 },
    { url: `${base}/terms`, lastModified: now, priority: 0.2 },
    { url: `${base}/refunds`, lastModified: now, priority: 0.2 },
  ];

  const posts: MetadataRoute.Sitemap = listPosts().map((post) => ({
    url: `${base}/blog/${post.slug}`,
    // The post's own date, not the build's: a build date on every URL tells a
    // crawler everything changed, which is both false and unhelpful.
    lastModified: new Date(`${post.updatedAt ?? post.publishedAt}T00:00:00Z`),
    priority: 0.7,
  }));

  /**
   * Translated pages. Listed so search engines find them without having to
   * discover the prefix by following a switcher link, which they may not.
   * Only the paths that actually exist in every locale.
   */
  const translated: MetadataRoute.Sitemap = PREFIXED_LOCALES.flatMap((locale) =>
    ["/", "/pricing"].map((path) => ({
      url: `${base}${localePath(locale, path)}`,
      lastModified: now,
      priority: path === "/" ? 0.9 : 0.7,
    })),
  );

  return [...pages, ...posts, ...translated];
}
