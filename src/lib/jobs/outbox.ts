import "server-only";

import { randomUUID } from "node:crypto";

import { and, eq, inArray, isNull, lt, lte, or, sql, TransactionRollbackError } from "drizzle-orm";

import { inngest } from "@/inngest/client";
import {
  releaseUnspent,
  reserveAll,
  type QuotaRule,
  type Reservation,
  type ReserveContext,
} from "@/lib/billing/spend-quota";
import { db } from "@/lib/db";
import { articles, jobOutbox, websites } from "@/lib/db/schema";
import type { Database, Executor } from "@/lib/db/types";

/**
 * Durable job dispatch: a transactional outbox in front of Inngest.
 *
 * WHAT WAS WRONG. Actions wrote their row (an article "queued", a website
 * "pending", a reservation taken) and then called inngest.send. If the send
 * failed the error was swallowed and logged; if the process died between the
 * commit and the send nothing was logged at all. Either way the row sat in
 * its waiting state for ever with no job behind it and nothing that would
 * ever retry it.
 *
 * NOW:
 *  1. The job is WRITTEN, not sent: enqueueJob inserts a job_outbox row in
 *     the SAME transaction as the business change, so either both exist or
 *     neither does - there is no window in which work is promised without a
 *     durable record of the job.
 *  2. After commit the request tries to deliver it at once (deliverNow). A
 *     queue outage does not fail the customer's action: the work is accepted
 *     and waits, and the row honestly shows it waiting.
 *  3. Undelivered rows are retried with backoff (1/2/4/8... minutes, capped)
 *     by the job-outbox cron, and by later requests. Rows are claimed with a
 *     token, so two workers never send one row at once.
 *  4. Every event carries a stable id (`eventId`) that Inngest de-duplicates
 *     on, so a delivery whose acknowledgement was lost - sent, but we never
 *     heard - is retried without running the job twice. Consumers are also
 *     idempotent in their own right (atomic claims, reservations).
 *  5. After MAX_DELIVERY_ATTEMPTS the row is marked failed and the work is
 *     released honestly (giveUp): its spend reservations are handed back and
 *     the article or website shows "failed" with a retry, rather than a
 *     spinner that never ends.
 *
 * Serverless-safe: nothing depends on an in-memory worker. The cron is an
 * Inngest function, so while Inngest itself is unreachable nothing drains -
 * the rows wait, and the first run after it recovers delivers them.
 */

export type OutboxEvent = {
  /** Stable, and the Inngest event id. Derive it from the work, e.g. a reservation id. */
  id: string;
  name: string;
  data: Record<string, unknown>;
};

export const MAX_DELIVERY_ATTEMPTS = 10;

/** How long one worker may hold a row while sending. */
const CLAIM_SECONDS = 60;

/** 30s, 1m, 2m, 4m ... capped at 30 minutes: about three hours in all. */
export function deliveryBackoffMs(attempts: number): number {
  return Math.min(30_000 * 2 ** Math.max(attempts - 1, 0), 30 * 60 * 1000);
}

/**
 * Records a job to run. Call INSIDE the transaction that makes the change the
 * job is for. Recording the same event id twice is one job.
 */
export async function enqueueJob(tx: Executor, event: OutboxEvent): Promise<void> {
  await tx
    .insert(jobOutbox)
    .values({
      eventId: event.id,
      name: event.name,
      data: event.data,
      status: "pending",
      nextAttemptAt: new Date(),
    })
    .onConflictDoNothing({ target: jobOutbox.eventId });
}

export type DeliveryResult = {
  /** Sent, and recorded as sent by this worker. */
  sent: string[];
  /** Not sent; scheduled for another attempt. */
  retrying: string[];
  /** Given up on: failed state AND its cleanup committed together. */
  failed: string[];
  /**
   * This worker's claim had been taken over (it outlived its lease) by the
   * time it came to record the outcome: it records nothing and cleans up
   * nothing - the current owner decides.
   */
  lost: string[];
  /** The outcome could not be recorded; the claim expires and it is retried. */
  unrecorded: string[];
};

/**
 * Sends due outbox rows to Inngest. Never throws.
 *
 * `only` limits it to named event ids (a request delivering its own job).
 */
export async function deliverJobs(
  database: Database = db,
  options: { only?: string[]; now?: Date; limit?: number } = {},
): Promise<DeliveryResult> {
  const now = options.now ?? new Date();
  const result: DeliveryResult = { sent: [], retrying: [], failed: [], lost: [], unrecorded: [] };
  const token = randomUUID();

  let claimed: (typeof jobOutbox.$inferSelect)[] = [];
  try {
    const free = or(isNull(jobOutbox.claimedUntil), lt(jobOutbox.claimedUntil, now));
    const due = database
      .select({ id: jobOutbox.id })
      .from(jobOutbox)
      .where(
        and(
          eq(jobOutbox.status, "pending"),
          lte(jobOutbox.nextAttemptAt, now),
          free,
          options.only?.length ? inArray(jobOutbox.eventId, options.only) : undefined,
        ),
      )
      .orderBy(jobOutbox.nextAttemptAt)
      .limit(options.limit ?? 50);

    claimed = await database
      .update(jobOutbox)
      .set({
        claimToken: token,
        claimedUntil: new Date(now.getTime() + CLAIM_SECONDS * 1000),
        attempts: sql`${jobOutbox.attempts} + 1`,
        updatedAt: now,
      })
      .where(and(inArray(jobOutbox.id, due), eq(jobOutbox.status, "pending"), free))
      .returning();
  } catch (error) {
    console.error("[outbox] could not claim jobs to deliver", error);
    return result;
  }

  for (const row of claimed) {
    /*
      Every outcome is recorded ONLY through this claim: the row must still
      be pending and still carry this worker's token. A worker that stalled
      past its lease while another took the row over matches nothing, and
      then neither reports an outcome nor cleans anything up.
    */
    const mine = and(
      eq(jobOutbox.id, row.id),
      eq(jobOutbox.claimToken, token),
      eq(jobOutbox.status, "pending"),
    );
    let sendError: unknown = null;
    try {
      await inngest.send({ id: row.eventId, name: row.name, data: row.data as Record<string, unknown> });
    } catch (error) {
      sendError = error;
    }

    try {
      if (!sendError) {
        const recorded = await database
          .update(jobOutbox)
          .set({ status: "sent", sentAt: new Date(), claimToken: null, claimedUntil: null, lastError: null, updatedAt: new Date() })
          .where(mine)
          .returning({ id: jobOutbox.id });
        (recorded.length > 0 ? result.sent : result.lost).push(row.eventId);
        continue;
      }

      const message = (sendError instanceof Error ? sendError.message : "send failed").slice(0, 500);
      const giveUp = row.attempts >= MAX_DELIVERY_ATTEMPTS;
      /*
        The failure - and, when giving up, the cleanup it implies - commit in
        ONE transaction. If the cleanup fails, the terminal state rolls back
        with it: the row stays pending under this (soon expired) claim, and
        the next run retries the delivery and, failing again, the cleanup. A
        "failed" row whose work was never released cannot exist.
      */
      const outcome = await database.transaction(async (tx) => {
        const updated = await tx
          .update(jobOutbox)
          .set({
            status: giveUp ? "failed" : "pending",
            failedAt: giveUp ? new Date() : null,
            nextAttemptAt: new Date(Date.now() + deliveryBackoffMs(row.attempts)),
            claimToken: null,
            claimedUntil: null,
            lastError: message,
            updatedAt: new Date(),
          })
          .where(mine)
          .returning({ id: jobOutbox.id });
        if (updated.length === 0) return "lost" as const;
        if (giveUp) await giveUpOn(tx, row);
        return giveUp ? ("failed" as const) : ("retrying" as const);
      });
      result[outcome].push(row.eventId);
      if (outcome !== "lost") {
        console.error(
          `[outbox] could not deliver "${row.name}" ${row.eventId} (attempt ${row.attempts}${giveUp ? ", given up" : ""})`,
          sendError,
        );
      }
    } catch (recordError) {
      // Nothing committed; the claim expires on its own and the row is retried.
      result.unrecorded.push(row.eventId);
      console.error(`[outbox] could not record the outcome for ${row.eventId}`, recordError);
    }
  }
  return result;
}

/** Delivers one job straight after the transaction that recorded it. */
export async function deliverNow(eventId: string): Promise<boolean> {
  const result = await deliverJobs(db, { only: [eventId] });
  return result.sent.includes(eventId);
}

/**
 * Records a job that stands alone - nothing else in the same request needs
 * to commit with it - and tries to deliver it. Returns whether it went out
 * now; if not, it is retried, so callers need not.
 */
export async function queueJobDurably(event: Omit<OutboxEvent, "id"> & { id?: string }): Promise<boolean> {
  const full: OutboxEvent = { ...event, id: event.id ?? `${event.name}:${randomUUID()}` };
  await enqueueJob(db, full);
  return deliverNow(full.id);
}

/**
 * Reserves spend capacity and records the job that will use it, in ONE
 * transaction - with `write`, the business change too - then delivers.
 *
 * The reservation, the change and the job commit together, so a crash can
 * leave neither capacity held with no job behind it nor a job with no
 * capacity. Delivery failing does not fail the caller: the job is recorded
 * and retried, and if it can never be delivered its reservations are handed
 * back (giveUp).
 */
export async function reserveAndQueue<T = void>(
  rules: QuotaRule[],
  context: ReserveContext,
  job: (reservations: Reservation[]) => OutboxEvent,
  write?: (tx: Executor, reservations: Reservation[]) => Promise<T | false>,
): Promise<
  | { ok: true; reservations: Reservation[]; delivered: boolean; written: T | undefined }
  | { ok: false; rule?: QuotaRule; refused?: true }
> {
  const outcome = await db.transaction(async (tx) => {
    const slot = await reserveAll(rules, context, { executor: tx });
    if (!slot.ok) return { ok: false as const, rule: slot.rule };
    let written: T | undefined;
    if (write) {
      const result = await write(tx, slot.reservations);
      // The write declined (e.g. already running): roll everything back.
      if (result === false) {
        tx.rollback();
      }
      written = result as T;
    }
    const event = job(slot.reservations);
    await enqueueJob(tx, event);
    return { ok: true as const, reservations: slot.reservations, eventId: event.id, written };
  }).catch((error: unknown) => {
    if (error instanceof TransactionRollbackError) return { ok: false as const, refused: true as const };
    throw error;
  });
  if (!outcome.ok) return outcome;
  const delivered = await deliverNow(outcome.eventId);
  return { ok: true, reservations: outcome.reservations, delivered, written: outcome.written };
}

/**
 * Releases work whose job could never be delivered, so nothing waits for it
 * for ever and nothing it reserved stays held. Runs inside the transaction
 * that marks the job failed, and throws on any failure so both roll back.
 *
 * SCOPED TO THIS JOB'S OWN ATTEMPT:
 *  - only this job's reservations are released, and releaseReservation never
 *    frees one whose paid call had started (it is finalised as consumed);
 *  - the article or website is only marked failed while it is still waiting
 *    AND no newer job for it (a retry pressed since) is pending or sent -
 *    that newer attempt owns the row now.
 */
async function giveUpOn(tx: Executor, row: typeof jobOutbox.$inferSelect): Promise<void> {
  const data = row.data as Record<string, unknown>;
  const reservations = Array.isArray(data.reservations)
    ? (data.reservations as Reservation[])
    : [];
  if (reservations.length > 0) await releaseUnspent(reservations, "dispatch_failed", tx);

  const newerJobFor = (field: string, id: string) => sql`not exists (
    select 1 from ${jobOutbox} newer
    where newer.name = ${row.name}
      and newer.data ->> ${field} = ${id}
      and newer.id <> ${row.id}
      and newer.created_at > ${row.createdAt.toISOString()}::timestamp
      and newer.status in ('pending', 'sent'))`;

  const now = new Date();
  if (row.name === "article/generate.requested" && typeof data.articleId === "string") {
    const restore = typeof data.previousStatus === "string" ? data.previousStatus : null;
    await tx
      .update(articles)
      .set(
        restore
          ? { status: restore, updatedAt: now }
          : { status: "failed", error: "We could not start writing this article. Please try again.", updatedAt: now },
      )
      .where(
        and(
          eq(articles.id, data.articleId),
          inArray(articles.status, ["queued", "generating"]),
          newerJobFor("articleId", data.articleId),
        ),
      );
  }
  if (row.name === "website/analyze.requested" && typeof data.websiteId === "string") {
    await tx
      .update(websites)
      .set({ status: "failed", updatedAt: now })
      .where(
        and(
          eq(websites.id, data.websiteId),
          eq(websites.status, "pending"),
          newerJobFor("websiteId", data.websiteId),
        ),
      );
  }
}
