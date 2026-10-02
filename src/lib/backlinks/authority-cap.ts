import { eq, inArray } from "drizzle-orm";

import { AUTHORITY_METRIC } from "@/lib/authority/metric";
import { isEntitled } from "@/lib/billing-shared";
import { db } from "@/lib/db";
import { agencyWorkspaces, plans, subscriptions, websites } from "@/lib/db/schema";

/**
 * How high a website may set its MINIMUM Domain Authority for partners
 * linking to it, by plan (client, 2026-10-02): up to 60 on the standard
 * plans; anything higher - the scarcest, most valuable links - is the Scale
 * plan's. Agency workspaces are ours and have the full range.
 *
 * Read from the website's OWN subscription (each website has its plan), and
 * applied wherever the minimum is used: saving it, showing it, and placing a
 * link (lib/backlinks/managed.ts). A value saved on Scale that is above the
 * cap after a downgrade is not deleted - it counts as the cap until the
 * website is on Scale again.
 */

export const STANDARD_MIN_RANK_CAP = 60;

export function minRankCap(tier: string | null, agency: boolean): number {
  return agency || tier === "scale" ? AUTHORITY_METRIC.scaleMax : STANDARD_MIN_RANK_CAP;
}

/** The minimum that applies: the stored one, held to the plan's cap. */
export function effectiveMinSourceRank(stored: number | null, cap: number): number | null {
  return stored === null ? null : Math.min(stored, cap);
}

type Reader = Pick<typeof db, "select">;

/** Each website's cap, in one query. Pass the caller's transaction when it holds one. */
export async function minRankCaps(websiteIds: string[], executor: Reader = db): Promise<Map<string, number>> {
  const caps = new Map<string, number>();
  if (websiteIds.length === 0) return caps;
  const rows = await executor
    .select({
      websiteId: websites.id,
      agency: agencyWorkspaces.organizationId,
      tier: plans.tier,
      status: subscriptions.status,
    })
    .from(websites)
    .leftJoin(agencyWorkspaces, eq(agencyWorkspaces.organizationId, websites.organizationId))
    .leftJoin(subscriptions, eq(subscriptions.websiteId, websites.id))
    .leftJoin(plans, eq(plans.id, subscriptions.planId))
    .where(inArray(websites.id, websiteIds));
  for (const id of websiteIds) caps.set(id, STANDARD_MIN_RANK_CAP);
  for (const row of rows) {
    // A plan counts only while it is paid for: a cancelled Scale subscription is not Scale.
    const tier = row.status && isEntitled(row.status) ? row.tier : null;
    const cap = minRankCap(tier, row.agency !== null);
    caps.set(row.websiteId, Math.max(caps.get(row.websiteId) ?? 0, cap));
  }
  return caps;
}

export async function minRankCapFor(websiteId: string, executor: Reader = db): Promise<number> {
  return (await minRankCaps([websiteId], executor)).get(websiteId) ?? STANDARD_MIN_RANK_CAP;
}
