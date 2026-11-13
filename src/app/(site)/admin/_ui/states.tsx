import { AlertTriangle, SearchX, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Empty, no-results, unavailable and loading states for admin pages.
 *
 * Empty and no-results are different answers: "there are no payments" and
 * "nothing matches your filters" send an operator in opposite directions, so
 * a filtered empty list always offers the way back. An unavailable figure or
 * list says so - it is never shown as zero.
 */

export function AdminEmpty({
  filtering,
  icon: Icon,
  title,
  description,
  noun,
  clearHref,
  action,
  className,
}: {
  /** True when search or filters are active. */
  filtering: boolean;
  icon: LucideIcon;
  /** For the genuinely-empty case. */
  title: string;
  description?: string;
  /** What the rows are called, e.g. "payments". */
  noun: string;
  /** Where "Clear filters" goes (the bare list, keeping any tab). */
  clearHref?: string;
  /** A real next step for the empty case, when one exists. */
  action?: ReactNode;
  className?: string;
}) {
  if (filtering) {
    return (
      <div className={cn("flex flex-col items-center px-6 py-14 text-center", className)}>
        <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-muted">
          <SearchX className="size-5 text-muted-foreground" aria-hidden="true" />
        </div>
        <p className="text-sm font-medium">No {noun} match</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">Nothing fits the current search and filters.</p>
        {clearHref ? (
          <Button variant="outline" size="sm" asChild className="mt-4">
            <Link href={clearHref}>Clear filters</Link>
          </Button>
        ) : null}
      </div>
    );
  }
  return (
    <div className={cn("flex flex-col items-center px-6 py-14 text-center", className)}>
      <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-muted">
        <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/** A section whose data could not be loaded. Says so, and how to retry. */
export function AdminUnavailable({
  title = "Could not load this",
  description = "The query failed. Reload the page to try again; if it keeps failing, check the server logs.",
  className,
}: {
  title?: string;
  description?: string;
  className?: string;
}) {
  return (
    <div role="alert" className={cn("flex items-start gap-3 rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-sm", className)}>
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
      <div className="min-w-0">
        <p className="font-medium text-foreground">{title}</p>
        <p className="mt-0.5 text-foreground/75">{description}</p>
      </div>
    </div>
  );
}

/** A skeleton shaped like the real list: header, toolbar, table. */
export function AdminListSkeleton({ rows = 8, columns = 5, withToolbar = true }: { rows?: number; columns?: number; withToolbar?: boolean }) {
  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6" aria-busy="true" aria-label="Loading">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      {withToolbar ? (
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-9 w-full max-w-md" />
          <Skeleton className="h-9 w-36" />
        </div>
      ) : null}
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="flex gap-4 border-b bg-muted/40 px-4 py-3">
          {Array.from({ length: columns }, (_, i) => (
            <Skeleton key={i} className="h-3.5 flex-1" />
          ))}
        </div>
        {Array.from({ length: rows }, (_, row) => (
          <div key={row} className="flex gap-4 border-b px-4 py-3.5 last:border-b-0">
            {Array.from({ length: columns }, (_, i) => (
              <Skeleton key={i} className={cn("h-4 flex-1", i === 0 && "flex-[2]")} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
