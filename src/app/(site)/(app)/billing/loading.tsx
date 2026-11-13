import { PageShell } from "@/components/ui/page-header";
import { HeaderSkeleton, ListSkeleton, StatsSkeleton } from "@/components/ui/page-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Billing: the settings strip, the title, the plan summary, then lists.
 *
 * Wide like the page itself, with a placeholder where the strip renders, so
 * the content lands in place instead of jumping sideways and down on load.
 */
export default function Loading() {
  return (
    <PageShell width="wide">
      <Skeleton className="h-12 w-full rounded-xl motion-reduce:animate-none" />
      <HeaderSkeleton />
      <StatsSkeleton count={3} />
      <ListSkeleton rows={3} />
    </PageShell>
  );
}
