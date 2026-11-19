import "server-only";

import { inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import { supportChatState } from "@/lib/db/schema";

/**
 * Support requests per person, for the admin's Free plan dashboard (ticket
 * 2026-11-19, item 1: "track ... support requests").
 *
 * A request is a burst of messages the person sent in the in-app chat, a new
 * one after SUPPORT_REQUEST_GAP_HOURS of quiet (lib/support/onboarding-welcome.ts,
 * recordSupportChatEvent). Counted from the day this shipped, from the
 * signed-in app only: the anonymous chat on the marketing pages and email
 * cannot be tied to an account. Everyone asked for is in the map, 0 when
 * they never wrote.
 */
export async function countSupportRequests(userIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>(userIds.map((id) => [id, 0]));
  const ids = [...new Set(userIds)].filter(Boolean);
  if (ids.length === 0) return counts;
  // In slices, so a long list never becomes one enormous parameter list.
  for (let i = 0; i < ids.length; i += 1000) {
    const rows = await db
      .select({ userId: supportChatState.userId, requests: supportChatState.supportRequests })
      .from(supportChatState)
      .where(inArray(supportChatState.userId, ids.slice(i, i + 1000)));
    for (const row of rows) counts.set(row.userId, row.requests);
  }
  return counts;
}
