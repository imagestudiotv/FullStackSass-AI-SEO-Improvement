import { describe, expect, it } from "vitest";

import { scoreAudit, type Issue } from "./rules";

/**
 * A score must disclose what it could not measure.
 *
 * Every cross-page rule in auditSite() needs at least two pages, and the orphan
 * rule is explicitly gated on `pages.length > 1`. On a one-page crawl they all
 * return nothing — which the penalty arithmetic cannot distinguish from
 * passing, because zero issues costs zero either way.
 *
 * RepGet's own homepage scored 96 from a single page this way: two suggestions,
 * three checks skipped, and a number that read like a verdict on the whole site.
 */

const issue = (severity: Issue["severity"], type = "t"): Issue => ({
  type,
  severity,
  url: "https://example.com/",
  detail: "d",
});

describe("scoreAudit arithmetic", () => {
  it("reproduces the reported 96: two suggestions on one page", () => {
    const summary = scoreAudit([issue("info"), issue("info", "u")], 1);

    // (0*25 + 0*8 + 2*2) / 1 = 4  ->  100 - 4
    expect(summary.score).toBe(96);
    expect(summary.counts).toEqual({ critical: 0, warning: 0, info: 2 });
  });

  it("normalises per page so a bigger site is not punished for its size", () => {
    const five = Array.from({ length: 5 }, () => issue("warning"));
    // Same average problem rate, same score.
    expect(scoreAudit([issue("warning")], 1).score).toBe(
      scoreAudit(five, 5).score,
    );
  });

  it("floors at 0 rather than going negative", () => {
    const many = Array.from({ length: 20 }, () => issue("critical"));
    expect(scoreAudit(many, 1).score).toBe(0);
  });

  it("gives a clean crawl 100", () => {
    expect(scoreAudit([], 5).score).toBe(100);
  });

  it("treats a zero page count as one, not a division by zero", () => {
    expect(Number.isFinite(scoreAudit([issue("info")], 0).score)).toBe(true);
  });
});

describe("notAssessed: the checks a crawl was too small to run", () => {
  it("names every cross-page check when only one page was read", () => {
    const summary = scoreAudit([issue("info")], 1);

    expect(summary.notAssessed).toEqual([
      "Duplicate page titles",
      "Duplicate descriptions",
      "Internal linking",
    ]);
  });

  it("is empty once two pages make the cross-page rules meaningful", () => {
    expect(scoreAudit([issue("info")], 2).notAssessed).toEqual([]);
    expect(scoreAudit([], 5).notAssessed).toEqual([]);
  });

  /**
   * The case that made the bug invisible: a high score and an empty finding
   * list look like a healthy site, and without this field nothing says the
   * grade rests on one page.
   */
  it("flags the skipped checks even when the score is high", () => {
    const summary = scoreAudit([], 1);

    expect(summary.score).toBe(100);
    expect(summary.notAssessed).toHaveLength(3);
  });

  it("does not affect the score itself - it only reports", () => {
    // A skipped check is disclosed, never penalised: we do not know whether
    // those pages would have passed.
    expect(scoreAudit([issue("info"), issue("info", "u")], 1).score).toBe(96);
  });
});
