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
        {/*
          Two separate elements rather than one Button with asChild toggled.
          asChild={false} wrapped the icon and the label in a plain <span>
          inside the button: the button's flex row then contained one span,
          and the icon and text inside it had no layout of their own, so
          "Previous" wrapped underneath the chevron and burst the h-7 row.
        */}
        {page > 1 ? (
          <Button variant="outline" size="sm" asChild aria-label="Previous page">
            <Link href={href(page - 1)}>
              <ChevronLeft className="size-4" aria-hidden="true" />
              Previous
            </Link>
          </Button>
        ) : (
          /*
            A real disabled button, not a disabled anchor: an anchor with the
            disabled attribute is still focusable and still followed.
          */
          <Button variant="outline" size="sm" disabled aria-label="Previous page">
            <ChevronLeft className="size-4" aria-hidden="true" />
            Previous
          </Button>
        )}

        <span
          className={cn(
            "px-2 text-sm text-muted-foreground tabular-nums",
            "whitespace-nowrap",
          )}
        >
          Page {page} of {lastPage}
        </span>

        {page < lastPage ? (
          <Button variant="outline" size="sm" asChild aria-label="Next page">
            <Link href={href(page + 1)}>
              Next
              <ChevronRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled aria-label="Next page">
            Next
            <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
        )}
      </div>
    </div>
  );
}
