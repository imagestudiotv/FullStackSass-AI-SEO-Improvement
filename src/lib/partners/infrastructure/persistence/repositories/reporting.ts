import { and, desc, eq, gte, isNotNull, lt, ne, notInArray, sql, type SQL } from "drizzle-orm";

import {
  partnerAttributions,
  partnerBalanceProjections,
  partnerBankPayoutAttempts,
  partnerClicks,
  partnerCommissions,
  partnerLedgerEntries,
  partnerPaymentFacts,
  partnerSettlements,
  partnerSignupEligibility,
  partnerTransferAttempts,
} from "@/lib/db/schema";
import type { Executor } from "@/lib/db/types";

import type { AttributionSource, AttributionStatus } from "../../../domain/entities/attribution";
import type { CommissionStatus, ReviewState } from "../../../domain/entities/commission";
import type { BankPayoutStatus, SettlementState, TransferStatus } from "../../../domain/entities/settlement";
import type { Environment, LedgerView, ReportingRepository } from "../../../application/ports/repositories";

const count = sql<number>`count(*)::int`;

/** Read models for the partner portal and the admin area. */
export function reportingRepository(db: Executor): ReportingRepository {
  return {
    async balances(partnerId, environment) {
      const rows = await db
        .select()
        .from(partnerBalanceProjections)
        .where(and(eq(partnerBalanceProjections.partnerId, partnerId), eq(partnerBalanceProjections.environment, environment)));
      return rows.map((row) => ({
        currency: row.currency,
        netEarned: row.netEarned,
        netTransferred: row.netTransferred,
        liability: row.liability,
        pending: row.pending,
        available: row.available,
        reserved: row.reserved,
        held: row.held,
        bankPaid: row.bankPaid,
        rebuiltAt: row.rebuiltAt,
      }));
    },

    async currencies(partnerId, environment) {
      const rows = await db
        .selectDistinct({ currency: partnerLedgerEntries.currency })
        .from(partnerLedgerEntries)
        .where(and(eq(partnerLedgerEntries.partnerId, partnerId), eq(partnerLedgerEntries.environment, environment)));
      return rows.map((row) => row.currency).sort();
    },

    async metrics(partnerId, environment, since) {
      /*
        Definitions (shown on the dashboard), each counted inside the range:
        clicks = partner-link opens recorded; new accounts = new signups the
        link rule attributed; customers = workspaces attributed (link or
        coupon); paying customers = attributed workspaces with at least one
        commissioned payment in the range.
      */
      const [[clicks], [signups], [customers], [paying]] = await Promise.all([
        db.select({ n: count }).from(partnerClicks).where(and(eq(partnerClicks.partnerId, partnerId), gte(partnerClicks.clickedAt, since))),
        db
          .select({ n: count })
          .from(partnerSignupEligibility)
          .where(
            and(
              eq(partnerSignupEligibility.candidatePartnerId, partnerId),
              eq(partnerSignupEligibility.linkOutcome, "attribute"),
              gte(partnerSignupEligibility.signedUpAt, since),
            ),
          ),
        db.select({ n: count }).from(partnerAttributions).where(and(eq(partnerAttributions.partnerId, partnerId), gte(partnerAttributions.lockedAt, since))),
        db
          .select({ n: sql<number>`count(distinct ${partnerPaymentFacts.organizationId})::int` })
          .from(partnerPaymentFacts)
          .innerJoin(partnerAttributions, eq(partnerAttributions.id, partnerPaymentFacts.attributionId))
          .where(
            and(
              eq(partnerAttributions.partnerId, partnerId),
              eq(partnerPaymentFacts.environment, environment),
              eq(partnerPaymentFacts.outcome, "commissioned"),
              gte(partnerPaymentFacts.paidAt, since),
            ),
          ),
      ]);
      return { clicks: Number(clicks?.n ?? 0), signups: Number(signups?.n ?? 0), customers: Number(customers?.n ?? 0), payingCustomers: Number(paying?.n ?? 0) };
    },

    async referralTotal(partnerId) {
      const [row] = await db
        .select({ n: count })
        .from(partnerAttributions)
        .where(and(eq(partnerAttributions.partnerId, partnerId), ne(partnerAttributions.status, "disqualified")));
      return Number(row?.n ?? 0);
    },

    async commissions(filter) {
      const conditions: SQL[] = [eq(partnerCommissions.environment, filter.environment)];
      if (filter.partnerId) conditions.push(eq(partnerCommissions.partnerId, filter.partnerId));
      if (filter.status) conditions.push(eq(partnerCommissions.status, filter.status));
      if (filter.review) conditions.push(eq(partnerCommissions.reviewState, filter.review));
      if (filter.held) conditions.push(isNotNull(partnerCommissions.holdReason));
      if (filter.from) conditions.push(gte(partnerCommissions.earnedAt, filter.from));
      if (filter.to) conditions.push(lt(partnerCommissions.earnedAt, filter.to));
      const where = and(...conditions);
      const [rows, [total]] = await Promise.all([
        db
          .select({
            id: partnerCommissions.id,
            partnerId: partnerCommissions.partnerId,
            organizationId: partnerPaymentFacts.organizationId,
            paidAt: partnerCommissions.earnedAt,
            currency: partnerCommissions.currency,
            baseAmount: partnerCommissions.baseAmount,
            rateBasisPoints: partnerCommissions.rateBasisPoints,
            tierKey: partnerCommissions.tierKey,
            amount: partnerCommissions.amount,
            reversedAmount: partnerCommissions.reversedAmount,
            status: partnerCommissions.status,
            reviewState: partnerCommissions.reviewState,
            holdReason: partnerCommissions.holdReason,
            maturesAt: partnerCommissions.maturesAt,
            settlementId: partnerCommissions.paidSettlementId,
            // The first invoice line with a price, from the evidence recorded with the payment (billing-source.ts).
            priceId: sql<string | null>`(
              select line->>'price' from jsonb_array_elements(
                case when jsonb_typeof(${partnerPaymentFacts.evidence}->'lines') = 'array' then ${partnerPaymentFacts.evidence}->'lines' else '[]'::jsonb end
              ) as line
              where line->>'price' is not null
              limit 1
            )`,
            stripeSubscriptionId: partnerPaymentFacts.stripeSubscriptionId,
          })
          .from(partnerCommissions)
          .innerJoin(partnerPaymentFacts, eq(partnerPaymentFacts.id, partnerCommissions.paymentFactId))
          .where(where)
          .orderBy(desc(partnerCommissions.earnedAt), desc(partnerCommissions.id))
          .offset(filter.offset)
          .limit(filter.limit),
        db.select({ n: count }).from(partnerCommissions).where(where),
      ]);
      return {
        rows: rows.map((row) => ({ ...row, status: row.status as CommissionStatus, reviewState: row.reviewState as ReviewState })),
        total: Number(total?.n ?? 0),
      };
    },

    async settlements(filter) {
      const conditions: SQL[] = [eq(partnerSettlements.environment, filter.environment)];
      if (filter.partnerId) conditions.push(eq(partnerSettlements.partnerId, filter.partnerId));
      if (filter.state) conditions.push(eq(partnerSettlements.state, filter.state));
      if (filter.excludeStates?.length) conditions.push(notInArray(partnerSettlements.state, filter.excludeStates));
      if (filter.from) conditions.push(gte(partnerSettlements.createdAt, filter.from));
      if (filter.to) conditions.push(lt(partnerSettlements.createdAt, filter.to));
      const where = and(...conditions);
      const [rows, [total]] = await Promise.all([
        db.select().from(partnerSettlements).where(where).orderBy(desc(partnerSettlements.createdAt)).offset(filter.offset).limit(filter.limit),
        db.select({ n: count }).from(partnerSettlements).where(where),
      ]);
      const views = [];
      for (const row of rows) {
        const [transfer] = await db
          .select({ status: partnerTransferAttempts.status, id: partnerTransferAttempts.stripeTransferId })
          .from(partnerTransferAttempts)
          .where(eq(partnerTransferAttempts.settlementId, row.id))
          .orderBy(desc(partnerTransferAttempts.attemptNumber))
          .limit(1);
        const [bank] = await db
          .select({ status: partnerBankPayoutAttempts.status, paidAt: partnerBankPayoutAttempts.paidAt, arrival: partnerBankPayoutAttempts.arrivalDate })
          .from(partnerBankPayoutAttempts)
          .where(eq(partnerBankPayoutAttempts.settlementId, row.id))
          .orderBy(desc(partnerBankPayoutAttempts.attemptNumber))
          .limit(1);
        views.push({
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
          resumedAt: row.resumedAt,
          transferStatus: (transfer?.status as TransferStatus | undefined) ?? null,
          stripeTransferId: transfer?.id ?? null,
          bankStatus: (bank?.status as BankPayoutStatus | undefined) ?? null,
          bankPaidAt: bank?.paidAt ?? null,
          bankArrivalDate: bank?.arrival ?? null,
        });
      }
      return { rows: views, total: Number(total?.n ?? 0) };
    },

    async referrals(filter) {
      const conditions: SQL[] = [];
      if (filter.partnerId) conditions.push(eq(partnerAttributions.partnerId, filter.partnerId));
      if (filter.status) conditions.push(eq(partnerAttributions.status, filter.status));
      const where = conditions.length ? and(...conditions) : undefined;
      const [rows, [total]] = await Promise.all([
        db
          .select({
            attributionId: partnerAttributions.id,
            partnerId: partnerAttributions.partnerId,
            organizationId: partnerAttributions.organizationId,
            source: partnerAttributions.source,
            status: partnerAttributions.status,
            lockedAt: partnerAttributions.lockedAt,
            windowEndsAt: partnerAttributions.windowEndsAt,
            payments: sql<number>`(select count(*)::int from ${partnerPaymentFacts} f where f.attribution_id = ${partnerAttributions.id} and f.outcome = 'commissioned')`,
          })
          .from(partnerAttributions)
          .where(where)
          .orderBy(desc(partnerAttributions.lockedAt))
          .offset(filter.offset)
          .limit(filter.limit),
        db.select({ n: count }).from(partnerAttributions).where(where),
      ]);
      return {
        rows: rows.map((row) => ({ ...row, source: row.source as AttributionSource, status: row.status as AttributionStatus, payments: Number(row.payments) })),
        total: Number(total?.n ?? 0),
      };
    },

    async ledger(filter) {
      const conditions: SQL[] = [eq(partnerLedgerEntries.environment, filter.environment)];
      if (filter.partnerId) conditions.push(eq(partnerLedgerEntries.partnerId, filter.partnerId));
      if (filter.currency) conditions.push(eq(partnerLedgerEntries.currency, filter.currency));
      if (filter.settlementId) conditions.push(eq(partnerLedgerEntries.settlementId, filter.settlementId));
      if (filter.from) conditions.push(gte(partnerLedgerEntries.createdAt, filter.from));
      if (filter.to) conditions.push(lt(partnerLedgerEntries.createdAt, filter.to));
      const where = and(...conditions);
      const [rows, [total]] = await Promise.all([
        db
          .select({
            id: partnerLedgerEntries.id,
            partnerId: partnerLedgerEntries.partnerId,
            currency: partnerLedgerEntries.currency,
            kind: partnerLedgerEntries.kind,
            amount: partnerLedgerEntries.amount,
            operationKey: partnerLedgerEntries.operationKey,
            commissionId: partnerLedgerEntries.commissionId,
            settlementId: partnerLedgerEntries.settlementId,
            reason: partnerLedgerEntries.reason,
            actor: partnerLedgerEntries.actor,
            createdAt: partnerLedgerEntries.createdAt,
          })
          .from(partnerLedgerEntries)
          .where(where)
          .orderBy(desc(partnerLedgerEntries.createdAt), desc(partnerLedgerEntries.id))
          .offset(filter.offset)
          .limit(filter.limit),
        db.select({ n: count }).from(partnerLedgerEntries).where(where),
      ]);
      return { rows: rows.map((row) => ({ ...row, kind: row.kind as LedgerView["kind"] })), total: Number(total?.n ?? 0) };
    },
  };
}
