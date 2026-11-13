import { PageSkeleton } from "@/components/ui/page-skeleton";

/** Dashboard: metric row above the activity and performance panels. */
export default function Loading() {
  return <PageSkeleton stats={4} rows={4} withAction />;
}
