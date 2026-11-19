import "server-only";

/**
 * Support requests per Free workspace, for Admin -> Free plan launch.
 *
 * The requests live in Crisp (the onboarding help work of 2026-11-19, ticket
 * item 6). Until that is connected this answers null, and the dashboard
 * shows "—" rather than a zero nobody measured. Wired at integration: given
 * the Free accounts' user ids (who pressed "Start Free"), return how many
 * conversations each one started (Map keyed by user id), or null when Crisp
 * cannot be read.
 */
export async function countSupportRequests(userIds: string[]): Promise<Map<string, number> | null> {
  void userIds;
  return null;
}
