"use server";

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { creditLedger, member, referrals, user, websites } from "@/lib/db/schema";
import { clearReferralCookie, readReferralCookie } from "@/lib/referrals/cookie";
import { attachReferral, ensureReferralCode } from "@/lib/referrals/core";
import type { ReferralSummary } from "@/lib/referrals/shared";
import { requireOrg } from "@/lib/tenant";

/**
 * Attaches the referral left by a /r/CODE visit to the signed-in workspace,
 * then clears the cookie - whatever the outcome.
 *
 * A Server Action because clearing the cookie is a write, which Next refuses
 * during a render. It used to run in the app layout, where the delete threw,
 * was swallowed, and the cookie lived its full thirty days, attaching to any
 * new account opened in that browser. Called once by <ReferralClaim>, which
 * both the app and onboarding layouts render while a cookie is present, so
 * the referral exists before the first checkout.
 *
 * Takes no arguments: the workspace is the caller's own (requireOrg) and the
 * code is the caller's own cookie, so a call cannot attach anyone else.
 */
export async function claimReferral(): Promise<void> {
  const stored = await readReferralCookie();
  if (!stored) return;
  const { orgId } = await requireOrg();
  const outcome = await attachReferral(orgId, stored.code, { clickedAt: stored.clickedAt });
  if (!outcome.ok && outcome.reason !== "already_referred") {
    console.info("[referrals] referral not attached", { reason: outcome.reason });
  }
  await clearReferralCookie();
}

/**
 * Referral data for the settings page.
 *
 * Scoped by requireOrg(), so one account can never read another's referrals.
 * The rows name other customers, so a leak here would disclose who uses the
 * product to a competitor.
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
      referredOrgId: referrals.referredOrgId,
    })
    .from(referrals)
    .where(eq(referrals.referrerOrgId, orgId))
    .orderBy(desc(referrals.createdAt))
    .limit(50);

  /**
   * What to call the person who was referred.
   *
   * This used to read organization.name, which produced "Test User's
   * Workspace" — an artefact of the workspace model that is no longer part of
   * the product. Nobody shares a link with a workspace; they share it with a
   * person, and later that person has a website.
   *
   * Two lookups rather than joins, because both are one-to-many in principle:
   * an account can have several members and several websites, and a join would
   * multiply the referral rows. Keyed by referred account id and collapsed
   * below.
   */
  const referredIds = rows.map((row) => row.referredOrgId);

  const [people, sites] = referredIds.length
    ? await Promise.all([
        db
          .select({
            organizationId: member.organizationId,
            name: user.name,
            joinedAt: member.createdAt,
          })
          .from(member)
          .innerJoin(user, eq(user.id, member.userId))
          .where(
            and(
              inArray(member.organizationId, referredIds),
              eq(member.role, "owner"),
            ),
          )
          .orderBy(asc(member.createdAt)),
        db
          .select({
            organizationId: websites.organizationId,
            domain: websites.domain,
          })
          .from(websites)
          .where(inArray(websites.organizationId, referredIds))
          .orderBy(asc(websites.createdAt)),
      ])
    : [[], []];

  /** First owner and first website win — both are ordered oldest first. */
  const personFor = new Map<string, (typeof people)[number]>();
  for (const person of people) {
    if (!personFor.has(person.organizationId)) {
      personFor.set(person.organizationId, person);
    }
  }

  const domainFor = new Map<string, string>();
  for (const site of sites) {
    if (!domainFor.has(site.organizationId)) {
      domainFor.set(site.organizationId, site.domain);
    }
  }

  /*
    Totals over ALL of this workspace's referrals, not the 50 rows listed:
    they were summed from the page, so a referrer past 50 saw too few. Earned
    is what the LEDGER holds for referrals - net of any reversal, and kept
    when a referred workspace is later deleted (which removes its row).
  */
  const [[earnedRow], [pendingRow]] = await Promise.all([
    db
      .select({ total: sql<number>`coalesce(sum(${creditLedger.amount}), 0)::int` })
      .from(creditLedger)
      .where(and(eq(creditLedger.organizationId, orgId), eq(creditLedger.type, "referral"))),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(referrals)
      .where(and(eq(referrals.referrerOrgId, orgId), eq(referrals.status, "pending"))),
  ]);

  return {
    code,
    earned: Math.max(0, Number(earnedRow?.total ?? 0)),
    pending: Number(pendingRow?.n ?? 0),
    referrals: rows.map((row) => {
      const person = personFor.get(row.referredOrgId);
      return {
        id: row.id,
        status: row.status,
        rewardCredits: row.rewardCredits,
        createdAt: row.createdAt,
        rewardedAt: row.rewardedAt,
        /**
         * The person's own name, never their email.
         *
         * A referral link can be posted publicly, so the people who arrive
         * through it are not necessarily anyone the referrer knows. Handing
         * back an email address would turn a shared link into a way of
         * harvesting them. A name is what the person chose to be called, and
         * the domain below is already public.
         */
        referredName: person?.name?.trim() || null,
        /**
         * Shown once the person has connected a site. Null until then, which
         * is the honest answer rather than a placeholder domain.
         */
        referredDomain: domainFor.get(row.referredOrgId) ?? null,
      };
    }),
  };
}
