"use server";

import { revalidatePath } from "next/cache";

import { requireOrg } from "@/lib/tenant";
import { hasOnlySharedWork } from "@/lib/websites/accessible";

import { claimRewardedAd, endRewardedAd, isEndReason, startRewardedAd, type ClaimResult, type StartResult } from "./rewarded-ads";

/**
 * The "Watch an ad to earn credits" card's buttons (lib/earn/rewarded-ads.ts).
 * Who acts and for which workspace is always the signed-in session
 * (requireOrg); the browser names only its own attempt. Earn Credits is for
 * one's own workspace, so someone with only shared work is refused, as for
 * the Discover bonus.
 */

export async function startRewardedAdAction(): Promise<StartResult> {
  const { orgId, userId } = await requireOrg();
  if (!userId || (await hasOnlySharedWork())) return { ok: false, error: "disabled", state: null };
  return startRewardedAd(userId, orgId);
}

export async function claimRewardedAdAction(sessionId: string): Promise<ClaimResult> {
  const { orgId, userId } = await requireOrg();
  if (!userId || (await hasOnlySharedWork())) return { ok: false, error: "disabled", state: null };
  const result = await claimRewardedAd(userId, orgId, String(sessionId ?? ""));
  // The layout's balance and the Credits page's history.
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function endRewardedAdAction(sessionId: string, reason: string): Promise<void> {
  const { orgId, userId } = await requireOrg();
  if (!userId) return;
  await endRewardedAd(userId, orgId, String(sessionId ?? ""), isEndReason(reason) ? reason : "closed_early");
}
