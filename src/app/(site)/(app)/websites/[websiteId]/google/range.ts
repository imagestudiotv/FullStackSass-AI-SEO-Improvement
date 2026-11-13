/**
 * The periods the Google page reports on, as its ?range= values.
 *
 * 28 days stays the default: it is what this page always showed, and what
 * Search Console itself opens on. 7 and 90 days match Google's own presets.
 * Every figure, chart and table on the page follows the one range, and the
 * range lives in the URL so a refresh, a shared link and the import polling
 * (router.refresh) all keep it.
 *
 * A comparison needs the whole previous period imported for that source, so a
 * 90-day view shows no change until 180 days of history exist. That is the
 * honest answer: missing history is not zero growth.
 */
export const GOOGLE_RANGES = ["7d", "28d", "90d"] as const;

export type GoogleRange = (typeof GOOGLE_RANGES)[number];

export const DEFAULT_GOOGLE_RANGE: GoogleRange = "28d";

/** A ?range= value, or the default for anything missing or unknown. */
export function parseGoogleRange(value: string | string[] | undefined): GoogleRange {
  const raw = Array.isArray(value) ? value[0] : value;
  return (GOOGLE_RANGES as readonly string[]).includes(raw ?? "") ? (raw as GoogleRange) : DEFAULT_GOOGLE_RANGE;
}

/** Whole days in a range. */
export function googleRangeDays(range: GoogleRange): number {
  return Number.parseInt(range, 10);
}

/**
 * Whether one of the longer periods on offer would include a day that falls
 * before the current one. Every period ends on the same newest stored day, so
 * it is a question of length only. Decides whether "choose a longer period"
 * is advice the reader can follow.
 */
export function longerRangeReaches(day: string, end: string, days: number): boolean {
  const span = Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`)) / 86_400_000) + 1;
  return GOOGLE_RANGES.some((option) => googleRangeDays(option) > days && googleRangeDays(option) >= span);
}

/** The page's URL for a range; the default range keeps the plain address. */
export function googleRangeHref(websiteId: string, range: GoogleRange): string {
  const base = `/websites/${websiteId}/google`;
  return range === DEFAULT_GOOGLE_RANGE ? base : `${base}?range=${range}`;
}
