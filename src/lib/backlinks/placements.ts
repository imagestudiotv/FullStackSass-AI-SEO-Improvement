import { and, desc, eq, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";

import { recordCredit } from "@/lib/backlinks/credits";
import type { LinkCheckResult } from "@/lib/backlinks/verify";
import { db } from "@/lib/db";
import {
  articles,
  backlinkRequests,
  linkChecks,
  placements,
  websites,
} from "@/lib/db/schema";
import type { Executor } from "@/lib/db/types";

/**
 * A backlink placement's life, and the credits that move with it.
 *
 * WHAT WAS WRONG. A placement was marked "live" - and the requester charged,
 * the host paid - the moment the link appeared in a GENERATED DRAFT. Nothing
 * had been published. liveUrl was never written, and the verification job
 * only looked at placements with a liveUrl, so these were never checked: a
 * link that never went live stayed paid for, and one removed later was never
 * refunded. Retries of the generation step could repeat the credit moves.
 *
 * NOW:
 *
 *   pending ──generated──▶ drafted ──published──▶ published ──seen──▶ live
 *                                       │                           │
 *                                       └──never seen──▶ unverified └──an admin removes it──▶ removed
 *
 *  - drafted:    the link is in a generated article. NO credits move.
 *  - published:  the article is live at `liveUrl` (reported by the CMS or
 *                the WordPress plugin). NO credits move yet.
 *  - live:       the link was actually SEEN at liveUrl. Only now is the
 *                requester charged and the host paid - in one transaction,
 *                with the placement's state change.
 *  - removed:    an ADMINISTRATOR removed a live link that went missing
 *                (removeMissingPlacement). Requester refunded, host's reward
 *                reversed, in one transaction; the request goes back to
 *                matching. Never automatic - see "MISSING LINKS" below.
 *  - unverified: published but never seen after as many checks. Nothing was
 *                charged, so nothing is refunded; the request is re-matched.
 *
 * Every credit movement has an idempotency key ("placement:<id>:charge",
 * ":host_reward", ":refund", ":host_reversal"), and every transition is a
 * compare-and-set on the status under a row lock, so retried or concurrent
 * runs move credits exactly once.
 *
 * A check that could not REACH the page (timeout, 5xx, DNS) is an "error",
 * not a "missing": it neither counts toward the missing streak nor resets it.
 *
 * MISSING LINKS ARE NOT REFUNDED AUTOMATICALLY (client, 2026-10-01). A live
 * link missing on FAILURES_BEFORE_REMOVED consecutive checks used to be
 * removed and refunded by the verifier. But a host site in maintenance mode,
 * or with a temporary error page, answers without the link - and once it is
 * back, the link is visible again while the credit has already gone back.
 * Now such a link stays live and nothing moves: it is listed for
 * administrators (missingPlacements), and the customer contacts support if
 * they see it is gone. An administrator then removes it by hand, which
 * refunds as removal always did.
 */

export const FAILURES_BEFORE_REMOVED = 3;

/** How the verifier classifies one fetch of a placement's page. */
export type CheckOutcome = "alive" | "missing" | "error";

export function classifyCheck(result: LinkCheckResult): CheckOutcome {
  if (result.alive) return "alive";
  // The page answered: the link is definitely not on it, or the page is gone.
  if (result.httpStatus === 404 || result.httpStatus === 410) return "missing";
  if (result.httpStatus !== null && result.httpStatus >= 200 && result.httpStatus < 300) {
    return result.error ? "error" : "missing";
  }
  return "error";
}

/** The link is in a generated article. Called from the generation job. */
export async function markPlacementDrafted(
  placementId: string,
  articleId: string,
  executor: Executor = db,
): Promise<boolean> {
  const rows = await executor
    .update(placements)
    .set({ status: "drafted", articleId, updatedAt: new Date() })
    .where(and(eq(placements.id, placementId), eq(placements.status, "pending")))
    .returning({ id: placements.id });
  return rows.length > 0;
}

/**
 * The article went out. Records the real URL on its placements so the
 * verifier can look for the link there. A CMS draft is not publication:
 * nothing changes. A republish at a new URL moves the URL along.
 */
export async function recordArticlePublication(
  articleId: string,
  publishedUrl: string | null,
  status: "publish" | "draft",
): Promise<number> {
  if (status !== "publish" || !publishedUrl) return 0;
  const now = new Date();
  const promoted = await db
    .update(placements)
    .set({ status: "published", liveUrl: publishedUrl, publishedAt: now, updatedAt: now })
    .where(
      and(
        eq(placements.articleId, articleId),
        inArray(placements.status, ["drafted", "published", "unverified"]),
      ),
    )
    .returning({ id: placements.id });
  // Already live: keep checking, at the new address.
  await db
    .update(placements)
    .set({ liveUrl: publishedUrl, updatedAt: now })
    .where(and(eq(placements.articleId, articleId), eq(placements.status, "live")));
  return promoted.length;
}

/**
 * Placements the old model left without a URL, whose article has since been
 * published: give them the article's URL so they can be verified at all.
 */
export async function discoverPublishedPlacements(): Promise<number> {
  const found = await db
    .select({ id: placements.id, status: placements.status, url: articles.publishedUrl })
    .from(placements)
    .innerJoin(articles, eq(articles.id, placements.articleId))
    .where(
      and(
        isNull(placements.liveUrl),
        inArray(placements.status, ["drafted", "live"]),
        eq(articles.status, "published"),
        isNotNull(articles.publishedUrl),
      ),
    )
    .limit(200);
  for (const row of found) {
    await db
      .update(placements)
      .set({
        liveUrl: row.url,
        ...(row.status === "drafted" ? { status: "published", publishedAt: new Date() } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(placements.id, row.id), isNull(placements.liveUrl)));
  }
  return found.length;
}

/**
 * Target URLs of the network links an article carries, for delivery to send
 * them followed (lib/articles/delivery.ts). Every placement that is or may be
 * in the text: a withdrawn one was unwrapped from it, and a removed one was
 * refunded, so neither is ours to vouch for any more.
 */
export async function placementUrlsForArticle(articleId: string): Promise<string[]> {
  const rows = await db
    .select({ url: backlinkRequests.targetUrl })
    .from(placements)
    .innerJoin(backlinkRequests, eq(backlinkRequests.id, placements.requestId))
    .where(
      and(
        eq(placements.articleId, articleId),
        inArray(placements.status, ["pending", "drafted", "published", "live", "unverified"]),
      ),
    );
  return rows.map((row) => row.url);
}

export type DuePlacement = {
  id: string;
  liveUrl: string;
  targetUrl: string;
  status: string;
};

/** Placements to check now: awaiting first sight, or live and due a re-check. */
export async function placementsDue(
  recheckBefore: Date,
  limit: number,
): Promise<DuePlacement[]> {
  const rows = await db
    .select({
      id: placements.id,
      liveUrl: placements.liveUrl,
      targetUrl: backlinkRequests.targetUrl,
      status: placements.status,
    })
    .from(placements)
    .innerJoin(backlinkRequests, eq(placements.requestId, backlinkRequests.id))
    .where(
      and(
        inArray(placements.status, ["published", "live"]),
        isNotNull(placements.liveUrl),
        or(
          isNull(placements.lastVerifiedAt),
          lt(placements.lastVerifiedAt, recheckBefore),
          // A recheck asked for since the last check (lib/reporting/recheck.ts).
          sql`${placements.recheckRequestedAt} > ${placements.lastVerifiedAt}`,
        ),
      ),
    )
    // Asked-for rechecks first, then never-checked links (nothing is
    // charged until one is seen), then the longest unchecked. Postgres puts
    // NULLs LAST in ascending order, so "nulls first" is spelled out.
    .orderBy(
      sql`(${placements.recheckRequestedAt} > coalesce(${placements.lastVerifiedAt}, 'epoch'::timestamp)) desc nulls last`,
      sql`${placements.lastVerifiedAt} asc nulls first`,
    )
    .limit(limit);
  return rows.map((row) => ({ ...row, liveUrl: row.liveUrl! }));
}

/** The last N checks that reached a verdict (errors are not verdicts). */
async function lastVerdicts(tx: Executor, placementId: string, n: number) {
  const rows = await tx
    .select({ outcome: linkChecks.outcome, alive: linkChecks.alive })
    .from(linkChecks)
    .where(
      and(
        eq(linkChecks.placementId, placementId),
        // Rows from before `outcome` existed only knew alive or not.
        or(isNull(linkChecks.outcome), inArray(linkChecks.outcome, ["alive", "missing"])),
      ),
    )
    .orderBy(desc(linkChecks.checkedAt))
    .limit(n);
  return rows.map((row) => row.outcome ?? (row.alive ? "alive" : "missing"));
}

export type Transition = "went_live" | "missing" | "unverified" | null;

/**
 * Records one check and applies whatever transition it completes, with its
 * credit movements, in ONE transaction under a lock on the placement.
 */
export async function applyCheck(
  placementId: string,
  outcome: CheckOutcome,
  httpStatus: number | null,
  now: Date = new Date(),
  /** What the check saw, for the customer's row details. */
  detail: { rel?: string | null; error?: string | null } = {},
): Promise<Transition> {
  return db.transaction(async (tx): Promise<Transition> => {
    const [placement] = await tx
      .select({
        id: placements.id,
        status: placements.status,
        credits: placements.credits,
        requestId: placements.requestId,
        hostWebsiteId: placements.hostWebsiteId,
        managed: placements.managed,
      })
      .from(placements)
      .where(eq(placements.id, placementId))
      .for("update");
    if (!placement || !["published", "live"].includes(placement.status)) return null;

    await tx.insert(linkChecks).values({
      placementId,
      alive: outcome === "alive",
      httpStatus,
      outcome,
      rel: outcome === "alive" ? (detail.rel ?? null) : null,
      error: outcome === "error" && detail.error ? detail.error.slice(0, 200) : null,
      checkedAt: now,
    });
    await tx
      .update(placements)
      .set({ lastVerifiedAt: now, updatedAt: now })
      .where(eq(placements.id, placementId));

    const [request] = await tx
      .select({ id: backlinkRequests.id, requesterOrgId: websites.organizationId })
      .from(backlinkRequests)
      .innerJoin(websites, eq(websites.id, backlinkRequests.websiteId))
      .where(eq(backlinkRequests.id, placement.requestId))
      .limit(1);
    const [host] = placement.hostWebsiteId
      ? await tx
          .select({ organizationId: websites.organizationId })
          .from(websites)
          .where(eq(websites.id, placement.hostWebsiteId))
          .limit(1)
      : [];

    if (placement.status === "published" && outcome === "alive") {
      await tx
        .update(placements)
        .set({ status: "live", liveAt: now, updatedAt: now })
        .where(and(eq(placements.id, placementId), eq(placements.status, "published")));
      await tx
        .update(backlinkRequests)
        .set({ status: "live", updatedAt: now })
        .where(eq(backlinkRequests.id, placement.requestId));
      if (request) {
        await recordCredit(
          request.requesterOrgId,
          {
            type: "link_received",
            amount: -placement.credits,
            referenceId: placementId,
            idempotencyKey: `placement:${placementId}:charge`,
            note: "Backlink placed and verified live",
          },
          tx,
        );
      }
      if (host) {
        await recordCredit(
          host.organizationId,
          {
            type: "link_given",
            amount: placement.credits,
            referenceId: placementId,
            idempotencyKey: `placement:${placementId}:host_reward`,
            note: "Hosted a backlink, verified live",
          },
          tx,
        );
      }
      return "went_live";
    }

    if (outcome !== "missing") return null;
    const verdicts = await lastVerdicts(tx, placementId, FAILURES_BEFORE_REMOVED);
    if (verdicts.length < FAILURES_BEFORE_REMOVED || verdicts.some((v) => v !== "missing")) {
      return null;
    }

    /*
      A LIVE link gone on every recent check: nothing moves (see "MISSING
      LINKS" above). It stays live, keeps being checked, and is listed for an
      administrator. "missing" is reported once, on the check that completes
      the streak, for the job's log.
    */
    if (placement.status === "live") {
      const longer = await lastVerdicts(tx, placementId, FAILURES_BEFORE_REMOVED + 1);
      const alreadyMissing = longer.length > FAILURES_BEFORE_REMOVED && longer[FAILURES_BEFORE_REMOVED] === "missing";
      return alreadyMissing ? null : "missing";
    }

    // Published, never seen, never charged: the request goes back to matching.

    /*
      The request goes back to matching: the customer still wants a link.

      Except a MANAGED link that was live and is now gone. Nothing matches
      managed requests automatically - an administrator places a new link by
      hand, with a new request - and a "pending" request still counts its
      credits_reserved as held (creditsFor in lib/backlinks/managed.ts), so
      the refund below would stay locked up for good. Its request is closed
      and its hold released instead. A managed link never seen live
      ("unverified", below) keeps its pending request and hold on purpose:
      a later recheck that finds it revives it (lib/reporting/recheck.ts).
    */
    await tx
      .update(backlinkRequests)
      .set({ status: "pending", updatedAt: now })
      .where(eq(backlinkRequests.id, placement.requestId));
    await tx
      .update(placements)
      .set({ status: "unverified", updatedAt: now })
      .where(and(eq(placements.id, placementId), eq(placements.status, "published")));
    return "unverified";
  });
}

export type MissingPlacement = {
  id: string;
  credits: number;
  managed: boolean;
  liveUrl: string | null;
  targetUrl: string;
  hostDomain: string | null;
  beneficiaryDomain: string;
  /** The first of the consecutive checks that found it missing. */
  missingSince: Date;
  lastVerifiedAt: Date | null;
};

/**
 * Live links that every one of their last FAILURES_BEFORE_REMOVED verdicts
 * found missing (outages are not verdicts), newest first: what an
 * administrator looks at when a customer reports a link gone.
 */
export async function missingPlacements(limit = 100): Promise<MissingPlacement[]> {
  const rows = await db.execute(sql`
    select p.id, p.credits, p.managed, p.live_url, p.last_verified_at, r.target_url,
           hw.domain as host_domain, bw.domain as beneficiary_domain, v.missing_since
    from placements p
    join backlink_requests r on r.id = p.request_id
    join websites bw on bw.id = r.website_id
    left join websites hw on hw.id = p.host_website_id
    cross join lateral (
      select count(*) filter (where last.verdict = 'missing') as missing, count(*) as verdicts, min(last.checked_at) as missing_since
      from (
        select coalesce(c.outcome, case when c.alive then 'alive' else 'missing' end) as verdict, c.checked_at
        from link_checks c
        where c.placement_id = p.id and (c.outcome is null or c.outcome in ('alive', 'missing'))
        order by c.checked_at desc
        limit ${FAILURES_BEFORE_REMOVED}
      ) last
    ) v
    where p.status = 'live' and v.verdicts = ${FAILURES_BEFORE_REMOVED} and v.missing = ${FAILURES_BEFORE_REMOVED}
    order by v.missing_since desc
    limit ${limit}
  `);
  const list = (Array.isArray(rows) ? rows : (rows as { rows: unknown[] }).rows) as Record<string, unknown>[];
  return list.map((row) => ({
    id: row.id as string,
    credits: Number(row.credits),
    managed: Boolean(row.managed),
    liveUrl: (row.live_url as string | null) ?? null,
    targetUrl: row.target_url as string,
    hostDomain: (row.host_domain as string | null) ?? null,
    beneficiaryDomain: row.beneficiary_domain as string,
    missingSince: new Date(row.missing_since as string),
    lastVerifiedAt: row.last_verified_at ? new Date(row.last_verified_at as string) : null,
  }));
}

/**
 * An ADMINISTRATOR removes a live link that went missing: what the verifier
 * used to do by itself. Requester refunded, host's reward reversed, the
 * request back to matching (a managed one closed, its hold released) - in
 * one transaction, under a lock, by the same idempotency keys as ever, so a
 * double click moves credits once. False when the link is not live (already
 * removed, or never charged).
 */
export async function removeMissingPlacement(placementId: string, now: Date = new Date()): Promise<{
  removed: boolean;
  credits: number;
  requesterOrgId: string | null;
  hostOrgId: string | null;
}> {
  return db.transaction(async (tx) => {
    const [placement] = await tx
      .select({
        id: placements.id,
        status: placements.status,
        credits: placements.credits,
        requestId: placements.requestId,
        hostWebsiteId: placements.hostWebsiteId,
        managed: placements.managed,
      })
      .from(placements)
      .where(eq(placements.id, placementId))
      .for("update");
    if (!placement || placement.status !== "live") {
      return { removed: false, credits: 0, requesterOrgId: null, hostOrgId: null };
    }
    const [request] = await tx
      .select({ requesterOrgId: websites.organizationId })
      .from(backlinkRequests)
      .innerJoin(websites, eq(websites.id, backlinkRequests.websiteId))
      .where(eq(backlinkRequests.id, placement.requestId))
      .limit(1);
    const [host] = placement.hostWebsiteId
      ? await tx
          .select({ organizationId: websites.organizationId })
          .from(websites)
          .where(eq(websites.id, placement.hostWebsiteId))
          .limit(1)
      : [];

    /*
      The request goes back to matching: the customer still wants a link.
      Except a MANAGED one: nothing matches managed requests automatically,
      and a pending request keeps its credits_reserved held (creditsFor in
      lib/backlinks/managed.ts), which would lock the refund up for good. It
      is closed and its hold released instead.
    */
    await tx
      .update(backlinkRequests)
      .set(
        placement.managed
          ? { status: "cancelled", creditsReserved: 0, updatedAt: now }
          : { status: "pending", updatedAt: now },
      )
      .where(eq(backlinkRequests.id, placement.requestId));
    await tx
      .update(placements)
      .set({ status: "removed", removedAt: now, updatedAt: now })
      .where(and(eq(placements.id, placementId), eq(placements.status, "live")));
    if (request) {
      await recordCredit(
        request.requesterOrgId,
        {
          type: "refund",
          amount: placement.credits,
          referenceId: placementId,
          idempotencyKey: `placement:${placementId}:refund`,
          note: "Link removed by the host site",
        },
        tx,
      );
    }
    if (host) {
      await recordCredit(
        host.organizationId,
        {
          type: "adjustment",
          amount: -placement.credits,
          referenceId: placementId,
          idempotencyKey: `placement:${placementId}:host_reversal`,
          note: "Link no longer live on your site",
        },
        tx,
      );
    } else {
      console.warn(
        `[placements] ${placementId} removed: requester refunded, but the host website is gone so nothing was reversed`,
      );
    }
    return {
      removed: true,
      credits: placement.credits,
      requesterOrgId: request?.requesterOrgId ?? null,
      hostOrgId: host?.organizationId ?? null,
    };
  });
}

/** Counts, for the job's log line. */
export async function placementCounts() {
  const rows = await db
    .select({ status: placements.status, n: sql<number>`count(*)::int` })
    .from(placements)
    .groupBy(placements.status);
  return Object.fromEntries(rows.map((row) => [row.status, row.n]));
}
