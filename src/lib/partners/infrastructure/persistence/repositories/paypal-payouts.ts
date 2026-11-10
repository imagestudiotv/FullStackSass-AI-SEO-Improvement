import "server-only";

import { and, asc, eq, inArray, sql } from "drizzle-orm";

import { partnerPayPalAccounts, partnerPayPalPayouts, partnerProfiles } from "@/lib/db/schema";
import type { Executor } from "@/lib/db/types";

import type {
  Environment,
  PayPalAccountRecord,
  PayPalAccountStatus,
  PayPalPayoutRecord,
  PayPalPayoutRepository,
  PayPalPayoutStatus,
} from "../../../application/ports/repositories";

function toAccount(row: typeof partnerPayPalAccounts.$inferSelect): PayPalAccountRecord {
  return {
    id: row.id,
    partnerId: row.partnerId,
    environment: row.environment as Environment,
    recipientType: "EMAIL",
    receiver: row.receiver,
    status: row.status as PayPalAccountStatus,
    verificationCodeHash: row.verificationCodeHash,
    verificationExpiresAt: row.verificationExpiresAt,
    verificationAttempts: row.verificationAttempts,
    verifiedAt: row.verifiedAt,
  };
}

function toPayout(row: typeof partnerPayPalPayouts.$inferSelect): PayPalPayoutRecord {
  return {
    id: row.id,
    settlementId: row.settlementId,
    attemptNumber: row.attemptNumber,
    environment: row.environment as Environment,
    mode: row.mode as "automated" | "manual",
    paypalAccountId: row.paypalAccountId,
    receiver: row.receiver,
    currency: row.currency,
    amount: row.amount,
    senderBatchId: row.senderBatchId,
    payoutBatchId: row.payoutBatchId,
    payoutItemId: row.payoutItemId,
    transactionId: row.transactionId,
    status: row.status as PayPalPayoutStatus,
    providerStatus: row.providerStatus,
    fee: row.fee,
    error: row.error,
    recordedBy: row.recordedBy,
    note: row.note,
    submittedAt: row.submittedAt,
    completedAt: row.completedAt,
  };
}

export function payPalPayoutRepository(db: Executor): PayPalPayoutRepository {
  return {
    async findAccount(partnerId, environment) {
      const [row] = await db
        .select()
        .from(partnerPayPalAccounts)
        .where(and(eq(partnerPayPalAccounts.partnerId, partnerId), eq(partnerPayPalAccounts.environment, environment)))
        .limit(1);
      return row ? toAccount(row) : null;
    },
    async findAccountById(id) {
      const [row] = await db.select().from(partnerPayPalAccounts).where(eq(partnerPayPalAccounts.id, id)).limit(1);
      return row ? toAccount(row) : null;
    },
    async setAccount(input) {
      const values = {
        receiver: input.receiver,
        status: "pending_verification" as const,
        verificationCodeHash: input.codeHash,
        verificationExpiresAt: input.expiresAt,
        verificationAttempts: 0,
        verifiedAt: null,
        updatedAt: input.now,
      };
      const [row] = await db
        .insert(partnerPayPalAccounts)
        .values({ partnerId: input.partnerId, environment: input.environment, recipientType: "EMAIL", ...values, createdAt: input.now })
        .onConflictDoUpdate({ target: [partnerPayPalAccounts.partnerId, partnerPayPalAccounts.environment], set: values })
        .returning();
      return toAccount(row);
    },
    async countVerificationAttempt(id, now) {
      const [row] = await db
        .update(partnerPayPalAccounts)
        .set({ verificationAttempts: sql`${partnerPayPalAccounts.verificationAttempts} + 1`, updatedAt: now })
        .where(eq(partnerPayPalAccounts.id, id))
        .returning({ attempts: partnerPayPalAccounts.verificationAttempts });
      return row?.attempts ?? 0;
    },
    async markVerified(id, now) {
      await db
        .update(partnerPayPalAccounts)
        .set({ status: "verified", verifiedAt: now, verificationCodeHash: null, verificationExpiresAt: null, updatedAt: now })
        .where(eq(partnerPayPalAccounts.id, id));
    },
    async setPayoutMethod(partnerId, method, now) {
      await db.update(partnerProfiles).set({ payoutMethod: method, updatedAt: now }).where(eq(partnerProfiles.id, partnerId));
    },
    async payoutMethodOf(partnerId) {
      const [row] = await db.select({ method: partnerProfiles.payoutMethod }).from(partnerProfiles).where(eq(partnerProfiles.id, partnerId)).limit(1);
      return row?.method === "paypal" ? "paypal" : "stripe";
    },
    async attempts(settlementId) {
      const rows = await db
        .select()
        .from(partnerPayPalPayouts)
        .where(eq(partnerPayPalPayouts.settlementId, settlementId))
        .orderBy(asc(partnerPayPalPayouts.attemptNumber));
      return rows.map(toPayout);
    },
    async createAttempt(input) {
      const [row] = await db
        .insert(partnerPayPalPayouts)
        .values({
          settlementId: input.settlementId,
          attemptNumber: input.attemptNumber,
          environment: input.environment,
          mode: input.mode,
          paypalAccountId: input.paypalAccountId,
          receiver: input.receiver,
          currency: input.currency,
          amount: input.amount,
          senderBatchId: input.senderBatchId,
          status: input.status ?? "processing",
          transactionId: input.transactionId ?? null,
          recordedBy: input.recordedBy,
          note: input.note,
          submittedAt: input.submittedAt,
          createdAt: input.submittedAt,
          updatedAt: input.submittedAt,
        })
        .onConflictDoNothing()
        .returning();
      return row ? toPayout(row) : null;
    },
    async updateAttempt(id, from, values) {
      const { now, ...rest } = values;
      const rows = await db
        .update(partnerPayPalPayouts)
        .set({ ...rest, updatedAt: now })
        .where(and(eq(partnerPayPalPayouts.id, id), inArray(partnerPayPalPayouts.status, from)))
        .returning({ id: partnerPayPalPayouts.id });
      return rows.length > 0;
    },
    async findAttemptByItem(payoutItemId) {
      const [row] = await db.select().from(partnerPayPalPayouts).where(eq(partnerPayPalPayouts.payoutItemId, payoutItemId)).limit(1);
      return row ? toPayout(row) : null;
    },
    async openAttempts(limit) {
      const rows = await db
        .select()
        .from(partnerPayPalPayouts)
        .where(and(eq(partnerPayPalPayouts.mode, "automated"), inArray(partnerPayPalPayouts.status, ["processing", "unknown", "pending"])))
        .orderBy(asc(partnerPayPalPayouts.updatedAt))
        .limit(limit);
      return rows.map(toPayout);
    },
  };
}
