import { inngest } from "@/inngest/client";
import { GEO_REGENERATE_EVENT } from "@/lib/geo/shared";
import { regenerateQuestions } from "@/lib/geo/regenerate";
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

/**
 * Writes a website's AI visibility questions again after its article
 * language changed (lib/websites/actions.ts queues it; lib/geo/regenerate.ts
 * does it): the questions we wrote are replaced in the new language, the
 * customer's own are kept. One model call, in one step, so a retry does not
 * pay twice for a call that succeeded.
 */
export const regenerateVisibilityQuestions = inngest.createFunction(
  {
    id: "regenerate-visibility-questions",
    retries: 1,
    concurrency: [{ key: "event.data.websiteId", limit: 1 }],
    // Several saves of the profile in a row: one rewrite, with the last language.
    debounce: { key: "event.data.websiteId", period: "2m" },
    triggers: [{ event: GEO_REGENERATE_EVENT }],
  },
  async ({ event, step, logger }) => {
    const websiteId = typeof event.data?.websiteId === "string" ? event.data.websiteId : null;
    if (!websiteId) return { ok: false, reason: "no_website" };
    const outcome = await step.run("regenerate", () => regenerateQuestions(websiteId, { reason: "language" }));
    logger.info({ step: "regenerate", websiteId, ...outcome }, "AI visibility questions written again for a new language");
    return outcome;
  },
);
