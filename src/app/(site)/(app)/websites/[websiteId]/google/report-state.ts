import type { Locale } from "@/lib/i18n/config";
import { intlTag } from "@/lib/i18n/format";

/**
 * What the Google page can honestly say about one source (Search Console or
 * Analytics) for the period on screen. Pure, so the rules are tested without
 * a page.
 *
 * - "ready": the source reported at least one day in the period. Its figures
 *   are real, zeros included - a quiet month is a result.
 * - "notSelected": no property chosen and nothing reported. Never a zero.
 * - "awaitingData": a property is chosen but no figures are stored for it.
 *   That is either "not imported yet" or "imported, but Google reported
 *   nothing": Google sends no row for a day without activity, so the two
 *   cannot be told apart here, and the copy must not claim either.
 * - "noDataInPeriod": imported before, but nothing in this period (the source
 *   stopped reporting, or the period is shorter than the gap).
 *
 * `stale` marks figures that exist although no property is chosen any more:
 * they are shown, but said to be no longer updated.
 */
export type SourceState = "ready" | "notSelected" | "awaitingData" | "noDataInPeriod";

export function sourceState(input: {
  selected: boolean;
  through: string | null;
  daysReported: number;
}): { state: SourceState; stale: boolean } {
  if (input.daysReported > 0) return { state: "ready", stale: !input.selected };
  if (!input.selected) return { state: "notSelected", stale: false };
  if (!input.through) return { state: "awaitingData", stale: false };
  return { state: "noDataInPeriod", stale: false };
}

/**
 * Movement against the previous period. The rules of components/ui/trend.tsx
 * (null without a comparable period, rounded to 0.1, a percentage only
 * against a non-zero baseline, "flat" when the rounded change is 0), with
 * the improvement direction worked out here so the page can say it in words
 * as well as colour.
 */
export type Change = {
  direction: "up" | "down" | "flat";
  /** Whether the movement is good news; null when flat. */
  improved: boolean | null;
  /** Absolute change, rounded to 0.1 (percentage points for CTR). */
  delta: number;
  /** Relative change in whole percent; null against a zero baseline or for rates. */
  percent: number | null;
};

const round1 = (value: number) => Math.round(value * 10) / 10;

function change(delta: number, percent: number | null, higherIsBetter: boolean): Change {
  const rounded = round1(delta);
  if (rounded === 0) return { direction: "flat", improved: null, delta: 0, percent: null };
  const up = rounded > 0;
  return { direction: up ? "up" : "down", improved: higherIsBetter ? up : !up, delta: rounded, percent };
}

/** Clicks, impressions, sessions. */
export function countChange(current: number, previous: number | null): Change | null {
  if (previous === null) return null;
  const delta = current - previous;
  return change(delta, previous !== 0 ? Math.round((delta / Math.abs(previous)) * 100) : null, true);
}

/** Average position: a smaller number is a better place. No percentage - "12% better position" means nothing. */
export function positionChange(current: number | null, previous: number | null): Change | null {
  if (current === null || previous === null) return null;
  return change(current - previous, null, false);
}

/** Click-through rate, as a change in percentage points. */
export function ctrChange(current: number | null, previous: number | null): Change | null {
  if (current === null || previous === null) return null;
  return change((current - previous) * 100, null, true);
}

/**
 * Number formats for the page, in the reader's convention. Used by server
 * components only, so the server's ICU is the only one that formats them and
 * nothing can differ at hydration.
 */
export function googleNumbers(locale: Locale) {
  const tag = intlTag(locale);
  const whole = new Intl.NumberFormat(tag, { maximumFractionDigits: 0 });
  const oneDecimal = new Intl.NumberFormat(tag, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const rate = new Intl.NumberFormat(tag, { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const signedWhole = new Intl.NumberFormat(tag, { maximumFractionDigits: 0, signDisplay: "exceptZero" });
  const signedDecimal = new Intl.NumberFormat(tag, { minimumFractionDigits: 1, maximumFractionDigits: 1, signDisplay: "exceptZero" });
  const signedPercent = new Intl.NumberFormat(tag, { style: "percent", maximumFractionDigits: 0, signDisplay: "exceptZero" });
  return {
    count: (value: number) => whole.format(value),
    position: (value: number | null) => (value === null ? null : oneDecimal.format(value)),
    ctr: (value: number | null) => (value === null ? null : rate.format(value)),
    signedCount: (value: number) => signedWhole.format(value),
    signedDecimal: (value: number) => signedDecimal.format(value),
    signedPercent: (percent: number) => signedPercent.format(percent / 100),
  };
}

export type GoogleNumbers = ReturnType<typeof googleNumbers>;

/** A page URL without its scheme, for a narrow column: "example.com/blog/post". */
export function displayPageUrl(url: string): string {
  return url.replace(/^https?:\/\//i, "");
}

/** "properties/123456789" -> "123456789", for a GA property whose name is not known here. */
export function analyticsPropertyId(property: string): string {
  return property.replace(/^properties\//, "");
}
