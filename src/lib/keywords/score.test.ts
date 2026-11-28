import { describe, expect, it } from "vitest";

import { isOutOfReach, knownDifficulty, rankKeywords, scoreKeyword } from "./score";

const base = { volume: 500, difficulty: 20, cpc: null };

describe("knownDifficulty", () => {
  it("reads the provider's 0 and anything unusable as unknown", () => {
    expect(knownDifficulty(0)).toBeNull();
    expect(knownDifficulty(null)).toBeNull();
    expect(knownDifficulty(undefined)).toBeNull();
    expect(knownDifficulty(Number.NaN)).toBeNull();
    expect(knownDifficulty(-3)).toBeNull();
    expect(knownDifficulty(34)).toBe(34);
    expect(knownDifficulty(140)).toBe(100);
  });
});

describe("scoreKeyword", () => {
  it("does not let an unmeasured 0 look like the easiest keyword", () => {
    const zero = scoreKeyword({ ...base, difficulty: 0, intent: "informational" });
    expect(zero).toBe(scoreKeyword({ ...base, difficulty: null, intent: "informational" }));
    expect(zero).toBe(scoreKeyword({ ...base, difficulty: 50, intent: "informational" }));
    expect(zero).toBeLessThan(scoreKeyword({ ...base, difficulty: 10, intent: "informational" }));
  });

  it("puts a business's buyers first, as before", () => {
    expect(scoreKeyword({ ...base, intent: "transactional" })).toBeGreaterThan(scoreKeyword({ ...base, intent: "informational" }));
    expect(scoreKeyword({ ...base, intent: "transactional" }, "business")).toBe(scoreKeyword({ ...base, intent: "transactional" }));
  });

  it("does not penalise a publisher's informational searches", () => {
    const informational = scoreKeyword({ ...base, intent: "informational" }, "publisher");
    expect(informational).toBeGreaterThan(scoreKeyword({ ...base, intent: "transactional" }, "publisher"));
    expect(informational).toBeGreaterThan(scoreKeyword({ ...base, intent: "commercial" }, "publisher"));
    expect(informational).toBeGreaterThan(scoreKeyword({ ...base, intent: "informational" }, "business"));
    expect(scoreKeyword({ ...base, intent: "navigational" }, "publisher")).toBeLessThan(informational);
  });

  it("ranks by site type", () => {
    const rows = [
      { term: "buy greeting cards", ...base, intent: "transactional" as const },
      { term: "birthday wishes for a colleague", ...base, intent: "informational" as const },
    ];
    expect(rankKeywords(rows, "publisher")[0].term).toBe("birthday wishes for a colleague");
    expect(rankKeywords(rows)[0].term).toBe("buy greeting cards");
  });
});

describe("isOutOfReach", () => {
  it("never calls an unmeasured keyword out of reach or easy", () => {
    expect(isOutOfReach({ ...base, difficulty: 0, intent: null })).toBe(false);
    expect(isOutOfReach({ ...base, difficulty: 75, intent: null })).toBe(true);
  });
});
