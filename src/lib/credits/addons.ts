import "server-only";

import { and, asc, eq, gt, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import { addons } from "@/lib/db/schema";

export type CreditService = {
  id: string;
  name: string;
  /** "service" (bought outright) or "quote" (creditPrice is the "from" figure). */
  kind: string;
  creditPrice: number;
};

/**
 * The services on sale for credits, for the Credits page's price list
 * (bought on Billing, lib/addons/actions.ts). Credit packs are not here: they
 * are what credits are bought with.
 */
export async function creditAddons(): Promise<CreditService[]> {
  const rows = await db
    .select({ id: addons.id, name: addons.name, kind: addons.kind, creditPrice: addons.creditPrice })
    .from(addons)
    .where(and(eq(addons.isActive, true), inArray(addons.kind, ["service", "quote"]), gt(addons.creditPrice, 0)))
    .orderBy(asc(addons.sortOrder));
  return rows.map((row) => ({ ...row, creditPrice: row.creditPrice ?? 0 }));
}
