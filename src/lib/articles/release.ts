import "server-only";

import { eq } from "drizzle-orm";

import { queueJob } from "@/inngest/send";
import { plannedDayHasCome } from "@/lib/articles/review";
import { db } from "@/lib/db";
import { articles, calendarItems, websites } from "@/lib/db/schema";
import { nudgePluginIfDue } from "@/lib/plugin/sync";
import {
  automaticStatus,
  FIRST_ARTICLE_STATUS,
  hasConnectedIntegration,
  pendingFirstArticle,
} from "@/lib/publishing/policy";

/**
 * What happens the moment the RepGet team approves an article.
 *
 * Delivery then follows the customer's own publishing mode and planned day,
 * exactly as an unreviewed article's would:
 *
 *  - the website's first article (policy.ts) goes out now - live, as the
 *    first article always does - but only once its planned DAY has come;
 *  - "review" mode (auto-publish off): nothing is sent; the customer's
 *    Publish press now works;
 *  - "draft" or "live" mode: sent now if its planned day has come; before
 *    that, the daily release sends it on the day.
 *
 * APPROVED LATE: an article approved after its planned day is released at
 * once. The calendar keeps the original date - nothing is rewritten to make
 * the schedule look kept.
 *
 * Sends go through the durable job queue with an id tied to this approval's
 * version, so a retried approval cannot queue two publishes. The publish job
 * re-checks the gate itself before sending anything.
 */
export type ReleaseOutcome = "queued" | "plugin" | "waiting_for_day" | "customer_publishes" | "nothing_connected";

export async function releaseAfterApproval(articleId: string): Promise<ReleaseOutcome> {
  const [row] = await db
    .select({
      id: articles.id,
      websiteId: articles.websiteId,
      reviewVersion: articles.reviewVersion,
      scheduledFor: calendarItems.scheduledFor,
      organizationId: websites.organizationId,
      autoPublish: websites.autoPublish,
      publishAs: websites.publishAs,
    })
    .from(articles)
    .innerJoin(websites, eq(websites.id, articles.websiteId))
    .leftJoin(calendarItems, eq(calendarItems.id, articles.calendarItemId))
    .where(eq(articles.id, articleId))
    .limit(1);
  if (!row) return "nothing_connected";

  const first = await pendingFirstArticle(row.websiteId);
  let status: "publish" | "draft";
  if (first?.id === row.id) {
    status = FIRST_ARTICLE_STATUS;
  } else if (!row.autoPublish) {
    return "customer_publishes";
  } else if (!plannedDayHasCome(row.scheduledFor)) {
    return "waiting_for_day";
  } else {
    status = automaticStatus(row);
  }

  if (await hasConnectedIntegration(row.websiteId)) {
    await queueJob({
      id: `article-approved:${row.id}:${row.reviewVersion}`,
      name: "article/publish.requested",
      data: { articleId: row.id, websiteId: row.websiteId, organizationId: row.organizationId, status, trigger: "approval" },
    });
    return "queued";
  }
  // WordPress plugin sites pull: ask it to collect now (it only receives due articles).
  const nudged = await nudgePluginIfDue(row.websiteId);
  return nudged === "nothing-due" ? "nothing_connected" : "plugin";
}
