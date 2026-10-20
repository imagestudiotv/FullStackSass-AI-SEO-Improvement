import "server-only";

import * as cheerio from "cheerio";
import { and, eq, isNotNull, isNull } from "drizzle-orm";

import { blogPath } from "@/lib/blog/locale";
import { db } from "@/lib/db";
import { blogPosts } from "@/lib/db/schema";
import { DEFAULT_LOCALE, LOCALES, localePath, type Locale } from "@/lib/i18n/config";
import { siteUrl } from "@/lib/site-url";

import { blogSiteHosts, RESERVED_SLUGS } from "./post-fields";

/**
 * A translation's links lead to the same pages in its language (client,
 * 2026-10-20: "Article in other languages are providing contextual
 * backlinks only for english links, it should link the respective language
 * instead" - every translation was being corrected by hand).
 *
 * Each link to RepGet's own site, however it was written:
 *  - a blog post: its translation in that language, when one is published;
 *    otherwise the link goes and its words stay, so a Spanish reader is not
 *    sent to an English article (what the client did by hand);
 *  - a page that exists in every language (the free audit, the tools,
 *    pricing...: TRANSLATED_PATHS): that language's version;
 *  - any other page: unchanged, since it exists only in English.
 * Written as the full https://www.repget.com address, like the blog's own
 * posts. Links to other sites, #anchors and mailto: are left alone.
 *
 * Used by both kinds of translation: the autopilot's (before the body is
 * translated, so the translator keeps the right links) and the editor's
 * "Draft with AI" / "Copy" (lib/admin/blog.ts createBlogTranslation).
 */

export type LinkTargets = {
  /** "https://www.repget.com". */
  origin: string;
  /** RepGet's hosts, with and without www. */
  hosts: string[];
  /**
   * Every published post's address (in any language) -> its published
   * translation's address in the target language, or null when it has none.
   * Pairs, so it survives being memoised as JSON by an Inngest step.
   */
  posts: [string, string | null][];
};

const LOCALE_PREFIX = new RegExp(`^/(?:${LOCALES.filter((locale) => locale !== DEFAULT_LOCALE).join("|")})(?=/|$)`);

/** The same link for a reader of `locale`: its new address, or null when it should go (its words stay). */
export function localizeHref(href: string, locale: Locale, targets: LinkTargets): string | null {
  const raw = href.trim();
  // Only full addresses and site paths: "#faq", "mailto:", a bare "page" are not links to another page of ours.
  if (!/^(?:https?:)?\/\//i.test(raw) && !raw.startsWith("/")) return href;
  let url: URL;
  try {
    url = new URL(raw, targets.origin);
  } catch {
    return href;
  }
  if (!/^https?:$/.test(url.protocol) || !targets.hosts.includes(url.hostname.toLowerCase())) return href;

  // Its English address, whatever language it pointed at.
  const path = (url.pathname.replace(LOCALE_PREFIX, "") || "/").replace(/(.)\/+$/, "$1");
  const suffix = `${url.search}${url.hash}`;
  const post = /^\/blog\/([^/]+)$/.exec(path);
  if (post && !RESERVED_SLUGS.has(post[1])) {
    const known = targets.posts.find(([slug]) => slug === post[1]);
    // Not a published post we know (a draft, a mistyped address): left as it was.
    if (!known) return href;
    return known[1] ? `${targets.origin}${blogPath(locale, known[1])}${suffix}` : null;
  }
  return `${targets.origin}${localePath(locale, `${path}${suffix}`)}`;
}

/** The HTML with every link to RepGet's own site pointed at `locale`'s pages (see the top). Unchanged HTML comes back as it was. */
export function localizeLinks(html: string, locale: Locale, targets: LinkTargets): string {
  if (!/<a\s/i.test(html)) return html;
  const $ = cheerio.load(html, null, false);
  let changed = false;
  for (const el of $("a[href]").toArray()) {
    const href = $(el).attr("href") ?? "";
    const next = localizeHref(href, locale, targets);
    if (next === href) continue;
    changed = true;
    if (next === null) $(el).replaceWith($(el).contents());
    else $(el).attr("href", next);
  }
  return changed ? $.html() : html;
}

/** What `localizeLinks` needs for one language: the site's address and every published post's address in it. */
export async function blogLinkTargets(locale: Locale): Promise<LinkTargets> {
  const english = await db
    .select({ id: blogPosts.id, slug: blogPosts.slug })
    .from(blogPosts)
    .where(and(eq(blogPosts.status, "published"), eq(blogPosts.locale, DEFAULT_LOCALE), isNull(blogPosts.translationOf)));
  const translated = await db
    .select({ of: blogPosts.translationOf, slug: blogPosts.slug, locale: blogPosts.locale })
    .from(blogPosts)
    .where(and(eq(blogPosts.status, "published"), isNotNull(blogPosts.translationOf)));

  const posts: [string, string | null][] = [];
  for (const post of english) {
    const versions = translated.filter((version) => version.of === post.id);
    const target = locale === DEFAULT_LOCALE ? post.slug : (versions.find((version) => version.locale === locale)?.slug ?? null);
    for (const slug of [post.slug, ...versions.map((version) => version.slug)]) posts.push([slug, target]);
  }
  return { origin: new URL(siteUrl()).origin, hosts: [...blogSiteHosts()], posts };
}
