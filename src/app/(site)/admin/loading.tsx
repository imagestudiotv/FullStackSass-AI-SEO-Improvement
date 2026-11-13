import { Skeleton } from "@/components/ui/skeleton";

/**
 * The overview's skeleton, shaped like the overview: header, the attention
 * and activity columns, the figure tiles and the chart. (Child routes have
 * their own list-shaped skeletons.)
 */
export default function AdminOverviewLoading() {
  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6" aria-busy="true" aria-label="Loading">
      <div className="space-y-2">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-4 w-[28rem] max-w-full" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-xl" />
    </div>
  );
}
