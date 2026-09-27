"use server";

import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { audits, crawls, issues } from "@/lib/db/schema";
import { requireWebsite } from "@/lib/tenant";
import { requireEditor } from "@/lib/websites/require-editor";
import type { AuditSummary, Severity } from "@/lib/audit/rules";
import type { ActionResult } from "@/lib/websites/actions";
import { isEntitledToSpend } from "@/lib/billing/entitled";
import { reserveAndQueue } from "@/lib/jobs/outbox";

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

/**
 * Audits a user may start, over sliding hours. Each crawls up to 25 pages of
 * the customer's site; the ceiling is far above fixing issues and re-checking,
 * and reserved atomically so simultaneous presses cannot all pass.
 */
const HOUR = 60 * 60;
const AUDITS_PER_WEBSITE_PER_HOUR = 4;
const AUDITS_PER_WORKSPACE_PER_HOUR = 10;

export async function startAudit(
  websiteId: string,
): Promise<ActionResult<null>> {
  const guard = await requireEditor(websiteId);
  if (!guard.ok) return { ok: false, error: guard.error };
  const { site } = guard.context;
  // Billed to the website's owner, not an invited editor's own workspace.
  const ownerOrgId = site.organizationId;

  // Auditing a site still being onboarded would crawl before we know its URL
  // resolves, and the result would be discarded anyway.
  if (site.status === "pending" || site.status === "crawling") {
    return { ok: false, error: "Wait until the site has been analysed first" };
  }

  /*
    Entitlement, not just ownership. This queues a job that spends money, and
    a server action is a public endpoint - the page in front of it redirects
    an unpaid customer, but the action behind it is still POSTable.
  */
  const entitled = await isEntitledToSpend(site.id);
  if (!entitled.ok) return { ok: false, error: entitled.error };

  /*
    An audit crawls every page of the site, so a held-down button is the most
    expensive thing a paying customer can do. Entitlement says they may spend;
    this says how fast.
  */
  /*
    The slot and the job are recorded together (lib/jobs/outbox.ts): if the
    queue is down the audit is accepted and delivered when it recovers, and
    if it never can be the slot is handed back.
  */
  const slot = await reserveAndQueue(
    [
      { key: `audit:site:${site.id}`, limit: AUDITS_PER_WEBSITE_PER_HOUR, window: { seconds: HOUR } },
      { key: `audit:org:${ownerOrgId}`, limit: AUDITS_PER_WORKSPACE_PER_HOUR, window: { seconds: HOUR } },
    ],
    { operation: "website.audit", organizationId: ownerOrgId, websiteId: site.id },
    (reservations) => ({
      id: `website-audit:${reservations[0].id}`,
      name: "website/audit.requested",
      data: { websiteId: site.id, organizationId: ownerOrgId, reservations },
    }),
  );
  if (!slot.ok) {
    return {
      ok: false,
      error: "You have run this many times in the last hour. Please try again shortly.",
    };
  }

  revalidatePath(`/websites/${site.id}`);
  return { ok: true, data: null };
}

export type { Severity };
