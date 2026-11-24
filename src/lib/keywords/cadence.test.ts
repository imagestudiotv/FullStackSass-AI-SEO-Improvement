import { describe, expect, it } from "vitest";

import { articlePace, articlesOnDay, dayIndex, DAYS_PER_MONTH, paceWindowStart, utcDayStart } from "./cadence";

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

describe("articlePace", () => {
  it("is one every seven days on Free, whatever the day", () => {
    expect(articlePace({ free: true, perMonth: 4 }, 0)).toEqual({ articles: 1, days: 7 });
    expect(articlePace({ free: true, perMonth: 4 }, 19)).toEqual({ articles: 1, days: 7 });
  });

  it("is one a day for a paid plan of 30 a month or fewer, and without an article limit", () => {
    for (const perMonth of [-1, 1, 5, 10, 30]) {
      expect(articlePace({ free: false, perMonth }, 3)).toEqual({ articles: 1, days: 1 });
    }
  });

  it("is the plan's own daily share above 30 a month: Scale's 60 is two a day", () => {
    expect(articlePace({ free: false, perMonth: 60 }, 0)).toEqual({ articles: 2, days: 1 });
    expect(articlePace({ free: false, perMonth: 60 }, 29)).toEqual({ articles: 2, days: 1 });
    expect([0, 1, 2].map((day) => articlePace({ free: false, perMonth: 100 }, day).articles)).toEqual([4, 3, 3]);
  });

  it("counts in UTC calendar days, so a week after the 21st is the 28th from midnight", () => {
    const pace = articlePace({ free: true, perMonth: 4 }, 0);
    const started = new Date("2026-11-21T14:03:00Z");
    expect(paceWindowStart(pace, new Date("2026-11-27T23:59:00Z")) <= started).toBe(true);
    expect(paceWindowStart(pace, new Date("2026-11-28T06:00:00Z")) <= started).toBe(false);
    const daily = articlePace({ free: false, perMonth: 30 }, 0);
    expect(paceWindowStart(daily, new Date("2026-11-24T14:00:00Z"))).toEqual(new Date("2026-11-24T00:00:00Z"));
  });

  it("starts the day at midnight UTC", () => {
    expect(utcDayStart(new Date("2026-11-21T14:43:41Z")).toISOString()).toBe("2026-11-21T00:00:00.000Z");
    expect(utcDayStart(new Date("2026-11-21T00:00:00Z")).toISOString()).toBe("2026-11-21T00:00:00.000Z");
  });

  it("numbers the allowance month's days from its start", () => {
    const since = new Date("2026-11-21T18:30:00Z");
    expect(dayIndex(since, new Date("2026-11-21T23:00:00Z"))).toBe(0);
    expect(dayIndex(since, new Date("2026-11-22T01:00:00Z"))).toBe(1);
    expect(dayIndex(since, new Date("2026-11-20T01:00:00Z"))).toBe(0);
  });
});
