import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** A placeholder block that holds still for people who ask for reduced motion. */
function Block({ className }: { className: string }) {
  return <Skeleton className={cn("motion-reduce:animate-none", className)} />;
}

/**
 * Article workspace, while it loads: the same frame as the page - the
 * breadcrumb and title, then the article column beside the publishing panel
 * on wide screens (stacked below that), then the supporting sections - so
 * nothing jumps when it arrives. No PageShell: the website layout already
 * provides it.
 */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="space-y-3">
        <Block className="h-4 w-48" />
        <Block className="h-8 w-2/3 max-w-xl" />
        <div className="flex gap-3">
          <Block className="h-7 w-24 rounded-full" />
          <Block className="h-7 w-40" />
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem] xl:grid-rows-[auto_1fr] xl:items-start">
        <Block className="h-56 w-full rounded-xl xl:col-start-2 xl:row-start-1" />
        <div className="min-w-0 space-y-3 xl:col-start-1 xl:row-span-2 xl:row-start-1">
          <Block className="h-8 w-44 rounded-lg" />
          <Block className="h-128 w-full rounded-xl" />
        </div>
        <div className="grid min-w-0 items-start gap-4 lg:max-xl:grid-cols-2 xl:col-start-2 xl:row-start-2">
          <Block className="h-40 w-full rounded-xl" />
          <Block className="h-72 w-full rounded-xl" />
          <Block className="h-48 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
