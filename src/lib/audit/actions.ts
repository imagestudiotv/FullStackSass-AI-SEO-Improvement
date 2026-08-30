"use server";

import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { inngest } from "@/inngest/client";
import { db } from "@/lib/db";
import { audits, crawls, issues } from "@/lib/db/schema";
import { requireWebsite } from "@/lib/tenant";
import type { AuditSummary, Severity } from "@/lib/audit/rules";
import type { ActionResult } from "@/lib/websites/actions";

/**
 * Audit reads and actions.
 *
 * Scoped through requireWebsite() like every other tenant read: an audit id or
 * website id from the client is never trusted on its own.
 */

export type AuditIssue = {
  id: string;
  type: string;
  severity: string;
  url: string | null;
  detail: string | null;
};

export type AuditView = {
  id: string;
  score: number | null;
  summary: AuditSummary | null;
  createdAt: Date;
  issues: AuditIssue[];
};

/** Live crawl state, so the UI can show progress instead of a spinner. */
export type CrawlProgress = {
  status: string;
  pagesCrawled: number;
  pagesFound: number;
  error: string | null;
} | null;

export async function getLatestAudit(
  websiteId: string,
): Promise<{ audit: AuditView | null; crawl: CrawlProgress }> {
  const { site } = await requireWebsite(websiteId);

  const [audit] = await db
    .select()
    .from(audits)
    .where(eq(audits.websiteId, site.id))
    .orderBy(desc(audits.createdAt))
    .limit(1);

  const [crawl] = await db
    .select({
      status: crawls.status,
      pagesCrawled: crawls.pagesCrawled,
      pagesFound: crawls.pagesFound,
      error: crawls.error,
    })
    .from(crawls)
    .where(eq(crawls.websiteId, site.id))
    .limit(1);

  if (!audit) {
    return { audit: null, crawl: crawl ?? null };
  }

  const rows = await db
    .select({
      id: issues.id,
      type: issues.type,
      severity: issues.severity,
      url: issues.url,
      detail: issues.detail,
    })
    .from(issues)
    .where(eq(issues.auditId, audit.id));

  /**
   * Sorted by severity here rather than in SQL: "critical" sorts after
   * "info" alphabetically, so an ORDER BY on the text column would put the
   * least important findings first.
   */
  const rank: Record<string, number> = { critical: 0, warning: 1, info: 2 };
  rows.sort((a, b) => (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9));

  return {
    audit: {
      id: audit.id,
      score: audit.score,
      summary: (audit.summary as AuditSummary | null) ?? null,
      createdAt: audit.createdAt,
      issues: rows,
    },
    crawl: crawl ?? null,
  };
}

export async function startAudit(
  websiteId: string,
): Promise<ActionResult<null>> {
  const { site, orgId } = await requireWebsite(websiteId);

  // Auditing a site still being onboarded would crawl before we know its URL
  // resolves, and the result would be discarded anyway.
  if (site.status === "pending" || site.status === "crawling") {
    return { ok: false, error: "Wait until the site has been analysed first" };
  }

  await inngest.send({
    name: "website/audit.requested",
    data: { websiteId: site.id, organizationId: orgId },
  });

  revalidatePath(`/websites/${site.id}`);
  return { ok: true, data: null };
}

export type { Severity };
