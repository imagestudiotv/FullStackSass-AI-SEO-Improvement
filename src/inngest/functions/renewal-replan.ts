import { inngest } from "@/inngest/client";
import {
  renewalCandidates,
  replanIfRenewed,
  type RenewalOutcome,
} from "@/lib/keywords/renewal";

/**
 * Rebuilds the content plan of every website whose monthly allowance has just
 * renewed. See lib/keywords/renewal.ts for what counts as renewed and why it
 * runs at most once a month per site.
 *
 * HOURLY, because a window opens at its billing anchor's time of day, not at
 * midnight: a daily run would leave up to a day of empty calendar. Most hours
 * find nothing to do, and each site's check is a few reads.
 *
 * In steps of CHUNK sites, so a failure part-way retries only its chunk, and
 * the step count stays far below Inngest's per-run limit however many sites
 * there are. Each check is idempotent - a retried chunk re-queues nothing.
 */
const CHUNK = 50;

export const renewalReplan = inngest.createFunction(
  { id: "renewal-replan", retries: 1, triggers: [{ cron: "20 * * * *" }] },
  async ({ step, logger }) => {
    const candidates = await step.run("select-websites", () => renewalCandidates());

    const counts: Partial<Record<RenewalOutcome, number>> = {};
    for (let start = 0; start < candidates.length; start += CHUNK) {
      const chunk = candidates.slice(start, start + CHUNK);
      const outcomes = await step.run(`replan-${start / CHUNK}`, async () => {
        const result: { websiteId: string; outcome: RenewalOutcome }[] = [];
        for (const websiteId of chunk) {
          result.push({ websiteId, outcome: await replanIfRenewed(websiteId) });
        }
        return result;
      });

      for (const { websiteId, outcome } of outcomes) {
        counts[outcome] = (counts[outcome] ?? 0) + 1;
        // The two that matter when someone asks why a plan did or did not appear.
        if (outcome === "queued" || outcome === "limited") {
          logger.info({ step: "replan", websiteId, outcome }, "Renewal re-plan");
        }
      }
    }

    logger.info(
      { step: "done", candidates: candidates.length, ...counts },
      "Renewal re-plan check complete",
    );
    return { candidates: candidates.length, ...counts };
  },
);
