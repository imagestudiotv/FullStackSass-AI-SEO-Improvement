import { and, desc, eq, sql } from "drizzle-orm";

import { plannedDayHasCome, releaseCheckFor, reviewHash } from "@/lib/articles/review";
import { db } from "@/lib/db";
import { articles, calendarItems, publicationDispatches, websites } from "@/lib/db/schema";
import type { Executor } from "@/lib/db/types";
import { isControlEnabled } from "@/lib/publishing/controls";
import { isFirstArticle } from "@/lib/publishing/policy";

/**
 * THE DISPATCH BOUNDARY: the last check before an article revision leaves
 * RepGet for a customer's site, on every path and every attempt.
 *
 * WHY A CLAIM AND NOT ANOTHER SELECT. The publish job used to check the
 * review gate while PREPARING (a persisted step), upload the image, and then
 * send the prepared copy - so an approval withdrawn, or an edit saved, during
 * the image upload or before a retry still went out. Checking again just
 * before sending narrows that window but does not close it: an edit can land
 * between the check and the request. So the check and the "this revision is
 * now going out" record are one transaction that holds the article's row
 * lock, and every edit path takes the same lock and refuses while a dispatch
 * is in flight (lockForEdit). Whichever commits first wins, and the other
 * sees it:
 *
 *   edit first  - the claim sees the new revision, which no longer matches
 *                 what was prepared (or approved), and holds;
 *   claim first - the revision is IN FLIGHT and the edit is refused with a
 *                 clear message until the outcome is recorded.
 *
 * IN FLIGHT means: the request may reach the site at any moment and cannot
 * be recalled. It ends when the outcome is recorded (sent / failed /
 * uncertain), or after IN_FLIGHT_TIMEOUT_MS if the process died - then the
 * outcome is unknown: a direct create becomes "uncertain" and is reconciled
 * before anything is created again; a plugin hand-over becomes "abandoned"
 * and is simply offered again, because the plugin finds its own earlier post
 * by article id and updates it instead of creating another.
 *
 * WHAT IS CHECKED, AT EVERY ATTEMPT (retries included):
 *   - the publication freeze (lib/publishing/controls.ts);
 *   - the article still exists and has content;
 *   - the review gate: approved, and exactly the approved revision;
 *   - the exact revision the caller prepared (expectedRevision);
 *   - the schedule rules for WHY it is being sent (trigger): an automatic
 *     release needs auto-publish still on and its planned day come; the
 *     first-article exception only while it is still the first article; a
 *     Publish press is the customer's own decision and has no date rule.
 */

export type DispatchChannel = "direct" | "plugin";

/**
 * Why a revision is being sent. Carried on the publish event so the rules at
 * dispatch are the rules of the path that queued it.
 */
export type DispatchTrigger =
  | "manual"
  | "automatic"
  | "first_article"
  | "approval"
  | "connection"
  | "plugin";

/** A claim older than this with no recorded outcome is presumed dead. */
export const IN_FLIGHT_TIMEOUT_MS = 10 * 60 * 1000;

export type HoldReason =
  | "not_found"
  | "no_content"
  | "frozen"
  | "pending_review"
  | "changed_since_approval"
  | "revision_changed"
  | "not_due"
  | "auto_publish_off"
  | "in_flight"
  | "already_sent"
  | "uncertain_previous";

export type Claim =
  | {
      ok: true;
      dispatchId: string;
      revisionHash: string;
      /** The revision as locked and checked: exactly what may be sent. */
      article: {
        id: string;
        title: string;
        slug: string | null;
        metaDescription: string | null;
        bodyHtml: string;
        imageUrl: string | null;
        imageAlt: string | null;
        publishRequested: string | null;
        isFirst: boolean;
      };
    }
  | { ok: false; reason: HoldReason };

export class ArticleInFlightError extends Error {
  constructor() {
    super(
      "This article is being delivered to the website right now and cannot be changed until that finishes. Try again in a minute.",
    );
    this.name = "ArticleInFlightError";
  }
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function staleBefore(now: Date): Date {
  return new Date(now.getTime() - IN_FLIGHT_TIMEOUT_MS);
}

/**
 * The in-flight dispatch for an article, if one is live. A stale one is
 * settled first (uncertain / abandoned) so it no longer blocks.
 */
async function liveInFlight(tx: Executor, articleId: string, now: Date) {
  const [row] = await tx
    .select()
    .from(publicationDispatches)
    .where(and(eq(publicationDispatches.articleId, articleId), eq(publicationDispatches.status, "in_flight")))
    .limit(1);
  if (!row) return null;
  if (row.claimedAt > staleBefore(now)) return row;
  await tx
    .update(publicationDispatches)
    .set({
      status: row.channel === "plugin" ? "abandoned" : "uncertain",
      error: "No outcome recorded before the in-flight timeout",
      completedAt: now,
    })
    .where(and(eq(publicationDispatches.id, row.id), eq(publicationDispatches.status, "in_flight")));
  return null;
}

/**
 * Every write to what an article delivers (text, title, slug, excerpt,
 * image, links, review state) calls this first, inside its transaction:
 * it takes the article's row lock - the one the dispatch claim takes - and
 * refuses while a revision is in flight.
 */
export async function lockForEdit(tx: Executor, articleId: string, now: Date = new Date()): Promise<void> {
  await tx.execute(sql`select id from articles where id = ${articleId} for update`);
  if (await liveInFlight(tx, articleId, now)) throw new ArticleInFlightError();
}

/**
 * A quick look, without a lock, for refusing EXPENSIVE work (a paid image)
 * up front. Not a guarantee - the write itself still goes through lockForEdit.
 */
export async function isInFlight(articleId: string, now: Date = new Date()): Promise<boolean> {
  const [row] = await db
    .select({ claimedAt: publicationDispatches.claimedAt })
    .from(publicationDispatches)
    .where(and(eq(publicationDispatches.articleId, articleId), eq(publicationDispatches.status, "in_flight")))
    .limit(1);
  return Boolean(row && row.claimedAt > staleBefore(now));
}

/** lockForEdit plus the edit, in one transaction. */
export async function editArticle<T>(articleId: string, edit: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await lockForEdit(tx, articleId);
    return edit(tx);
  });
}

type Locked = {
  id: string;
  title: string;
  slug: string | null;
  metaDescription: string | null;
  bodyHtml: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  reviewStatus: string | null;
  reviewApprovedHash: string | null;
  publishRequested: string | null;
  autoPublish: boolean;
  scheduledFor: Date | null;
  isFirst: boolean;
};

/** The schedule rule for why this revision is being sent. */
export function scheduleAllows(trigger: DispatchTrigger, row: Locked, now: Date = new Date()): HoldReason | null {
  const automatic = (): HoldReason | null => {
    if (!row.autoPublish) return "auto_publish_off";
    if (!plannedDayHasCome(row.scheduledFor, now)) return "not_due";
    return null;
  };
  // The first-article exception: live at once - but a reviewed article
  // never before its planned day (lib/articles/review.ts, rule 3).
  const first = (): HoldReason | null =>
    row.reviewStatus !== null && !plannedDayHasCome(row.scheduledFor, now) ? "not_due" : null;

  switch (trigger) {
    case "manual":
      return null;
    case "automatic":
      return automatic();
    case "first_article":
    case "connection":
    case "approval":
      // No longer the first article (another went first): the ordinary rule.
      return row.isFirst ? first() : automatic();
    case "plugin":
      if (row.isFirst) return first();
      if (row.publishRequested === "publish" || row.publishRequested === "draft") return null;
      return automatic();
  }
}

/**
 * Claims the right to send this article's CURRENT revision, or says why not.
 *
 * `expectedRevision`: the reviewHash the caller prepared. When the article
 * has changed since, the claim fails with revision_changed - the caller must
 * prepare again rather than send what it has.
 */
export async function claimDispatch(input: {
  articleId: string;
  websiteId: string;
  channel: DispatchChannel;
  trigger: DispatchTrigger;
  requestedStatus: "publish" | "draft";
  expectedRevision?: string | null;
  owner?: string | null;
  /** Direct creates only: refuse while an earlier create's outcome is unknown. */
  refuseAfterUncertain?: boolean;
  now?: Date;
}): Promise<Claim> {
  const now = input.now ?? new Date();
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({
        id: articles.id,
        title: articles.title,
        slug: articles.slug,
        metaDescription: articles.metaDescription,
        bodyHtml: articles.bodyHtml,
        imageUrl: articles.imageUrl,
        imageAlt: articles.imageAlt,
        reviewStatus: articles.reviewStatus,
        reviewApprovedHash: articles.reviewApprovedHash,
        publishRequested: articles.publishRequested,
        autoPublish: websites.autoPublish,
        scheduledFor: calendarItems.scheduledFor,
        isFirst: sql<boolean>`coalesce((${isFirstArticle}), false)`,
      })
      .from(articles)
      .innerJoin(websites, eq(websites.id, articles.websiteId))
      .leftJoin(calendarItems, eq(calendarItems.id, articles.calendarItemId))
      .where(and(eq(articles.id, input.articleId), eq(articles.websiteId, input.websiteId)))
      .for("update", { of: articles })
      .limit(1);
    if (!row) return { ok: false, reason: "not_found" } as const;

    if (await isControlEnabled("publication_freeze", tx)) return { ok: false, reason: "frozen" } as const;
    if (!row.bodyHtml) return { ok: false, reason: "no_content" } as const;

    const gate = releaseCheckFor(row);
    if (!gate.ok) return { ok: false, reason: gate.reason === "not_found" ? "not_found" : gate.reason } as const;

    const revisionHash = reviewHash(row);
    if (input.expectedRevision && input.expectedRevision !== revisionHash) {
      return { ok: false, reason: "revision_changed" } as const;
    }

    const schedule = scheduleAllows(input.trigger, row, now);
    if (schedule) return { ok: false, reason: schedule } as const;

    if (await liveInFlight(tx, row.id, now)) return { ok: false, reason: "in_flight" } as const;

    /*
      The same revision, with the same requested status, already reached the
      site: a second request for it (a Publish press repeated, a release that
      raced another path) sends nothing. A NEW revision of a published
      article is an update and goes out.
    */
    const [lastSent] = await tx
      .select({ revisionHash: publicationDispatches.revisionHash, requestedStatus: publicationDispatches.requestedStatus })
      .from(publicationDispatches)
      .where(and(eq(publicationDispatches.articleId, row.id), eq(publicationDispatches.status, "sent")))
      .orderBy(desc(publicationDispatches.claimedAt))
      .limit(1);
    if (lastSent && lastSent.revisionHash === revisionHash && lastSent.requestedStatus === input.requestedStatus) {
      return { ok: false, reason: "already_sent" } as const;
    }

    if (input.refuseAfterUncertain) {
      const [last] = await tx
        .select({ status: publicationDispatches.status })
        .from(publicationDispatches)
        .where(and(eq(publicationDispatches.articleId, row.id), eq(publicationDispatches.channel, "direct")))
        .orderBy(desc(publicationDispatches.claimedAt))
        .limit(1);
      if (last?.status === "uncertain") return { ok: false, reason: "uncertain_previous" } as const;
    }

    const [claimed] = await tx
      .insert(publicationDispatches)
      .values({
        articleId: row.id,
        websiteId: input.websiteId,
        channel: input.channel,
        trigger: input.trigger,
        revisionHash,
        requestedStatus: input.requestedStatus,
        status: "in_flight",
        owner: input.owner ?? null,
        claimedAt: now,
      })
      .returning({ id: publicationDispatches.id });

    return {
      ok: true,
      dispatchId: claimed.id,
      revisionHash,
      article: {
        id: row.id,
        title: row.title,
        slug: row.slug,
        metaDescription: row.metaDescription,
        bodyHtml: row.bodyHtml,
        imageUrl: row.imageUrl,
        imageAlt: row.imageAlt,
        publishRequested: row.publishRequested,
        isFirst: row.isFirst,
      },
    } as const;
  });
}

/** Records the outcome. Only an in-flight row moves; a second call is a no-op. */
export async function settleDispatch(
  dispatchId: string,
  outcome:
    | { status: "sent"; remoteId?: string | null; remoteUrl?: string | null }
    | { status: "failed" | "uncertain"; error: string },
  executor: Executor = db,
): Promise<boolean> {
  const rows = await executor
    .update(publicationDispatches)
    .set(
      outcome.status === "sent"
        ? { status: "sent", remoteId: outcome.remoteId ?? null, remoteUrl: outcome.remoteUrl ?? null, completedAt: new Date() }
        : { status: outcome.status, error: outcome.error.slice(0, 500), completedAt: new Date() },
    )
    .where(and(eq(publicationDispatches.id, dispatchId), eq(publicationDispatches.status, "in_flight")))
    .returning({ id: publicationDispatches.id });
  return rows.length > 0;
}

/**
 * The plugin reported what it did with an article: settles that article's
 * in-flight plugin hand-over. Called by /api/plugin/published.
 */
export async function settlePluginDispatch(
  articleId: string,
  outcome: { status: "sent"; remoteId?: string | null; remoteUrl?: string | null } | { status: "failed"; error: string },
  executor: Executor = db,
): Promise<void> {
  const [row] = await executor
    .select({ id: publicationDispatches.id })
    .from(publicationDispatches)
    .where(
      and(
        eq(publicationDispatches.articleId, articleId),
        eq(publicationDispatches.channel, "plugin"),
        eq(publicationDispatches.status, "in_flight"),
      ),
    )
    .limit(1);
  if (row) await settleDispatch(row.id, outcome, executor);
}

/** The latest direct dispatch whose outcome is unknown, if that is the latest. */
export async function latestUncertain(articleId: string, executor: Executor = db) {
  const [last] = await executor
    .select()
    .from(publicationDispatches)
    .where(and(eq(publicationDispatches.articleId, articleId), eq(publicationDispatches.channel, "direct")))
    .orderBy(desc(publicationDispatches.claimedAt))
    .limit(1);
  return last?.status === "uncertain" ? last : null;
}

/**
 * Settles an uncertain direct send after reconciliation: `sent` when the post
 * was found on the site, `failed` when it provably does not exist (a lookup
 * that found nothing, or the customer checked and confirmed it).
 */
export async function reconcileUncertain(
  dispatchId: string,
  outcome: { status: "sent"; remoteId: string; remoteUrl: string } | { status: "failed"; error: string },
  executor: Executor = db,
): Promise<boolean> {
  const rows = await executor
    .update(publicationDispatches)
    .set(
      outcome.status === "sent"
        ? { status: "sent", remoteId: outcome.remoteId, remoteUrl: outcome.remoteUrl, completedAt: new Date() }
        : { status: "failed", error: outcome.error.slice(0, 500), completedAt: new Date() },
    )
    .where(and(eq(publicationDispatches.id, dispatchId), eq(publicationDispatches.status, "uncertain")))
    .returning({ id: publicationDispatches.id });
  return rows.length > 0;
}

/**
 * Articles with a live (not stale) in-flight dispatch are not offered again.
 * For the plugin feed's due query.
 */
export const notInFlightSql = sql`not exists (
  select 1 from publication_dispatches pd
  where pd.article_id = ${articles.id}
    and pd.status = 'in_flight'
    and pd.claimed_at > timezone('utc', now()) - make_interval(secs => ${IN_FLIGHT_TIMEOUT_MS / 1000})
)`;

/** Plain-language reason for a hold, for logs and the article page. */
export const HOLD_MESSAGES: Record<HoldReason, string> = {
  not_found: "The article no longer exists.",
  no_content: "The article has no content.",
  frozen: "Publishing is paused by the RepGet team.",
  pending_review: "Held for the RepGet team's review.",
  changed_since_approval: "Changed since the RepGet team approved it - held for review again.",
  revision_changed: "The article changed while it was being prepared; it will be prepared again.",
  not_due: "Not due yet - it goes out on its planned day.",
  auto_publish_off: "Automatic publishing is off for this website.",
  in_flight: "Already being delivered.",
  already_sent: "This exact version is already on the website.",
  uncertain_previous:
    "An earlier attempt got no answer from the site, so the post may already exist. Check the site before publishing again.",
};
