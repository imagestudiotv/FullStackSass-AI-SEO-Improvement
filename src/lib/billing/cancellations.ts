import { randomUUID } from "node:crypto";

import { and, eq, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";

import { providerCancellations } from "@/lib/db/schema";
import type { Database, Executor } from "@/lib/db/types";

/**
 * Provider cancellations we owe, worked off until the provider confirms.
 *
 * WHY. A subscription that activates for a website or workspace that no
 * longer exists - a checkout opened before the deletion and completed after
 * it - has nothing to pay for and must be cancelled at the provider. That
 * used to happen inline after the webhook's transaction, with a failure
 * logged and "the next event for that subscription will retry". The next
 * event may never come: a subscription that activated and then went quiet
 * would bill every month with the only record of the obligation in a log.
 *
 * NOW. The obligation is a ROW, written in the same transaction that records
 * the subscription, so it exists exactly when the decision to cancel does.
 * It is worked off with backoff by processCancellations - straight after the
 * webhook commits, and every few minutes by the billing-maintenance job -
 * independent of any further event. A worker holds a row by token while it
 * calls the provider, so two workers never cancel the same subscription at
 * once, and the provider call is itself idempotent (it asks first; Stripe's
 * cancel carries an idempotency key; PayPal's is only sent to a live one).
 *
 * Only subscriptions for DELETED websites or workspaces are ever owed.
 * Duplicates are reported for reconciliation (reconciliation.ts) and never
 * cancelled here: which one a customer keeps is theirs to say.
 */

export type CancellationOutcome =
  /** The provider now reports it cancelled. */
  | "cancelled"
  /** It had already ended, or the provider has no such subscription. */
  | "already_ended"
  /**
   * It cannot be cancelled yet - a PayPal subscription still awaiting the
   * buyer's approval. Retried later: an approval can still turn into a live
   * subscription.
   */
  | "not_cancellable_yet";

export type CancellationOps = {
  cancel(
    provider: string,
    providerSubscriptionId: string,
    reason: string,
  ): Promise<CancellationOutcome>;
};

/** Attempts before an obligation is given up on and left for a person. */
export const MAX_CANCELLATION_ATTEMPTS = 25;

/** How long one worker may hold a row while calling the provider. */
const CLAIM_SECONDS = 120;

/** 1m, 2m, 4m ... capped at 6h: about four days across all attempts. */
export function cancellationBackoffMs(attempts: number): number {
  return Math.min(60_000 * 2 ** Math.max(attempts - 1, 0), 6 * 60 * 60 * 1000);
}

/**
 * Records that a subscription must be cancelled. Call inside the transaction
 * that decides it. Owing it twice is one obligation; a completed one stays
 * completed.
 */
export async function oweCancellation(
  tx: Executor,
  input: { provider: string; providerSubscriptionId: string; reason: string },
): Promise<void> {
  await tx
    .insert(providerCancellations)
    .values({
      provider: input.provider,
      providerSubscriptionId: input.providerSubscriptionId,
      reason: input.reason,
      status: "pending",
      nextAttemptAt: new Date(),
    })
    .onConflictDoNothing({
      target: [providerCancellations.provider, providerCancellations.providerSubscriptionId],
    });
}

export type ProcessResult = {
  completed: string[];
  retrying: string[];
  abandoned: string[];
};

/**
 * Works off due obligations. Never throws: it runs after a webhook has
 * committed and from a scheduled job, and a provider outage must only
 * postpone the work.
 *
 * `only` limits it to named subscriptions - the webhook passes the one it
 * just decided to cancel, so the common case finishes within the request.
 */
export async function processCancellations(
  database: Database,
  ops: CancellationOps,
  options: { now?: Date; limit?: number; only?: string[] } = {},
): Promise<ProcessResult> {
  const now = options.now ?? new Date();
  const result: ProcessResult = { completed: [], retrying: [], abandoned: [] };

  let claimed: (typeof providerCancellations.$inferSelect)[] = [];
  try {
    const token = randomUUID();
    const due = database
      .select({ id: providerCancellations.id })
      .from(providerCancellations)
      .where(
        and(
          eq(providerCancellations.status, "pending"),
          lte(providerCancellations.nextAttemptAt, now),
          or(
            isNull(providerCancellations.claimedUntil),
            lt(providerCancellations.claimedUntil, now),
          ),
          options.only?.length
            ? inArray(providerCancellations.providerSubscriptionId, options.only)
            : undefined,
        ),
      )
      .orderBy(providerCancellations.nextAttemptAt)
      .limit(options.limit ?? 25);

    /*
      One conditional UPDATE claims the batch: a row another worker holds
      (claimed_until in the future) or already finished does not match, so
      two workers never take the same row.
    */
    claimed = await database
      .update(providerCancellations)
      .set({
        claimToken: token,
        claimedUntil: new Date(now.getTime() + CLAIM_SECONDS * 1000),
        attempts: sql`${providerCancellations.attempts} + 1`,
        updatedAt: now,
      })
      .where(
        and(
          inArray(providerCancellations.id, due),
          eq(providerCancellations.status, "pending"),
          or(
            isNull(providerCancellations.claimedUntil),
            lt(providerCancellations.claimedUntil, now),
          ),
        ),
      )
      .returning();
  } catch (error) {
    console.error("[cancellations] could not claim owed cancellations", error);
    return result;
  }

  for (const row of claimed) {
    const mine = and(
      eq(providerCancellations.id, row.id),
      eq(providerCancellations.claimToken, row.claimToken!),
    );
    let outcome: CancellationOutcome | null = null;
    let failure: string | null = null;
    try {
      outcome = await ops.cancel(row.provider, row.providerSubscriptionId, row.reason);
    } catch (error) {
      failure = error instanceof Error ? error.message : "cancel failed";
    }

    try {
      if (outcome === "cancelled" || outcome === "already_ended") {
        await database
          .update(providerCancellations)
          .set({
            status: "completed",
            completedAt: new Date(),
            claimToken: null,
            claimedUntil: null,
            lastError: null,
            updatedAt: new Date(),
          })
          .where(mine);
        result.completed.push(row.providerSubscriptionId);
        console.warn(
          `[cancellations] ${row.provider} ${row.providerSubscriptionId} ${outcome} (${row.reason})`,
        );
        continue;
      }

      const giveUp = row.attempts >= MAX_CANCELLATION_ATTEMPTS;
      await database
        .update(providerCancellations)
        .set({
          status: giveUp ? "abandoned" : "pending",
          nextAttemptAt: new Date(Date.now() + cancellationBackoffMs(row.attempts)),
          claimToken: null,
          claimedUntil: null,
          lastError: (failure ?? `provider said ${outcome}`).slice(0, 500),
          updatedAt: new Date(),
        })
        .where(mine);
      (giveUp ? result.abandoned : result.retrying).push(row.providerSubscriptionId);
      console.error(
        `[cancellations] ${row.provider} ${row.providerSubscriptionId} not cancelled yet (attempt ${row.attempts}${giveUp ? ", given up - needs a person" : ""}): ${failure ?? outcome}`,
      );
    } catch (error) {
      // The claim expires on its own and the row is retried.
      console.error(`[cancellations] could not record the outcome for ${row.id}`, error);
    }
  }
  return result;
}
