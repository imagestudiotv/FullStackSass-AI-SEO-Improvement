import { and, eq, gte, sql as raw } from "drizzle-orm";

import { db } from "@/lib/db";
import { geoResults, usageEvents } from "@/lib/db/schema";

/**
 * How often a workspace may trigger an expensive job.
 *
 * WHY A PAYING CUSTOMER STILL NEEDS A LIMIT: entitlement answers "may this
 * website spend at all", and usage.ts answers "has this plan's monthly
 * allowance run out". Neither answers "how fast". Audits and AI-visibility
 * checks have no monthly cap of their own, so before this a subscriber could
 * hold down a button and queue hundreds of crawls and model calls in a
 * minute — every one of them billed to us, and none of them useful, because
 * the second audit of the same site an instant after the first tells nobody
 * anything.
 *
 * COUNTED FROM usage_events, not a Redis counter or an in-memory map.
 * Serverless functions do not share memory, so an in-memory count would reset
 * on every cold start and be per-instance in between — which is no limit at
 * all. usage_events already records every billed call with an organization id
 * and a timestamp, and carries an index on exactly that pair, so the count is
 * one indexed query against data we were writing anyway. No new dependency,
 * no new table, and it cannot drift from what we actually charged for.
 *
 * The window is a SLIDING one — "in the last hour", not "since the top of the
 * hour" — so somebody cannot spend their whole allowance at 10:59 and again
 * at 11:01.
 *
 * A KIND ONLY WORKS HERE IF SOMETHING WRITES IT. The kinds below are the ones
 * the jobs actually record: crawl, llm, image, seo_api, article. check-geo
 * calls no track() at all, so counting usage events can never limit it — that
 * one is capped on queued jobs instead, by countQueued() below. Adding a kind
 * here that nothing writes produces a limit that silently never fires, which
 * is worse than no limit because it looks like protection.
 */

/**
 * Per-hour ceilings, by usage kind.
 *
 * Set well above honest use and well below what a stuck loop or a leaning
 * finger produces. A customer auditing one site a few times while fixing
 * issues stays far under 10; a double-click cannot exceed it; a runaway
 * client hits it in seconds and stops.
 */
const HOURLY_LIMITS: Record<string, number> = {
  /** Crawls every page of a site. The most expensive thing here. */
  crawl: 10,
  /** Model calls — article bodies, clustering, GEO answers. */
  llm: 60,
  /** A billed image per press. */
  image: 20,
  /** Provider lookups, charged per row. */
  seo_api: 30,
};

/** Anything not named above. Generous: unknown kinds are cheap by default. */
const DEFAULT_HOURLY_LIMIT = 60;

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfterMinutes: number; error: string };

/**
 * Whether this workspace may run another `kind` right now.
 *
 * Keyed on the ORGANIZATION rather than the website: the cost lands on us per
 * account, and someone with five sites holding down five buttons is the case
 * a per-website limit would miss entirely.
 */
export async function withinRateLimit(
  organizationId: string,
  kind: string,
): Promise<RateLimitResult> {
  const limit = HOURLY_LIMITS[kind] ?? DEFAULT_HOURLY_LIMIT;
  const since = new Date(Date.now() - 60 * 60 * 1000);

  const [row] = await db
    .select({ n: raw<number>`count(*)::int` })
    .from(usageEvents)
    .where(
      and(
        eq(usageEvents.organizationId, organizationId),
        eq(usageEvents.kind, kind),
        gte(usageEvents.createdAt, since),
      ),
    );

  const used = row?.n ?? 0;
  if (used < limit) return { ok: true };

  /**
   * "Try again in an hour" is the honest answer without a per-event lookup,
   * and the sliding window means the real wait is usually shorter — the
   * oldest call ages out of the window and a slot frees up before then.
   */
  return {
    ok: false,
    retryAfterMinutes: 60,
    error:
      "You have run this many times in the last hour. Please try again shortly.",
  };
}

/**
 * The same ceiling for AI-visibility checks, counted from geo_results.
 *
 * check-geo records no usage_events — it calls no track() at all — so
 * withinRateLimit() above can never see it. Its output table is the honest
 * substitute: one row per prompt per engine, stamped with checkedAt and
 * indexed on (websiteId, checkedAt), so counting recent rows counts recent
 * checks.
 *
 * Per WEBSITE here rather than per organization, because that is the grain
 * geo_results carries; a workspace with several sites can therefore run one
 * check on each, which is legitimate use rather than the runaway this guards
 * against.
 *
 * Counted in RESULTS, not runs: a check writes one row per prompt per engine,
 * so a Scale customer with 50 prompts across 4 engines writes 200 rows in a
 * single legitimate check. The ceiling is set in that unit accordingly — two
 * full checks an hour for the largest plan, many more for a small one, and a
 * button held down still stops.
 */
const GEO_RESULTS_PER_HOUR = 500;

export async function withinGeoRateLimit(
  websiteId: string,
): Promise<RateLimitResult> {
  const since = new Date(Date.now() - 60 * 60 * 1000);

  const [row] = await db
    .select({ n: raw<number>`count(*)::int` })
    .from(geoResults)
    .where(
      and(eq(geoResults.websiteId, websiteId), gte(geoResults.checkedAt, since)),
    );

  if ((row?.n ?? 0) < GEO_RESULTS_PER_HOUR) return { ok: true };

  return {
    ok: false,
    retryAfterMinutes: 60,
    error:
      "You have checked AI visibility several times in the last hour. Please try again shortly.",
  };
}
