import { sql, type AnyColumn, type SQL } from "drizzle-orm";

import { db } from "@/lib/db";
import { PUBLISHING_KINDS } from "@/lib/publishing/kinds";

/**
 * Whether a website is connected to RepGet: a connected publishing
 * integration, or the RepGet plugin checking in with a live key. The same two
 * ways the launch checklist, Needs attention and the admin queue count
 * (lib/onboarding/launch.ts, lib/dashboard/next-actions.ts, lib/admin/network.ts).
 *
 * Either is also the only proof RepGet holds that the website is the
 * customer's: both need access to the site itself to set up.
 */

/** The same question in SQL, for a query over websites. */
export function websiteConnectedSql(websiteId: AnyColumn | SQL): SQL<boolean> {
  // Wrapped, so a query over one table does not shorten it to "id", which the subqueries would read as their own.
  const id = sql`${websiteId}`;
  return sql<boolean>`(exists (
    select 1 from integrations i where i.website_id = ${id} and i.status = 'connected'
      and i.kind in (${sql.join(PUBLISHING_KINDS.map((kind) => sql`${kind}`), sql`, `)})
  ) or exists (
    select 1 from integration_keys k where k.website_id = ${id} and k.revoked_at is null and k.last_used_at is not null
  ))`;
}

export async function isWebsiteConnected(websiteId: string): Promise<boolean> {
  const [row] = await db.select({ connected: websiteConnectedSql(sql`${websiteId}::uuid`) }).from(sql`(select 1) as one`);
  return Boolean(row?.connected);
}
