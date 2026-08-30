"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { articles, articleVersions } from "@/lib/db/schema";
import { queueArticleForCalendarItem } from "@/inngest/functions/generate-article";
import { requireWebsite } from "@/lib/tenant";
import { sanitizeHtml, countWords } from "@/lib/articles/generate";
import type { ActionResult } from "@/lib/websites/actions";

/**
 * Article reads and actions.
 *
 * Every entry point resolves the website through requireWebsite() first, and
 * every article query is then scoped to that website's id. An article id alone
 * is never trusted: it arrives from the client and could belong to any tenant.
 */

export type ArticleRow = {
  id: string;
  /** Lets the calendar show "Open" instead of a second "Write" button. */
  calendarItemId: string | null;
  title: string;
  slug: string | null;
  targetKeyword: string | null;
  wordCount: number | null;
  status: string;
  generationStep: string | null;
  error: string | null;
  updatedAt: Date;
};

export async function listArticles(websiteId: string): Promise<ArticleRow[]> {
  const { site } = await requireWebsite(websiteId);
  return db
    .select({
      id: articles.id,
      calendarItemId: articles.calendarItemId,
      title: articles.title,
      slug: articles.slug,
      targetKeyword: articles.targetKeyword,
      wordCount: articles.wordCount,
      status: articles.status,
      generationStep: articles.generationStep,
      error: articles.error,
      updatedAt: articles.updatedAt,
    })
    .from(articles)
    .where(eq(articles.websiteId, site.id))
    .orderBy(desc(articles.updatedAt));
}

export type ArticleDetail = ArticleRow & {
  bodyHtml: string | null;
  metaDescription: string | null;
};

export async function getArticle(
  websiteId: string,
  articleId: string,
): Promise<ArticleDetail | null> {
  const { site } = await requireWebsite(websiteId);
  const [row] = await db
    .select()
    .from(articles)
    .where(and(eq(articles.id, articleId), eq(articles.websiteId, site.id)))
    .limit(1);
  if (!row) return null;

  return {
    id: row.id,
    calendarItemId: row.calendarItemId,
    title: row.title,
    slug: row.slug,
    targetKeyword: row.targetKeyword,
    wordCount: row.wordCount,
    status: row.status,
    generationStep: row.generationStep,
    error: row.error,
    updatedAt: row.updatedAt,
    bodyHtml: row.bodyHtml,
    metaDescription: row.metaDescription,
  };
}

/** Queues generation for a planned calendar item. */
export async function generateFromCalendarItem(
  websiteId: string,
  calendarItemId: string,
): Promise<ActionResult<{ articleId: string }>> {
  const { site, orgId } = await requireWebsite(websiteId);

  const result = await queueArticleForCalendarItem(
    orgId,
    site.id,
    calendarItemId,
  );
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/websites/${site.id}`);
  return { ok: true, data: { articleId: result.articleId } };
}

/** Re-runs generation for an article that failed or needs another attempt. */
export async function regenerateArticle(
  websiteId: string,
  articleId: string,
): Promise<ActionResult<null>> {
  const { site, orgId } = await requireWebsite(websiteId);

  const [article] = await db
    .select({ id: articles.id, calendarItemId: articles.calendarItemId })
    .from(articles)
    .where(and(eq(articles.id, articleId), eq(articles.websiteId, site.id)))
    .limit(1);
  if (!article) return { ok: false, error: "Article not found" };
  if (!article.calendarItemId) {
    return { ok: false, error: "This article has no plan entry to rebuild from" };
  }

  const result = await queueArticleForCalendarItem(
    orgId,
    site.id,
    article.calendarItemId,
  );
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/websites/${site.id}/articles/${articleId}`);
  return { ok: true, data: null };
}

export async function updateArticle(
  websiteId: string,
  articleId: string,
  input: { title?: string; bodyHtml?: string; metaDescription?: string },
): Promise<ActionResult<null>> {
  const { site } = await requireWebsite(websiteId);

  const [existing] = await db
    .select({ id: articles.id, bodyHtml: articles.bodyHtml })
    .from(articles)
    .where(and(eq(articles.id, articleId), eq(articles.websiteId, site.id)))
    .limit(1);
  if (!existing) return { ok: false, error: "Article not found" };

  const patch: Record<string, unknown> = { updatedAt: new Date() };

  if (typeof input.title === "string") {
    const title = input.title.trim();
    if (!title) return { ok: false, error: "Title cannot be empty" };
    patch.title = title.slice(0, 200);
  }
  if (typeof input.metaDescription === "string") {
    patch.metaDescription = input.metaDescription.trim().slice(0, 300) || null;
  }
  if (typeof input.bodyHtml === "string") {
    /**
     * Sanitised on the way in, not only at generation. This body is editable
     * by the user and later published to their live site, so a script pasted
     * into the editor must not survive the round trip.
     */
    const clean = sanitizeHtml(input.bodyHtml);
    patch.bodyHtml = clean;
    patch.wordCount = countWords(clean);

    // Snapshot the PREVIOUS body so an edit is always recoverable.
    if (existing.bodyHtml && existing.bodyHtml !== clean) {
      await db.insert(articleVersions).values({
        articleId,
        bodyHtml: existing.bodyHtml,
      });
    }
  }

  await db.update(articles).set(patch).where(eq(articles.id, articleId));

  revalidatePath(`/websites/${site.id}/articles/${articleId}`);
  revalidatePath(`/websites/${site.id}`);
  return { ok: true, data: null };
}

export async function deleteArticle(
  websiteId: string,
  articleId: string,
): Promise<ActionResult<null>> {
  const { site } = await requireWebsite(websiteId);

  await db
    .delete(articles)
    .where(and(eq(articles.id, articleId), eq(articles.websiteId, site.id)));

  revalidatePath(`/websites/${site.id}`);
  return { ok: true, data: null };
}
