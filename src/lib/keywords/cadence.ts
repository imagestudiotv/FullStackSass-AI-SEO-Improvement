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

/**
 * The most articles any `days` days in a row hold: what the scheduler writes
 * ahead as one batch. For 100 a month, two days hold at most 7 (4 + 3).
 */
export function articlesInDays(perMonth: number, days: number): number {
  if (perMonth <= DAYS_PER_MONTH) return days;
  return Math.ceil((days * perMonth) / DAYS_PER_MONTH);
}
