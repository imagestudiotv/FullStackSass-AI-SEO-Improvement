import "server-only";

import { and, count, desc, eq, gt, isNull, sql } from "drizzle-orm";

import type { AuditSummary } from "@/lib/audit/rules";
import { db } from "@/lib/db";
import { audits, crawls, issues, spendReservations } from "@/lib/db/schema";

import type { HealthAudit, HealthCrawl } from "./health-model";

/**
 * Everything the Website health page reads, in one place. READ ONLY: nothing
 * here starts a check, writes a row or touches a paid service.
 *
 * Called by the page after requireWebsitePage and requireWebsitePlan, with the
 * id of the site those guards resolved - never with an id from the client.
 * It replaces getLatestAudit (lib/audit/actions.ts) for this page because the
 * report needs what that action does not return: when the crawl started and
 * finished, whether a requested check is still waiting, and exact per-type
 * counts that do not depend on how many rows were sent.
 */

/**
 * Issue rows sent to the page at most. A check reads 25 pages, so a real
 * audit stays far below this; the cap only keeps a pathological one (every
 * discovered link refusing us) from shipping thousands of rows on every poll.
 * The page says so, with the real total, whenever it applies.
 */
export const ISSUE_ROW_LIMIT = 2000;

/** How far back a waiting request is looked for: the reservation sweeper's own horizon. */
const REQUEST_LOOKBACK_MS = 6 * 60 * 60 * 1000;

export type HealthData = {
  audit: HealthAudit | null;
  crawl: HealthCrawl | null;
  /** When a requested check that has not started yet was accepted. */
  requestedAt: Date | null;
};

const severityRank = sql`case ${issues.severity} when 'critical' then 0 when 'warning' then 1 when 'info' then 2 else 3 end`;

export async function loadHealthData(websiteId: string, now: Date = new Date()): Promise<HealthData> {
  const [[audit], [crawl], [request]] = await Promise.all([
    db
      .select({ id: audits.id, score: audits.score, summary: audits.summary, createdAt: audits.createdAt })
      .from(audits)
      .where(eq(audits.websiteId, websiteId))
      .orderBy(desc(audits.createdAt))
      .limit(1),
    /*
      The job deletes earlier crawl rows when it starts, so there is normally
      one; ordered anyway so a leftover can never be read instead of the
      newest run.
    */
    db
      .select({
        status: crawls.status,
        pagesCrawled: crawls.pagesCrawled,
        pagesFound: crawls.pagesFound,
        error: crawls.error,
        startedAt: crawls.startedAt,
        finishedAt: crawls.finishedAt,
      })
      .from(crawls)
      .where(eq(crawls.websiteId, websiteId))
      .orderBy(sql`${crawls.startedAt} desc nulls last`)
      .limit(1),
    /*
      A check accepted by startAudit but not yet started: its per-site slot
      is still "reserved" and the paid crawl has not begun. startAudit writes
      no crawl row, so this is the only stored trace of the request.
    */
    db
      .select({ countedAt: spendReservations.countedAt })
      .from(spendReservations)
      .where(
        and(
          eq(spendReservations.key, `audit:site:${websiteId}`),
          eq(spendReservations.state, "reserved"),
          isNull(spendReservations.spendStartedAt),
          gt(spendReservations.countedAt, new Date(now.getTime() - REQUEST_LOOKBACK_MS)),
        ),
      )
      .orderBy(desc(spendReservations.countedAt))
      .limit(1),
  ]);

  const crawlRow: HealthCrawl | null = crawl ?? null;
  const requestedAt = request?.countedAt ?? null;
  if (!audit) return { audit: null, crawl: crawlRow, requestedAt };

  const [rows, typeCounts] = await Promise.all([
    db
      .select({
        id: issues.id,
        type: issues.type,
        severity: issues.severity,
        url: issues.url,
        detail: issues.detail,
      })
      .from(issues)
      .where(eq(issues.auditId, audit.id))
      // Most serious first, so a capped list drops the least important rows.
      .orderBy(severityRank, issues.type, sql`${issues.url} asc nulls last`, issues.id)
      .limit(ISSUE_ROW_LIMIT),
    db
      .select({ type: issues.type, severity: issues.severity, count: count() })
      .from(issues)
      .where(eq(issues.auditId, audit.id))
      .groupBy(issues.type, issues.severity),
  ]);

  return {
    audit: {
      id: audit.id,
      score: audit.score,
      summary: (audit.summary as AuditSummary | null) ?? null,
      createdAt: audit.createdAt,
      rows,
      typeCounts: typeCounts.map((entry) => ({ ...entry, count: Number(entry.count) })),
      totalRows: typeCounts.reduce((sum, entry) => sum + Number(entry.count), 0),
    },
    crawl: crawlRow,
    requestedAt,
  };
}
