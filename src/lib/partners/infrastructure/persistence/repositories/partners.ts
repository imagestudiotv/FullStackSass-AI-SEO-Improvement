import { and, asc, desc, eq, ilike, isNull, or, sql, type SQL } from "drizzle-orm";

import { containsPattern } from "@/lib/admin/shared";
import {
  partnerApplications,
  partnerAttributions,
  partnerPaymentFacts,
  partnerProfiles,
  partnerTierHistory,
  subscriptions,
} from "@/lib/db/schema";
import type { Executor } from "@/lib/db/types";

import type { ApplicationAnswers, ApplicationStatus } from "../../../domain/entities/application";
import type { PartnerStatus } from "../../../domain/entities/partner";
import type {
  ApplicationRecord,
  ApplicationRepository,
  PartnerRecord,
  PartnerRepository,
  TierRepository,
} from "../../../application/ports/repositories";

type ApplicationRow = typeof partnerApplications.$inferSelect;
type PartnerRow = typeof partnerProfiles.$inferSelect;

function toApplication(row: ApplicationRow): ApplicationRecord {
  return {
    id: row.id,
    userId: row.userId,
    status: row.status as ApplicationStatus,
    answers: row.answers as ApplicationAnswers,
    applicantEmail: row.applicantEmail,
    applicantName: row.applicantName,
    submittedAt: row.submittedAt,
    reviewedAt: row.reviewedAt,
    reviewedByEmail: row.reviewedByEmail,
    reviewReason: row.reviewReason,
  };
}

export function toPartner(row: PartnerRow): PartnerRecord {
  return {
    id: row.id,
    userId: row.userId,
    referralCode: row.referralCode,
    status: row.status as PartnerStatus,
    tierKey: row.tierKey,
    qualifyingCustomers: row.qualifyingCustomers,
    displayName: row.displayName,
    contactEmail: row.contactEmail,
    country: row.country,
    applicationId: row.applicationId,
    approvedAt: row.approvedAt,
    approvedByEmail: row.approvedByEmail,
    suspendedAt: row.suspendedAt,
    suspendedReason: row.suspendedReason,
    payoutHoldReason: row.payoutHoldReason,
    welcomeEmailSentAt: row.welcomeEmailSentAt,
  };
}

const total = sql<number>`count(*)::int`;

export function applicationRepository(db: Executor): ApplicationRepository {
  return {
    async findOpenByUser(userId) {
      const [row] = await db
        .select()
        .from(partnerApplications)
        .where(and(eq(partnerApplications.userId, userId), eq(partnerApplications.status, "submitted")))
        .limit(1);
      return row ? toApplication(row) : null;
    },
    async latestByUser(userId) {
      const [row] = await db
        .select()
        .from(partnerApplications)
        .where(eq(partnerApplications.userId, userId))
        .orderBy(desc(partnerApplications.submittedAt))
        .limit(1);
      return row ? toApplication(row) : null;
    },
    async create(input) {
      const [row] = await db
        .insert(partnerApplications)
        .values({
          userId: input.userId,
          answers: input.answers,
          applicantEmail: input.applicantEmail,
          applicantName: input.applicantName,
          submittedAt: input.submittedAt,
          status: "submitted",
        })
        .onConflictDoNothing()
        .returning();
      return row ? toApplication(row) : null;
    },
    async lock(id) {
      const [row] = await db.select().from(partnerApplications).where(eq(partnerApplications.id, id)).for("update");
      return row ? toApplication(row) : null;
    },
    async decide(id, decision) {
      await db
        .update(partnerApplications)
        .set({
          status: decision.status,
          reviewedAt: decision.reviewedAt,
          reviewedByEmail: decision.reviewedByEmail,
          reviewReason: decision.reason,
          updatedAt: decision.reviewedAt,
        })
        .where(eq(partnerApplications.id, id));
    },
    async list(filter) {
      const conditions: SQL[] = [];
      if (filter.status) conditions.push(eq(partnerApplications.status, filter.status));
      if (filter.search) {
        const pattern = containsPattern(filter.search);
        conditions.push(
          or(ilike(partnerApplications.applicantEmail, pattern), ilike(partnerApplications.applicantName, pattern))!,
        );
      }
      const where = conditions.length ? and(...conditions) : undefined;
      const [rows, [count]] = await Promise.all([
        db
          .select()
          .from(partnerApplications)
          .where(where)
          .orderBy(desc(partnerApplications.submittedAt))
          .offset(filter.offset)
          .limit(filter.limit),
        db.select({ n: total }).from(partnerApplications).where(where),
      ]);
      return { rows: rows.map(toApplication), total: Number(count?.n ?? 0) };
    },
  };
}

export function partnerRepository(db: Executor): PartnerRepository {
  return {
    async findById(id) {
      const [row] = await db.select().from(partnerProfiles).where(eq(partnerProfiles.id, id)).limit(1);
      return row ? toPartner(row) : null;
    },
    async findByUserId(userId) {
      const [row] = await db.select().from(partnerProfiles).where(eq(partnerProfiles.userId, userId)).limit(1);
      return row ? toPartner(row) : null;
    },
    async findByReferralCode(code) {
      const [row] = await db.select().from(partnerProfiles).where(eq(partnerProfiles.referralCode, code)).limit(1);
      return row ? toPartner(row) : null;
    },
    async lock(id) {
      const [row] = await db.select().from(partnerProfiles).where(eq(partnerProfiles.id, id)).for("update");
      return row ? toPartner(row) : null;
    },
    async createOrGet(input) {
      /*
        ON CONFLICT DO NOTHING on ANY unique key - never a caught unique
        violation, which would abort the caller's whole transaction. No row
        back means either this user already has a profile (return it) or the
        random referral code collided (null: the caller draws another).
      */
      const [row] = await db
        .insert(partnerProfiles)
        .values({
          userId: input.userId,
          referralCode: input.referralCode,
          displayName: input.displayName,
          contactEmail: input.contactEmail,
          country: input.country,
          applicationId: input.applicationId,
          approvedAt: input.approvedAt,
          approvedByEmail: input.approvedByEmail,
          status: "active",
          tierKey: "base",
          createdAt: input.approvedAt,
          updatedAt: input.approvedAt,
        })
        .onConflictDoNothing()
        .returning();
      if (row) return { partner: toPartner(row), created: true };
      const [existing] = await db
        .select()
        .from(partnerProfiles)
        .where(eq(partnerProfiles.userId, input.userId))
        .limit(1);
      return existing ? { partner: toPartner(existing), created: false } : null;
    },
    async setStatus(id, status, meta) {
      await db
        .update(partnerProfiles)
        .set(
          status === "suspended"
            ? { status, suspendedAt: meta.at, suspendedReason: meta.reason, updatedAt: meta.at }
            : { status, suspendedAt: null, suspendedReason: null, updatedAt: meta.at },
        )
        .where(eq(partnerProfiles.id, id));
    },
    async setPayoutHold(id, hold) {
      await db
        .update(partnerProfiles)
        .set(
          hold
            ? { payoutHoldReason: hold.reason, payoutHoldSetAt: hold.at, payoutHoldBy: hold.by, updatedAt: hold.at }
            : { payoutHoldReason: null, payoutHoldSetAt: null, payoutHoldBy: null, updatedAt: new Date() },
        )
        .where(eq(partnerProfiles.id, id));
    },
    async setTierProjection(id, tierKey, qualifyingCustomers) {
      await db
        .update(partnerProfiles)
        .set({ tierKey, qualifyingCustomers, updatedAt: new Date() })
        .where(eq(partnerProfiles.id, id));
    },
    async claimWelcomeEmail(id, at) {
      const rows = await db
        .update(partnerProfiles)
        .set({ welcomeEmailSentAt: at })
        .where(and(eq(partnerProfiles.id, id), isNull(partnerProfiles.welcomeEmailSentAt)))
        .returning({ id: partnerProfiles.id });
      return rows.length > 0;
    },
    async releaseWelcomeEmail(id) {
      await db.update(partnerProfiles).set({ welcomeEmailSentAt: null }).where(eq(partnerProfiles.id, id));
    },
    async list(filter) {
      const conditions: SQL[] = [];
      if (filter.status) conditions.push(eq(partnerProfiles.status, filter.status));
      if (filter.search) {
        const pattern = containsPattern(filter.search);
        conditions.push(
          or(
            ilike(partnerProfiles.contactEmail, pattern),
            ilike(partnerProfiles.displayName, pattern),
            ilike(partnerProfiles.referralCode, pattern),
          )!,
        );
      }
      const where = conditions.length ? and(...conditions) : undefined;
      const [rows, [count]] = await Promise.all([
        db
          .select()
          .from(partnerProfiles)
          .where(where)
          .orderBy(desc(partnerProfiles.approvedAt))
          .offset(filter.offset)
          .limit(filter.limit),
        db.select({ n: total }).from(partnerProfiles).where(where),
      ]);
      return { rows: rows.map(toPartner), total: Number(count?.n ?? 0) };
    },
    async listActiveIds() {
      const rows = await db
        .select({ id: partnerProfiles.id })
        .from(partnerProfiles)
        .where(eq(partnerProfiles.status, "active"))
        .orderBy(asc(partnerProfiles.approvedAt));
      return rows.map((row) => row.id);
    },
  };
}

export function tierRepository(db: Executor): TierRepository {
  return {
    async periods(partnerId) {
      const rows = await db
        .select()
        .from(partnerTierHistory)
        .where(eq(partnerTierHistory.partnerId, partnerId))
        .orderBy(asc(partnerTierHistory.effectiveFrom));
      return rows.map((row) => ({
        id: row.id,
        partnerId: row.partnerId,
        tierKey: row.tierKey,
        rateBasisPoints: row.rateBasisPoints,
        programVersion: row.programVersion,
        qualifyingCustomers: row.qualifyingCustomers,
        effectiveFrom: row.effectiveFrom,
        effectiveTo: row.effectiveTo,
      }));
    },
    async open(input) {
      await db
        .update(partnerTierHistory)
        .set({ effectiveTo: input.effectiveFrom })
        .where(and(eq(partnerTierHistory.partnerId, input.partnerId), isNull(partnerTierHistory.effectiveTo)));
      await db.insert(partnerTierHistory).values({
        partnerId: input.partnerId,
        tierKey: input.tierKey,
        rateBasisPoints: input.rateBasisPoints,
        programVersion: input.programVersion,
        qualifyingCustomers: input.qualifyingCustomers,
        effectiveFrom: input.effectiveFrom,
        evidence: input.evidence,
      });
    },
    async qualifyingOrganizations(partnerId, environment, at) {
      /*
        Distinct ORGANIZATIONS (never users, seats, websites or invoices)
        whose attribution stands, that have a current PAID period - an
        active Stripe subscription whose period has not ended (a cancellation
        at period end keeps counting until then) - and at least one
        commissionable payment that was not fully refunded or charged back.
      */
      const rows = await db
        .selectDistinct({ organizationId: partnerAttributions.organizationId })
        .from(partnerAttributions)
        .where(
          and(
            eq(partnerAttributions.partnerId, partnerId),
            eq(partnerAttributions.status, "active"),
            sql`exists (
              select 1 from ${subscriptions} s
              where s.organization_id = ${partnerAttributions.organizationId}
                and s.provider = 'stripe'
                and s.status = 'active'
                and s.current_period_end > ${at.toISOString()}::timestamp
            )`,
            sql`exists (
              select 1 from ${partnerPaymentFacts} f
              where f.organization_id = ${partnerAttributions.organizationId}
                and f.environment = ${environment}
                and f.cash_collected > 0
                and f.refunded_amount + f.dispute_lost_amount < f.cash_collected
            )`,
          ),
        )
        .orderBy(asc(partnerAttributions.organizationId));
      return rows.map((row) => row.organizationId);
    },
  };
}
