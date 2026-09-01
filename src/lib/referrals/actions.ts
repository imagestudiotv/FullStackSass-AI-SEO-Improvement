"use server";

import { desc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { organization, referrals } from "@/lib/db/schema";
import { ensureReferralCode } from "@/lib/referrals/core";
import type { ReferralSummary } from "@/lib/referrals/shared";
import { requireOrg } from "@/lib/tenant";

/**
 * Referral data for the settings page.
 *
 * Scoped by requireOrg(), so one workspace can never read another's referrals.
 * The rows name other customers' workspaces, so a leak here would disclose who
 * uses the product to a competitor.
 */
export async function getReferralSummary(): Promise<ReferralSummary> {
  const { orgId } = await requireOrg();

  const code = await ensureReferralCode(orgId);

  const rows = await db
    .select({
      id: referrals.id,
      status: referrals.status,
      rewardCredits: referrals.rewardCredits,
      createdAt: referrals.createdAt,
      rewardedAt: referrals.rewardedAt,
      referredName: organization.name,
    })
    .from(referrals)
    .leftJoin(organization, eq(referrals.referredOrgId, organization.id))
    .where(eq(referrals.referrerOrgId, orgId))
    .orderBy(desc(referrals.createdAt))
    .limit(50);

  const earned = rows.reduce((sum, row) => sum + (row.rewardCredits ?? 0), 0);

  return {
    code,
    earned,
    pending: rows.filter((r) => r.status === "pending").length,
    referrals: rows.map((row) => ({
      id: row.id,
      status: row.status,
      rewardCredits: row.rewardCredits,
      createdAt: row.createdAt,
      rewardedAt: row.rewardedAt,
      /**
       * Only the workspace name, never an email or domain. The referrer needs
       * to recognise who converted; they do not need contact details for
       * someone else's account.
       */
      referredName: row.referredName,
    })),
  };
}
