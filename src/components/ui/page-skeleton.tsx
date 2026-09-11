import { Skeleton } from "@/components/ui/skeleton";
import { PageShell } from "@/components/ui/page-header";

/**
 * Route-level loading skeletons.
 *
 * Every page in the app fetched on the server with no `loading.tsx`, so
 * navigation held the previous screen until the new one was ready. On a page
 * that runs an audit query or a Search Console import that is seconds of
 * nothing, and the app reads as frozen rather than busy.
 *
 * These mirror the real layout of the page they stand in for — same shell
 * width, same header block, roughly the same number of rows — so the content
 * lands in place instead of jumping. They are deliberately plain: a skeleton
 * that animates more than the page it replaces draws attention to the wait.
 *
 * Skeletons stand in for layout that is genuinely coming. They never imply a
 * count we do not know yet, which is why the row counts below are small.
 */

/** Title + one-line description, matching PageHeader's type scale. */
export function HeaderSkeleton({ withAction = false }: { withAction?: boolean }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      {withAction ? <Skeleton className="h-9 w-32 shrink-0" /> : null}
    </div>
  );
}

/** A row of metric cards, as used on the dashboard and website overview. */
export function StatsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rounded-xl border p-4 space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-16" />
        </div>
      ))}
    </div>
  );
}

/** Stacked list rows — articles, websites, backlinks, activity. */
export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-xl border divide-y">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 p-4">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-5 w-20 shrink-0 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/**
 * Default page skeleton: header, optional stats, a list.
 *
 * Covers most routes. A page whose shape differs enough to jump should get its
 * own loading.tsx composed from the pieces above instead of using this.
 */
export function PageSkeleton({
  stats = 0,
  rows = 5,
  withAction = false,
  width = "default",
}: {
  stats?: number;
  rows?: number;
  withAction?: boolean;
  width?: "default" | "wide";
}) {
  return (
    <PageShell width={width}>
      <HeaderSkeleton withAction={withAction} />
      {stats > 0 ? <StatsSkeleton count={stats} /> : null}
      <ListSkeleton rows={rows} />
    </PageShell>
  );
}
