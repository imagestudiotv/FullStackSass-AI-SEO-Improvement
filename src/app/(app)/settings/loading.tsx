import { PageSkeleton } from "@/components/ui/page-skeleton";

/** Settings: stacked form sections rather than metrics. */
export default function Loading() {
  return <PageSkeleton rows={4} />;
}
