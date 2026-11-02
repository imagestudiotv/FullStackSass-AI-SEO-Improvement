import { createHash } from "node:crypto";

import { and, eq, inArray, sql, type SQL } from "drizzle-orm";

import { linksTo } from "@/lib/articles/link-guard";
import { onFreeArticles } from "@/lib/billing/free-articles";
import { db } from "@/lib/db";
import { articles, backlinkRequests, calendarItems, networkSites, placements, platformControls } from "@/lib/db/schema";
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
  (${articles.reviewStatus} is null
  or (${articles.reviewStatus} = 'approved' and ${articles.reviewApprovedHash} = ${reviewHashSql}))
  and (not ${articles.researchReviewRequired} or ${articles.researchApprovedHash} = ${reviewHashSql})
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
      researchReviewRequired: articles.researchReviewRequired,
      researchApprovedHash: articles.researchApprovedHash,
    })
    .from(articles)
    .where(eq(articles.id, articleId))
    .limit(1);
  if (!row) return { ok: false, reason: "not_found" };
  return releaseCheckFor(row);
}

export function releaseCheckFor(row: ReviewFields & {
  reviewStatus: string | null; reviewApprovedHash: string | null;
  researchReviewRequired?: boolean; researchApprovedHash?: string | null;
}): ReleaseCheck {
  if (row.researchReviewRequired && row.researchApprovedHash !== reviewHash(row)) {
    return { ok: false, reason: row.researchApprovedHash ? "changed_since_approval" : "pending_review" };
  }
  if (row.reviewStatus === null) return { ok: true };
  if (row.reviewStatus !== "approved") return { ok: false, reason: "pending_review" };
  if (row.reviewApprovedHash !== reviewHash(row)) return { ok: false, reason: "changed_since_approval" };
  return { ok: true };
}

/**
 * An article in the RepGet team's review that can still change: a draft,
 * never published. Administrators edit such an article on its review page
 * only (editReviewedArticle in lib/backlinks/managed.ts), which checks the
 * version and text they opened, keeps placed network links, and returns it
 * for approval. The general admin editor refuses it.
 */
export function underReview(row: { reviewStatus: string | null; status: string; publishedUrl: string | null }): boolean {
  return row.reviewStatus !== null && row.status === "draft" && !row.publishedUrl;
}

/** What the customer is told when a Publish press meets the gate. */
export const HELD_MESSAGE =
  "This article needs review before publishing. Open the article to check its research or pending review by the RepGet team.";

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
      freeArticles: sql<boolean>`${onFreeArticles(networkSites.websiteId)}`,
    })
    .from(networkSites)
    .where(eq(networkSites.websiteId, websiteId))
    .limit(1);
  /*
    Not while the website is on its free articles (lib/billing/
    free-articles.ts): the Partner Network waits for the plan, and a free
    article held for the RepGet team would keep a new customer waiting for
    the thing they came to try. Drafts written after the plan starts are
    reviewed as usual.
  */
  return Boolean(row?.accepting && row.reviewOn && !row.freeArticles);
}

/**
 * True while the client's two-step article flow is on
 * (platform_controls.two_step_articles, see lib/publishing/controls.ts):
 * every new draft comes to the RepGet team first, their one approval makes
 * it ready - sources included - and the customer only publishes.
 *
 * Read here rather than through lib/publishing/controls.ts, which imports
 * this module.
 */
export async function twoStepArticles(executor: Executor = db): Promise<boolean> {
  const [row] = await executor
    .select({ enabled: platformControls.enabled })
    .from(platformControls)
    .where(eq(platformControls.key, "two_step_articles"))
    .limit(1);
  return row?.enabled ?? false;
}

/**
 * The review state a freshly written draft is saved with, decided INSIDE the
 * saving transaction under REVIEW_LOCK (shared). Switching managed review on
 * takes that lock exclusively and then holds the drafts written while it was
 * off (lib/publishing/controls.ts), so a save that decided "not reviewed"
 * can never land after that sweep: it either commits first (and the sweep
 * holds it) or waits and sees the switch on.
 *
 * With the two-step flow on, EVERY new draft comes to the team - every
 * website, Partner Network or not, and the free articles of a new customer
 * too: the client's rule is that the team writes the first article quickly
 * and the customer receives it ready.
 */
export async function reviewStatusForNewDraft(tx: Executor, websiteId: string): Promise<"pending" | null> {
  await tx.execute(sql`select pg_advisory_xact_lock_shared(hashtext('repget:managed-review'))`);
  if (await twoStepArticles(tx)) return "pending";
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

/**
 * After the CUSTOMER's own edit (text, title, slug, excerpt, image).
 *
 * With the two-step flow off: syncApproval, as before - the article goes
 * back to the team's queue.
 *
 * With it on, the team's approval FOLLOWS the customer's edit: the client's
 * rule is "the team works on it, the customer gets a ready version to
 * publish", with no approve-change-approve-again loop. It is the customer's
 * own article, so their change needs nobody's permission. The one exception
 * is a placed Partner Network link: its credits are reserved against that
 * link on this page, so an edit that removes one goes back to the team, who
 * restore it or withdraw the placement - otherwise the customer would
 * publish an article without the link another customer is paying for.
 *
 * Runs inside the edit's transaction, under the article's row lock
 * (editArticle in lib/publishing/dispatch.ts).
 */
export async function followCustomerEdit(articleId: string, executor: Executor = db): Promise<void> {
  if (!(await twoStepArticles(executor))) return syncApproval(articleId, executor);

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
      researchReviewRequired: articles.researchReviewRequired,
      researchApprovedHash: articles.researchApprovedHash,
    })
    .from(articles)
    .where(eq(articles.id, articleId))
    .limit(1);
  if (row?.reviewStatus !== "approved") return;
  const hash = reviewHash(row);
  if (row.reviewApprovedHash === hash) return;

  const committed = await executor
    .select({ targetUrl: backlinkRequests.targetUrl })
    .from(placements)
    .innerJoin(backlinkRequests, eq(backlinkRequests.id, placements.requestId))
    .where(and(eq(placements.articleId, articleId), inArray(placements.status, ["pending", "drafted"])));
  if (committed.some((placement) => !linksTo(row.bodyHtml ?? "", placement.targetUrl))) {
    await invalidateApproval(articleId, executor);
    return;
  }

  await executor
    .update(articles)
    .set({
      reviewApprovedHash: hash,
      // The team's approval covered the sources (approveArticle); it covers this revision too.
      ...(row.researchReviewRequired && row.researchApprovedHash === row.reviewApprovedHash ? { researchApprovedHash: hash } : {}),
    })
    .where(and(eq(articles.id, articleId), eq(articles.reviewStatus, "approved")));
}
