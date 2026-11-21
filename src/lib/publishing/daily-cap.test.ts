import { describe, expect, it } from "vitest";

import { dailyCapFor, TEMPORARY_DAILY_CAPS, utcDayStart } from "./daily-cap";

const IMAGESTUDIO = "4aec4382-f158-4deb-b7a3-b4968aac6b41";

describe("dailyCapFor", () => {
  it("caps imagestudio.com at one a day until 1 December", () => {
    expect(dailyCapFor(IMAGESTUDIO, new Date("2026-11-22T06:00:00Z"))).toBe(1);
    expect(dailyCapFor(IMAGESTUDIO, new Date("2026-11-30T23:59:59Z"))).toBe(1);
  });

  it("ends by itself at 00:00 UTC on 1 December", () => {
    expect(dailyCapFor(IMAGESTUDIO, new Date("2026-12-01T00:00:00Z"))).toBeNull();
    expect(dailyCapFor(IMAGESTUDIO, new Date("2026-12-01T06:00:00Z"))).toBeNull();
  });

  it("leaves every other website alone", () => {
    expect(dailyCapFor("dfab7d9c-7323-4cbf-b489-4a1696d7f116", new Date("2026-11-22T06:00:00Z"))).toBeNull();
  });

  it("reads the list it is given", () => {
    const caps = [{ websiteId: "w", perDay: 3, until: new Date("2030-01-01T00:00:00Z"), site: "x" }];
    expect(dailyCapFor("w", new Date("2029-06-01T00:00:00Z"), caps)).toBe(3);
  });

  it("names a site for every cap", () => {
    for (const cap of TEMPORARY_DAILY_CAPS) expect(cap.site).not.toBe("");
  });
});

describe("utcDayStart", () => {
  it("is midnight UTC of the same UTC day", () => {
    expect(utcDayStart(new Date("2026-11-21T14:43:41Z")).toISOString()).toBe("2026-11-21T00:00:00.000Z");
    expect(utcDayStart(new Date("2026-11-21T00:00:00Z")).toISOString()).toBe("2026-11-21T00:00:00.000Z");
  });
});
