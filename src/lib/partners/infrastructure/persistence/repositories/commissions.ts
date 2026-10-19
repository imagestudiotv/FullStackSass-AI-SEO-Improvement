import { and, asc, eq, gt, inArray, lt, lte, ne, sql } from "drizzle-orm";

import { partnerCommissions, partnerLedgerEntries, partnerPaymentFacts } from "@/lib/db/schema";
import type { Executor } from "@/lib/db/types";

import type { CommissionStatus, ReviewState } from "../../../domain/entities/commission";
import type {
  CommissionRecord,
  CommissionRepository,
  Environment,
  PaymentFactRecord,
} from "../../../application/ports/repositories";

const ZERO = BigInt(0);

function toFact(row: typeof partnerPaymentFacts.$inferSelect): PaymentFactRecord {
  return {
    id: row.id,
    environment: row.environment as Environment,
    invoicePaymentId: row.invoicePaymentId,
    invoiceId: row.invoiceId,
    paymentIntentId: row.paymentIntentId,
    chargeId: row.chargeId,
    organizationId: row.organizationId,
    attributionId: row.attributionId,
    currency: row.currency,
    cashCollected: row.cashCollected,
    eligibleBase: row.eligibleBase,
    taxShare: row.taxShare,
    paidAt: row.paidAt,
    refundedAmount: row.refundedAmount,
    disputeLostAmount: row.disputeLostAmount,
    disputeId: row.disputeId,
    disputeStatus: row.disputeStatus,
    outcome: row.outcome,
  };
}

export function toCommission(row: typeof partnerCommissions.$inferSelect): CommissionRecord {
  return {
    id: row.id,
    environment: row.environment as Environment,
    partnerId: row.partnerId,
    attributionId: row.attributionId,
    paymentFactId: row.paymentFactId,
    currency: row.currency,
    baseAmount: row.baseAmount,
    rateBasisPoints: row.rateBasisPoints,
    tierKey: row.tierKey,
    amount: row.amount,
    reversedAmount: row.reversedAmount,
    programVersion: row.programVersion,
    earnedAt: row.earnedAt,
    maturesAt: row.maturesAt,
    status: row.status as CommissionStatus,
    reviewState: row.reviewState as ReviewState,
    holdReason: row.holdReason,
    paidSettlementId: row.paidSettlementId,
  };
}

export function commissionRepository(db: Executor): CommissionRepository {
  return {
    async findFact(environment, invoicePaymentId) {
      const [row] = await db
        .select()
        .from(partnerPaymentFacts)
        .where(and(eq(partnerPaymentFacts.environment, environment), eq(partnerPaymentFacts.invoicePaymentId, invoicePaymentId)))
        .limit(1);
      return row ? toFact(row) : null;
    },
    async lockFact(id) {
      const [row] = await db.select().from(partnerPaymentFacts).where(eq(partnerPaymentFacts.id, id)).for("no key update");
      return row ? toFact(row) : null;
    },
    async factsByCharge(environment, chargeId) {
      const rows = await db
        .select()
        .from(partnerPaymentFacts)
        .where(and(eq(partnerPaymentFacts.environment, environment), eq(partnerPaymentFacts.chargeId, chargeId)))
        .orderBy(asc(partnerPaymentFacts.paidAt));
      return rows.map(toFact);
    },
    async factsByInvoice(environment, invoiceId) {
      const rows = await db
        .select()
        .from(partnerPaymentFacts)
        .where(and(eq(partnerPaymentFacts.environment, environment), eq(partnerPaymentFacts.invoiceId, invoiceId)))
        .orderBy(asc(partnerPaymentFacts.paidAt));
      return rows.map(toFact);
    },
    async createFactOrGet(input) {
      const [row] = await db
        .insert(partnerPaymentFacts)
        .values({
          environment: input.environment,
          invoicePaymentId: input.invoicePaymentId,
          invoiceId: input.invoiceId,
          paymentIntentId: input.paymentIntentId,
          chargeId: input.chargeId,
          stripeSubscriptionId: input.stripeSubscriptionId,
          stripeCustomerId: input.stripeCustomerId,
          organizationId: input.organizationId,
          attributionId: input.attributionId,
          paymentId: input.paymentId,
          currency: input.currency,
          cashCollected: input.cashCollected,
          eligibleBase: input.eligibleBase,
          taxShare: input.taxShare,
          invoiceTotal: input.invoiceTotal,
          invoiceTax: input.invoiceTax,
          invoiceDiscount: input.invoiceDiscount,
          invoiceSubtotal: input.invoiceSubtotal,
          invoiceStartingBalance: input.invoiceStartingBalance,
          invoiceAmountPaid: input.invoiceAmountPaid,
          paidAt: input.paidAt,
          outcome: input.outcome,
          evidence: input.evidence,
          evidenceVersion: input.evidenceVersion,
          lastSyncedAt: input.syncedAt,
          createdAt: input.syncedAt,
          updatedAt: input.syncedAt,
        })
        .onConflictDoNothing({ target: [partnerPaymentFacts.environment, partnerPaymentFacts.invoicePaymentId] })
        .returning();
      if (row) return { fact: toFact(row), created: true };
      const existing = await this.findFact(input.environment, input.invoicePaymentId);
      if (!existing) throw new Error("Payment fact conflict without an existing row");
      return { fact: existing, created: false };
    },
    async updateFactAdjustments(id, values) {
      await db
        .update(partnerPaymentFacts)
        .set({
          refundedAmount: values.refundedAmount,
          disputeLostAmount: values.disputeLostAmount,
          disputeId: values.disputeId,
          disputeStatus: values.disputeStatus,
          lastSyncedAt: values.syncedAt,
          updatedAt: values.syncedAt,
        })
        .where(eq(partnerPaymentFacts.id, id));
    },
    async setFactOutcome(id, outcome) {
      await db
        .update(partnerPaymentFacts)
        .set({ outcome, updatedAt: new Date() })
        .where(eq(partnerPaymentFacts.id, id));
    },
    async hasPriorCash(environment, organizationId, before, excludingFactId) {
      const [row] = await db
        .select({ id: partnerPaymentFacts.id })
        .from(partnerPaymentFacts)
        .where(
          and(
            eq(partnerPaymentFacts.environment, environment),
            eq(partnerPaymentFacts.organizationId, organizationId),
            gt(partnerPaymentFacts.cashCollected, ZERO),
            lt(partnerPaymentFacts.paidAt, before),
            ne(partnerPaymentFacts.id, excludingFactId),
          ),
        )
        .limit(1);
      return Boolean(row);
    },
    async earliestQualifyingPaidAt(environment, organizationId) {
      // Ordered select rather than min(): the column keeps Drizzle's UTC mapping.
      const [row] = await db
        .select({ paidAt: partnerPaymentFacts.paidAt })
        .from(partnerPaymentFacts)
        .where(
          and(
            eq(partnerPaymentFacts.environment, environment),
            eq(partnerPaymentFacts.organizationId, organizationId),
            gt(partnerPaymentFacts.eligibleBase, ZERO),
          ),
        )
        .orderBy(asc(partnerPaymentFacts.paidAt))
        .limit(1);
      return row?.paidAt ?? null;
    },
    async findCommissionByFact(paymentFactId) {
      const [row] = await db
        .select()
        .from(partnerCommissions)
        .where(eq(partnerCommissions.paymentFactId, paymentFactId))
        .limit(1);
      return row ? toCommission(row) : null;
    },
    async lockCommission(id) {
      const [row] = await db.select().from(partnerCommissions).where(eq(partnerCommissions.id, id)).for("no key update");
      return row ? toCommission(row) : null;
    },
    async createCommission(input) {
      const [row] = await db
        .insert(partnerCommissions)
        .values({
          environment: input.environment,
          partnerId: input.partnerId,
          attributionId: input.attributionId,
          paymentFactId: input.paymentFactId,
          currency: input.currency,
          baseAmount: input.baseAmount,
          rateBasisPoints: input.rateBasisPoints,
          tierKey: input.tierKey,
          amount: input.amount,
          programVersion: input.programVersion,
          programVersionId: input.programVersionId,
          earnedAt: input.earnedAt,
          maturesAt: input.maturesAt,
          status: input.status,
          reviewState: input.reviewState,
          holdReason: input.holdReason,
        })
        .onConflictDoNothing({ target: partnerCommissions.paymentFactId })
        .returning();
      return row ? toCommission(row) : null;
    },
    async updateCommission(id, values) {
      await db
        .update(partnerCommissions)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(partnerCommissions.id, id));
    },
    async commissionsForPartner(partnerId, environment, currency) {
      const rows = await db
        .select()
        .from(partnerCommissions)
        .where(
          and(
            eq(partnerCommissions.partnerId, partnerId),
            eq(partnerCommissions.environment, environment),
            eq(partnerCommissions.currency, currency),
          ),
        )
        .orderBy(asc(partnerCommissions.earnedAt));
      return rows.map(toCommission);
    },
    async lockPayableCandidates(partnerId, environment, currency) {
      const rows = await db
        .select()
        .from(partnerCommissions)
        .where(
          and(
            eq(partnerCommissions.partnerId, partnerId),
            eq(partnerCommissions.environment, environment),
            eq(partnerCommissions.currency, currency),
            inArray(partnerCommissions.status, ["pending", "available"]),
          ),
        )
        .orderBy(asc(partnerCommissions.maturesAt), asc(partnerCommissions.id))
        .for("no key update");
      return rows.map(toCommission);
    },
    async appendLedger(entry) {
      const rows = await db
        .insert(partnerLedgerEntries)
        .values({
          environment: entry.environment,
          partnerId: entry.partnerId,
          currency: entry.currency,
          kind: entry.kind,
          amount: entry.amount,
          operationKey: entry.operationKey,
          commissionId: entry.commissionId ?? null,
          settlementId: entry.settlementId ?? null,
          paymentFactId: entry.paymentFactId ?? null,
          reason: entry.reason,
          actor: entry.actor,
        })
        .onConflictDoNothing({ target: partnerLedgerEntries.operationKey })
        .returning({ id: partnerLedgerEntries.id });
      return rows.length > 0;
    },
    async ledgerSum(partnerId, environment, currency) {
      const [row] = await db
        .select({
          liability: sql<string>`coalesce(sum(${partnerLedgerEntries.amount}), 0)::text`,
          netEarned: sql<string>`coalesce(sum(${partnerLedgerEntries.amount}) filter (where ${partnerLedgerEntries.kind} in ('commission_earned', 'commission_adjustment')), 0)::text`,
          netTransferred: sql<string>`coalesce(-sum(${partnerLedgerEntries.amount}) filter (where ${partnerLedgerEntries.kind} in ('transfer_confirmed', 'transfer_reversal')), 0)::text`,
        })
        .from(partnerLedgerEntries)
        .where(
          and(
            eq(partnerLedgerEntries.partnerId, partnerId),
            eq(partnerLedgerEntries.environment, environment),
            eq(partnerLedgerEntries.currency, currency),
          ),
        );
      return {
        liability: BigInt(row?.liability ?? "0"),
        netEarned: BigInt(row?.netEarned ?? "0"),
        netTransferred: BigInt(row?.netTransferred ?? "0"),
      };
    },
    async ledgerTotalFor(commissionId, kind) {
      const [row] = await db
        .select({ total: sql<string>`coalesce(sum(${partnerLedgerEntries.amount}), 0)::text` })
        .from(partnerLedgerEntries)
        .where(and(eq(partnerLedgerEntries.commissionId, commissionId), eq(partnerLedgerEntries.kind, kind)));
      return BigInt(row?.total ?? "0");
    },
    async countLedger(commissionId, kind) {
      const [row] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(partnerLedgerEntries)
        .where(and(eq(partnerLedgerEntries.commissionId, commissionId), eq(partnerLedgerEntries.kind, kind)));
      return Number(row?.n ?? 0);
    },
    async balancesToConsider(environment) {
      const rows = await db
        .selectDistinct({ partnerId: partnerLedgerEntries.partnerId, currency: partnerLedgerEntries.currency })
        .from(partnerLedgerEntries)
        .where(eq(partnerLedgerEntries.environment, environment));
      return rows;
    },
    async pendingMaturity(environment, now) {
      const rows = await db
        .select({ id: partnerCommissions.id })
        .from(partnerCommissions)
        .where(
          and(
            eq(partnerCommissions.environment, environment),
            eq(partnerCommissions.status, "pending"),
            lte(partnerCommissions.maturesAt, now),
          ),
        )
        .orderBy(asc(partnerCommissions.maturesAt));
      return rows.map((row) => row.id);
    },
  };
}
