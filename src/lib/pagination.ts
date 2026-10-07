/**
 * Paging a list that is already in the browser.
 *
 * The page is CLAMPED rather than trusted: deleting the last row of the last
 * page, or searching a long list down to a short one, leaves the page number
 * past the end, and a table that renders "Showing 76-75 of 75" and no rows
 * reads as if everything had been lost.
 */
export function paginate(total: number, page: number, pageSize: number) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, page), pageCount);
  const start = (current - 1) * pageSize;
  return {
    current,
    pageCount,
    /** Slice bounds, zero-based and end-exclusive. */
    start,
    end: Math.min(start + pageSize, total),
  };
}

/**
 * The page buttons to show: the first and last page, the current one with a
 * neighbour either side, and a gap for each run left out.
 *
 * ALWAYS SEVEN once there are more than seven pages, so the row keeps its
 * width and the buttons do not move under the pointer while someone clicks
 * through. A gap never stands for a single page - "1 … 3" would hide one
 * button behind a button-sized ellipsis - so that page is shown instead.
 */
export function pageItems(current: number, pageCount: number): (number | "gap")[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const start = Math.max(Math.min(current - 1, pageCount - 4), 3);
  const end = Math.min(Math.max(current + 1, 5), pageCount - 2);

  const items: (number | "gap")[] = [1, start > 3 ? "gap" : 2];
  for (let page = start; page <= end; page += 1) items.push(page);
  items.push(end < pageCount - 2 ? "gap" : pageCount - 1, pageCount);
  return items;
}
