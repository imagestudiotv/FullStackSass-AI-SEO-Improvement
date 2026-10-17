import { NonRetriableError } from "inngest";

import { inngest } from "@/inngest/client";
import { MODELS } from "@/lib/ai/client";
import { canMakePictures, makePicture, placePictures, type MadePicture } from "@/lib/blog/autopilot/pictures";
import { failAutopilotRun, finishAutopilotRun, loadClaim, noteCost, noteRun, RUN_EVENT, saveAutopilotDraft } from "@/lib/blog/autopilot/run";
import { addUsage, bodyParts, finishDraft, loadWriterContext, planArticle, writePart, type WrittenPart } from "@/lib/blog/autopilot/write";
import { BlogPostError } from "@/lib/blog/post-fields";

/**
 * The blog autopilot writes one article (lib/blog/autopilot): the run and
 * its topic were taken when it was queued (startAutopilotRun), so this only
 * writes and saves.
 *
 *   plan -> body, part by part -> links and checks -> pictures -> English draft -> run closed
 *
 * Each model call and each picture is its own step, kept once it succeeds:
 * a failure retries that step alone, and never pays for what is already
 * done. A picture that cannot be made is listed on the run; it never stops
 * the article. Everything is saved as a draft for an administrator to read.
 *
 * When every retry is spent the run is marked failed with the reason, and
 * "Try again" on the autopilot page queues the topic again.
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
      logger.error({ step: "on-failure", runId, reason: error.message }, "Blog autopilot run failed after all retries - run marked failed");
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
      await noteCost(runId, "plan-article", result.usage.costUsd);
      logger.info(
        { step: "plan-article", runId, sections: result.plan.sections.length, warnings: result.warnings.length, costUsd: result.usage.costUsd },
        "Blog article planned",
      );
      return result;
    });

    const parts: WrittenPart[] = [];
    for (const [index] of bodyParts(planned.plan.sections.length).entries()) {
      const written = parts.map((part) => part.html);
      const id = `write-part-${index + 1}`;
      const part = await step.run(id, async () => {
        const result = await writePart(claim, await loadWriterContext(asOf), planned.plan, index, written);
        await noteCost(runId, id, result.usage.costUsd);
        logger.info({ step: id, runId, htmlBytes: result.html.length, costUsd: result.usage.costUsd }, "Blog article part written");
        return result;
      });
      parts.push(part);
    }

    const finished = await step.run("check-article", async () => {
      const result = await finishDraft(await loadWriterContext(asOf), planned.plan, parts, planned.warnings);
      const usage = addUsage([planned.usage, ...parts.map((part) => part.usage)]);
      // Kept with the run: the tokens, what fell short, and the picture ideas.
      await noteRun(runId, { model: MODELS.BLOG, usage, ...result.report });
      logger.info(
        { step: "check-article", runId, words: result.report.words, linksRemoved: result.report.links.removed.length, warnings: result.report.warnings.length },
        "Blog article checked",
      );
      return result;
    });

    // The pictures, one step each. Without OpenAI images or storage the article has none, and says so.
    const warnings = [...finished.report.warnings];
    const pictures: (MadePicture & { section: number })[] = [];
    if (!(await step.run("can-make-pictures", () => canMakePictures()))) {
      warnings.push("Pictures are not set up on this server (an OpenAI image key and image storage), so the article has none.");
    } else {
      for (const [index, idea] of planned.plan.pictures.entries()) {
        const id = `picture-en-${index + 1}`;
        const made = await step.run(id, async () => {
          try {
            const picture = await makePicture(idea, "en");
            await noteCost(runId, id, picture.costUsd);
            return { picture };
          } catch (error) {
            const reason = error instanceof Error ? error.message : "the image model did not answer";
            logger.warn({ step: id, runId, reason }, "Blog autopilot picture could not be made");
            return { error: reason.slice(0, 200) };
          }
        });
        if ("picture" in made && made.picture) pictures.push({ ...made.picture, section: idea.afterSection });
        else warnings.push(`Picture ${index + 1} ("${idea.title}") could not be made: ${"error" in made ? made.error : "unknown"}. Add one by hand if the section needs it.`);
      }
    }

    const saved = await step.run("save-draft", async () => {
      try {
        const bodyHtml = placePictures(finished.draft.bodyHtml, pictures);
        return await saveAutopilotDraft(claim, { ...finished.draft, bodyHtml }, { warnings, picturesMade: pictures.length });
      } catch (error) {
        // A rule the article breaks breaks it again on every retry.
        if (error instanceof BlogPostError) throw new NonRetriableError(error.message);
        throw error;
      }
    });
    logger.info({ step: "save-draft", runId, postId: saved.postId, pictures: pictures.length }, "Blog autopilot draft saved");

    await step.run("finish-run", () => finishAutopilotRun(claim));
    return { written: true, ...saved };
  },
);
