"use server";

import { and, desc, eq, sql as raw } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import {
  backlinkRequests,
  networkSites,
  placements,
  websites,
} from "@/lib/db/schema";
import {
  earnedThisMonth,
  getAvailable,
  grantMonthlyCredits,
  listLedger,
  recordCredit,
  type LedgerRow,
} from "@/lib/backlinks/credits";
import { describeNetwork, findHost } from "@/lib/backlinks/matching";
import { requireWebsite } from "@/lib/tenant";
import { InvalidUrlError, normalizeWebsiteUrl } from "@/lib/websites/url";
import type { ActionResult } from "@/lib/websites/actions";

/**
 * Backlink network actions.
 *
 * Everything is scoped through requireWebsite(). Credits move only through
 * recordCredit, so no path here can change a balance without leaving a row
 * explaining why.
 */

export type NetworkStatus = {
  joined: boolean;
  acceptingLinks: boolean;
  niche: string | null;
  language: string | null;
  country: string | null;
  monthlyCap: number;
  linksGivenThisMonth: number;
  balance: number;
  reserved: number;
  available: number;
  earnedThisMonth: number;
  network: { totalSites: number; acceptingSites: number; withCapacity: number };
};

export async function getNetworkStatus(
  websiteId: string,
): Promise<NetworkStatus> {
  const { site, orgId } = await requireWebsite(websiteId);

  // Granted on read rather than by a scheduler: idempotent by month, so a
  // customer never has to wait for a cron to see the credits they paid for.
  await grantMonthlyCredits(orgId);

  const [row] = await db
    .select()
    .from(networkSites)
    .where(eq(networkSites.websiteId, site.id))
    .limit(1);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [given] = await db
    .select({ n: raw<number>`count(*)::int` })
    .from(placements)
    .where(
      and(
        eq(placements.hostWebsiteId, site.id),
        // ISO string: postgres-js cannot bind a Date inside raw SQL.
        raw`${placements.createdAt} >= ${monthStart.toISOString()}::timestamp`,
      ),
    );

  const [credits, earned, network] = await Promise.all([
    getAvailable(orgId),
    earnedThisMonth(orgId),
    describeNetwork(),
  ]);

  return {
    joined: Boolean(row),
    acceptingLinks: row?.acceptingLinks ?? false,
    niche: row?.niche ?? site.industry,
    language: row?.language ?? site.language,
    country: row?.country ?? site.country,
    monthlyCap: row?.monthlyCap ?? 3,
    linksGivenThisMonth: given?.n ?? 0,
    balance: credits.balance,
    reserved: credits.reserved,
    available: credits.available,
    earnedThisMonth: earned,
    network,
  };
}

/**
 * Joins or updates network participation.
 *
 * The cap defaults low. A site hosting many outbound links a month starts to
 * look like a link farm, which harms the host far more than it helps them.
 */
export async function joinNetwork(
  websiteId: string,
  input: {
    acceptingLinks: boolean;
    niche?: string | null;
    language?: string | null;
    country?: string | null;
    monthlyCap?: number;
  },
): Promise<ActionResult<null>> {
  const { site } = await requireWebsite(websiteId);

  const cap = Math.max(0, Math.min(input.monthlyCap ?? 3, 20));
  const values = {
    acceptingLinks: input.acceptingLinks,
    niche: input.niche?.trim() || site.industry,
    language: input.language?.trim() || site.language,
    country: input.country?.trim() || site.country,
    monthlyCap: cap,
    updatedAt: new Date(),
  };

  await db
    .insert(networkSites)
    .values({ websiteId: site.id, ...values })
    .onConflictDoUpdate({ target: networkSites.websiteId, set: values });

  revalidatePath(`/websites/${site.id}`);
  return { ok: true, data: null };
}

export async function leaveNetwork(
  websiteId: string,
): Promise<ActionResult<null>> {
  const { site } = await requireWebsite(websiteId);

  /**
   * Marked as not accepting rather than deleted. Existing placements point at
   * this row, and removing it would orphan links that are still live on the
   * customer's site.
   */
  await db
    .update(networkSites)
    .set({ acceptingLinks: false, updatedAt: new Date() })
    .where(eq(networkSites.websiteId, site.id));

  revalidatePath(`/websites/${site.id}`);
  return { ok: true, data: null };
}

export type RequestRow = {
  id: string;
  targetUrl: string;
  anchorHint: string | null;
  status: string;
  creditsReserved: number;
  createdAt: Date;
  hostDomain: string | null;
  liveUrl: string | null;
};

export async function listRequests(websiteId: string): Promise<RequestRow[]> {
  const { site } = await requireWebsite(websiteId);

  return db
    .select({
      id: backlinkRequests.id,
      targetUrl: backlinkRequests.targetUrl,
      anchorHint: backlinkRequests.anchorHint,
      status: backlinkRequests.status,
      creditsReserved: backlinkRequests.creditsReserved,
      createdAt: backlinkRequests.createdAt,
      hostDomain: websites.domain,
      liveUrl: placements.liveUrl,
    })
    .from(backlinkRequests)
    .leftJoin(placements, eq(placements.requestId, backlinkRequests.id))
    .leftJoin(websites, eq(placements.hostWebsiteId, websites.id))
    .where(eq(backlinkRequests.websiteId, site.id))
    .orderBy(desc(backlinkRequests.createdAt));
}

/** Links this site has hosted for others, and the credits they earned. */
export type GivenRow = {
  id: string;
  targetUrl: string;
  anchor: string | null;
  liveUrl: string | null;
  status: string;
  credits: number;
  createdAt: Date;
};

export async function listGiven(websiteId: string): Promise<GivenRow[]> {
  const { site } = await requireWebsite(websiteId);

  return db
    .select({
      id: placements.id,
      targetUrl: backlinkRequests.targetUrl,
      anchor: placements.anchor,
      liveUrl: placements.liveUrl,
      status: placements.status,
      credits: placements.credits,
      createdAt: placements.createdAt,
    })
    .from(placements)
    .innerJoin(backlinkRequests, eq(placements.requestId, backlinkRequests.id))
    .where(eq(placements.hostWebsiteId, site.id))
    .orderBy(desc(placements.createdAt));
}

const CREDITS_PER_LINK = 1;

/**
 * Requests a link, reserving the credit and matching a host immediately.
 *
 * Reserved at creation rather than on placement: without it, an organization
 * with two credits could raise five requests and the shortfall would only
 * appear once links were already promised.
 */
export async function requestBacklink(
  websiteId: string,
  input: { targetUrl: string; anchorHint?: string | null },
): Promise<ActionResult<{ matched: boolean; hostDomain: string | null }>> {
  const { site, orgId } = await requireWebsite(websiteId);

  let targetUrl: string;
  try {
    targetUrl = normalizeWebsiteUrl(input.targetUrl).url;
  } catch (error) {
    if (error instanceof InvalidUrlError) return { ok: false, error: error.message };
    throw error;
  }

  // The target must belong to this website; requesting links to somewhere else
  // would make the network a tool for pointing links at arbitrary sites.
  if (!targetUrl.includes(site.domain)) {
    return {
      ok: false,
      error: `The page must be on ${site.domain}`,
    };
  }

  await grantMonthlyCredits(orgId);
  const credits = await getAvailable(orgId);
  if (credits.available < CREDITS_PER_LINK) {
    return {
      ok: false,
      error:
        credits.reserved > 0
          ? `No credits available (${credits.reserved} reserved by pending requests)`
          : "You have no backlink credits left this month",
    };
  }

  const [request] = await db
    .insert(backlinkRequests)
    .values({
      websiteId: site.id,
      targetUrl,
      anchorHint: input.anchorHint?.trim() || null,
      status: "pending",
      creditsReserved: CREDITS_PER_LINK,
    })
    .returning({ id: backlinkRequests.id });

  const host = await findHost({
    requesterWebsiteId: site.id,
    requesterOrgId: orgId,
    niche: site.industry,
    language: site.language,
    country: site.country,
  });

  if (!host) {
    /**
     * Left pending rather than failed. The network grows, and a request that
     * cannot be matched today often can next week — refusing outright would
     * make the customer re-enter it.
     */
    revalidatePath(`/websites/${site.id}`);
    return { ok: true, data: { matched: false, hostDomain: null } };
  }

  await db.insert(placements).values({
    requestId: request.id,
    hostWebsiteId: host.websiteId,
    anchor: input.anchorHint?.trim() || null,
    credits: CREDITS_PER_LINK,
    status: "pending",
  });

  await db
    .update(backlinkRequests)
    .set({ status: "matched", updatedAt: new Date() })
    .where(eq(backlinkRequests.id, request.id));

  revalidatePath(`/websites/${site.id}`);
  return { ok: true, data: { matched: true, hostDomain: host.domain } };
}

/** Cancels a request that has not gone live, releasing the reserved credit. */
export async function cancelRequest(
  websiteId: string,
  requestId: string,
): Promise<ActionResult<null>> {
  const { site } = await requireWebsite(websiteId);

  const [request] = await db
    .select({ id: backlinkRequests.id, status: backlinkRequests.status })
    .from(backlinkRequests)
    .where(
      and(
        eq(backlinkRequests.id, requestId),
        eq(backlinkRequests.websiteId, site.id),
      ),
    )
    .limit(1);

  if (!request) return { ok: false, error: "Request not found" };
  if (request.status === "live") {
    return { ok: false, error: "That link is already live and cannot be cancelled" };
  }

  // Placement first: the request row is what holds the reservation, so
  // clearing it before the placement would briefly free a credit that is
  // still promised.
  await db.delete(placements).where(eq(placements.requestId, request.id));
  await db
    .update(backlinkRequests)
    .set({ status: "cancelled", creditsReserved: 0, updatedAt: new Date() })
    .where(eq(backlinkRequests.id, request.id));

  revalidatePath(`/websites/${site.id}`);
  return { ok: true, data: null };
}

export async function getLedger(websiteId: string): Promise<LedgerRow[]> {
  const { orgId } = await requireWebsite(websiteId);
  return listLedger(orgId);
}

export { recordCredit };
