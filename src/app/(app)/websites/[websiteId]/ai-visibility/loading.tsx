import { ListSkeleton, StatsSkeleton } from "@/components/ui/page-skeleton";

/**
 * Sections only — no PageShell and no header.
 *
 * The website layout already renders both around this slot, so wrapping again
 * would nest two centred containers and double the vertical rhythm.
 */
export default function Loading() {
  return (
    <>
      <StatsSkeleton count={3} />
      <ListSkeleton rows={5} />
    </>
  );
}
