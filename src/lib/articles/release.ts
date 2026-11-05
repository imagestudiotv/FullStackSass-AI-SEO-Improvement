import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { queueJob } from "@/inngest/send";
import { plannedDayHasCome, twoStepArticles } from "@/lib/articles/review";
import { db } from "@/lib/db";
import { member, user } from "@/lib/db/auth-tables";
import { articles, calendarItems, websites } from "@/lib/db/schema";
import { ARTICLE_DELIVERY } from "@/lib/i18n/article-delivery";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/config";
import { format } from "@/lib/i18n/format";
import { notify } from "@/lib/notifications/create";
import { nudgePluginIfDue } from "@/lib/plugin/sync";
import { PUBLISHING_KINDS } from "@/lib/publishing/kinds";
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
 *
 * UNDER THE TWO-STEP FLOW (lib/publishing/controls.ts) the first-article line
 * above does not apply: pendingFirstArticle finds nothing, so a first article
 * follows the same three modes. An article already on the website is only ever
 * updated by the customer's press: an approval never republishes a post.
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
      publishedUrl: articles.publishedUrl,
    })
    .from(articles)
    .innerJoin(websites, eq(websites.id, articles.websiteId))
    .leftJoin(calendarItems, eq(calendarItems.id, articles.calendarItemId))
    .where(eq(articles.id, articleId))
    .limit(1);
  if (!row) return "nothing_connected";
  if (row.publishedUrl && (await twoStepArticles())) return "customer_publishes";

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

/**
 * The two-step flow's one "ready" notification, sent after an approval when
 * the customer has something to do or to expect. One approval is one message:
 * approving twice is refused (approveArticle), and an article going out right
 * now tells them when it is live or if it failed (the publish job). Never
 * fails the approval, and nothing with the flow off.
 */
export async function notifyReady(articleId: string, release: ReleaseOutcome): Promise<void> {
  if (release === "queued" || release === "plugin") return;
  try {
    if (!(await twoStepArticles())) return;
    const [target] = await db
      .select({
        organizationId: websites.organizationId,
        websiteId: articles.websiteId,
        title: articles.title,
        publishedUrl: articles.publishedUrl,
        connected: sql<boolean>`exists (select 1 from integrations i where i.website_id = ${articles.websiteId}
            and i.status = 'connected' and i.kind in (${sql.join(PUBLISHING_KINDS.map((kind) => sql`${kind}`), sql`, `)}))
          or exists (select 1 from integration_keys k where k.website_id = ${articles.websiteId}
            and k.revoked_at is null and k.last_used_at is not null)`,
      })
      .from(articles)
      .innerJoin(websites, eq(websites.id, articles.websiteId))
      .where(eq(articles.id, articleId))
      .limit(1);
    if (!target) return;
    // Stored once, for everyone in the workspace, in its owner's language.
    const [owner] = await db
      .select({ locale: user.locale })
      .from(member)
      .innerJoin(user, eq(user.id, member.userId))
      .where(and(eq(member.organizationId, target.organizationId), eq(member.role, "owner")))
      .limit(1);
    const copy = ARTICLE_DELIVERY[owner?.locale && isLocale(owner.locale) ? owner.locale : DEFAULT_LOCALE];
    await notify({
      organizationId: target.organizationId,
      type: "article.ready",
      title: target.publishedUrl ? copy.notifyUpdate : copy.notifyReady,
      body: !target.connected
        ? format(copy.notifyConnect, { title: target.title })
        : release === "waiting_for_day"
          ? format(copy.notifyDay, { title: target.title })
          : target.title,
      href: `/websites/${target.websiteId}/articles/${articleId}`,
    });
  } catch (error) {
    console.error("[release] approved, but the ready notification failed", error);
  }
}
