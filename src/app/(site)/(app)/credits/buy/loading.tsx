import { PageShell } from "@/components/ui/page-header";
import { HeaderSkeleton, ListSkeleton } from "@/components/ui/page-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

/** Buy credits: the title, the packs, then lists. */
export default function Loading() {
  return (
    <PageShell>
      <HeaderSkeleton />
      <Skeleton className="h-96 w-full rounded-2xl motion-reduce:animate-none" />
      <ListSkeleton rows={2} />
    </PageShell>
  );
}
