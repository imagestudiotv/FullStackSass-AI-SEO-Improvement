import type { MetadataRoute } from "next";

import { listPosts } from "@/lib/blog/posts";

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
    { url: `${base}/blog`, lastModified: now, priority: 0.8 },
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

  return [...pages, ...posts];
}
