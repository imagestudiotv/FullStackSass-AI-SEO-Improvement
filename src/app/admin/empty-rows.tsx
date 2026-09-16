import type { LucideIcon } from "lucide-react";

import { EmptyState } from "@/components/ui/states";

/**
 * What a list shows when it has nothing to show.
 *
 * Two different situations that look identical in a bare table: the list is
 * genuinely empty, or filters excluded everything. Saying "No payments yet" to
 * an operator who filtered to refunds in the last 24 hours is wrong, and sends
 * them looking for a bug in the payments pipeline instead of widening their
 * filter.
 *
 * Several admin lists showed nothing at all in this case — a table header with
 * no body and no explanation, which reads as a page that failed to load.
 */
export function EmptyRows({
  filtering,
  icon,
  emptyTitle,
  emptyDescription,
  /** What this list calls its rows, e.g. "payments". Used in the filtered copy. */
  noun,
}: {
  filtering: boolean;
  icon: LucideIcon;
  emptyTitle: string;
  emptyDescription: string;
  noun: string;
}) {
  if (filtering) {
    return (
      <EmptyState
        icon={icon}
        title="Nothing matches"
        description={`No ${noun} match the current search and filters. Clear them to see everything.`}
      />
    );
  }

  return (
    <EmptyState icon={icon} title={emptyTitle} description={emptyDescription} />
  );
}
