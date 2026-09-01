import { and, eq } from "drizzle-orm";

import { recordCredit } from "@/lib/backlinks/credits";
import { db } from "@/lib/db";
import { referralCodes, referrals } from "@/lib/db/schema";
import { notify } from "@/lib/notifications/create";

/**
 * Referrals.
 *
 * Rewards are paid in ACCOUNT CREDIT, never cash. That is a deliberate limit:
 * cash payouts mean tax reporting, a payout rail, and a fraud surface where a
 * stolen card buys a subscription that pays out real money before the
 * chargeback arrives. Credit costs margin instead of cash, cannot be
 * withdrawn, and is worthless to a fraudster — while still being worth
 * something real to a genuine customer.
 *
 * Nothing here is credited on signup. A referral only pays once the referred
 * workspace actually pays for something, because rewarding a signup pays for
 * throwaway accounts and rewarding a payment cannot be gamed without a real
 * card charge.
 *
 * This module is imported by both a server action and the Stripe webhook, so
 * it carries no "use server" directive.
 */

/** Credits awarded to the referrer when a referral converts. */
export const REFERRAL_REWARD_CREDITS = 10;

/**
 * Characters used in generated codes.
 *
 * No 0/O or 1/I/L: codes get read aloud, written down and typed back, and an
 * ambiguous pair turns a working code into a support ticket.
 */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;

function randomCode(): string {
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

/**
 * The workspace's referral code, creating one if it has none.
 *
 * Retries on collision rather than assuming uniqueness: the space is large,
 * but "large" is not "guaranteed", and the unique index would otherwise
 * surface as an unexplained error to a customer clicking a button.
 */
export async function ensureReferralCode(orgId: string): Promise<string> {
  const [existing] = await db
    .select({ code: referralCodes.code })
    .from(referralCodes)
    .where(eq(referralCodes.organizationId, orgId))
    .limit(1);

  if (existing) return existing.code;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = randomCode();
    try {
      await db.insert(referralCodes).values({ organizationId: orgId, code });
      return code;
    } catch {
      /**
       * Either the code collided or this workspace got a code concurrently.
       * Re-read: if a row now exists for this org, that is the answer.
       */
      const [row] = await db
        .select({ code: referralCodes.code })
        .from(referralCodes)
        .where(eq(referralCodes.organizationId, orgId))
        .limit(1);
      if (row) return row.code;
    }
  }

  throw new Error("Could not allocate a referral code");
}

/** The workspace that owns a code, or null. Case-insensitive. */
export async function resolveReferralCode(
  code: string,
): Promise<string | null> {
  const cleaned = code.trim().toUpperCase();
  if (!cleaned) return null;

  const [row] = await db
    .select({ organizationId: referralCodes.organizationId })
    .from(referralCodes)
    .where(eq(referralCodes.code, cleaned))
    .limit(1);

  return row?.organizationId ?? null;
}

export type AttachOutcome =
  | { ok: true }
  | { ok: false; reason: "unknown_code" | "self_referral" | "already_referred" };

/**
 * Records that a new workspace came from a referral code.
 *
 * Creates a PENDING row. Nothing is credited here — see the note at the top of
 * this file about paying on payment rather than on signup.
 */
export async function attachReferral(
  referredOrgId: string,
  code: string,
): Promise<AttachOutcome> {
  const referrerOrgId = await resolveReferralCode(code);
  if (!referrerOrgId) return { ok: false, reason: "unknown_code" };

  /**
   * Referring yourself is the most obvious abuse, and the cheapest to close.
   * It would otherwise let one workspace mint credit by creating a second one
   * and paying for a month.
   */
  if (referrerOrgId === referredOrgId) {
    return { ok: false, reason: "self_referral" };
  }

  try {
    await db
      .insert(referrals)
      .values({ referrerOrgId, referredOrgId, status: "pending" });
    return { ok: true };
  } catch {
    // The unique index on referred_org_id. A workspace is referred once, ever.
    return { ok: false, reason: "already_referred" };
  }
}

/**
 * Converts a pending referral once the referred workspace has paid.
 *
 * Called from the Stripe webhook on a successful payment. Safe to call
 * repeatedly: the update is conditional on the row still being pending, so a
 * webhook retry or a second invoice cannot pay the referrer twice.
 *
 * Returns whether a reward was actually granted.
 */
export async function convertReferral(referredOrgId: string): Promise<boolean> {
  const [pending] = await db
    .select({
      id: referrals.id,
      referrerOrgId: referrals.referrerOrgId,
    })
    .from(referrals)
    .where(
      and(
        eq(referrals.referredOrgId, referredOrgId),
        eq(referrals.status, "pending"),
      ),
    )
    .limit(1);

  if (!pending) return false;

  /**
   * The status change is the guard. Constraining the UPDATE to rows still
   * pending means two concurrent webhooks race on the same row and exactly one
   * wins — without this, both would read "pending" and both would credit.
   */
  const updated = await db
    .update(referrals)
    .set({
      status: "rewarded",
      rewardCredits: REFERRAL_REWARD_CREDITS,
      rewardedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(referrals.id, pending.id), eq(referrals.status, "pending")))
    .returning({ id: referrals.id });

  if (updated.length === 0) return false;

  await recordCredit(pending.referrerOrgId, {
    type: "referral",
    amount: REFERRAL_REWARD_CREDITS,
    referenceId: pending.id,
    note: "Someone you referred started a paid plan",
  });

  await notify({
    organizationId: pending.referrerOrgId,
    type: "referral.rewarded",
    title: `You earned ${REFERRAL_REWARD_CREDITS} credits`,
    body: "Someone you referred started a paid plan. Thank you.",
    href: "/settings",
  });

  return true;
}
