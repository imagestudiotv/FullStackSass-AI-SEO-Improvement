import { Skeleton } from "@/components/ui/skeleton";

/**
 * Sections only — the website layout already supplies the shell and the
 * settings strip, so wrapping again would nest two centred containers.
 *
 * Shaped like the page it stands in for: the title, the compact connection
 * section, then a report section with four figures and a chart, so the
 * content lands in place instead of jumping. Still for reduced motion.
 */
const bone = "motion-reduce:animate-none";

export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Skeleton className={`h-7 w-64 max-w-full ${bone}`} />
          <Skeleton className={`h-4 w-96 max-w-full ${bone}`} />
        </div>
        <Skeleton className={`h-8 w-56 shrink-0 ${bone}`} />
      </div>

      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-start gap-3">
          <Skeleton className={`size-8 shrink-0 rounded-lg ${bone}`} />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className={`h-4 w-40 ${bone}`} />
            <Skeleton className={`h-3 w-72 max-w-full ${bone}`} />
          </div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className={`h-20 rounded-lg ${bone}`} />
          ))}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-start gap-3">
          <Skeleton className={`size-8 shrink-0 rounded-lg ${bone}`} />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className={`h-4 w-32 ${bone}`} />
            <Skeleton className={`h-3 w-80 max-w-full ${bone}`} />
          </div>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className={`h-28 rounded-lg ${bone}`} />
          ))}
        </div>
        <Skeleton className={`mt-6 h-48 rounded-lg ${bone}`} />
      </div>
    </div>
  );
}
