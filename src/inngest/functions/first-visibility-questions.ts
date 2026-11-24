import { inngest } from "@/inngest/client";
import { askFirstQuestionsIfDue, firstQuestionCandidates, type FirstQuestionsOutcome } from "@/lib/geo/first-questions";

/**
 * Writes the first AI-visibility questions of every new website that has a
 * plan and none yet (lib/geo/first-questions.ts): onboarding used to do it in
 * a step of its own. Every 10 minutes, as the first content plan is; a
 * website is asked for once, ever, whatever the number of runs.
 *
 * One website per step: a step that is retried must not repeat the others'
 * paid calls.
 */
export const firstVisibilityQuestions = inngest.createFunction(
  { id: "first-visibility-questions", retries: 1, concurrency: { limit: 1 }, triggers: [{ cron: "*/10 * * * *" }] },
  async ({ step, logger }) => {
    const candidates = await step.run("select-websites", () => firstQuestionCandidates());

    const counts: Partial<Record<FirstQuestionsOutcome, number>> = {};
    for (const websiteId of candidates) {
      const outcome = await step.run(`ask-${websiteId}`, () => askFirstQuestionsIfDue(websiteId));
      counts[outcome] = (counts[outcome] ?? 0) + 1;
      if (outcome === "added" || outcome === "limited" || outcome === "failed") {
        logger.info({ step: "ask", websiteId, outcome }, "First AI visibility questions");
      }
    }

    logger.info({ step: "done", candidates: candidates.length, ...counts }, "First AI visibility questions check complete");
    return { candidates: candidates.length, ...counts };
  },
);
