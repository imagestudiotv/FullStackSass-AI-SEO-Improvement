import "server-only";

import { and, eq, isNotNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { socialAccounts } from "@/lib/db/schema";

import { resumesAt } from "./pause";

/**
 * Turns automatic posting on again for accounts paused only because our
 * posting provider had run out (pause.ts). Run by the daily job before the
 * day's suggestions, so the next own post is the one careful try: an account
 * gets one own post a day, and a refusal pauses it again from that moment.
 *
 * Every social_accounts row, the video platforms' too: they share the
 * provider's limit and the pause columns. A platform's own refusal is never
 * touched here, and neither is the customer's automatic-posting switch.
 */
export async function resumeQuotaPauses(now: Date = new Date()): Promise<{ id: string; websiteId: string; platform: string }[]> {
  const paused = await db
    .select({
      id: socialAccounts.id,
      websiteId: socialAccounts.websiteId,
      platform: socialAccounts.platform,
      pausedAt: socialAccounts.pausedAt,
      reason: socialAccounts.pausedReason,
    })
    .from(socialAccounts)
    .where(isNotNull(socialAccounts.pausedAt));
  const resumed: { id: string; websiteId: string; platform: string }[] = [];
  for (const account of paused) {
    const at = account.pausedAt ? resumesAt(account.reason, account.pausedAt) : null;
    if (!at || at.getTime() > now.getTime()) continue;
    const [row] = await db
      .update(socialAccounts)
      .set({ pausedAt: null, pausedReason: null, updatedAt: now })
      // Only the pause that was read: one written meanwhile stays.
      .where(and(eq(socialAccounts.id, account.id), eq(socialAccounts.pausedReason, account.reason ?? ""), isNotNull(socialAccounts.pausedAt)))
      .returning({ id: socialAccounts.id });
    if (row) resumed.push({ id: account.id, websiteId: account.websiteId, platform: account.platform });
  }
  return resumed;
}
