import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

  /**
   * Nothing to move between. Rendering a disabled control on a single page of
   * results is noise that implies there is more to see.
   */
  if (total === 0 || lastPage === 1) return null;

  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  function href(target: number): string {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value) query.set(key, value);
    }
    // Page 1 is the default, so it stays out of the URL and the first page
    // has one canonical address rather than two.
    if (target > 1) query.set("page", String(target));
    const suffix = query.toString();
    return suffix ? `${basePath}?${suffix}` : basePath;
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {/*
        The range and the total together. "1-25 of 400" is what tells an
        operator to search rather than page; "page 1 of 16" does not.
      */}
      <p className="text-sm text-muted-foreground tabular-nums">
        {first}-{last} of {total}
      </p>

      <div className="flex items-center gap-1">
        <Button
          asChild={page > 1}
          variant="outline"
          size="sm"
          disabled={page <= 1}
          // A disabled anchor is still focusable and clickable, so the first
          // page renders a real button instead.
          aria-label="Previous page"
        >
          {page > 1 ? (
            <Link href={href(page - 1)}>
              <ChevronLeft className="size-4" aria-hidden="true" />
              Previous
            </Link>
          ) : (
            <span>
              <ChevronLeft className="size-4" aria-hidden="true" />
              Previous
            </span>
          )}
        </Button>

        <span
          className={cn(
            "px-2 text-sm text-muted-foreground tabular-nums",
            "whitespace-nowrap",
          )}
        >
          Page {page} of {lastPage}
        </span>

        <Button
          asChild={page < lastPage}
          variant="outline"
          size="sm"
          disabled={page >= lastPage}
          aria-label="Next page"
        >
          {page < lastPage ? (
            <Link href={href(page + 1)}>
              Next
              <ChevronRight className="size-4" aria-hidden="true" />
            </Link>
          ) : (
            <span>
              Next
              <ChevronRight className="size-4" aria-hidden="true" />
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}
