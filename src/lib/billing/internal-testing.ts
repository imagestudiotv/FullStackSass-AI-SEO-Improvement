import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { subscriptions, websites } from "@/lib/db/schema";

/**
 * Scoped internal testing access (the owner's decision on the 2026-11-05 ticket:
 * repget.com in Daniel's workspace "using scoped internal testing access. No
 * paid subscription purchase.").
 *
 * INTERNAL_TEST_WEBSITE_IDS lists website ids, comma-separated. Unset or empty
 * means nobody, so deploying this changes nothing.
 *
 * ONE WEBSITE AT A TIME, on purpose. An agency workspace would have been the
 * short way, but it is workspace-wide (lib/usage.ts resolvePlan), and Image
 * Studio shares this workspace.
 *
 * ONLY WHO ASKS. A listed website is not "paid": this answers yes only to the
 * callers that pass `internalTesting: true` (lib/billing/entitled.ts,
 * lib/billing/require-plan.ts), which are website audits and social tools.
 * Articles, keywords, AI visibility, backlinks, chat, videos and translations
 * do not ask, so they refuse as they would without it.
 *
 * ONLY WITHOUT A SUBSCRIPTION. Any subscription row ends it, whatever its state:
 * a live plan answers for itself, and a cancelled or unpaid one stays refused.
 * That is read here, not from checkLimit's "no_active_plan", which also describes
 * a cancelled row that has lost its plan.
 *
 * It writes nothing: no subscription, plan, credits or agency row. Whatever is
 * priced is still charged to the workspace's wallet.
 */

function listedWebsiteIds(): string[] {
  return (process.env.INTERNAL_TEST_WEBSITE_IDS ?? "")
    .split(",")
    .map((id) => id.trim().toLowerCase())
    .filter(Boolean);
}

/** Whether this website is listed, exists, and has never had a subscription row. */
export async function isInternalTestingWebsite(websiteId: string): Promise<boolean> {
  if (!listedWebsiteIds().includes(websiteId.toLowerCase())) return false;
  const rows = await db
    .select({ subscriptionId: subscriptions.id })
    .from(websites)
    .leftJoin(subscriptions, eq(subscriptions.websiteId, websites.id))
    .where(eq(websites.id, websiteId));
  return rows.length > 0 && rows.every((row) => row.subscriptionId === null);
}
