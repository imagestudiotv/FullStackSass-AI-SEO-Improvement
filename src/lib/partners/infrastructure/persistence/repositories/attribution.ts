import { and, desc, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";

import {
  member,
  partnerAttributions,
  partnerClicks,
  partnerSignupEligibility,
  referrals,
} from "@/lib/db/schema";
import type { Executor } from "@/lib/db/types";

import type { AttributionSource, AttributionStatus } from "../../../domain/entities/attribution";
import type {
  AttributionRecord,
  AttributionRepository,
  ClickRecord,
  EligibilityRecord,
  TrackingRepository,
} from "../../../application/ports/repositories";

function toClick(row: typeof partnerClicks.$inferSelect): ClickRecord {
  return { id: row.id, partnerId: row.partnerId, clickedAt: row.clickedAt, expiresAt: row.expiresAt };
}

function toEligibility(row: typeof partnerSignupEligibility.$inferSelect): EligibilityRecord {
  return {
    id: row.id,
    userId: row.userId,
    signedUpAt: row.signedUpAt,
    signupMethod: row.signupMethod,
    eligible: row.eligible,
    exclusions: Array.isArray(row.exclusions) ? (row.exclusions as string[]) : [],
    foundingOrganizationId: row.foundingOrganizationId,
    clickId: row.clickId,
    candidatePartnerId: row.candidatePartnerId,
    linkOutcome: row.linkOutcome,
    couponDeadline: row.couponDeadline,
  };
}

function toAttribution(row: typeof partnerAttributions.$inferSelect): AttributionRecord {
  return {
    id: row.id,
    organizationId: row.organizationId,
    foundingUserId: row.foundingUserId,
    partnerId: row.partnerId,
    source: row.source as AttributionSource,
    clickId: row.clickId,
    couponId: row.couponId,
    status: row.status as AttributionStatus,
    lockedAt: row.lockedAt,
    ruleVersion: row.ruleVersion,
    windowStartsAt: row.windowStartsAt,
    windowEndsAt: row.windowEndsAt,
    reviewReason: row.reviewReason,
  };
}

export function trackingRepository(db: Executor): TrackingRepository {
  return {
    async createClick(input) {
      const [row] = await db
        .insert(partnerClicks)
        .values({ ...input, createdAt: input.clickedAt })
        .returning();
      return toClick(row);
    },
    async findClickByTokenHash(tokenHash) {
      const [row] = await db.select().from(partnerClicks).where(eq(partnerClicks.tokenHash, tokenHash)).limit(1);
      return row ? toClick(row) : null;
    },
    async recentClick(partnerId, visitorHash, since) {
      const [row] = await db
        .select()
        .from(partnerClicks)
        .where(
          and(
            eq(partnerClicks.partnerId, partnerId),
            eq(partnerClicks.visitorHash, visitorHash),
            gte(partnerClicks.clickedAt, since),
          ),
        )
        .orderBy(desc(partnerClicks.clickedAt))
        .limit(1);
      return row ? toClick(row) : null;
    },
    async findEligibility(userId) {
      const [row] = await db
        .select()
        .from(partnerSignupEligibility)
        .where(eq(partnerSignupEligibility.userId, userId))
        .limit(1);
      return row ? toEligibility(row) : null;
    },
    async findEligibilityByOrganization(organizationId) {
      const [row] = await db
        .select()
        .from(partnerSignupEligibility)
        .where(eq(partnerSignupEligibility.foundingOrganizationId, organizationId))
        .limit(1);
      return row ? toEligibility(row) : null;
    },
    async createEligibility(input) {
      const [row] = await db
        .insert(partnerSignupEligibility)
        .values({
          userId: input.userId,
          signedUpAt: input.signedUpAt,
          signupMethod: input.signupMethod,
          eligible: input.eligible,
          exclusions: input.exclusions,
          foundingOrganizationId: input.foundingOrganizationId,
          clickId: input.clickId,
          candidatePartnerId: input.candidatePartnerId,
          linkOutcome: input.linkOutcome,
          couponDeadline: input.couponDeadline,
          fraudSignals: input.fraudSignals,
          createdAt: input.signedUpAt,
        })
        .onConflictDoNothing({ target: partnerSignupEligibility.userId })
        .returning();
      return row ? toEligibility(row) : null;
    },
    async setFoundingOrganization(eligibilityId, organizationId) {
      await db
        .update(partnerSignupEligibility)
        .set({ foundingOrganizationId: organizationId })
        .where(and(eq(partnerSignupEligibility.id, eligibilityId), isNull(partnerSignupEligibility.foundingOrganizationId)));
    },
    async purgeClicks(before) {
      /*
        Retention: a click no signup or attribution refers to is deleted
        once it is past `before` (its window plus a grace period). Clicks
        that explain an attribution are kept with it.
      */
      const rows = await db
        .delete(partnerClicks)
        .where(
          and(
            lt(partnerClicks.expiresAt, before),
            sql`not exists (select 1 from ${partnerSignupEligibility} e where e.click_id = ${partnerClicks.id})`,
            sql`not exists (select 1 from ${partnerAttributions} a where a.click_id = ${partnerClicks.id})`,
          ),
        )
        .returning({ id: partnerClicks.id });
      return rows.length;
    },
  };
}

export function attributionRepository(db: Executor): AttributionRepository {
  return {
    async findByOrganization(organizationId) {
      const [row] = await db
        .select()
        .from(partnerAttributions)
        .where(eq(partnerAttributions.organizationId, organizationId))
        .limit(1);
      return row ? toAttribution(row) : null;
    },
    async findById(id) {
      const [row] = await db.select().from(partnerAttributions).where(eq(partnerAttributions.id, id)).limit(1);
      return row ? toAttribution(row) : null;
    },
    async lockByOrganization(organizationId) {
      const [row] = await db
        .select()
        .from(partnerAttributions)
        .where(eq(partnerAttributions.organizationId, organizationId))
        .for("no key update");
      return row ? toAttribution(row) : null;
    },
    async lock(id) {
      const [row] = await db.select().from(partnerAttributions).where(eq(partnerAttributions.id, id)).for("no key update");
      return row ? toAttribution(row) : null;
    },
    async createOrGet(input) {
      const [row] = await db
        .insert(partnerAttributions)
        .values({
          organizationId: input.organizationId,
          foundingUserId: input.foundingUserId,
          partnerId: input.partnerId,
          source: input.source,
          clickId: input.clickId,
          couponId: input.couponId,
          status: input.status,
          lockedAt: input.lockedAt,
          ruleVersion: input.ruleVersion,
          reviewReason: input.reviewReason,
          fraudSignals: input.fraudSignals,
          createdAt: input.lockedAt,
          updatedAt: input.lockedAt,
        })
        .onConflictDoNothing({ target: partnerAttributions.organizationId })
        .returning();
      if (row) return { attribution: toAttribution(row), created: true };
      const [existing] = await db
        .select()
        .from(partnerAttributions)
        .where(eq(partnerAttributions.organizationId, input.organizationId))
        .limit(1);
      if (!existing) throw new Error("Attribution conflict without an existing row");
      return { attribution: toAttribution(existing), created: false };
    },
    async setWindow(id, window) {
      await db
        .update(partnerAttributions)
        .set({ windowStartsAt: window.startsAt, windowEndsAt: window.endsAt, updatedAt: new Date() })
        .where(eq(partnerAttributions.id, id));
    },
    async setStatus(id, status, meta) {
      await db
        .update(partnerAttributions)
        .set(
          status === "disqualified"
            ? { status, disqualifiedAt: meta.at, disqualifiedReason: meta.reason, decidedByEmail: meta.by, updatedAt: meta.at }
            : status === "review"
              ? { status, reviewReason: meta.reason, decidedByEmail: meta.by, updatedAt: meta.at }
              : { status, decidedByEmail: meta.by, updatedAt: meta.at },
        )
        .where(eq(partnerAttributions.id, id));
    },
    async isPartnerMember(organizationId, partnerUserId) {
      if (!partnerUserId) return false;
      const [row] = await db
        .select({ id: member.id })
        .from(member)
        .where(and(eq(member.organizationId, organizationId), eq(member.userId, partnerUserId)))
        .limit(1);
      return Boolean(row);
    },
    async hasLegacyCreditReferral(organizationId) {
      const [row] = await db
        .select({ id: referrals.id })
        .from(referrals)
        .where(and(eq(referrals.referredOrgId, organizationId), inArray(referrals.status, ["pending", "rewarded"])))
        .limit(1);
      return Boolean(row);
    },
  };
}
