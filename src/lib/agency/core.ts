import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { agencyWorkspaces } from "@/lib/db/schema";

/**
 * Agency workspaces.
 *
 * A workspace we operate rather than one a customer bought. It exists to seed
 * the backlink network: the brief plans to run 20-30 of our own websites in
 * the exchange until there are enough customers to sustain it.
 *
 * This grants entitlement WITHOUT a subscription, which makes it the one path
 * in the product that hands out paid features for free. Two consequences:
 *
 *  - rows are created by an admin and never by a customer-facing action
 *  - the limits are read from the row, not assumed unlimited, so an agency
 *    workspace still cannot run away with cost
 *
 * Imported by usage.ts, so no "use server" directive.
 */

export type AgencyLimits = {
  articles: number;
  keywords: number;
  websites: number;
};

/**
 * Limits for an agency workspace, or null when it is an ordinary one.
 *
 * Called on every limit check, so it is one indexed lookup by organisation and
 * nothing more.
 */
export async function agencyLimits(
  orgId: string,
): Promise<AgencyLimits | null> {
  const [row] = await db
    .select({
      articles: agencyWorkspaces.articleLimit,
      keywords: agencyWorkspaces.keywordLimit,
      websites: agencyWorkspaces.siteLimit,
    })
    .from(agencyWorkspaces)
    .where(eq(agencyWorkspaces.organizationId, orgId))
    .limit(1);

  return row ?? null;
}

/** True when this workspace is one of ours. */
export async function isAgencyWorkspace(orgId: string): Promise<boolean> {
  return (await agencyLimits(orgId)) !== null;
}
