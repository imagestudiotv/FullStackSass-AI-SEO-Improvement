import { createHash } from "node:crypto";

import { and, eq, sql, type SQL } from "drizzle-orm";

import { db } from "@/lib/db";
import { articles, calendarItems, networkSites } from "@/lib/db/schema";
import type { Executor } from "@/lib/db/types";

/**
 * The RepGet team's review gate for the managed Partner Network.
 *
 * THE RULE. An article with a review_status is delivered by NO publishing
 * path - direct CMS publishing, the WordPress plugin's pull, the scheduled
 * release, the first-article release, the release on connecting a CMS, a
 * retry, or a Publish press - unless:
 *
 *   1. an administrator approved it (review_status = 'approved'), and
 *   2. it still is EXACTLY what was approved: the hash of everything that is
 *      delivered (title, slug, excerpt, body, image) equals the hash taken at
 *      approval. Any later edit - by the customer, an administrator, a
 *      placement change or a rewrite - fails this, so an older approval can
 *      never carry a newer, unapproved revision out; and
 *   3. for anything released automatically, its planned day has come
 *      (notBeforePlanned). The first-article exception does not jump it.
 *
 * Articles with review_status null - every article written before this
 * existed, and those of websites outside the network - follow the ordinary
 * rules, unchanged.
 *
 * The hash is computed identically here and in SQL (reviewHashSql), so the
 * queries that pick articles to publish and the job that publishes them
 * agree. Fields are joined with U+001F, which Postgres text allows (NUL it
 * does not) and which never appears in a title or URL.
 */

const SEP = "\u001f";

export type ReviewFields = {
  title: string;
  slug: string | null;
  metaDescription: string | null;
  bodyHtml: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
};

export function reviewHash(article: ReviewFields): string {
  return createHash("sha256")
    .update(
      [article.title, article.slug, article.metaDescription, article.bodyHtml, article.imageUrl, article.imageAlt]
        .map((value) => value ?? "")
        .join(SEP),
      "utf8",
    )
    .digest("hex");
}

/** The same hash, computed by Postgres over the article row. */
export const reviewHashSql: SQL<string> = sql<string>`encode(sha256(convert_to(
  coalesce(${articles.title}, '') || chr(31) || coalesce(${articles.slug}, '') || chr(31) ||
  coalesce(${articles.metaDescription}, '') || chr(31) || coalesce(${articles.bodyHtml}, '') || chr(31) ||
  coalesce(${articles.imageUrl}, '') || chr(31) || coalesce(${articles.imageAlt}, ''),
  'UTF8')), 'hex')`;

/** True for an article any publishing path may deliver (rules 1 and 2). */
export const releasableSql: SQL = sql`(
  ${articles.reviewStatus} is null
  or (${articles.reviewStatus} = 'approved' and ${articles.reviewApprovedHash} = ${reviewHashSql})
)`;

/**
 * Rule 3: a reviewed article is not released automatically before its
 * planned DAY - the first-article exception included. Unreviewed articles
 * keep their existing behaviour.
 *
 * Compared by UTC calendar day, the project's date policy (see the
 * generation job's auto-publish step): the calendar stores noon on the
 * planned day, and "for the 24th" means the day - an approval at 06:00 on
 * the 24th releases it then, not at noon. An approval AFTER the planned day
 * releases it at once; the planned date itself is never rewritten.
 */
export const notBeforePlannedSql: SQL = sql`(
  ${articles.reviewStatus} is null
  or not exists (
    select 1 from ${calendarItems} planned
    where planned.id = ${articles.calendarItemId}
      and planned.scheduled_for::date > timezone('utc', now())::date
  )
)`;

/** The same day rule in TypeScript, for a planned date already read. */
export function plannedDayHasCome(scheduledFor: Date | null, now: Date = new Date()): boolean {
  if (!scheduledFor) return true;
  const day = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return day(now) >= day(scheduledFor);
}

export type ReleaseCheck =
  | { ok: true }
  | { ok: false; reason: "pending_review" | "changed_since_approval" | "not_found" };

/** The gate, for one article, as the publish job and Publish press apply it. */
export async function checkReleasable(articleId: string, executor: Executor = db): Promise<ReleaseCheck> {
  const [row] = await executor
    .select({
      title: articles.title,
      slug: articles.slug,
      metaDescription: articles.metaDescription,
      bodyHtml: articles.bodyHtml,
      imageUrl: articles.imageUrl,
      imageAlt: articles.imageAlt,
      reviewStatus: articles.reviewStatus,
      reviewApprovedHash: articles.reviewApprovedHash,
    })
    .from(articles)
    .where(eq(articles.id, articleId))
    .limit(1);
  if (!row) return { ok: false, reason: "not_found" };
  return releaseCheckFor(row);
}

export function releaseCheckFor(row: ReviewFields & { reviewStatus: string | null; reviewApprovedHash: string | null }): ReleaseCheck {
  if (row.reviewStatus === null) return { ok: true };
  if (row.reviewStatus !== "approved") return { ok: false, reason: "pending_review" };
  if (row.reviewApprovedHash !== reviewHash(row)) return { ok: false, reason: "changed_since_approval" };
  return { ok: true };
}

/** What the customer is told when a Publish press meets the gate. */
export const HELD_MESSAGE =
  "This article is being prepared by the RepGet team for the Partner Network. It goes out as soon as they approve it.";

/**
 * True when new drafts for this website enter the review gate: the website
 * takes part in the Partner Network AND an operator has switched the managed
 * review on (platform_controls.managed_review). The switch stays off until a
 * deploy has completed, so no article is held for review while an older
 * build - which ignores review_status - may still be serving requests.
 */
export async function inManagedNetwork(websiteId: string, executor: Executor = db): Promise<boolean> {
  const [row] = await executor
    .select({
      accepting: networkSites.acceptingLinks,
      reviewOn: sql<boolean>`exists (select 1 from platform_controls pc where pc.key = 'managed_review' and pc.enabled)`,
    })
    .from(networkSites)
    .where(eq(networkSites.websiteId, websiteId))
    .limit(1);
  return Boolean(row?.accepting && row.reviewOn);
}

/**
 * The review state a freshly written draft is saved with, decided INSIDE the
 * saving transaction under REVIEW_LOCK (shared). Switching managed review on
 * takes that lock exclusively and then holds the drafts written while it was
 * off (lib/publishing/controls.ts), so a save that decided "not reviewed"
 * can never land after that sweep: it either commits first (and the sweep
 * holds it) or waits and sees the switch on.
 */
export async function reviewStatusForNewDraft(tx: Executor, websiteId: string): Promise<"pending" | null> {
  await tx.execute(sql`select pg_advisory_xact_lock_shared(hashtext('repget:managed-review'))`);
  return (await inManagedNetwork(websiteId, tx)) ? "pending" : null;
}

/**
 * An approved article was changed: back to pending, visibly. The hash check
 * already holds it; this makes the review queue show it again.
 */
export async function invalidateApproval(articleId: string, executor: Executor = db): Promise<void> {
  await executor
    .update(articles)
    .set({
      reviewStatus: "pending",
      reviewApprovedAt: null,
      reviewApprovedBy: null,
      reviewApprovedHash: null,
      reviewVersion: sql`${articles.reviewVersion} + 1`,
    })
    .where(and(eq(articles.id, articleId), eq(articles.reviewStatus, "approved")));
}

/**
 * After any edit (text, title, slug, excerpt, image): an approved article
 * that no longer matches what was approved goes back to pending, so the
 * review queue shows it again. A save that changed nothing keeps the
 * approval. The gate itself does not depend on this - it compares hashes
 * on every release - but the queue should not claim "approved" for text
 * nobody approved.
 */
export async function syncApproval(articleId: string, executor: Executor = db): Promise<void> {
  const [row] = await executor
    .select({
      title: articles.title,
      slug: articles.slug,
      metaDescription: articles.metaDescription,
      bodyHtml: articles.bodyHtml,
      imageUrl: articles.imageUrl,
      imageAlt: articles.imageAlt,
      reviewStatus: articles.reviewStatus,
      reviewApprovedHash: articles.reviewApprovedHash,
    })
    .from(articles)
    .where(eq(articles.id, articleId))
    .limit(1);
  if (row?.reviewStatus === "approved" && row.reviewApprovedHash !== reviewHash(row)) {
    await invalidateApproval(articleId, executor);
  }
}
