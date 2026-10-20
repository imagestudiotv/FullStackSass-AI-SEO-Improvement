import "server-only";
import { createHash } from "node:crypto";
import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { nextActionPreferences, websites } from "@/lib/db/schema";
import { findTrafficChanges } from "@/lib/articles/decay";
import { PUBLISHING_KINDS } from "@/lib/publishing/kinds";
import { reviewHashSql, releasableSql } from "@/lib/articles/review";

export type NextActionKind = "publishing" | "publishFailed" | "failed" | "draft" | "audit" | "google" | "traffic" | "searchData" | "snippet" | "research";
export type NextAction = {
  id: string; kind: NextActionKind; href: string; detail?: string;
  priority: "high" | "medium" | "opportunity";
  evidence?: { metric: "clicks" | "impressions" | "position"; before: number; after: number; end: string } | { impressions: number; clicks: number; end: string };
};
type ArticleTask = { id: string; title: string; version?: string } | null;
const taskKey = (kind: NextActionKind, identity: string) =>
  `${kind}:${createHash("sha256").update(identity).digest("hex").slice(0, 24)}`;

/** Rules only. Completion follows the underlying state, never a paid AI call. */
export async function getNextActions(
  websiteId: string, ownerOrgId: string, canManage: boolean,
  options: { now?: Date; includeSnoozed?: boolean } = {},
): Promise<NextAction[]> {
  const now = options.now ?? new Date();
  const [row] = await db.select({
    connected: sql<boolean>`exists (
      select 1 from integrations i where i.website_id = ${websiteId}
      and i.status = 'connected' and i.kind in (${sql.join(PUBLISHING_KINDS.map(kind => sql`${kind}`), sql`, `)})
    ) or exists (
      select 1 from integration_keys k where k.website_id = ${websiteId}
      and k.revoked_at is null and k.last_used_at is not null
    )`,
    google: sql<boolean>`exists (select 1 from integrations i where i.website_id = ${websiteId}
      and i.kind = 'google_analytics' and i.status = 'connected' and coalesce(i.meta->>'searchConsoleSite', '') <> '')`,
    hasSearchData: sql<boolean>`exists (select 1 from gsc_page_metrics g where g.website_id = ${websiteId})`,
    failed: sql<ArticleTask>`(select json_build_object('id', a.id, 'title', a.title, 'version', a.updated_at::text) from articles a
      where a.website_id = ${websiteId} and a.status = 'failed' order by a.updated_at desc, a.id limit 1)`,
    publishFailed: sql<ArticleTask>`(select json_build_object('id', a.id, 'title', a.title, 'version', p.id::text)
      from articles a join publish_logs p on p.article_id = a.id
      where a.website_id = ${websiteId} and p.status = 'failed'
        and p.id = (select last.id from publish_logs last where last.article_id = a.id order by last.created_at desc, last.id desc limit 1)
      order by p.created_at desc, p.id desc limit 1)`,
    research: sql<ArticleTask>`(select json_build_object('id', articles.id, 'title', articles.title)
      from articles where articles.website_id = ${websiteId} and articles.status in ('draft', 'published')
      and articles.research_review_required and articles.research_approved_hash is distinct from ${reviewHashSql}
      order by articles.updated_at desc, articles.id limit 1)`,
    draft: sql<ArticleTask>`(select json_build_object('id', articles.id, 'title', articles.title) from articles
      where articles.website_id = ${websiteId} and articles.status = 'draft' and ${releasableSql}
      and not websites.auto_publish order by articles.updated_at desc, articles.id limit 1)`,
    audit: sql<string | null>`(select a.id::text from audits a where a.website_id = ${websiteId}
      and a.id = (select latest.id from audits latest where latest.website_id = ${websiteId} order by latest.created_at desc, latest.id desc limit 1)
      and exists (select 1 from issues i where i.audit_id = a.id and i.website_id = ${websiteId}
        and i.severity in ('error', 'critical')) limit 1)`,
  }).from(websites).where(and(eq(websites.id, websiteId), eq(websites.organizationId, ownerOrgId))).limit(1);
  if (!row) return [];
  const base = `/websites/${websiteId}`;
  const actions: NextAction[] = [];
  const add = (kind: NextActionKind, identity: string, priority: NextAction["priority"], href: string, detail?: string, evidence?: NextAction["evidence"]) =>
    actions.push({ id: taskKey(kind, identity), kind, priority, href, ...(detail ? { detail } : {}), ...(evidence ? { evidence } : {}) });
  if (canManage && !row.connected) add("publishing", websiteId, "high", `${base}/integrations`);
  for (const kind of ["publishFailed", "failed", "research"] as const) {
    const article = row[kind];
    if (article) add(kind, article.id + (article.version ?? ""), "high", `${base}/articles/${article.id}`, article.title);
  }
  if (row.audit) add("audit", row.audit, "high", base);
  if (row.hasSearchData) {
    const traffic = await findTrafficChanges(websiteId, now);
    if (traffic.dataStatus === "ready") {
      const page = traffic.losingClicks[0] ?? traffic.losingVisibility[0];
      if (page) add("traffic", page.pageUrl, "medium",
        page.articleId ? `${base}/articles/${page.articleId}` : `${base}/traffic`,
        page.articleTitle ?? page.pageUrl,
        traffic.losingClicks.length
          ? { metric: "clicks", before: page.clicksBefore, after: page.clicksAfter, end: traffic.windowEnd! }
          : (page.impressionDrop ?? 0) >= 0.5
            ? { metric: "impressions", before: page.impressionsBefore, after: page.impressionsAfter, end: traffic.windowEnd! }
            : { metric: "position", before: page.positionBefore!, after: page.positionAfter!, end: traffic.windowEnd! });
      // An opportunity for investigation, not a claim that the title caused low CTR.
      const result = await db.execute(sql`
        select page_url, sum(impressions)::int as impressions, sum(clicks)::int as clicks
        from gsc_page_metrics where website_id = ${websiteId}
          and date between (${traffic.windowEnd}::date - interval '27 days') and ${traffic.windowEnd}::date
        group by page_url having sum(impressions) >= 1000
          and sum(clicks)::float / nullif(sum(impressions), 0) < 0.01
          and sum(position * impressions) / nullif(sum(impressions), 0) between 1 and 10
        order by sum(impressions) desc, page_url limit 1`);
      const rows = (Array.isArray(result) ? result : (result as { rows: unknown[] }).rows) as { page_url: string; impressions: number; clicks: number }[];
      const candidate = rows[0];
      if (candidate && candidate.page_url !== page?.pageUrl) add("snippet", candidate.page_url, "opportunity", `${base}/google`, candidate.page_url,
        { clicks: candidate.clicks, impressions: candidate.impressions, end: traffic.windowEnd! });
    } else if (row.google && canManage) add("searchData", websiteId, "medium", `${base}/google`);
  } else if (row.google && canManage) add("searchData", websiteId, "medium", `${base}/google`);
  if (row.draft) add("draft", row.draft.id, "medium", `${base}/articles/${row.draft.id}`, row.draft.title);
  if (canManage && !row.google) add("google", websiteId, "medium", `${base}/google`);
  const order = { high: 0, medium: 1, opportunity: 2 };
  actions.sort((a, b) => order[a.priority] - order[b.priority]);
  if (options.includeSnoozed) return actions;
  const preferences = await db.select({ key: nextActionPreferences.taskKey }).from(nextActionPreferences)
    .where(and(eq(nextActionPreferences.websiteId, websiteId), gt(nextActionPreferences.snoozedUntil, now)));
  const hidden = new Set(preferences.map(p => p.key));
  return actions.filter(a => !hidden.has(a.id)).slice(0, 5);
}
