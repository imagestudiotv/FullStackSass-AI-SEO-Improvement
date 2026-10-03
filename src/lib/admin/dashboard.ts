import "server-only";

import { and, count, desc, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";

import { requireAdmin } from "@/lib/admin/guard";
import { sinceFrom } from "@/lib/admin/shared";
import { missingPlacements } from "@/lib/backlinks/placements";
import { db } from "@/lib/db";
import { adminAuditLog, articles, payments, publicationDispatches, subscriptions, websites } from "@/lib/db/schema";
import { readControls, type ControlState } from "@/lib/publishing/controls";
import { IN_FLIGHT_TIMEOUT_MS, UNACKNOWLEDGED } from "@/lib/publishing/dispatch";

/**
 * Read-only figures for the admin overview.
 *
 * NOT a "use server" module: these are reads for one guarded server
 * component, and a "use server" file would expose each as a POST endpoint.
 * Each still begins with requireAdmin(), because it reads across every
 * customer. Aggregated in the database, bounded, and free of provider calls.
 *
 * An attention count that fails to load is null - shown as "unavailable",
 * never as a reassuring zero.
 */

/** Dates leave raw SQL as ISO text: postgres-js does not serialise Date in raw templates. */
const iso = (date: Date) => date.toISOString();

async function settle<T>(work: () => Promise<T>): Promise<T | null> {
  try {
    return await work();
  } catch (error) {
    console.error("[admin/dashboard] query failed", error);
    return null;
  }
}

export type Attention = {
  /** Network articles waiting for the RepGet team's review (not yet published). */
  awaitingReview: number | null;
  /** Articles whose generation failed. */
  failedArticles: number | null;
  /** Deliveries whose outcome is unknown: uncertain, unacknowledged, or a lease that ran out. */
  unresolvedDeliveries: number | null;
  /** Live partner links missing on the last checks, waiting for an administrator (bounded at 100). */
  missingLinks: number | null;
  /** Payments that failed in the last 30 days (FAILED_PAYMENTS_RANGE). */
  failedPayments: number | null;
  /** Subscriptions past due. */
  pastDue: number | null;
  /** Websites whose analysis failed. */
  failedWebsites: number | null;
  /** The publication freeze and managed review switches. */
  controls: ControlState[] | null;
};

export async function getAttention(): Promise<Attention> {
  await requireAdmin();
  const staleBefore = new Date(Date.now() - IN_FLIGHT_TIMEOUT_MS);
  const one = async (query: Promise<{ n: number }[]>) => Number((await query)[0]?.n ?? 0);

  const [awaitingReview, failedArticles, unresolvedDeliveries, missingLinks, failedPayments, pastDue, failedWebsites, controls] =
    await Promise.all([
      settle(() =>
        one(
          db
            .select({ n: count() })
            .from(articles)
            .where(and(eq(articles.reviewStatus, "pending"), eq(articles.status, "draft"), isNull(articles.publishedUrl))),
        ),
      ),
      settle(() => one(db.select({ n: count() }).from(articles).where(eq(articles.status, "failed")))),
      // The same predicate Network Operations uses for "not drained", minus live in-flight sends (normal).
      settle(() =>
        one(
          db
            .select({ n: count() })
            .from(publicationDispatches)
            .where(
              or(
                eq(publicationDispatches.status, "uncertain"),
                inArray(publicationDispatches.status, [...UNACKNOWLEDGED]),
                and(eq(publicationDispatches.status, "in_flight"), lte(publicationDispatches.claimedAt, staleBefore)),
              ),
            ),
        ),
      ),
      settle(async () => (await missingPlacements(100)).length),
      /*
        The last 30 days, with the same window the Payments page's "Last 30
        days" filter uses (sinceFrom), so the count equals the list it opens.
        Counting every failure ever made this item permanent: it could never
        clear, however many were since paid.
      */
      settle(() =>
        one(
          db
            .select({ n: count() })
            .from(payments)
            .where(and(eq(payments.status, "failed"), gte(payments.paidAt, sinceFrom(FAILED_PAYMENTS_RANGE)!))),
        ),
      ),
      settle(() => one(db.select({ n: count() }).from(subscriptions).where(eq(subscriptions.status, "past_due")))),
      settle(() => one(db.select({ n: count() }).from(websites).where(eq(websites.status, "failed")))),
      settle(() => readControls()),
    ]);

  return { awaitingReview, failedArticles, unresolvedDeliveries, missingLinks, failedPayments, pastDue, failedWebsites, controls };
}

/** The Payments page date filter value the "Failed payments" attention item counts and links to. */
export const FAILED_PAYMENTS_RANGE = "30d";

export const ACTIVITY_RANGES = { "7d": 7, "30d": 30, "90d": 90 } as const;
export type ActivityRange = keyof typeof ACTIVITY_RANGES;

export function parseActivityRange(value: string | string[] | undefined): ActivityRange {
  const raw = Array.isArray(value) ? value[0] : value;
  // Own keys only: `in` also accepted "constructor" and "toString" from the prototype.
  return raw && Object.hasOwn(ACTIVITY_RANGES, raw) ? (raw as ActivityRange) : "30d";
}

export type ArticleActivity = {
  range: ActivityRange;
  /** First and last UTC day in the window (YYYY-MM-DD), inclusive. */
  from: string;
  to: string;
  /** One row per UTC day, oldest first, zero-filled. */
  days: { day: string; written: number; live: number }[];
  totals: { written: number; live: number };
};

/**
 * Articles written (created) and articles that went live (first_live_at),
 * per UTC day over the last N days including today. Both are stored event
 * times, so the history is real - nothing is reconstructed from a snapshot.
 * first_live_at exists only from migration 0045 (late September 2026), so
 * "went live" is undercounted before then; the page says so.
 */
export async function getArticleActivity(range: ActivityRange): Promise<ArticleActivity> {
  await requireAdmin();
  const days = ACTIVITY_RANGES[range];
  const today = new Date();
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const start = new Date(end.getTime() - (days - 1) * 86_400_000);
  const after = new Date(end.getTime() + 86_400_000);

  const result = await db.execute(sql`
    with days as (
      select generate_series(${iso(start)}::timestamp, ${iso(end)}::timestamp, interval '1 day') as day
    ),
    written as (
      select date_trunc('day', ${articles.createdAt}) as day, count(*)::int as n
      from ${articles}
      where ${articles.createdAt} >= ${iso(start)}::timestamp and ${articles.createdAt} < ${iso(after)}::timestamp
      group by 1
    ),
    live as (
      select date_trunc('day', ${articles.firstLiveAt}) as day, count(*)::int as n
      from ${articles}
      where ${articles.firstLiveAt} >= ${iso(start)}::timestamp and ${articles.firstLiveAt} < ${iso(after)}::timestamp
      group by 1
    )
    select to_char(d.day, 'YYYY-MM-DD') as day, coalesce(w.n, 0)::int as written, coalesce(l.n, 0)::int as live
    from days d
    left join written w on w.day = d.day
    left join live l on l.day = d.day
    order by d.day
  `);
  const rows = (Array.isArray(result) ? result : (result as { rows: unknown[] }).rows) as {
    day: string;
    written: number;
    live: number;
  }[];
  const series = rows.map((row) => ({ day: row.day, written: Number(row.written), live: Number(row.live) }));
  return {
    range,
    from: series[0]?.day ?? iso(start).slice(0, 10),
    to: series[series.length - 1]?.day ?? iso(end).slice(0, 10),
    days: series,
    totals: {
      written: series.reduce((sum, row) => sum + row.written, 0),
      live: series.reduce((sum, row) => sum + row.live, 0),
    },
  };
}

export type SubscriptionMix = { active: number; trialing: number; pastDue: number };

/** Entitled subscriptions by status - what "Paying" and the plan value actually contain. */
export async function getSubscriptionMix(): Promise<SubscriptionMix> {
  await requireAdmin();
  const rows = await db
    .select({ status: subscriptions.status, n: count() })
    .from(subscriptions)
    .where(inArray(subscriptions.status, ["active", "trialing", "past_due"]))
    .groupBy(subscriptions.status);
  const of = (status: string) => Number(rows.find((row) => row.status === status)?.n ?? 0);
  return { active: of("active"), trialing: of("trialing"), pastDue: of("past_due") };
}

export type RecentAdminAction = {
  id: string;
  actorEmail: string;
  action: string;
  summary: string;
  createdAt: Date;
};

/** The latest administrator actions, for the overview's feed. The full log is /admin/activity. */
export async function getRecentAdminActions(limit = 8): Promise<RecentAdminAction[]> {
  await requireAdmin();
  return db
    .select({
      id: adminAuditLog.id,
      actorEmail: adminAuditLog.actorEmail,
      action: adminAuditLog.action,
      summary: adminAuditLog.summary,
      createdAt: adminAuditLog.createdAt,
    })
    .from(adminAuditLog)
    .orderBy(desc(adminAuditLog.createdAt))
    .limit(Math.min(Math.max(limit, 1), 20));
}
