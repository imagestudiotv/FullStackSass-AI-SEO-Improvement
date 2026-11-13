import { PageSkeleton } from "@/components/ui/page-skeleton";

/** Tasks: the progress card above the task lists. */
export default function Loading() {
  return <PageSkeleton rows={6} withAction />;
}
