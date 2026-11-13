import { Skeleton } from "@/components/ui/skeleton";

/**
 * The post editor's skeleton, shaped like the editor: header, the action bar,
 * the content column and the settings inspector beside it. (The blog list has
 * its own list-shaped skeleton.)
 */
export function BlogEditorSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6" aria-busy="true" aria-label="Loading">
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-72 max-w-full" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="flex items-center justify-between gap-4 border-b pb-3">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-9 w-48" />
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <Skeleton className="h-52 rounded-xl" />
          <Skeleton className="h-120 rounded-xl" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-44 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
