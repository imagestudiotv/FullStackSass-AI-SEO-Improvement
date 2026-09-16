/**
 * Admin values the pages import directly.
 *
 * Kept out of actions.ts, which carries "use server": every export there must
 * be an async function, so a type or a constant declared alongside them fails
 * the build — caught by `next build`, not by tsc, which is why it compiled
 * cleanly first. Same split as notifications/shared.ts.
 */

/**
 * One page of results, with the total behind it.
 *
 * Every admin list took a bare limit(100) and returned an array, so a row
 * beyond the hundredth was simply invisible — no page control, and nothing on
 * screen admitting anything was missing. With 52 organizations already, that
 * cap was close enough to reach without noticing.
 *
 * `total` is counted separately rather than derived from the rows: a page of
 * 25 out of 400 cannot report 400 by looking at itself, and "1-25 of 400" is
 * the number that tells an operator whether to search instead of paging.
 */
export type Page<T> = {
  rows: T[];
  total: number;
  /** 1-based, so it matches what the page control shows. */
  page: number;
  pageSize: number;
};

/** Rows per page across the admin area. */
export const ADMIN_PAGE_SIZE = 25;

/**
 * Clamps a page number from the URL.
 *
 * The value is whatever someone typed in the address bar, so a negative or
 * non-numeric page must land on the first one rather than producing a
 * negative OFFSET and a database error.
 */
export function pageFrom(value: unknown): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

/**
 * Date-range filter values, shared by the pages and the queries.
 *
 * One list so a control cannot offer a range the query does not understand —
 * a mismatch would silently return everything, which looks like a filter that
 * does nothing rather than one that is broken.
 */
export const DATE_RANGES = [
  { value: "all", label: "Any time" },
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
] as const;

/**
 * Turns a range value into the timestamp to compare against, or null for no
 * limit. Anything unrecognised is treated as no limit rather than throwing:
 * the value comes from the URL, so it is whatever someone typed.
 */
export function sinceFrom(value: unknown): Date | null {
  const hours: Record<string, number> = {
    "24h": 24,
    "7d": 24 * 7,
    "30d": 24 * 30,
    "90d": 24 * 90,
  };
  const span = typeof value === "string" ? hours[value] : undefined;
  if (!span) return null;
  return new Date(Date.now() - span * 60 * 60 * 1000);
}
