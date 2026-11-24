import { sql, type AnyColumn, type SQL } from "drizzle-orm";

import { db } from "@/lib/db";
import { articles, spendReservations } from "@/lib/db/schema";
import type { Executor } from "@/lib/db/types";
import { articlePace, DAY_MS, dayIndex, paceWindowStart, utcDayStart, type ArticlePace } from "@/lib/keywords/cadence";
import { dailyCapFor } from "@/lib/publishing/daily-cap";
import { articleAllowanceKey, articleAllowanceRule } from "@/lib/usage";

/**
 * How many more articles RepGet may start by itself on a website now: the
 * plan's pace (lib/keywords/cadence.ts articlePace) and an administrator's
 * "Articles per day", the lower of the two.
 *
 * Read by the scheduler to decide how many topics to take, and AGAIN under
 * lockPace inside the transaction that reserves each article
 * (queueArticleForCalendarItem): the scheduler runs twice a day, and once more
 * whenever a website's research ends or its first article goes out, so two
 * runs overlap. Only the count taken under the lock decides.
 */

/** The ledger key of automatic second tries of an article whose writing failed. Its rows name the article. */
export function autoRetryKey(websiteId: string): string {
  return `article-auto-retry:${websiteId}`;
}

/**
 * Serialises article starts on one website until the transaction ends. Taken
 * by every start, "Write" pressed by hand included: a press is never refused
 * by the pace, but it counts, so it must be seen.
 */
export async function lockPace(tx: Pick<Executor, "execute">, websiteId: string): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`article-pace:${websiteId}`}, 0))`);
}

const rowsOf = <T>(result: unknown): T[] => (Array.isArray(result) ? result : (result as { rows: unknown[] }).rows) as T[];

/**
 * The articles started on a website since `from` (a UTC moment), and when the
 * last of them was: the article rows, plus those deleted since (the allowance
 * ledger keeps them, lib/usage.ts), plus automatic second tries, which cost
 * what a first one does. One article is counted once.
 *
 * DELETING AN ARTICLE NEVER REOPENS THE PACE: its ledger row stays, whoever
 * deleted it. Not even one that failed before costing anything, whose slot
 * was handed back: every start counts for its own day, in any state.
 *
 * NOT COUNTED: translations, which are made from an article that is already
 * live; and, after the day it was started, an article whose writing failed -
 * a Free website whose first article failed must not wait a week for another.
 *
 * Timestamps are UTC wall-clock time, as lib/usage.ts compares them.
 */
export async function articleStarts(
  websiteId: string,
  from: Date,
  now: Date = new Date(),
  executor: Executor = db,
): Promise<{ count: number; last: Date | null }> {
  const since = from.toISOString();
  const today = utcDayStart(now).toISOString();
  const result = await executor.execute(sql`
    select count(distinct s.id)::int as n, to_char(max(s.at), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as last
    from (
      select a.id::text as id, a.created_at as at
      from ${articles} a
      where a.website_id = ${websiteId} and a.created_at >= ${since}::timestamp
      union all
      select coalesce(r.subject_id, r.metadata ->> 'articleId', r.id::text), r.counted_at
      from ${spendReservations} r
      where r.key in (${articleAllowanceKey(websiteId)}, ${autoRetryKey(websiteId)})
        and (r.state in ('reserved', 'consumed') or r.counted_at >= ${today}::timestamp)
        and r.counted_at >= ${since}::timestamp
    ) s
    left join ${articles} a on a.id::text = s.id
    where a.id is null
      or (a.translation_of is null
        and not (a.status = 'failed' and a.body_html is null and s.at < ${today}::timestamp))
  `);
  const [row] = rowsOf<{ n: number; last: string | null }>(result);
  return { count: Number(row?.n ?? 0), last: row?.last ? new Date(row.last) : null };
}

/** Articles started since the UTC day began, however they were started. */
export async function articlesStartedToday(websiteId: string, now: Date = new Date(), executor: Executor = db): Promise<number> {
  return (await articleStarts(websiteId, utcDayStart(now), now, executor)).count;
}

/** The website's plan pace today, or null when it has no plan (nothing may be written). */
export async function paceFor(websiteId: string, now: Date = new Date(), executor: Executor = db): Promise<(ArticlePace & { free: boolean }) | null> {
  const allowance = await articleAllowanceRule(websiteId, executor);
  if (!allowance.ok) return null;
  const window = allowance.rule.window;
  const day = "since" in window ? dayIndex(window.since, now) : 0;
  return { ...articlePace({ free: allowance.free, perMonth: allowance.perMonth }, day), free: allowance.free };
}

/** How many articles may be started now, with what decided it. */
export async function startsLeft(
  websiteId: string,
  now: Date = new Date(),
  executor: Executor = db,
): Promise<{ left: number; pace: ArticlePace | null; cap: number | null; started: number }> {
  const [pace, cap] = [await paceFor(websiteId, now, executor), await dailyCapFor(websiteId, executor)];
  if (!pace) return { left: 0, pace: null, cap, started: 0 };
  const started = (await articleStarts(websiteId, paceWindowStart(pace, now), now, executor)).count;
  let left = pace.articles - started;
  if (cap !== null) {
    const today = pace.days === 1 ? started : await articlesStartedToday(websiteId, now, executor);
    left = Math.min(left, cap - today);
  }
  return { left: Math.max(left, 0), pace, cap, started };
}

/**
 * The first UTC day the pace allows another article: today, unless Free's
 * last one was started less than a week ago. What the Free calendar's dates
 * are laid out from.
 */
export async function nextStartDay(websiteId: string, pace: ArticlePace, now: Date = new Date(), executor: Executor = db): Promise<Date> {
  const today = utcDayStart(now);
  if (pace.days === 1) return today;
  const { last } = await articleStarts(websiteId, paceWindowStart(pace, now), now, executor);
  return last ? new Date(utcDayStart(last).getTime() + pace.days * DAY_MS) : today;
}

/** Whether an article of this website was paid for and has been deleted since: it is not a new website any more. */
export function deletedArticleSql(websiteId: AnyColumn | SQL): SQL<boolean> {
  return sql<boolean>`exists (
    select 1 from ${spendReservations} dr
    where dr.key = 'articles:' || ${websiteId}::text and dr.state = 'consumed' and dr.subject_id is not null
      and not exists (select 1 from articles da where da.id::text = dr.subject_id)
  )`;
}
