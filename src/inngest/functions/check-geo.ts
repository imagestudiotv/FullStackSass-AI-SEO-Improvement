import { and, asc, eq } from "drizzle-orm";

import { inngest } from "@/inngest/client";
import { db } from "@/lib/db";
import { geoPrompts, geoResults, websites } from "@/lib/db/schema";
import { maxPromptsFor } from "@/lib/geo/allowance";
import { runCheck, type AnswerOutcome } from "@/lib/geo/check";
import { weeklyCheckRule } from "@/lib/geo/check-limits";
import { syncAiVisibilityCompetitors } from "@/lib/geo/competitors";
import { availableEngineIds, runsPerQuestion } from "@/lib/geo/engines";
import { marketOf } from "@/lib/geo/market";
import { combineAnswers } from "@/lib/geo/score";
import { isEntitledToSpend } from "@/lib/billing/entitled";
import { llmCostUsd, track } from "@/lib/usage";
import { MODELS } from "@/lib/ai/client";
import {
  paidCall,
  QuotaExhaustedError,
  releaseUnspent,
  reserveAll,
  type Reservation,
} from "@/lib/billing/spend-quota";

/**
 * Checks whether AI assistants recommend a customer's business.
 *
 * Since 2026-11-27 every question is put to every assistant this deployment
 * has a key for and names in GEO_ENGINES (Claude alone when unset;
 * lib/geo/engines.ts), each with web search on, several times
 * (GEO_RUNS_PER_QUESTION, default 2; costs in docs/ai-visibility.md), and the
 * share of answers naming the business is stored: one answer is a sample of
 * one. Each answer is two model calls - the assistant's, and Haiku reading
 * the brands out of it - so twenty questions, three assistants and three
 * runs are 360 calls. Far past a server action's budget, hence a job.
 *
 * The weekly cron does not check every website in one run any more: it
 * sends one event per website (an Inngest run has a step limit, and one
 * website is now up to a few hundred steps), and each is checked on its own.
 *
 * The concurrency key is per website rather than global. One customer with
 * twenty prompts must not delay everyone else's checks, and without a key a
 * burst of scheduled runs would hit the providers' rate limits together and
 * fail as a group.
 */

/** Prompts checked per run. A safety valve; plans allow 20 (50 on Scale). */
const MAX_PER_RUN = 50;

export const checkGeo = inngest.createFunction(
  {
    id: "check-geo",
    // A failed check is retried, but not endlessly: the usual cause is a
    // rate limit or a malformed answer, and both resolve on the next run.
    retries: 2,
    concurrency: [{ key: "event.data.websiteId", limit: 1 }],
    onFailure: async ({ event }) => {
      // Only a check that never reached the model gives its slot back.
      await releaseUnspent(
        event.data.event.data?.reservations as Reservation[] | undefined,
        "job_failed_before_spend",
      );
    },
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
    const data: unknown = event.data;
    const websiteId =
      data && typeof data === "object" && "websiteId" in data &&
      typeof data.websiteId === "string"
        ? data.websiteId
        : undefined;
    /** Present when a user started this check; the weekly sweep has none. */
    const reservations =
      data && typeof data === "object" && "reservations" in data
        ? (data.reservations as Reservation[] | undefined)
        : undefined;
    /** One website's share of the weekly sweep: never the Free plan's snapshot. */
    const scheduled = Boolean(data && typeof data === "object" && "scheduled" in data && data.scheduled === true);

    /**
     * Logged as an object so Inngest indexes the fields.
     *
     * `trigger` separates the weekly cron sweep from a single customer pressing
     * the button, which otherwise look identical in the run list and have very
     * different expectations about how many websites should appear below.
     */
    logger.info(
      { step: "start", websiteId: websiteId ?? null, trigger: websiteId ? (scheduled ? "weekly" : "event") : "cron" },
      "GEO check started",
    );

    const targets = await step.run("select-websites", async () => {
      const rows = await db
        .selectDistinct({
          websiteId: geoPrompts.websiteId,
          brandName: websites.brandName,
          domain: websites.domain,
          organizationId: websites.organizationId,
          language: websites.language,
          country: websites.country,
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
          "No websites with active prompts - nothing to check",
        );
      } else {
        logger.info(
          { step: "select-websites", websiteId: websiteId ?? null, websiteCount: rows.length },
          "Websites selected for GEO check",
        );
      }

      return rows;
    });

    if (!websiteId) {
      // The sweep: one run per website, once per week whatever the retries (the event id).
      const week = new Date().toISOString().slice(0, 10);
      if (targets.length > 0) {
        await step.sendEvent(
          "weekly-websites",
          targets.map((target) => ({
            id: `geo-weekly:${target.websiteId}:${week}`,
            name: "geo/check.requested",
            data: { websiteId: target.websiteId, scheduled: true },
          })),
        );
      }
      logger.info({ step: "done", websites: targets.length }, "GEO weekly sweep queued");
      return { websites: targets.length, checked: 0, mentions: 0, failed: 0 };
    }

    /*
      What this run asks: the assistants with a key, and how many times each.
      Read once in a step so a retry asks the same assistants as the first try.
    */
    const plan = await step.run("select-engines", () => ({ engines: availableEngineIds(), runs: runsPerQuestion() }));
    if (plan.engines.length === 0) {
      logger.warn({ step: "select-engines", websiteId }, "No AI assistant is configured - nothing to check");
      await releaseUnspent(reservations, "no_engine");
      return { websites: targets.length, checked: 0, mentions: 0, failed: 0 };
    }

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
      /** The language and market every answer is asked and recorded in (lib/geo/market.ts). */
      const market = marketOf(target);

      const prompts = await step.run(
        `select-prompts-${target.websiteId}`,
        async () => {
          /*
            No more than the website's plan allows. maxPromptsFor only stops
            new questions being added, so a website that kept a paid plan's
            twenty (a trial that ended on Free, a downgrade) still has them
            all active - and on Free a snapshot asks
            FREE_PLAN.visibilityQuestions, not twenty. Oldest first, so the
            same questions are asked each time and the answers compare.
          */
          const limit = Math.min(MAX_PER_RUN, await maxPromptsFor(target.websiteId));
          const rows = await db
            .select({ id: geoPrompts.id, prompt: geoPrompts.prompt })
            .from(geoPrompts)
            .where(
              and(
                eq(geoPrompts.websiteId, target.websiteId),
                eq(geoPrompts.active, true),
              ),
            )
            .orderBy(asc(geoPrompts.createdAt), asc(geoPrompts.id))
            .limit(limit);

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
              engines: plan.engines,
              runsPerQuestion: plan.runs,
              language: market.language,
              region: market.region,
              usedFallbackBrand: !target.brandName?.trim(),
              cappedAtMaxPerRun: rows.length === MAX_PER_RUN,
              cappedAtPlan: rows.length === limit && limit < MAX_PER_RUN,
            },
            "Prompts selected for website",
          );
          return rows;
        },
      );

      /*
        The weekly cap (lib/geo/check-limits.ts): a website is checked at most
        WEEKLY_CHECKS times in seven days, the Monday run and the customer's
        presses together. A pressed check already holds its slot (runGeoCheck
        reserves it with the others); the sweep takes one here, or skips.
      */
      const ownReservations = target.websiteId === websiteId ? reservations : undefined;
      const weekly = ownReservations
        ? { ok: true as const, reservations: [] as Reservation[] }
        : await step.run(`reserve-week-${target.websiteId}`, async () => {
            const held = await reserveAll([weeklyCheckRule(target.websiteId)], {
              operation: "geo.check",
              organizationId: target.organizationId,
              websiteId: target.websiteId,
            });
            return held.ok ? { ok: true as const, reservations: held.reservations } : { ok: false as const, reservations: [] as Reservation[] };
          });
      if (!weekly.ok) {
        logger.warn({ step: `reserve-week-${target.websiteId}`, websiteId: target.websiteId }, "Weekly AI visibility check cap reached - website skipped");
        continue;
      }
      const spendOn = ownReservations ?? weekly.reservations;

      let stopped = false;
      for (const prompt of prompts) {
        const answers: AnswerOutcome[] = [];

        for (const engine of plan.engines) {
          /**
           * One step per question and assistant, so a failure late in the
           * list does not re-ask the ones already answered — step.run
           * memoises, and re-asking would both cost money twice and record
           * duplicate results. The step asks `runs` times and returns every
           * answer it got; an answer that failed is left out, never counted
           * as "not named".
           */
          const outcome = await step.run(`check-${prompt.id}-${engine}`, async () => {
            const startedAt = Date.now();

            /*
              Entitlement at the moment of spending, in the step itself, so an
              Inngest retry cannot replay an earlier answer. The Free plan's
              snapshot only when its owner asked for it (an event run, counted
              against its month in runGeoCheck): the weekly sweep never spends
              on a Free website.
            */
            const entitled = await isEntitledToSpend(target.websiteId, scheduled ? {} : { free: true });
            if (!entitled.ok) {
              return { ok: false as const, answers: [] as AnswerOutcome[], failed: 0, stop: true };
            }

            const got: AnswerOutcome[] = [];
            let failedRuns = 0;
            for (let run = 0; run < plan.runs; run += 1) {
              try {
                const calls: { model: string; input: number; output: number; engine?: string; provider?: string; costUsd?: number; searches?: number; webSearch?: boolean }[] = [];
                const result = await paidCall(spendOn, () =>
                  runCheck(prompt.prompt, brand, target.domain, {
                    engine,
                    market,
                    onUsage: (model, usage, call) =>
                      calls.push({ model, input: usage.input_tokens, output: usage.output_tokens, ...call }),
                  }),
                );
                /*
                  What the check cost, per model call, on the owner's account:
                  the Free plan's cost cap (lib/plans/free-plan-server.ts) reads
                  these. An assistant's answer carries its own price (tokens and
                  searches, lib/geo/assistants.ts); the brand extraction is Haiku.
                */
                for (const call of calls) {
                  await track(target.organizationId, {
                    kind: "llm",
                    provider: call.provider ?? "anthropic",
                    model: call.model,
                    quantity: call.input + call.output,
                    costUsd: call.costUsd ?? llmCostUsd(call.model, call.input, call.output) ?? undefined,
                    websiteId: target.websiteId,
                    metadata: {
                      purpose: call.engine ? "geo_check_answer" : "geo_check",
                      engine: call.engine ?? null,
                      searches: call.searches ?? 0,
                      webSearch: call.webSearch ?? null,
                      inputTokens: call.input,
                      outputTokens: call.output,
                    },
                  }).catch((error) => logger.error({ step: `check-${prompt.id}-${engine}`, error: String(error) }, "Could not record the check's cost"));
                }
                got.push(result);
              } catch (error) {
                /**
                 * Swallowed deliberately. A thrown error here would fail the
                 * whole run and lose the answers that did come back.
                 * Critically, nothing is recorded for this answer: recording a
                 * failure as "not mentioned" would invent a drop the customer
                 * never had.
                 */
                failedRuns += 1;
                logger.error(
                  {
                    step: `check-${prompt.id}-${engine}`,
                    websiteId: target.websiteId,
                    geoPromptId: prompt.id,
                    engine,
                    run,
                    reason: error instanceof Error ? error.message.slice(0, 300) : "unknown",
                  },
                  "AI visibility answer failed - not recorded",
                );
                // Out of allowance: the other runs would be refused the same way.
                if (error instanceof QuotaExhaustedError) break;
              }
            }

            logger.info(
              {
                step: `check-${prompt.id}-${engine}`,
                websiteId: target.websiteId,
                geoPromptId: prompt.id,
                engine,
                answers: got.length,
                named: got.filter((a) => a.mentioned).length,
                failedRuns,
                durationMs: Date.now() - startedAt,
              },
              "Question asked",
            );
            return { ok: true as const, answers: got, failed: failedRuns, stop: false };
          });

          if (outcome.stop) {
            stopped = true;
            break;
          }
          answers.push(...outcome.answers);
        }

        if (stopped) {
          logger.warn({ step: `check-${prompt.id}`, websiteId: target.websiteId }, "Website is not entitled to spend - remaining prompts skipped");
          break;
        }

        const combined = combineAnswers(answers);
        if (!combined) {
          // No assistant answered: nothing is written for this question.
          failed += 1;
          continue;
        }

        await step.run(`save-${prompt.id}`, async () => {
          await db.insert(geoResults).values({
            geoPromptId: prompt.id,
            websiteId: target.websiteId,
            // Every assistant behind the row, in the order asked ("claude,chatgpt").
            engine: combined.engines.join(","),
            mentioned: combined.mentioned,
            position: combined.position,
            cited: combined.cited,
            competitors: combined.competitors,
            excerpt: combined.excerpt,
            samples: combined.samples,
            mentionCount: combined.mentionCount,
            weight: combined.weight,
            averagePosition: combined.averagePosition,
            answers: combined.answers,
          });

          logger.info(
            {
              step: `save-${prompt.id}`,
              websiteId: target.websiteId,
              geoPromptId: prompt.id,
              engines: combined.engines,
              samples: combined.samples,
              named: combined.mentionCount,
              averagePosition: combined.averagePosition,
              rowsWritten: 1,
            },
            "GEO result saved",
          );
        });

        checked += 1;
        if (combined.mentioned) mentions += 1;
      }

      if (!ownReservations && weekly.reservations.length > 0) {
        // A sweep that asked nothing (no plan, every call refused) gives its week's slot back.
        await step.run(`release-week-${target.websiteId}`, () => releaseUnspent(weekly.reservations, "nothing_asked"));
      }


      /*
        The rivals the assistant recommended, copied into the Business profile
        (lib/geo/competitors.ts): it said "Competitors: 0" beside an AI
        visibility page full of them (review of 2026-11-27). Suggestions only,
        never over the customer's own; at most one Haiku call, metered, and
        only for a website entitled to spend. A failure loses nothing measured.
      */
      await step.run(`sync-competitors-${target.websiteId}`, async () => {
        const entitled = await isEntitledToSpend(target.websiteId, scheduled ? {} : { free: true });
        if (!entitled.ok) return { added: 0 };
        try {
          const result = await syncAiVisibilityCompetitors(target.websiteId);
          if (result.usage) {
            await track(target.organizationId, {
              kind: "llm",
              provider: "anthropic",
              model: MODELS.EXTRACTION,
              websiteId: target.websiteId,
              quantity: result.usage.inputTokens + result.usage.outputTokens,
              costUsd: llmCostUsd(MODELS.EXTRACTION, result.usage.inputTokens, result.usage.outputTokens) ?? undefined,
              metadata: { purpose: "geo_competitor_websites", ...result.usage },
            });
          }
          logger.info({ step: `sync-competitors-${target.websiteId}`, websiteId: target.websiteId, added: result.added.length }, "AI visibility competitors copied into the profile");
          return { added: result.added.length };
        } catch (error) {
          logger.warn(
            { step: `sync-competitors-${target.websiteId}`, websiteId: target.websiteId, reason: error instanceof Error ? error.message.slice(0, 200) : "unknown" },
            "AI visibility competitors could not be copied into the profile",
          );
          return { added: 0 };
        }
      });
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
