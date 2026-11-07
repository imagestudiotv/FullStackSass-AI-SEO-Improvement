import "server-only";

import { and, asc, desc, eq, sql } from "drizzle-orm";

import { recordCredit } from "@/lib/backlinks/credits";
import { addons, member, organization, partnerCreditGrants, partnerProfiles } from "@/lib/db/schema";
import type { Executor } from "@/lib/db/types";

import type { PartnerCreditRepository } from "../../../application/ports/repositories";

export function partnerCreditRepository(db: Executor): PartnerCreditRepository {
  return {
    async creditWorkspaceOf(partnerId) {
      const [row] = await db.select({ id: partnerProfiles.creditOrganizationId }).from(partnerProfiles).where(eq(partnerProfiles.id, partnerId)).limit(1);
      return row?.id ?? null;
    },
    async setCreditWorkspace(partnerId, organizationId, now) {
      await db.update(partnerProfiles).set({ creditOrganizationId: organizationId, updatedAt: now }).where(eq(partnerProfiles.id, partnerId));
    },
    async ownedWorkspaces(userId) {
      return db
        .select({ id: organization.id, name: organization.name })
        .from(member)
        .innerJoin(organization, eq(organization.id, member.organizationId))
        .where(and(eq(member.userId, userId), eq(member.role, "owner")))
        .orderBy(asc(organization.createdAt));
    },
    async smallestPack() {
      const [pack] = await db
        .select({ priceCents: addons.priceCents, credits: addons.creditsGranted, currency: addons.currency })
        .from(addons)
        .where(and(eq(addons.kind, "credits"), eq(addons.isActive, true), sql`${addons.creditsGranted} > 0 and ${addons.priceCents} > 0`))
        .orderBy(asc(addons.creditsGranted), asc(addons.priceCents))
        .limit(1);
      return pack ? { priceCents: pack.priceCents, credits: pack.credits, currency: pack.currency.toLowerCase() } : null;
    },
    async grantedAtRate(partnerId, environment, currency, packCents, packCredits) {
      const [row] = await db
        .select({
          amount: sql<string>`coalesce(sum(${partnerCreditGrants.amount}), 0)::text`,
          credits: sql<number>`coalesce(sum(${partnerCreditGrants.credits}), 0)::int`,
        })
        .from(partnerCreditGrants)
        .where(
          and(
            eq(partnerCreditGrants.partnerId, partnerId),
            eq(partnerCreditGrants.environment, environment),
            eq(partnerCreditGrants.currency, currency),
            eq(partnerCreditGrants.packCents, packCents),
            eq(partnerCreditGrants.packCredits, packCredits),
          ),
        );
      return { amount: BigInt(row?.amount ?? "0"), credits: Number(row?.credits ?? 0) };
    },
    async recordGrant(input) {
      const rows = await db
        .insert(partnerCreditGrants)
        .values({
          settlementId: input.settlementId,
          partnerId: input.partnerId,
          environment: input.environment,
          organizationId: input.organizationId,
          currency: input.currency,
          amount: input.amount,
          credits: input.credits,
          packCents: input.packCents,
          packCredits: input.packCredits,
          ledgerKey: input.ledgerKey,
          createdAt: input.now,
        })
        .onConflictDoNothing()
        .returning({ id: partnerCreditGrants.id });
      return rows.length > 0;
    },
    async grantCredits(input) {
      if (input.credits <= 0) return false;
      return recordCredit(
        input.organizationId,
        { type: "partner_commission", amount: input.credits, referenceId: input.settlementId, idempotencyKey: input.ledgerKey, note: input.note },
        db,
      );
    },
    async grants(partnerId, environment, limit) {
      const rows = await db
        .select()
        .from(partnerCreditGrants)
        .where(and(eq(partnerCreditGrants.partnerId, partnerId), eq(partnerCreditGrants.environment, environment)))
        .orderBy(desc(partnerCreditGrants.createdAt))
        .limit(limit);
      return rows.map((row) => ({
        id: row.id,
        settlementId: row.settlementId,
        organizationId: row.organizationId,
        currency: row.currency,
        amount: row.amount,
        credits: row.credits,
        packCents: row.packCents,
        packCredits: row.packCredits,
        createdAt: row.createdAt,
      }));
    },
  };
}
