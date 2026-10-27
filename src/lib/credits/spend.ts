import "server-only";

import { and, eq, inArray, isNull, sql } from "drizzle-orm";

import { recordCredit } from "@/lib/backlinks/credits";
import { db } from "@/lib/db";
import { backlinkRequests, creditLedger, creditSpends, websites } from "@/lib/db/schema";
import type { Executor } from "@/lib/db/types";

import { ACTION_NOTES, readCreditSettings, type CreditAction } from "./prices";

/**
 * Spending credits, and giving them back when what they paid for fails.
 *
 * A spend is two rows written together: a credit_spends row saying what it
 * paid for, and a negative "spend" row in the ledger (the money). Every credit
 * the workspace holds is spendable alike - plan, bought, referral and daily
 * credits - except what backlinks being placed hold (reserved). If the
 * available credits cannot cover the price, nothing is written.
 *
 * RACES. Every spend takes the workspace's credit lock - the same one
 * backlink reservations take (lib/backlinks/managed.ts) - so two spends, or
 * a spend and a reservation, can never both pass on the same credits.
 */

/** Serialises everything that takes credits from one workspace (see lib/backlinks/managed.ts). */
async function lockWorkspaceCredits(tx: Executor, organizationId: string): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`credits:${organizationId}`}))`);
}

/** The balance, what backlinks hold of it, and what is left to spend. */
export async function walletOf(
  executor: Executor,
  organizationId: string,
): Promise<{ balance: number; reserved: number; available: number }> {
  const [ledger] = await executor
    .select({ total: sql<number>`coalesce(sum(${creditLedger.amount}), 0)::int` })
    .from(creditLedger)
    .where(eq(creditLedger.organizationId, organizationId));
  const [held] = await executor
    .select({ total: sql<number>`coalesce(sum(${backlinkRequests.creditsReserved}), 0)::int` })
    .from(backlinkRequests)
    .innerJoin(websites, eq(websites.id, backlinkRequests.websiteId))
    .where(
      and(
        eq(websites.organizationId, organizationId),
        inArray(backlinkRequests.status, ["pending", "matched"]),
      ),
    );
  const balance = Number(ledger?.total ?? 0);
  const reserved = Number(held?.total ?? 0);
  return { balance, reserved, available: Math.max(balance - reserved, 0) };
}

export type ChargeInput = {
  /** The workspace that pays: the website owner's (WebsiteContext.ownerOrgId), never an invited editor's. */
  organizationId: string;
  /** What it paid for: a CREDIT_ACTIONS key, or "addon:<slug>" (lib/addons/actions.ts). */
  action: string;
  /** The price, in credits; more than 0. */
  credits: number;
  /**
   * Stable id of this one charge, e.g. "audit:<reservation id>". Charging
   * with a key already used returns that spend instead of charging again.
   */
  key: string;
  websiteId?: string | null;
  /** The ledger note, for support; the customer sees a translated name. */
  note: string;
};

export type SpendResult =
  | {
      ok: true;
      /** Null when the action is free: nothing was recorded, and there is nothing to refund. */
      spendId: string | null;
      credits: number;
    }
  | {
      ok: false;
      /** What it costs, and what the workspace has available. */
      price: number;
      available: number;
    };

/**
 * Takes `credits` from a workspace, INSIDE the caller's transaction, so the
 * charge commits with the work it pays for and rolls back with it. It takes a
 * transaction-scoped lock, so it must be given a transaction (the Executor
 * type cannot say so) - with the plain client the lock would end with its
 * statement.
 */
export async function chargeCredits(tx: Executor, input: ChargeInput, now: Date = new Date()): Promise<SpendResult> {
  if (!Number.isInteger(input.credits) || input.credits <= 0) {
    throw new Error(`A charge must be a whole number of credits above 0, not ${input.credits}`);
  }
  await lockWorkspaceCredits(tx, input.organizationId);

  const [already] = await tx
    .select({ id: creditSpends.id, credits: creditSpends.credits })
    .from(creditSpends)
    .where(eq(creditSpends.idempotencyKey, input.key))
    .limit(1);
  if (already) return { ok: true, spendId: already.id, credits: already.credits };

  const wallet = await walletOf(tx, input.organizationId);
  if (input.credits > wallet.available) {
    return { ok: false, price: input.credits, available: wallet.available };
  }

  const [spend] = await tx
    .insert(creditSpends)
    .values({
      organizationId: input.organizationId,
      websiteId: input.websiteId ?? null,
      action: input.action,
      idempotencyKey: input.key,
      credits: input.credits,
      createdAt: now,
    })
    .returning({ id: creditSpends.id });

  await recordCredit(
    input.organizationId,
    {
      type: "spend",
      amount: -input.credits,
      referenceId: spend.id,
      idempotencyKey: spendLedgerKey(spend.id),
      note: input.note,
    },
    tx,
  );

  return { ok: true, spendId: spend.id, credits: input.credits };
}

export type SpendInput = {
  organizationId: string;
  action: CreditAction;
  key: string;
  websiteId?: string | null;
};

/**
 * Charges an action at its price in Admin -> Credits (lib/credits/prices.ts).
 * An action priced 0 is free: nothing is written. Same transaction rules as
 * chargeCredits.
 */
export async function spendCredits(tx: Executor, input: SpendInput, now: Date = new Date()): Promise<SpendResult> {
  const settings = await readCreditSettings(tx);
  const price = settings.prices[input.action] ?? 0;
  if (price <= 0) {
    // A key charged before the action was made free still answers with that spend.
    const [already] = await tx
      .select({ id: creditSpends.id, credits: creditSpends.credits })
      .from(creditSpends)
      .where(eq(creditSpends.idempotencyKey, input.key))
      .limit(1);
    return already ? { ok: true, spendId: already.id, credits: already.credits } : { ok: true, spendId: null, credits: 0 };
  }
  return chargeCredits(
    tx,
    {
      organizationId: input.organizationId,
      action: input.action,
      credits: price,
      key: input.key,
      websiteId: input.websiteId,
      note: ACTION_NOTES[input.action],
    },
    now,
  );
}

/** The ledger operation ids of a spend and of its refund. */
export function spendLedgerKey(spendId: string): string {
  return `spend:${spendId}`;
}
function refundLedgerKey(spendId: string): string {
  return `spend:${spendId}:refund`;
}

/**
 * Gives back what a spend took, because what it paid for did not happen (the
 * job failed, or was never delivered). Once only: a second call for the same
 * key does nothing.
 *
 * Pass the caller's transaction to commit it with the failure it records.
 */
export async function refundSpend(
  key: string,
  executor?: Executor,
  now: Date = new Date(),
): Promise<{ refunded: boolean; credits: number }> {
  const run = async (tx: Executor) => {
    const [spend] = await tx
      .update(creditSpends)
      .set({ refundedAt: now })
      .where(and(eq(creditSpends.idempotencyKey, key), isNull(creditSpends.refundedAt)))
      .returning();
    if (!spend) return { refunded: false, credits: 0 };
    const [charged] = await tx
      .select({ note: creditLedger.note })
      .from(creditLedger)
      .where(eq(creditLedger.idempotencyKey, spendLedgerKey(spend.id)))
      .limit(1);
    await recordCredit(
      spend.organizationId,
      {
        type: "spend_refund",
        amount: spend.credits,
        referenceId: spend.id,
        idempotencyKey: refundLedgerKey(spend.id),
        note: `${charged?.note ?? ACTION_NOTES[spend.action as CreditAction] ?? spend.action}: returned, it could not be completed`,
      },
      tx,
    );
    return { refunded: true, credits: spend.credits };
  };
  return executor ? run(executor) : db.transaction(run);
}
