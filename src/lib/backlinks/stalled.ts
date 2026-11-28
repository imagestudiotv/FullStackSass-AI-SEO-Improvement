import "server-only";

import { and, asc, eq, gt, inArray, lt, sql } from "drizzle-orm";

import { backlinkExchangeOnSql, EXCHANGE_PREFIX } from "@/lib/backlinks/exchange-switch";
import { findHost } from "@/lib/backlinks/matching";
import { db } from "@/lib/db";
import { backlinkRequests, creditSettings, member, placements, user, websites } from "@/lib/db/schema";
import { BACKLINK_EXCHANGE_COPY } from "@/lib/i18n/backlink-exchange";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/config";
import { format, plural } from "@/lib/i18n/format";
import { notify } from "@/lib/notifications/create";

/**
 * Nothing stalls with credits held forever now that the Backlink Exchange is
 * opt-in and OFF for every existing website (lib/backlinks/exchange-switch.ts,
 * owner 2026-11-27; eval 2026-11-28 R1).
 *
 * The AUTOMATIC side only. The RepGet team's placements (`managed`) are never
 * touched: they are written into a draft by an administrator and follow their
 * own rules (lib/backlinks/managed.ts).
 *
 * Run daily (inngest/functions/activate-exchange.ts), in this order:
 *
 *  1. returnLinksFromHostsSwitchedOff - an automatically matched link still
 *     "pending" (no article yet) on a host whose switch is OFF would never be
 *     written (generate-article takes pending links only from hosts that are
 *     ON). It is taken back and its request waits again, for a host that is ON.
 *  2. matchWaitingRequests - a waiting request gets a host whose switch is ON,
 *     through the same findHost a new request used (relevance, language, no
 *     reciprocal links, the host's monthly cap).
 *  3. releaseStalledRequests - a request that has waited more than
 *     WAIT_LIMIT_DAYS for a host is closed and its hold released, and its
 *     workspace is told (in-app notification, in the owner's language).
 *
 * NO MONEY MOVES. A request only HOLDS credits (credits_reserved, counted
 * while it is pending or matched); nothing is charged until a link is seen
 * live (lib/backlinks/placements.ts "RESERVED IS NOT THE LEDGER"). Releasing a
 * hold is what cancelRequest and withdrawPlacement already do: status
 * "cancelled", credits_reserved 0, no ledger row.
 */

/** How long a request may wait for an automatic host before its hold is released. */
export const WAIT_LIMIT_DAYS = 14;

/** Requests looked at per run, so one run stays short. */
const BATCH = 200;

/** A placement that still owns its request's hold, or may again: on its way, live, or not found yet (a recheck can revive it). */
const OWNS_THE_HOLD = ["pending", "drafted", "published", "live", "unverified"];

/**
 * A request waiting for an automatic host: pending, holding credits, and with
 * no placement that owns the hold - and never one of the RepGet team's (a
 * managed request is closed, not sent back to waiting).
 */
const waiting = and(
  eq(backlinkRequests.status, "pending"),
  gt(backlinkRequests.creditsReserved, 0),
  sql`not exists (
    select 1 from ${placements} p
    where p.request_id = ${backlinkRequests.id}
      and (p.managed or p.status in (${sql.join(OWNS_THE_HOLD.map((s) => sql`${s}`), sql`, `)}))
  )`,
);

/** Step 1. Returns how many links were taken back from hosts with the switch OFF. */
export async function returnLinksFromHostsSwitchedOff(now: Date = new Date()): Promise<number> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .select({ id: placements.id, requestId: placements.requestId })
      .from(placements)
      .where(
        and(
          eq(placements.status, "pending"),
          eq(placements.managed, false),
          // A host that is gone counts as off: nothing would ever write the link.
          sql`not ${backlinkExchangeOnSql(placements.hostWebsiteId)}`,
        ),
      )
      .orderBy(asc(placements.id))
      .limit(BATCH)
      .for("update", { of: placements });

    let returned = 0;
    for (const row of rows) {
      /*
        Deleted, as cancelRequest does with a link not yet written: a pending
        placement has no article and no checks, and a kept row would show the
        old host beside a request that is waiting again (listRequests).
      */
      const gone = await tx
        .delete(placements)
        .where(and(eq(placements.id, row.id), eq(placements.status, "pending"), eq(placements.managed, false)))
        .returning({ id: placements.id });
      if (gone.length === 0) continue;
      returned += 1;
      const [other] = await tx
        .select({ id: placements.id })
        .from(placements)
        .where(and(eq(placements.requestId, row.requestId), inArray(placements.status, OWNS_THE_HOLD)))
        .limit(1);
      if (other) continue;
      // Waiting again from now: the WAIT_LIMIT_DAYS count starts here.
      await tx
        .update(backlinkRequests)
        .set({ status: "pending", updatedAt: now })
        .where(and(eq(backlinkRequests.id, row.requestId), eq(backlinkRequests.status, "matched")));
    }
    return returned;
  });
}

/** Step 2. Returns how many waiting requests got a host whose switch is ON. */
export async function matchWaitingRequests(now: Date = new Date()): Promise<number> {
  // No website has the exchange on: nothing can match, so no query per request.
  const [anyOn] = await db
    .select({ key: creditSettings.key })
    .from(creditSettings)
    .where(and(sql`${creditSettings.key} like ${`${EXCHANGE_PREFIX}%`}`, gt(creditSettings.value, 0)))
    .limit(1);
  if (!anyOn) return 0;

  const rows = await db
    .select({
      id: backlinkRequests.id,
      anchorHint: backlinkRequests.anchorHint,
      creditsReserved: backlinkRequests.creditsReserved,
      websiteId: websites.id,
      organizationId: websites.organizationId,
      niche: websites.industry,
      language: websites.language,
      country: websites.country,
    })
    .from(backlinkRequests)
    .innerJoin(websites, eq(websites.id, backlinkRequests.websiteId))
    .where(waiting)
    .orderBy(asc(backlinkRequests.updatedAt))
    .limit(BATCH);

  let matched = 0;
  for (const row of rows) {
    const host = await findHost({
      requesterWebsiteId: row.websiteId,
      requesterOrgId: row.organizationId,
      niche: row.niche,
      language: row.language,
      country: row.country,
    });
    if (!host) continue;
    const done = await db.transaction(async (tx) => {
      // Compare-and-set: a request cancelled or matched meanwhile is left alone.
      const claimed = await tx
        .update(backlinkRequests)
        .set({ status: "matched", updatedAt: now })
        .where(and(eq(backlinkRequests.id, row.id), waiting))
        .returning({ id: backlinkRequests.id });
      if (claimed.length === 0) return false;
      await tx.insert(placements).values({
        requestId: row.id,
        hostWebsiteId: host.websiteId,
        anchor: row.anchorHint?.trim() || null,
        credits: row.creditsReserved,
        status: "pending",
      });
      return true;
    });
    if (done) matched += 1;
  }
  return matched;
}

export type ReleasedRequests = { requests: number; credits: number; workspaces: number };

/** Step 3. Closes requests that waited more than WAIT_LIMIT_DAYS, releases their holds and tells each workspace once. */
export async function releaseStalledRequests(now: Date = new Date()): Promise<ReleasedRequests> {
  const cutoff = new Date(now.getTime() - WAIT_LIMIT_DAYS * 24 * 60 * 60 * 1000);
  const released = await db.transaction(async (tx) => {
    // Locked, so what each holds cannot change before it is released.
    const due = await tx
      .select({ id: backlinkRequests.id, websiteId: backlinkRequests.websiteId, credits: backlinkRequests.creditsReserved })
      .from(backlinkRequests)
      .where(and(waiting, lt(backlinkRequests.updatedAt, cutoff)))
      .orderBy(asc(backlinkRequests.id))
      .limit(BATCH)
      .for("update");
    if (due.length === 0) return [];
    const closed = await tx
      .update(backlinkRequests)
      .set({ status: "cancelled", creditsReserved: 0, updatedAt: now })
      .where(
        and(
          inArray(
            backlinkRequests.id,
            due.map((row) => row.id),
          ),
          waiting,
        ),
      )
      .returning({ id: backlinkRequests.id });
    const ids = new Set(closed.map((row) => row.id));
    return due.filter((row) => ids.has(row.id));
  });
  if (released.length === 0) return { requests: 0, credits: 0, workspaces: 0 };

  // One notice per website: how many requests, and the credits now free again.
  const byWebsite = new Map<string, { requests: number; credits: number }>();
  for (const row of released) {
    const entry = byWebsite.get(row.websiteId) ?? { requests: 0, credits: 0 };
    entry.requests += 1;
    entry.credits += row.credits;
    byWebsite.set(row.websiteId, entry);
  }
  const sites = await db
    .select({ id: websites.id, domain: websites.domain, organizationId: websites.organizationId })
    .from(websites)
    .where(inArray(websites.id, [...byWebsite.keys()]));
  const workspaces = new Set<string>();
  for (const site of sites) {
    const counts = byWebsite.get(site.id);
    if (!counts) continue;
    workspaces.add(site.organizationId);
    const copy = await ownerCopy(site.organizationId);
    await notify({
      organizationId: site.organizationId,
      type: "backlink.released",
      title: format(copy.releasedTitle, { domain: site.domain }),
      body: plural(copy.releasedBody, counts.requests, { n: counts.requests, days: WAIT_LIMIT_DAYS, credits: counts.credits }),
      href: `/websites/${site.id}/backlinks`,
    });
  }
  const credits = released.reduce((sum, row) => sum + row.credits, 0);
  return { requests: released.length, credits, workspaces: workspaces.size };
}

/** Notifications are stored once, for everyone in the workspace, in its owner's language (as lib/articles/release.ts). */
async function ownerCopy(organizationId: string) {
  const [owner] = await db
    .select({ locale: user.locale })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(and(eq(member.organizationId, organizationId), eq(member.role, "owner")))
    .limit(1);
  return BACKLINK_EXCHANGE_COPY[owner?.locale && isLocale(owner.locale) ? owner.locale : DEFAULT_LOCALE];
}
