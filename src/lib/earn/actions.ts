"use server";

import { and, desc, eq, gt, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { earnSubmissions, payments, referrals } from "@/lib/db/schema";
import { EARN_WAYS, isEarnKind, type EarnClaim, type EarnKind } from "@/lib/earn/ways";
import { attachReferral } from "@/lib/referrals/core";
import { requireOrg } from "@/lib/tenant";

/** Ok, or an error code the page words in the reader's language. */
export type EarnResult<E extends string> = { ok: true } | { ok: false; error: E };

/**
 * The customer's side of Earn Credits: sending a claim for one of the extra
 * ways to earn, reading what was sent, and entering someone's referral code.
 *
 * Every action works on the caller's OWN workspace (requireOrg) - nothing
 * here takes a workspace id, so a call can never claim for anyone else.
 *
 * Errors come back as codes the page words in the reader's language.
 */

export type EarnError = "kind" | "link" | "message" | "already" | "approved";

/** A public http(s) address, as the proof of a post or tutorial. */
function publicLink(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!url.hostname.includes(".")) return null;
    return url.toString().slice(0, 500);
  } catch {
    return null;
  }
}

/** True for Postgres's unique-violation error, however the driver wraps it. */
function isUniqueViolation(error: unknown): boolean {
  const e = error as { code?: string; cause?: { code?: string } } | null;
  return (e?.code ?? e?.cause?.code) === "23505";
}

/**
 * Sends one claim for review. Nothing is credited here: the RepGet team
 * approves it (lib/earn/admin.ts). One open or approved claim per way and
 * workspace - the database's partial unique index decides, so two presses
 * cannot both land.
 */
export async function submitEarnClaim(input: { kind: string; link: string; message: string }): Promise<EarnResult<EarnError>> {
  if (!isEarnKind(input.kind)) return { ok: false, error: "kind" };
  const way = EARN_WAYS[input.kind];
  const link = publicLink(input.link ?? "");
  if (way.needsLink && !link) return { ok: false, error: "link" };
  if (input.link?.trim() && !link) return { ok: false, error: "link" };
  const message = (input.message ?? "").trim().slice(0, 4000);
  if (message.length < way.minMessage) return { ok: false, error: "message" };

  const { orgId, userId } = await requireOrg();
  try {
    await db.insert(earnSubmissions).values({
      organizationId: orgId,
      userId,
      kind: input.kind,
      link,
      message,
      rewardCredits: way.credits,
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const [open] = await db
      .select({ status: earnSubmissions.status })
      .from(earnSubmissions)
      .where(and(eq(earnSubmissions.organizationId, orgId), eq(earnSubmissions.kind, input.kind), inArray(earnSubmissions.status, ["pending", "approved"])))
      .limit(1);
    return { ok: false, error: open?.status === "approved" ? "approved" : "already" };
  }

  revalidatePath("/earn-credits");
  return { ok: true };
}

/** The latest claim of each way for the caller's workspace. */
export async function listEarnClaims(): Promise<EarnClaim[]> {
  const { orgId } = await requireOrg();
  const rows = await db
    .select({
      kind: earnSubmissions.kind,
      status: earnSubmissions.status,
      credits: earnSubmissions.rewardCredits,
      reviewNote: earnSubmissions.reviewNote,
      at: earnSubmissions.createdAt,
    })
    .from(earnSubmissions)
    .where(eq(earnSubmissions.organizationId, orgId))
    .orderBy(desc(earnSubmissions.createdAt))
    .limit(40);

  const latest = new Map<EarnKind, EarnClaim>();
  for (const row of rows) {
    if (!isEarnKind(row.kind) || latest.has(row.kind)) continue;
    const status = row.status === "approved" || row.status === "declined" ? row.status : "pending";
    latest.set(row.kind, { kind: row.kind, status, credits: row.credits, reviewNote: row.reviewNote, at: row.at });
  }
  return [...latest.values()];
}

/**
 * Whether the caller's workspace may still enter someone's referral code:
 * not referred yet and never charged anything. Mirrors attachReferral's own
 * refusal, so the field is only offered where it can work.
 */
export async function canEnterReferralCode(): Promise<boolean> {
  const { orgId } = await requireOrg();
  const [[referred], [paid]] = await Promise.all([
    db.select({ id: referrals.id }).from(referrals).where(eq(referrals.referredOrgId, orgId)).limit(1),
    db
      .select({ id: payments.id })
      .from(payments)
      .where(and(eq(payments.organizationId, orgId), gt(payments.amountCents, 0), inArray(payments.status, ["paid", "refunded"])))
      .limit(1),
  ]);
  return !referred && !paid;
}

export type ReferralCodeError = "unknown_code" | "self_referral" | "not_new" | "already_referred";

/**
 * Enters the code of the person who recommended RepGet - the "they apply
 * your code" of the design, for someone who signed up without the link.
 *
 * Exactly attachReferral's rules: only a NEW workspace that has never paid
 * (here, one created within the referral cookie's thirty days, as for a
 * link opened before the click time was recorded), never your own code,
 * once per workspace. The reward still waits for the first real payment.
 */
export async function enterReferralCode(code: string): Promise<EarnResult<ReferralCodeError>> {
  const cleaned = String(code ?? "").trim().toUpperCase().slice(0, 32);
  if (!/^[A-Z0-9]{4,32}$/.test(cleaned)) return { ok: false, error: "unknown_code" };
  const { orgId } = await requireOrg();
  const outcome = await attachReferral(orgId, cleaned);
  if (!outcome.ok) return { ok: false, error: outcome.reason };
  revalidatePath("/earn-credits");
  return { ok: true };
}
