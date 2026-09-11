import { PageSkeleton } from "@/components/ui/page-skeleton";

/** Websites: a list, with "Add website" in the header. */
export default function Loading() {
  return <PageSkeleton rows={3} withAction />;
}
