import { and, asc, desc, eq, inArray, isNull, lt, lte, or, sql, type SQL } from "drizzle-orm";

import {
  partnerBalanceProjections,
  partnerBankPayoutAttempts,
  partnerSettlementItems,
  partnerSettlements,
  partnerTransferAttempts,
  partnerTransferReversals,
} from "@/lib/db/schema";
import type { Executor } from "@/lib/db/types";

import type { BankPayoutStatus, SettlementState, TransferStatus } from "../../../domain/entities/settlement";
import { PRE_TRANSFER_STATES } from "../../../domain/entities/settlement";
import type {
  BankPayoutAttemptRecord,
  Environment,
  SettlementRecord,
  SettlementRepository,
  TransferAttemptRecord,
  TransferReversalRecord,
} from "../../../application/ports/repositories";


function toSettlement(row: typeof partnerSettlements.$inferSelect): SettlementRecord {
  return {
    id: row.id,
    environment: row.environment as Environment,
    partnerId: row.partnerId,
    currency: row.currency,
    runKey: row.runKey,
    state: row.state as SettlementState,
    grossAmount: row.grossAmount,
    offsetAmount: row.offsetAmount,
    transferAmount: row.transferAmount,
    stripeAccountId: row.stripeAccountId,
    transferGroup: row.transferGroup,
    attempts: row.attempts,
    nextAttemptAt: row.nextAttemptAt,
    lastError: row.lastError,
    createdAt: row.createdAt,
    transferredAt: row.transferredAt,
    paidAt: row.paidAt,
  };
}

function toTransfer(row: typeof partnerTransferAttempts.$inferSelect): TransferAttemptRecord {
  return {
    id: row.id,
    settlementId: row.settlementId,
    attemptNumber: row.attemptNumber,
    operationId: row.operationId,
    environment: row.environment as Environment,
    stripeAccountId: row.stripeAccountId,
    currency: row.currency,
    amount: row.amount,
    status: row.status as TransferStatus,
    stripeTransferId: row.stripeTransferId,
    amountReversed: row.amountReversed,
    submittedAt: row.submittedAt,
    updatedAt: row.updatedAt,
  };
}

function toPayout(row: typeof partnerBankPayoutAttempts.$inferSelect): BankPayoutAttemptRecord {
  return {
    id: row.id,
    settlementId: row.settlementId,
    attemptNumber: row.attemptNumber,
    operationId: row.operationId,
    environment: row.environment as Environment,
    stripeAccountId: row.stripeAccountId,
    currency: row.currency,
    amount: row.amount,
    status: row.status as BankPayoutStatus,
    stripePayoutId: row.stripePayoutId,
    submittedAt: row.submittedAt,
    updatedAt: row.updatedAt,
  };
}

function toReversal(row: typeof partnerTransferReversals.$inferSelect): TransferReversalRecord {
  return {
    id: row.id,
    transferAttemptId: row.transferAttemptId,
    operationId: row.operationId,
    amount: row.amount,
    currency: row.currency,
    status: row.status as TransferReversalRecord["status"],
    stripeReversalId: row.stripeReversalId,
  };
}

export function settlementRepository(db: Executor): SettlementRepository {
  return {
    async lockBalance(partnerId, environment, currency, now) {
      await db
        .insert(partnerBalanceProjections)
        .values({ partnerId, environment, currency, rebuiltAt: now })
        .onConflictDoNothing();
      await db
        .select({ partnerId: partnerBalanceProjections.partnerId })
        .from(partnerBalanceProjections)
        .where(
          and(
            eq(partnerBalanceProjections.partnerId, partnerId),
            eq(partnerBalanceProjections.environment, environment),
            eq(partnerBalanceProjections.currency, currency),
          ),
        )
        .for("no key update");
    },
    async writeProjection(partnerId, environment, currency, values) {
      await db
        .insert(partnerBalanceProjections)
        .values({ partnerId, environment, currency, ...values })
        .onConflictDoUpdate({
          target: [partnerBalanceProjections.partnerId, partnerBalanceProjections.environment, partnerBalanceProjections.currency],
          set: values,
        });
    },
    async reservedInFlight(partnerId, environment, currency) {
      const [row] = await db
        .select({ total: sql<string>`coalesce(sum(${partnerSettlementItems.amount}), 0)::text` })
        .from(partnerSettlementItems)
        .innerJoin(partnerSettlements, eq(partnerSettlements.id, partnerSettlementItems.settlementId))
        .where(
          and(
            eq(partnerSettlements.partnerId, partnerId),
            eq(partnerSettlements.environment, environment),
            eq(partnerSettlements.currency, currency),
            eq(partnerSettlementItems.active, true),
            inArray(partnerSettlements.state, [...PRE_TRANSFER_STATES]),
          ),
        );
      return BigInt(row?.total ?? "0");
    },
    async bankPaidTotal(partnerId, environment, currency) {
      const [row] = await db
        .select({ total: sql<string>`coalesce(sum(${partnerBankPayoutAttempts.amount}), 0)::text` })
        .from(partnerBankPayoutAttempts)
        .innerJoin(partnerSettlements, eq(partnerSettlements.id, partnerBankPayoutAttempts.settlementId))
        .where(
          and(
            eq(partnerSettlements.partnerId, partnerId),
            eq(partnerSettlements.environment, environment),
            eq(partnerSettlements.currency, currency),
            eq(partnerBankPayoutAttempts.status, "paid"),
          ),
        );
      return BigInt(row?.total ?? "0");
    },
    async create(input) {
      const [row] = await db
        .insert(partnerSettlements)
        .values({
          environment: input.environment,
          partnerId: input.partnerId,
          currency: input.currency,
          runKey: input.runKey,
          state: "reserved",
          grossAmount: input.grossAmount,
          offsetAmount: input.offsetAmount,
          transferAmount: input.transferAmount,
          stripeAccountId: input.stripeAccountId,
          transferGroup: input.transferGroup,
          createdBy: input.createdBy,
          nextAttemptAt: input.now,
          createdAt: input.now,
          updatedAt: input.now,
        })
        .onConflictDoNothing()
        .returning();
      if (!row) return null;
      if (input.items.length > 0) {
        await db.insert(partnerSettlementItems).values(
          input.items.map((item) => ({
            settlementId: row.id,
            commissionId: item.commissionId,
            amount: item.amount,
            active: true,
            createdAt: input.now,
          })),
        );
      }
      return toSettlement(row);
    },
    async findById(id) {
      const [row] = await db.select().from(partnerSettlements).where(eq(partnerSettlements.id, id)).limit(1);
      return row ? toSettlement(row) : null;
    },
    async lock(id) {
      const [row] = await db.select().from(partnerSettlements).where(eq(partnerSettlements.id, id)).for("no key update");
      return row ? toSettlement(row) : null;
    },
    async claim(id, token, until, now) {
      const [row] = await db
        .update(partnerSettlements)
        .set({ claimToken: token, claimedUntil: until, attempts: sql`${partnerSettlements.attempts} + 1`, updatedAt: now })
        .where(
          and(
            eq(partnerSettlements.id, id),
            or(isNull(partnerSettlements.claimedUntil), lt(partnerSettlements.claimedUntil, now)),
          ),
        )
        .returning();
      return row ? toSettlement(row) : null;
    },
    async releaseClaim(id, token, values) {
      await db
        .update(partnerSettlements)
        .set({
          claimToken: null,
          claimedUntil: null,
          nextAttemptAt: values.nextAttemptAt,
          lastError: values.lastError,
          updatedAt: new Date(),
        })
        .where(and(eq(partnerSettlements.id, id), eq(partnerSettlements.claimToken, token)));
    },
    async setState(id, from, to, values = {}) {
      const rows = await db
        .update(partnerSettlements)
        .set({
          state: to,
          ...(values.transferredAt ? { transferredAt: values.transferredAt } : {}),
          ...(values.paidAt ? { paidAt: values.paidAt } : {}),
          ...(values.canceledReason ? { canceledReason: values.canceledReason } : {}),
          ...(values.reviewReason ? { reviewReason: values.reviewReason } : {}),
          ...(values.lastError !== undefined ? { lastError: values.lastError } : {}),
          updatedAt: new Date(),
        })
        .where(and(eq(partnerSettlements.id, id), inArray(partnerSettlements.state, from)))
        .returning({ id: partnerSettlements.id });
      return rows.length > 0;
    },
    async items(settlementId, activeOnly = false) {
      const rows = await db
        .select({
          commissionId: partnerSettlementItems.commissionId,
          amount: partnerSettlementItems.amount,
          active: partnerSettlementItems.active,
        })
        .from(partnerSettlementItems)
        .where(
          activeOnly
            ? and(eq(partnerSettlementItems.settlementId, settlementId), eq(partnerSettlementItems.active, true))
            : eq(partnerSettlementItems.settlementId, settlementId),
        )
        .orderBy(asc(partnerSettlementItems.createdAt), asc(partnerSettlementItems.id));
      return rows;
    },
    async deactivateItems(settlementId) {
      await db
        .update(partnerSettlementItems)
        .set({ active: false })
        .where(eq(partnerSettlementItems.settlementId, settlementId));
    },
    async due(now, limit) {
      const rows = await db
        .select({ id: partnerSettlements.id })
        .from(partnerSettlements)
        .where(
          and(
            inArray(partnerSettlements.state, [
              "reserved",
              "transfer_processing",
              "transfer_unknown",
              "transferred",
              "payout_pending",
              "payout_in_transit",
              "payout_failed",
            ]),
            lte(partnerSettlements.nextAttemptAt, now),
            or(isNull(partnerSettlements.claimedUntil), lt(partnerSettlements.claimedUntil, now)),
          ),
        )
        .orderBy(asc(partnerSettlements.nextAttemptAt))
        .limit(limit);
      return rows.map((row) => row.id);
    },
    async list(filter) {
      const conditions: SQL[] = [eq(partnerSettlements.environment, filter.environment)];
      if (filter.partnerId) conditions.push(eq(partnerSettlements.partnerId, filter.partnerId));
      if (filter.state) conditions.push(eq(partnerSettlements.state, filter.state));
      const where = and(...conditions);
      const [rows, [count]] = await Promise.all([
        db
          .select()
          .from(partnerSettlements)
          .where(where)
          .orderBy(desc(partnerSettlements.createdAt))
          .offset(filter.offset)
          .limit(filter.limit),
        db.select({ n: sql<number>`count(*)::int` }).from(partnerSettlements).where(where),
      ]);
      return { rows: rows.map(toSettlement), total: Number(count?.n ?? 0) };
    },

    async transferAttempts(settlementId) {
      const rows = await db
        .select()
        .from(partnerTransferAttempts)
        .where(eq(partnerTransferAttempts.settlementId, settlementId))
        .orderBy(asc(partnerTransferAttempts.attemptNumber));
      return rows.map(toTransfer);
    },
    async createTransferAttempt(input) {
      const [row] = await db
        .insert(partnerTransferAttempts)
        .values({
          settlementId: input.settlementId,
          attemptNumber: input.attemptNumber,
          operationId: input.operationId,
          environment: input.environment,
          stripeAccountId: input.stripeAccountId,
          currency: input.currency,
          amount: input.amount,
          status: "processing",
          submittedAt: input.submittedAt,
          createdAt: input.submittedAt,
          updatedAt: input.submittedAt,
        })
        .onConflictDoNothing()
        .returning();
      return row ? toTransfer(row) : null;
    },
    async updateTransferAttempt(id, from, values) {
      const rows = await db
        .update(partnerTransferAttempts)
        .set({
          status: values.status,
          ...(values.stripeTransferId !== undefined ? { stripeTransferId: values.stripeTransferId } : {}),
          ...(values.stripeBalanceTransactionId !== undefined
            ? { stripeBalanceTransactionId: values.stripeBalanceTransactionId }
            : {}),
          ...(values.amountReversed !== undefined ? { amountReversed: values.amountReversed } : {}),
          ...(values.failureCode !== undefined ? { failureCode: values.failureCode } : {}),
          ...(values.failureMessage !== undefined ? { failureMessage: values.failureMessage } : {}),
          ...(values.confirmedAt !== undefined ? { confirmedAt: values.confirmedAt } : {}),
          lastCheckedAt: values.checkedAt,
          updatedAt: values.checkedAt,
        })
        .where(and(eq(partnerTransferAttempts.id, id), inArray(partnerTransferAttempts.status, from)))
        .returning({ id: partnerTransferAttempts.id });
      return rows.length > 0;
    },
    async findTransferAttemptByStripeId(stripeTransferId) {
      const [row] = await db
        .select()
        .from(partnerTransferAttempts)
        .where(eq(partnerTransferAttempts.stripeTransferId, stripeTransferId))
        .limit(1);
      return row ? toTransfer(row) : null;
    },

    async payoutAttempts(settlementId) {
      const rows = await db
        .select()
        .from(partnerBankPayoutAttempts)
        .where(eq(partnerBankPayoutAttempts.settlementId, settlementId))
        .orderBy(asc(partnerBankPayoutAttempts.attemptNumber));
      return rows.map(toPayout);
    },
    async createPayoutAttempt(input) {
      const [row] = await db
        .insert(partnerBankPayoutAttempts)
        .values({
          settlementId: input.settlementId,
          attemptNumber: input.attemptNumber,
          operationId: input.operationId,
          environment: input.environment,
          stripeAccountId: input.stripeAccountId,
          currency: input.currency,
          amount: input.amount,
          status: "unknown",
          submittedAt: input.submittedAt,
          createdAt: input.submittedAt,
          updatedAt: input.submittedAt,
        })
        .onConflictDoNothing()
        .returning();
      return row ? toPayout(row) : null;
    },
    async updatePayoutAttempt(id, from, values) {
      const rows = await db
        .update(partnerBankPayoutAttempts)
        .set({
          status: values.status,
          ...(values.stripePayoutId !== undefined ? { stripePayoutId: values.stripePayoutId } : {}),
          ...(values.arrivalDate !== undefined ? { arrivalDate: values.arrivalDate } : {}),
          ...(values.failureCode !== undefined ? { failureCode: values.failureCode } : {}),
          ...(values.failureMessage !== undefined ? { failureMessage: values.failureMessage } : {}),
          ...(values.paidAt !== undefined ? { paidAt: values.paidAt } : {}),
          ...(values.failedAt !== undefined ? { failedAt: values.failedAt } : {}),
          lastCheckedAt: values.checkedAt,
          updatedAt: values.checkedAt,
        })
        .where(and(eq(partnerBankPayoutAttempts.id, id), inArray(partnerBankPayoutAttempts.status, from)))
        .returning({ id: partnerBankPayoutAttempts.id });
      return rows.length > 0;
    },
    async findPayoutAttemptByStripeId(stripeAccountId, stripePayoutId) {
      const [row] = await db
        .select()
        .from(partnerBankPayoutAttempts)
        .where(
          and(
            eq(partnerBankPayoutAttempts.stripeAccountId, stripeAccountId),
            eq(partnerBankPayoutAttempts.stripePayoutId, stripePayoutId),
          ),
        )
        .limit(1);
      return row ? toPayout(row) : null;
    },

    async createReversal(input) {
      const [row] = await db
        .insert(partnerTransferReversals)
        .values({
          transferAttemptId: input.transferAttemptId,
          operationId: input.operationId,
          amount: input.amount,
          currency: input.currency,
          reason: input.reason,
          requestedBy: input.requestedBy,
          status: "processing",
        })
        .onConflictDoNothing()
        .returning();
      return row ? toReversal(row) : null;
    },
    async updateReversal(id, values) {
      await db
        .update(partnerTransferReversals)
        .set({
          status: values.status,
          ...(values.stripeReversalId !== undefined ? { stripeReversalId: values.stripeReversalId } : {}),
          ...(values.failureMessage !== undefined ? { failureMessage: values.failureMessage } : {}),
          ...(values.confirmedAt !== undefined ? { confirmedAt: values.confirmedAt } : {}),
          updatedAt: new Date(),
        })
        .where(eq(partnerTransferReversals.id, id));
    },
    async reversals(transferAttemptId) {
      const rows = await db
        .select()
        .from(partnerTransferReversals)
        .where(eq(partnerTransferReversals.transferAttemptId, transferAttemptId))
        .orderBy(asc(partnerTransferReversals.createdAt));
      return rows.map(toReversal);
    },
  };
}
