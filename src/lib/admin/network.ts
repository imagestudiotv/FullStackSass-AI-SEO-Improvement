"use server";

import { and, asc, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/admin/guard";
import { linksTo, siteScope, type LinkVerdict } from "@/lib/articles/link-guard";
import { verifyUrl } from "@/lib/articles/link-verify";
import { releaseAfterApproval, type ReleaseOutcome } from "@/lib/articles/release";
import { reviewHash } from "@/lib/articles/review";
import {
  approveArticle,
  creditsFor,
  DEFAULT_PLACEMENT_CREDITS,
  editReviewedArticle,
  managedPlacementsFor,
  MAX_PER_ARTICLE,
  MAX_PLACEMENT_CREDITS,
  placeManagedLink,
  PlacementError,
  removeManagedPlacement,
  reopenArticle,
  type ReviewEdit,
  setPlacementCredits,
} from "@/lib/backlinks/managed";
import { ensureMonthlyCredits } from "@/lib/backlinks/credits";
import { isRelevantPair } from "@/lib/backlinks/matching";
import { readOneAuthority } from "@/lib/authority/metric";
import { db } from "@/lib/db";
import {
  articles,
  backlinkRequests,
  backlinkTargets,
  calendarItems,
  integrationKeys,
  integrations,
  networkSites,
  organization,
  placements,
  websites,
} from "@/lib/db/schema";
import { isPublishingConnection } from "@/lib/publishing/kinds";
import { checkTargetUrl } from "@/lib/websites/ownership";
import type { ActionResult } from "@/lib/websites/actions";

/**
 * The RepGet team's side of the managed Partner Network: the review queue,
 * placing links in drafts, and approving articles for delivery.
 *
 * Every action checks admin access on the server (requireAdmin - a verified,
 * allowlisted address) and records the acting administrator. The work itself
 * is in lib/backlinks/managed.ts, which keeps money moving only through the
 * existing request/placement lifecycle and credit ledger.
 */

export type QueueSite = {
  websiteId: string;
  domain: string;
  organizationId: string;
  organizationName: string;
  industry: string | null;
  language: string | null;
  connected: "cms" | "plugin" | "none";
  targets: { url: string; priority: string }[];
  /** Network links this website has hosted - no cap applies, this is for pacing by hand. */
  hosted: HostUsage;
};

/** Links placed in a website's articles, today and this calendar month (UTC). */
export type HostUsage = { today: number; thisMonth: number };

/** A placement that is, or is on its way to being, a link on the host's page. */
const ACTIVE_PLACEMENT = ["pending", "drafted", "published", "live"] as const;

/**
 * What counts as hosted: the active ones, and "unverified" - published but
 * not yet seen by the checker, which may still be on the page and is revived
 * when a recheck finds it (lib/reporting/recheck.ts).
 */
const HOSTED_PLACEMENT = [...ACTIVE_PLACEMENT, "unverified"] as const;

/**
 * How many network links each website has hosted today and this month.
 *
 * There is no cap on this any more (lib/backlinks/managed.ts); the numbers
 * are shown so administrators pace link building by hand. Placements are
 * counted on the day they were placed, including published ones the checker
 * has not seen yet ("unverified"); withdrawn ("cancelled") and removed links
 * are not. The day and month boundaries come from the database's own clock,
 * the one that stamped created_at, so the two always agree (UTC in
 * production).
 */
async function hostedCounts(websiteIds: string[]): Promise<Map<string, HostUsage>> {
  const out = new Map<string, HostUsage>(websiteIds.map((id) => [id, { today: 0, thisMonth: 0 }]));
  if (websiteIds.length === 0) return out;
  const rows = await db
    .select({
      websiteId: placements.hostWebsiteId,
      today: sql<number>`count(*) filter (where ${placements.createdAt} >= date_trunc('day', localtimestamp))::int`,
      thisMonth: sql<number>`count(*)::int`,
    })
    .from(placements)
    .where(
      and(
        inArray(placements.hostWebsiteId, websiteIds),
        inArray(placements.status, [...HOSTED_PLACEMENT]),
        sql`${placements.createdAt} >= date_trunc('month', localtimestamp)`,
      ),
    )
    .groupBy(placements.hostWebsiteId);
  for (const row of rows) {
    if (row.websiteId) out.set(row.websiteId, { today: Number(row.today), thisMonth: Number(row.thisMonth) });
  }
  return out;
}

export type QueueArticle = {
  id: string;
  title: string;
  websiteId: string;
  domain: string;
  organizationName: string;
  language: string | null;
  plannedFor: Date | null;
  reviewStatus: string;
  /** Approved AND still exactly what was approved. */
  approvedCurrent: boolean;
  placements: number;
  connected: "cms" | "plugin" | "none";
};

export type OrgCredits = {
  organizationId: string;
  organizationName: string;
  balance: number;
  reserved: number;
  available: number;
};

async function connectionOf(websiteIds: string[]): Promise<Map<string, "cms" | "plugin" | "none">> {
  const out = new Map<string, "cms" | "plugin" | "none">(websiteIds.map((id) => [id, "none"]));
  if (websiteIds.length === 0) return out;
  const plugin = await db
    .select({ websiteId: integrationKeys.websiteId })
    .from(integrationKeys)
    .where(and(inArray(integrationKeys.websiteId, websiteIds), isNull(integrationKeys.revokedAt), sql`${integrationKeys.lastUsedAt} is not null`));
  for (const row of plugin) out.set(row.websiteId, "plugin");
  const cms = await db
    .select({ websiteId: integrations.websiteId })
    .from(integrations)
    .where(and(inArray(integrations.websiteId, websiteIds), isPublishingConnection()));
  for (const row of cms) out.set(row.websiteId, "cms");
  return out;
}

/** The review queue: participating websites, articles awaiting review, and credits per workspace. */
export async function getReviewQueue(): Promise<{
  sites: QueueSite[];
  articles: QueueArticle[];
  credits: OrgCredits[];
  limits: { maxPerArticle: number; defaultCredits: number; maxCredits: number };
}> {
  await requireAdmin();

  const siteRows = await db
    .select({
      websiteId: websites.id,
      domain: websites.domain,
      organizationId: websites.organizationId,
      organizationName: organization.name,
      industry: websites.industry,
      language: websites.language,
    })
    .from(networkSites)
    .innerJoin(websites, eq(websites.id, networkSites.websiteId))
    .innerJoin(organization, eq(organization.id, websites.organizationId))
    .where(eq(networkSites.acceptingLinks, true))
    .orderBy(asc(websites.domain));

  const articleRows = await db
    .select({
      id: articles.id,
      title: articles.title,
      websiteId: articles.websiteId,
      domain: websites.domain,
      organizationName: organization.name,
      language: websites.language,
      plannedFor: calendarItems.scheduledFor,
      reviewStatus: articles.reviewStatus,
      reviewApprovedHash: articles.reviewApprovedHash,
      slug: articles.slug,
      metaDescription: articles.metaDescription,
      bodyHtml: articles.bodyHtml,
      imageUrl: articles.imageUrl,
      imageAlt: articles.imageAlt,
      // The same statuses the per-article maximum counts (lib/backlinks/managed.ts).
      placements: sql<number>`(
        select count(*)::int from ${placements} p
        where p.article_id = ${articles.id} and p.status in ('pending', 'drafted', 'published', 'live')
      )`,
    })
    .from(articles)
    .innerJoin(websites, eq(websites.id, articles.websiteId))
    .innerJoin(organization, eq(organization.id, websites.organizationId))
    .leftJoin(calendarItems, eq(calendarItems.id, articles.calendarItemId))
    .where(
      and(
        inArray(articles.reviewStatus, ["pending", "approved"]),
        eq(articles.status, "draft"),
        isNull(articles.publishedUrl),
      ),
    )
    .orderBy(asc(calendarItems.scheduledFor), asc(articles.createdAt))
    .limit(200);

  const ids = [...new Set([...siteRows.map((s) => s.websiteId), ...articleRows.map((a) => a.websiteId)])];
  const connection = await connectionOf(ids);
  const hosted = await hostedCounts(siteRows.map((s) => s.websiteId));
  const targets = ids.length
    ? await db
        .select({ websiteId: backlinkTargets.websiteId, url: backlinkTargets.url, priority: backlinkTargets.priority })
        .from(backlinkTargets)
        .where(inArray(backlinkTargets.websiteId, ids))
        .orderBy(asc(backlinkTargets.position))
    : [];

  // Credits are per WORKSPACE: shown once per workspace, never per website.
  const orgs = new Map<string, string>();
  for (const row of siteRows) orgs.set(row.organizationId, row.organizationName);
  const credits: OrgCredits[] = [];
  for (const [organizationId, organizationName] of orgs) {
    await ensureMonthlyCredits(organizationId);
    credits.push({ organizationId, organizationName, ...(await creditsFor(db, organizationId)) });
  }

  return {
    sites: siteRows.map((site) => ({
      ...site,
      connected: connection.get(site.websiteId) ?? "none",
      targets: targets.filter((t) => t.websiteId === site.websiteId).map(({ url, priority }) => ({ url, priority })),
      hosted: hosted.get(site.websiteId) ?? { today: 0, thisMonth: 0 },
    })),
    articles: articleRows.map((row) => ({
      id: row.id,
      title: row.title,
      websiteId: row.websiteId,
      domain: row.domain,
      organizationName: row.organizationName,
      language: row.language,
      plannedFor: row.plannedFor,
      reviewStatus: row.reviewStatus ?? "pending",
      approvedCurrent: row.reviewStatus === "approved" && row.reviewApprovedHash === reviewHash(row),
      placements: row.placements,
      connected: connection.get(row.websiteId) ?? "none",
    })),
    credits,
    limits: { maxPerArticle: MAX_PER_ARTICLE, defaultCredits: DEFAULT_PLACEMENT_CREDITS, maxCredits: MAX_PLACEMENT_CREDITS },
  };
}

export type Candidate = {
  websiteId: string;
  domain: string;
  organizationId: string;
  organizationName: string;
  language: string | null;
  industry: string | null;
  relevant: boolean;
  reciprocal: boolean;
  available: number;
  reserved: number;
  targets: { url: string; note: string | null; priority: string }[];
  /** The beneficiary's minimum DataForSEO Rank for linking sites, or null. */
  minSourceRank: number | null;
  /** Whether THIS article's website meets it (null: no minimum). */
  meetsMinimum: boolean | null;
  /** Already linked in this article - one link per website per article. */
  linkedHere: boolean;
};

/** Everything the review workspace for one article needs. */
export async function getReviewArticle(articleId: string) {
  await requireAdmin();
  const [article] = await db
    .select({
      id: articles.id,
      title: articles.title,
      bodyHtml: articles.bodyHtml,
      status: articles.status,
      publishedUrl: articles.publishedUrl,
      reviewStatus: articles.reviewStatus,
      reviewVersion: articles.reviewVersion,
      reviewApprovedAt: articles.reviewApprovedAt,
      reviewApprovedBy: articles.reviewApprovedBy,
      reviewApprovedHash: articles.reviewApprovedHash,
      slug: articles.slug,
      metaDescription: articles.metaDescription,
      imageUrl: articles.imageUrl,
      imageAlt: articles.imageAlt,
      plannedFor: calendarItems.scheduledFor,
      websiteId: websites.id,
      domain: websites.domain,
      organizationId: websites.organizationId,
      organizationName: organization.name,
      industry: websites.industry,
      language: websites.language,
      autoPublish: websites.autoPublish,
      publishAs: websites.publishAs,
    })
    .from(articles)
    .innerJoin(websites, eq(websites.id, articles.websiteId))
    .innerJoin(organization, eq(organization.id, websites.organizationId))
    .leftJoin(calendarItems, eq(calendarItems.id, articles.calendarItemId))
    .where(eq(articles.id, articleId))
    .limit(1);
  if (!article) return null;

  const placed = await managedPlacementsFor(article.id);

  const [hostNetwork] = await db
    .select({ niche: networkSites.niche })
    .from(networkSites)
    .where(eq(networkSites.websiteId, article.websiteId))
    .limit(1);

  const others = await db
    .select({
      websiteId: websites.id,
      domain: websites.domain,
      organizationId: websites.organizationId,
      organizationName: organization.name,
      language: websites.language,
      industry: websites.industry,
      niche: networkSites.niche,
      minSourceRank: networkSites.minSourceRank,
    })
    .from(networkSites)
    .innerJoin(websites, eq(websites.id, networkSites.websiteId))
    .innerJoin(organization, eq(organization.id, websites.organizationId))
    .where(
      and(
        eq(networkSites.acceptingLinks, true),
        ne(websites.id, article.websiteId),
        ne(websites.organizationId, article.organizationId),
      ),
    )
    .orderBy(asc(websites.domain));

  const ids = others.map((o) => o.websiteId);
  const targetRows = ids.length
    ? await db
        .select({
          websiteId: backlinkTargets.websiteId,
          url: backlinkTargets.url,
          note: backlinkTargets.note,
          priority: backlinkTargets.priority,
        })
        .from(backlinkTargets)
        .where(inArray(backlinkTargets.websiteId, ids))
        .orderBy(asc(backlinkTargets.position))
    : [];
  const reciprocalRows = ids.length
    ? await db
        .select({ websiteId: placements.hostWebsiteId })
        .from(placements)
        .innerJoin(backlinkRequests, eq(backlinkRequests.id, placements.requestId))
        .where(and(inArray(placements.hostWebsiteId, ids), eq(backlinkRequests.websiteId, article.websiteId)))
    : [];
  const reciprocal = new Set(reciprocalRows.map((r) => r.websiteId));
  const linkedHere = new Set(
    placed.filter((p) => (ACTIVE_PLACEMENT as readonly string[]).includes(p.status)).map((p) => p.beneficiaryWebsiteId),
  );
  // How many links this article's website has hosted - for pacing; no cap applies.
  const hostUsage = (await hostedCounts([article.websiteId])).get(article.websiteId) ?? { today: 0, thisMonth: 0 };

  // The host's authority, on the metric the beneficiaries' minimums use.
  const hostAuthority = await readOneAuthority(article.domain);
  const hostRank = hostAuthority?.status === "ok" ? hostAuthority.value : null;
  const creditCache = new Map<string, Awaited<ReturnType<typeof creditsFor>>>();
  const candidates: Candidate[] = [];
  for (const other of others) {
    if (!creditCache.has(other.organizationId)) {
      await ensureMonthlyCredits(other.organizationId);
      creditCache.set(other.organizationId, await creditsFor(db, other.organizationId));
    }
    const credits = creditCache.get(other.organizationId)!;
    candidates.push({
      websiteId: other.websiteId,
      domain: other.domain,
      organizationId: other.organizationId,
      organizationName: other.organizationName,
      language: other.language,
      industry: other.industry,
      relevant: isRelevantPair(other.niche ?? other.industry, hostNetwork?.niche ?? article.industry),
      reciprocal: reciprocal.has(other.websiteId),
      available: credits.available,
      reserved: credits.reserved,
      targets: targetRows.filter((t) => t.websiteId === other.websiteId).map(({ url, note, priority }) => ({ url, note, priority })),
      minSourceRank: other.minSourceRank,
      meetsMinimum: other.minSourceRank === null ? null : hostRank !== null && hostRank >= other.minSourceRank,
      linkedHere: linkedHere.has(other.websiteId),
    });
  }

  const contentHash = reviewHash(article);
  return {
    article: {
      ...article,
      approvedCurrent: article.reviewStatus === "approved" && article.reviewApprovedHash === contentHash,
      /** What this screen shows; an edit is refused if the article no longer matches it. */
      contentHash,
    },
    // inText: the link is in the article (a customer's edit can remove one; approval then refuses).
    placements: placed.map((p) => ({ ...p, inText: article.bodyHtml ? linksTo(article.bodyHtml, p.targetUrl) : false })),
    candidates,
    hostAuthority,
    hostUsage,
    limits: { maxPerArticle: MAX_PER_ARTICLE, defaultCredits: DEFAULT_PLACEMENT_CREDITS, maxCredits: MAX_PLACEMENT_CREDITS },
  };
}

function fail(error: unknown): { ok: false; error: string } {
  if (error instanceof PlacementError) return { ok: false, error: error.message };
  throw error;
}

function refresh(articleId: string) {
  revalidatePath("/admin/network");
  revalidatePath(`/admin/network/${articleId}`);
}

/** Checks a page on the beneficiary's site right now, over the SSRF-safe layer. */
async function verifiedTarget(beneficiaryWebsiteId: string, url: string): Promise<{ ok: true; url: string; verdict: LinkVerdict } | { ok: false; error: string }> {
  const [site] = await db
    .select({ url: websites.url, domain: websites.domain })
    .from(websites)
    .where(eq(websites.id, beneficiaryWebsiteId))
    .limit(1);
  if (!site) return { ok: false, error: "Website not found" };
  const typed = url.trim();
  const checked = checkTargetUrl(/^https?:\/\//i.test(typed) ? typed : `https://${typed}`, site.domain);
  if (!checked.ok) return { ok: false, error: `The page must be a valid address on ${site.domain}` };
  const verdict = await verifyUrl(checked.url, siteScope(site));
  if (verdict.status !== "ok") {
    return { ok: false, error: `That page could not be confirmed: ${verdict.reason}` };
  }
  return { ok: true, url: verdict.finalUrl ?? checked.url, verdict };
}

/** Lets the administrator check a target before committing to it. */
export async function checkTarget(beneficiaryWebsiteId: string, url: string): Promise<ActionResult<{ url: string; title: string | null }>> {
  await requireAdmin();
  const result = await verifiedTarget(beneficiaryWebsiteId, url);
  return result.ok ? { ok: true, data: { url: result.url, title: result.verdict.title } } : result;
}

export async function placeLink(input: {
  articleId: string;
  expectedVersion: number;
  beneficiaryWebsiteId: string;
  targetUrl: string;
  anchor: string;
  credits: number;
  reason: string;
}): Promise<ActionResult<{ reviewVersion: number }>> {
  const admin = await requireAdmin();
  // Verified again at the moment of placing: never a URL taken on trust.
  const target = await verifiedTarget(input.beneficiaryWebsiteId, input.targetUrl);
  if (!target.ok) return target;
  try {
    const placed = await placeManagedLink({ ...input, targetUrl: target.url, actorEmail: admin.email });
    refresh(input.articleId);
    return { ok: true, data: { reviewVersion: placed.reviewVersion } };
  } catch (error) {
    return fail(error);
  }
}

export async function removePlacement(input: {
  articleId: string;
  placementId: string;
  expectedVersion: number;
  reason: string;
}): Promise<ActionResult<{ reviewVersion: number }>> {
  const admin = await requireAdmin();
  try {
    const result = await removeManagedPlacement({ ...input, actorEmail: admin.email });
    refresh(input.articleId);
    return { ok: true, data: result };
  } catch (error) {
    return fail(error);
  }
}

export async function changePlacementCredits(input: {
  articleId: string;
  placementId: string;
  expectedVersion: number;
  credits: number;
  reason: string;
}): Promise<ActionResult<{ reviewVersion: number }>> {
  const admin = await requireAdmin();
  try {
    const result = await setPlacementCredits({ ...input, actorEmail: admin.email });
    refresh(input.articleId);
    return { ok: true, data: result };
  } catch (error) {
    return fail(error);
  }
}

/** An administrator's edit of the article's title, slug, excerpt and text while it is in review. */
export async function saveReviewEdit(input: Omit<ReviewEdit, "actorEmail">): Promise<ActionResult<{ reviewVersion: number; changed: boolean }>> {
  const admin = await requireAdmin();
  try {
    const result = await editReviewedArticle({ ...input, actorEmail: admin.email });
    refresh(input.articleId);
    return { ok: true, data: result };
  } catch (error) {
    return fail(error);
  }
}

export async function approveForRelease(input: {
  articleId: string;
  expectedVersion: number;
  /** The review page's contentHash: approval covers exactly the text shown. */
  expectedHash: string;
  note: string;
}): Promise<ActionResult<{ placements: number; release: ReleaseOutcome }>> {
  const admin = await requireAdmin();
  let approved;
  try {
    approved = await approveArticle({ ...input, actorEmail: admin.email });
  } catch (error) {
    return fail(error);
  }
  // After the commit: delivery follows the customer's mode and planned day.
  const release = await releaseAfterApproval(input.articleId);
  refresh(input.articleId);
  return { ok: true, data: { placements: approved.placements, release } };
}

export async function reopenForReview(input: { articleId: string; expectedVersion: number }): Promise<ActionResult<null>> {
  const admin = await requireAdmin();
  try {
    await reopenArticle({ ...input, actorEmail: admin.email });
    refresh(input.articleId);
    return { ok: true, data: null };
  } catch (error) {
    return fail(error);
  }
}

/** Recent network placements across the platform, newest first, for the queue page. */
export async function recentPlacements() {
  await requireAdmin();
  return db
    .select({
      id: placements.id,
      status: placements.status,
      credits: placements.credits,
      managed: placements.managed,
      createdBy: placements.createdBy,
      createdAt: placements.createdAt,
      targetUrl: backlinkRequests.targetUrl,
      articleId: placements.articleId,
    })
    .from(placements)
    .innerJoin(backlinkRequests, eq(backlinkRequests.id, placements.requestId))
    .where(eq(placements.managed, true))
    .orderBy(desc(placements.createdAt))
    .limit(50);
}
