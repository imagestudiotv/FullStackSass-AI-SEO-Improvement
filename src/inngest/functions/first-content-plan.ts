import { inngest } from "@/inngest/client";
import { firstPlanCandidates, planFirstIfDue, type FirstPlanOutcome } from "@/lib/keywords/first-plan";

/**
 * Builds the first content plan of every new website that has a plan and was
 * never planned (lib/keywords/first-plan.ts): the safety net behind the
 * starts at the end of the analysis and at Free, and the start for a new
 * paid subscription, whose webhook arrives on its own time.
 *
 * Every 10 minutes: a customer who has just paid should not wait an hour for
 * their first article. Most runs find nothing - the candidates are only
 * websites added in the last two weeks with no keywords - and each check is a
 * few reads; a site is researched once, ever.
 */
const CHUNK = 25;

export const firstContentPlan = inngest.createFunction(
  { id: "first-content-plan", retries: 1, concurrency: { limit: 1 }, triggers: [{ cron: "*/10 * * * *" }] },
  async ({ step, logger }) => {
    const candidates = await step.run("select-websites", () => firstPlanCandidates());

    const counts: Partial<Record<FirstPlanOutcome, number>> = {};
    for (let start = 0; start < candidates.length; start += CHUNK) {
      const chunk = candidates.slice(start, start + CHUNK);
      const outcomes = await step.run(`plan-${start / CHUNK}`, async () => {
        const result: { websiteId: string; outcome: FirstPlanOutcome }[] = [];
        for (const websiteId of chunk) result.push({ websiteId, outcome: await planFirstIfDue(websiteId) });
        return result;
      });
      for (const { websiteId, outcome } of outcomes) {
        counts[outcome] = (counts[outcome] ?? 0) + 1;
        if (outcome === "queued" || outcome === "limited") {
          logger.info({ step: "plan", websiteId, outcome }, "First content plan");
        }
      }
    }

    logger.info({ step: "done", candidates: candidates.length, ...counts }, "First content plan check complete");
    return { candidates: candidates.length, ...counts };
  },
);
