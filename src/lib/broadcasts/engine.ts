import "server-only";

import { and, eq, inArray, lte, sql } from "drizzle-orm";

import { recordAdminAction } from "@/lib/admin/audit";
import { db } from "@/lib/db";
import { emailBroadcastRecipients, emailBroadcasts, user } from "@/lib/db/schema";
import type { Executor, Transaction } from "@/lib/db/types";
import { unsubscribeUrl } from "@/lib/email/lifecycle";
import { sendEmail } from "@/lib/email/send";
import { enqueueJob } from "@/lib/jobs/outbox";

import { audienceSql, checkRecipient, mayReceiveSql } from "./audience";
import { readBroadcastContent } from "./content";
import { renderBroadcastEmail } from "./render";
import type { BroadcastContent } from "./shared";

/**
 * Sending a broadcast (ticket 2026-11-24).
 *
 * NOBODY GETS ONE TWICE, whatever is pressed, retried or re-run:
 *  1. STARTING is one transaction: the status goes draft/scheduled -> sending
 *     by compare-and-set, the recipients are written (unique per broadcast
 *     and person) and the job is recorded in the outbox. A second press finds
 *     the status changed.
 *  2. EACH SEND claims its recipient first (queued -> sending), one at a time
 *     and only while the broadcast is still sending. Two workers cannot claim
 *     the same row.
 *  3. The recipient's id is Resend's idempotency key, and the email is the
 *     same bytes every time (the content is frozen once it starts). A send
 *     whose answer was lost is claimed again after STALE_CLAIM_MS and Resend
 *     answers with the first email. Resend remembers a key for 24 hours; a
 *     claim older than REPLAY_LIMIT_MS is marked failed and never sent again.
 *
 * SUPPRESSION IS READ AGAIN RIGHT BEFORE EACH SEND (lib/broadcasts/audience.ts
 * checkRecipient): someone who unsubscribes while it runs is skipped.
 *
 * SLOWLY, ON PURPOSE. One email every PACE_MS, leaving most of Resend's rate
 * limit to sign-in codes and the other emails customers wait for. A failed
 * attempt waits longer each time (RETRY_MINUTES) and is then left failed, so a
 * provider outage or a used-up daily quota delays the rest instead of burning
 * through it.
 */

export const BROADCAST_EVENT = "email/broadcast.send";

export const BATCH_SIZE = 20;
/** One email a second: well under Resend's limit, which sign-in codes share. */
export const PACE_MS = 1000;
/** Minutes after the 1st, 2nd... failed attempt. One more failure after the last and it is left failed. */
export const RETRY_MINUTES = [1, 10, 60, 360];
export const MAX_ATTEMPTS = RETRY_MINUTES.length + 1;
/** A claim this old belongs to a worker that died. */
export const STALE_CLAIM_MS = 10 * 60 * 1000;
/** Past this a lost send is never repeated: Resend forgets an idempotency key after 24 hours. */
export const REPLAY_LIMIT_MS = 20 * 60 * 60 * 1000;

const MINUTE_MS = 60 * 1000;

/** Whether a broadcast could be sent from this deployment at all, and if not, why - in the administrator's words. */
export function broadcastSendingProblem(): string | null {
  if (!process.env.RESEND_API_KEY) return "Email is not configured on this deployment (RESEND_API_KEY). Drafts can be written; nothing can be sent.";
  // Without a verified sender Resend delivers only to the owner of its account (lib/email/send.ts).
  if (!process.env.EMAIL_FROM) return "No sender address is configured (EMAIL_FROM), so Resend would only deliver to its account owner. Nothing can be sent.";
  if (!process.env.BETTER_AUTH_SECRET) return "Unsubscribe links cannot be signed on this deployment (BETTER_AUTH_SECRET). Nothing can be sent.";
  return null;
}

export class BroadcastStateError extends Error {}

const CHANGED = "This broadcast has changed since the page was loaded. Reload the page.";

/**
 * draft or scheduled -> sending, with its recipients and its job, in the
 * caller's transaction. Throws BroadcastStateError when it is not (any more)
 * in `from`, at that revision, or when nobody would receive it.
 */
export async function startBroadcast(
  tx: Transaction,
  input: { id: string; from: "draft" | "scheduled"; revision?: number; actor: string; now?: Date },
): Promise<{ recipients: number; eventId: string; subject: string }> {
  const now = input.now ?? new Date();
  const [started] = await tx
    .update(emailBroadcasts)
    .set({ status: "sending", startedAt: now, sentBy: input.actor, updatedAt: now })
    .where(
      and(
        eq(emailBroadcasts.id, input.id),
        eq(emailBroadcasts.status, input.from),
        input.revision === undefined ? undefined : eq(emailBroadcasts.revision, input.revision),
        input.from === "scheduled" ? lte(emailBroadcasts.scheduledFor, now) : undefined,
      ),
    )
    .returning();
  if (!started) throw new BroadcastStateError(CHANGED);
  const checked = readBroadcastContent(contentOf(started), { complete: true });
  if (!checked.ok) throw new BroadcastStateError(checked.error);

  const people = await tx
    .insert(emailBroadcastRecipients)
    .select(
      tx
        .select({
          id: sql<string>`gen_random_uuid()`.as("id"),
          broadcastId: sql<string>`${started.id}::uuid`.as("broadcast_id"),
          userId: sql<string>`"user"."id"`.as("user_id"),
          email: sql<string | null>`null::text`.as("email"),
          status: sql<string>`'queued'`.as("status"),
          reason: sql<string | null>`null::text`.as("reason"),
          attempts: sql<number>`0`.as("attempts"),
          nextAttemptAt: sql<Date | null>`null::timestamp`.as("next_attempt_at"),
          claimedAt: sql<Date | null>`null::timestamp`.as("claimed_at"),
          sentAt: sql<Date | null>`null::timestamp`.as("sent_at"),
          providerMessageId: sql<string | null>`null::text`.as("provider_message_id"),
          createdAt: sql<Date>`${now.toISOString()}::timestamp`.as("created_at"),
          updatedAt: sql<Date>`${now.toISOString()}::timestamp`.as("updated_at"),
        })
        .from(user)
        .where(and(mayReceiveSql, audienceSql(checked.content.audience, now, checked.content.personId))),
    )
    .onConflictDoNothing()
    .returning({ id: emailBroadcastRecipients.id });
  if (people.length === 0) throw new BroadcastStateError("Nobody in this audience can be emailed.");

  await tx.update(emailBroadcasts).set({ recipientCount: people.length }).where(eq(emailBroadcasts.id, started.id));
  const eventId = `broadcast:${started.id}:start`;
  await enqueueJob(tx, { id: eventId, name: BROADCAST_EVENT, data: { broadcastId: started.id } });
  return { recipients: people.length, eventId, subject: started.subject };
}

/** Starts every scheduled broadcast whose time has come. One that cannot start goes back to a draft, with a note in the audit log. */
export async function startDueBroadcasts(now: Date = new Date()): Promise<{ started: string[]; returned: string[] }> {
  const result = { started: [] as string[], returned: [] as string[] };
  // Not configured (any more): leave them scheduled; they go out late rather than half.
  if (broadcastSendingProblem()) return result;
  const due = await db
    .select({ id: emailBroadcasts.id, sentBy: emailBroadcasts.sentBy, createdBy: emailBroadcasts.createdBy, subject: emailBroadcasts.subject })
    .from(emailBroadcasts)
    .where(and(eq(emailBroadcasts.status, "scheduled"), lte(emailBroadcasts.scheduledFor, now)))
    .limit(10);
  for (const row of due) {
    const actor = row.sentBy ?? row.createdBy;
    try {
      await db.transaction(async (tx) => {
        const { recipients } = await startBroadcast(tx, { id: row.id, from: "scheduled", actor, now });
        await recordAdminAction(
          {
            actorEmail: actor,
            action: "broadcast.sent",
            targetType: "broadcast",
            targetId: row.id,
            summary: `Scheduled email broadcast started: "${row.subject}" to ${recipients} people`,
            detail: { recipients, scheduled: true },
          },
          tx,
        );
      });
      result.started.push(row.id);
    } catch (error) {
      if (!(error instanceof BroadcastStateError)) throw error;
      const reason = error.message;
      await db.transaction(async (tx) => {
        const [back] = await tx
          .update(emailBroadcasts)
          .set({ status: "draft", scheduledFor: null, updatedAt: now })
          .where(and(eq(emailBroadcasts.id, row.id), eq(emailBroadcasts.status, "scheduled"), lte(emailBroadcasts.scheduledFor, now)))
          .returning({ id: emailBroadcasts.id });
        if (!back) return;
        result.returned.push(row.id);
        await recordAdminAction(
          {
            actorEmail: actor,
            action: "broadcast.returned",
            targetType: "broadcast",
            targetId: row.id,
            summary: `Scheduled email broadcast not sent, back to draft: "${row.subject}" - ${reason}`,
            detail: { reason },
          },
          tx,
        );
      });
    }
  }
  return result;
}

/**
 * Broadcasts that should be sending and are not (a job lost for good): their
 * job is queued again. Harmless when the first one is in fact still running.
 */
export async function requeueStalledBroadcasts(now: Date = new Date()): Promise<string[]> {
  const quietSince = new Date(now.getTime() - 30 * MINUTE_MS);
  const stalled = await db
    .select({ id: emailBroadcasts.id })
    .from(emailBroadcasts)
    .where(
      and(
        eq(emailBroadcasts.status, "sending"),
        lte(emailBroadcasts.updatedAt, quietSince),
        // Finished but not closed, or somebody has been due for a while.
        sql`(
          not exists (select 1 from email_broadcast_recipients r where r.broadcast_id = "email_broadcasts"."id" and r.status in ('queued', 'sending'))
          or exists (
            select 1 from email_broadcast_recipients r where r.broadcast_id = "email_broadcasts"."id"
              and ((r.status = 'queued' and (r.next_attempt_at is null or r.next_attempt_at <= ${quietSince.toISOString()}::timestamp))
                or (r.status = 'sending' and r.claimed_at <= ${quietSince.toISOString()}::timestamp))
          )
        )`,
      ),
    )
    .limit(10);
  for (const row of stalled) {
    // A new event id per half hour: the outbox keeps one job per id.
    const slot = Math.floor(now.getTime() / (30 * MINUTE_MS));
    await enqueueJob(db, { id: `broadcast:${row.id}:resume:${slot}`, name: BROADCAST_EVENT, data: { broadcastId: row.id } });
  }
  return stalled.map((row) => row.id);
}

function contentOf(row: typeof emailBroadcasts.$inferSelect): BroadcastContent {
  return {
    audience: row.audience as BroadcastContent["audience"],
    personId: row.personId,
    subject: row.subject,
    heading: row.heading,
    previewText: row.previewText,
    bodyHtml: row.bodyHtml,
    images: row.images,
    ctaLabel: row.ctaLabel ?? "",
    ctaUrl: row.ctaUrl ?? "",
  };
}

type Claimed = { id: string; userId: string; attempts: number };

/** Takes the next person due, or null. Only while the broadcast is sending: a cancelled one claims nobody. */
async function claimNext(broadcastId: string, now: Date, executor: Executor = db): Promise<Claimed | null> {
  const stale = new Date(now.getTime() - STALE_CLAIM_MS).toISOString();
  const nowIso = now.toISOString();
  const next = sql`(
    select q.id from email_broadcast_recipients q
    where q.broadcast_id = ${broadcastId}::uuid
      and ((q.status = 'queued' and (q.next_attempt_at is null or q.next_attempt_at <= ${nowIso}::timestamp))
        or (q.status = 'sending' and q.claimed_at <= ${stale}::timestamp))
    order by q.attempts, q.id
    limit 1
    for update skip locked
  )`;
  const [row] = await executor
    .update(emailBroadcastRecipients)
    .set({ status: "sending", claimedAt: now, attempts: sql`"email_broadcast_recipients"."attempts" + 1`, updatedAt: now })
    .where(
      and(
        sql`"email_broadcast_recipients"."id" = ${next}`,
        sql`exists (select 1 from email_broadcasts b where b.id = ${broadcastId}::uuid and b.status = 'sending')`,
      ),
    )
    .returning({ id: emailBroadcastRecipients.id, userId: emailBroadcastRecipients.userId, attempts: emailBroadcastRecipients.attempts });
  return row ?? null;
}

async function settleRecipient(
  id: string,
  set: Partial<typeof emailBroadcastRecipients.$inferInsert>,
): Promise<void> {
  // Only while it is still ours: a cancel or a later claim that settled it first stays.
  await db
    .update(emailBroadcastRecipients)
    .set({ ...set, updatedAt: new Date() })
    .where(and(eq(emailBroadcastRecipients.id, id), eq(emailBroadcastRecipients.status, "sending")));
}

export type BatchResult = {
  sent: number;
  skipped: number;
  failed: number;
  /** Nothing left to do: sent, cancelled, or not a running broadcast. */
  done: boolean;
  /** Nobody is due now; the next one is in this many milliseconds. */
  waitMs: number;
};

const pause = (ms: number) => (ms > 0 ? new Promise<void>((resolve) => setTimeout(resolve, ms)) : Promise.resolve());

/**
 * Sends to the next BATCH_SIZE people. Called by the Inngest job, one step per
 * batch; safe to run again at any point.
 */
export async function sendBroadcastBatch(
  broadcastId: string,
  options: { now?: () => Date; paceMs?: number; size?: number } = {},
): Promise<BatchResult> {
  const clock = options.now ?? (() => new Date());
  const pace = options.paceMs ?? PACE_MS;
  const result: BatchResult = { sent: 0, skipped: 0, failed: 0, done: false, waitMs: 0 };

  const [broadcast] = await db.select().from(emailBroadcasts).where(eq(emailBroadcasts.id, broadcastId)).limit(1);
  if (broadcast?.status === "cancelled") {
    // A send that failed at the moment of the cancellation went back to the queue: it is not retried.
    await db
      .update(emailBroadcastRecipients)
      .set({ status: "skipped", reason: "cancelled", updatedAt: clock() })
      .where(and(eq(emailBroadcastRecipients.broadcastId, broadcastId), eq(emailBroadcastRecipients.status, "queued")));
  }
  if (!broadcast || broadcast.status !== "sending") return { ...result, done: true };
  // The configuration went away mid-run: wait rather than fail everybody.
  if (broadcastSendingProblem()) {
    await db.update(emailBroadcasts).set({ updatedAt: clock() }).where(eq(emailBroadcasts.id, broadcastId));
    return { ...result, waitMs: 30 * MINUTE_MS };
  }
  const content = contentOf(broadcast);

  // Sends whose outcome was lost too long ago to repeat safely.
  const started = clock();
  await db
    .update(emailBroadcastRecipients)
    .set({ status: "failed", reason: "outcome unknown: not sent again", updatedAt: started })
    .where(
      and(
        eq(emailBroadcastRecipients.broadcastId, broadcastId),
        eq(emailBroadcastRecipients.status, "sending"),
        lte(emailBroadcastRecipients.claimedAt, new Date(started.getTime() - REPLAY_LIMIT_MS)),
      ),
    );

  for (let index = 0; index < (options.size ?? BATCH_SIZE); index++) {
    const claimed = await claimNext(broadcastId, clock());
    if (!claimed) break;

    const person = await checkRecipient(claimed.userId);
    if (!person.ok) {
      await settleRecipient(claimed.id, { status: "skipped", reason: person.reason });
      result.skipped++;
      continue;
    }
    const unsubscribe = unsubscribeUrl(claimed.userId);
    if (!unsubscribe) {
      // A broadcast without a working unsubscribe link does not go.
      await settleRecipient(claimed.id, { status: "skipped", reason: "no unsubscribe link" });
      result.skipped++;
      continue;
    }

    const email = renderBroadcastEmail(content, { unsubscribeUrl: unsubscribe });
    const oneClick = unsubscribe.replace("/unsubscribe/", "/api/email/unsubscribe?token=");
    const outcome = await sendEmail({
      to: person.email,
      ...email,
      headers: { "List-Unsubscribe": `<${oneClick}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      // The same key on every attempt: a send whose answer was lost is not delivered twice.
      idempotencyKey: `broadcast:${claimed.id}`,
    });
    if (outcome.ok) {
      await settleRecipient(claimed.id, { status: "sent", email: person.email, reason: null, sentAt: clock(), providerMessageId: outcome.id });
      result.sent++;
    } else {
      const wait = RETRY_MINUTES[claimed.attempts - 1];
      const reason = outcome.error.slice(0, 300);
      if (wait === undefined) {
        await settleRecipient(claimed.id, { status: "failed", email: person.email, reason });
        result.failed++;
      } else {
        await settleRecipient(claimed.id, { status: "queued", reason, nextAttemptAt: new Date(clock().getTime() + wait * MINUTE_MS) });
      }
    }
    await pause(pace);
  }

  return { ...result, ...(await finishOrWait(broadcastId, clock())) };
}

/** Closes a broadcast with nobody left, or says how long until the next one is due. Bumps updated_at: the job is alive. */
async function finishOrWait(broadcastId: string, now: Date): Promise<{ done: boolean; waitMs: number }> {
  const [left] = await db
    .select({
      n: sql<number>`count(*)::int`,
      // Seconds until the first is due; a claim in progress is looked at again once it is stale.
      wait: sql<number | null>`extract(epoch from min(case
        when "email_broadcast_recipients"."status" = 'sending' then "email_broadcast_recipients"."claimed_at" + make_interval(secs => ${STALE_CLAIM_MS / 1000})
        else coalesce("email_broadcast_recipients"."next_attempt_at", ${now.toISOString()}::timestamp)
      end) - ${now.toISOString()}::timestamp)::float8`,
    })
    .from(emailBroadcastRecipients)
    .where(and(eq(emailBroadcastRecipients.broadcastId, broadcastId), inArray(emailBroadcastRecipients.status, ["queued", "sending"])));
  const remaining = Number(left?.n ?? 0);
  const running = and(eq(emailBroadcasts.id, broadcastId), eq(emailBroadcasts.status, "sending"));
  if (remaining === 0) {
    await db.update(emailBroadcasts).set({ status: "sent", finishedAt: now, updatedAt: now }).where(running);
    return { done: true, waitMs: 0 };
  }
  const alive = await db.update(emailBroadcasts).set({ updatedAt: now }).where(running).returning({ id: emailBroadcasts.id });
  return { done: alive.length === 0, waitMs: Math.max(0, Math.ceil(Number(left?.wait ?? 0) * 1000)) };
}

/**
 * Stops a scheduled or running broadcast. Whoever has not been sent it yet is
 * marked skipped; an email being sent at this very moment still arrives.
 */
export async function cancelBroadcast(tx: Transaction, input: { id: string; actor: string; now?: Date }): Promise<{ subject: string; was: string; notSent: number } | null> {
  const now = input.now ?? new Date();
  const [before] = await tx.select({ status: emailBroadcasts.status, subject: emailBroadcasts.subject }).from(emailBroadcasts).where(eq(emailBroadcasts.id, input.id)).for("update");
  if (!before || !["scheduled", "sending"].includes(before.status)) return null;
  await tx
    .update(emailBroadcasts)
    .set({ status: "cancelled", cancelledBy: input.actor, cancelledAt: now, finishedAt: now, updatedAt: now })
    .where(eq(emailBroadcasts.id, input.id));
  const stopped = await tx
    .update(emailBroadcastRecipients)
    .set({ status: "skipped", reason: "cancelled", updatedAt: now })
    .where(and(eq(emailBroadcastRecipients.broadcastId, input.id), eq(emailBroadcastRecipients.status, "queued")))
    .returning({ id: emailBroadcastRecipients.id });
  return { subject: before.subject, was: before.status, notSent: stopped.length };
}
