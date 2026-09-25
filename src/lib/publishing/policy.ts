import { and, eq, isNotNull, isNull, or, sql as raw } from "drizzle-orm";

import { db } from "@/lib/db";
import { articles, calendarItems, integrations, websites } from "@/lib/db/schema";

/**
 * What happens to an article once it is written - the rules every publishing
 * path follows: the article job, the daily release of scheduled drafts, the
 * WordPress plugin's queue, and connecting a website for the first time.
 *
 * ONE SETTING, three answers, stored as two columns that already existed:
 *
 *   review  auto_publish = false               wait in RepGet for the customer
 *   draft   auto_publish = true, publish_as = draft   sent to the CMS as a draft
 *   live    auto_publish = true, publish_as = live    published on its date
 *
 * These used to be two controls in two different cards - "Publish without
 * asking me" and "Publish as" - and "draft" meant something different in
 * each. Worse, only the plugin honoured "Publish as": every direct
 * connection published live whatever it said.
 *
 * THE FIRST ARTICLE is the exception, by the client's rule: a website's first
 * article is published as soon as it is written, whichever mode is set, so
 * the customer sees the product work on their own site straight away. It
 * follows "draft" when that is the mode - a customer who asked for drafts
 * gets a draft - and is published live otherwise.
 */

export type FinishedMode = "review" | "draft" | "live";

type PublishSettings = { autoPublish: boolean; publishAs: string };

export function finishedModeOf(site: PublishSettings): FinishedMode {
  if (!site.autoPublish) return "review";
  return site.publishAs === "draft" ? "draft" : "live";
}

/** The columns a mode is stored as. */
export function settingsForMode(mode: FinishedMode): PublishSettings {
  if (mode === "review") return { autoPublish: false, publishAs: "live" };
  return { autoPublish: true, publishAs: mode };
}

/**
 * The CMS status an automatic publish uses - scheduled articles and the
 * first article alike. Only the "draft" mode creates a CMS draft.
 */
export function automaticStatus(site: PublishSettings): "publish" | "draft" {
  return finishedModeOf(site) === "draft" ? "draft" : "publish";
}

/**
 * True for the row that is its website's FIRST article, while nothing has been
 * sent for that website yet. Needs `websites` joined to `articles`.
 *
 * "First" is the website's EARLIEST article, and only while
 * first_article_sent_at is null. Requiring the earliest means a customer who
 * has been reviewing drafts for weeks does not find the next one published by
 * surprise; the flag means the rule fires once. Shared by every path, the
 * plugin's queue included, so they cannot disagree about which article it is.
 */
export const isFirstArticle = and(
  isNull(websites.firstArticleSentAt),
  raw`${articles.id} = (
    select first.id from articles first
    where first.website_id = ${articles.websiteId}
    order by first.created_at asc
    limit 1
  )`,
);

/** The website's first article, when it is written and not yet sent. */
export function pendingFirstArticleQuery(websiteId: string) {
  return db
    .select({ id: articles.id })
    .from(articles)
    .innerJoin(websites, eq(websites.id, articles.websiteId))
    .where(
      and(
        eq(articles.websiteId, websiteId),
        isFirstArticle,
        eq(articles.status, "draft"),
        isNull(articles.publishedUrl),
        isNotNull(articles.bodyHtml),
      ),
    )
    .limit(1);
}

export async function pendingFirstArticle(
  websiteId: string,
): Promise<{ id: string } | null> {
  const [row] = await pendingFirstArticleQuery(websiteId);
  return row ?? null;
}

/** True when the website has a direct CMS connection that can be pushed to. */
export async function hasConnectedIntegration(websiteId: string) {
  const [row] = await db
    .select({ id: integrations.id })
    .from(integrations)
    .where(
      and(
        eq(integrations.websiteId, websiteId),
        eq(integrations.status, "connected"),
      ),
    )
    .limit(1);
  return Boolean(row);
}

/**
 * Records that the website's first article has gone out. Idempotent: true
 * only for the call that actually set it, so the caller can do the one-time
 * follow-up (queueing the next articles) exactly once.
 */
export async function markFirstArticleSent(websiteId: string): Promise<boolean> {
  const rows = await db
    .update(websites)
    .set({ firstArticleSentAt: new Date() })
    .where(and(eq(websites.id, websiteId), isNull(websites.firstArticleSentAt)))
    .returning({ id: websites.id });
  return rows.length > 0;
}

/** Websites still waiting on their first article, for the daily release. */
export async function websitesAwaitingFirstArticle() {
  return db
    .select({
      websiteId: websites.id,
      organizationId: websites.organizationId,
      autoPublish: websites.autoPublish,
      publishAs: websites.publishAs,
    })
    .from(websites)
    .where(
      and(
        isNull(websites.firstArticleSentAt),
        raw`exists (
          select 1 from ${articles}
          where ${articles.websiteId} = ${websites.id}
            and ${articles.bodyHtml} is not null
        )`,
        raw`exists (
          select 1 from ${integrations}
          where ${integrations.websiteId} = ${websites.id}
            and ${integrations.status} = 'connected'
        )`,
      ),
    );
}

/**
 * Articles from the current batch that are written or being written and
 * still waiting for their date. Zero means the batch is done and the next
 * one may be written.
 *
 * Queued and generating count as ahead; so does a written draft not yet sent
 * whose planned time is still in the future. A draft whose time has come is
 * being released, and a failed article is not waiting for anything, so
 * neither holds up the next batch.
 */
export async function batchStillAhead(websiteId: string): Promise<number> {
  const [row] = await batchStillAheadQuery(websiteId);
  return row?.n ?? 0;
}

/** The query behind batchStillAhead; separate so it can be tested. */
export function batchStillAheadQuery(websiteId: string) {
  return db
    .select({ n: raw<number>`count(*)::int` })
    .from(articles)
    .leftJoin(calendarItems, eq(calendarItems.id, articles.calendarItemId))
    .where(
      and(
        eq(articles.websiteId, websiteId),
        or(
          raw`${articles.status} in ('queued', 'generating')`,
          and(
            eq(articles.status, "draft"),
            isNull(articles.publishedUrl),
            raw`${calendarItems.scheduledFor} > now()`,
          ),
        ),
      ),
    );
}
