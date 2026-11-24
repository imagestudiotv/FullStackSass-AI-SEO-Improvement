"use server";

import { and, eq, isNull, ne, notExists, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { revalidatePath } from "next/cache";

import { recordAdminAction } from "@/lib/admin/audit";
import { DROPPED_TOPIC_STATUS, KEEP_CODE_SQL, keepLabel } from "@/lib/admin/draft-deletion-rules.mjs";
import { requireAdmin } from "@/lib/admin/guard";
import { ArticleDeletionRefused, deleteArticleAndSettleLinks } from "@/lib/articles/deletion";
import { db } from "@/lib/db";
import { articles, calendarItems, websites } from "@/lib/db/schema";
import type { Executor } from "@/lib/db/types";
import { ArticleInFlightError } from "@/lib/publishing/dispatch";
import type { ActionResult } from "@/lib/websites/actions";

/**
 * Deleting drafts from the review queue (Daniel, 2026-11-24: "Can we delete
 * all the old links from imagestudio fails, we will never using this articles
 * so is better to having a clean dashboard").
 *
 * Each goes through the deletion a customer's own Delete uses
 * (lib/articles/deletion.ts): the same locks, refusing while one is being
 * delivered. On top of it, checked under those locks, the rules in
 * draft-deletion-rules.mjs: nothing that reached, may have reached or is about
 * to reach a website, and nothing carrying a network link that concerns
 * another workspace. What is refused is named with its reason.
 *
 * The topic is marked so no run writes it again, and one audit entry per
 * article commits with its deletion.
 */

const MAX_AT_ONCE = 100;
const CONFIRMATION = "DELETE";

async function keepReason(executor: Executor, articleId: string): Promise<string | null> {
  const result = await executor.execute(sql`select ${sql.raw(KEEP_CODE_SQL)} as code, a.review_status from articles a where a.id = ${articleId}::uuid`);
  const [row] = (Array.isArray(result) ? result : (result as { rows: unknown[] }).rows) as { code: string | null; review_status: string | null }[];
  if (!row) return "It has already been deleted.";
  if (row.code) return keepLabel(row.code);
  // Only what the queue shows: an article outside the managed workflow is its customer's to delete.
  if (row.review_status !== "pending") return "It is not waiting for review.";
  return null;
}

/** Deletes several drafts from the review queue. Every refusal is reported with its reason. */
export async function deleteReviewDrafts(
  articleIds: string[],
  reason: string,
  confirmation: string,
): Promise<ActionResult<{ deleted: number; failures: { id: string; error: string }[] }>> {
  const admin = await requireAdmin();
  if (confirmation !== CONFIRMATION) return { ok: false, error: `Type ${CONFIRMATION} to confirm.` };
  const note = reason.trim();
  if (note.length < 3) return { ok: false, error: "Say why these drafts are being deleted." };
  const ids = [...new Set(Array.isArray(articleIds) ? articleIds : [])].filter((id) => /^[0-9a-f-]{36}$/i.test(String(id)));
  if (ids.length === 0) return { ok: false, error: "Nothing selected." };
  if (ids.length > MAX_AT_ONCE) return { ok: false, error: `Select at most ${MAX_AT_ONCE} drafts at a time.` };

  const failures: { id: string; error: string }[] = [];
  let deleted = 0;
  for (const id of ids) {
    const [article] = await db
      .select({
        id: articles.id,
        title: articles.title,
        websiteId: articles.websiteId,
        calendarItemId: articles.calendarItemId,
        domain: websites.domain,
        organizationId: websites.organizationId,
        plannedFor: calendarItems.scheduledFor,
      })
      .from(articles)
      .innerJoin(websites, eq(websites.id, articles.websiteId))
      .leftJoin(calendarItems, eq(calendarItems.id, articles.calendarItemId))
      .where(eq(articles.id, id))
      .limit(1);
    if (!article) {
      failures.push({ id, error: "It has already been deleted." });
      continue;
    }
    try {
      const result = await deleteArticleAndSettleLinks(article.websiteId, article.id, new Date(), {
        guard: (tx) => keepReason(tx, article.id),
        beforeDelete: async (tx, { released }) => {
          let topicDropped = false;
          if (article.calendarItemId) {
            const other = alias(articles, "other");
            const dropped = await tx
              .update(calendarItems)
              .set({ status: DROPPED_TOPIC_STATUS, scheduledFor: null, updatedAt: new Date() })
              .where(
                and(
                  eq(calendarItems.id, article.calendarItemId),
                  eq(calendarItems.websiteId, article.websiteId),
                  // Another article written from the same topic keeps it.
                  notExists(
                    tx
                      .select({ one: sql`1` })
                      .from(other)
                      .where(and(eq(other.calendarItemId, calendarItems.id), ne(other.id, article.id), isNull(other.translationOf))),
                  ),
                ),
              )
              .returning({ id: calendarItems.id });
            topicDropped = dropped.length > 0;
          }
          await recordAdminAction(
            {
              actorEmail: admin.email,
              action: "article.deleted",
              targetType: "article",
              targetId: article.id,
              organizationId: article.organizationId,
              summary: `Deleted the draft "${article.title}" of ${article.domain} from the review queue - ${note}`,
              detail: {
                title: article.title,
                domain: article.domain,
                websiteId: article.websiteId,
                calendarItemId: article.calendarItemId,
                plannedFor: article.plannedFor?.toISOString() ?? null,
                topicDropped,
                releasedLinks: released,
                reason: note,
              },
            },
            tx,
          );
        },
      });
      if (result.deleted) deleted++;
      else failures.push({ id, error: "It has already been deleted." });
    } catch (error) {
      if (error instanceof ArticleDeletionRefused || error instanceof ArticleInFlightError) failures.push({ id, error: error.message });
      else {
        console.error("[admin/review-drafts] deleting a draft failed", id, error);
        failures.push({ id, error: "It could not be deleted. Nothing about it changed." });
      }
    }
  }

  revalidatePath("/admin/network");
  revalidatePath("/admin/articles");
  return { ok: true, data: { deleted, failures } };
}
