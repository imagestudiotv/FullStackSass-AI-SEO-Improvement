import { and, desc, eq, gt, inArray, ne } from "drizzle-orm";

import { notifyDraftRefused } from "@/lib/articles/release";
import { DRAFT_REFUSALS, type DraftRefusal } from "@/lib/articles/review";
import { db } from "@/lib/db";
import { articles, publicationDispatches, publishLogs } from "@/lib/db/schema";
import { settleDispatch } from "@/lib/publishing/dispatch";
import type { CmsProvider, Credentials, RemoteBaseline, RemoteState } from "@/lib/publishing/provider";

/**
 * Before a direct connection updates a post that is already on the website:
 * has somebody changed it since RepGet last sent it? A press used to replace it
 * regardless. The plugin decides this on the site, with a compare-and-swap at
 * the database (repget_overwrite_post in the plugin). From here that cannot be
 * done, and what can be done differs by platform:
 *
 *   Ghost     Read, compared with the baseline, then its own optimistic lock: the
 *             PUT carries the updated_at just read, and Ghost refuses the request
 *             when that is not what it holds. The comparison is on Ghost's side.
 *             Its timestamps have a resolution of a second.
 *   WordPress No precondition exists in the REST API (no If-Match).
 *   Shopify   None in the REST Admin API.
 *   Webflow   None documented for an item.
 *   Wix       None this code can rely on.
 *             These four are CHECK, THEN WRITE, AND NOT ATOMIC. A save landing
 *             between the read and the write, a window of one request's length,
 *             is replaced. WordPress keeps it as a revision where revisions are on.
 *   Webhook   RepGet can only post to it, never read it, so nothing can show a
 *             post there is unchanged. Every update is refused.
 *
 * Nor is anything here aware of somebody with the post open and unsaved, on any
 * platform: they save after this, and theirs replaces this update.
 *
 * WHAT "UNCHANGED" MEANS. What the platform returned when RepGet last sent the
 * post is kept with that send (request_snapshot.remoteBaseline): its last-saved
 * time and a hash of what a reader sees. The post is unchanged if either still
 * matches. The hash alone lets a Save with no change through. The time alone covers
 * a platform whose answer to a write is shaped differently from its answer to a
 * read, where the hash would differ for ever and no update could go out; the cost
 * is that an edit within the same second as the send is not seen.
 *
 * A POST SENT BEFORE BASELINES EXISTED has only the time of that send: unchanged
 * if the platform's last-saved time is no later than that, plus
 * SEND_TIME_TOLERANCE_MS for the send itself and for clocks. An edit within that
 * tolerance is not seen. Anything else that moves the time counts as a change, a
 * plugin touching the post or a Save with no change, and is refused: the safe
 * direction. With no time from the platform either, it cannot be shown: refused.
 *
 * A RETRY AFTER A LOST ANSWER. The send itself changes the post, so a retry finds
 * it differs from the baseline, by its own hand. An attempt recorded as possibly
 * landed covers this if the post's last-saved time falls within that attempt
 * (plus the tolerance) and, where the platform keeps RepGet's marker in the
 * stored content (WordPress), it carries that attempt's marker. An edit made in
 * that same stretch on a platform without a marker is not seen.
 *
 * With the two-step switch on or off alike: this is about the customer's site,
 * not the flow.
 */
export const SEND_TIME_TOLERANCE_MS = 2 * 60 * 1000;

export type OverwriteRefusal = Extract<DraftRefusal, "post_changed" | "post_unverified" | "update_trashed" | "update_deleted" | "update_unavailable">;

export type UpdateVerdict =
  | { ok: true; expectedModifiedAt: string | null; because: "unchanged" | "own_unanswered_send" | "not_saved_since_send" }
  | { ok: false; refusal: OverwriteRefusal };

/** An earlier attempt at this update whose answer never came. */
export type UnansweredAttempt = { marker: string | null; claimedAt: Date; completedAt: Date | null };

/** A platform's time. WordPress's modified_gmt has no zone, and is UTC. */
function timeOf(value: string | null): number | null {
  if (!value) return null;
  const at = Date.parse(/(z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : `${value}Z`);
  return Number.isNaN(at) ? null : at;
}

export function judgeUpdate(input: {
  remote: RemoteState | null;
  baseline: RemoteBaseline | null;
  sentAt: Date | null;
  unanswered: UnansweredAttempt[];
}): UpdateVerdict {
  const { remote, baseline, sentAt, unanswered } = input;
  if (!remote) return { ok: false, refusal: "update_deleted" };
  if (remote.status === "trash") return { ok: false, refusal: "update_trashed" };

  const modified = timeOf(remote.modifiedAt);
  const expectedModifiedAt = remote.modifiedAt;
  const hasBaseline = Boolean(baseline && (baseline.hash || baseline.modifiedAt));
  if (baseline && hasBaseline) {
    const sameHash = Boolean(baseline.hash && remote.hash && baseline.hash === remote.hash);
    const before = timeOf(baseline.modifiedAt);
    if (sameHash || (before !== null && before === modified)) return { ok: true, expectedModifiedAt, because: "unchanged" };
  }

  if (modified !== null) {
    const own = unanswered.some(
      (attempt) =>
        modified >= attempt.claimedAt.getTime() - SEND_TIME_TOLERANCE_MS &&
        modified <= (attempt.completedAt ?? attempt.claimedAt).getTime() + SEND_TIME_TOLERANCE_MS &&
        (remote.rawContent === null || (attempt.marker !== null && remote.rawContent.includes(attempt.marker))),
    );
    if (own) return { ok: true, expectedModifiedAt, because: "own_unanswered_send" };
  }

  if (hasBaseline) return { ok: false, refusal: "post_changed" };
  if (modified === null) return { ok: false, refusal: "post_unverified" };
  if (sentAt && modified <= sentAt.getTime() + SEND_TIME_TOLERANCE_MS) return { ok: true, expectedModifiedAt, because: "not_saved_since_send" };
  return { ok: false, refusal: sentAt ? "post_changed" : "post_unverified" };
}

type Snapshot = { remoteBaseline?: RemoteBaseline; mayHaveLanded?: boolean; marker?: string } | null;

/** What this site's last send of the post recorded, and any attempt since whose answer never came. */
async function lastSend(articleId: string, integrationId: string, remoteId: string, dispatchId: string) {
  const [sent] = await db
    .select({ claimedAt: publicationDispatches.claimedAt, completedAt: publicationDispatches.completedAt, snapshot: publicationDispatches.requestSnapshot })
    .from(publicationDispatches)
    .where(
      and(
        eq(publicationDispatches.articleId, articleId),
        eq(publicationDispatches.channel, "direct"),
        eq(publicationDispatches.status, "sent"),
        eq(publicationDispatches.integrationId, integrationId),
        eq(publicationDispatches.remoteId, remoteId),
      ),
    )
    .orderBy(desc(publicationDispatches.claimedAt))
    .limit(1);

  const attempts = await db
    .select({
      status: publicationDispatches.status,
      claimedAt: publicationDispatches.claimedAt,
      completedAt: publicationDispatches.completedAt,
      snapshot: publicationDispatches.requestSnapshot,
    })
    .from(publicationDispatches)
    .where(
      and(
        eq(publicationDispatches.articleId, articleId),
        eq(publicationDispatches.channel, "direct"),
        eq(publicationDispatches.integrationId, integrationId),
        inArray(publicationDispatches.status, ["failed", "uncertain"]),
        ne(publicationDispatches.id, dispatchId),
        ...(sent ? [gt(publicationDispatches.claimedAt, sent.claimedAt)] : []),
      ),
    )
    .orderBy(desc(publicationDispatches.claimedAt))
    .limit(10);

  return {
    baseline: (sent?.snapshot as Snapshot)?.remoteBaseline ?? null,
    sentAt: sent?.completedAt ?? null,
    unanswered: attempts
      // "uncertain" on an update: a process that died mid-request, its lease run out (lib/publishing/dispatch.ts).
      .filter((attempt) => attempt.status === "uncertain" || (attempt.snapshot as Snapshot)?.mayHaveLanded)
      .map((attempt) => ({ marker: (attempt.snapshot as Snapshot)?.marker ?? null, claimedAt: attempt.claimedAt, completedAt: attempt.completedAt })),
  };
}

/** May this update go out? Throws when the platform cannot be asked, which is an ordinary failure: nothing was sent. */
export async function checkBeforeUpdate(input: {
  provider: CmsProvider;
  credentials: Credentials;
  articleId: string;
  integrationId: string;
  remoteId: string;
  dispatchId: string;
  /** When a post from before dispatches were recorded was delivered: its publish log. */
  loggedAt: Date | null;
}): Promise<UpdateVerdict> {
  if (!input.provider.readRemote) return { ok: false, refusal: "update_unavailable" };
  const remote = await input.provider.readRemote(input.credentials, input.remoteId);
  const { baseline, sentAt, unanswered } = await lastSend(input.articleId, input.integrationId, input.remoteId, input.dispatchId);
  return judgeUpdate({ remote, baseline, sentAt: sentAt ?? input.loggedAt, unanswered });
}

/**
 * The refusal, recorded where the page and the history read it, and said once.
 * Nothing retries it: it is the customer's to resolve, and a press looks again.
 *
 * A press is told every time: it is an answer. An automatic release is not a
 * person asking, and the daily job will look at the same article again tomorrow,
 * so the same refusal of the same revision is not repeated to them.
 */
export async function refuseUpdate(input: {
  refusal: OverwriteRefusal;
  dispatchId: string;
  articleId: string;
  integrationId: string;
  organizationId: string;
  href: string;
  title: string;
  revisionHash: string;
  pressed: boolean;
}): Promise<void> {
  const text = DRAFT_REFUSALS[input.refusal];
  const repeated =
    !input.pressed &&
    (
      await db
        .select({ id: publicationDispatches.id })
        .from(publicationDispatches)
        .where(
          and(
            eq(publicationDispatches.articleId, input.articleId),
            eq(publicationDispatches.status, "failed"),
            eq(publicationDispatches.error, text),
            eq(publicationDispatches.revisionHash, input.revisionHash),
            ne(publicationDispatches.id, input.dispatchId),
          ),
        )
        .limit(1)
    ).length > 0;

  const settled = await settleDispatch(input.dispatchId, { status: "failed", error: text });
  await db
    .insert(publishLogs)
    .values({ articleId: input.articleId, integrationId: input.integrationId, dispatchId: input.dispatchId, status: "failed", error: text })
    .onConflictDoNothing();
  await db.update(articles).set({ error: text, updatedAt: new Date() }).where(eq(articles.id, input.articleId));
  if (settled && !repeated) {
    await notifyDraftRefused({ organizationId: input.organizationId, href: input.href, title: input.title, refusal: input.refusal });
  }
}
