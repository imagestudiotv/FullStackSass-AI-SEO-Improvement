import "server-only";

import { and, eq, inArray, ne, sql } from "drizzle-orm";

import { recordAdminAction } from "@/lib/admin/audit";
import { countWords, normaliseSlug } from "@/lib/articles/generate";
import { linkPhrase, linksTo, linkTextFor, siteScope, unlinkUrl } from "@/lib/articles/link-guard";
import { reviewHash } from "@/lib/articles/review";
import { sanitizeHtml } from "@/lib/articles/sanitize";
import { readOneAuthority } from "@/lib/authority/metric";
import { ArticleInFlightError, lockForEdit } from "@/lib/publishing/dispatch";
import { ensureMonthlyCredits } from "@/lib/backlinks/credits";
import { isRelevantPair } from "@/lib/backlinks/matching";
import { db } from "@/lib/db";
import {
  articles,
  articleVersions,
  backlinkRequests,
  creditLedger,
  networkSites,
  placements,
  websites,
} from "@/lib/db/schema";
import type { Executor } from "@/lib/db/types";

/**
 * The managed Partner Network: links placed by the RepGet team.
 *
 * The client's launch decision: administrators choose every placement - the
 * host article, the website that benefits, the page it links to, the words
 * that carry it and its credit amount. Customers state preferences
 * (backlink_targets); they do not pick partners or approve links.
 *
 * NOTHING NEW ABOUT MONEY. A managed placement is an ordinary backlink
 * request plus placement (lib/backlinks/placements.ts) with `managed` set:
 *
 *   committed  here: request "matched" holding `credits` in reservation,
 *              placement "drafted", the link written into the draft. The
 *              reservation is taken under a per-workspace lock inside the
 *              same transaction, so two administrators (or an admin and a
 *              customer) cannot promise the same available credits twice.
 *   published  the host article goes live (recordArticlePublication): the
 *              real URL is recorded. Still nothing charged - a CMS draft,
 *              an approval or a save moves no credits either.
 *   live       the verifier SEES the link on the public page (applyCheck):
 *              the requester is charged and the host rewarded, exactly
 *              once (idempotency keys), in one transaction.
 *   removed /  as before: refunds and reversals, and a timeout is never
 *   unverified proof that a link is gone.
 *
 * Who pays: the workspace that owns the BENEFICIARY website spends; the
 * workspace that owns the HOST website earns the same amount. Credits
 * belong to workspaces, not websites - two websites of one workspace share
 * one balance, and it is checked once.
 *
 * Kept protections: no link to the host itself or another website of the
 * same workspace, no immediate reciprocal link (a pair that has linked one
 * way never links back), the shared relevance rule (lib/backlinks/matching.ts),
 * language match, one link per beneficiary per article, and at most
 * MAX_PER_ARTICLE placements in any article. Reciprocal links "later" was
 * discussed but never defined, so it stays refused.
 *
 * NO LIMIT ON HOW MANY LINKS A WEBSITE HOSTS. Every managed link is placed
 * by an administrator, one at a time, so the client decided (2026-09-28)
 * that no per-host cap applies: the old "3 links a month" (network_sites.
 * monthly_cap) refused the 4th link a host received in a calendar month,
 * which blocked the daily link building the network is for. The review
 * screens show how many links each website has hosted today and this month
 * instead (lib/admin/network.ts), so the pace stays a visible human
 * decision. monthly_cap is still stored; since 2026-09-28 only the old
 * automatic exchange reads it, and that is switched off (MANAGED_NETWORK).
 */

/** The existing price of one link (lib/backlinks/actions.ts). The default. */
export const DEFAULT_PLACEMENT_CREDITS = 1;
/** An administrator may set more for one placement, never more than this. */
export const MAX_PLACEMENT_CREDITS = 10;
/**
 * Network links in one article, at most - a ceiling, not a target: an
 * article may carry none. The client's figure (2026-09-28): "approx 15 max,
 * sometimes just one or zero", with mentions from authority sites placed by
 * hand. Each still needs its own receiving website (one link per website
 * per article).
 */
export const MAX_PER_ARTICLE = 15;

export class PlacementError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlacementError";
  }
}

/** Serialises credit reservations for one workspace. */
async function lockWorkspaceCredits(tx: Executor, organizationId: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`credits:${organizationId}`}))`);
}

/** Balance, held reservations and what is left, read inside `tx`. */
export async function creditsFor(tx: Executor, organizationId: string) {
  const [balance] = await tx
    .select({ total: sql<number>`coalesce(sum(${creditLedger.amount}), 0)::int` })
    .from(creditLedger)
    .where(eq(creditLedger.organizationId, organizationId));
  const [reserved] = await tx
    .select({ total: sql<number>`coalesce(sum(${backlinkRequests.creditsReserved}), 0)::int` })
    .from(backlinkRequests)
    .innerJoin(websites, eq(websites.id, backlinkRequests.websiteId))
    .where(and(eq(websites.organizationId, organizationId), inArray(backlinkRequests.status, ["pending", "matched"])));
  const b = balance?.total ?? 0;
  const r = reserved?.total ?? 0;
  return { balance: b, reserved: r, available: Math.max(b - r, 0) };
}

function validCredits(credits: number): number {
  if (!Number.isInteger(credits) || credits < 1 || credits > MAX_PLACEMENT_CREDITS) {
    throw new PlacementError(`Credits must be a whole number from 1 to ${MAX_PLACEMENT_CREDITS}`);
  }
  return credits;
}

/**
 * The article's row lock, refusing while a revision of it is being sent
 * (lib/publishing/dispatch.ts): a review or placement change must not race
 * a delivery it could no longer stop.
 */
async function lockNotInFlight(tx: Executor, articleId: string) {
  try {
    await lockForEdit(tx, articleId);
  } catch (error) {
    if (error instanceof ArticleInFlightError) throw new PlacementError(IN_FLIGHT_MESSAGE);
    throw error;
  }
}

export const IN_FLIGHT_MESSAGE =
  "This article is being delivered to the website right now and can no longer be recalled. Wait for delivery to finish, then change it - the change will need approving again.";

/** The host article, locked, checked against the version the admin saw. */
async function lockArticle(tx: Executor, articleId: string, expectedVersion: number) {
  await lockNotInFlight(tx, articleId);
  const [article] = await tx
    .select({
      id: articles.id,
      websiteId: articles.websiteId,
      status: articles.status,
      publishedUrl: articles.publishedUrl,
      title: articles.title,
      slug: articles.slug,
      metaDescription: articles.metaDescription,
      bodyHtml: articles.bodyHtml,
      imageUrl: articles.imageUrl,
      imageAlt: articles.imageAlt,
      reviewStatus: articles.reviewStatus,
      reviewVersion: articles.reviewVersion,
    })
    .from(articles)
    .where(eq(articles.id, articleId))
    .for("update");
  if (!article) throw new PlacementError("Article not found");
  if (article.reviewVersion !== expectedVersion) {
    throw new PlacementError("Someone else changed this article's review just now. Reload it and try again.");
  }
  if (article.status !== "draft" || article.publishedUrl) {
    throw new PlacementError("Links are placed only in articles that are not published yet");
  }
  if (!article.reviewStatus) {
    throw new PlacementError("This article is not in the Partner Network review");
  }
  if (!article.bodyHtml) throw new PlacementError("This article has not been written yet");
  return article as typeof article & { bodyHtml: string };
}

/** Back to pending with a new version: any placement change needs approving. */
function reviewReset() {
  return {
    reviewStatus: "pending",
    reviewApprovedAt: null,
    reviewApprovedBy: null,
    reviewApprovedHash: null,
    reviewVersion: sql`${articles.reviewVersion} + 1`,
    updatedAt: new Date(),
  };
}

export type PlaceInput = {
  articleId: string;
  /** The article's review version the administrator is looking at. */
  expectedVersion: number;
  beneficiaryWebsiteId: string;
  /** A page on the beneficiary's site, ALREADY verified (see network actions). */
  targetUrl: string;
  /** Words already in the article that will carry the link. */
  anchor: string;
  credits?: number;
  reason?: string | null;
  actorEmail: string;
};

/**
 * Commits one placement: the reservation, the placement, the link in the
 * draft and the audit row, in ONE transaction - all of it or none of it.
 */
export async function placeManagedLink(input: PlaceInput): Promise<{ placementId: string; reviewVersion: number }> {
  const credits = validCredits(input.credits ?? DEFAULT_PLACEMENT_CREDITS);
  const anchor = input.anchor.trim();
  if (anchor.length < 2 || anchor.length > 120) throw new PlacementError("Choose anchor words from the article (2-120 characters)");

  // The beneficiary's monthly plan credits, granted before they are checked (outside the transaction).
  const [owner] = await db
    .select({ organizationId: websites.organizationId })
    .from(websites)
    .where(eq(websites.id, input.beneficiaryWebsiteId))
    .limit(1);
  if (owner) await ensureMonthlyCredits(owner.organizationId);

  return db.transaction(async (tx) => {
    const article = await lockArticle(tx, input.articleId, input.expectedVersion);

    const sites = await tx
      .select({
        id: websites.id,
        organizationId: websites.organizationId,
        url: websites.url,
        domain: websites.domain,
        industry: websites.industry,
        language: websites.language,
        niche: networkSites.niche,
        networkLanguage: networkSites.language,
        accepting: networkSites.acceptingLinks,
        minSourceRank: networkSites.minSourceRank,
      })
      .from(websites)
      .leftJoin(networkSites, eq(networkSites.websiteId, websites.id))
      .where(inArray(websites.id, [article.websiteId, input.beneficiaryWebsiteId]));
    const host = sites.find((site) => site.id === article.websiteId);
    const beneficiary = sites.find((site) => site.id === input.beneficiaryWebsiteId);
    if (!host || !beneficiary) throw new PlacementError("Website not found");
    if (host.id === beneficiary.id) throw new PlacementError("A website cannot link to itself");
    if (host.organizationId === beneficiary.organizationId) {
      throw new PlacementError("Both websites belong to the same workspace - that is not an independent link");
    }
    if (!host.accepting) throw new PlacementError("The host website is not taking part in the Partner Network");
    if (!beneficiary.accepting) throw new PlacementError("That website is not taking part in the Partner Network");

    /*
      The beneficiary's minimum authority, on the metric everyone sees
      (DataForSEO Rank, lib/authority/metric.ts). A host whose rank is not
      known cannot be shown to meet a minimum, so it is refused too.
    */
    if (beneficiary.minSourceRank !== null) {
      const hostRank = await readOneAuthority(host.domain);
      if (hostRank?.status !== "ok" || hostRank.value === null) {
        throw new PlacementError(
          `${beneficiary.domain} accepts links only from sites with Domain Authority ${beneficiary.minSourceRank} or above, and ${host.domain} has no Domain Authority yet`,
        );
      }
      if (hostRank.value < beneficiary.minSourceRank) {
        throw new PlacementError(
          `${beneficiary.domain} accepts links only from sites with Domain Authority ${beneficiary.minSourceRank} or above; ${host.domain} is at ${hostRank.value}`,
        );
      }
    }

    // The target must be on the beneficiary's own site (the verification
    // itself happened before this transaction, over the network).
    const scope = siteScope(beneficiary);
    let target: URL;
    try {
      target = new URL(input.targetUrl);
    } catch {
      throw new PlacementError("That is not a valid page address");
    }
    if (!scope.hosts.has(target.hostname.toLowerCase())) {
      throw new PlacementError(`The page must be on ${beneficiary.domain}`);
    }

    const hostLanguage = host.networkLanguage ?? host.language;
    const beneficiaryLanguage = beneficiary.networkLanguage ?? beneficiary.language;
    if (hostLanguage && beneficiaryLanguage && hostLanguage.toLowerCase() !== beneficiaryLanguage.toLowerCase()) {
      throw new PlacementError("The two websites are in different languages");
    }
    if (!isRelevantPair(beneficiary.niche ?? beneficiary.industry, host.niche ?? host.industry)) {
      throw new PlacementError("The two websites are not in related fields");
    }

    // No immediate reciprocal link: has the beneficiary ever hosted the host?
    const [reciprocal] = await tx
      .select({ id: placements.id })
      .from(placements)
      .innerJoin(backlinkRequests, eq(backlinkRequests.id, placements.requestId))
      .where(and(eq(placements.hostWebsiteId, beneficiary.id), eq(backlinkRequests.websiteId, host.id)))
      .limit(1);
    if (reciprocal) throw new PlacementError("These two websites already link the other way - no reciprocal links");

    // No per-host cap: see "NO LIMIT ON HOW MANY LINKS A WEBSITE HOSTS" above.
    const inArticle = await tx
      .select({ id: placements.id, beneficiary: backlinkRequests.websiteId, targetUrl: backlinkRequests.targetUrl })
      .from(placements)
      .innerJoin(backlinkRequests, eq(backlinkRequests.id, placements.requestId))
      .where(and(eq(placements.articleId, article.id), inArray(placements.status, ["pending", "drafted", "published", "live"])));
    if (inArticle.length >= MAX_PER_ARTICLE) {
      throw new PlacementError(`An article carries at most ${MAX_PER_ARTICLE} network links`);
    }
    if (inArticle.some((row) => row.beneficiary === beneficiary.id)) {
      throw new PlacementError("This article already links to that website");
    }
    if (linksTo(article.bodyHtml, target.toString())) {
      throw new PlacementError("The article already links to that page");
    }

    // The link itself, on words already in the article.
    const linked = linkPhrase(article.bodyHtml, anchor, target.toString(), siteScope(host).hosts);
    if (!linked.linked) {
      throw new PlacementError("Those words are not in a paragraph of the article (outside headings and existing links)");
    }

    // Atomic reservation against the BENEFICIARY's workspace.
    await lockWorkspaceCredits(tx, beneficiary.organizationId);
    const available = await creditsFor(tx, beneficiary.organizationId);
    if (available.available < credits) {
      throw new PlacementError(
        `Not enough credits: ${available.available} available (${available.balance} balance, ${available.reserved} reserved), ${credits} needed`,
      );
    }

    const [request] = await tx
      .insert(backlinkRequests)
      .values({
        websiteId: beneficiary.id,
        targetUrl: target.toString(),
        anchorHint: anchor,
        status: "matched",
        creditsReserved: credits,
      })
      .returning({ id: backlinkRequests.id });
    const [placement] = await tx
      .insert(placements)
      .values({
        requestId: request.id,
        hostWebsiteId: host.id,
        articleId: article.id,
        anchor,
        credits,
        status: "drafted",
        managed: true,
        createdBy: input.actorEmail,
        reason: input.reason?.trim() || null,
      })
      .returning({ id: placements.id });

    const [updated] = await tx
      .update(articles)
      .set({ bodyHtml: linked.html, ...reviewReset() })
      .where(eq(articles.id, article.id))
      .returning({ reviewVersion: articles.reviewVersion });

    await recordAdminAction(
      {
        actorEmail: input.actorEmail,
        action: "network.placement_added",
        targetType: "placement",
        targetId: placement.id,
        organizationId: beneficiary.organizationId,
        summary: `Placed a link to ${beneficiary.domain} in an article on ${host.domain} (${credits} credit${credits === 1 ? "" : "s"} reserved)`,
        detail: {
          articleId: article.id,
          hostWebsiteId: host.id,
          beneficiaryWebsiteId: beneficiary.id,
          targetUrl: target.toString(),
          anchor,
          credits,
          reason: input.reason?.trim() || null,
        },
      },
      tx,
    );
    return { placementId: placement.id, reviewVersion: updated.reviewVersion };
  });
}

/**
 * Takes a placement back out of a draft, before publication only: the link
 * is unwrapped (its words stay), the reservation released, both records kept
 * as "cancelled". A published or live placement belongs to the verifier.
 */
export async function removeManagedPlacement(input: {
  placementId: string;
  expectedVersion: number;
  reason?: string | null;
  actorEmail: string;
}): Promise<{ reviewVersion: number }> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({
        id: placements.id,
        status: placements.status,
        articleId: placements.articleId,
        requestId: placements.requestId,
        credits: placements.credits,
        targetUrl: backlinkRequests.targetUrl,
      })
      .from(placements)
      .innerJoin(backlinkRequests, eq(backlinkRequests.id, placements.requestId))
      .where(eq(placements.id, input.placementId))
      .for("update", { of: placements });
    if (!row?.articleId) throw new PlacementError("Placement not found");
    const article = await lockArticle(tx, row.articleId, input.expectedVersion);

    const cancelled = await tx
      .update(placements)
      .set({ status: "cancelled", updatedAt: new Date() })
      // Compare-and-set: only a placement still in the draft stage.
      .where(and(eq(placements.id, row.id), inArray(placements.status, ["pending", "drafted"])))
      .returning({ id: placements.id });
    if (cancelled.length === 0) throw new PlacementError("That link is already published; it can no longer be withdrawn here");
    await tx
      .update(backlinkRequests)
      .set({ status: "cancelled", creditsReserved: 0, updatedAt: new Date() })
      .where(eq(backlinkRequests.id, row.requestId));

    const [host] = await tx
      .select({ url: websites.url, domain: websites.domain })
      .from(websites)
      .where(eq(websites.id, article.websiteId))
      .limit(1);
    const unlinked = unlinkUrl(article.bodyHtml, row.targetUrl, host ? siteScope(host).hosts : undefined);
    const [updated] = await tx
      .update(articles)
      .set({ bodyHtml: unlinked.html, ...reviewReset() })
      .where(eq(articles.id, article.id))
      .returning({ reviewVersion: articles.reviewVersion });

    await recordAdminAction(
      {
        actorEmail: input.actorEmail,
        action: "network.placement_removed",
        targetType: "placement",
        targetId: row.id,
        summary: `Withdrew a placement before publication (${row.credits} credit${row.credits === 1 ? "" : "s"} released)`,
        detail: { articleId: article.id, credits: row.credits, reason: input.reason?.trim() || null },
      },
      tx,
    );
    return { reviewVersion: updated.reviewVersion };
  });
}

/**
 * Changes a committed placement's credit amount - only while it is still in
 * the draft (never once charged: a settled amount changes only through an
 * audited adjustment). An increase is reserved under the same lock and
 * refused when the workspace cannot cover it.
 */
export async function setPlacementCredits(input: {
  placementId: string;
  expectedVersion: number;
  credits: number;
  reason?: string | null;
  actorEmail: string;
}): Promise<{ reviewVersion: number }> {
  const credits = validCredits(input.credits);

  // The beneficiary's monthly plan credits, granted before an increase is checked.
  const [owner] = await db
    .select({ organizationId: websites.organizationId })
    .from(placements)
    .innerJoin(backlinkRequests, eq(backlinkRequests.id, placements.requestId))
    .innerJoin(websites, eq(websites.id, backlinkRequests.websiteId))
    .where(eq(placements.id, input.placementId))
    .limit(1);
  if (owner) await ensureMonthlyCredits(owner.organizationId);

  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({
        id: placements.id,
        status: placements.status,
        articleId: placements.articleId,
        requestId: placements.requestId,
        credits: placements.credits,
        beneficiaryOrg: websites.organizationId,
      })
      .from(placements)
      .innerJoin(backlinkRequests, eq(backlinkRequests.id, placements.requestId))
      .innerJoin(websites, eq(websites.id, backlinkRequests.websiteId))
      .where(eq(placements.id, input.placementId))
      .for("update", { of: placements });
    if (!row?.articleId) throw new PlacementError("Placement not found");
    const article = await lockArticle(tx, row.articleId, input.expectedVersion);
    if (row.status !== "drafted") throw new PlacementError("Only a placement not yet published can change its credits");

    const delta = credits - row.credits;
    if (delta > 0) {
      await lockWorkspaceCredits(tx, row.beneficiaryOrg);
      const available = await creditsFor(tx, row.beneficiaryOrg);
      if (available.available < delta) {
        throw new PlacementError(`Not enough credits: ${available.available} available, ${delta} more needed`);
      }
    }
    await tx
      .update(placements)
      .set({ credits, updatedAt: new Date() })
      .where(and(eq(placements.id, row.id), eq(placements.status, "drafted")));
    await tx
      .update(backlinkRequests)
      .set({ creditsReserved: credits, updatedAt: new Date() })
      .where(eq(backlinkRequests.id, row.requestId));
    const [updated] = await tx
      .update(articles)
      .set(reviewReset())
      .where(eq(articles.id, article.id))
      .returning({ reviewVersion: articles.reviewVersion });

    await recordAdminAction(
      {
        actorEmail: input.actorEmail,
        action: "network.placement_credits",
        targetType: "placement",
        targetId: row.id,
        organizationId: row.beneficiaryOrg,
        summary: `Changed a placement's credits from ${row.credits} to ${credits}`,
        detail: { from: row.credits, to: credits, reason: input.reason?.trim() || null },
      },
      tx,
    );
    return { reviewVersion: updated.reviewVersion };
  });
}

export type ReviewEdit = {
  articleId: string;
  /** The article's review version the administrator is looking at. */
  expectedVersion: number;
  /**
   * reviewHash of the text the administrator opened. The version alone is
   * not enough: a customer's own edit to a pending article does not move it,
   * and this save must not overwrite that edit unseen.
   */
  expectedHash: string;
  title: string;
  slug: string;
  metaDescription: string;
  bodyHtml: string;
  actorEmail: string;
};

/**
 * An administrator's edit of an article under review - its title, slug,
 * excerpt and text - so the words around the network links can be worked on
 * before approval.
 *
 * Under the same lock and version check as placing a link, and like any
 * change in review it returns the article to pending with a new version: an
 * approval given before the edit no longer covers it. The previous body is
 * kept in article_versions, as the customer's own editor does.
 *
 * NETWORK LINKS STAY PLACEMENTS. A committed placement's link cannot be
 * deleted here: its credits are reserved against that link, and approval
 * refuses an article whose placed link is missing. The edit is refused
 * instead, naming the website, and Withdraw is the way to remove one. The
 * linked words may change; the placement's recorded anchor follows them.
 */
export async function editReviewedArticle(input: ReviewEdit): Promise<{ reviewVersion: number; changed: boolean }> {
  const title = input.title.trim().slice(0, 200);
  if (!title) throw new PlacementError("The title cannot be empty");
  const slug = normaliseSlug(input.slug);
  const metaDescription = input.metaDescription.trim().slice(0, 300) || null;

  return db.transaction(async (tx) => {
    const article = await lockArticle(tx, input.articleId, input.expectedVersion);
    if (reviewHash(article) !== input.expectedHash) {
      throw new PlacementError(
        "This article was changed after you opened it (the customer may have edited it). Reload it to see the latest text, then make your change again.",
      );
    }

    const [host] = await tx
      .select({ url: websites.url, domain: websites.domain, organizationId: websites.organizationId })
      .from(websites)
      .where(eq(websites.id, article.websiteId))
      .limit(1);
    // Sanitised exactly as the customer's editor does: links to the site itself stay followed.
    const bodyHtml = sanitizeHtml(input.bodyHtml, host ? { siteHosts: siteScope(host).hosts } : {});
    if (!bodyHtml.trim()) throw new PlacementError("The article text cannot be empty");

    const next = { ...article, title, slug, metaDescription, bodyHtml };
    if (reviewHash(next) === reviewHash(article)) {
      return { reviewVersion: article.reviewVersion, changed: false };
    }

    const committed = await tx
      .select({ id: placements.id, anchor: placements.anchor, targetUrl: backlinkRequests.targetUrl, domain: websites.domain })
      .from(placements)
      .innerJoin(backlinkRequests, eq(backlinkRequests.id, placements.requestId))
      .innerJoin(websites, eq(websites.id, backlinkRequests.websiteId))
      .where(and(eq(placements.articleId, article.id), inArray(placements.status, ["pending", "drafted"])));
    // Only links this edit removes: one already missing (a customer's edit) is shown on the page instead.
    const dropped = committed.filter((p) => linksTo(article.bodyHtml, p.targetUrl) && !linksTo(bodyHtml, p.targetUrl));
    if (dropped.length > 0) {
      const domains = [...new Set(dropped.map((p) => p.domain))].join(", ");
      throw new PlacementError(
        `This edit removes the network link to ${domains}. Keep the link in the text, or withdraw it under Network links first.`,
      );
    }

    const fields = (["title", "slug", "metaDescription", "bodyHtml"] as const).filter((field) => next[field] !== article[field]);
    if (fields.includes("bodyHtml")) {
      await tx.insert(articleVersions).values({ articleId: article.id, bodyHtml: article.bodyHtml });
    }
    const [updated] = await tx
      .update(articles)
      .set({ title, slug, metaDescription, bodyHtml, wordCount: countWords(bodyHtml), ...reviewReset() })
      .where(eq(articles.id, article.id))
      .returning({ reviewVersion: articles.reviewVersion });

    const anchors: { placementId: string; from: string | null; to: string }[] = [];
    for (const placement of committed) {
      const words = linkTextFor(bodyHtml, placement.targetUrl)?.slice(0, 120);
      if (!words || words === placement.anchor) continue;
      await tx.update(placements).set({ anchor: words, updatedAt: new Date() }).where(eq(placements.id, placement.id));
      anchors.push({ placementId: placement.id, from: placement.anchor, to: words });
    }

    const labels = { title: "title", slug: "slug", metaDescription: "excerpt", bodyHtml: "text" };
    await recordAdminAction(
      {
        actorEmail: input.actorEmail,
        action: "network.article_edited",
        targetType: "article",
        targetId: article.id,
        organizationId: host?.organizationId ?? null,
        summary: `Edited an article in review (${fields.map((field) => labels[field]).join(", ")})`,
        detail: {
          fields,
          wasApproved: article.reviewStatus === "approved",
          version: updated.reviewVersion,
          anchors,
        },
      },
      tx,
    );
    return { reviewVersion: updated.reviewVersion, changed: true };
  });
}

/**
 * Approves an article for delivery: records exactly what was approved (its
 * hash) at the version the administrator reviewed. Any number of network
 * links from none to MAX_PER_ARTICLE is an ordinary approval - an article
 * with no network links is released as it is, and the audit log says so.
 *
 * What is approved is exactly what the administrator was shown: the text
 * must still hash to `expectedHash`. The version alone would not catch a
 * customer's edit made while the review page was open, since the customer's
 * editor does not move it.
 */
export async function approveArticle(input: {
  articleId: string;
  expectedVersion: number;
  /** reviewHash of the article as the review page showed it. */
  expectedHash: string;
  note?: string | null;
  actorEmail: string;
}): Promise<{ reviewVersion: number; placements: number }> {
  return db.transaction(async (tx) => {
    await lockNotInFlight(tx, input.articleId);
    const [article] = await tx
      .select()
      .from(articles)
      .where(eq(articles.id, input.articleId))
      .for("update");
    if (!article) throw new PlacementError("Article not found");
    if (article.reviewVersion !== input.expectedVersion) {
      throw new PlacementError("This article changed after you opened it. Reload it and review the latest version.");
    }
    if (article.reviewStatus !== "pending") {
      throw new PlacementError(article.reviewStatus === "approved" ? "Already approved" : "This article is not waiting for review");
    }
    if (!article.bodyHtml) throw new PlacementError("This article has not been written yet");
    if (reviewHash(article) !== input.expectedHash) {
      throw new PlacementError(
        "This article's text changed after you opened it (the customer may have edited it). Reload it and review the latest version.",
      );
    }

    const committed = await tx
      .select({ id: placements.id, targetUrl: backlinkRequests.targetUrl })
      .from(placements)
      .innerJoin(backlinkRequests, eq(backlinkRequests.id, placements.requestId))
      .where(and(eq(placements.articleId, article.id), eq(placements.status, "drafted")));
    // Every committed placement's link must actually be in the text.
    const missing = committed.filter((row) => !linksTo(article.bodyHtml!, row.targetUrl));
    if (missing.length > 0) {
      throw new PlacementError("A placed link is missing from the text - remove that placement or restore the link first");
    }

    const [updated] = await tx
      .update(articles)
      .set({
        reviewStatus: "approved",
        reviewApprovedAt: new Date(),
        reviewApprovedBy: input.actorEmail,
        reviewApprovedHash: reviewHash(article),
        reviewVersion: sql`${articles.reviewVersion} + 1`,
      })
      .where(and(eq(articles.id, article.id), eq(articles.reviewVersion, input.expectedVersion)))
      .returning({ reviewVersion: articles.reviewVersion });

    await recordAdminAction(
      {
        actorEmail: input.actorEmail,
        action: "network.article_approved",
        targetType: "article",
        targetId: article.id,
        summary:
          committed.length > 0
            ? `Approved an article with ${committed.length} network link${committed.length === 1 ? "" : "s"}`
            : "Approved an article with no network links",
        detail: { placements: committed.length, note: input.note?.trim() || null, version: updated.reviewVersion },
      },
      tx,
    );
    return { reviewVersion: updated.reviewVersion, placements: committed.length };
  });
}

/** Sends an approved article back to pending (e.g. to rework it). */
export async function reopenArticle(input: { articleId: string; expectedVersion: number; actorEmail: string }) {
  return db.transaction(async (tx) => {
    // Reopening cannot pull back a revision already on its way to the site.
    await lockNotInFlight(tx, input.articleId);
    const rows = await tx
      .update(articles)
      .set(reviewReset())
      .where(
        and(
          eq(articles.id, input.articleId),
          eq(articles.reviewVersion, input.expectedVersion),
          eq(articles.reviewStatus, "approved"),
        ),
      )
      .returning({ reviewVersion: articles.reviewVersion });
    if (rows.length === 0) throw new PlacementError("This article changed after you opened it. Reload it and try again.");
    await recordAdminAction(
      {
        actorEmail: input.actorEmail,
        action: "network.article_reopened",
        targetType: "article",
        targetId: input.articleId,
        summary: "Sent an approved article back for review",
      },
      tx,
    );
    return { reviewVersion: rows[0].reviewVersion };
  });
}

/** Articles waiting for, or approved in, the review - with their placements. */
export async function managedPlacementsFor(articleId: string) {
  return db
    .select({
      id: placements.id,
      status: placements.status,
      credits: placements.credits,
      anchor: placements.anchor,
      reason: placements.reason,
      createdBy: placements.createdBy,
      targetUrl: backlinkRequests.targetUrl,
      beneficiaryWebsiteId: backlinkRequests.websiteId,
      beneficiaryDomain: websites.domain,
      beneficiaryOrgId: websites.organizationId,
    })
    .from(placements)
    .innerJoin(backlinkRequests, eq(backlinkRequests.id, placements.requestId))
    .innerJoin(websites, eq(websites.id, backlinkRequests.websiteId))
    .where(and(eq(placements.articleId, articleId), ne(placements.status, "cancelled")));
}
