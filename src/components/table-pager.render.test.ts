import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { getMessages } from "@/lib/i18n/messages";
import { paginate } from "@/lib/pagination";

import { TablePager } from "./table-pager";

/**
 * The pager as the Opportunities table renders it, in English. What a click
 * does is the table's own state (research-tabs.tsx); this is what each page
 * shows and which controls are live.
 */

const t = getMessages("en").app.research;
const labels = {
  pagination: t.keywordPages,
  showingRange: t.showingRange,
  perPage: t.perPage,
  pageOf: t.pageOf,
  firstPage: t.firstPage,
  previousPage: t.previousPage,
  nextPage: t.nextPage,
  lastPage: t.lastPage,
  goToPage: t.goToPage,
};

function render(total: number, page: number, pageSize = 25) {
  const slice = paginate(total, page, pageSize);
  return renderToStaticMarkup(
    createElement(TablePager, {
      page: slice.current,
      pageCount: slice.pageCount,
      first: slice.start + 1,
      last: slice.end,
      total,
      pageSize,
      pageSizes: [25, 50, 100],
      onPage: () => {},
      onPageSize: () => {},
      labels,
    }),
  );
}

/** Whether the button with this accessible name is disabled. */
const disabled = (html: string, label: string) =>
  new RegExp(`<button[^>]*disabled=""[^>]*aria-label="${label}"|<button[^>]*aria-label="${label}"[^>]*disabled=""`).test(html);

describe("TablePager", () => {
  it("says which rows are showing, out of how many", () => {
    expect(render(312, 2)).toContain("Showing 26-50 of 312");
    expect(render(312, 13)).toContain("Showing 301-312 of 312");
  });

  it("numbers the pages around the current one, with gaps for the rest", () => {
    const html = render(312, 7);
    const pages = [...html.matchAll(/aria-label="Page (\d+)"/g)].map((m) => Number(m[1]));
    expect(pages).toEqual([1, 6, 7, 8, 13]);
    expect(html.match(/…/g)).toHaveLength(2);
    expect(html).toMatch(/aria-label="Page 7" aria-current="page"/);
  });

  it("disables the way back on the first page and the way on at the last", () => {
    const first = render(312, 1);
    expect(disabled(first, "First page")).toBe(true);
    expect(disabled(first, "Previous page")).toBe(true);
    expect(disabled(first, "Next page")).toBe(false);
    expect(disabled(first, "Last page")).toBe(false);

    const last = render(312, 13);
    expect(disabled(last, "Next page")).toBe(true);
    expect(disabled(last, "Last page")).toBe(true);
    expect(disabled(last, "Previous page")).toBe(false);
  });

  it("gives a phone 'Page X of Y' in place of the numbers", () => {
    expect(render(312, 3)).toContain("Page 3 of 13");
  });

  it("offers the page sizes, with the current one chosen", () => {
    const html = render(312, 1, 50);
    expect(html).toContain("Per page");
    expect(html).toMatch(/<option value="50" selected="">50<\/option>/);
  });

  it("shows only the count and the size when everything fits on one page", () => {
    const html = render(40, 1, 100);
    expect(html).toContain("Showing 1-40 of 40");
    expect(html).not.toContain("Next page");
  });
});
