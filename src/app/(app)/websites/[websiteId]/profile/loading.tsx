import { Skeleton } from "@/components/ui/skeleton";

/**
 * The Business settings page's own shape - title, the section rail on wide
 * screens, the three form sections and the competitor list - so the page
 * lands in place instead of jumping from a list of rows to a form. Sections
 * only: the website layout already supplies the shell and the settings strip.
 *
 * Every block stops pulsing under reduced motion (the shared HeaderSkeleton
 * does not, so the header is drawn here).
 */
const pulse = "motion-reduce:animate-none";

function SectionSkeleton({ fields, wide }: { fields: number; wide?: boolean }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-start gap-3">
        <Skeleton className={`size-8 shrink-0 rounded-lg ${pulse}`} />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className={`h-4 w-40 ${pulse}`} />
          <Skeleton className={`h-3 w-72 max-w-full ${pulse}`} />
        </div>
      </div>
      <div className="mt-5 grid gap-x-4 gap-y-5 sm:grid-cols-2">
        {Array.from({ length: fields }, (_, i) => (
          <div key={i} className={wide ? "space-y-2 sm:col-span-2" : "space-y-2"}>
            <Skeleton className={`h-3.5 w-28 ${pulse}`} />
            <Skeleton className={`${wide ? "h-32" : "h-8"} w-full rounded-lg ${pulse}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

function CompetitorsSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-start gap-3">
        <Skeleton className={`size-8 shrink-0 rounded-lg ${pulse}`} />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className={`h-4 w-32 ${pulse}`} />
          <Skeleton className={`h-3 w-80 max-w-full ${pulse}`} />
        </div>
      </div>
      <Skeleton className={`mt-5 h-24 w-full rounded-lg ${pulse}`} />
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className={`h-10 w-full rounded-lg ${pulse}`} />
        ))}
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <div className="space-y-2">
        <Skeleton className={`h-7 w-48 ${pulse}`} />
        <Skeleton className={`h-4 w-96 max-w-full ${pulse}`} />
      </div>
      <div className="lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-8">
        <div className="hidden space-y-2 lg:block">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className={`h-8 w-full ${pulse}`} />
          ))}
        </div>
        <div className="min-w-0 space-y-6">
          <SectionSkeleton fields={2} />
          <SectionSkeleton fields={3} />
          <SectionSkeleton fields={1} wide />
          <CompetitorsSkeleton />
        </div>
      </div>
    </div>
  );
}
