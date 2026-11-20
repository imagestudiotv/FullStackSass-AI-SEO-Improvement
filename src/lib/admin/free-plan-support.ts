import "server-only";

import { countSupportRequests as countCrispConversations } from "@/lib/support/crisp-events";

/**
 * Support requests per Free workspace, for Admin -> Free plan launch.
 *
 * The requests are the Crisp conversations recorded by the onboarding help
 * work of 2026-11-19 (ticket item 6): given the Free accounts' user ids (who
 * pressed "Start Free"), how many conversations each one started (Map keyed by
 * user id). Null when they cannot be read, so the dashboard shows "—" rather
 * than a zero nobody measured.
 */
export async function countSupportRequests(userIds: string[]): Promise<Map<string, number> | null> {
  return countCrispConversations(userIds).catch(() => null);
}
