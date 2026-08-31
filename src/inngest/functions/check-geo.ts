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
  async ({ event, step }) => {
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
        async () =>
          db
            .select({ id: geoPrompts.id, prompt: geoPrompts.prompt })
            .from(geoPrompts)
            .where(
              and(
                eq(geoPrompts.websiteId, target.websiteId),
                eq(geoPrompts.active, true),
              ),
            )
            .limit(MAX_PER_RUN),
      );

      for (const prompt of prompts) {
        /**
         * One step per prompt, so a failure late in the list does not re-ask
         * the questions already answered — step.run memoises, and re-asking
         * would both cost money twice and record duplicate results.
         */
        const outcome = await step.run(`check-${prompt.id}`, async () => {
          try {
            const result = await runCheck(prompt.prompt, brand, target.domain);
            return { ok: true as const, result };
          } catch (error) {
            /**
             * Swallowed deliberately. A thrown error here would fail the whole
             * run and lose the checks that did succeed. Critically, nothing is
             * written for this prompt: recording a failure as "not mentioned"
             * would invent a drop the customer never had.
             */
            return {
              ok: false as const,
              message: error instanceof Error ? error.message : "unknown",
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
        });

        checked += 1;
        if (outcome.result.mentioned) mentions += 1;
      }
    }

    return {
      websites: targets.length,
      checked,
      mentions,
      failed,
    };
  },
);
