import { ListSkeleton, StatsSkeleton } from "@/components/ui/page-skeleton";

/**
 * Sections only — the website layout supplies the shell and header.
 */
export default function Loading() {
  return (
    <>
      <StatsSkeleton count={4} />
      <ListSkeleton rows={4} />
    </>
  );
}
