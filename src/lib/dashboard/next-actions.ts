import "server-only";

import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { websites } from "@/lib/db/schema";
import { findTrafficChanges } from "@/lib/articles/decay";
import { PUBLISHING_KINDS } from "@/lib/publishing/kinds";

export type NextActionKind = "publishing" | "failed" | "draft" | "audit" | "google" | "traffic";
export type NextAction = { kind: NextActionKind; href: string; detail?: string };
type ArticleTask = { id: string; title: string } | null;

/** Called after the dashboard's tenant guard; scope every signal to that site. */
export async function getNextActions(websiteId: string, ownerOrgId: string, canManage: boolean): Promise<NextAction[]> {
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
    failed: sql<ArticleTask>`(select json_build_object('id', a.id, 'title', a.title) from articles a
      where a.website_id = ${websiteId} and a.status = 'failed' order by a.updated_at desc, a.id limit 1)`,
    draft: sql<ArticleTask>`(select json_build_object('id', a.id, 'title', a.title) from articles a
      where a.website_id = ${websiteId} and a.status = 'draft' and a.review_status is distinct from 'pending'
      and not websites.auto_publish order by a.updated_at desc, a.id limit 1)`,
    audit: sql<boolean>`exists (select 1 from issues i where i.website_id = ${websiteId}
      and i.severity in ('error', 'critical') and i.audit_id = (
        select a.id from audits a where a.website_id = ${websiteId} order by a.created_at desc, a.id limit 1
      ))`,
  }).from(websites).where(and(eq(websites.id, websiteId), eq(websites.organizationId, ownerOrgId))).limit(1);
  if (!row) return [];
  const base = `/websites/${websiteId}`;
  const actions: NextAction[] = [];
  if (canManage && !row.connected) actions.push({ kind: "publishing", href: `${base}/integrations` });
  if (row.failed) actions.push({ kind: "failed", href: `${base}/articles/${row.failed.id}`, detail: row.failed.title });
  if (row.hasSearchData) {
    const traffic = await findTrafficChanges(websiteId);
    const page = traffic.losingClicks[0] ?? traffic.losingVisibility[0];
    if (page) actions.push({ kind: "traffic", href: `${base}/traffic`, detail: page.articleTitle ?? page.pageUrl });
  }
  if (row.audit) actions.push({ kind: "audit", href: base });
  if (row.draft) actions.push({ kind: "draft", href: `${base}/articles/${row.draft.id}`, detail: row.draft.title });
  if (canManage && !row.google) actions.push({ kind: "google", href: `${base}/google` });
  return actions.slice(0, 5);
}
