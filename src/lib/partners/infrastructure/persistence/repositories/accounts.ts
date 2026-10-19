import { and, asc, desc, eq, ilike, inArray, isNull, lt, lte, or, sql, type SQL } from "drizzle-orm";

import { containsPattern } from "@/lib/admin/shared";
import {
  partnerCoupons,
  partnerProviderEvents,
  partnerReviewCases,
  partnerStripeAccounts,
} from "@/lib/db/schema";
import type { Executor } from "@/lib/db/types";

import type {
  CouponRecord,
  CouponRepository,
  Environment,
  ProviderEventRecord,
  ProviderEventRepository,
  ReviewCaseKind,
  ReviewCaseRecord,
  ReviewCaseRepository,
  StripeAccountRecord,
  StripeAccountRepository,
  StripeAccountStatus,
} from "../../../application/ports/repositories";

const asStrings = (value: unknown): string[] => (Array.isArray(value) ? value.map(String) : []);

function toAccount(row: typeof partnerStripeAccounts.$inferSelect): StripeAccountRecord {
  return {
    id: row.id,
    partnerId: row.partnerId,
    environment: row.environment as Environment,
    stripeAccountId: row.stripeAccountId,
    status: row.status as StripeAccountStatus,
    country: row.country,
    defaultCurrency: row.defaultCurrency,
    detailsSubmitted: row.detailsSubmitted,
    payoutsEnabled: row.payoutsEnabled,
    transfersCapability: row.transfersCapability,
    requirementsCurrentlyDue: asStrings(row.requirementsCurrentlyDue),
    requirementsPastDue: asStrings(row.requirementsPastDue),
    requirementsPendingVerification: asStrings(row.requirementsPendingVerification),
    disabledReason: row.disabledReason,
    currentDeadline: row.currentDeadline,
    payoutInterval: row.payoutInterval,
    creationKey: row.creationKey,
    lastSyncedAt: row.lastSyncedAt,
    createdAt: row.createdAt,
  };
}

export function stripeAccountRepository(db: Executor): StripeAccountRepository {
  return {
    async find(partnerId, environment) {
      const [row] = await db
        .select()
        .from(partnerStripeAccounts)
        .where(and(eq(partnerStripeAccounts.partnerId, partnerId), eq(partnerStripeAccounts.environment, environment)))
        .limit(1);
      return row ? toAccount(row) : null;
    },
    async findByStripeId(stripeAccountId) {
      const [row] = await db
        .select()
        .from(partnerStripeAccounts)
        .where(eq(partnerStripeAccounts.stripeAccountId, stripeAccountId))
        .limit(1);
      return row ? toAccount(row) : null;
    },
    async reserve(partnerId, environment, creationKey, country, now) {
      await db
        .insert(partnerStripeAccounts)
        .values({ partnerId, environment, creationKey, country, status: "creating", createdAt: now, updatedAt: now })
        .onConflictDoNothing({ target: [partnerStripeAccounts.partnerId, partnerStripeAccounts.environment] });
      const found = await this.find(partnerId, environment);
      if (!found) throw new Error("Stripe account reservation vanished");
      return found;
    },
    async attach(id, stripeAccountId) {
      await db
        .update(partnerStripeAccounts)
        .set({ stripeAccountId, status: "onboarding", updatedAt: new Date() })
        .where(and(eq(partnerStripeAccounts.id, id), isNull(partnerStripeAccounts.stripeAccountId)));
    },
    async updateReadiness(id, values) {
      await db
        .update(partnerStripeAccounts)
        .set({
          status: values.status,
          country: values.country,
          defaultCurrency: values.defaultCurrency,
          detailsSubmitted: values.detailsSubmitted,
          payoutsEnabled: values.payoutsEnabled,
          transfersCapability: values.transfersCapability,
          requirementsCurrentlyDue: values.requirementsCurrentlyDue,
          requirementsPastDue: values.requirementsPastDue,
          requirementsPendingVerification: values.requirementsPendingVerification,
          disabledReason: values.disabledReason,
          currentDeadline: values.currentDeadline,
          payoutInterval: values.payoutInterval,
          lastSyncedAt: values.syncedAt,
          updatedAt: values.syncedAt,
        })
        .where(eq(partnerStripeAccounts.id, id));
    },
    async list(environment) {
      const rows = await db
        .select()
        .from(partnerStripeAccounts)
        .where(eq(partnerStripeAccounts.environment, environment))
        .orderBy(asc(partnerStripeAccounts.createdAt));
      return rows.map(toAccount);
    },
  };
}

function toCoupon(row: typeof partnerCoupons.$inferSelect): CouponRecord {
  return {
    id: row.id,
    environment: row.environment as Environment,
    partnerId: row.partnerId,
    code: row.code,
    campaign: row.campaign,
    discountType: row.discountType,
    percentOffBasisPoints: row.percentOffBasisPoints,
    amountOff: row.amountOff,
    currency: row.currency,
    duration: row.duration as CouponRecord["duration"],
    durationInMonths: row.durationInMonths,
    appliesToProducts: asStrings(row.appliesToProducts),
    startsAt: row.startsAt,
    expiresAt: row.expiresAt,
    maxRedemptions: row.maxRedemptions,
    firstTimeTransaction: row.firstTimeTransaction,
    stripeCouponId: row.stripeCouponId,
    stripePromotionCodeId: row.stripePromotionCodeId,
    status: row.status as CouponRecord["status"],
  };
}

export function couponRepository(db: Executor): CouponRepository {
  return {
    async create(input) {
      const [row] = await db
        .insert(partnerCoupons)
        .values({
          environment: input.environment,
          partnerId: input.partnerId,
          code: input.code,
          campaign: input.campaign,
          discountType: input.discountType,
          percentOffBasisPoints: input.percentOffBasisPoints,
          amountOff: input.amountOff,
          currency: input.currency,
          duration: input.duration,
          durationInMonths: input.durationInMonths,
          appliesToProducts: input.appliesToProducts,
          startsAt: input.startsAt,
          expiresAt: input.expiresAt,
          maxRedemptions: input.maxRedemptions,
          firstTimeTransaction: input.firstTimeTransaction,
          createdByEmail: input.createdByEmail,
          status: "creating",
        })
        .onConflictDoNothing()
        .returning();
      return row ? toCoupon(row) : null;
    },
    async attachStripe(id, values, status) {
      await db
        .update(partnerCoupons)
        .set({ ...values, status, updatedAt: new Date() })
        .where(eq(partnerCoupons.id, id));
    },
    async setStatus(id, status, at) {
      await db
        .update(partnerCoupons)
        .set({ status, ...(status === "inactive" ? { deactivatedAt: at } : {}), updatedAt: at })
        .where(eq(partnerCoupons.id, id));
    },
    async findById(id) {
      const [row] = await db.select().from(partnerCoupons).where(eq(partnerCoupons.id, id)).limit(1);
      return row ? toCoupon(row) : null;
    },
    async findByPromotionCode(environment, stripePromotionCodeId) {
      const [row] = await db
        .select()
        .from(partnerCoupons)
        .where(
          and(eq(partnerCoupons.environment, environment), eq(partnerCoupons.stripePromotionCodeId, stripePromotionCodeId)),
        )
        .limit(1);
      return row ? toCoupon(row) : null;
    },
    async forPartner(partnerId, environment) {
      const rows = await db
        .select()
        .from(partnerCoupons)
        .where(and(eq(partnerCoupons.partnerId, partnerId), eq(partnerCoupons.environment, environment)))
        .orderBy(desc(partnerCoupons.createdAt));
      return rows.map(toCoupon);
    },
    async list(environment, filter) {
      const conditions: SQL[] = [eq(partnerCoupons.environment, environment)];
      if (filter.search) {
        const pattern = containsPattern(filter.search);
        conditions.push(or(ilike(partnerCoupons.code, pattern), ilike(partnerCoupons.campaign, pattern))!);
      }
      const where = and(...conditions);
      const [rows, [count]] = await Promise.all([
        db.select().from(partnerCoupons).where(where).orderBy(desc(partnerCoupons.createdAt)).offset(filter.offset).limit(filter.limit),
        db.select({ n: sql<number>`count(*)::int` }).from(partnerCoupons).where(where),
      ]);
      return { rows: rows.map(toCoupon), total: Number(count?.n ?? 0) };
    },
  };
}

function toCase(row: typeof partnerReviewCases.$inferSelect): ReviewCaseRecord {
  return {
    id: row.id,
    kind: row.kind as ReviewCaseKind,
    status: row.status as ReviewCaseRecord["status"],
    dedupeKey: row.dedupeKey,
    environment: (row.environment as Environment | null) ?? null,
    partnerId: row.partnerId,
    attributionId: row.attributionId,
    commissionId: row.commissionId,
    settlementId: row.settlementId,
    paymentFactId: row.paymentFactId,
    organizationId: row.organizationId,
    summary: row.summary,
    evidence: (row.evidence as Record<string, unknown>) ?? {},
    resolution: row.resolution,
    resolutionReason: row.resolutionReason,
    resolvedByEmail: row.resolvedByEmail,
    resolvedAt: row.resolvedAt,
    createdAt: row.createdAt,
  };
}

export function reviewCaseRepository(db: Executor): ReviewCaseRepository {
  return {
    async open(input) {
      const now = new Date();
      const [row] = await db
        .insert(partnerReviewCases)
        .values({
          kind: input.kind,
          dedupeKey: input.dedupeKey,
          environment: input.environment,
          partnerId: input.partnerId,
          attributionId: input.attributionId,
          commissionId: input.commissionId,
          settlementId: input.settlementId,
          paymentFactId: input.paymentFactId,
          organizationId: input.organizationId,
          summary: input.summary.slice(0, 500),
          evidence: input.evidence,
          status: "open",
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing({ target: partnerReviewCases.dedupeKey })
        .returning();
      if (row) return { reviewCase: toCase(row), created: true };
      const [existing] = await db
        .select()
        .from(partnerReviewCases)
        .where(eq(partnerReviewCases.dedupeKey, input.dedupeKey))
        .limit(1);
      if (!existing) throw new Error("Review case conflict without an existing row");
      return { reviewCase: toCase(existing), created: false };
    },
    async findById(id) {
      const [row] = await db.select().from(partnerReviewCases).where(eq(partnerReviewCases.id, id)).limit(1);
      return row ? toCase(row) : null;
    },
    async lock(id) {
      const [row] = await db.select().from(partnerReviewCases).where(eq(partnerReviewCases.id, id)).for("update");
      return row ? toCase(row) : null;
    },
    async resolve(id, values) {
      const rows = await db
        .update(partnerReviewCases)
        .set({
          status: values.status,
          resolution: values.resolution,
          resolutionReason: values.reason,
          resolvedByEmail: values.by,
          resolvedAt: values.at,
          updatedAt: values.at,
        })
        .where(and(eq(partnerReviewCases.id, id), eq(partnerReviewCases.status, "open")))
        .returning({ id: partnerReviewCases.id });
      return rows.length > 0;
    },
    async list(filter) {
      const conditions: SQL[] = [];
      if (filter.status) conditions.push(eq(partnerReviewCases.status, filter.status));
      if (filter.kind) conditions.push(eq(partnerReviewCases.kind, filter.kind));
      if (filter.partnerId) conditions.push(eq(partnerReviewCases.partnerId, filter.partnerId));
      const where = conditions.length ? and(...conditions) : undefined;
      const [rows, [count]] = await Promise.all([
        db
          .select()
          .from(partnerReviewCases)
          .where(where)
          .orderBy(desc(partnerReviewCases.createdAt))
          .offset(filter.offset)
          .limit(filter.limit),
        db.select({ n: sql<number>`count(*)::int` }).from(partnerReviewCases).where(where),
      ]);
      return { rows: rows.map(toCase), total: Number(count?.n ?? 0) };
    },
  };
}

function toProviderEvent(row: typeof partnerProviderEvents.$inferSelect): ProviderEventRecord {
  return {
    id: row.id,
    environment: row.environment as Environment,
    stripeEventId: row.stripeEventId,
    eventType: row.eventType,
    objectId: row.objectId,
    connectedAccountId: row.connectedAccountId,
    eventCreatedAt: row.eventCreatedAt,
    status: row.status as ProviderEventRecord["status"],
    attempts: row.attempts,
  };
}

export function providerEventRepository(db: Executor): ProviderEventRepository {
  return {
    async record(input) {
      const [row] = await db
        .insert(partnerProviderEvents)
        .values({
          environment: input.environment,
          stripeEventId: input.stripeEventId,
          eventType: input.eventType,
          objectId: input.objectId,
          connectedAccountId: input.connectedAccountId,
          eventCreatedAt: input.eventCreatedAt,
          status: "pending",
          nextAttemptAt: input.now,
          createdAt: input.now,
          updatedAt: input.now,
        })
        .onConflictDoNothing({ target: partnerProviderEvents.stripeEventId })
        .returning({ id: partnerProviderEvents.id });
      if (row) return { id: row.id, created: true };
      const [existing] = await db
        .select({ id: partnerProviderEvents.id })
        .from(partnerProviderEvents)
        .where(eq(partnerProviderEvents.stripeEventId, input.stripeEventId))
        .limit(1);
      if (!existing) throw new Error("Provider event conflict without an existing row");
      return { id: existing.id, created: false };
    },
    async claimDue(now, token, leaseUntil, limit, onlyIds) {
      const free = or(isNull(partnerProviderEvents.claimedUntil), lt(partnerProviderEvents.claimedUntil, now));
      const claimable = or(
        and(eq(partnerProviderEvents.status, "pending"), lte(partnerProviderEvents.nextAttemptAt, now)),
        // A worker that died mid-processing: its lease ran out.
        and(eq(partnerProviderEvents.status, "processing"), lt(partnerProviderEvents.claimedUntil, now)),
      );
      const due = db
        .select({ id: partnerProviderEvents.id })
        .from(partnerProviderEvents)
        .where(and(claimable, free, onlyIds?.length ? inArray(partnerProviderEvents.id, onlyIds) : undefined))
        .orderBy(asc(partnerProviderEvents.eventCreatedAt))
        .limit(limit);
      const rows = await db
        .update(partnerProviderEvents)
        .set({
          status: "processing",
          claimToken: token,
          claimedUntil: leaseUntil,
          attempts: sql`${partnerProviderEvents.attempts} + 1`,
          updatedAt: now,
        })
        .where(and(inArray(partnerProviderEvents.id, due), claimable, free))
        .returning();
      return rows
        .map(toProviderEvent)
        .sort((a, b) => a.eventCreatedAt.getTime() - b.eventCreatedAt.getTime());
    },
    async complete(id, token, values) {
      const rows = await db
        .update(partnerProviderEvents)
        .set({
          status: values.status,
          outcome: values.outcome.slice(0, 200),
          processedAt: values.at,
          claimToken: null,
          claimedUntil: null,
          lastError: null,
          updatedAt: values.at,
        })
        .where(and(eq(partnerProviderEvents.id, id), eq(partnerProviderEvents.claimToken, token)))
        .returning({ id: partnerProviderEvents.id });
      return rows.length > 0;
    },
    async release(id, token, values) {
      const rows = await db
        .update(partnerProviderEvents)
        .set({
          status: values.failed ? "failed" : "pending",
          lastError: values.error.slice(0, 500),
          nextAttemptAt: values.nextAttemptAt,
          claimToken: null,
          claimedUntil: null,
          updatedAt: new Date(),
        })
        .where(and(eq(partnerProviderEvents.id, id), eq(partnerProviderEvents.claimToken, token)))
        .returning({ id: partnerProviderEvents.id });
      return rows.length > 0;
    },
    async backlog() {
      const rows = await db
        .select({ status: partnerProviderEvents.status, count: sql<number>`count(*)::int` })
        .from(partnerProviderEvents)
        .groupBy(partnerProviderEvents.status);
      return rows.map((row) => ({ status: row.status, count: Number(row.count) }));
    },
  };
}
