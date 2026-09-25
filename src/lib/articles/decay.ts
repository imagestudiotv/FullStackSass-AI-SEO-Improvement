import { and, eq, gte, lte, sql as raw } from "drizzle-orm";

import { db } from "@/lib/db";
import { articles, gscPageMetrics, siteDailyMetrics } from "@/lib/db/schema";

/**
 * Finding pages that are losing ground.
 *
 * Published content decays: rankings slip as competitors publish, facts age,
 * and search intent shifts. The customer cannot see it happening - traffic
 * falls slowly enough to look like noise - so this compares two windows of
 * Search Console data and reports what actually moved.
 *
 * Everything here is measured, never estimated. A page with no Search Console
 * history is not reported: we do not know how it was doing before, and
 * inventing a decline would send the customer to rewrite a page that was never
 * in trouble.
 *
 * THREE LISTS, because clicks alone were not enough. On a small site only the
 * homepage gets ten clicks a month, so a click threshold can never fire for
 * any other page, and the screen said "nothing has dropped" while a post was
 * falling from page one to page two. Ranking and impressions move before
 * clicks do, and every page has them.
 */

/** Days in each comparison window. */
const WINDOW_DAYS = 28;

/** Clicks in the earlier window before a click decline is worth reporting. */
const MIN_BASELINE_CLICKS = 10;

/** Fractional drop in clicks that counts as losing traffic. */
const DECAY_THRESHOLD = 0.3;

/** Smaller click drop that is shown, but only as one to watch. */
const WATCH_THRESHOLD = 0.1;

/** Impressions in the earlier window before a ranking change is judged. */
const MIN_BASELINE_IMPRESSIONS = 100;

/** Places lost in average position that count as losing visibility. */
const POSITION_SLIP = 3;

/** Share of impressions lost that counts as losing visibility. */
const IMPRESSION_DROP = 0.5;

/** Rows per list; the worst come first. */
const LIST_LIMIT = 20;

export type PageChange = {
  pageUrl: string;
  clicksBefore: number;
  clicksAfter: number;
  impressionsBefore: number;
  impressionsAfter: number;
  /** Average position; a HIGHER number is a WORSE ranking. */
  positionBefore: number | null;
  positionAfter: number | null;
  /** Fraction of clicks lost, 0-1, or null with no clicks to lose. */
  clickDrop: number | null;
  /** Fraction of impressions lost, 0-1, or null with none to lose. */
  impressionDrop: number | null;
  /** The article we generated for this URL, when there is one. */
  articleId: string | null;
  articleTitle: string | null;
};

export type TrafficReport = {
  /** Lost 30%+ of clicks, from at least 10. */
  losingClicks: PageChange[];
  /** Slipped 3+ places or lost half its impressions, from at least 100. */
  losingVisibility: PageChange[];
  /** Lost 10-30% of clicks, from at least 10. Not yet a clear decline. */
  watch: PageChange[];
  /** Last day of the recent window, or null before any import. */
  windowEnd: string | null;
};

/** An ISO date shifted by whole days. */
function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * The two back-to-back windows, ending on the newest day Google has reported.
 *
 * Not today: Search Console runs about three days behind, and a window ending
 * today counted those three empty days as three days of zero traffic.
 */
async function windows(websiteId: string) {
  const [latest] = await db
    .select({ date: raw<string | null>`max(${gscPageMetrics.date})::text` })
    .from(gscPageMetrics)
    .where(eq(gscPageMetrics.websiteId, websiteId));
  const end = latest?.date ?? null;
  if (!end) return null;
  const recentStart = shiftDate(end, -(WINDOW_DAYS - 1));
  const priorEnd = shiftDate(recentStart, -1);
  const priorStart = shiftDate(priorEnd, -(WINDOW_DAYS - 1));
  return { end, recentStart, priorEnd, priorStart };
}

type PageWindow = {
  clicks: number;
  impressions: number;
  position: number | null;
};

async function byPage(
  websiteId: string,
  from: string,
  to: string,
): Promise<Map<string, PageWindow>> {
  const p = gscPageMetrics;
  const rows = await db
    .select({
      pageUrl: p.pageUrl,
      clicks: raw<number>`sum(${p.clicks})::int`,
      impressions: raw<number>`sum(${p.impressions})::int`,
      // Weighted by impressions: one impression at position 90 must not
      // count as much as a day with thousands near the top.
      position: raw<number | null>`
        (sum(${p.position} * ${p.impressions}) / nullif(sum(${p.impressions}), 0))::float`,
    })
    .from(p)
    .where(and(eq(p.websiteId, websiteId), gte(p.date, from), lte(p.date, to)))
    .groupBy(p.pageUrl);
  return new Map(
    rows.map((row) => [
      row.pageUrl,
      {
        clicks: row.clicks,
        impressions: row.impressions,
        position: row.position === null ? null : Number(row.position),
      },
    ]),
  );
}

/**
 * Pages whose clicks or visibility fell between two consecutive windows.
 *
 * The baselines matter more than they look. A page going from 2 clicks to 1 is
 * a 50% drop and pure noise; sending a customer to rewrite it wastes their
 * credits and their trust. So clicks are only judged from 10, and ranking only
 * from 100 impressions - enough that a slip is a trend, not one odd day.
 */
export async function findTrafficChanges(
  websiteId: string,
): Promise<TrafficReport> {
  const span = await windows(websiteId);
  if (!span) {
    return { losingClicks: [], losingVisibility: [], watch: [], windowEnd: null };
  }

  const [recent, prior, generated] = await Promise.all([
    byPage(websiteId, span.recentStart, span.end),
    byPage(websiteId, span.priorStart, span.priorEnd),
    /**
     * Articles we generated, so a declining page can be traced back to
     * something the customer can regenerate. A page with no article is still
     * reported - it is still their page.
     */
    db
      .select({
        id: articles.id,
        title: articles.title,
        publishedUrl: articles.publishedUrl,
      })
      .from(articles)
      .where(eq(articles.websiteId, websiteId)),
  ]);

  const articleByUrl = new Map(
    generated
      .filter((a) => a.publishedUrl)
      .map((a) => [a.publishedUrl as string, a]),
  );

  const losingClicks: PageChange[] = [];
  const losingVisibility: PageChange[] = [];
  const watch: PageChange[] = [];

  for (const [pageUrl, before] of prior) {
    const after = recent.get(pageUrl) ?? {
      clicks: 0,
      impressions: 0,
      position: null,
    };
    const article = articleByUrl.get(pageUrl);
    const change: PageChange = {
      pageUrl,
      clicksBefore: before.clicks,
      clicksAfter: after.clicks,
      impressionsBefore: before.impressions,
      impressionsAfter: after.impressions,
      positionBefore: before.position,
      positionAfter: after.position,
      clickDrop:
        before.clicks > 0 ? (before.clicks - after.clicks) / before.clicks : null,
      impressionDrop:
        before.impressions > 0
          ? (before.impressions - after.impressions) / before.impressions
          : null,
      articleId: article?.id ?? null,
      articleTitle: article?.title ?? null,
    };

    const judgedOnClicks = before.clicks >= MIN_BASELINE_CLICKS;
    const clickDrop = change.clickDrop ?? 0;

    if (judgedOnClicks && clickDrop >= DECAY_THRESHOLD) {
      losingClicks.push(change);
      continue;
    }

    if (before.impressions >= MIN_BASELINE_IMPRESSIONS) {
      const slipped =
        before.position !== null &&
        after.position !== null &&
        after.position - before.position >= POSITION_SLIP;
      const faded = (change.impressionDrop ?? 0) >= IMPRESSION_DROP;
      if (slipped || faded) {
        losingVisibility.push(change);
        continue;
      }
    }

    if (judgedOnClicks && clickDrop >= WATCH_THRESHOLD) {
      watch.push(change);
    }
  }

  // Worst first: the biggest absolute loss is the one to fix first.
  losingClicks.sort(
    (a, b) => b.clicksBefore - b.clicksAfter - (a.clicksBefore - a.clicksAfter),
  );
  losingVisibility.sort(
    (a, b) =>
      b.impressionsBefore - b.impressionsAfter -
      (a.impressionsBefore - a.impressionsAfter),
  );
  watch.sort(
    (a, b) => b.clicksBefore - b.clicksAfter - (a.clicksBefore - a.clicksAfter),
  );

  return {
    losingClicks: losingClicks.slice(0, LIST_LIMIT),
    losingVisibility: losingVisibility.slice(0, LIST_LIMIT),
    watch: watch.slice(0, LIST_LIMIT),
    windowEnd: span.end,
  };
}

/** One day's clicks for the whole site. */
export type TrafficPoint = {
  /** ISO date, YYYY-MM-DD. */
  date: string;
  clicks: number;
};

/**
 * Daily clicks across both comparison windows - exactly 28 + 28 days, so the
 * chart's halves are the same two windows the lists compare.
 *
 * From Google's site-wide daily totals. It used to add up the per-search-term
 * rows, which drop private searches unevenly: for imagestudio.com it showed a
 * 23% fall (170 to 131) where Google's own totals rose 6% (263 to 279).
 *
 * Returns a point for EVERY day in the window, including days Search Console
 * reported nothing. Without the zero-fill a gap in reporting is drawn as a
 * straight line between the days either side, which reads as traffic that held
 * steady when in fact nothing was recorded.
 */
export async function getTrafficSeries(
  websiteId: string,
): Promise<TrafficPoint[]> {
  const d = siteDailyMetrics;
  const [latest] = await db
    .select({ date: raw<string | null>`max(${d.date})::text` })
    .from(d)
    .where(and(eq(d.websiteId, websiteId), raw`${d.gscClicks} is not null`));
  const end = latest?.date ?? null;
  if (!end) return [];

  const from = shiftDate(end, -(WINDOW_DAYS * 2 - 1));
  const rows = await db
    .select({ date: raw<string>`${d.date}::text`, clicks: d.gscClicks })
    .from(d)
    .where(and(eq(d.websiteId, websiteId), gte(d.date, from), lte(d.date, end)));

  const byDate = new Map(rows.map((row) => [row.date, row.clicks ?? 0]));
  const series: TrafficPoint[] = [];
  for (let i = WINDOW_DAYS * 2 - 1; i >= 0; i -= 1) {
    const date = shiftDate(end, -i);
    series.push({ date, clicks: byDate.get(date) ?? 0 });
  }
  return series;
}
