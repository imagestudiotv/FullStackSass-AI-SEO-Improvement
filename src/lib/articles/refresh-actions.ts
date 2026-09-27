"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { articles } from "@/lib/db/schema";
import {
  findTrafficChanges,
  getTrafficSeries,
  type TrafficPoint,
  type TrafficReport,
} from "@/lib/articles/decay";
import { requeueArticle } from "@/inngest/functions/generate-article";
import { requireWebsite } from "@/lib/tenant";
import { requireEditor } from "@/lib/websites/require-editor";
import { checkLimit } from "@/lib/usage";
import type { ActionResult } from "@/lib/websites/actions";

/**
 * Content refresh.
 *
 * Published pages lose ground as competitors publish and facts age. The decline
 * is slow enough to look like noise, so customers rarely act on it until the
 * traffic is gone. This surfaces it from Search Console data and offers the one
 * action that fixes it: rewrite the page.
 */

export async function getTrafficChanges(
  websiteId: string,
): Promise<TrafficReport> {
  const { site } = await requireWebsite(websiteId);
  return findTrafficChanges(site.id);
}

/**
 * Daily clicks for the traffic chart.
 *
 * Tenant-scoped through requireWebsite like everything else here: a server
 * action takes its website id from the caller, so it is never trusted before
 * being checked against the caller's organization.
 */
export async function getTrafficChart(
  websiteId: string,
): Promise<TrafficPoint[]> {
  const { site } = await requireWebsite(websiteId);
  return getTrafficSeries(site.id);
}

/**
 * Queues a rewrite of an article that has lost traffic.
 *
 * Regenerates in place rather than creating a second article: publishing a new
 * page on the same topic would compete with the original, which is the exact
 * duplicate-content problem the product exists to prevent. The existing body is
 * kept in article_versions, so a worse rewrite can be compared and rolled back.
 */
export async function refreshArticle(
  websiteId: string,
  articleId: string,
): Promise<ActionResult<null>> {
  /*
    Rewrites a published article, so it is a write however it is named. The
    verb list that guarded the others matched "regenerate" but not "refresh".
  */
  const guard = await requireEditor(websiteId);
  if (!guard.ok) return { ok: false, error: guard.error };
  const { site } = guard.context;

  const [article] = await db
    .select({ id: articles.id })
    .from(articles)
    .where(and(eq(articles.id, articleId), eq(articles.websiteId, site.id)))
    .limit(1);

  // Scoped by website, so an id from another tenant is simply not found.
  if (!article) {
    return { ok: false, error: "That article no longer exists" };
  }

  /**
   * A refresh costs a full generation, so it counts against the plan like any
   * other article. Checked here rather than in the job: a limit hit needs to
   * reach the customer as a message, not die silently in the background.
   */
  const limit = await checkLimit(websiteId, "articles");
  if (!limit.allowed) {
    return {
      ok: false,
      error:
        limit.reason === "limit_reached"
          ? `Your plan includes ${limit.limit} articles per month (${limit.used} used)`
          : "This workspace has no active subscription",
    };
  }

  /*
    The same claim every rewrite goes through: entitlement, a daily rewrite
    slot, and an atomic status change, so two presses cannot both queue a
    paid generation of the same article.
  */
  const queued = await requeueArticle({
    websiteId: site.id,
    articleId,
    status: "generating",
  });
  if (!queued.ok) return { ok: false, error: queued.error };

  /*
    Both routes. Refreshing is triggered FROM the article's own page, so
    revalidating only the list would leave the editor showing the old draft -
    the exact stale-view bug this pass is fixing elsewhere.
  */
  revalidatePath(`/websites/${site.id}/articles/${articleId}`);
  revalidatePath(`/websites/${site.id}/content`);
  return { ok: true, data: null };
}
