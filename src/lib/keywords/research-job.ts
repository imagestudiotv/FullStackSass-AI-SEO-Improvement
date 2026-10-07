import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { websites } from "@/lib/db/schema";
import type { QuotaRule } from "@/lib/billing/spend-quota";
import { reserveAndQueue } from "@/lib/jobs/outbox";
import { researchInFlight } from "@/lib/keywords/research-state";

/*
  Starting a research run, for the Refresh button, for added keywords
  (lib/keywords/actions.ts) and for the renewal re-plan (renewal.ts).

  Its own module, not part of actions.ts: that file is "use server", where
  every export is a public endpoint - and this queues paid work for any
  website id it is given, with no check of who is asking.
*/

/**
 * Research runs a user may start, over sliding hours. Each is three model
 * calls plus provider lookups billed per row, and re-running minutes apart
 * produces the same clusters. Reserved atomically before queueing and billed
 * to the website's owner.
 */
const RESEARCH_PER_WEBSITE_PER_HOUR = 3;
const RESEARCH_PER_WORKSPACE_PER_HOUR = 6;

/**
 * The ledger key every research run on a website reserves under. Read by the
 * renewal re-plan to tell whether this month's plan has been built already.
 */
export function researchSiteKey(websiteId: string): string {
  return `research:site:${websiteId}`;
}

/**
 * Reserves a research run and records its job in one transaction (lib/jobs/
 * outbox.ts), and marks the website "researching" in that same transaction.
 *
 * "queued", or "limited" when the hourly allowance is used up (a queue outage
 * delays the run, it does not refuse it), or - with refuseIfRunning - "running"
 * when a run is already under way, in which case nothing is reserved.
 *
 * WHY THE STATUS IS WRITTEN HERE. The job sets it too, but only once its
 * first step runs, seconds after the button's own refresh. The page rendered
 * "ready" in that gap, so it never followed the run: the plan appeared only on
 * a manual reload, and pressing again was the natural thing to do (client,
 * 2026-10-02). Written before the job is sent, so even a run that finishes
 * at once cannot be overtaken by it. A website still being analysed keeps
 * that status.
 *
 * `rules` are reserved with the hourly ones, in the same transaction - the
 * renewal re-plan's once-a-month rule - and `trigger` rides on the event, so
 * the job can say why it ran.
 */
export async function startResearchJob(
  websiteId: string,
  ownerOrgId: string,
  options: {
    refuseIfRunning?: boolean;
    rules?: QuotaRule[];
    trigger?: "renewal";
  } = {},
): Promise<"queued" | "running" | "limited"> {
  /*
    A run in flight answers first, before the hourly allowance: with the
    allowance used up, a press during the third run of the hour was told "too
    many times" and its page never followed the run. Checked again under the
    lock below, for presses that race.
  */
  if (options.refuseIfRunning) {
    const [site] = await db
      .select({ status: websites.status, updatedAt: websites.updatedAt })
      .from(websites)
      .where(eq(websites.id, websiteId))
      .limit(1);
    if (site && researchInFlight(site)) return "running";
  }

  const slot = await reserveAndQueue(
    [
      { key: researchSiteKey(websiteId), limit: RESEARCH_PER_WEBSITE_PER_HOUR, window: { seconds: 3600 } },
      { key: `research:org:${ownerOrgId}`, limit: RESEARCH_PER_WORKSPACE_PER_HOUR, window: { seconds: 3600 } },
      ...(options.rules ?? []),
    ],
    { operation: "keywords.research", organizationId: ownerOrgId, websiteId },
    (reservations) => ({
      id: `website-research:${reservations[0].id}`,
      name: "website/research.requested",
      data: {
        websiteId,
        organizationId: ownerOrgId,
        reservations,
        ...(options.trigger ? { trigger: options.trigger } : {}),
      },
    }),
    async (tx) => {
      // Locked, so two presses at once see each other: the second finds the first running.
      const [site] = await tx
        .select({ status: websites.status, updatedAt: websites.updatedAt })
        .from(websites)
        .where(eq(websites.id, websiteId))
        .for("update");
      if (!site) return false;
      if (options.refuseIfRunning && researchInFlight(site)) return false;
      if (site.status !== "pending" && site.status !== "crawling") {
        await tx
          .update(websites)
          .set({ status: "researching", updatedAt: new Date() })
          .where(eq(websites.id, websiteId));
      }
      return true;
    },
  );
  if (slot.ok) return "queued";
  return "refused" in slot && slot.refused ? "running" : "limited";
}
