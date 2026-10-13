import { inngest } from "@/inngest/client";
import { announceIndexed, checkSubmitted, queueNewlyLive, submitQueued } from "@/lib/indexing/run";
import { isIndexingConfigured } from "@/lib/indexing/speedyindex";

/**
 * Sends newly published articles to Google's index through SpeedyIndex, and
 * tells the customer when Google has indexed one (lib/indexing/run.ts).
 *
 * Every two hours: an article is sent within about two hours of going live,
 * and results (usually 48-72 hours later) are picked up as they come. Each
 * step is its own Inngest step, so a failed result check does not resend.
 *
 * Does nothing until SPEEDYINDEX_API_KEY is set.
 */
export const indexArticles = inngest.createFunction(
  {
    id: "index-articles",
    retries: 1,
    // Two runs would send the same queued rows twice.
    concurrency: { limit: 1 },
    triggers: [{ cron: "20 */2 * * *" }],
  },
  async ({ step, logger }) => {
    if (!isIndexingConfigured()) {
      logger.info({ step: "start" }, "Google indexing is not configured (SPEEDYINDEX_API_KEY); nothing to do");
      return { configured: false };
    }

    const queued = await step.run("queue-newly-live", () => queueNewlyLive());
    const submitted = await step.run("submit", () => submitQueued());
    if (submitted.reason === "balance") {
      logger.warn({ step: "submit", held: submitted.held }, "SpeedyIndex balance is empty; articles held until it is topped up");
    }

    const checked = await step.run("check-results", async () => {
      const result = await checkSubmitted();
      for (const article of result.indexed) await announceIndexed(article);
      return { tasks: result.tasks, indexed: result.indexed.length, notIndexed: result.notIndexed };
    });

    logger.info({ step: "done", queued, submitted, checked }, "Google indexing run finished");
    return { configured: true, queued, submitted, checked };
  },
);
