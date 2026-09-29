import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import { domainMetrics } from "@/lib/db/schema";
import { isDataForSeoConfigured } from "@/lib/providers/dataforseo";

/**
 * THE authority metric RepGet shows, everywhere it shows one.
 *
 * DataForSEO Rank from the DataForSEO Backlinks API (bulk_ranks), on its
 * 0-100 scale: a score DataForSEO computes from the referring domains that
 * point at a domain. It is DataForSEO's own measure. It is NOT Ahrefs'
 * Domain Rating, Moz's Domain Authority or anything else, and is never
 * labelled as one - the label, provider and scale travel with every value.
 *
 * A website-health audit score is NOT authority either: it measures the
 * site's own technical state, not how the web links to it. The two are shown
 * as separate figures.
 */
export const AUTHORITY_METRIC = {
  provider: "dataforseo",
  metric: "backlinks_rank",
  scaleMax: 100,
  /**
   * How it is named in the interface. The client's decision (2026-09-29):
   * "Domain Authority", and the provider is never named to customers.
   */
  label: "Domain Authority",
  docsUrl: "https://docs.dataforseo.com/v3/backlinks/bulk_ranks/live/",
} as const;

/** A value older than this is shown as stale and collected again. */
export const AUTHORITY_STALE_AFTER_DAYS = 30;

/**
 * What we know about one domain's authority.
 *
 *   ok             - a value from the provider (maybe stale: see `stale`);
 *   no_data        - the provider answered and has nothing for the domain;
 *   collecting     - queued for the next background collection;
 *   no_access      - the DataForSEO account does not include the Backlinks
 *                    API (an operator must enable it - nothing is bought here);
 *   error          - the last collection failed; retried automatically;
 *   not_configured - no DataForSEO credentials on this deployment.
 *
 * Never a zero standing in for "unknown".
 */
export type AuthorityStatus = "ok" | "no_data" | "collecting" | "no_access" | "error" | "not_configured";

export type AuthorityReading = {
  domain: string;
  status: AuthorityStatus;
  value: number | null;
  scaleMax: number;
  observedAt: Date | null;
  /** True when the value is older than AUTHORITY_STALE_AFTER_DAYS. */
  stale: boolean;
  /*
    No error text: readings go to customers' pages (and into the page data a
    browser receives), and the provider's own messages name the provider.
    Operators see the last error on /admin/network/operations.
  */
};

/** Registrable-ish host as DataForSEO wants it: lower case, no www., no port. */
export function normalizeDomain(input: string | null | undefined): string | null {
  if (!input) return null;
  let host = input.trim().toLowerCase();
  try {
    if (host.includes("://")) host = new URL(host).hostname;
  } catch {
    return null;
  }
  host = host.replace(/^www\./, "").replace(/:\d+$/, "").replace(/\.$/, "");
  if (!/^[a-z0-9.-]+\.[a-z0-9-]{2,}$/.test(host)) return null;
  return host;
}

function reading(domain: string, row: typeof domainMetrics.$inferSelect | undefined, now: Date): AuthorityReading {
  const configured = isDataForSeoConfigured();
  const base = { domain, scaleMax: AUTHORITY_METRIC.scaleMax };
  if (!row) {
    return { ...base, status: configured ? "collecting" : "not_configured", value: null, observedAt: null, stale: false };
  }
  const stale =
    row.observedAt !== null && now.getTime() - row.observedAt.getTime() > AUTHORITY_STALE_AFTER_DAYS * 86_400_000;
  // A value we have keeps being shown after a later failed refresh - marked stale when it is.
  if (row.value !== null && row.observedAt) {
    return { ...base, status: "ok", value: row.value, observedAt: row.observedAt, stale };
  }
  const status: AuthorityStatus =
    row.status === "pending" ? (configured ? "collecting" : "not_configured")
    : row.status === "no_data" ? "no_data"
    : row.status === "no_access" ? "no_access"
    : row.status === "error" ? "error"
    : configured ? "collecting" : "not_configured";
  return { ...base, status, value: null, observedAt: row.observedAt, stale: false };
}

/**
 * Stored readings for these domains. READ ONLY - never calls the provider,
 * so a page view or a table page costs nothing; collection runs in the
 * background (lib/authority/collect.ts). Bounded to 500 domains per call.
 */
export async function readAuthority(domains: Array<string | null | undefined>, now: Date = new Date()): Promise<Map<string, AuthorityReading>> {
  const wanted = [...new Set(domains.map(normalizeDomain).filter((d): d is string => Boolean(d)))].slice(0, 500);
  const result = new Map<string, AuthorityReading>();
  if (wanted.length === 0) return result;
  const rows = await db
    .select()
    .from(domainMetrics)
    .where(
      and(
        inArray(domainMetrics.domain, wanted),
        eq(domainMetrics.provider, AUTHORITY_METRIC.provider),
        eq(domainMetrics.metric, AUTHORITY_METRIC.metric),
      ),
    );
  const byDomain = new Map(rows.map((row) => [row.domain, row]));
  for (const domain of wanted) result.set(domain, reading(domain, byDomain.get(domain), now));
  return result;
}

/** One domain's reading (see readAuthority). */
export async function readOneAuthority(domain: string | null | undefined): Promise<AuthorityReading | null> {
  const normalized = normalizeDomain(domain);
  if (!normalized) return null;
  return (await readAuthority([normalized])).get(normalized) ?? null;
}
