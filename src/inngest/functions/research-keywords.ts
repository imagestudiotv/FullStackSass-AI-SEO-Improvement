import { and, eq, inArray, sql as raw } from "drizzle-orm";

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
    onFailure: async ({ event, error }) => {
      const websiteId = event.data.event.data.websiteId as string;
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
  async ({ event, step }) => {
    const { websiteId, organizationId } = event.data as {
      websiteId: string;
      organizationId: string;
    };

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
      return generated;
    });

    if (seeds.length === 0) {
      await db
        .update(websites)
        .set({ status: "ready", updatedAt: new Date() })
        .where(eq(websites.id, websiteId));
      return { websiteId, keywords: 0, reason: "no_profile" };
    }

    /**
     * Provider metrics. Skipped entirely when unconfigured, so the pipeline
     * still completes with seed keywords and null metrics rather than failing.
     */
    const metrics = await step.run("fetch-metrics", async () => {
      if (!isDataForSeoConfigured()) {
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
          console.error("[research] keywordIdeas failed", error);
          return { metrics: [] as KeywordMetrics[], cached: true, failed: true };
        }),
        // Terms the site already ranks for are usually the cheapest wins.
        keywordsForSite(site.domain, location, language).catch(() => ({
          metrics: [] as KeywordMetrics[],
          cached: true,
        })),
      ]);

      /**
       * Nothing came back from the provider. Fall through to seed-only rows
       * rather than storing an empty keyword set, which would leave the
       * calendar with nothing to plan from.
       */
      if (ideas.metrics.length === 0 && ranked.metrics.length === 0) {
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
      return { configured: true, rows: [...merged.values()] };
    });

    const stored = await step.run("score-and-store", async () => {
      const ranked = rankKeywords(metrics.rows);

      // The plan's keyword allowance is a cap on what we store, not a failure:
      // research legitimately returns more than a plan covers.
      const limit = await checkLimit(organizationId, "keywords");
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

      return selected.map((keyword) => ({
        term: keyword.term,
        volume: keyword.volume,
        priorityScore: keyword.priorityScore,
        intent: keyword.intent,
      }));
    });

    const grouped = await step.run("cluster", async () => {
      const result = await clusterKeywords(
        stored.map((keyword) => ({
          term: keyword.term,
          volume: keyword.volume,
          priorityScore: keyword.priorityScore,
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
      const articleLimit = await checkLimit(organizationId, "articles");
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

      if (planned.length === 0) return;

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

    return {
      websiteId,
      keywords: stored.length,
      clusters: grouped.length,
      articles: planned.length,
      metricsFromProvider: metrics.configured,
    };
  },
);
