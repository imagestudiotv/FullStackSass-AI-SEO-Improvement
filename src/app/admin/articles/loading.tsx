import { PageSkeleton } from "@/components/ui/page-skeleton";

/** Operator tables: rows matter more than metrics. */
export default function Loading() {
  return <PageSkeleton rows={8} width="wide" />;
}
