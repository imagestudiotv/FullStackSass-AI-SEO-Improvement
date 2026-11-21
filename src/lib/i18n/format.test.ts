import { describe, expect, it } from "vitest";

import { formatDate } from "./format";

describe("formatDate", () => {
  const at = new Date("2026-11-21T14:05:00Z");

  it("formats a date with its time (dateStyle + timeStyle), which toLocaleDateString refuses", () => {
    // The Social Content page (scheduled and posted videos) asks for exactly this.
    const text = formatDate(at, "en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
    expect(text).toMatch(/21 Nov 2026/);
    expect(text).toMatch(/14:05/);
  });

  it("keeps a date alone as before", () => {
    expect(formatDate(at, "en", { dateStyle: "medium", timeZone: "UTC" })).toBe("21 Nov 2026");
    expect(formatDate(at, "de", { timeZone: "UTC" })).toBe("21.11.2026");
  });

  it("shows a dash for an unparseable value", () => {
    expect(formatDate("not a date", "en", { dateStyle: "medium", timeStyle: "short" })).toBe("-");
  });
});
