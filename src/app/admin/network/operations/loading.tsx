import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shaped like the operations page: header, the four status tiles, the
 * unresolved deliveries table, the switches and the two policy sections.
 * (Without it, the overview's skeleton would be inherited.)
 */
export default function NetworkOperationsLoading() {
  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6" aria-busy="true" aria-label="Loading">
      <div className="space-y-2">
        <Skeleton className="h-8 w-60" />
        <Skeleton className="h-4 w-[32rem] max-w-full" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="space-y-2 border-b px-5 py-4">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-full max-w-2xl" />
        </div>
        {Array.from({ length: 4 }, (_, row) => (
          <div key={row} className="flex gap-4 border-b px-4 py-3.5 last:border-b-0">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className={i === 0 ? "h-4 flex-[2]" : "h-4 flex-1"} />
            ))}
          </div>
        ))}
      </div>
      <Skeleton className="h-64 rounded-xl" />
      <div className="grid gap-6 xl:grid-cols-2">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  );
}
