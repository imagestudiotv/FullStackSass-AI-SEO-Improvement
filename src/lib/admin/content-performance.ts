import "server-only";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { articles, usageEvents, websites } from "@/lib/db/schema";
import { requireAdmin } from "./guard";
import { articleTask, type ArticleTask } from "@/lib/ai/article-tasks";
import { readResearch, researchRollout } from "@/lib/articles/research-types";
import { reviewHashSql } from "@/lib/articles/review";

export const CONTENT_TASKS = {
  research_plan: "Search planning",
  research: "Research brief",
  outline: "Article outline",
  body: "Article writing",
  evidence_check: "Evidence checking",
  evidence_correction: "Evidence correction",
  image_scene: "Cover image description",
  body_scenes: "Article image descriptions",
} satisfies Record<ArticleTask, string>;

export type ContentTaskUsage = {
  task: string;
  model: string;
  promptVersion: string;
  requests: number;
  knownCostUsd: number | null;
  unknownCosts: number;
  averageDurationMs: number | null;
  measuredDurations: number;
  failedRequests: number;
};

/** Administrator-only, read-only reporting. No provider calls, prompts or source excerpts. */
export async function getContentPerformance(now = new Date()) {
  await requireAdmin();
  const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  // Legacy article requests recorded purpose but not task. Preserve that
  // purpose instead of incorrectly presenting every legacy call as a search.
  const task = sql<string>`coalesce(${usageEvents.metadata}->>'task', substring(${usageEvents.metadata}->>'purpose' from 9))`;
  const model = sql<string>`coalesce(${usageEvents.model}, ${usageEvents.provider}, 'Unknown')`;
  const version = sql<string>`coalesce(${usageEvents.metadata}->>'promptVersion', 'Not recorded')`;
  const duration = sql`case when jsonb_typeof(${usageEvents.metadata}->'durationMs') = 'number'
    then case when (${usageEvents.metadata}->>'durationMs')::double precision >= 0
      then (${usageEvents.metadata}->>'durationMs')::double precision end end`;
  const purposes = [...Object.keys(CONTENT_TASKS).map(key => `article_${key}`), "article_research_search"];
  const rollout = researchRollout();
  const [usage, recent, selectedSites] = await Promise.all([
    db.select({
      task, model, promptVersion: version,
      requests: sql<number>`count(*)::int`,
      // SUM stays null if every cost is unknown; unknown entries are counted separately.
      knownCostUsd: sql<number | null>`sum(${usageEvents.costUsd})::float`,
      unknownCosts: sql<number>`count(*) filter (where ${usageEvents.costUsd} is null)::int`,
      averageDurationMs: sql<number | null>`avg(${duration})::float`,
      measuredDurations: sql<number>`count(${duration})::int`,
      failedRequests: sql<number>`count(*) filter (where ${usageEvents.metadata}->>'outcome' = 'request_failed_usage_unknown')::int`,
    }).from(usageEvents).where(and(
      gte(usageEvents.createdAt, since), lte(usageEvents.createdAt, now),
      sql`${usageEvents.metadata}->>'purpose' in (${sql.join(purposes.map(purpose => sql`${purpose}`), sql`, `)})`,
    )).groupBy(task, model, version).orderBy(task, model, version),
    db.select({
      id: articles.id, title: articles.title, domain: websites.domain, status: articles.status,
      research: articles.research, updatedAt: articles.updatedAt,
      held: sql<boolean>`${articles.researchReviewRequired} and ${articles.researchApprovedHash} is distinct from ${reviewHashSql}`,
    }).from(articles).innerJoin(websites, eq(articles.websiteId, websites.id))
      .where(gte(articles.updatedAt, since)).orderBy(desc(articles.updatedAt), desc(articles.id)).limit(20),
    rollout.websiteIds.length
      ? db.select({ id: websites.id, domain: websites.domain }).from(websites)
        .where(sql`${websites.id}::text in (${sql.join(rollout.websiteIds.map(id => sql`${id}`), sql`, `)})`)
        .orderBy(websites.domain).limit(25)
      : Promise.resolve([]),
  ]);
  return {
    since, until: now, rollout, selectedSites, usage: usage as ContentTaskUsage[],
    routes: (Object.keys(CONTENT_TASKS) as ArticleTask[]).map(task => ({ task, label: CONTENT_TASKS[task], ...articleTask(task) })),
    recent: recent.map(({ research: value, ...article }) => {
      const research = readResearch(value);
      return { ...article, researchStatus: research?.status ?? null,
        issues: research?.quality?.issues.length ?? null, checked: research?.quality?.checked ?? false };
    }),
  };
}
