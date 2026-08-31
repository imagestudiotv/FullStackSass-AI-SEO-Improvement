import { and, eq, gte, sql as raw } from "drizzle-orm";

import { auditPage, auditSite, scoreAudit, type Issue } from "@/lib/audit/rules";
import { crawlSite } from "@/lib/audit/crawler";
import { db } from "@/lib/db";
import { providerCache } from "@/lib/db/schema";
import { normalizeWebsiteUrl, InvalidUrlError } from "@/lib/websites/url";

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

export type PublicAuditResult = {
  domain: string;
  score: number;
  pagesChecked: number;
  counts: { critical: number; warning: number; info: number };
  /** Trimmed to PUBLIC_ISSUE_LIMIT. */
  issues: Issue[];
  /** How many findings exist beyond the ones shown. */
  hiddenIssues: number;
  cached: boolean;
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
  return `public-audit:${domain}`;
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
  const ordered = [...issues].sort(
    (a, b) => (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9),
  );

  const result: PublicAuditResult = {
    domain: normalized.domain,
    score: summary.score,
    pagesChecked: crawl.pages.length,
    counts: summary.counts,
    issues: ordered.slice(0, PUBLIC_ISSUE_LIMIT),
    hiddenIssues: Math.max(ordered.length - PUBLIC_ISSUE_LIMIT, 0),
    cached: false,
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
