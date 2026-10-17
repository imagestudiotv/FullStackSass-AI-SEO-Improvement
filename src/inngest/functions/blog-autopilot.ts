import { NonRetriableError } from "inngest";

import { inngest } from "@/inngest/client";
import { MODELS } from "@/lib/ai/client";
import { failAutopilotRun, loadClaim, noteRun, RUN_EVENT, saveAutopilotDraft } from "@/lib/blog/autopilot/run";
import { addUsage, bodyParts, finishDraft, loadWriterContext, planArticle, writePart, type WrittenPart } from "@/lib/blog/autopilot/write";
import { BlogPostError } from "@/lib/blog/post-fields";

/**
 * The blog autopilot writes one article (lib/blog/autopilot): the run and
 * its topic were taken when it was queued (startAutopilotRun), so this only
 * writes and saves.
 *
 * Each model call is its own step, kept once it succeeds: a failure retries
 * that step alone, and never pays for the parts already written. The
 * English article is saved as a draft for an administrator to read.
 *
 * When every retry is spent the run and its topic are marked failed with the
 * reason, and "Try again" on the autopilot page queues the topic again.
 */
export const blogAutopilotRun = inngest.createFunction(
  {
    id: "blog-autopilot-run",
    retries: 2,
    // One article at a time; the topic claim refuses a second one too.
    concurrency: { limit: 1 },
    triggers: [{ event: RUN_EVENT }],
    onFailure: async ({ event, error, logger }) => {
      const runId = event.data.event.data.runId as string;
      logger.error({ step: "on-failure", runId, reason: error.message }, "Blog autopilot run failed after all retries - run and topic marked failed");
      await failAutopilotRun(runId, error.message);
    },
  },
  async ({ event, step, logger }) => {
    const runId = String(event.data.runId ?? "");

    const claim = await step.run("load-run", () => loadClaim(runId));
    if (!claim) {
      logger.info({ step: "load-run", runId }, "Blog autopilot run is not waiting to be written; nothing to do");
      return { written: false };
    }
    const asOf = new Date(claim.claimedAt);

    const planned = await step.run("plan-article", async () => {
      const result = await planArticle(claim, await loadWriterContext(asOf));
      logger.info(
        { step: "plan-article", runId, sections: result.plan.sections.length, warnings: result.warnings.length, costUsd: result.usage.costUsd },
        "Blog article planned",
      );
      return result;
    });

    const parts: WrittenPart[] = [];
    for (const [index] of bodyParts(planned.plan.sections.length).entries()) {
      const written = parts.map((part) => part.html);
      const part = await step.run(`write-part-${index + 1}`, async () => {
        const result = await writePart(claim, await loadWriterContext(asOf), planned.plan, index, written);
        logger.info({ step: `write-part-${index + 1}`, runId, htmlBytes: result.html.length, costUsd: result.usage.costUsd }, "Blog article part written");
        return result;
      });
      parts.push(part);
    }

    const finished = await step.run("check-article", async () => {
      const result = await finishDraft(await loadWriterContext(asOf), planned.plan, parts, planned.warnings);
      const usage = addUsage([planned.usage, ...parts.map((part) => part.usage)]);
      // Kept with the run: the costs, what fell short, and the picture ideas for the pictures step.
      await noteRun(runId, { model: MODELS.BLOG, usage, ...result.report });
      logger.info(
        { step: "check-article", runId, words: result.report.words, linksRemoved: result.report.links.removed.length, warnings: result.report.warnings.length, costUsd: usage.costUsd },
        "Blog article checked",
      );
      return result;
    });

    const saved = await step.run("save-draft", async () => {
      try {
        return await saveAutopilotDraft(claim, finished.draft, {});
      } catch (error) {
        // A rule the article breaks breaks it again on every retry.
        if (error instanceof BlogPostError) throw new NonRetriableError(error.message);
        throw error;
      }
    });
    logger.info({ step: "save-draft", runId, postId: saved.postId }, "Blog autopilot draft saved");
    return { written: true, ...saved };
  },
);
