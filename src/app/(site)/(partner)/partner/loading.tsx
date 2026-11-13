import { ListSkeleton, StatsSkeleton } from "@/components/ui/page-skeleton";

/**
 * While a portal page loads: the shape of the page (a title, figures, then a
 * list), marked busy for assistive technology. No words, so nothing to
 * translate and nothing invented about progress.
 */
export default function PartnerLoading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="h-8 w-48 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
      <StatsSkeleton count={4} />
      <ListSkeleton rows={4} />
    </div>
  );
}
