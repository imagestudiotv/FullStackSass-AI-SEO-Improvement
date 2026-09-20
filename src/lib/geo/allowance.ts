import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { plans, subscriptions } from "@/lib/db/schema";
import { maxPromptsForTier } from "@/lib/geo/shared";

/**
 * How many AI-visibility questions a website may track.
 *
 * Driven by the plan paying for THAT website, not the workspace: billing is
 * per site, so a customer on Scale for one domain and Grow for another gets
 * 50 on the first and 20 on the second.
 *
 * Deliberately forgiving about entitlement. Unlike article generation — which
 * spends money per run and so refuses outright without a live subscription —
 * this only decides how long a list may get. Someone whose webhook has not
 * landed yet, or whose card failed this morning, sees a working screen with
 * the default allowance rather than a page telling them they may track
 * nothing. The real spend gate is on the check itself, not on the list.
 */
export async function maxPromptsFor(websiteId: string): Promise<number> {
  const [row] = await db
    .select({ tier: plans.tier })
    .from(subscriptions)
    .leftJoin(plans, eq(subscriptions.planId, plans.id))
    .where(eq(subscriptions.websiteId, websiteId))
    .limit(1);

  return maxPromptsForTier(row?.tier);
}
