import { PageShell } from "@/components/ui/page-header";
import { HeaderSkeleton, ListSkeleton } from "@/components/ui/page-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Account: the settings strip, the title, then stacked form sections.
 *
 * Wide like the page itself, with a placeholder where the strip renders, so
 * the content lands in place instead of jumping sideways and down on load.
 */
export default function Loading() {
  return (
    <PageShell width="wide">
      <Skeleton className="h-12 w-full rounded-xl motion-reduce:animate-none" />
      <HeaderSkeleton />
      <ListSkeleton rows={4} />
    </PageShell>
  );
}
