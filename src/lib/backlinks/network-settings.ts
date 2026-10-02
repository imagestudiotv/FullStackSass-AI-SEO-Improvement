"use server";

import { and, asc, eq, inArray, isNull, notExists, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { siteScope } from "@/lib/articles/link-guard";
import { verifyUrl } from "@/lib/articles/link-verify";
import { DEFAULT_MONTHLY_CAP } from "@/lib/backlinks/network-defaults";
import { db } from "@/lib/db";
import { articles, backlinkRequests, backlinkTargets, domainMetrics, networkSites, placements } from "@/lib/db/schema";
import { AUTHORITY_METRIC } from "@/lib/authority/metric";
import { effectiveMinSourceRank, minRankCapFor } from "@/lib/backlinks/authority-cap";
import { isDataForSeoConfigured } from "@/lib/providers/dataforseo";
import { requireWebsite } from "@/lib/tenant";
import type { ActionResult } from "@/lib/websites/actions";
import { checkTargetUrl } from "@/lib/websites/ownership";
import { requireEditor } from "@/lib/websites/require-editor";

/**
 * The customer's side of the managed Partner Network: whether this website
 * takes part, and which of its pages it wants links to, in what priority.
 *
 * PREFERENCES ONLY. Nothing here matches partners, reserves credits or
 * places a link - the RepGet team does that (lib/admin/network.ts), reading
 * these preferences. Every action is scoped to one website through the
 * editor/tenant guards.
 */

const MAX_TARGETS = 20;
const PRIORITIES = ["high", "medium", "low"] as const;
export type TargetPriority = (typeof PRIORITIES)[number];

export type NetworkTarget = { id: string; url: string; note: string | null; priority: string; position: number };

export type PartnerNetwork = {
  participating: boolean;
  monthlyCap: number;
  targets: NetworkTarget[];
  /** Articles of this website still waiting for the RepGet team's review. */
  inReview: number;
  /** Links placed here or for this website that are not yet live. */
  commitments: number;
  /**
   * The owner's minimum DataForSEO Rank (0-100) for sites linking here, or
   * null for none. Enforced when the RepGet team places a link.
   */
  minSourceRank: number | null;
  /**
   * The highest minimum this website's plan allows: 60, or 100 on Scale
   * (lib/backlinks/authority-cap.ts). minSourceRank is already held to it.
   */
  maxMinSourceRank: number;
  /**
   * Whether the authority metric can be measured on this deployment
   * (DataForSEO configured and the account has the Backlinks API). When not,
   * the minimum cannot be set - an unmeasurable minimum would be a fake control.
   */
  authority: "available" | "not_configured" | "no_access";
};

export async function getPartnerNetwork(websiteId: string): Promise<PartnerNetwork> {
  const { site } = await requireWebsite(websiteId);
  const [row] = await db.select().from(networkSites).where(eq(networkSites.websiteId, site.id)).limit(1);
  const targets = await db
    .select({
      id: backlinkTargets.id,
      url: backlinkTargets.url,
      note: backlinkTargets.note,
      priority: backlinkTargets.priority,
      position: backlinkTargets.position,
    })
    .from(backlinkTargets)
    .where(eq(backlinkTargets.websiteId, site.id))
    .orderBy(asc(backlinkTargets.position), asc(backlinkTargets.createdAt));
  const [review] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(articles)
    .where(and(eq(articles.websiteId, site.id), eq(articles.reviewStatus, "pending"), isNull(articles.publishedUrl)));
  const [committed] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(placements)
    .innerJoin(backlinkRequests, eq(backlinkRequests.id, placements.requestId))
    .where(
      and(
        inArray(placements.status, ["drafted", "published"]),
        sql`(${placements.hostWebsiteId} = ${site.id} or ${backlinkRequests.websiteId} = ${site.id})`,
      ),
    );
  const maxMinSourceRank = await minRankCapFor(site.id);
  return {
    participating: Boolean(row?.acceptingLinks),
    monthlyCap: row?.monthlyCap ?? DEFAULT_MONTHLY_CAP,
    targets,
    inReview: review?.n ?? 0,
    commitments: committed?.n ?? 0,
    minSourceRank: effectiveMinSourceRank(row?.minSourceRank ?? null, maxMinSourceRank),
    maxMinSourceRank,
    authority: await authorityAvailability(),
  };
}

/**
 * Whether DataForSEO Rank can be measured here: credentials exist, and the
 * last collection did not report that the account lacks the Backlinks API.
 */
async function authorityAvailability(): Promise<PartnerNetwork["authority"]> {
  if (!isDataForSeoConfigured()) return "not_configured";
  const [denied] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(domainMetrics)
    .where(
      and(
        eq(domainMetrics.provider, AUTHORITY_METRIC.provider),
        eq(domainMetrics.metric, AUTHORITY_METRIC.metric),
        eq(domainMetrics.status, "no_access"),
        sql`${domainMetrics.attemptedAt} > timezone('utc', now()) - interval '7 days'`,
      ),
    );
  return (denied?.n ?? 0) > 0 ? "no_access" : "available";
}

/**
 * The minimum DataForSEO Rank (0-100, whole numbers) this website accepts
 * for sites linking to it; null clears it. Only when the metric is available.
 */
export async function setMinSourceRank(
  websiteId: string,
  value: number | null,
): Promise<ActionResult<{ minSourceRank: number | null }>> {
  const guard = await requireEditor(websiteId);
  if (!guard.ok) return { ok: false, error: guard.error };
  if (value !== null && (!Number.isInteger(value) || value < 0 || value > AUTHORITY_METRIC.scaleMax)) {
    return { ok: false, error: `Choose a whole number from 0 to ${AUTHORITY_METRIC.scaleMax}` };
  }
  if (value !== null && (await authorityAvailability()) !== "available") {
    return { ok: false, error: "Authority is not measured yet, so a minimum cannot be enforced" };
  }
  const { site } = guard.context;
  // The plan's ceiling, checked here too: the slider stops there, a direct call must as well.
  const cap = await minRankCapFor(site.id);
  if (value !== null && value > cap) {
    return { ok: false, error: `Your plan allows a minimum of up to ${cap}. Domain Authority above ${cap} comes with the Scale plan.` };
  }
  await db
    .insert(networkSites)
    .values({ websiteId: site.id, acceptingLinks: true, monthlyCap: DEFAULT_MONTHLY_CAP, minSourceRank: value })
    .onConflictDoUpdate({ target: networkSites.websiteId, set: { minSourceRank: value, updatedAt: new Date() } });
  revalidatePath(`/websites/${site.id}/backlinks`);
  return { ok: true, data: { minSourceRank: value } };
}

/**
 * Turns participation on or off.
 *
 * OFF stops new placements - the RepGet team can no longer place links in
 * this website's articles or to its pages - and releases its articles that
 * are waiting for review WITHOUT a committed link back to the ordinary
 * publishing rules. Links already placed stay: they are commitments to
 * another customer, and are still verified and credited as normal; an
 * article carrying one stays with the RepGet team until they approve or
 * withdraw it. Nothing is deleted.
 *
 * ON: articles written from now on are reviewed first. Existing drafts are
 * not pulled back into review.
 */
export async function setParticipation(
  websiteId: string,
  enabled: boolean,
): Promise<ActionResult<{ released: number; keptInReview: number }>> {
  const guard = await requireEditor(websiteId);
  if (!guard.ok) return { ok: false, error: guard.error };
  const { site } = guard.context;

  const result = await db.transaction(async (tx) => {
    await tx
      .insert(networkSites)
      .values({ websiteId: site.id, acceptingLinks: enabled, monthlyCap: DEFAULT_MONTHLY_CAP })
      .onConflictDoUpdate({ target: networkSites.websiteId, set: { acceptingLinks: enabled, updatedAt: new Date() } });
    if (enabled) return { released: 0, keptInReview: 0 };

    const released = await tx
      .update(articles)
      .set({
        reviewStatus: null,
        reviewApprovedAt: null,
        reviewApprovedBy: null,
        reviewApprovedHash: null,
        reviewVersion: sql`${articles.reviewVersion} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(articles.websiteId, site.id),
          eq(articles.reviewStatus, "pending"),
          isNull(articles.publishedUrl),
          notExists(
            tx
              .select({ id: placements.id })
              .from(placements)
              .where(and(eq(placements.articleId, articles.id), inArray(placements.status, ["drafted", "published", "live"]))),
          ),
        ),
      )
      .returning({ id: articles.id });
    const [kept] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(articles)
      .where(and(eq(articles.websiteId, site.id), eq(articles.reviewStatus, "pending"), isNull(articles.publishedUrl)));
    return { released: released.length, keptInReview: kept?.n ?? 0 };
  });

  revalidatePath(`/websites/${site.id}/backlinks`);
  return { ok: true, data: result };
}

/**
 * Adds a page this website wants links to: on its OWN site (by hostname, not
 * substring) and verified to exist right now, through the SSRF-safe layer.
 */
export async function addTarget(
  websiteId: string,
  input: { url: string; note?: string | null; priority?: string },
): Promise<ActionResult<NetworkTarget>> {
  const guard = await requireEditor(websiteId);
  if (!guard.ok) return { ok: false, error: guard.error };
  const { site } = guard.context;

  const typed = input.url.trim();
  const checked = checkTargetUrl(/^https?:\/\//i.test(typed) ? typed : `https://${typed}`, site.domain);
  if (!checked.ok) {
    return { ok: false, error: checked.reason === "foreign_host" ? `The page must be on ${site.domain}` : "Enter a valid page address" };
  }
  const priority = PRIORITIES.includes(input.priority as TargetPriority) ? (input.priority as TargetPriority) : "medium";

  const verdict = await verifyUrl(checked.url, siteScope(site));
  if (verdict.status !== "ok") {
    return {
      ok: false,
      error:
        verdict.status === "unavailable"
          ? "We could not reach that page just now. Check it opens in a browser and try again."
          : `That page could not be confirmed on your site: ${verdict.reason}.`,
    };
  }
  const url = verdict.finalUrl ?? checked.url;

  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`targets:${site.id}`}))`);
    const existing = await tx
      .select({ url: backlinkTargets.url, position: backlinkTargets.position })
      .from(backlinkTargets)
      .where(eq(backlinkTargets.websiteId, site.id));
    if (existing.some((row) => row.url === url)) return { ok: false as const, error: "That page is already in your list" };
    if (existing.length >= MAX_TARGETS) return { ok: false as const, error: `You can list up to ${MAX_TARGETS} pages` };
    const position = existing.reduce((max, row) => Math.max(max, row.position + 1), 0);
    const [row] = await tx
      .insert(backlinkTargets)
      .values({ websiteId: site.id, url, note: input.note?.trim().slice(0, 120) || null, priority, position })
      .returning({
        id: backlinkTargets.id,
        url: backlinkTargets.url,
        note: backlinkTargets.note,
        priority: backlinkTargets.priority,
        position: backlinkTargets.position,
      });
    revalidatePath(`/websites/${site.id}/backlinks`);
    return { ok: true as const, data: row };
  });
}

export async function removeTarget(websiteId: string, targetId: string): Promise<ActionResult<null>> {
  const guard = await requireEditor(websiteId);
  if (!guard.ok) return { ok: false, error: guard.error };
  const { site } = guard.context;
  const removed = await db
    .delete(backlinkTargets)
    .where(and(eq(backlinkTargets.id, targetId), eq(backlinkTargets.websiteId, site.id)))
    .returning({ id: backlinkTargets.id });
  if (removed.length === 0) return { ok: false, error: "Target not found" };
  revalidatePath(`/websites/${site.id}/backlinks`);
  return { ok: true, data: null };
}

export async function setTargetPriority(websiteId: string, targetId: string, priority: string): Promise<ActionResult<null>> {
  const guard = await requireEditor(websiteId);
  if (!guard.ok) return { ok: false, error: guard.error };
  const { site } = guard.context;
  if (!PRIORITIES.includes(priority as TargetPriority)) return { ok: false, error: "Unknown priority" };
  const updated = await db
    .update(backlinkTargets)
    .set({ priority, updatedAt: new Date() })
    .where(and(eq(backlinkTargets.id, targetId), eq(backlinkTargets.websiteId, site.id)))
    .returning({ id: backlinkTargets.id });
  if (updated.length === 0) return { ok: false, error: "Target not found" };
  revalidatePath(`/websites/${site.id}/backlinks`);
  return { ok: true, data: null };
}

/** Moves a target one place up or down the list (keyboard-friendly reordering). */
export async function moveTarget(websiteId: string, targetId: string, direction: "up" | "down"): Promise<ActionResult<null>> {
  const guard = await requireEditor(websiteId);
  if (!guard.ok) return { ok: false, error: guard.error };
  const { site } = guard.context;
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`targets:${site.id}`}))`);
    const rows = await tx
      .select({ id: backlinkTargets.id })
      .from(backlinkTargets)
      .where(eq(backlinkTargets.websiteId, site.id))
      .orderBy(asc(backlinkTargets.position), asc(backlinkTargets.createdAt));
    const index = rows.findIndex((row) => row.id === targetId);
    if (index === -1) return { ok: false as const, error: "Target not found" };
    const swap = direction === "up" ? index - 1 : index + 1;
    if (swap < 0 || swap >= rows.length) return { ok: true as const, data: null };
    [rows[index], rows[swap]] = [rows[swap], rows[index]];
    // Positions rewritten 0..n-1: the list is always a clean order.
    for (const [position, row] of rows.entries()) {
      await tx.update(backlinkTargets).set({ position, updatedAt: new Date() }).where(eq(backlinkTargets.id, row.id));
    }
    revalidatePath(`/websites/${site.id}/backlinks`);
    return { ok: true as const, data: null };
  });
}
