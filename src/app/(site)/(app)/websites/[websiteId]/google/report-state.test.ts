import { describe, expect, it } from "vitest";

import { DEFAULT_GOOGLE_RANGE, googleRangeDays, googleRangeHref, longerRangeReaches, parseGoogleRange } from "./range";
import { analyticsPropertyId, countChange, ctrChange, displayPageUrl, googleNumbers, positionChange, sourceState } from "./report-state";

/**
 * The Google page's rules that are not queries: which state a source is in,
 * how a change is judged, how numbers read in each language, and which
 * periods the URL accepts.
 */

describe("sourceState", () => {
  it("is ready whenever the period holds reported days, zeros included", () => {
    expect(sourceState({ selected: true, through: "2026-09-30", daysReported: 3 })).toEqual({ state: "ready", stale: false });
  });
  it("marks figures that remain after the property was unchosen as stale, not hidden", () => {
    expect(sourceState({ selected: false, through: "2026-09-30", daysReported: 3 })).toEqual({ state: "ready", stale: true });
  });
  it("tells not chosen, never imported and silent in this period apart", () => {
    expect(sourceState({ selected: false, through: null, daysReported: 0 }).state).toBe("notSelected");
    expect(sourceState({ selected: true, through: null, daysReported: 0 }).state).toBe("awaitingData");
    expect(sourceState({ selected: true, through: "2026-08-01", daysReported: 0 }).state).toBe("noDataInPeriod");
  });
});

describe("changes against the previous period", () => {
  it("shows nothing without a comparable period - missing history is not zero growth", () => {
    expect(countChange(120, null)).toBeNull();
    expect(positionChange(4.2, null)).toBeNull();
    expect(positionChange(null, 4.2)).toBeNull();
    expect(ctrChange(0.05, null)).toBeNull();
  });
  it("gives a percentage only against a non-zero baseline", () => {
    expect(countChange(150, 100)).toEqual({ direction: "up", improved: true, delta: 50, percent: 50 });
    expect(countChange(3, 0)).toEqual({ direction: "up", improved: true, delta: 3, percent: null });
    expect(countChange(80, 100)).toEqual({ direction: "down", improved: false, delta: -20, percent: -20 });
    expect(countChange(100, 100)).toEqual({ direction: "flat", improved: null, delta: 0, percent: null });
  });
  it("treats a lower position as better, rounded to a tenth", () => {
    expect(positionChange(3.04, 5.1)).toEqual({ direction: "down", improved: true, delta: -2.1, percent: null });
    expect(positionChange(8, 6)).toMatchObject({ direction: "up", improved: false });
    expect(positionChange(5.01, 5.02)?.direction).toBe("flat");
  });
  it("measures click-through rate in percentage points", () => {
    expect(ctrChange(0.052, 0.04)).toEqual({ direction: "up", improved: true, delta: 1.2, percent: null });
  });
});

describe("googleNumbers", () => {
  it("formats in the reader's convention", () => {
    const de = googleNumbers("de");
    expect(de.count(1234567)).toBe("1.234.567");
    expect(de.position(4.25)).toMatch(/^4,[23]$/);
    expect(de.ctr(0.034)).toMatch(/^3,4\s%$/);
    expect(de.signedCount(-20)).toMatch(/^[-−]20$/);
    expect(de.signedPercent(12)).toMatch(/^\+12\s%$/);
    const en = googleNumbers("en");
    expect(en.count(1234567)).toBe("1,234,567");
    expect(en.ctr(0.034)).toBe("3.4%");
    expect(en.signedDecimal(-2.1)).toMatch(/^[-−]2\.1$/);
    expect(en.position(null)).toBeNull();
    expect(en.ctr(null)).toBeNull();
  });
});

describe("helpers", () => {
  it("shortens page URLs and GA property names for display", () => {
    expect(displayPageUrl("https://www.example.com/blog/post?x=1")).toBe("www.example.com/blog/post?x=1");
    expect(analyticsPropertyId("properties/123456789")).toBe("123456789");
  });
});

describe("the ?range= parameter", () => {
  it("accepts the offered periods and falls back to 28 days for anything else", () => {
    expect(parseGoogleRange("7d")).toBe("7d");
    expect(parseGoogleRange(["90d", "7d"])).toBe("90d");
    expect(parseGoogleRange(undefined)).toBe(DEFAULT_GOOGLE_RANGE);
    expect(parseGoogleRange("365d")).toBe("28d");
    expect(parseGoogleRange("28d; drop table")).toBe("28d");
    expect(googleRangeDays("90d")).toBe(90);
  });
  it("knows whether a longer period on offer would reach an older day", () => {
    // 7 days ending 30 Sept: 1 Sept is 30 days back, inside 90 days (and 28 is too short).
    expect(longerRangeReaches("2026-09-01", "2026-09-30", 7)).toBe(true);
    expect(longerRangeReaches("2026-09-01", "2026-09-30", 28)).toBe(true);
    // Exactly the first day of 90 days, then one day beyond it.
    expect(longerRangeReaches("2026-07-03", "2026-09-30", 28)).toBe(true);
    expect(longerRangeReaches("2026-07-02", "2026-09-30", 28)).toBe(false);
    // Already on the longest period: there is nothing longer to choose.
    expect(longerRangeReaches("2026-06-01", "2026-09-30", 90)).toBe(false);
  });
  it("keeps the plain address for the default period", () => {
    expect(googleRangeHref("w1", "28d")).toBe("/websites/w1/google");
    expect(googleRangeHref("w1", "7d")).toBe("/websites/w1/google?range=7d");
  });
});
