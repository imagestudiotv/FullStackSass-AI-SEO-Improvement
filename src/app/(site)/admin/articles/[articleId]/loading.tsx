import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shaped like the article page - header and facts, the Preview/Edit tabs and
 * the article, the details beside it - rather than the list's table, which
 * this route used to inherit.
 */
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6" aria-busy="true" aria-label="Loading">
      <div className="space-y-2.5">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-[36rem] max-w-full" />
        <Skeleton className="h-4 w-80 max-w-full" />
        <div className="flex flex-wrap gap-2 pt-0.5">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-5 w-40" />
        </div>
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-3">
          <Skeleton className="h-8 w-40" />
          <div className="space-y-3 rounded-xl border bg-card px-5 py-6 md:px-10 md:py-8">
            <Skeleton className="h-7 w-2/3" />
            {Array.from({ length: 9 }, (_, i) => (
              <Skeleton key={i} className={i % 4 === 3 ? "h-4 w-1/2" : "h-4 w-full"} />
            ))}
          </div>
        </div>
        <div className="h-fit space-y-4 rounded-xl border bg-card p-5">
          <Skeleton className="h-5 w-24" />
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-4 w-40 max-w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
