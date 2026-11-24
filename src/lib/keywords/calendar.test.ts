import { describe, expect, it } from "vitest";

import { scheduleDates } from "./calendar";

/*
  Local-time dates throughout: scheduleDates builds its days with the local
  getters, so these hold in any time zone the tests run in.
*/
const day = (date: Date) => `${date.getMonth() + 1}/${date.getDate()}`;
const at = (d: number, hour: number) => new Date(2026, 9, d, hour, 0, 0, 0);

describe("scheduleDates", () => {
  const from = at(13, 8);

  it("fills one a day from today when nothing is kept, as before", () => {
    const dates = scheduleDates(3, from);
    expect(dates.map(day)).toEqual(["10/13", "10/14", "10/15"]);
    expect(dates.map((d) => d.getHours())).toEqual([9, 9, 9]);
  });

  it("keeps the plan's daily rate when only part of the month is left", () => {
    // A Scale plan (100 a month: 4, 3, 3, ...) with 8 left: three days, not eight.
    const dates = scheduleDates(8, from, { perMonth: 100 });
    expect(dates.map(day)).toEqual(["10/13", "10/13", "10/13", "10/13", "10/14", "10/14", "10/14", "10/15"]);
    expect(dates.slice(0, 4).map((d) => d.getHours())).toEqual([9, 12, 15, 18]);
  });

  it("spreads Scale's 100 over the whole month, 3 or 4 a day (client, 2026-10-27)", () => {
    // It was four a day, so the month's articles were all used by day 25.
    const dates = scheduleDates(100, from, { perMonth: 100 });
    const perDay = new Map<string, number>();
    for (const date of dates) perDay.set(day(date), (perDay.get(day(date)) ?? 0) + 1);

    expect(dates).toHaveLength(100);
    expect(perDay.size).toBe(30);
    expect(new Set(perDay.values())).toEqual(new Set([3, 4]));
    expect(day(dates[0])).toBe("10/13");
    expect(day(dates[99])).toBe("11/11"); // the 30th day, counting today
  });

  it("spreads the same way without being told the plan's allowance", () => {
    const dates = scheduleDates(100, from);
    expect(new Set(dates.map(day)).size).toBe(30);
  });

  it("keeps allowances that divide evenly at a fixed rate", () => {
    const dates = scheduleDates(6, from, { perMonth: 90 });
    expect(dates.map(day)).toEqual(["10/13", "10/13", "10/13", "10/14", "10/14", "10/14"]);
  });

  it("skips the days a kept article already fills", () => {
    // Today's article is out and tomorrow's draft is written ahead.
    const dates = scheduleDates(3, from, { perMonth: 30, occupied: [at(13, 9), at(14, 9)] });
    expect(dates.map(day)).toEqual(["10/15", "10/16", "10/17"]);
  });

  it("fills the rest of a part-taken day, after the kept article", () => {
    const dates = scheduleDates(4, from, { perMonth: 90, occupied: [at(13, 9)] });
    expect(dates.map(day)).toEqual(["10/13", "10/13", "10/14", "10/14"]);
    expect(dates.map((d) => d.getHours())).toEqual([12, 15, 9, 12]);
  });

  it("never dates an item earlier than now", () => {
    const evening = at(13, 20);
    const [first, second] = scheduleDates(2, evening, { perMonth: 30 });
    expect(first.getTime()).toBe(evening.getTime());
    expect(day(second)).toBe("10/14");
  });

  it("puts Free's topics a week apart, the first one today (client, 2026-11-24: one article per week)", () => {
    const from = at(13, 11);
    const dates = scheduleDates(4, from, { perMonth: 4, everyDays: 7 });
    expect(dates.map((d) => d.getDate())).toEqual([13, 20, 27, new Date(from.getFullYear(), from.getMonth(), 34).getDate()]);
    // Never earlier today than now.
    expect(dates[0]).toEqual(from);
  });

  it("starts Free's topics a week after its last article, and keeps a week from a kept item", () => {
    const from = at(13, 11);
    expect(scheduleDates(2, from, { everyDays: 7, notBefore: at(18, 0) }).map((d) => d.getDate())).toEqual([18, 25]);
    expect(scheduleDates(2, from, { everyDays: 7, occupied: [at(15, 9)] }).map((d) => d.getDate())).toEqual([22, 29]);
  });

  it("follows the allowance month's day, so the calendar and the scheduler share a day's number", () => {
    const from = at(13, 8);
    // Day 1 of a 100 plan holds 3, day 2 holds 3, day 3 holds 4.
    const days = scheduleDates(10, from, { perMonth: 100, firstDay: 1 }).map((d) => d.getDate());
    expect([13, 14, 15].map((day) => days.filter((d) => d === day).length)).toEqual([3, 3, 4]);
  });
});
