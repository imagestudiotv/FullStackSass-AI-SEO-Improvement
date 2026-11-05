"use server";

import { revalidatePath } from "next/cache";

import { requireOrg } from "@/lib/tenant";

import { claimDailyCredits, type DailyClaim } from "./daily";

/**
 * The daily check-in button (client, 2026-11-05). It takes no arguments on
 * purpose: the workspace is the signed-in session's (requireOrg), so a call
 * can never claim for anyone else, whatever a client sends.
 */
export async function claimDailyCreditsAction(): Promise<DailyClaim> {
  const { orgId } = await requireOrg();
  const claim = await claimDailyCredits(orgId);
  // The layout's balance and "+3 today", the Credits page's history, Earn Credits.
  if (claim.outcome === "claimed") revalidatePath("/", "layout");
  return claim;
}
