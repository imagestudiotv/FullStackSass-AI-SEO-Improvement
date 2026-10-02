import { describe, expect, it } from "vitest";

import { RESEARCH_STALE_MS, researchInFlight, runOutcome } from "@/lib/keywords/research-state";

describe("researchInFlight", () => {
  const now = new Date("2026-10-02T12:00:00Z");
  const ago = (ms: number) => new Date(now.getTime() - ms);

  it("is true while a run is researching and recent", () => {
    expect(researchInFlight({ status: "researching", updatedAt: ago(5_000) }, now)).toBe(true);
    expect(researchInFlight({ status: "researching", updatedAt: ago(RESEARCH_STALE_MS - 1) }, now)).toBe(true);
  });

  it("is false for any other status", () => {
    for (const status of ["ready", "failed", "pending", "crawling", null]) {
      expect(researchInFlight({ status, updatedAt: ago(1_000) }, now)).toBe(false);
    }
  });

  it("is false once the status is older than the limit, so a stuck run cannot lock the button", () => {
    expect(researchInFlight({ status: "researching", updatedAt: ago(RESEARCH_STALE_MS) }, now)).toBe(false);
  });
});

describe("runOutcome", () => {
  const set = (...ids: string[]) => new Set(ids);

  it("ready when the run put new planned items in, first plan or rebuilt", () => {
    expect(runOutcome(set(), set("a", "b"), 2)).toBe("ready");
    expect(runOutcome(set("a", "b"), set("c", "d"), 5)).toBe("ready");
  });

  it("failed when there is no plan at all", () => {
    expect(runOutcome(set(), set(), 0)).toBe("failed");
  });

  it("unchanged - not ready - when a re-run failed and left the old plan", () => {
    expect(runOutcome(set("a", "b"), set("a", "b"), 4)).toBe("unchanged");
    // Only written or published items left: still not a new plan.
    expect(runOutcome(set("a"), set(), 3)).toBe("unchanged");
  });
});
