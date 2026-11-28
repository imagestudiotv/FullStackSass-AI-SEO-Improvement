import "server-only";

import { eq, sql, type SQL, type SQLWrapper } from "drizzle-orm";

import { db } from "@/lib/db";
import { creditSettings } from "@/lib/db/schema";
import type { Executor } from "@/lib/db/types";

/**
 * The Backlink Exchange switch: AUTOMATIC partner links, OPT-IN (owner,
 * 2026-11-27).
 *
 * The exchange used to say it "may place partners' links in your articles
 * before they are published. You never have to choose partners or approve
 * each link." Google treats excessive link exchanges as a link scheme, so
 * putting other businesses' links into a customer's articles automatically
 * is now something the customer switches on, per website. Default OFF.
 *
 * WHAT IT GATES - the automatic paths only:
 *  - matching (lib/backlinks/matching.ts findHost): a website is offered as
 *    an automatic host only with the switch on;
 *  - article writing (inngest/functions/generate-article.ts): an
 *    automatically matched ("pending") partner link is written into an
 *    article only for a website with the switch on.
 * NOT the RepGet team's own placements (Admin -> Partner Network,
 * lib/backlinks/managed.ts): those stay possible whatever the switch says,
 * under their existing rules (the website takes part in the network, is
 * connected, relevance, no reciprocal links...).
 *
 * NOTHING STALLS (lib/backlinks/stalled.ts, daily): an automatic link not yet
 * written on a host that is OFF goes back to waiting, a waiting request is
 * matched to a host that is ON, and one that waited more than 14 days is
 * closed with its held credits released and its workspace told.
 *
 * STORED WITHOUT A MIGRATION, as the administrators' per-website number
 * settings are (lib/publishing/daily-cap.ts "articles_per_day:<id>"): one
 * credit_settings row `backlink_exchange:<websiteId>`, value 1 for on, 0 for
 * off. No row is OFF - so every existing website is OFF until its owner
 * switches it on.
 */
export const EXCHANGE_PREFIX = "backlink_exchange:";

export const exchangeKey = (websiteId: string) => `${EXCHANGE_PREFIX}${websiteId}`;

/** Whether this website switched the Backlink Exchange on. */
export async function backlinkExchangeOn(websiteId: string, executor: Pick<Executor, "select"> = db): Promise<boolean> {
  const [row] = await executor
    .select({ value: creditSettings.value })
    .from(creditSettings)
    .where(eq(creditSettings.key, exchangeKey(websiteId)))
    .limit(1);
  return (row?.value ?? 0) > 0;
}

/** The same test inside a query, for the website id in `websiteIdColumn`. */
export function backlinkExchangeOnSql(websiteIdColumn: SQLWrapper): SQL<boolean> {
  return sql<boolean>`exists (
    select 1 from ${creditSettings} cs
    where cs.key = ${EXCHANGE_PREFIX} || (${websiteIdColumn})::text and cs.value > 0
  )`;
}

/** Stores the choice (1 on, 0 off). The caller has checked who may change it. */
export async function writeBacklinkExchange(websiteId: string, on: boolean, updatedBy: string | null, executor: Executor = db): Promise<void> {
  const now = new Date();
  await executor
    .insert(creditSettings)
    .values({ key: exchangeKey(websiteId), value: on ? 1 : 0, updatedBy, updatedAt: now })
    .onConflictDoUpdate({ target: creditSettings.key, set: { value: on ? 1 : 0, updatedBy, updatedAt: now } });
}
