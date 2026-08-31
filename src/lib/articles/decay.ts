import { and, eq, gte, lt, sql as raw } from "drizzle-orm";

import { db } from "@/lib/db";
import { articles, gscMetrics } from "@/lib/db/schema";

/**
 * Finding pages that are losing ground.
 *
 * Published content decays: rankings slip as competitors publish, facts age,
 * and search intent shifts. The customer cannot see it happening — traffic
 * falls slowly enough to look like noise — so this compares two windows of
 * Search Console data and reports what actually moved.
 *
 * Everything here is measured, never estimated. A page with no Search Console
 * history is not reported as decaying: we do not know how it was doing before,
 * and inventing a decline would send the customer to rewrite a page that was
 * never in trouble.
 */

/** Days in each comparison window. */
const WINDOW_DAYS = 28;

/** Clicks in the earlier window before a decline is worth reporting. */
const MIN_BASELINE_CLICKS = 10;

/** Fractional drop that counts as decay (0.3 = lost 30% of clicks). */
const DECAY_THRESHOLD = 0.3;

export type DecayedPage = {
  pageUrl: string;
  /** Clicks in the earlier window. */
  before: number;
  /** Clicks in the recent window. */
  after: number;
  /** Fraction lost, 0-1. */
  drop: number;
  /** Average position then and now; negative change means it slipped down. */
  positionBefore: number | null;
  positionAfter: number | null;
  /** The article we generated for this URL, when there is one. */
  articleId: string | null;
  articleTitle: string | null;
};

/** ISO date N days before now, for a date-typed column. */
function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Pages whose clicks fell materially between two consecutive windows.
 *
 * The baseline threshold matters more than it looks. A page going from 2
 * clicks to 1 is a 50% drop and pure noise; sending a customer to rewrite it
 * wastes their credits and their trust. Only pages with real traffic to lose
 * are reported.
 */
export async function findDecayedPages(
  websiteId: string,
): Promise<DecayedPage[]> {
  const recentStart = daysAgo(WINDOW_DAYS);
  const priorStart = daysAgo(WINDOW_DAYS * 2);

  const aggregate = async (from: string, to: string | null) =>
    db
      .select({
        pageUrl: gscMetrics.pageUrl,
        clicks: raw<number>`sum(${gscMetrics.clicks})::int`,
        position: raw<number | null>`avg(${gscMetrics.position})`,
      })
      .from(gscMetrics)
      .where(
        and(
          eq(gscMetrics.websiteId, websiteId),
          gte(gscMetrics.date, from),
          to ? lt(gscMetrics.date, to) : undefined,
          // Page-level rows only; query-level rows would multiply the totals.
          raw`${gscMetrics.pageUrl} is not null`,
        ),
      )
      .groupBy(gscMetrics.pageUrl);

  const [recent, prior] = await Promise.all([
    aggregate(recentStart, null),
    aggregate(priorStart, recentStart),
  ]);

  const recentByUrl = new Map(recent.map((r) => [r.pageUrl, r]));

  /**
   * Articles we generated, so a decayed page can be traced back to something
   * the customer can regenerate. A decayed page with no article is still
   * reported — it is still their page, and still losing traffic.
   */
  const generated = await db
    .select({
      id: articles.id,
      title: articles.title,
      publishedUrl: articles.publishedUrl,
    })
    .from(articles)
    .where(eq(articles.websiteId, websiteId));

  const articleByUrl = new Map(
    generated
      .filter((a) => a.publishedUrl)
      .map((a) => [a.publishedUrl as string, a]),
  );

  const decayed: DecayedPage[] = [];

  for (const before of prior) {
    if (!before.pageUrl) continue;
    if (before.clicks < MIN_BASELINE_CLICKS) continue;

    const after = recentByUrl.get(before.pageUrl);
    const afterClicks = after?.clicks ?? 0;
    const drop = (before.clicks - afterClicks) / before.clicks;

    if (drop < DECAY_THRESHOLD) continue;

    const article = articleByUrl.get(before.pageUrl);
    decayed.push({
      pageUrl: before.pageUrl,
      before: before.clicks,
      after: afterClicks,
      drop,
      positionBefore: before.position === null ? null : Number(before.position),
      positionAfter:
        after?.position === null || after?.position === undefined
          ? null
          : Number(after.position),
      articleId: article?.id ?? null,
      articleTitle: article?.title ?? null,
    });
  }

  // Worst first: the customer should see the biggest loss at the top.
  return decayed.sort((a, b) => b.before - a.before).slice(0, 20);
}
