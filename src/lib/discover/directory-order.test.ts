import { describe, expect, it } from "vitest";

import { LOCALES } from "@/lib/i18n/config";

import { sortDirectory } from "./directory-order";

/**
 * /discover's order (client, 2026-11-19: "imagestudio website will be always
 * first stable fixed, no matter the other businesses we will be adding"):
 * Image Studio is row 1 in both sorts, in every language, after any filter,
 * and no entry is ever repeated or lost.
 */

const entry = (name: string, upvotes: number, publishedAt: string, pinned = false) => ({ name, upvotes, publishedAt, pinned });

const studio = entry("Image Studio", 0, "2026-10-01T00:00:00.000Z", true);
const others = [
  entry("Zeta Tours", 50, "2026-11-10T00:00:00.000Z"),
  entry("Alpha Bakery", 9, "2026-11-12T00:00:00.000Z"),
  entry("Beta Films", 9, "2026-11-15T00:00:00.000Z"),
  entry("Aardvark Co", 1, "2026-11-01T00:00:00.000Z"),
];

describe("sortDirectory", () => {
  it.each(LOCALES)("%s: Image Studio first by upvotes and by name, though it has the fewest votes and sorts last by name", (locale) => {
    const input = [...others, studio];
    expect(sortDirectory(input, "votes", locale).map((e) => e.name)).toEqual(["Image Studio", "Zeta Tours", "Beta Films", "Alpha Bakery", "Aardvark Co"]);
    expect(sortDirectory(input, "az", locale)[0].name).toBe("Image Studio");
    expect(sortDirectory(input, "az", locale).slice(1).map((e) => e.name)).toEqual(["Aardvark Co", "Alpha Bakery", "Beta Films", "Zeta Tours"]);
  });

  it("keeps every entry exactly once, so pages cut from the list never repeat or drop Image Studio", () => {
    const input = [studio, ...others];
    for (const sort of ["votes", "az"] as const) {
      const sorted = sortDirectory(input, sort, "en");
      expect(sorted).toHaveLength(input.length);
      expect(new Set(sorted)).toEqual(new Set(input));
      const pages = [sorted.slice(0, 2), sorted.slice(2, 4), sorted.slice(4)];
      expect(pages.flat().filter((e) => e.pinned)).toHaveLength(1);
    }
    // The input is not reordered in place.
    expect(input[0]).toBe(studio);
  });

  it("after a filter that hides Image Studio, the rest keep the chosen sort; with no Image Studio at all, the plain sort", () => {
    expect(sortDirectory(others, "votes", "en").map((e) => e.name)).toEqual(["Zeta Tours", "Beta Films", "Alpha Bakery", "Aardvark Co"]);
    expect(sortDirectory([], "az", "en")).toEqual([]);
  });
});
