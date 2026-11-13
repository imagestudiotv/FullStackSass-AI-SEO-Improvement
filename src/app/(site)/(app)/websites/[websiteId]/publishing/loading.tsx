import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shaped like Article Settings - title, section rail on wide screens, and
 * section cards with fields - so the page lands in place instead of jumping
 * from a list skeleton. Sections only: the website layout already supplies
 * the shell and the settings strip.
 */
const PULSE = "motion-reduce:animate-none";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className={`h-7 w-48 ${PULSE}`} />
        <Skeleton className={`h-4 w-80 max-w-full ${PULSE}`} />
      </div>
      <div className="lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-8">
        <div className="hidden space-y-2 lg:block">
          {Array.from({ length: 7 }, (_, i) => (
            <Skeleton key={i} className={`h-8 w-full ${PULSE}`} />
          ))}
        </div>
        <div className="min-w-0 space-y-6">
          {Array.from({ length: 3 }, (_, section) => (
            <div key={section} className="space-y-5 rounded-xl border bg-card p-5">
              <div className="flex items-start gap-3">
                <Skeleton className={`size-8 shrink-0 rounded-lg ${PULSE}`} />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className={`h-4 w-40 ${PULSE}`} />
                  <Skeleton className={`h-3 w-72 max-w-full ${PULSE}`} />
                </div>
              </div>
              <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
                {Array.from({ length: 2 }, (_, field) => (
                  <div key={field} className="space-y-2">
                    <Skeleton className={`h-3.5 w-28 ${PULSE}`} />
                    <Skeleton className={`h-8 w-full rounded-lg ${PULSE}`} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
