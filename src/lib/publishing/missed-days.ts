import { sql as raw } from "drizzle-orm";

import { db } from "@/lib/db";
import { DAY_MS, utcDayStart } from "@/lib/keywords/cadence";

/**
 * Topics whose day passed while nothing was written are moved forward, so the
 * calendar restarts from today instead of catching up.
 *
 * Client, 2026-11-20: "that should not happen. It should restart from the
 * unpause period." imagestudio.com's writing was paused on 2026-11-14 and
 * switched back on six days later. Every topic dated in the pause was still
 * "planned" and inside the scheduler's window (it takes anything dated up to
 * its horizon, overdue included), so each run - two a day - wrote another
 * batch of them until the backlog was gone: many articles, and many AI bills,
 * at once.
 *
 * Normally no topic is ever overdue: the scheduler writes two days ahead, so a
 * topic's article is started before its day comes. A planned topic with no
 * article whose day has passed therefore means writing stopped - generation
 * switched to manual, the plan's articles used up, an unpaid plan - and those
 * days are skipped rather than written all at once: every unstarted dated topic
 * moves by the same number of days, so the earliest lands on today and the
 * spacing between them (the plan's pace) is kept. Nothing is deleted; the
 * customer's topics are all still there, only later.
 *
 * Not moved: a topic with an article (queued, written or failed - its slot of
 * the allowance is spent, as replan.ts treats it), and an undated topic, which
 * the customer added by hand to be written when there is room.
 *
 * Days are UTC calendar days, as the rest of the scheduler counts them.
 */
export async function moveMissedTopicsForward(websiteId: string, now: Date = new Date()): Promise<{ days: number; moved: number }> {
  const today = now.toISOString().slice(0, 10);
  const result = await db.execute(raw`
    with unstarted as (
      select ci.id, ci.scheduled_for
      from calendar_items ci
      where ci.website_id = ${websiteId}
        and ci.status = 'planned'
        and ci.scheduled_for is not null
        and not exists (select 1 from articles a where a.calendar_item_id = ci.id)
    ),
    gap as (
      select (${today}::date - min(scheduled_for)::date) as days
      from unstarted
      having min(scheduled_for) < ${today}::date
    )
    update calendar_items ci
    set scheduled_for = ci.scheduled_for + make_interval(days => gap.days),
        updated_at = now()
    from gap, unstarted
    where ci.id = unstarted.id
    returning gap.days as days
  `);
  const moved = (Array.isArray(result) ? result : (result as { rows: unknown[] }).rows) as { days: number }[];
  return { days: Number(moved[0]?.days ?? 0), moved: moved.length };
}

/**
 * A Free website's unstarted topics, spaced by its pace: one every
 * `spacingDays` days (FREE_DAYS_PER_ARTICLE), the first on or after
 * `firstDay` (lib/articles/pace.ts nextStartDay), so its calendar shows the
 * days its articles are really written (client, 2026-11-24: "one article per
 * week"). Calendars planned before that rule had a topic a day.
 *
 * Takes the place of moveMissedTopicsForward for Free: a topic whose day
 * passed moves to the next day the pace allows, and only a topic too close to
 * the one before it moves - one already far enough keeps its date. Moved
 * earlier only with `startNow`: a website still without an article, whose
 * first topic is due at once. Articles that were started, and undated topics, are left
 * alone, as above. Idempotent; locked, so two runs cannot interleave.
 */
export async function spaceTopics(
  websiteId: string,
  spacingDays: number,
  firstDay: Date,
  now: Date = new Date(),
  options: { startNow?: boolean } = {},
): Promise<{ moved: number }> {
  return db.transaction(async (tx) => {
    const result = await tx.execute(raw`
      select ci.id, to_char(ci.scheduled_for, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as at
      from calendar_items ci
      where ci.website_id = ${websiteId}
        and ci.status = 'planned'
        and ci.scheduled_for is not null
        and not exists (select 1 from articles a where a.calendar_item_id = ci.id)
      order by ci.scheduled_for, ci.created_at, ci.id
      for update of ci
    `);
    const topics = (Array.isArray(result) ? result : (result as { rows: unknown[] }).rows) as { id: string; at: string }[];

    let earliest = Math.max(utcDayStart(firstDay).getTime(), utcDayStart(now).getTime());
    let moved = 0;
    for (const [index, topic] of topics.entries()) {
      const at = new Date(topic.at);
      const day = utcDayStart(at).getTime();
      const slot = index === 0 && options.startNow ? earliest : Math.max(day, earliest);
      earliest = slot + spacingDays * DAY_MS;
      if (slot === day) continue;
      // The topic keeps its time of day.
      const next = new Date(slot + (at.getTime() - day));
      await tx.execute(raw`update calendar_items set scheduled_for = ${next.toISOString()}::timestamp, updated_at = now() where id = ${topic.id}`);
      moved += 1;
    }
    return { moved };
  });
}
