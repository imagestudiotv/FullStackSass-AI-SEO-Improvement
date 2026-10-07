"use client";

import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { useId } from "react";

import { Button } from "@/components/ui/button";
import { format } from "@/lib/i18n/format";
import { pageItems } from "@/lib/pagination";

/** The pager's words, in the reader's language. */
export type TablePagerLabels = {
  /** The nav landmark's name, e.g. "Keyword pages". */
  pagination: string;
  /** "Showing {first}-{last} of {total}" */
  showingRange: string;
  perPage: string;
  /** "Page {page} of {pages}" */
  pageOf: string;
  firstPage: string;
  previousPage: string;
  nextPage: string;
  lastPage: string;
  /** "Page {page}", the name of each numbered button. */
  goToPage: string;
};

/**
 * Moving through a long table that is already in the browser.
 *
 * Buttons, not links: the rows are client-side, and a page number in the URL
 * would mean a server round trip to show rows the browser already holds. The
 * admin lists page on the server (app/admin/pagination.tsx) because they do
 * not.
 *
 * On a phone the numbered buttons give way to "Page 3 of 13": seven numbers
 * and four arrows measure wider than a 390px screen.
 */
export function TablePager({
  page,
  pageCount,
  first,
  last,
  total,
  pageSize,
  pageSizes,
  onPage,
  onPageSize,
  labels,
}: {
  /** 1-based, already clamped to pageCount. */
  page: number;
  pageCount: number;
  /** 1-based positions of the first and last row shown. */
  first: number;
  last: number;
  total: number;
  pageSize: number;
  pageSizes: readonly number[];
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
  labels: TablePagerLabels;
}) {
  const sizeId = useId();

  const arrow = (
    target: number,
    label: string,
    Icon: typeof ChevronLeft,
    disabled: boolean,
  ) => (
    <Button
      variant="outline"
      size="icon"
      aria-label={label}
      disabled={disabled}
      onClick={() => onPage(target)}
    >
      <Icon className="size-4" aria-hidden="true" />
    </Button>
  );

  return (
    <nav
      aria-label={labels.pagination}
      className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 sm:justify-start">
        <p className="text-sm tabular-nums text-muted-foreground" aria-live="polite">
          {format(labels.showingRange, { first, last, total })}
        </p>
        <div className="flex items-center gap-2">
          <label htmlFor={sizeId} className="text-xs text-muted-foreground">
            {labels.perPage}
          </label>
          <select
            id={sizeId}
            value={pageSize}
            onChange={(event) => onPageSize(Number(event.target.value))}
            className="h-8 rounded-md border bg-background px-2 text-sm"
          >
            {pageSizes.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
      </div>

      {pageCount > 1 ? (
        <div className="flex items-center justify-center gap-1">
          {arrow(1, labels.firstPage, ChevronsLeft, page === 1)}
          {arrow(page - 1, labels.previousPage, ChevronLeft, page === 1)}

          <ul className="hidden items-center gap-1 sm:flex">
            {pageItems(page, pageCount).map((item, index) =>
              item === "gap" ? (
                <li
                  key={`gap-${index}`}
                  aria-hidden="true"
                  className="w-8 text-center text-sm text-muted-foreground"
                >
                  …
                </li>
              ) : (
                <li key={item}>
                  <Button
                    variant={item === page ? "default" : "ghost"}
                    size="icon"
                    className="tabular-nums"
                    aria-label={format(labels.goToPage, { page: item })}
                    aria-current={item === page ? "page" : undefined}
                    onClick={() => onPage(item)}
                  >
                    {item}
                  </Button>
                </li>
              ),
            )}
          </ul>
          <span className="whitespace-nowrap px-2 text-sm tabular-nums text-muted-foreground sm:hidden">
            {format(labels.pageOf, { page, pages: pageCount })}
          </span>

          {arrow(page + 1, labels.nextPage, ChevronRight, page === pageCount)}
          {arrow(pageCount, labels.lastPage, ChevronsRight, page === pageCount)}
        </div>
      ) : null}
    </nav>
  );
}
