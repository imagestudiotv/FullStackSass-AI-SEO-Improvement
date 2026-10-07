import { describe, expect, it } from "vitest";

import { pageItems, paginate } from "./pagination";

describe("paginate", () => {
  it("slices the requested page", () => {
    expect(paginate(312, 2, 25)).toEqual({ current: 2, pageCount: 13, start: 25, end: 50 });
    expect(paginate(312, 13, 25)).toEqual({ current: 13, pageCount: 13, start: 300, end: 312 });
  });

  it("pulls a page past the end back to the last one", () => {
    // The last row of page 4 was deleted: 75 rows, three pages.
    expect(paginate(75, 4, 25)).toEqual({ current: 3, pageCount: 3, start: 50, end: 75 });
  });

  it("has one empty page for an empty list", () => {
    expect(paginate(0, 3, 25)).toEqual({ current: 1, pageCount: 1, start: 0, end: 0 });
  });
});

describe("pageItems", () => {
  it("lists every page when there are seven or fewer", () => {
    expect(pageItems(1, 1)).toEqual([1]);
    expect(pageItems(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("keeps the ends and the current page's neighbours, gapping the rest", () => {
    expect(pageItems(1, 13)).toEqual([1, 2, 3, 4, 5, "gap", 13]);
    expect(pageItems(7, 13)).toEqual([1, "gap", 6, 7, 8, "gap", 13]);
    expect(pageItems(13, 13)).toEqual([1, "gap", 9, 10, 11, 12, 13]);
  });

  it("never hides a single page behind a gap", () => {
    expect(pageItems(4, 13)).toEqual([1, 2, 3, 4, 5, "gap", 13]);
    expect(pageItems(10, 13)).toEqual([1, "gap", 9, 10, 11, 12, 13]);
  });

  it("is always seven entries long past seven pages, so the buttons do not shift", () => {
    for (let pageCount = 8; pageCount <= 60; pageCount++) {
      for (let current = 1; current <= pageCount; current++) {
        const items = pageItems(current, pageCount);
        expect(items).toHaveLength(7);
        expect(items).toContain(current);
        expect(items[0]).toBe(1);
        expect(items[6]).toBe(pageCount);
      }
    }
  });
});
