/**
 * How a plan's monthly articles are spread over the days.
 *
 * One rule for the calendar (scheduleDates), the re-plan (replan.ts) and the
 * daily writer (scheduled-articles.ts), so what is planned and what is written
 * cannot drift apart.
 *
 * SPREAD OVER THE WHOLE MONTH (client, 2026-10-27). Scale's 100 articles used
 * to go out at ceil(100 / 30) = 4 a day, so the month's articles were all
 * used by day 25 and the last five days had none. The client chose "100 a
 * month, spread over 3-4 a day so they last the whole month": day by day the
 * running total follows 100 / 30, which gives 4, 3, 3, 4, 3, 3, ... and
 * exactly 100 on day 30. Allowances that divide evenly are unchanged (60 is two
 * a day, 90 three).
 *
 * A plan with a month's worth or fewer still gets one a day from today and
 * runs out early rather than rationing itself (see scheduleDates): an article
 * a day for a fortnight is a better start than one a week.
 */

/** The month every allowance is spread over, as everywhere else in RepGet. */
export const DAYS_PER_MONTH = 30;

/**
 * Articles on day `day` (0 = the first day planned) of a plan with `perMonth`
 * articles a month. Integer arithmetic, so 30 days of a 100 plan add up to
 * exactly 100 rather than drifting with floating-point error.
 */
export function articlesOnDay(perMonth: number, day: number): number {
  if (perMonth <= DAYS_PER_MONTH) return 1;
  return (
    Math.ceil(((day + 1) * perMonth) / DAYS_PER_MONTH) -
    Math.ceil((day * perMonth) / DAYS_PER_MONTH)
  );
}

/** One day, in milliseconds. Days here are UTC calendar days, as the scheduler counts them. */
export const DAY_MS = 24 * 60 * 60 * 1000;

/** On the Free plan: the first article at once, then one every this many days (client, 2026-11-24). */
export const FREE_DAYS_PER_ARTICLE = 7;

/** At most `articles` started in any `days` UTC calendar days, today included. */
export type ArticlePace = { articles: number; days: number };

/** Start of the UTC calendar day. */
export function utcDayStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** The first UTC day that counts towards the pace now: starts since then use it up. */
export function paceWindowStart(pace: ArticlePace, now: Date): Date {
  return new Date(utcDayStart(now).getTime() - (pace.days - 1) * DAY_MS);
}

/** Whole UTC days from `since` to `now`: 0 on the first day. */
export function dayIndex(since: Date, now: Date): number {
  return Math.max(0, Math.round((utcDayStart(now).getTime() - utcDayStart(since).getTime()) / DAY_MS));
}

/**
 * THE PACE: how many articles RepGet may start by itself (client, 2026-11-24:
 * "one article per week. And for subscribers 1 article a day"; a Free website
 * had three in one day, because writing ahead was done in batches of two days).
 *
 *  - Free: one every FREE_DAYS_PER_ARTICLE days, counted from the last one
 *    started (the first is written at once);
 *  - a plan with a month's worth or fewer: one a day;
 *  - a larger plan: its own daily share (articlesOnDay; Scale's 60 is two a
 *    day), because one a day could not deliver what it sells.
 *
 * `perMonth` is the plan's monthly allowance, or a value of 0 or less for a
 * plan without one; `day` is the day of the allowance month (dayIndex).
 * An administrator's "Articles per day" (lib/publishing/daily-cap.ts) also
 * applies: the lower of the two wins (lib/articles/pace.ts).
 */
export function articlePace(plan: { free: boolean; perMonth: number }, day: number): ArticlePace {
  if (plan.free) return { articles: 1, days: FREE_DAYS_PER_ARTICLE };
  return { articles: articlesOnDay(plan.perMonth, day), days: 1 };
}
