import { randomUUID } from "node:crypto";

import { and, desc, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";

import { plannedDayHasCome, releaseCheckFor, reviewHash } from "@/lib/articles/review";
import { db } from "@/lib/db";
import { articles, calendarItems, publicationDispatches, websites } from "@/lib/db/schema";
import type { Executor } from "@/lib/db/types";
import { FREEZE_LOCK, isControlEnabled } from "@/lib/publishing/controls";
import { ownershipMarker } from "@/lib/publishing/ownership";
import { automaticStatus, FIRST_ARTICLE_STATUS, isFirstArticle } from "@/lib/publishing/policy";

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
 * uncertain), or after IN_FLIGHT_TIMEOUT_MS if the process died or the
 * plugin never reported. A LEASE RUNNING OUT IS NOT COMPLETION: the outcome
 * is unknown, and the row says so -
 *   - a direct create becomes "uncertain": nothing is created for the
 *     article again until the post is FOUND by this dispatch's own marker
 *     (lib/publishing/ownership.ts) or a person decides, audited;
 *   - a plugin hand-over becomes "expired": the plugin may still report it,
 *     and that report settles exactly this row (lib/publishing/acknowledge.ts).
 *     A 1.6.0+ plugin echoes the dispatch id, so a newer revision may be
 *     handed out meanwhile. An older plugin does not, so for it at most ONE
 *     revision is outstanding per article: the same revision is re-offered
 *     under the same dispatch, a different one waits for the report (or an
 *     operator's audited release).
 *
 * WHAT IS CHECKED, AT EVERY ATTEMPT (retries included):
 *   - the publication freeze (lib/publishing/controls.ts), under a shared
 *     advisory lock that enabling the freeze takes exclusively - so once
 *     enabling returns, no claim that read "not frozen" is still open;
 *   - the article still exists and has content;
 *   - the review gate: approved, and exactly the approved revision;
 *   - the exact revision the caller prepared (expectedRevision);
 *   - the schedule rules for WHY it is being sent (trigger): an automatic
 *     release needs auto-publish still on and its planned day come; the
 *     first-article exception only while it is still the first article; a
 *     Publish press is the customer's own decision and has no date rule;
 *   - the STATUS it goes out as, from the settings NOW (publish_as,
 *     auto_publish, the first-article rule), not from when it was queued -
 *     only a Publish press carries its own.
 *
 * WHAT IS RECORDED BEFORE ANYTHING IS SENT: the dispatch's identity (its
 * id, the article, the website, the direct integration or the plugin
 * protocol) and a request snapshot (title, slug, status, revision, the
 * ownership marker). Reconciling an old dispatch reads these - never the
 * article's current, editable fields.
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
  | "plugin"
  /**
   * An event queued by a build before triggers existed. Its reason is
   * unknown, so it gets the STRICT rule - the automatic one (or the
   * first-article rule while it is the first article) - never a Publish
   * press's. A customer whose press was queued by that build and is held
   * presses again.
   */
  | "legacy";

/**
 * direct - RepGet sent it to the CMS itself.
 * plugin_v2 - handed to a 1.6.0+ plugin, which echoes the dispatch id.
 * plugin_legacy - handed to an older plugin, which reports by article only.
 */
export type DispatchProtocol = "direct" | "plugin_v2" | "plugin_legacy";

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
  | "uncertain_previous"
  | "awaiting_plugin";

export type ClaimedArticle = {
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

export type Claim =
  | {
      ok: true;
      dispatchId: string;
      revisionHash: string;
      /** The CMS status this dispatch goes out as, decided at the claim. */
      status: "publish" | "draft";
      /** The ownership marker recorded for this dispatch; direct sends carry it. */
      marker: string;
      /** A legacy plugin's expired hand-over of this same revision, offered again under its own id. */
      reused: boolean;
      /** The revision as locked and checked: exactly what may be sent. */
      article: ClaimedArticle;
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

/** Statuses of a plugin hand-over that was never acknowledged ("abandoned": rows before 0045). */
export const UNACKNOWLEDGED = ["expired", "abandoned"] as const;

/**
 * Test hook: runs inside the claim right after the freeze was read, while
 * the claim still holds its locks. The concurrency tests park a claim here to
 * prove that enabling the freeze waits for it. Never set outside tests.
 */
export const dispatchTestHooks: { afterFreezeCheck?: (articleId: string) => Promise<void> } = {};

/**
 * The in-flight dispatch for an article, if one is live. A stale one is
 * settled first - uncertain (direct) or expired (plugin) - so it no longer
 * blocks edits. Neither means it completed.
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
    .set(
      row.channel === "plugin"
        ? { status: "expired", error: "The plugin did not acknowledge this hand-over before its lease ran out" }
        : { status: "uncertain", error: "No outcome recorded before the in-flight timeout", completedAt: now },
    )
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
  publishAs: string;
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
    case "legacy":
      // No longer the first article (another went first): the ordinary rule.
      return row.isFirst ? first() : automatic();
    case "plugin":
      if (row.isFirst) return first();
      if (row.publishRequested === "publish" || row.publishRequested === "draft") return null;
      return automatic();
  }
}

/**
 * The CMS status for this send, from the settings as they are NOW. Only a
 * Publish press (the direct job's "manual", or the plugin's recorded press)
 * chooses its own; everything else follows the current "Publish as", and the
 * first article is always live (lib/publishing/policy.ts).
 */
export function effectiveStatus(
  trigger: DispatchTrigger,
  row: Pick<Locked, "autoPublish" | "publishAs" | "publishRequested" | "isFirst">,
  requested: "publish" | "draft" | undefined,
): "publish" | "draft" {
  switch (trigger) {
    case "manual":
      return requested ?? "publish";
    case "plugin":
      if (row.isFirst) return FIRST_ARTICLE_STATUS;
      if (row.publishRequested === "publish" || row.publishRequested === "draft") return row.publishRequested;
      return automaticStatus(row);
    case "automatic":
      return automaticStatus(row);
    case "first_article":
    case "connection":
    case "approval":
    case "legacy":
      return row.isFirst ? FIRST_ARTICLE_STATUS : automaticStatus(row);
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
  /** What a Publish press asked for. Ignored for every other trigger: see effectiveStatus. */
  requestedStatus?: "publish" | "draft";
  /** Defaults to "direct" for the direct channel, "plugin_legacy" for the plugin. */
  protocol?: DispatchProtocol;
  /** The direct integration this goes to, recorded so reconciliation asks the same site. */
  integrationId?: string | null;
  expectedRevision?: string | null;
  owner?: string | null;
  /** Direct creates only: refuse while an earlier create's outcome is unknown. */
  refuseAfterUncertain?: boolean;
  now?: Date;
}): Promise<Claim> {
  const now = input.now ?? new Date();
  const protocol: DispatchProtocol = input.protocol ?? (input.channel === "direct" ? "direct" : "plugin_legacy");
  return db.transaction(async (tx) => {
    /*
      Shared with every other claim, exclusive with enabling the freeze
      (lib/publishing/controls.ts): the freeze cannot be switched on while
      a claim that has read "not frozen" is still open, so once enabling it
      returns, nothing more can be admitted.
    */
    await tx.execute(sql`select pg_advisory_xact_lock_shared(${FREEZE_LOCK})`);
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
        publishAs: websites.publishAs,
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
    if (dispatchTestHooks.afterFreezeCheck) await dispatchTestHooks.afterFreezeCheck(row.id);
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

    const status = effectiveStatus(input.trigger, row, input.requestedStatus);

    /*
      The same revision, with the same status, already reached the site: a
      second request for it (a Publish press repeated, a release that raced
      another path) sends nothing. A NEW revision of a published article is
      an update and goes out. A late report of an OLDER hand-over is history,
      not the current delivery.
    */
    const [lastSent] = await tx
      .select({ revisionHash: publicationDispatches.revisionHash, requestedStatus: publicationDispatches.requestedStatus })
      .from(publicationDispatches)
      .where(and(eq(publicationDispatches.articleId, row.id), eq(publicationDispatches.status, "sent"), eq(publicationDispatches.late, false)))
      .orderBy(desc(publicationDispatches.claimedAt))
      .limit(1);
    if (lastSent && lastSent.revisionHash === revisionHash && lastSent.requestedStatus === status) {
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

    const article: ClaimedArticle = {
      id: row.id,
      title: row.title,
      slug: row.slug,
      metaDescription: row.metaDescription,
      bodyHtml: row.bodyHtml,
      imageUrl: row.imageUrl,
      imageAlt: row.imageAlt,
      publishRequested: row.publishRequested,
      isFirst: row.isFirst,
    };

    /*
      An older plugin reports by article id only, so its report cannot say
      WHICH hand-over it answers. One revision outstanding at a time: the
      same revision (and status) is offered again under the SAME dispatch, so
      whichever copy it reports settles the right row; a different revision
      waits until the outstanding one is reported or released.
    */
    if (protocol === "plugin_legacy") {
      const [outstanding] = await tx
        .select()
        .from(publicationDispatches)
        .where(
          and(
            eq(publicationDispatches.articleId, row.id),
            eq(publicationDispatches.channel, "plugin"),
            or(eq(publicationDispatches.protocol, "plugin_legacy"), isNull(publicationDispatches.protocol)),
            inArray(publicationDispatches.status, [...UNACKNOWLEDGED]),
          ),
        )
        .orderBy(desc(publicationDispatches.claimedAt))
        .limit(1);
      if (outstanding) {
        if (outstanding.revisionHash !== revisionHash || outstanding.requestedStatus !== status) {
          return { ok: false, reason: "awaiting_plugin" } as const;
        }
        await tx
          .update(publicationDispatches)
          .set({ status: "in_flight", claimedAt: now, owner: input.owner ?? null, error: null, completedAt: null })
          .where(eq(publicationDispatches.id, outstanding.id));
        return {
          ok: true,
          dispatchId: outstanding.id,
          revisionHash,
          status,
          marker: ownershipMarker({ articleId: row.id, websiteId: input.websiteId, dispatchId: outstanding.id }),
          reused: true,
          article,
        } as const;
      }
    }

    // The identity, and what is about to be sent, recorded BEFORE sending.
    const dispatchId = randomUUID();
    const marker = ownershipMarker({ articleId: row.id, websiteId: input.websiteId, dispatchId });
    await tx.insert(publicationDispatches).values({
      id: dispatchId,
      articleId: row.id,
      websiteId: input.websiteId,
      channel: input.channel,
      trigger: input.trigger,
      revisionHash,
      requestedStatus: status,
      status: "in_flight",
      owner: input.owner ?? null,
      protocol,
      integrationId: input.integrationId ?? null,
      requestSnapshot: {
        title: row.title,
        slug: row.slug,
        status,
        revisionHash,
        marker,
        publishRequested: row.publishRequested,
      },
      claimedAt: now,
    });

    return { ok: true, dispatchId, revisionHash, status, marker, reused: false, article } as const;
  });
}

/** Records the outcome. Only an in-flight row moves; a second call is a no-op. */
export async function settleDispatch(
  dispatchId: string,
  outcome:
    | { status: "sent"; remoteId?: string | null; remoteUrl?: string | null; remoteStatus?: string | null }
    | { status: "failed" | "uncertain"; error: string },
  executor: Executor = db,
): Promise<boolean> {
  const rows = await executor
    .update(publicationDispatches)
    .set(
      outcome.status === "sent"
        ? {
            status: "sent",
            remoteId: outcome.remoteId ?? null,
            remoteUrl: outcome.remoteUrl ?? null,
            remoteStatus: outcome.remoteStatus ?? null,
            completedAt: new Date(),
          }
        : { status: outcome.status, error: outcome.error.slice(0, 500), completedAt: new Date() },
    )
    .where(and(eq(publicationDispatches.id, dispatchId), eq(publicationDispatches.status, "in_flight")))
    .returning({ id: publicationDispatches.id });
  return rows.length > 0;
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
 * Settles an uncertain direct send. `sent`: the post was FOUND by this
 * dispatch's own marker, or a person identified it. `failed`: ONLY a person
 * can say the post does not exist - an empty lookup is not proof. Every call
 * records who decided and why; only an uncertain row moves.
 */
export async function reconcileUncertain(
  dispatchId: string,
  outcome:
    | { status: "sent"; remoteId: string; remoteUrl: string; remoteStatus?: string | null }
    | { status: "failed"; error: string },
  audit: { by: string; note: string },
  executor: Executor = db,
): Promise<boolean> {
  const now = new Date();
  const who = { reconciledBy: audit.by.slice(0, 200), reconciledAt: now, reconcileNote: audit.note.slice(0, 500) };
  const rows = await executor
    .update(publicationDispatches)
    .set(
      outcome.status === "sent"
        ? { status: "sent", remoteId: outcome.remoteId, remoteUrl: outcome.remoteUrl, remoteStatus: outcome.remoteStatus ?? null, completedAt: now, ...who }
        : { status: "failed", error: outcome.error.slice(0, 500), completedAt: now, ...who },
    )
    .where(and(eq(publicationDispatches.id, dispatchId), eq(publicationDispatches.status, "uncertain")))
    .returning({ id: publicationDispatches.id });
  return rows.length > 0;
}

/** Records one ownership lookup for an uncertain send. It stays uncertain. */
export async function recordLookup(
  dispatchId: string,
  result: "none" | "ambiguous" | "unverifiable" | "error",
  executor: Executor = db,
): Promise<number> {
  const [row] = await executor
    .update(publicationDispatches)
    .set({ lookupAttempts: sql`${publicationDispatches.lookupAttempts} + 1`, lastLookupAt: new Date(), lookupResult: result })
    .where(eq(publicationDispatches.id, dispatchId))
    .returning({ attempts: publicationDispatches.lookupAttempts });
  return row?.attempts ?? 0;
}

/** True when a newer dispatch of the same article exists: a report for this one is late. */
export async function hasNewerDispatch(
  executor: Executor,
  dispatch: { id: string; articleId: string; claimedAt: Date },
): Promise<boolean> {
  const [newer] = await executor
    .select({ id: publicationDispatches.id })
    .from(publicationDispatches)
    .where(and(eq(publicationDispatches.articleId, dispatch.articleId), gt(publicationDispatches.claimedAt, dispatch.claimedAt)))
    .limit(1);
  return Boolean(newer);
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
  awaiting_plugin:
    "The WordPress plugin has not reported the previous delivery yet. Updating the plugin to 1.6.0 or later removes this wait.",
};
