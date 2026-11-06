import { eq, sql, type SQL } from "drizzle-orm";

import { revisionToStore, reviewHashSql } from "@/lib/articles/review";
import { db } from "@/lib/db";
import { articles, networkSites, platformControls } from "@/lib/db/schema";
import type { Executor } from "@/lib/db/types";

/**
 * Operator switches read by every publishing path (see platform_controls in
 * the schema).
 *
 *   publication_freeze - nothing is sent to any customer site while enabled.
 *     Checked inside the dispatch claim (lib/publishing/dispatch.ts), so it
 *     also stops queued jobs, retries and the plugin feed, not only new
 *     requests. Enabling it takes FREEZE_LOCK exclusively; every claim holds
 *     it shared - so when enabling returns, no claim that read "not frozen"
 *     is still open. A send already admitted completes (it cannot be
 *     recalled): the operations page lists every attempt whose outcome is
 *     not yet known, and "drained" means none are left.
 *   managed_review     - new drafts on Partner Network websites enter the
 *     RepGet team's review only while enabled. Enabled by an operator once a
 *     deploy has finished, so no article is held while an older build that
 *     ignores review_status may still be serving. Enabling it also holds the
 *     drafts written since this build's migration while it was off
 *     (activateManagedReview), under REVIEW_LOCK, which the generation save
 *     step holds shared while it decides a draft's review state - so no
 *     draft slips between the two.
 *   two_step_articles  - the client's two-step article flow (2026-11-02, and
 *     the ticket of 2026-11-05; docs/two-step-articles.md):
 *     1. every new draft, on every website and on the free articles too,
 *        comes to the RepGet team first - they edit it, place links and
 *        check its sources - and the customer reads none of it until they
 *        approve (heldFromCustomer in lib/articles/review.ts);
 *     2. their ONE approval makes that exact revision ready. The customer
 *        has one Publish action and approves nothing, and a later change to
 *        the revision goes back to the team (afterArticleEdit).
 *        The first-article exception does not apply while it is on
 *        (isFirstArticle in lib/publishing/policy.ts). Automatic publishing
 *        the customer chose still runs, for approved articles only, on their
 *        day. Same lock as managed review; switching it on sorts what was
 *        written under the old rules (activateTwoStep).
 *
 * A missing row means disabled: a fresh database, or one a previous build
 * migrated, behaves exactly as before until an operator acts.
 */
export type ControlKey = "publication_freeze" | "managed_review" | "two_step_articles";

export const CONTROL_KEYS: ControlKey[] = ["publication_freeze", "managed_review", "two_step_articles"];

/** Advisory-lock keys: shared by claims / generation saves, exclusive by the switch. */
export const FREEZE_LOCK = sql`hashtext('repget:publication-freeze')`;
/** Also taken (shared) by reviewStatusForNewDraft in lib/articles/review.ts, by the same key. */
export const REVIEW_LOCK = sql`hashtext('repget:managed-review')`;

/**
 * Written by migration 0045: when this build's schema arrived. Drafts written
 * from then on are covered by managed-review activation; older drafts keep the
 * behaviour they were written under.
 */
export const REVIEW_CUTOVER_KEY = "managed_review_cutover";

export async function isControlEnabled(key: ControlKey, executor: Executor = db): Promise<boolean> {
  const [row] = await executor
    .select({ enabled: platformControls.enabled })
    .from(platformControls)
    .where(eq(platformControls.key, key))
    .limit(1);
  return row?.enabled ?? false;
}

export type ControlState = { key: ControlKey; enabled: boolean; reason: string | null; updatedBy: string | null; updatedAt: Date | null };

export async function readControls(executor: Executor = db): Promise<ControlState[]> {
  const rows = await executor.select().from(platformControls);
  return CONTROL_KEYS.map((key) => {
    const row = rows.find((r) => r.key === key);
    return {
      key,
      enabled: row?.enabled ?? false,
      reason: row?.reason ?? null,
      updatedBy: row?.updatedBy ?? null,
      updatedAt: row?.updatedAt ?? null,
    };
  });
}

/** Sets a switch. Callers authorize (lib/admin/network.ts) and audit. */
export async function writeControl(
  key: ControlKey,
  enabled: boolean,
  meta: { reason: string | null; actor: string },
  executor: Executor = db,
): Promise<void> {
  const now = new Date();
  await executor
    .insert(platformControls)
    .values({ key, enabled, reason: meta.reason, updatedBy: meta.actor, updatedAt: now })
    .onConflictDoUpdate({
      target: platformControls.key,
      set: { enabled, reason: meta.reason, updatedBy: meta.actor, updatedAt: now },
    });
}

/**
 * Sets a switch with the locks it needs - inside the caller's transaction,
 * which also writes the audit record.
 *
 *   freeze on - waits for every open claim (FREEZE_LOCK exclusive).
 *   review    - waits for every generation save deciding a review state
 *               (REVIEW_LOCK exclusive); switched on, it then holds for
 *               review the unpublished drafts written since the cutover on
 *               websites taking part in the network, and returns how many.
 *   two-step  - the same lock; switched on, it hands the team the drafts
 *               activateTwoStep describes, and returns how many.
 */
export async function switchControl(
  tx: Executor,
  key: ControlKey,
  enabled: boolean,
  meta: { reason: string | null; actor: string },
): Promise<{ heldForReview: number }> {
  if (key === "publication_freeze" && enabled) {
    await tx.execute(sql`select pg_advisory_xact_lock(${FREEZE_LOCK})`);
  }
  if (key === "managed_review" || key === "two_step_articles") {
    await tx.execute(sql`select pg_advisory_xact_lock(${REVIEW_LOCK})`);
  }
  await writeControl(key, enabled, meta, tx);
  if (!enabled) return { heldForReview: 0 };
  if (key === "managed_review") return { heldForReview: await activateManagedReview(tx) };
  if (key === "two_step_articles") return { heldForReview: await activateTwoStep(tx) };
  return { heldForReview: 0 };
}

/**
 * Switching the two-step flow on: what was written under the old rules is
 * sorted so that nothing goes out without the team, and nobody waits for an
 * approval the new flow no longer asks of them. Only never-delivered drafts
 * move to the queue, none in the middle of a delivery, and nothing is approved
 * or sent.
 *
 *  - Never approved by the team: to the team. Every path now checks approval.
 *  - Approved by the team earlier, but no longer standing - changed since, or
 *    waiting for the customer's source approval: back to the team.
 *
 * Staying as they are: articles the team approved as they stand (they keep their
 * date), and everything delivered or live. Those get their stored revision here
 * (see StoredRevision), from the row as it stands, so a later working copy stays
 * private and a post on a website always has a customer view:
 *
 *  - Approved as it stands, or from before the review: stored as approved or
 *    published.
 *  - Delivered with an approval that no longer matches: the old publish job wrote
 *    the CMS's picture address without re-hashing, so this is what the post is,
 *    with no change waiting. Stored as published and left outside the review,
 *    which grants nothing: only a press can resend it. It is not approved.
 *  - Delivered with a change waiting for the team: stored as unreviewed. It stays
 *    in their queue, and no path sends it.
 *
 * A press still recorded on a delivered article is cleared.
 *
 * The same sorting is counted, read-only, by scripts/two-step-transition-dry-run.mjs.
 */
export async function activateTwoStep(tx: Executor): Promise<number> {
  const notDelivering = sql`not exists (select 1 from publication_dispatches pd where pd.article_id = ${articles.id} and pd.status = 'in_flight')`;
  const waiting = await tx
    .update(articles)
    .set({ reviewStatus: "pending", reviewVersion: sql`${articles.reviewVersion} + 1` })
    .where(
      sql`${articles.reviewStatus} is null
        and ${articles.status} = 'draft'
        and ${articles.publishedUrl} is null
        and ${notDelivering}`,
    )
    .returning({ id: articles.id });
  const stale = await tx
    .update(articles)
    .set({
      reviewStatus: "pending",
      reviewApprovedAt: null,
      reviewApprovedBy: null,
      reviewApprovedHash: null,
      reviewVersion: sql`${articles.reviewVersion} + 1`,
    })
    .where(
      sql`${articles.reviewStatus} = 'approved'
        and ${articles.status} = 'draft'
        and ${articles.publishedUrl} is null
        and ${notDelivering}
        and (
          ${articles.reviewApprovedHash} is distinct from ${reviewHashSql}
          or (${articles.researchReviewRequired} and ${articles.researchApprovedHash} is distinct from ${reviewHashSql})
        )`,
    )
    .returning({ id: articles.id });

  const delivered = sql`(${articles.status} = 'published' or ${articles.publishedUrl} is not null)`;
  // A press left over from before the flow is not a press for what is approved now: the feed would act on it.
  await tx.update(articles).set({ publishRequested: null }).where(sql`${delivered} and ${articles.publishRequested} is not null`);
  const staleOnSite = await tx
    .select()
    .from(articles)
    .where(sql`${delivered} and ${articles.reviewStatus} = 'approved' and ${articles.reviewApprovedHash} is distinct from ${reviewHashSql}`);
  for (const row of staleOnSite) {
    await tx
      .update(articles)
      .set({
        reviewStatus: null,
        reviewApprovedHash: null,
        reviewVersion: sql`${articles.reviewVersion} + 1`,
        approvedRevision: revisionToStore(row, "published"),
      })
      .where(eq(articles.id, row.id));
  }

  const standing = await tx
    .select()
    .from(articles)
    .where(
      sql`(${articles.reviewStatus} = 'approved' and ${articles.reviewApprovedHash} = ${reviewHashSql})
        or (${articles.reviewStatus} is null and ${delivered})`,
    );
  for (const row of standing) {
    await tx
      .update(articles)
      .set({ approvedRevision: revisionToStore(row, row.reviewStatus === "approved" ? "approved" : "published") })
      .where(eq(articles.id, row.id));
  }

  // A stored revision from an earlier time with the flow on is kept: it is still the last approved one.
  const waitingOnSite = await tx
    .select()
    .from(articles)
    .where(sql`${delivered} and ${articles.reviewStatus} = 'pending' and ${articles.approvedRevision} is null`);
  for (const row of waitingOnSite) {
    await tx
      .update(articles)
      .set({ approvedRevision: revisionToStore(row, "unreviewed") })
      .where(eq(articles.id, row.id));
  }
  return waiting.length + stale.length;
}

/**
 * Drafts written while managed review was off - during the deploy, or by
 * work the previous build queued - on websites now in the Partner Network,
 * held for the RepGet team. Only drafts written since the cutover
 * (REVIEW_CUTOVER_KEY), never delivered, not already under review, and not
 * in the middle of a delivery.
 */
export async function activateManagedReview(tx: Executor): Promise<number> {
  const rows = await tx
    .update(articles)
    .set({ reviewStatus: "pending", reviewVersion: sql`${articles.reviewVersion} + 1` })
    .where(
      sql`${articles.reviewStatus} is null
        and ${articles.status} in ('draft', 'generating', 'queued')
        and ${articles.publishedUrl} is null
        and ${articles.createdAt} >= (select pc.updated_at from ${platformControls} pc where pc.key = ${REVIEW_CUTOVER_KEY})
        and exists (select 1 from ${networkSites} ns where ns.website_id = ${articles.websiteId} and ns.accepting_links)
        and not exists (select 1 from publication_dispatches pd where pd.article_id = ${articles.id} and pd.status = 'in_flight')`,
    )
    .returning({ id: articles.id });
  return rows.length;
}

/**
 * True while the freeze is on, for queries that pick articles to send: the
 * plugin feed and the scheduled release skip everything while frozen, so a
 * frozen system does not even hand work to the dispatch claim.
 */
export const notFrozenSql: SQL = sql`not exists (
  select 1 from platform_controls pc where pc.key = 'publication_freeze' and pc.enabled
)`;
