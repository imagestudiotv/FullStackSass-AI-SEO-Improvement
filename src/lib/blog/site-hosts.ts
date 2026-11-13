import { siteUrl } from "@/lib/site-url";

/**
 * RepGet's own hosts, with and without www. Links to them stay followed
 * internal links (lib/articles/sanitize.ts): every other absolute link in a
 * post becomes target=_blank rel="noopener nofollow".
 *
 * Its own module, not server-only, because the post is sanitised twice - on
 * save (lib/blog/post-fields.ts) and again when drawn (components/
 * blog-article.tsx, which the admin editor's preview also runs in the
 * browser).
 */
export function blogSiteHosts(): Set<string> {
  const host = new URL(siteUrl()).hostname.toLowerCase();
  return new Set([host, host.startsWith("www.") ? host.slice(4) : `www.${host}`]);
}
