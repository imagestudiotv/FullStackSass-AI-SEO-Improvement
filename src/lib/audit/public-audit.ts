import { and, eq, gte, sql as raw } from "drizzle-orm";

import { auditPage, auditSite, scoreAudit, type Issue } from "@/lib/audit/rules";
import { crawlSite } from "@/lib/audit/crawler";
import { db } from "@/lib/db";
import { providerCache } from "@/lib/db/schema";
import { normalizeWebsiteUrl, InvalidUrlError } from "@/lib/websites/url";
import {
  detectPlatform,
  parseCrawlerAccess,
  type CrawlerAccess,
} from "@/lib/audit/ai-crawlers";

/**
 * Free public audit — the lead magnet.
 *
 * Runs with no account, which makes it the only endpoint in the product that
 * an anonymous visitor can use to make our server fetch arbitrary websites.
 * Everything here exists to keep that from being abused:
 *
 *  - a small page cap, so one request cannot tie up a worker
 *  - a global rate limit, so it cannot be used as a crawling proxy
 *  - results cached per domain, so repeat visits cost nothing
 *
 * It deliberately shows fewer findings than the signed-in audit. The point is
 * to demonstrate that we found real problems, then let the visitor sign up to
 * see the rest.
 */

/** Public runs crawl far fewer pages than the authenticated audit's 25. */
const PUBLIC_MAX_PAGES = 5;

/** Cached results are reused for a day; a site rarely changes faster. */
const CACHE_HOURS = 24;

/** Findings shown before signing up. */
export const PUBLIC_ISSUE_LIMIT = 5;

/**
 * Audits allowed per hour across all visitors.
 *
 * Deliberately global rather than per-IP: an attacker rotates IPs trivially,
 * and the resource being protected is our own crawl capacity and the goodwill
 * of the sites being crawled. A legitimate visitor is never near this.
 */
const HOURLY_LIMIT = 60;

/**
 * One kind of problem, with every page it affects.
 *
 * The audit reports per page, which is right for fixing but wrong for reading:
 * five pages each missing a description produced five identical rows, so the
 * free result spent its whole five-finding budget saying one thing. Grouping
 * shows five DIFFERENT problems and names the pages under each.
 */
export type GroupedIssue = {
  type: string;
  severity: Issue["severity"];
  /** Detail from the first occurrence — they read the same within a type. */
  detail: string;
  /** Pages affected, capped for display. */
  urls: string[];
  /** Total affected, including any beyond `urls`. */
  pageCount: number;
};

/** Pages listed under a single grouped finding before it says "and N more". */
const URLS_PER_ISSUE = 3;

/** Groups per-page issues by type, preserving severity order. */
function groupIssues(issues: Issue[]): GroupedIssue[] {
  const groups = new Map<string, GroupedIssue>();

  for (const issue of issues) {
    const existing = groups.get(issue.type);
    if (existing) {
      existing.pageCount += 1;
      if (issue.url && existing.urls.length < URLS_PER_ISSUE) {
        existing.urls.push(issue.url);
      }
      continue;
    }
    groups.set(issue.type, {
      type: issue.type,
      severity: issue.severity,
      detail: issue.detail,
      urls: issue.url ? [issue.url] : [],
      pageCount: 1,
    });
  }

  return [...groups.values()];
}

export type PublicAuditResult = {
  domain: string;
  score: number;
  pagesChecked: number;
  counts: { critical: number; warning: number; info: number };
  /** Grouped by type and trimmed to PUBLIC_ISSUE_LIMIT. */
  issues: GroupedIssue[];
  /** How many findings exist beyond the ones shown. */
  hiddenIssues: number;
  cached: boolean;

  /* --- context, all read from the site itself ------------------------- */

  /** Site name from og:site_name or the homepage title. */
  siteName: string | null;
  /** Language the page declares, when it declares one. */
  language: string | null;
  /** Platform guessed from markup fingerprints; null when unrecognised. */
  platform: string | null;
  /** Which AI crawlers robots.txt lets through. */
  crawlers: CrawlerAccess[];
  /** Outbound hosts the site links to — a weak but free competitor signal. */
  linkedHosts: string[];
};

export type PublicAuditError =
  | { kind: "invalid_url"; message: string }
  | { kind: "rate_limited"; message: string }
  | { kind: "unreachable"; message: string };

export type PublicAuditOutcome =
  | { ok: true; result: PublicAuditResult }
  | { ok: false; error: PublicAuditError };

/** Cache key. provider_cache is already unique on params_hash. */
function cacheKeyFor(domain: string): string {
  // Versioned: cached entries hold a shaped result, so a change to
  // PublicAuditResult must not be read back into the new UI. Bump on shape
  // changes — v2 added grouped issues and the crawler/platform context.
  return `public-audit:v2:${domain}`;
}

async function readCached(domain: string): Promise<PublicAuditResult | null> {
  const [row] = await db
    .select({ response: providerCache.response })
    .from(providerCache)
    .where(
      and(
        eq(providerCache.paramsHash, cacheKeyFor(domain)),
        gte(providerCache.expiresAt, new Date()),
      ),
    )
    .limit(1);

  const cached = row?.response as PublicAuditResult | undefined;
  return cached ? { ...cached, cached: true } : null;
}

async function withinRateLimit(): Promise<boolean> {
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const [row] = await db
    .select({ n: raw<number>`count(*)::int` })
    .from(providerCache)
    .where(
      and(
        eq(providerCache.provider, "public-audit"),
        gte(providerCache.createdAt, since),
      ),
    );
  return (row?.n ?? 0) < HOURLY_LIMIT;
}

/**
 * Runs a free audit for a domain.
 *
 * Never throws for expected conditions — a bad URL, an unreachable site or a
 * rate limit all come back as a typed error the page can render, because this
 * is a marketing page and a stack trace would be a poor first impression.
 */
export async function runPublicAudit(
  input: string,
): Promise<PublicAuditOutcome> {
  let normalized;
  try {
    normalized = normalizeWebsiteUrl(input);
  } catch (error) {
    return {
      ok: false,
      error: {
        kind: "invalid_url",
        message:
          error instanceof InvalidUrlError
            ? error.message
            : "Enter a valid website address",
      },
    };
  }

  const cached = await readCached(normalized.domain);
  if (cached) return { ok: true, result: cached };

  if (!(await withinRateLimit())) {
    return {
      ok: false,
      error: {
        kind: "rate_limited",
        message:
          "We are checking a lot of websites right now. Please try again in a few minutes.",
      },
    };
  }

  let crawl;
  try {
    crawl = await crawlSite(normalized.url, PUBLIC_MAX_PAGES);
  } catch {
    return {
      ok: false,
      error: {
        kind: "unreachable",
        message:
          "We could not reach that website. Check the address and try again.",
      },
    };
  }

  if (crawl.pages.length === 0) {
    return {
      ok: false,
      error: {
        kind: "unreachable",
        message:
          "We could not read any pages on that website. It may be blocking automated visitors.",
      },
    };
  }

  /**
   * robots.txt, for the AI crawler check. Fetched separately and tolerated on
   * failure: a missing robots.txt means everything is allowed, which is a real
   * answer rather than an error.
   */
  const robotsTxt = await fetchRobotsTxt(normalized.url);

  const home = crawl.pages[0];

  const issues = [
    ...crawl.pages.flatMap(auditPage),
    ...auditSite(crawl.pages),
  ];
  const summary = scoreAudit(issues, crawl.pages.length);

  /**
   * Most serious first, so the five shown are the five worth acting on rather
   * than whichever happened to be found first.
   */
  const rank: Record<string, number> = { critical: 0, warning: 1, info: 2 };
  const ordered = groupIssues(
    [...issues].sort((a, b) => (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9)),
  );

  /**
   * Hosts the site links out to, most linked first. A genuinely weak signal —
   * it catches partners and payment providers as readily as competitors — so
   * the UI labels it "sites you link to" rather than claiming these are rivals.
   */
  const hostCounts = new Map<string, number>();
  for (const page of crawl.pages) {
    for (const host of page.externalHosts ?? []) {
      hostCounts.set(host, (hostCounts.get(host) ?? 0) + 1);
    }
  }

  const result: PublicAuditResult = {
    domain: normalized.domain,
    score: summary.score,
    pagesChecked: crawl.pages.length,
    counts: summary.counts,
    issues: ordered.slice(0, PUBLIC_ISSUE_LIMIT),
    hiddenIssues: Math.max(ordered.length - PUBLIC_ISSUE_LIMIT, 0),
    cached: false,
    siteName: home?.ogSiteName ?? home?.title ?? null,
    language: home?.lang ?? null,
    // Asset and link URLs carry the fingerprints; visible text does not.
    platform: home
      ? detectPlatform([
          ...(home.images ?? []).map((i) => i.src),
          ...(home.internalUrls ?? []),
        ])
      : null,
    crawlers: parseCrawlerAccess(robotsTxt),
    linkedHosts: [...hostCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([host]) => host),
  };

  // Cached under the same table the paid providers use; the unique index on
  // params_hash makes a repeat write an update rather than a duplicate.
  await db
    .insert(providerCache)
    .values({
      provider: "public-audit",
      endpoint: "audit",
      paramsHash: cacheKeyFor(normalized.domain),
      response: result,
      expiresAt: new Date(Date.now() + CACHE_HOURS * 3600 * 1000),
    })
    .onConflictDoUpdate({
      target: providerCache.paramsHash,
      set: {
        response: result,
        expiresAt: new Date(Date.now() + CACHE_HOURS * 3600 * 1000),
        createdAt: new Date(),
      },
    });

  return { ok: true, result };
}

/**
 * Fetches robots.txt, returning null when there is none.
 *
 * Short timeout and a small cap: this is one extra request on a page a visitor
 * is already waiting on, and a site that hangs serving robots.txt should not
 * hold up the whole audit.
 */
async function fetchRobotsTxt(siteUrl: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(
      `${new URL(siteUrl).origin}/robots.txt`,
      {
        signal: controller.signal,
        headers: { accept: "text/plain", "user-agent": "SEOVisionBot/1.0" },
      },
    );
    if (!response.ok) return null;
    return (await response.text()).slice(0, 200_000);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
