/**
 * Whether a website's keyword research is under way, as the screens show it.
 *
 * "researching" is now written when the run is QUEUED (lib/keywords/
 * actions.ts), not when the job's first step starts a few seconds later. The
 * button's own refresh used to land in that gap: the page saw "ready", never
 * started following the run, and the plan only appeared after a manual
 * reload - which made pressing the button again look like the thing to do
 * (client, 2026-10-02).
 *
 * Bounded, so a run that never ends cannot lock the button for good. Research
 * takes about a minute; the job resets the status when it finishes or fails,
 * and the queue does when it gives up on a run it could not deliver. Past
 * this age the status is treated as left over and the button comes back.
 */
export const RESEARCH_STALE_MS = 30 * 60 * 1000;

export function researchInFlight(site: { status: string | null; updatedAt: Date }, now: Date = new Date()): boolean {
  return site.status === "researching" && now.getTime() - site.updatedAt.getTime() < RESEARCH_STALE_MS;
}

/**
 * How a run ended, from the plan before and after it: "ready" when it put new
 * planned items in (save-calendar replaces every still-planned item, so a
 * successful run always brings new ids), "failed" when there is no plan at
 * all, "unchanged" when the old plan is still there - a re-run that failed.
 * Counting rows called that last case a success.
 */
export function runOutcome(
  plannedBefore: ReadonlySet<string>,
  plannedAfter: ReadonlySet<string>,
  calendarSize: number,
): "ready" | "failed" | "unchanged" {
  for (const id of plannedAfter) if (!plannedBefore.has(id)) return "ready";
  return calendarSize === 0 ? "failed" : "unchanged";
}
