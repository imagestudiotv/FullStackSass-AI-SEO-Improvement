import { describe, expect, it } from "vitest";

import { articlesInDays, articlesOnDay, DAYS_PER_MONTH } from "./cadence";

const month = (perMonth: number) =>
  Array.from({ length: DAYS_PER_MONTH }, (_, day) => articlesOnDay(perMonth, day));
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

describe("articlesOnDay", () => {
  it("spreads Scale's 100 over all 30 days, 3 or 4 a day (client, 2026-10-27)", () => {
    const days = month(100);
    expect(sum(days)).toBe(100);
    expect(new Set(days)).toEqual(new Set([3, 4]));
    expect(days.slice(0, 6)).toEqual([4, 3, 3, 4, 3, 3]);
  });

  it("keeps allowances that divide evenly at a fixed rate", () => {
    expect(new Set(month(60))).toEqual(new Set([2]));
    expect(new Set(month(90))).toEqual(new Set([3]));
  });

  it("gives a month's worth or fewer one a day, so they start at once", () => {
    expect(new Set(month(30))).toEqual(new Set([1]));
    expect(articlesOnDay(5, 0)).toBe(1);
    expect(articlesOnDay(0, 0)).toBe(1);
  });

  it("adds up to the allowance for any size over a month", () => {
    for (const perMonth of [31, 45, 75, 100, 101, 150, 299]) {
      expect(sum(month(perMonth))).toBe(perMonth);
    }
  });
});

describe("articlesInDays", () => {
  it("is the most any run of days holds", () => {
    for (const perMonth of [30, 45, 60, 100, 150]) {
      const days = month(perMonth);
      const busiestPair = Math.max(...days.slice(1).map((value, i) => days[i] + value));
      expect(articlesInDays(perMonth, 2)).toBe(busiestPair);
    }
  });

  it("is two days' worth of one a day for small plans", () => {
    expect(articlesInDays(5, 2)).toBe(2);
    expect(articlesInDays(30, 2)).toBe(2);
  });

  it("is 7 for Scale's two-day batch, not the 8 of four a day", () => {
    expect(articlesInDays(100, 2)).toBe(7);
  });
});
