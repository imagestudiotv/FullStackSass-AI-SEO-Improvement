import "server-only";

import { and, asc, eq, inArray, lte, sql } from "drizzle-orm";

import { AUTHORITY_METRIC, AUTHORITY_STALE_AFTER_DAYS, normalizeDomain } from "@/lib/authority/metric";
import { paidCall, releaseUnspent, reserve } from "@/lib/billing/spend-quota";
import { db } from "@/lib/db";
import { domainMetrics } from "@/lib/db/schema";
import { bulkDomainRanks, DataForSeoError, isDataForSeoConfigured } from "@/lib/providers/dataforseo";

/**
 * Background collection of the authority metric (lib/authority/metric.ts).
 *
 * COST CONTROL, in layers:
 *   - Only domains that matter are tracked: Partner Network websites with a
 *     paying subscription, and the websites that link to them. Nothing a
 *     visitor does adds a domain.
 *   - Each domain is ONE shared row (domain_metrics is global, like the
 *     provider cache), collected at most once per AUTHORITY_STALE_AFTER_DAYS.
 *   - Up to MAX_DOMAINS_PER_RUN domains go in ONE bulk_ranks request.
 *   - Every request takes a spend reservation first (lib/billing/spend-quota.ts,
 *     key authority:dataforseo), capped per day by AUTHORITY_DAILY_REQUESTS;
 *     a request DataForSEO provably refused (e.g. 40204, no Backlinks API
 *     access) hands its reservation back.
 *   - Failures back off; an account without Backlinks API access is not asked
 *     again for a week.
 *
 * Page views, table pages and filters only READ domain_metrics.
 */

export const MAX_DOMAINS_PER_RUN = 200;
const TRACKED_DOMAIN_LIMIT = 2000;
const NO_ACCESS_RETRY_DAYS = 7;

/** Requests per day when AUTHORITY_DAILY_REQUESTS is not set. */
export const DEFAULT_DAILY_REQUESTS = 4;

export type DailyRequestLimit = { limit: number; source: "default" | "configured" | "disabled" | "invalid" };

/**
 * AUTHORITY_DAILY_REQUESTS, read deliberately:
 *
 *   unset or blank        - the default, 4 requests a day;
 *   "0"                   - collection disabled;
 *   a whole number ("12") - that many a day;
 *   anything else ("-1", "2.5", "abc", "1e3", "0x10") - INVALID: collection
 *     is disabled (nothing is spent on a value nobody meant) and the
 *     operations page says the setting is invalid.
 *
 * This used to read an unset variable as Number("") = 0, which silently
 * disabled collection on every deployment that did not set it - the
 * documented default of 4 never applied.
 */
export function parseDailyRequestLimit(raw: string | undefined | null): DailyRequestLimit {
  const value = (raw ?? "").trim();
  if (value === "") return { limit: DEFAULT_DAILY_REQUESTS, source: "default" };
  if (!/^\d+$/.test(value)) return { limit: 0, source: "invalid" };
  const limit = Number(value);
  if (!Number.isSafeInteger(limit)) return { limit: 0, source: "invalid" };
  return limit === 0 ? { limit: 0, source: "disabled" } : { limit, source: "configured" };
}

export function dailyRequestLimit(): DailyRequestLimit {
  return parseDailyRequestLimit(process.env.AUTHORITY_DAILY_REQUESTS);
}

const days = (n: number) => n * 86_400_000;

/**
 * The domains worth knowing: Partner Network websites with a live
 * subscription, and every website that hosts a link to one of them.
 */
export async function trackedDomains(): Promise<string[]> {
  const result = await db.execute(sql`
    select domain from (
      select w.domain
      from websites w
      join network_sites n on n.website_id = w.id
      where exists (
        select 1 from subscriptions s
        where s.website_id = w.id and s.status in ('active', 'trialing', 'past_due')
      )
      union
      select h.domain
      from placements p
      join backlink_requests r on r.id = p.request_id
      join websites b on b.id = r.website_id
      join websites h on h.id = p.host_website_id
      where exists (
        select 1 from subscriptions s
        where s.website_id = b.id and s.status in ('active', 'trialing', 'past_due')
      )
    ) tracked
    limit ${TRACKED_DOMAIN_LIMIT}
  `);
  const rows = (Array.isArray(result) ? result : (result as { rows: unknown[] }).rows) as Array<{ domain: string }>;
  return [...new Set(rows.map((r) => normalizeDomain(r.domain)).filter((d): d is string => Boolean(d)))];
}

/** Adds rows for domains not tracked yet. Idempotent; spends nothing. */
export async function enqueueDomains(domains: string[], now: Date = new Date()): Promise<void> {
  const normalized = [...new Set(domains.map(normalizeDomain).filter((d): d is string => Boolean(d)))];
  for (let i = 0; i < normalized.length; i += 500) {
    await db
      .insert(domainMetrics)
      .values(
        normalized.slice(i, i + 500).map((domain) => ({
          domain,
          provider: AUTHORITY_METRIC.provider,
          metric: AUTHORITY_METRIC.metric,
          scaleMax: AUTHORITY_METRIC.scaleMax,
          status: "pending",
          nextAttemptAt: now,
        })),
      )
      .onConflictDoNothing();
  }
}

export type CollectOutcome =
  | { status: "not_configured" }
  /** AUTHORITY_DAILY_REQUESTS=0. */
  | { status: "disabled" }
  /** AUTHORITY_DAILY_REQUESTS is set to something that is not a whole number. */
  | { status: "invalid_limit" }
  | { status: "nothing_due" }
  | { status: "quota_reached" }
  | { status: "collected"; domains: number; withValue: number }
  | { status: "no_access"; domains: number }
  | { status: "failed"; domains: number; error: string };

/** One collection round. Called by the background job only. */
export async function collectDueAuthority(now: Date = new Date()): Promise<CollectOutcome> {
  if (!isDataForSeoConfigured()) return { status: "not_configured" };
  // Decided before anything is requested or reserved.
  const daily = dailyRequestLimit();
  if (daily.source === "disabled") return { status: "disabled" };
  if (daily.source === "invalid") return { status: "invalid_limit" };

  await enqueueDomains(await trackedDomains(), now);

  const due = await db
    .select({ id: domainMetrics.id, domain: domainMetrics.domain, attempts: domainMetrics.attempts })
    .from(domainMetrics)
    .where(
      and(
        eq(domainMetrics.provider, AUTHORITY_METRIC.provider),
        eq(domainMetrics.metric, AUTHORITY_METRIC.metric),
        lte(domainMetrics.nextAttemptAt, now),
      ),
    )
    // Never-collected domains first, then the oldest values.
    .orderBy(sql`${domainMetrics.observedAt} asc nulls first`, asc(domainMetrics.nextAttemptAt))
    .limit(MAX_DOMAINS_PER_RUN);
  if (due.length === 0) return { status: "nothing_due" };

  const reservation = await reserve(
    { key: "authority:dataforseo", limit: daily.limit, window: { seconds: 24 * 60 * 60 } },
    { operation: "authority.bulk_ranks", metadata: { domains: due.length } },
    { now },
  );
  if (!reservation) return { status: "quota_reached" };

  const ids = due.map((row) => row.id);
  try {
    const ranks = await paidCall([reservation], () => bulkDomainRanks(due.map((row) => row.domain)));
    let withValue = 0;
    for (const row of due) {
      const rank = ranks.get(row.domain) ?? null;
      if (rank !== null) withValue++;
      await db
        .update(domainMetrics)
        .set(
          rank === null
            ? { status: "no_data", value: null, observedAt: now, error: null, attempts: 0, attemptedAt: now, nextAttemptAt: new Date(now.getTime() + days(AUTHORITY_STALE_AFTER_DAYS)), updatedAt: now }
            : { status: "ok", value: rank, observedAt: now, error: null, attempts: 0, attemptedAt: now, nextAttemptAt: new Date(now.getTime() + days(AUTHORITY_STALE_AFTER_DAYS)), updatedAt: now },
        )
        .where(eq(domainMetrics.id, row.id));
    }
    return { status: "collected", domains: due.length, withValue };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 200) : "unknown error";
    // Provably refused: the reservation goes back (paidCall left it reserved).
    if (error instanceof DataForSeoError && error.notBilled) {
      await releaseUnspent([reservation], "provider_refused").catch(() => {});
    }
    if (error instanceof DataForSeoError && error.apiStatusCode === 40204) {
      // DataForSEO answered 40204 for this account: no Backlinks API access. Not bought from here.
      await db
        .update(domainMetrics)
        .set({ status: "no_access", error: "DataForSEO answered 40204 (no Backlinks API access) for the configured account", attemptedAt: now, nextAttemptAt: new Date(now.getTime() + days(NO_ACCESS_RETRY_DAYS)), updatedAt: now })
        .where(inArray(domainMetrics.id, ids));
      return { status: "no_access", domains: due.length };
    }
    for (const row of due) {
      const backoff = Math.min(days(7), 6 * 3600_000 * 2 ** row.attempts);
      await db
        .update(domainMetrics)
        // The value we had (if any) is kept; only the status says the refresh failed.
        .set({ status: "error", error: message, attempts: row.attempts + 1, attemptedAt: now, nextAttemptAt: new Date(now.getTime() + backoff), updatedAt: now })
        .where(eq(domainMetrics.id, row.id));
    }
    return { status: "failed", domains: due.length, error: message };
  }
}
