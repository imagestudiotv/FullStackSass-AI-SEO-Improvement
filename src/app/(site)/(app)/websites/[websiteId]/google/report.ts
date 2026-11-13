import "server-only";

import { and, asc, desc, eq, gte, lte, sql as raw, type AnyColumn } from "drizzle-orm";

import { db } from "@/lib/db";
import { gscMetrics, gscPageMetrics, siteDailyMetrics } from "@/lib/db/schema";
import { requireWebsite } from "@/lib/tenant";

/**
 * Everything the Google page reports, for one period.
 *
 * A plain server module (not "use server"): the page calls it after its own
 * guards, and no browser can call it. It reads only stored rows - never
 * Google - so opening the page or changing the period starts no work.
 *
 * SAME DEFINITIONS AS getPerformance (lib/analytics/actions.ts), which this
 * page used before and which stays as it was. The headline figures come from
 * site_daily_metrics (summing the per-query or per-page tables would under-
 * or over-count), both periods end on the newest stored day rather than
 * today (Google runs about three days behind), position is weighted by
 * impressions, and a source is compared only when the previous period is
 * fully imported for it. google/report.test.ts holds the two side by side.
 *
 * What this adds is what the page needs to tell "no data" apart from "zero":
 * how many days each source actually reported, the newest day each one
 * reported, the daily series (null where a day was not reported - never
 * zero-filled), and the top pages that were queried before but never shown.
 */

/** Rows in each top table. Bounded: the tables are a summary, not an export. */
export const TOP_ROWS = 10;

export type SearchTotals = {
  clicks: number;
  impressions: number;
  /** Clicks / impressions, null without impressions. */
  ctr: number | null;
  /** Impression-weighted, null without impressions. Lower is better. */
  position: number | null;
};

/** What every top table row has: summed clicks and impressions. */
export type TopCounts = {
  clicks: number;
  impressions: number;
};

/** A top page: its counts plus CTR and impression-weighted position. */
export type TopRow = TopCounts & {
  ctr: number | null;
  position: number | null;
};

export type GoogleReport = {
  days: number;
  /** Inclusive ISO days. */
  window: { start: string; end: string; previousStart: string; previousEnd: string };
  /** The old page's test for "figures exist", which also ends the import polling. */
  hasData: boolean;
  search: {
    /** Newest day Search Console ever reported for this site, in any period. */
    through: string | null;
    /** Days in this period with a Search Console row. 0 = nothing imported for it. */
    daysReported: number;
    current: SearchTotals;
    /** Null unless every day of the previous period was reported. */
    previous: SearchTotals | null;
    series: { day: string; clicks: number | null; impressions: number | null }[];
    /**
     * Counts only. gsc_metrics is imported by page and query, so a search
     * that showed two of the site's pages counts one impression per page,
     * each at its own position: a CTR or position worked out from it would
     * not match Search Console's per-query figures.
     */
    topQueries: (TopCounts & { query: string })[];
    topPages: (TopRow & { pageUrl: string })[];
  };
  analytics: {
    through: string | null;
    daysReported: number;
    sessions: number;
    previousSessions: number | null;
    series: { day: string; sessions: number | null }[];
  };
};

/** An ISO date shifted by whole days (the same helper as actions.ts). */
export function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Every ISO day from `from` to `to`, inclusive. */
function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  for (let day = from; day <= to; day = shiftDate(day, 1)) out.push(day);
  return out;
}

const ratio = (clicks: number, impressions: number): number | null =>
  impressions > 0 ? clicks / impressions : null;

/** Site-wide totals for an inclusive window. The SQL of actions.ts windowTotals. */
async function windowTotals(websiteId: string, from: string, to: string) {
  const d = siteDailyMetrics;
  const [row] = await db
    .select({
      clicks: raw<number>`coalesce(sum(${d.gscClicks}), 0)::int`,
      impressions: raw<number>`coalesce(sum(${d.gscImpressions}), 0)::int`,
      position: raw<number | null>`
        case when sum(${d.gscImpressions}) > 0
        then (sum(${d.gscPosition} * ${d.gscImpressions}) / sum(${d.gscImpressions}))::float
        else null end`,
      gscDays: raw<number>`count(${d.gscClicks})::int`,
      sessions: raw<number>`coalesce(sum(${d.gaSessions}), 0)::int`,
      gaDays: raw<number>`count(${d.gaSessions})::int`,
    })
    .from(d)
    .where(and(eq(d.websiteId, websiteId), gte(d.date, from), lte(d.date, to)));
  return {
    clicks: Number(row?.clicks ?? 0),
    impressions: Number(row?.impressions ?? 0),
    position: row?.position === null || row?.position === undefined ? null : Number(row.position),
    gscDays: Number(row?.gscDays ?? 0),
    sessions: Number(row?.sessions ?? 0),
    gaDays: Number(row?.gaDays ?? 0),
  };
}

export async function loadGoogleReport(websiteId: string, days: number): Promise<GoogleReport> {
  const { site } = await requireWebsite(websiteId);
  if (!Number.isInteger(days) || days < 1 || days > 366) {
    throw new RangeError(`Unsupported report length: ${days}`);
  }

  const d = siteDailyMetrics;
  const [latest] = await db
    .select({
      date: raw<string | null>`max(${d.date})::text`,
      gscThrough: raw<string | null>`(max(${d.date}) filter (where ${d.gscClicks} is not null))::text`,
      gaThrough: raw<string | null>`(max(${d.date}) filter (where ${d.gaSessions} is not null))::text`,
    })
    .from(d)
    .where(eq(d.websiteId, site.id));

  // As getPerformance: both windows end on the newest stored day of either source.
  const end = latest?.date ?? new Date().toISOString().slice(0, 10);
  const start = shiftDate(end, -(days - 1));
  const previousEnd = shiftDate(start, -1);
  const previousStart = shiftDate(previousEnd, -(days - 1));

  const g = gscMetrics;
  const p = gscPageMetrics;
  // Impression-weighted over the rows that carry a position.
  const weighted = (position: AnyColumn, impressions: AnyColumn) => raw<number | null>`
    case when coalesce(sum(${impressions}) filter (where ${position} is not null), 0) > 0
    then (sum(${position} * ${impressions}) filter (where ${position} is not null)
      / sum(${impressions}) filter (where ${position} is not null))::float
    else null end`;

  const [current, before, daily, queries, pages] = await Promise.all([
    windowTotals(site.id, start, end),
    windowTotals(site.id, previousStart, previousEnd),
    db
      .select({
        day: raw<string>`${d.date}::text`,
        clicks: d.gscClicks,
        impressions: d.gscImpressions,
        sessions: d.gaSessions,
      })
      .from(d)
      .where(and(eq(d.websiteId, site.id), gte(d.date, start), lte(d.date, end)))
      .orderBy(asc(d.date))
      .limit(days),
    db
      .select({
        query: g.query,
        clicks: raw<number>`sum(${g.clicks})::int`,
        impressions: raw<number>`sum(${g.impressions})::int`,
      })
      .from(g)
      .where(and(eq(g.websiteId, site.id), gte(g.date, start), lte(g.date, end), raw`${g.query} is not null`))
      .groupBy(g.query)
      // Ties (many zero-click searches) in a stable order rather than whatever the planner returns.
      .orderBy(desc(raw`sum(${g.clicks})`), desc(raw`sum(${g.impressions})`), asc(g.query))
      .limit(TOP_ROWS),
    db
      .select({
        pageUrl: p.pageUrl,
        clicks: raw<number>`sum(${p.clicks})::int`,
        impressions: raw<number>`sum(${p.impressions})::int`,
        position: weighted(p.position, p.impressions),
      })
      .from(p)
      .where(and(eq(p.websiteId, site.id), gte(p.date, start), lte(p.date, end)))
      .groupBy(p.pageUrl)
      .orderBy(desc(raw`sum(${p.clicks})`), desc(raw`sum(${p.impressions})`), asc(p.pageUrl))
      .limit(TOP_ROWS),
  ]);

  // A comparison only when the earlier window is complete for that source.
  const gscComparable = before.gscDays >= days;
  const gaComparable = before.gaDays >= days;

  const byDay = new Map(daily.map((row) => [row.day, row]));
  const allDays = eachDay(start, end);
  const top = (row: { clicks: number; impressions: number; position: number | null }): TopRow => {
    const clicks = Number(row.clicks);
    const impressions = Number(row.impressions);
    return {
      clicks,
      impressions,
      ctr: ratio(clicks, impressions),
      position: row.position === null ? null : Number(row.position),
    };
  };

  return {
    days,
    window: { start, end, previousStart, previousEnd },
    hasData: current.impressions > 0 || current.sessions > 0,
    search: {
      through: latest?.gscThrough ?? null,
      daysReported: current.gscDays,
      current: {
        clicks: current.clicks,
        impressions: current.impressions,
        ctr: ratio(current.clicks, current.impressions),
        position: current.position,
      },
      previous: gscComparable
        ? {
            clicks: before.clicks,
            impressions: before.impressions,
            ctr: ratio(before.clicks, before.impressions),
            position: before.position,
          }
        : null,
      // A day with no row, or a row Search Console did not fill, is "not reported".
      series: allDays.map((day) => {
        const row = byDay.get(day);
        return row && row.clicks !== null
          ? { day, clicks: Number(row.clicks), impressions: row.impressions === null ? null : Number(row.impressions) }
          : { day, clicks: null, impressions: null };
      }),
      topQueries: queries.flatMap((row) =>
        row.query === null ? [] : [{ query: row.query, clicks: Number(row.clicks), impressions: Number(row.impressions) }],
      ),
      topPages: pages.map((row) => ({ pageUrl: row.pageUrl, ...top(row) })),
    },
    analytics: {
      through: latest?.gaThrough ?? null,
      daysReported: current.gaDays,
      sessions: current.sessions,
      previousSessions: gaComparable ? before.sessions : null,
      series: allDays.map((day) => {
        const row = byDay.get(day);
        return { day, sessions: row && row.sessions !== null ? Number(row.sessions) : null };
      }),
    },
  };
}
