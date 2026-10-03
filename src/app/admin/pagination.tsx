import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/i18n/format";

/**
 * Moving between pages of an admin list.
 *
 * Every list took a bare limit(100) and returned an array, so anything past
 * the hundredth row was invisible — no control, and nothing on screen saying
 * rows were missing. Silent truncation is the worst version of this: an
 * operator searching for a customer who is there concludes they are not.
 *
 * A server component with links rather than buttons, so the page lives in the
 * URL. That keeps it shareable, survives a refresh, and means the back button
 * does what it looks like it does.
 *
 * Existing query parameters are carried through, so paging inside a search or
 * a customer filter does not silently widen the list back to everything.
 */

/** The href for one page, carrying the list's parameters. Page 1 stays out of the URL. */
export function pageHref(basePath: string, params: Record<string, string | undefined>, target: number): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && key !== "page") query.set(key, value);
  }
  if (target > 1) query.set("page", String(target));
  const suffix = query.toString();
  return suffix ? `${basePath}?${suffix}` : basePath;
}

export function Pagination({
  page,
  pageSize,
  total,
  /** Current query string values to preserve, e.g. { q: "acme", status: "draft" }. */
  params = {},
  basePath,
}: {
  page: number;
  pageSize: number;
  total: number;
  params?: Record<string, string | undefined>;
  basePath: string;
}) {
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  const n = (value: number) => formatNumber(value, "en");

  /*
    A page past the end - an old link, a hand-typed ?page=, or rows deleted
    since. It used to print an impossible range ("Showing 76–75 of 60"); say
    what happened and offer the last real page instead.
  */
  if (total > 0 && page > lastPage) {
    return (
      <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Page {n(page)} is past the end - there {total === 1 ? "is" : "are"} {n(total)} {total === 1 ? "result" : "results"}.
        </p>
        <Button variant="outline" size="sm" asChild className="h-8 bg-background">
          <Link href={pageHref(basePath, params, lastPage)}>
            <ChevronLeft className="size-4" aria-hidden="true" />
            Go to page {n(lastPage)}
          </Link>
        </Button>
      </nav>
    );
  }

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3">
      {/*
        The range and the total together. "1-25 of 400" is what tells an
        operator to search rather than page; "page 1 of 16" does not.
      */}
      <p className="text-sm tabular-nums text-muted-foreground">
        {total === 0 ? "No results" : `Showing ${n(first)}–${n(last)} of ${n(total)}`}
      </p>

      {lastPage > 1 ? (
        <div className="flex items-center gap-1">
          {/*
            A real disabled button at the ends, not a disabled anchor: an anchor
            with the disabled attribute is still focusable and still followed.
          */}
          {page > 1 ? (
            <Button variant="outline" size="sm" asChild className="h-8 bg-background">
              <Link href={pageHref(basePath, params, page - 1)} aria-label="Previous page">
                <ChevronLeft className="size-4" aria-hidden="true" />
                <span className="hidden sm:inline">Previous</span>
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled className="h-8" aria-label="Previous page">
              <ChevronLeft className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">Previous</span>
            </Button>
          )}

          <span className="whitespace-nowrap px-2 text-sm tabular-nums text-muted-foreground">
            Page {n(page)} of {n(lastPage)}
          </span>

          {page < lastPage ? (
            <Button variant="outline" size="sm" asChild className="h-8 bg-background">
              <Link href={pageHref(basePath, params, page + 1)} aria-label="Next page">
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled className="h-8" aria-label="Next page">
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
          )}
        </div>
      ) : null}
    </nav>
  );
}
