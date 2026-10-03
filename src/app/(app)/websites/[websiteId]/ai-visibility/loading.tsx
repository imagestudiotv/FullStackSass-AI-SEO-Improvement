import { Skeleton } from "@/components/ui/skeleton";

/**
 * The page's own shape while it loads: header with its action, the
 * performance section's four figures, and the question list - so nothing
 * jumps when the content arrives.
 *
 * Sections only - no PageShell. The website layout already renders the
 * shell and the settings strip around this slot. Pulses stop under reduced
 * motion.
 */
const pulse = "motion-reduce:animate-none";

export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Skeleton className={`h-7 w-48 ${pulse}`} />
          <Skeleton className={`h-4 w-80 max-w-full ${pulse}`} />
        </div>
        <Skeleton className={`h-8 w-32 shrink-0 ${pulse}`} />
      </div>

      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-start gap-3">
          <Skeleton className={`size-8 shrink-0 rounded-lg ${pulse}`} />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className={`h-4 w-48 ${pulse}`} />
            <Skeleton className={`h-3 w-72 max-w-full ${pulse}`} />
          </div>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="space-y-2 rounded-lg border p-4">
              <Skeleton className={`h-3 w-24 ${pulse}`} />
              <Skeleton className={`h-8 w-16 ${pulse}`} />
              <Skeleton className={`h-3 w-32 ${pulse}`} />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-start gap-3">
          <Skeleton className={`size-8 shrink-0 rounded-lg ${pulse}`} />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className={`h-4 w-40 ${pulse}`} />
            <Skeleton className={`h-3 w-64 max-w-full ${pulse}`} />
          </div>
        </div>
        <Skeleton className={`mt-5 h-8 w-full ${pulse}`} />
        <div className="mt-5 divide-y rounded-lg border">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="space-y-2 p-4">
              <Skeleton className={`h-4 w-2/3 ${pulse}`} />
              <Skeleton className={`h-4 w-28 rounded-full ${pulse}`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
