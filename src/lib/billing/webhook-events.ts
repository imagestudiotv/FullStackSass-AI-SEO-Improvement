import "server-only";

import { randomUUID } from "node:crypto";

import { and, eq, isNull, lt, lte, or, sql as raw } from "drizzle-orm";

import { db } from "@/lib/db";
import { webhookEvents } from "@/lib/db/schema";

/**
 * Webhook delivery bookkeeping, shared by the Stripe and PayPal handlers and
 * the webhook-recovery part of the billing-maintenance job.
 *
 * WHAT WAS WRONG. Both handlers inserted the event id before running, treating
 * the insert as the lock: a conflict meant "already processed, acknowledge and
 * stop". A function timeout, an OOM kill or a recycled instance left the row
 * present with nobody working on it, and every subsequent retry of that event
 * id was acknowledged as a duplicate. The event was never processed.
 *
 * WHAT THIS DOES. Three states, a lease, and an owner:
 *
 *   received   - known, not being worked on. Claimable.
 *   processing - claimed at `claimedAt` by the attempt holding `claimToken`.
 *                Claimable again once the lease expires, because a lease that
 *                old means its owner is gone.
 *   completed  - finished. Never claimable; a later delivery is a true duplicate.
 *
 * OWNERSHIP. Every claim writes a fresh `claimToken`, and completing or
 * releasing requires it. A worker that outlived its lease - slow, not dead -
 * while another delivery took the event over can therefore neither mark the
 * new owner's work complete nor throw its claim back; its late complete or
 * release matches nothing.
 *
 * RECOVERY DOES NOT WAIT FOR THE PROVIDER. A delivery that arrives while
 * another is processing is acknowledged with 200 (a 5xx would make the
 * provider retry work that is already running) - so if the running worker
 * then dies, the provider has no reason to send the event again. The payload
 * is stored when the event is first verified, and claimForRecovery hands
 * abandoned and failed events to the billing-maintenance job, which processes
 * them from that stored payload with the same handlers. A crash is recovered
 * within minutes whether or not the provider retries.
 *
 * THIS IS NOT WHAT MAKES THE MONEY SAFE. Financial idempotency comes from the
 * unique indexes on payments (provider, external_id), addon_purchases
 * (stripe_session_id) and credit_ledger (idempotency_key): even a genuinely
 * double-processed event cannot charge or credit twice. This module stops work
 * being LOST; those indexes stop it being DOUBLED.
 */

/**
 * How long a claim is honoured before another delivery may take it.
 *
 * Longer than any handler should run — these do a handful of queries and at
 * most two provider API calls — and short enough that a crashed event
 * recovers within minutes.
 */
export const LEASE_SECONDS = 5 * 60;

/** Recovery attempts before an event is left for a person (reconciliation). */
export const MAX_RECOVERY_ATTEMPTS = 12;

export type ClaimOutcome =
  /** This process owns the event and must handle it, then complete or release with `token`. */
  | { claimed: true; attempts: number; token: string }
  /** Already finished, or owned by a live attempt. Acknowledge and stop. */
  | { claimed: false; reason: "completed" | "in_progress" };

/**
 * Claims an event for processing, recording it if it is new.
 *
 * ONE STATEMENT, NOT READ-THEN-WRITE. An insert with ON CONFLICT DO UPDATE and
 * a WHERE on the conflicting row is atomic: two deliveries racing on the same
 * event id are serialised by Postgres and exactly one gets a row back.
 *
 * `attempts` is incremented as part of the claim, so it counts real attempts
 * even for the ones that died without reporting anything.
 */
export async function claimWebhookEvent(input: {
  id: string;
  provider: string;
  type: string;
  payload: unknown;
  now?: Date;
}): Promise<ClaimOutcome> {
  const now = input.now ?? new Date();
  const staleBefore = new Date(now.getTime() - LEASE_SECONDS * 1000);
  const token = randomUUID();

  const [row] = await db
    .insert(webhookEvents)
    .values({
      id: input.id,
      provider: input.provider,
      type: input.type,
      payload: input.payload as Record<string, unknown>,
      status: "processing",
      claimedAt: now,
      claimToken: token,
      attempts: 1,
    })
    .onConflictDoUpdate({
      target: webhookEvents.id,
      set: {
        status: "processing",
        claimedAt: now,
        claimToken: token,
        attempts: raw`${webhookEvents.attempts} + 1`,
      },
      /*
        Claimable only when nobody is working on it: either it is waiting, or a
        previous claim's lease has expired and its owner is presumed dead. A
        "completed" row never matches, so a true duplicate updates nothing and
        returns no row.
      */
      setWhere: or(
        eq(webhookEvents.status, "received"),
        and(
          eq(webhookEvents.status, "processing"),
          lt(webhookEvents.claimedAt, staleBefore),
        ),
      ),
    })
    .returning({
      attempts: webhookEvents.attempts,
      token: webhookEvents.claimToken,
    });

  if (row && row.token === token) {
    return { claimed: true, attempts: row.attempts, token };
  }

  const [existing] = await db
    .select({ status: webhookEvents.status })
    .from(webhookEvents)
    .where(eq(webhookEvents.id, input.id))
    .limit(1);

  return {
    claimed: false,
    reason: existing?.status === "processing" ? "in_progress" : "completed",
  };
}

/**
 * Marks a claimed event finished - only while `token` still owns the claim.
 * Returns false when the claim was taken over; the caller's work may then
 * have run twice, which the financial unique indexes make harmless.
 */
export async function completeWebhookEvent(
  id: string,
  token: string,
  now: Date = new Date(),
): Promise<boolean> {
  const rows = await db
    .update(webhookEvents)
    .set({
      status: "completed",
      completedAt: now,
      claimedAt: null,
      claimToken: null,
      nextAttemptAt: null,
      lastError: null,
    })
    .where(
      and(
        eq(webhookEvents.id, id),
        eq(webhookEvents.status, "processing"),
        eq(webhookEvents.claimToken, token),
      ),
    )
    .returning({ id: webhookEvents.id });
  if (rows.length === 0) {
    console.warn(`[webhooks] ${id}: claim was taken over before this attempt finished`);
  }
  return rows.length > 0;
}

/**
 * Releases a claim after a failed attempt, so a retry - the provider's, or
 * the recovery job's after `nextAttemptAt` - can take it. Only the owner can.
 *
 * THE ROW IS KEPT. Its attempt count and reason are what tell "this event
 * fails every time" from "this event was delivered during a blip". The message
 * is truncated and comes from an Error, never from a payload or a credential.
 */
export async function releaseWebhookEvent(
  id: string,
  token: string,
  error: unknown,
  now: Date = new Date(),
): Promise<boolean> {
  const message = error instanceof Error ? error.message : "handler failed";

  const rows = await db
    .update(webhookEvents)
    .set({
      status: "received",
      claimedAt: null,
      claimToken: null,
      lastError: message.slice(0, 500),
      // Recovery backoff: 1m, 2m, 4m ... capped at 2h.
      nextAttemptAt: raw`${now.toISOString()}::timestamp + (least(60 * power(2, greatest(${webhookEvents.attempts} - 1, 0)), 7200) * interval '1 second')`,
    })
    .where(
      and(
        eq(webhookEvents.id, id),
        eq(webhookEvents.status, "processing"),
        eq(webhookEvents.claimToken, token),
      ),
    )
    .returning({ id: webhookEvents.id });
  return rows.length > 0;
}

export type RecoverableEvent = {
  id: string;
  provider: string;
  type: string;
  payload: unknown;
  attempts: number;
  token: string;
};

/**
 * Claims events the recovery job should process now: claims abandoned past
 * their lease, and released events whose retry time has come, up to
 * MAX_RECOVERY_ATTEMPTS. Each is claimed with its own token by a conditional
 * UPDATE, so a delivery or another recovery run racing for it cannot both win.
 */
export async function claimForRecovery(
  options: { now?: Date; limit?: number } = {},
): Promise<RecoverableEvent[]> {
  const now = options.now ?? new Date();
  const staleBefore = new Date(now.getTime() - LEASE_SECONDS * 1000);
  const recoverable = or(
    and(eq(webhookEvents.status, "processing"), lt(webhookEvents.claimedAt, staleBefore)),
    and(
      eq(webhookEvents.status, "received"),
      raw`${webhookEvents.attempts} > 0`,
      or(isNull(webhookEvents.nextAttemptAt), lte(webhookEvents.nextAttemptAt, now)),
    ),
  );

  const candidates = await db
    .select({ id: webhookEvents.id })
    .from(webhookEvents)
    .where(and(recoverable, raw`${webhookEvents.attempts} < ${MAX_RECOVERY_ATTEMPTS}`))
    .orderBy(webhookEvents.processedAt)
    .limit(options.limit ?? 25);

  const claimed: RecoverableEvent[] = [];
  for (const { id } of candidates) {
    const token = randomUUID();
    const [row] = await db
      .update(webhookEvents)
      .set({
        status: "processing",
        claimedAt: now,
        claimToken: token,
        attempts: raw`${webhookEvents.attempts} + 1`,
      })
      .where(and(eq(webhookEvents.id, id), recoverable))
      .returning({
        id: webhookEvents.id,
        provider: webhookEvents.provider,
        type: webhookEvents.type,
        payload: webhookEvents.payload,
        attempts: webhookEvents.attempts,
      });
    if (row) claimed.push({ ...row, token });
  }
  return claimed;
}

export type StuckEvent = {
  id: string;
  provider: string;
  type: string;
  attempts: number;
  claimedAt: Date | null;
  lastError: string | null;
};

/**
 * READ-ONLY reconciliation: events that look abandoned or stuck. Safe to run
 * against production.
 *
 *  - "processing" past its lease: the handler died; recovery will retry it.
 *  - "received" with attempts above zero: it has failed at least once; once
 *    at MAX_RECOVERY_ATTEMPTS it is only retried by a provider redelivery,
 *    and needs a person.
 */
export async function findStuckWebhookEvents(
  options: { now?: Date; limit?: number } = {},
): Promise<StuckEvent[]> {
  const now = options.now ?? new Date();
  const staleBefore = new Date(now.getTime() - LEASE_SECONDS * 1000);

  return db
    .select({
      id: webhookEvents.id,
      provider: webhookEvents.provider,
      type: webhookEvents.type,
      attempts: webhookEvents.attempts,
      claimedAt: webhookEvents.claimedAt,
      lastError: webhookEvents.lastError,
    })
    .from(webhookEvents)
    .where(
      or(
        and(
          eq(webhookEvents.status, "processing"),
          lt(webhookEvents.claimedAt, staleBefore),
        ),
        and(
          eq(webhookEvents.status, "received"),
          raw`${webhookEvents.attempts} > 0`,
        ),
      ),
    )
    .orderBy(webhookEvents.processedAt)
    .limit(options.limit ?? 100);
}
