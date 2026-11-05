import { createHash } from "node:crypto";

import { and, eq, isNull, sql, type SQL } from "drizzle-orm";

import { onFreeArticles } from "@/lib/billing/free-articles";
import { PREPARING_TITLE } from "@/lib/i18n/article-delivery";
import { db } from "@/lib/db";
import { articles, calendarItems, networkSites, platformControls } from "@/lib/db/schema";
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

/**
 * True for an article any publishing path may deliver (rules 1 and 2). Under
 * the two-step flow: it is approved as it stands, or has a stored revision to
 * send instead of its working copy (sendableRevision, which the dispatch claim
 * applies to what is actually sent).
 */
export const releasableSql: SQL = sql`(case when not exists (
    select 1 from platform_controls pc where pc.key = 'two_step_articles' and pc.enabled
  ) then (
    (${articles.reviewStatus} is null
    or (${articles.reviewStatus} = 'approved' and ${articles.reviewApprovedHash} = ${reviewHashSql}))
    and (not ${articles.researchReviewRequired} or ${articles.researchApprovedHash} = ${reviewHashSql})
  ) else (
    ${articles.approvedRevision} is not null
    or (${articles.reviewStatus} = 'approved' and ${articles.reviewApprovedHash} = ${reviewHashSql}
      and (not ${articles.researchReviewRequired} or ${articles.researchApprovedHash} = ${reviewHashSql}))
  ) end)`;

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
  const twoStep = await twoStepArticles(executor);
  const [row] = await executor
    .select({
      approvedRevision: articles.approvedRevision,
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
  if (twoStep) {
    const sendable = sendableRevision(row);
    return sendable.ok ? { ok: true } : sendable;
  }
  return releaseCheckFor(row);
}

/**
 * The two-step flow's stored revision (articles.approved_revision): everything
 * that is delivered, and its hash.
 *
 *   source "approved"  - what the team last approved (approveArticle).
 *   source "published" - what stood on the website when the flow was switched
 *                        on (activateTwoStep). Nobody approved it, so only a
 *                        person's press sends it, as an update of the same post.
 *
 * While a working copy waits for the team this is what the customer reads and
 * what every path sends, so their edits stay private until approved. It is
 * replaced only by the next approval.
 */
export type StoredRevision = ReviewFields & {
  wordCount: number | null;
  hash: string;
  source: "approved" | "published";
  at: string;
};

export function revisionToStore(
  row: ReviewFields & { wordCount?: number | null },
  source: StoredRevision["source"],
  now: Date = new Date(),
): StoredRevision {
  return {
    title: row.title,
    slug: row.slug,
    metaDescription: row.metaDescription,
    bodyHtml: row.bodyHtml,
    imageUrl: row.imageUrl,
    imageAlt: row.imageAlt,
    wordCount: row.wordCount ?? null,
    hash: reviewHash(row),
    source,
    at: now.toISOString(),
  };
}

/** The stored revision, if it still is what its hash says. */
export function storedRevision(value: unknown): StoredRevision | null {
  if (!value || typeof value !== "object") return null;
  const stored = value as StoredRevision;
  if (typeof stored.title !== "string" || typeof stored.hash !== "string") return null;
  return reviewHash(stored) === stored.hash ? stored : null;
}

/**
 * Under the two-step flow: exactly which revision may go out now. The working
 * copy when the team approved it as it stands; otherwise the stored revision;
 * otherwise nothing. Every path sends what this returns and compares its hash
 * at the claim, so no approval can carry a different text.
 *
 * `automatic`: not a person's press. It never sends a revision nobody approved.
 */
export function sendableRevision(
  row: ReviewFields & {
    reviewStatus: string | null;
    reviewApprovedHash: string | null;
    researchReviewRequired?: boolean;
    researchApprovedHash?: string | null;
    approvedRevision?: unknown;
  },
  options: { automatic?: boolean } = {},
):
  | { ok: true; revision: ReviewFields; hash: string; from: "working_copy" | "stored" }
  | { ok: false; reason: "pending_review" | "changed_since_approval" } {
  const hash = reviewHash(row);
  const approved =
    row.reviewStatus === "approved" &&
    row.reviewApprovedHash === hash &&
    (!row.researchReviewRequired || row.researchApprovedHash === hash);
  if (approved) return { ok: true, revision: row, hash, from: "working_copy" };
  const stored = storedRevision(row.approvedRevision);
  if (stored && !(options.automatic && stored.source !== "approved")) {
    return { ok: true, revision: stored, hash: stored.hash, from: "stored" };
  }
  return { ok: false, reason: row.reviewStatus === "approved" ? "changed_since_approval" : "pending_review" };
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
 * every new draft comes to the RepGet team first, the customer reads none of
 * it until their one approval makes it ready - sources included - and the
 * customer only publishes.
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

/** True while the two-step flow is off; for queries that decide in SQL. */
export const twoStepOffSql: SQL = sql`not exists (
  select 1 from platform_controls pc where pc.key = 'two_step_articles' and pc.enabled
)`;

/**
 * THE CUSTOMER'S SIDE OF THE GATE, under the two-step flow: this working copy
 * is the team's until they approve it. Its text, title, excerpt, picture,
 * sources and links reach the customer by no read and no public output, and
 * they can change nothing in it. Live on the website or not.
 *
 * What they get instead is the stored revision, when there is one
 * (StoredRevision), or the topic from their own plan, or the translated fallback.
 *
 * The caller has read the switch (twoStepArticles): with the flow off nothing
 * is ever held from the customer.
 */
export function heldFromCustomer(row: ReviewFields & { status: string; reviewStatus: string | null; reviewApprovedHash: string | null }): boolean {
  if (row.reviewStatus === "pending") return true;
  return row.reviewStatus === "approved" && row.reviewApprovedHash !== reviewHash(row);
}

/**
 * The same rule in SQL, switch included. The hash is only taken for approved
 * rows, and never with the flow off.
 */
export const heldFromCustomerSql: SQL<boolean> = sql<boolean>`(case
  when ${twoStepOffSql} then false
  when ${articles.reviewStatus} = 'pending' then true
  when ${articles.reviewStatus} = 'approved' then ${articles.reviewApprovedHash} is distinct from ${reviewHashSql}
  else false
end)`;

/**
 * The title a customer's read may name, in SQL, for a query with articles in
 * scope. A held article's stored article title never appears: the stored
 * revision's, else the topic on the customer's own plan row (which neither
 * generation nor the team writes), else the marker the page translates.
 */
export const customerTitleSql: SQL<string> = sql<string>`(case
  when ${heldFromCustomerSql} then coalesce(
    ${articles.approvedRevision} ->> 'title',
    (select planned.title from ${calendarItems} planned where planned.id = ${articles.calendarItemId}),
    ${PREPARING_TITLE}
  )
  else ${articles.title}
end)`;

/** A delivered field as public outputs may use it: never a held working copy's. */
export function publicFieldSql(column: typeof articles.metaDescription | typeof articles.imageUrl, key: "metaDescription" | "imageUrl"): SQL<string | null> {
  return sql<string | null>`(case when ${heldFromCustomerSql} then ${articles.approvedRevision} ->> ${key} else ${column} end)`;
}

/** Held with nothing stored to show: public outputs leave such an article out. */
export const nothingToShowSql: SQL<boolean> = sql<boolean>`(${heldFromCustomerSql} and ${articles.approvedRevision} is null)`;

/** customerTitleSql for an article named by id, in raw queries that alias articles. */
export function customerTitleOf(id: SQL): SQL<string> {
  return sql<string>`(select ${customerTitleSql} from articles where articles.id = ${id})`;
}

/** False for an article named by id that is held with nothing stored to show. */
export function hasCustomerRevision(id: SQL): SQL<boolean> {
  return sql<boolean>`not exists (select 1 from articles where articles.id = ${id} and ${nothingToShowSql})`;
}

/** What the customer's status says for an article served from its stored revision. */
export function servedStatus(row: { publishedUrl: string | null; firstLiveAt: Date | null; status: string }): "published" | "draft" {
  return row.status === "published" || (row.publishedUrl && row.firstLiveAt) ? "published" : "draft";
}

/** The refusal for anything a customer tries on an article the team has. */
export const PREPARING_MESSAGE = "This article is being prepared by the RepGet team. You will be told when it is ready to publish.";

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
 * After an edit by the customer or in the general admin editor (text, title,
 * slug, excerpt, image).
 *
 * With the two-step flow off: syncApproval, as before - the article goes
 * back to the team's queue.
 *
 * With it on, every change to a revision the team approved goes back to the
 * TEAM. Their approval covers one exact revision, so it does not follow an
 * edit and no unreviewed text is released; and the customer is asked for
 * nothing: the team checks it and it comes back ready, with one new
 * notification. Until then the customer reads, and can publish, the stored
 * revision. Placed Partner Network links stay safe the same way, since
 * approval refuses an article whose placed link is missing. A save that
 * changed nothing keeps the approval. An article from before the flow goes to
 * the team on the same terms.
 *
 * Runs inside the edit's transaction, under the article's row lock
 * (editArticle in lib/publishing/dispatch.ts).
 */
export async function afterArticleEdit(articleId: string, executor: Executor = db): Promise<void> {
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
      approvedRevision: articles.approvedRevision,
    })
    .from(articles)
    .where(eq(articles.id, articleId))
    .limit(1);
  if (!row) return;
  const hash = reviewHash(row);
  if (row.reviewStatus === "approved" && row.reviewApprovedHash !== hash) {
    await invalidateApproval(articleId, executor);
  } else if (row.reviewStatus === null && storedRevision(row.approvedRevision)?.hash !== hash) {
    await sendToTeam(articleId, executor);
  }
}

/**
 * Hands an article outside the team's review to them, under the two-step flow.
 * Only a row still outside the review moves, so a second call does nothing.
 */
export async function sendToTeam(articleId: string, executor: Executor = db): Promise<void> {
  await executor
    .update(articles)
    .set({ reviewStatus: "pending", reviewVersion: sql`${articles.reviewVersion} + 1` })
    .where(and(eq(articles.id, articleId), isNull(articles.reviewStatus)));
}
