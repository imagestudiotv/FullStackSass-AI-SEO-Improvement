import { and, eq, isNotNull } from "drizzle-orm";

import { inScope, type LinkTarget, type SiteScope } from "@/lib/articles/link-guard";
import { keyWords, overlap, pathWords } from "@/lib/articles/link-words";
import { cachedPages, fetchWithinScope, verifyUrls, type VerifyOptions } from "@/lib/articles/link-verify";
import { extractLocs, isSitemapIndex, isUsefulPath } from "@/lib/backlinks/sitemap";
import { db } from "@/lib/db";
import { articles, pages } from "@/lib/db/schema";

/**
 * The pages an article may link to on its own website: candidates from what
 * we already know, each VERIFIED before it can become a link.
 *
 * Candidates come from:
 *  - pages our crawl fetched successfully (2xx; a 404 page has a title too,
 *    and used to be offered as a target);
 *  - articles we published there, at the URL the CMS or plugin reported;
 *  - pages already verified for this website (the cache);
 *  - the site's own sitemap: the configured sitemapUrl, else the Sitemap:
 *    lines in robots.txt, else the usual WordPress locations. Bounded: a few
 *    files, a few child sitemaps, a few hundred entries.
 *
 * A sitemap entry is only a candidate - sitemaps go stale. The most relevant
 * candidates are then checked (link-verify.ts), and only pages that answer as
 * real pages on this site come back as targets.
 */

/** A candidate must share this many distinctive words with the article. */
const MIN_OVERLAP = 2;
/** Sitemap files fetched per discovery, robots.txt included. */
const MAX_SITEMAP_FETCHES = 8;
/** Child sitemaps followed from an index. */
const MAX_CHILD_SITEMAPS = 5;
/** Entries read from sitemaps. */
const MAX_SITEMAP_ENTRIES = 500;
const MAX_SITEMAP_BYTES = 2 * 1024 * 1024;
/** Pages verified per article. */
const MAX_VERIFY = 12;
/** A crawl older than this is not considered a sign the page still exists. */
const CRAWL_FRESHNESS_MS = 60 * 24 * 60 * 60 * 1000;

type Candidate = { url: string; title: string | null };

/**
 * A page's own name, without the site name most titles end with
 * ("Destination Wedding Photography | ImageStudio"). Otherwise the brand
 * name, which appears all over an article, becomes the anchor text.
 */
export function pageTitle(title: string | null): string | null {
  if (!title) return null;
  const first = title.split(/\s+[|–—·•]\s+|\s+-\s+/)[0]?.trim();
  return first || title.trim() || null;
}

/** Sitemap files to try, most authoritative first. */
async function sitemapSources(scope: SiteScope, configured: string | null, options: VerifyOptions): Promise<string[]> {
  if (configured && inScope(configured, scope)) return [configured];

  const fromRobots: string[] = [];
  const robots = await fetchWithinScope(
    `${scope.origin}/robots.txt`,
    scope,
    { maxBytes: 64 * 1024, readBody: () => true },
    options,
  );
  if (robots.ok && robots.body) {
    for (const match of robots.body.matchAll(/^\s*sitemap:\s*(\S+)/gim)) {
      if (inScope(match[1], scope)) fromRobots.push(match[1]);
    }
  }
  const common = ["/wp-sitemap.xml", "/sitemap_index.xml", "/sitemap.xml"].map((path) => `${scope.origin}${path}`);
  return [...new Set([...fromRobots.slice(0, 3), ...common])];
}

/** Child sitemaps worth reading: pages and posts before tags, authors and archives. */
function childOrder(loc: string): number {
  if (/(tag|categor|author|user|taxonom|archive|attachment|product_cat)/i.test(loc)) return 3;
  if (/page/i.test(loc)) return 0;
  if (/post/i.test(loc)) return 1;
  return 2;
}

/** Page URLs listed in the site's sitemap, bounded. */
export async function sitemapCandidates(
  scope: SiteScope,
  configured: string | null,
  options: VerifyOptions = {},
): Promise<string[]> {
  let fetches = 0;
  const read = async (url: string): Promise<string | null> => {
    if (fetches >= MAX_SITEMAP_FETCHES || !inScope(url, scope)) return null;
    fetches += 1;
    const result = await fetchWithinScope(url, scope, { maxBytes: MAX_SITEMAP_BYTES, readBody: () => true }, options);
    if (!result.ok || !result.body || !/<(urlset|sitemapindex)\b/i.test(result.body)) return null;
    return result.body;
  };

  for (const source of await sitemapSources(scope, configured, options)) {
    const xml = await read(source);
    if (!xml) continue;

    let entries = extractLocs(xml).map((entry) => entry.loc);
    if (isSitemapIndex(xml)) {
      const children = [...entries].sort((a, b) => childOrder(a) - childOrder(b)).slice(0, MAX_CHILD_SITEMAPS);
      entries = [];
      for (const child of children) {
        const childXml = await read(child);
        if (childXml && !isSitemapIndex(childXml)) entries.push(...extractLocs(childXml).map((entry) => entry.loc));
        if (entries.length >= MAX_SITEMAP_ENTRIES) break;
      }
    }

    const urls = entries.filter((url) => {
      if (!inScope(url, scope)) return false;
      try {
        return isUsefulPath(new URL(url).pathname);
      } catch {
        return false;
      }
    });
    return [...new Set(urls)].slice(0, MAX_SITEMAP_ENTRIES);
  }
  return [];
}

export type InventoryInput = {
  websiteId: string;
  scope: SiteScope;
  sitemapUrl: string | null;
  /** What the article is about: its title and target keyword. */
  subject: string;
  /** Never offered: the article itself. */
  excludeUrls?: string[];
  /** How many targets are wanted (the website's internalLinkTarget). */
  limit: number;
};

/**
 * Verified pages this article may link to, most relevant first. Empty when
 * nothing relevant is verifiably there - which is a normal outcome, and the
 * article is then published without automatic internal links.
 */
export async function findVerifiedTargets(input: InventoryInput, options: VerifyOptions = {}): Promise<LinkTarget[]> {
  if (input.limit <= 0) return [];
  const { websiteId, scope } = input;
  const now = (options.now ?? (() => new Date()))();

  const crawled = await db
    .select({ url: pages.url, title: pages.title, statusCode: pages.statusCode, crawledAt: pages.crawledAt })
    .from(pages)
    .where(eq(pages.websiteId, websiteId));
  const published = await db
    .select({ url: articles.publishedUrl, title: articles.title })
    .from(articles)
    .where(and(eq(articles.websiteId, websiteId), eq(articles.status, "published"), isNotNull(articles.publishedUrl)));
  const verified = await cachedPages(websiteId, now);

  const candidates: Candidate[] = [
    ...verified.filter((v) => v.isHtml).map((v) => ({ url: v.finalUrl ?? v.url, title: v.title })),
    ...crawled
      .filter(
        (row) =>
          row.statusCode !== null &&
          row.statusCode >= 200 &&
          row.statusCode < 300 &&
          (!row.crawledAt || now.getTime() - row.crawledAt.getTime() < CRAWL_FRESHNESS_MS),
      )
      .map((row) => ({ url: row.url, title: row.title })),
    ...published.map((row) => ({ url: row.url as string, title: row.title })),
  ];

  const subjectWords = keyWords(input.subject);
  const excluded = new Set(input.excludeUrls ?? []);
  const scoreOf = (candidate: Candidate) =>
    overlap(subjectWords, new Set([...keyWords(candidate.title ?? ""), ...keyWords(pathWords(candidate.url))]));

  const ranked = new Map<string, { candidate: Candidate; score: number }>();
  const consider = (candidate: Candidate) => {
    if (!inScope(candidate.url, scope) || excluded.has(candidate.url)) return;
    try {
      if (!isUsefulPath(new URL(candidate.url).pathname)) return;
    } catch {
      return;
    }
    const score = scoreOf(candidate);
    if (score < MIN_OVERLAP) return;
    const existing = ranked.get(candidate.url);
    if (!existing || score > existing.score) ranked.set(candidate.url, { candidate, score });
  };
  candidates.forEach(consider);

  // The sitemap only when what we already know is not enough.
  if (ranked.size < input.limit) {
    const listed = await sitemapCandidates(scope, input.sitemapUrl, options);
    listed.forEach((url) => consider({ url, title: null }));
  }

  const shortlist = [...ranked.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.min(MAX_VERIFY, Math.max(input.limit * 3, input.limit)));
  if (shortlist.length === 0) return [];

  const verdicts = await verifyUrls(
    websiteId,
    shortlist.map((entry) => entry.candidate.url),
    scope,
    options,
  );

  const targets = new Map<string, LinkTarget>();
  for (const { candidate } of shortlist) {
    const verdict = verdicts.get(candidate.url);
    if (!verdict || verdict.status !== "ok" || !verdict.isHtml) continue;
    const url = verdict.finalUrl ?? candidate.url;
    if (excluded.has(url) || targets.has(url)) continue;
    const title = pageTitle(verdict.title ?? candidate.title) ?? pathWords(url);
    // Scored again on what the page actually says it is.
    const score = overlap(subjectWords, new Set([...keyWords(title), ...keyWords(pathWords(url))]));
    if (score >= MIN_OVERLAP) targets.set(url, { url, title, score });
  }
  return [...targets.values()].sort((a, b) => b.score - a.score);
}
