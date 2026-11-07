import { and, asc, eq, inArray, sql } from "drizzle-orm";

import { paymentRefunds, payments } from "@/lib/db/schema";
import type { Database, Executor } from "@/lib/db/types";

/**
 * Refunds of recorded payments, Stripe and PayPal alike (review P6).
 *
 * THE RULES, whichever provider holds the money:
 *  - A refund is RESERVED before any money moves: a payment_refunds row,
 *    written under the payment's row lock, whose amount counts against what
 *    remains refundable. Two presses, two admins or a retry cannot together
 *    send back more than was paid.
 *  - One refund of a payment in flight at a time. A second is refused while
 *    the first has no confirmed outcome ("requested" or "unknown").
 *  - The provider call carries the row's operation key as its idempotency
 *    key. A lost answer is "unknown", never "failed": repeating the SAME
 *    request with the SAME key (resolveRefund) returns what the provider did.
 *  - Refunds made in the provider's own dashboard arrive by webhook
 *    (recordProviderRefund) and are recorded once, matched to our row when
 *    they are ours.
 *  - payments.refunded_cents is recomputed from these rows, never added to.
 *    payments.status becomes "refunded" once ALL of it went back, as the
 *    PayPal webhook always recorded it; a partial refund leaves it "paid",
 *    and refunded_cents says how much. (The admin refund used to mark even a
 *    partial one "refunded"; those older rows keep their audit entry, which
 *    lib/referrals/core.ts still reads.)
 *
 * Cancelling the subscription is NOT part of a refund: a goodwill refund on a
 * customer who stays is the common case. The admin asks for it separately
 * (cancel_requested) and it happens after the money, in lib/admin/operations.ts.
 */

export type RefundablePayment = {
  id: string;
  organizationId: string;
  provider: string;
  externalId: string;
  providerObject: string | null;
  amountCents: number;
  currency: string;
  status: string;
  refundedCents: number;
};

/** What the provider said about one refund request. */
export type ProviderRefundAnswer =
  | { kind: "succeeded"; providerRefundId: string; settled: "completed" | "pending" }
  | { kind: "refused"; message: string }
  | { kind: "unknown"; message: string };

/** The provider calls, injected so tests stub them (lib/billing/refund-providers.ts has the real ones). */
export type RefundProviderOps = {
  refund(input: {
    payment: RefundablePayment;
    amountCents: number;
    operationKey: string;
    refundRowId: string;
  }): Promise<ProviderRefundAnswer>;
};

export type ReserveResult =
  | { kind: "reserved"; refundId: string; operationKey: string; amountCents: number; partial: boolean; payment: RefundablePayment }
  | { kind: "refused"; error: string; unresolvedRefundId?: string };

/** Statuses whose amount the provider has, or may have, sent back. */
const COUNTED = ["requested", "pending", "completed", "unknown"] as const;
/** Statuses with no confirmed outcome: they block another refund. */
const UNRESOLVED = ["requested", "unknown"] as const;

const paymentColumns = {
  id: payments.id,
  organizationId: payments.organizationId,
  provider: payments.provider,
  externalId: payments.externalId,
  providerObject: payments.providerObject,
  amountCents: payments.amountCents,
  currency: payments.currency,
  status: payments.status,
  refundedCents: payments.refundedCents,
};

/**
 * Reserves a refund of `amountCents` (default: all that remains) of one
 * payment. Writes nothing to the provider.
 */
export async function reserveRefund(
  database: Database,
  input: {
    paymentId: string;
    amountCents?: number;
    reason: string;
    actor: string;
    cancelRequested?: boolean;
  },
): Promise<ReserveResult> {
  return database.transaction(async (tx) => {
    const [payment] = await tx.select(paymentColumns).from(payments).where(eq(payments.id, input.paymentId)).for("update");
    if (!payment) return { kind: "refused", error: "Payment not found." };
    if (payment.provider !== "stripe" && payment.provider !== "paypal") {
      return { kind: "refused", error: `Payments through "${payment.provider}" cannot be refunded here.` };
    }
    if (payment.status !== "paid" && payment.status !== "refunded") {
      return { kind: "refused", error: `Only a paid payment can be refunded; this one is "${payment.status}".` };
    }

    const existing = await tx
      .select({ id: paymentRefunds.id, status: paymentRefunds.status, amountCents: paymentRefunds.amountCents })
      .from(paymentRefunds)
      .where(eq(paymentRefunds.paymentId, payment.id));
    const unresolved = existing.find((row) => (UNRESOLVED as readonly string[]).includes(row.status));
    if (unresolved) {
      return {
        kind: "refused",
        error: "An earlier refund of this payment has no confirmed outcome yet. Check it again before refunding more.",
        unresolvedRefundId: unresolved.id,
      };
    }

    /*
      Refunded before amounts were kept (status "refunded", nothing recorded):
      how much went back lives only on the old audit entry. Refusing is safer
      than guessing that nothing did.
    */
    if (payment.status === "refunded" && payment.refundedCents === 0 && existing.length === 0) {
      return {
        kind: "refused",
        error: "This payment was refunded before refund amounts were recorded. Refund any remainder in the provider's dashboard.",
      };
    }

    const committed = existing
      .filter((row) => (COUNTED as readonly string[]).includes(row.status))
      .reduce((sum, row) => sum + row.amountCents, 0);
    const remaining = payment.amountCents - Math.max(committed, payment.refundedCents);
    if (remaining <= 0) return { kind: "refused", error: "This payment has already been refunded in full." };

    const amountCents = input.amountCents ?? remaining;
    // Validated here as well as in the dialog: a server action is a public endpoint.
    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      return { kind: "refused", error: "Enter an amount greater than zero." };
    }
    if (amountCents > remaining) {
      return {
        kind: "refused",
        error:
          remaining === payment.amountCents
            ? "That is more than the customer paid."
            : `That is more than remains refundable (${(remaining / 100).toFixed(2)} ${payment.currency.toUpperCase()}).`,
      };
    }

    const operationKey = `refund:${payment.id}:${existing.length + 1}`;
    const [row] = await tx
      .insert(paymentRefunds)
      .values({
        paymentId: payment.id,
        organizationId: payment.organizationId,
        provider: payment.provider,
        amountCents,
        currency: payment.currency,
        status: "requested",
        source: "admin",
        operationKey,
        reason: input.reason,
        actor: input.actor,
        cancelRequested: Boolean(input.cancelRequested),
        // App clock: checkRefundAgain compares updated_at with it (a session time zone would shift a default).
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning({ id: paymentRefunds.id });

    return {
      kind: "reserved",
      refundId: row.id,
      operationKey,
      amountCents,
      // Less than the whole payment: an earlier refund, or this one, leaves money paid.
      partial: amountCents < payment.amountCents,
      payment,
    };
  });
}

export type RefundOutcome =
  | { kind: "completed" | "pending"; refundId: string; providerRefundId: string; fullyRefunded: boolean; becameFull: boolean }
  | { kind: "failed"; refundId: string; error: string }
  | { kind: "unknown"; refundId: string; error: string };

/**
 * Sends a reserved refund to its provider, or repeats an unresolved one with
 * the same key (resolveRefund), and records the answer.
 */
export async function executeRefund(database: Database, refundId: string, ops: RefundProviderOps): Promise<RefundOutcome> {
  const [row] = await database
    .select({
      id: paymentRefunds.id,
      paymentId: paymentRefunds.paymentId,
      amountCents: paymentRefunds.amountCents,
      status: paymentRefunds.status,
      operationKey: paymentRefunds.operationKey,
      providerRefundId: paymentRefunds.providerRefundId,
    })
    .from(paymentRefunds)
    .where(eq(paymentRefunds.id, refundId))
    .limit(1);
  if (!row) throw new Error(`Refund ${refundId} not found`);
  if (!(UNRESOLVED as readonly string[]).includes(row.status)) {
    throw new Error(`Refund ${refundId} is ${row.status}; only a requested or unknown refund is sent`);
  }
  const [payment] = await database.select(paymentColumns).from(payments).where(eq(payments.id, row.paymentId)).limit(1);
  if (!payment) throw new Error(`Payment ${row.paymentId} not found`);

  let answer: ProviderRefundAnswer;
  try {
    answer = await ops.refund({ payment, amountCents: row.amountCents, operationKey: row.operationKey, refundRowId: row.id });
  } catch (error) {
    // Anything the ops did not classify may have reached the provider.
    answer = { kind: "unknown", message: error instanceof Error ? error.message : "The provider call failed" };
  }

  if (answer.kind === "refused") {
    await database
      .update(paymentRefunds)
      .set({ status: "failed", error: answer.message.slice(0, 500), updatedAt: new Date() })
      .where(eq(paymentRefunds.id, row.id));
    return { kind: "failed", refundId: row.id, error: answer.message };
  }
  if (answer.kind === "unknown") {
    await database
      .update(paymentRefunds)
      .set({ status: "unknown", error: answer.message.slice(0, 500), updatedAt: new Date() })
      .where(eq(paymentRefunds.id, row.id));
    return { kind: "unknown", refundId: row.id, error: answer.message };
  }

  const settled = answer.settled;
  return database.transaction(async (tx) => {
    await tx.select({ id: payments.id }).from(payments).where(eq(payments.id, payment.id)).for("update");
    /*
      The webhook may have recorded this very refund first, as a provider row,
      if it could not tell it was ours. Fold that row into ours so the amount
      counts once.
    */
    const [twin] = await tx
      .select({ id: paymentRefunds.id })
      .from(paymentRefunds)
      .where(
        and(
          eq(paymentRefunds.provider, payment.provider),
          eq(paymentRefunds.providerRefundId, answer.providerRefundId),
          sql`${paymentRefunds.id} <> ${row.id}`,
        ),
      )
      .limit(1);
    if (twin) {
      await tx
        .update(paymentRefunds)
        .set({ providerRefundId: null, status: "failed", error: `Same refund as ${row.id}, recorded from the provider first`, updatedAt: new Date() })
        .where(eq(paymentRefunds.id, twin.id));
    }
    await tx
      .update(paymentRefunds)
      .set({
        status: settled,
        providerRefundId: answer.providerRefundId,
        error: null,
        completedAt: settled === "completed" ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(paymentRefunds.id, row.id));
    const totals = await recomputeRefunded(tx, payment.id);
    return {
      kind: settled,
      refundId: row.id,
      providerRefundId: answer.providerRefundId,
      fullyRefunded: totals.fullyRefunded,
      becameFull: totals.fullyRefunded && !totals.wasFull,
    };
  });
}

/** Repeats an unresolved refund's request with its own key, to learn what the provider did. */
export const resolveRefund = executeRefund;

/**
 * refunded_cents and status from the refund rows. Pending counts: the
 * provider has accepted to send it. Returns whether the payment is now
 * refunded in full, and whether it already was before.
 */
export async function recomputeRefunded(
  executor: Executor,
  paymentId: string,
): Promise<{ refundedCents: number; fullyRefunded: boolean; wasFull: boolean }> {
  const [payment] = await executor
    .select({ amountCents: payments.amountCents, refundedCents: payments.refundedCents, status: payments.status })
    .from(payments)
    .where(eq(payments.id, paymentId))
    .limit(1);
  if (!payment) throw new Error(`Payment ${paymentId} not found`);
  const [{ total }] = await executor
    .select({ total: sql<number>`coalesce(sum(${paymentRefunds.amountCents}), 0)::int` })
    .from(paymentRefunds)
    .where(and(eq(paymentRefunds.paymentId, paymentId), inArray(paymentRefunds.status, ["pending", "completed"])));
  const refundedCents = Math.min(Number(total), Math.max(payment.amountCents, 0));
  const wasFull = payment.amountCents > 0 && payment.refundedCents >= payment.amountCents;
  const fullyRefunded = payment.amountCents > 0 && refundedCents >= payment.amountCents;
  await executor
    .update(payments)
    .set({
      refundedCents,
      // "refunded" once ALL of it went back; a partial refund leaves it "paid", with refunded_cents saying how much.
      ...(fullyRefunded && payment.status === "paid" ? { status: "refunded" } : {}),
      updatedAt: new Date(),
    })
    .where(eq(payments.id, paymentId));
  return { refundedCents, fullyRefunded, wasFull };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ProviderRefundRecord =
  | { kind: "unknown_payment" }
  | { kind: "recorded"; paymentId: string; organizationId: string; fullyRefunded: boolean; becameFull: boolean };

/**
 * A refund (or reversal) the provider reports by webhook - made by RepGet's
 * admin, or in the provider's dashboard. Recorded once: matched to our own
 * row by the id we sent with it (PayPal invoice_number / custom_id), else by
 * the provider's refund id, else written as a new "provider" row. Replays and
 * out-of-order deliveries converge, because the status only moves forward
 * (a completed refund is never set back to pending).
 */
export async function recordProviderRefund(
  database: Database,
  input: {
    provider: "stripe" | "paypal";
    /** The payment's external id(s) the event names (PayPal: sale or capture id). */
    paymentExternalIds: string[];
    providerRefundId: string;
    amountCents: number;
    currency: string;
    settled: "completed" | "pending" | "failed";
    /** Our payment_refunds.id, echoed back by the provider, when it is ours. */
    ourRefundId?: string | null;
    reason: string;
  },
): Promise<ProviderRefundRecord> {
  const ids = input.paymentExternalIds.filter(Boolean);
  if (ids.length === 0) return { kind: "unknown_payment" };
  return database.transaction(async (tx) => {
    const [payment] = await tx
      .select({ id: payments.id, organizationId: payments.organizationId, currency: payments.currency })
      .from(payments)
      .where(and(eq(payments.provider, input.provider), inArray(payments.externalId, ids)))
      .orderBy(asc(payments.createdAt))
      .limit(1)
      .for("update");
    if (!payment) return { kind: "unknown_payment" } as const;

    const ours =
      input.ourRefundId && UUID_RE.test(input.ourRefundId)
        ? (
            await tx
              .select({ id: paymentRefunds.id, status: paymentRefunds.status })
              .from(paymentRefunds)
              .where(and(eq(paymentRefunds.id, input.ourRefundId), eq(paymentRefunds.paymentId, payment.id)))
              .limit(1)
          )[0]
        : undefined;
    const known =
      ours ??
      (
        await tx
          .select({ id: paymentRefunds.id, status: paymentRefunds.status })
          .from(paymentRefunds)
          .where(and(eq(paymentRefunds.provider, input.provider), eq(paymentRefunds.providerRefundId, input.providerRefundId)))
          .limit(1)
      )[0];

    if (known) {
      // Forward only: completed stays completed whatever arrives later.
      const next = known.status === "completed" ? "completed" : input.settled;
      await tx
        .update(paymentRefunds)
        .set({
          status: next,
          providerRefundId: input.providerRefundId,
          ...(next === "completed" ? { completedAt: new Date() } : {}),
          ...(next !== "failed" ? { error: null } : {}),
          updatedAt: new Date(),
        })
        .where(eq(paymentRefunds.id, known.id));
    } else if (input.amountCents > 0) {
      await tx
        .insert(paymentRefunds)
        .values({
          paymentId: payment.id,
          organizationId: payment.organizationId,
          provider: input.provider,
          providerRefundId: input.providerRefundId,
          amountCents: input.amountCents,
          currency: (input.currency || payment.currency).toLowerCase(),
          status: input.settled,
          source: "provider",
          operationKey: `provider-refund:${input.provider}:${input.providerRefundId}`,
          reason: input.reason,
          actor: "provider",
          completedAt: input.settled === "completed" ? new Date() : null,
        })
        .onConflictDoNothing({ target: paymentRefunds.operationKey });
    }

    const totals = await recomputeRefunded(tx, payment.id);
    return {
      kind: "recorded",
      paymentId: payment.id,
      organizationId: payment.organizationId,
      fullyRefunded: totals.fullyRefunded,
      becameFull: totals.fullyRefunded && !totals.wasFull,
    } as const;
  });
}
