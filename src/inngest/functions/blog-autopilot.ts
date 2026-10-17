import { NonRetriableError } from "inngest";

import { inngest } from "@/inngest/client";
import { MODELS } from "@/lib/ai/client";
import { addUsage } from "@/lib/blog/autopilot/model";
import { emailDraftsReady } from "@/lib/blog/autopilot/notify";
import { canMakePictures, makePicture, placePictures } from "@/lib/blog/autopilot/pictures";
import {
  failAutopilotRun,
  finishAutopilotRun,
  loadClaim,
  loadDraft,
  noteCost,
  noteRun,
  RUN_EVENT,
  runCost,
  saveAutopilotDraft,
  saveAutopilotTranslation,
} from "@/lib/blog/autopilot/run";
import { readAutopilotSettings } from "@/lib/blog/autopilot/settings";
import { bodySlices, swapPictures, translateBodyPart, translateFields, type TranslationSource } from "@/lib/blog/autopilot/translate";
import { bodyParts, finishDraft, loadWriterContext, planArticle, writePart, type WrittenPart } from "@/lib/blog/autopilot/write";
import { LANGUAGE_NAMES_EN } from "@/lib/blog/locale";
import { BlogPostError } from "@/lib/blog/post-fields";

/**
 * The blog autopilot writes one article (lib/blog/autopilot): the run and
 * its topic were taken when it was queued (startAutopilotRun), so this only
 * writes and saves.
 *
 *   plan -> body, part by part -> links and checks -> pictures -> English draft
 *   -> for each chosen language: fields, body part by part, pictures, draft
 *   -> run closed -> email to the administrators
 *
 * Each model call and each picture is its own step, kept once it succeeds:
 * a failure retries that step alone, and never pays for what is already
 * done. Once the English draft is saved, nothing stops the run: a picture or
 * a language that still fails on its last try is listed on the run and in
 * the email, and the rest goes on. Everything is saved as a draft for an
 * administrator to read; translations also need the native speaker's tick.
 *
 * When every retry is spent before the English draft exists, the run is
 * marked failed with the reason, and "Try again" queues the topic again.
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
  async ({ event, step, logger, attempt, maxAttempts }) => {
    const runId = String(event.data.runId ?? "");

    /**
     * For what must not stop the article: a failure is retried like any
     * other, and only on the step's last try becomes a note on the run.
     */
    const lastTry = attempt + 1 >= (maxAttempts ?? 3);
    async function settle<T>(id: string, work: () => Promise<T>): Promise<{ value: T } | { error: string }> {
      try {
        return { value: await work() };
      } catch (error) {
        if (!lastTry) throw error;
        const reason = (error instanceof Error ? error.message : "no answer").slice(0, 200);
        logger.warn({ step: id, runId, reason }, "Blog autopilot step gave up; noted on the run");
        return { error: reason };
      }
    }

    const claim = await step.run("load-run", () => loadClaim(runId));
    if (!claim) {
      logger.info({ step: "load-run", runId }, "Blog autopilot run is not waiting to be written; nothing to do");
      return { written: false };
    }
    const asOf = new Date(claim.claimedAt);

    /* --- The English article -------------------------------------------- */

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
    const pictures = await step.run("can-make-pictures", () => canMakePictures());
    const english: { idea: (typeof planned.plan.pictures)[number]; url: string; width: number; height: number; alt: string }[] = [];
    if (!pictures) {
      warnings.push("Pictures are not set up on this server (an OpenAI image key and image storage), so the articles have none.");
    } else {
      for (const [index, idea] of planned.plan.pictures.entries()) {
        const id = `picture-en-${index + 1}`;
        const made = await step.run(id, () =>
          settle(id, async () => {
            const picture = await makePicture(idea, "en");
            await noteCost(runId, id, picture.costUsd);
            return picture;
          }),
        );
        if ("value" in made) english.push({ idea, ...made.value });
        else warnings.push(`Picture ${index + 1} ("${idea.title}") could not be made: ${made.error}. Add one by hand if the section needs it.`);
      }
    }

    const saved = await step.run("save-draft", async () => {
      try {
        const bodyHtml = placePictures(
          finished.draft.bodyHtml,
          english.map((picture) => ({ ...picture, section: picture.idea.afterSection })),
        );
        return await saveAutopilotDraft(claim, { ...finished.draft, bodyHtml }, { warnings, picturesMade: english.length });
      } catch (error) {
        // A rule the article breaks breaks it again on every retry.
        if (error instanceof BlogPostError) throw new NonRetriableError(error.message);
        throw error;
      }
    });
    logger.info({ step: "save-draft", runId, postId: saved.postId, pictures: english.length }, "Blog autopilot draft saved");

    /* --- The translations ------------------------------------------------- */

    const languages = await step.run("languages", async () => (await readAutopilotSettings()).languages);
    const source = await step.run("english-source", async () => {
      const draft = await loadDraft(saved.postId);
      if (!draft) return null;
      const fields: TranslationSource = {
        title: draft.title,
        seoTitle: draft.seoTitle ?? "",
        description: draft.description,
        shortAnswer: draft.shortAnswer ?? "",
        breadcrumbLabel: draft.breadcrumbLabel ?? "",
        primaryKeyword: draft.primaryKeyword ?? "",
        secondaryKeywords: draft.secondaryKeywords,
        faqs: draft.faqs,
        pictures: english.map((picture) => ({ title: picture.idea.title, labels: picture.idea.labels, alt: picture.alt })),
      };
      return { fields, slices: bodySlices(draft.bodyHtml) };
    });
    if (!source && languages.length > 0) warnings.push("The English draft was deleted before it could be translated.");

    const translations: { locale: (typeof languages)[number]; postId: string }[] = [];
    for (const locale of source ? languages : []) {
      const language = LANGUAGE_NAMES_EN[locale];
      const skip = (reason: string) => warnings.push(`The ${language} translation could not be made: ${reason}. Use "Translate" on the English draft to make it.`);

      const fieldsId = `translate-${locale}-fields`;
      const fields = await step.run(fieldsId, () =>
        settle(fieldsId, async () => {
          const result = await translateFields(source!.fields, locale);
          await noteCost(runId, fieldsId, result.usage.costUsd);
          return result.fields;
        }),
      );
      if ("error" in fields) {
        skip(fields.error);
        continue;
      }

      const body: string[] = [];
      let failed: string | null = null;
      for (const [index, slice] of source!.slices.entries()) {
        const id = `translate-${locale}-part-${index + 1}`;
        const part = await step.run(id, () =>
          settle(id, async () => {
            const result = await translateBodyPart(slice, locale, fields.value);
            await noteCost(runId, id, result.usage.costUsd);
            return result.html;
          }),
        );
        if ("error" in part) {
          failed = part.error;
          break;
        }
        body.push(part.value);
      }
      if (failed) {
        skip(failed);
        continue;
      }

      // Its own pictures, with its words; one that cannot be made keeps the English one.
      const swaps: { from: string; to?: { url: string; width: number; height: number }; alt: string }[] = [];
      for (const [index, picture] of english.entries()) {
        const words = fields.value.pictures[index];
        const id = `picture-${locale}-${index + 1}`;
        const made = await step.run(id, () =>
          settle(id, async () => {
            const result = await makePicture({ idea: picture.idea.idea, title: words.title, labels: words.labels, alt: words.alt }, locale);
            await noteCost(runId, id, result.costUsd);
            return result;
          }),
        );
        if ("value" in made) swaps.push({ from: picture.url, to: made.value, alt: words.alt });
        else {
          swaps.push({ from: picture.url, alt: words.alt });
          warnings.push(`The ${language} picture "${words.title}" could not be made (${made.error}); the English one is used.`);
        }
      }

      const savedTranslation = await step.run(`save-${locale}`, async () => {
        try {
          const { title, slug, seoTitle, description, shortAnswer, breadcrumbLabel, primaryKeyword, secondaryKeywords, faqs } = fields.value;
          const bodyHtml = swapPictures(body.join(""), swaps);
          const post = { title, slug, seoTitle, description, shortAnswer, breadcrumbLabel, primaryKeyword, secondaryKeywords, faqs, bodyHtml };
          return { value: await saveAutopilotTranslation(saved.postId, locale, post) };
        } catch (error) {
          if (error instanceof BlogPostError) return { error: error.message };
          throw error;
        }
      });
      if ("error" in savedTranslation) skip(savedTranslation.error);
      else translations.push({ locale, postId: savedTranslation.value.postId });
    }

    /* --- Done ------------------------------------------------------------- */

    await step.run("finish-run", () =>
      finishAutopilotRun(claim, { warnings, translations: Object.fromEntries(translations.map((translation) => [translation.locale, translation.postId])) }),
    );
    const emailed = await step.run("email-admins", async () => {
      const draft = await loadDraft(saved.postId);
      return emailDraftsReady({ title: draft?.title ?? planned.plan.title, englishPostId: saved.postId, translations, warnings, costUsd: await runCost(runId) });
    });
    logger.info({ step: "done", runId, postId: saved.postId, translations: translations.length, warnings: warnings.length, emailed: emailed.sent }, "Blog autopilot run finished");
    return { written: true, ...saved, translations: translations.length };
  },
);
