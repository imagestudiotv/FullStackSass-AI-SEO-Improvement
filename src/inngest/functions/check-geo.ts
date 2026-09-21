import { and, eq } from "drizzle-orm";

import { inngest } from "@/inngest/client";
import { db } from "@/lib/db";
import { geoPrompts, geoResults, websites } from "@/lib/db/schema";
import { ENGINE, runCheck } from "@/lib/geo/check";

/**
 * Checks whether an AI assistant recommends a customer's business.
 *
 * Each prompt costs two model calls — one to ask the question, one to read the
 * brands out of the answer — so a website with twenty prompts is forty calls.
 * Far past a server action's budget, hence a job.
 *
 * The concurrency key is per website rather than global. One customer with
 * twenty prompts must not delay everyone else's checks, and without a key a
 * burst of scheduled runs would hit the Anthropic rate limit together and fail
 * as a group.
 */

/** Prompts checked per run. A safety valve; the UI caps prompts at 20. */
const MAX_PER_RUN = 20;

export const checkGeo = inngest.createFunction(
  {
    id: "check-geo",
    // A failed check is retried, but not endlessly: the usual cause is a
    // rate limit or a malformed answer, and both resolve on the next run.
    retries: 2,
    concurrency: [{ key: "event.data.websiteId", limit: 2 }],
    triggers: [
      { event: "geo/check.requested" },
      /**
       * Weekly, Monday early morning. Assistant answers shift over weeks
       * rather than hours, and each run costs real money on every tracked
       * website — a daily cron would multiply spend for noise.
       */
      { cron: "0 4 * * 1" },
    ],
  },
  async ({ event, step, logger }) => {
    /**
     * A cron run has no websiteId and checks every site with active prompts.
     * An event run checks one. Both paths share everything below.
     */
    const data: unknown = event.data;
    const websiteId =
      data && typeof data === "object" && "websiteId" in data &&
      typeof data.websiteId === "string"
        ? data.websiteId
        : undefined;

    /**
     * Logged as an object so Inngest indexes the fields.
     *
     * `trigger` separates the weekly cron sweep from a single customer pressing
     * the button, which otherwise look identical in the run list and have very
     * different expectations about how many websites should appear below.
     */
    logger.info(
      { step: "start", websiteId: websiteId ?? null, trigger: websiteId ? "event" : "cron" },
      "GEO check started",
    );

    const targets = await step.run("select-websites", async () => {
      const rows = await db
        .selectDistinct({
          websiteId: geoPrompts.websiteId,
          brandName: websites.brandName,
          domain: websites.domain,
        })
        .from(geoPrompts)
        .innerJoin(websites, eq(geoPrompts.websiteId, websites.id))
        .where(
          websiteId
            ? and(
                eq(geoPrompts.websiteId, websiteId),
                eq(geoPrompts.active, true),
              )
            : eq(geoPrompts.active, true),
        );

      /*
        Zero targets is the quiet outcome that needs saying out loud: the run
        finishes green having checked nothing, and from the outside that is
        indistinguishable from a check that ran and found no mentions. A
        website with no active prompts is the usual cause.
      */
      if (rows.length === 0) {
        logger.warn(
          { step: "select-websites", websiteId: websiteId ?? null, websiteCount: 0 },
          "No websites with active prompts — nothing to check",
        );
      } else {
        logger.info(
          { step: "select-websites", websiteId: websiteId ?? null, websiteCount: rows.length },
          "Websites selected for GEO check",
        );
      }

      return rows;
    });

    let checked = 0;
    let mentions = 0;
    let failed = 0;

    for (const target of targets) {
      /**
       * Falls back to the domain when no brand name is set. Matching on a bare
       * domain is weaker, but it is a real string from the customer's own
       * record rather than a guess, and the alternative is skipping the site
       * silently.
       */
      const brand = target.brandName?.trim() || target.domain;

      const prompts = await step.run(
        `select-prompts-${target.websiteId}`,
        async () => {
          const rows = await db
            .select({ id: geoPrompts.id, prompt: geoPrompts.prompt })
            .from(geoPrompts)
            .where(
              and(
                eq(geoPrompts.websiteId, target.websiteId),
                eq(geoPrompts.active, true),
              ),
            )
            .limit(MAX_PER_RUN);

          /*
            `usedFallbackBrand` records that matching is running against a bare
            domain rather than a brand name, which is a measurably weaker match
            — worth knowing before someone reads a run of zero mentions as a
            real drop in visibility.
          */
          logger.info(
            {
              step: `select-prompts-${target.websiteId}`,
              websiteId: target.websiteId,
              promptCount: rows.length,
              usedFallbackBrand: !target.brandName?.trim(),
              cappedAtMaxPerRun: rows.length === MAX_PER_RUN,
            },
            "Prompts selected for website",
          );
          return rows;
        },
      );

      for (const prompt of prompts) {
        /**
         * One step per prompt, so a failure late in the list does not re-ask
         * the questions already answered — step.run memoises, and re-asking
         * would both cost money twice and record duplicate results.
         */
        const outcome = await step.run(`check-${prompt.id}`, async () => {
          const startedAt = Date.now();
          try {
            const result = await runCheck(prompt.prompt, brand, target.domain);

            logger.info(
              {
                step: `check-${prompt.id}`,
                websiteId: target.websiteId,
                geoPromptId: prompt.id,
                engine: ENGINE,
                mentioned: result.mentioned,
                position: result.position,
                cited: result.cited,
                competitors: result.competitors.length,
                durationMs: Date.now() - startedAt,
              },
              "Prompt checked",
            );
            return { ok: true as const, result };
          } catch (error) {
            /**
             * Swallowed deliberately. A thrown error here would fail the whole
             * run and lose the checks that did succeed. Critically, nothing is
             * written for this prompt: recording a failure as "not mentioned"
             * would invent a drop the customer never had.
             */
            const message = error instanceof Error ? error.message : "unknown";

            /*
              The swallow is the point of this log. Nothing is written for this
              prompt and nothing downstream re-raises, so without a line here
              the history of a partly-failed run is indistinguishable from a
              complete one that simply had fewer prompts.
            */
            logger.error(
              {
                step: `check-${prompt.id}`,
                websiteId: target.websiteId,
                geoPromptId: prompt.id,
                engine: ENGINE,
                reason: message,
                durationMs: Date.now() - startedAt,
              },
              "Prompt check failed — no result recorded for this prompt",
            );

            return {
              ok: false as const,
              message,
            };
          }
        });

        if (!outcome.ok) {
          failed += 1;
          continue;
        }

        await step.run(`save-${prompt.id}`, async () => {
          await db.insert(geoResults).values({
            geoPromptId: prompt.id,
            websiteId: target.websiteId,
            engine: ENGINE,
            mentioned: outcome.result.mentioned,
            position: outcome.result.position,
            cited: outcome.result.cited,
            competitors: outcome.result.competitors,
            excerpt: outcome.result.excerpt,
          });

          logger.info(
            {
              step: `save-${prompt.id}`,
              websiteId: target.websiteId,
              geoPromptId: prompt.id,
              engine: ENGINE,
              mentioned: outcome.result.mentioned,
              position: outcome.result.position,
              rowsWritten: 1,
            },
            "GEO result saved",
          );
        });

        checked += 1;
        if (outcome.result.mentioned) mentions += 1;
      }
    }

    /**
     * The one line that answers "did this run measure anything".
     *
     * `failed` is the number the per-prompt errors above roll up into: a run
     * where every check threw still returns successfully, so a non-zero
     * `failed` next to `checked: 0` is what separates "we could not ask" from
     * "the assistant does not mention them".
     */
    logger.info(
      {
        step: "done",
        websiteId: websiteId ?? null,
        websites: targets.length,
        checked,
        mentions,
        failed,
      },
      "GEO check complete",
    );

    return {
      websites: targets.length,
      checked,
      mentions,
      failed,
    };
  },
);
