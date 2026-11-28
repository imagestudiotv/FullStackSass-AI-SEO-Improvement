import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { websites } from "@/lib/db/schema";
import { readSelectedWebsite, resolveWebsiteId } from "@/lib/websites/selected";

/**
 * A website's target market (websites.country), for the add-ons offered to it
 * (lib/addons/market.ts). Null for no website, or one with no market set.
 */
export async function websiteMarket(websiteId: string | null | undefined): Promise<string | null> {
  if (!websiteId) return null;
  const [row] = await db.select({ country: websites.country }).from(websites).where(eq(websites.id, websiteId)).limit(1);
  return row?.country ?? null;
}

/**
 * The market of the website the switcher is on, among those this workspace
 * owns - resolved as Billing and the sidebar resolve it - for a page that has
 * no website in its address (Buy credits).
 */
export async function selectedWebsiteMarket(organizationId: string): Promise<string | null> {
  const owned = await db
    .select({ id: websites.id, country: websites.country })
    .from(websites)
    .where(eq(websites.organizationId, organizationId))
    .orderBy(websites.createdAt);
  const id = resolveWebsiteId(
    null,
    await readSelectedWebsite(),
    owned.map((site) => site.id),
  );
  return owned.find((site) => site.id === id)?.country ?? null;
}
