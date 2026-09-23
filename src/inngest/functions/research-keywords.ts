import { and, eq, inArray, sql as raw } from "drizzle-orm";
import { NonRetriableError } from "inngest";

import { inngest } from "@/inngest/client";
import { MODELS } from "@/lib/ai/client";
import { db } from "@/lib/db";
import { calendarItems, clusters, keywords, websites } from "@/lib/db/schema";
import { planCalendar } from "@/lib/keywords/calendar";
import { clusterKeywords } from "@/lib/keywords/cluster";
import { rankKeywords, type SearchIntent } from "@/lib/keywords/score";
import { generateSeedKeywords } from "@/lib/keywords/seeds";
import {
  isDataForSeoConfigured,
  keywordIdeas,
  keywordsForSite,
  type KeywordMetrics,
} from "@/lib/providers/dataforseo";
import { checkLimit, PRICING, track, UNLIMITED } from "@/lib/usage";
import { notify } from "@/lib/notifications/create";

/**
 * Keyword research and content planning.
 *
 * Chain: seeds -> provider metrics -> score -> cluster -> calendar. Each stage
 * is a step so a failure late in the chain replays without re-running the paid
 * calls that already succeeded — clustering failing must not re-bill DataForSEO.
 *
 * Runs WITHOUT DataForSEO credentials: seeds still produce keywords, they just
 * carry no volume or difficulty. That keeps the feature demonstrable before the
 * account exists and degrades to real metrics the moment it does.
 */

export const researchKeywords = inngest.createFunction(
  {
    id: "research-keywords",
    retries: 2,
    triggers: [{ event: "website/research.requested" }],
    // One research run per website: concurrent runs would double-spend and
    // race each other writing the same keyword rows.
    concurrency: { key: "event.data.websiteId", limit: 1 },
    onFailure: async ({ event, error, logger }) => {
      const websiteId = event.data.event.data.websiteId as string;

      logger.error(
        { step: "on-failure", websiteId, reason: error.message },
        "Keyword research failed after all retries",
      );

      await db
        .update(websites)
        .set({ status: "ready", updatedAt: new Date() })
        .where(eq(websites.id, websiteId));

      /**
       * Without this the status quietly returns to "ready" and the customer is
       * left believing research ran, with no keywords and no explanation.
       */
      await notify({
        organizationId: event.data.event.data.organizationId as string,
        type: "keywords.failed",
        title: "Search term research could not be completed",
        body: error.message.slice(0, 200),
        href: `/websites/${websiteId}`,
      });
    },
  },
  async ({ event, step, logger }) => {
    const { websiteId, organizationId } = event.data as {
      websiteId: string;
      organizationId: string;
    };

    /**
     * Structured logs, one per step, so the Inngest timeline explains itself.
     *
     * This is the function behind "Building your content plan…", and when it
     * produced nothing there was no way to tell from the run history whether
     * it had stalled, skipped a stage, or finished empty. Each step now
     * records what it received and what it produced, keyed by `step`, so the
     * stage where the row count goes to zero is visible at a glance.
     */
    logger.info(
      { step: "start", websiteId, organizationId },
      "Keyword research started",
    );

    const site = await step.run("load-profile", async () => {
      const [row] = await db
        .select()
        .from(websites)
        .where(eq(websites.id, websiteId))
        .limit(1);
      if (!row) throw new Error(`Website ${websiteId} not found`);

      await db
        .update(websites)
        .set({ status: "researching", updatedAt: new Date() })
        .where(eq(websites.id, websiteId));

      /**
       * Whether a profile exists, field by field.
       *
       * Seeds are generated from exactly these fields, so an empty profile
       * here is a guaranteed empty run. Logging it before generation means
       * the cause is recorded one step ahead of the symptom.
       */
      logger.info(
        {
          step: "load-profile",
          websiteId,
          brandName: row.brandName ?? null,
          industry: row.industry ?? null,
          country: row.country ?? null,
          language: row.language ?? null,
          hasDescription: Boolean(row.description),
          services: Array.isArray(row.services) ? row.services.length : 0,
          previousStatus: row.status,
        },
        "Profile loaded, status set to researching",
      );
      return row;
    });

    const seeds = await step.run("generate-seeds", async () => {
      const generated = await generateSeedKeywords({
        brandName: site.brandName,
        industry: site.industry,
        country: site.country,
        language: site.language,
        description: site.description,
        targetAudience: site.targetAudience,
        services: Array.isArray(site.services)
          ? (site.services as string[])
          : [],
      });

      const price = PRICING.llm[MODELS.EXTRACTION];
      await track(organizationId, {
        kind: "llm",
        websiteId,
        provider: "anthropic",
        model: MODELS.EXTRACTION,
        costUsd: 0.5 * price.inputPer1k + 0.7 * price.outputPer1k,
        metadata: { purpose: "keyword_seeds", count: generated.length },
      });

      logger.info(
        {
          step: "generate-seeds",
          websiteId,
          seedCount: generated.length,
          model: MODELS.EXTRACTION,
          sample: generated.slice(0, 5).map((g) => g.term),
        },
        "Seed keywords generated",
      );
      return generated;
    });

    /**
     * No seeds means no profile to work from — FAIL, do not report success.
     *
     * This used to set status "ready" and return `reason: "no_profile"`. The
     * job finished green having written nothing, which is the worst of both
     * outcomes: the content screen polls for keywords that are never coming
     * and spins forever, while the run history shows a success, so nothing
     * anywhere says what went wrong. A customer sat on "Building your content
     * plan…" for twenty minutes on a job that had already finished.
     *
     * Seeds come from the profile that website analysis writes, so an empty
     * list means step one never completed for this site. Marking it "failed"
     * is both true and useful: the UI reads that status to offer a retry, and
     * the error text names the actual cause rather than leaving a blank
     * screen to interpret.
     */
    if (seeds.length === 0) {
      logger.error(
        { step: "generate-seeds", websiteId, seedCount: 0 },
        "No seeds produced — website has no profile, aborting",
      );
      await db
        .update(websites)
        .set({ status: "failed", updatedAt: new Date() })
        .where(eq(websites.id, websiteId));
      throw new NonRetriableError(
        "No keyword seeds: this website has no profile yet, so website analysis must succeed first.",
      );
    }

    /**
     * Provider metrics. Skipped entirely when unconfigured, so the pipeline
     * still completes with seed keywords and null metrics rather than failing.
     */
    const metrics = await step.run("fetch-metrics", async () => {
      if (!isDataForSeoConfigured()) {
        /*
          Not an error: the run continues with seed terms and null metrics.
          Logged at warn because the plan it produces is measurably weaker,
          and that is worth knowing when someone asks why volumes are blank.
        */
        logger.warn(
          { step: "fetch-metrics", websiteId, seedCount: seeds.length },
          "DataForSEO not configured — continuing without search volumes",
        );
        return {
          configured: false,
          rows: seeds.map((seed) => ({
            term: seed.term,
            volume: null,
            difficulty: null,
            cpc: null,
            intent: seed.intent as SearchIntent,
            source: "ai_seed",
          })) satisfies KeywordMetrics[],
        };
      }

      const location = site.country || "United States";
      const language = site.language || "English";

      /**
       * Both provider calls tolerate failure.
       *
       * keywordIdeas used to throw straight out of the step, so any provider
       * problem — an unverified account, an expired card, a 5xx — failed the
       * whole run after three retries and the customer got no plan at all. The
       * seeds are already in hand at this point, so the honest degradation is
       * the same one used when no credentials are configured: keep the terms,
       * lose the volume and difficulty figures.
       */
      const [ideas, ranked] = await Promise.all([
        keywordIdeas(
          seeds.map((seed) => seed.term),
          location,
          language,
        ).catch((error) => {
          /*
            logger, not console: a console line is not attached to the run, so
            the reason volumes went missing never reached the timeline that
            would explain it. Provider errors here include an exhausted
            balance, which otherwise looks identical to "no results".
          */
          logger.error(
            { step: "fetch-metrics", websiteId, provider: "dataforseo", call: "keywordIdeas", err: error },
            "keywordIdeas failed — continuing without its metrics",
          );
          return { metrics: [] as KeywordMetrics[], cached: true, failed: true };
        }),
        // Terms the site already ranks for are usually the cheapest wins.
        keywordsForSite(site.domain, location, language).catch((error) => {
          logger.error(
            { step: "fetch-metrics", websiteId, provider: "dataforseo", call: "keywordsForSite", domain: site.domain, err: error },
            "keywordsForSite failed — continuing without its metrics",
          );
          return { metrics: [] as KeywordMetrics[], cached: true };
        }),
      ]);

      /**
       * Nothing came back from the provider. Fall through to seed-only rows
       * rather than storing an empty keyword set, which would leave the
       * calendar with nothing to plan from.
       */
      if (ideas.metrics.length === 0 && ranked.metrics.length === 0) {
        logger.warn(
          {
            step: "fetch-metrics",
            websiteId,
            provider: "dataforseo",
            location,
            language,
            seedCount: seeds.length,
          },
          "Provider returned no metrics — falling back to seed terms only",
        );
        return {
          configured: false,
          rows: seeds.map((seed) => ({
            term: seed.term,
            volume: null,
            difficulty: null,
            cpc: null,
            intent: seed.intent as SearchIntent,
            source: "ai_seed",
          })) satisfies KeywordMetrics[],
        };
      }

      // Only uncached calls cost money.
      const billable = (ideas.cached ? 0 : 1) + (ranked.cached ? 0 : 1);
      if (billable > 0) {
        await track(organizationId, {
          kind: "seo_api",
          websiteId,
          provider: "dataforseo",
          quantity: billable,
          costUsd: billable * PRICING.seo_api.dataforseoKeywordsPer1kRows.perCall,
          metadata: { purpose: "keyword_research" },
        });
      }

      // Seeds are kept so an intent the provider cannot classify survives.
      const merged = new Map<string, KeywordMetrics>();
      for (const seed of seeds) {
        merged.set(seed.term, {
          term: seed.term,
          volume: null,
          difficulty: null,
          cpc: null,
          intent: seed.intent as SearchIntent,
          source: "ai_seed",
        });
      }
      for (const row of [...ideas.metrics, ...ranked.metrics]) {
        const existing = merged.get(row.term);
        merged.set(row.term, {
          ...row,
          intent: row.intent ?? existing?.intent ?? null,
        });
      }
      const rows = [...merged.values()];
      logger.info(
        {
          step: "fetch-metrics",
          websiteId,
          provider: "dataforseo",
          location,
          language,
          ideaRows: ideas.metrics.length,
          rankedRows: ranked.metrics.length,
          mergedRows: rows.length,
          withVolume: rows.filter((r) => r.volume !== null).length,
          billableCalls: billable,
        },
        "Provider metrics merged",
      );
      return { configured: true, rows };
    });

    const stored = await step.run("score-and-store", async () => {
      const ranked = rankKeywords(metrics.rows);

      const limit = await checkLimit(websiteId, "keywords");

      /**
       * NO PLAN IS A FAILURE, not an allowance of zero.
       *
       * checkLimit answers "no_active_plan" with limit 0, which fell straight
       * into the arithmetic below as an allowance of zero — so the run stored
       * nothing, clustered nothing, planned nothing, and finished GREEN. The
       * content screen then polled forever for keywords that were never
       * coming, while the run history showed a success and three model calls
       * had already been billed.
       *
       * That is the difference this check draws: a plan whose keyword
       * allowance is used up is a legitimate cap and the run carries on with
       * what fits, but a website with no subscription at all should never
       * have reached this function. Saying so loudly means the UI can offer
       * the plan page instead of a spinner.
       *
       * NonRetriableError because no number of retries conjures a
       * subscription. startResearch refuses this case up front now too; this
       * is the backstop for an event sent any other way.
       */
      if (
        limit.reason === "no_active_plan" ||
        limit.reason === "subscription_inactive"
      ) {
        logger.error(
          {
            step: "score-and-store",
            websiteId,
            reason: limit.reason,
            ranked: ranked.length,
          },
          "No active plan — refusing to store zero keywords silently",
        );
        await db
          .update(websites)
          .set({ status: "failed", updatedAt: new Date() })
          .where(eq(websites.id, websiteId));
        throw new NonRetriableError(
          limit.reason === "no_active_plan"
            ? "This website has no subscription, so research cannot be stored. Choose a plan first."
            : "This website's subscription is not active, so research cannot be stored.",
        );
      }

      // The plan's keyword allowance is a cap on what we store, not a failure:
      // research legitimately returns more than a plan covers.
      const allowance =
        limit.limit === UNLIMITED
          ? ranked.length
          : Math.max(limit.limit - limit.used, 0);
      const selected = ranked.slice(0, allowance);

      if (selected.length > 0) {
        await db
          .insert(keywords)
          .values(
            selected.map((keyword) => ({
              websiteId,
              term: keyword.term,
              volume: keyword.volume,
              difficulty: keyword.difficulty,
              cpc: keyword.cpc === null ? null : keyword.cpc.toFixed(2),
              intent: keyword.intent,
              priorityScore: keyword.priorityScore,
              source: keyword.source,
            })),
          )
          // Re-running research must refresh metrics, not duplicate rows.
          .onConflictDoUpdate({
            target: [keywords.websiteId, keywords.term],
            set: {
              volume: raw`excluded.volume`,
              difficulty: raw`excluded.difficulty`,
              cpc: raw`excluded.cpc`,
              intent: raw`excluded.intent`,
              priorityScore: raw`excluded.priority_score`,
              updatedAt: new Date(),
            },
          });
      }

      /**
       * `truncatedByPlan` is the field to look at when a customer says they
       * expected more keywords: research legitimately finds more than a plan
       * stores, and this says so explicitly rather than leaving the gap
       * between ranked and stored to be inferred.
       */
      logger.info(
        {
          step: "score-and-store",
          websiteId,
          ranked: ranked.length,
          allowance,
          stored: selected.length,
          truncatedByPlan: ranked.length > selected.length,
          planLimit: limit.limit === UNLIMITED ? "unlimited" : limit.limit,
          planUsed: limit.used,
        },
        "Keywords scored and stored",
      );

      return selected.map((keyword) => ({
        term: keyword.term,
        volume: keyword.volume,
        priorityScore: keyword.priorityScore,
        intent: keyword.intent,
      }));
    });

    const grouped = await step.run("cluster", async () => {
      /**
       * EVERY keyword on the website, not only the ones this run found.
       *
       * Clustering used to read `stored`, which is this run's output alone.
       * Terms the customer typed themselves therefore never reached it: they
       * sat in the table, outside every cluster, and so outside the content
       * plan that is built from the clusters — which is the one thing adding
       * them was supposed to achieve.
       *
       * Reading the table instead means a manual term is clustered like any
       * other. It has no volume or score of its own, which is fine: the model
       * groups on meaning, and the metrics only order what it returns.
       */
      const all = await db
        .select({
          term: keywords.term,
          volume: keywords.volume,
          priorityScore: keywords.priorityScore,
        })
        .from(keywords)
        .where(eq(keywords.websiteId, websiteId));

      /*
        A manually added term has no priority score — nothing measured it.
        Zero rather than null so it still clusters: the score only orders the
        list shown to the model, and excluding these would put us back where
        we started.
      */
      const result = await clusterKeywords(
        all.map((keyword) => ({
          ...keyword,
          priorityScore: keyword.priorityScore ?? 0,
        })),
      );

      const price = PRICING.llm[MODELS.GENERATION];
      await track(organizationId, {
        kind: "llm",
        websiteId,
        provider: "anthropic",
        model: MODELS.GENERATION,
        costUsd: 1.5 * price.inputPer1k + 1.5 * price.outputPer1k,
        metadata: { purpose: "keyword_clustering", clusters: result.length },
      });

      logger.info(
        {
          step: "cluster",
          websiteId,
          // Everything on the site, including manually added terms.
          inputKeywords: all.length,
          clusterCount: result.length,
          model: MODELS.GENERATION,
          names: result.slice(0, 8).map((c) => c.name),
        },
        "Keywords clustered",
      );
      return result;
    });

    await step.run("save-clusters", async () => {
      // Replaced wholesale: clusters are derived, and a re-run should not leave
      // stale groupings behind. Keywords survive via ON DELETE SET NULL.
      await db.delete(clusters).where(eq(clusters.websiteId, websiteId));

      for (const group of grouped) {
        const [row] = await db
          .insert(clusters)
          .values({
            websiteId,
            name: group.name,
            pillarKeyword: group.pillarKeyword,
          })
          .returning({ id: clusters.id });

        // inArray, not a raw `any(...)`: passing a JS array into raw SQL sends
        // it as a scalar and Postgres rejects it with "op ANY/ALL (array)
        // requires array on right side", leaving every keyword unclustered.
        if (group.terms.length > 0) {
          await db
            .update(keywords)
            .set({ clusterId: row.id })
            .where(
              and(
                eq(keywords.websiteId, websiteId),
                inArray(keywords.term, group.terms),
              ),
            );
        }
      }
    });

    const planned = await step.run("plan-calendar", async () => {
      const articleLimit = await checkLimit(websiteId, "articles");
      const allowance =
        articleLimit.limit === UNLIMITED ? 12 : articleLimit.limit;

      const intents = new Map(
        stored
          .filter((keyword) => keyword.intent !== null)
          .map((keyword) => [keyword.term, keyword.intent as string]),
      );

      const articles = await planCalendar(grouped, allowance, intents);

      const price = PRICING.llm[MODELS.GENERATION];
      await track(organizationId, {
        kind: "llm",
        websiteId,
        provider: "anthropic",
        model: MODELS.GENERATION,
        costUsd: 0.5 * price.inputPer1k + 0.5 * price.outputPer1k,
        metadata: { purpose: "calendar_planning", articles: articles.length },
      });

      logger.info(
        {
          step: "plan-calendar",
          websiteId,
          clusterCount: grouped.length,
          allowance,
          planLimit:
            articleLimit.limit === UNLIMITED ? "unlimited" : articleLimit.limit,
          plannedArticles: articles.length,
        },
        "Content calendar planned",
      );
      return articles;
    });

    await step.run("save-calendar", async () => {
      /**
       * Only unstarted items are cleared. An article already generated or
       * published must survive a re-plan — deleting it would orphan real work.
       */
      await db
        .delete(calendarItems)
        .where(
          and(
            eq(calendarItems.websiteId, websiteId),
            eq(calendarItems.status, "planned"),
          ),
        );

      if (planned.length === 0) {
        /*
          An empty calendar is the exact state the content screen waits on
          forever, so it must never pass silently. Warn rather than error:
          the run did complete, it simply produced nothing to publish.
        */
        logger.warn(
          { step: "save-calendar", websiteId, plannedArticles: 0 },
          "No calendar items to save — content plan will be empty",
        );

        /**
         * STILL RESOLVE THE STATUS before returning.
         *
         * The `status: "ready"` write lives at the end of this step, so this
         * early return skipped it and left the row on "researching" — the
         * state the content screen treats as "still working". A run that
         * finished with an empty calendar therefore looked identical to one
         * still in progress, and the spinner never stopped.
         *
         * "ready" rather than "failed": the research genuinely completed and
         * the keywords are stored. There is simply nothing on the calendar,
         * which the screen can say plainly once it stops waiting.
         */
        await db
          .update(websites)
          .set({ status: "ready", updatedAt: new Date() })
          .where(eq(websites.id, websiteId));
        return;
      }

      const clusterIds = await db
        .select({ id: clusters.id, name: clusters.name })
        .from(clusters)
        .where(eq(clusters.websiteId, websiteId));
      const byName = new Map(clusterIds.map((row) => [row.name, row.id]));

      await db.insert(calendarItems).values(
        planned.map((article) => ({
          websiteId,
          clusterId: byName.get(article.clusterName) ?? null,
          title: article.title,
          targetKeyword: article.targetKeyword,
          intent: article.intent,
          /**
           * Re-hydrated: a step's return value is JSON-serialised by Inngest,
           * so the Date planCalendar produced arrives here as a string.
           */
          scheduledFor: new Date(article.scheduledFor),
          status: "planned",
        })),
      );

      await db
        .update(websites)
        .set({ status: "ready", updatedAt: new Date() })
        .where(eq(websites.id, websiteId));

      logger.info(
        {
          step: "save-calendar",
          websiteId,
          savedItems: planned.length,
          firstScheduledFor: planned[0]?.scheduledFor ?? null,
          lastScheduledFor: planned.at(-1)?.scheduledFor ?? null,
        },
        "Calendar saved, status set to ready",
      );
    });

    await step.run("notify-ready", async () => {
      await notify({
        organizationId,
        type: "keywords.ready",
        title: "Your search terms are ready",
        body: `${stored.length} terms found, and ${planned.length} ${planned.length === 1 ? "article" : "articles"} planned.`,
        href: `/websites/${websiteId}`,
      });
    });

    /**
     * The one line that answers "did this run actually produce a plan".
     *
     * Every count that matters, in a single record: if any of them is zero
     * the earlier step logs say which stage lost them.
     */
    logger.info(
      {
        step: "done",
        websiteId,
        keywords: stored.length,
        clusters: grouped.length,
        articles: planned.length,
        metricsFromProvider: metrics.configured,
      },
      "Keyword research complete",
    );

    return {
      websiteId,
      keywords: stored.length,
      clusters: grouped.length,
      articles: planned.length,
      metricsFromProvider: metrics.configured,
    };
  },
);
