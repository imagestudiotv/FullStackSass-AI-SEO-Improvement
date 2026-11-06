"use server";

import { and, desc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { articles, articleVersions, calendarItems } from "@/lib/db/schema";
import {
  queueArticleForCalendarItem,
  requeueArticle,
} from "@/inngest/functions/generate-article";
import { requireWebsite } from "@/lib/tenant";
import { requireEditor } from "@/lib/websites/require-editor";
import { sanitizeHtml, countWords, normaliseSlug } from "@/lib/articles/generate";
import { deleteArticleAndSettleLinks } from "@/lib/articles/deletion";
import { siteScope } from "@/lib/articles/link-guard";
import { PREPARING_TITLE } from "@/lib/i18n/article-delivery";
import type { ActionResult } from "@/lib/websites/actions";
import {
  afterArticleEdit,
  heldFromCustomer,
  heldFromCustomerSql,
  PREPARING_MESSAGE,
  servedStatus,
  storedRevision,
  twoStepArticles,
  twoStepOffSql,
} from "@/lib/articles/review";
import { ArticleInFlightError, editArticle } from "@/lib/publishing/dispatch";

/**
 * Article reads and actions.
 *
 * Every entry point resolves the website through requireWebsite() first, and
 * every article query is then scoped to that website's id. An article id alone
 * is never trusted: it arrives from the client and could belong to any tenant.
 */

/** Not exported: a "use server" module exports only its actions. */
class HeldFromCustomerError extends Error {
  constructor() {
    super(PREPARING_MESSAGE);
    this.name = "HeldFromCustomerError";
  }
}

export type ArticleRow = {
  id: string;
  /** Lets the calendar show "Open" instead of a second "Write" button. */
  calendarItemId: string | null;
  /** A translation's language (lib/articles/translations.ts); null for an original. */
  languageCode?: string | null;
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
  const rows = await db
    .select({
      id: articles.id,
      calendarItemId: articles.calendarItemId,
      languageCode: articles.languageCode,
      title: articles.title,
      slug: articles.slug,
      targetKeyword: articles.targetKeyword,
      wordCount: articles.wordCount,
      status: articles.status,
      generationStep: articles.generationStep,
      error: articles.error,
      updatedAt: articles.updatedAt,
      reviewStatus: articles.reviewStatus,
      publishedUrl: articles.publishedUrl,
      firstLiveAt: articles.firstLiveAt,
      // What the customer gets of a held article; not its stored title, nor the body here.
      stored: sql<Record<string, unknown> | null>`${articles.approvedRevision} - 'bodyHtml'`,
      plannedTitle: calendarItems.title,
      twoStep: sql<boolean>`not ${twoStepOffSql}`,
      held: heldFromCustomerSql,
    })
    .from(articles)
    .leftJoin(calendarItems, eq(calendarItems.id, articles.calendarItemId))
    .where(eq(articles.websiteId, site.id))
    .orderBy(desc(articles.updatedAt));

  // Built field by field below: what the two-step flow's reads leave out never reaches the page.
  return rows.map(({ reviewStatus, publishedUrl, firstLiveAt, stored, plannedTitle, twoStep, held, ...row }) => {
    if (held && stored) {
      const live = servedStatus({ publishedUrl, firstLiveAt, status: row.status }) === "published";
      return {
        ...row,
        title: stored.title as string,
        slug: (stored.slug as string | null) ?? null,
        wordCount: (stored.wordCount as number | null) ?? null,
        error: null,
        status: live ? "published" : "ready",
      };
    }
    if (held) {
      const live = servedStatus({ publishedUrl, firstLiveAt, status: row.status }) === "published";
      return {
        ...row,
        // Never the stored title: it is generation's and the team's. This one is the customer's own plan row.
        title: plannedTitle ?? PREPARING_TITLE,
        slug: null,
        wordCount: null,
        error: null,
        status: WORKING.includes(row.status) || row.status === "failed" ? row.status : live ? "published" : "preparing",
      };
    }
    return twoStep && reviewStatus === "approved" && row.status === "draft" && !publishedUrl ? { ...row, status: "ready" } : row;
  });
}

/** Being written right now. */
const WORKING = ["queued", "generating"];

export type ArticleDetail = ArticleRow & {
  bodyHtml: string | null;
  metaDescription: string | null;
  /**
   * The article's illustration. Generated with the article and uploaded to the
   * customer's CMS on publish, but never shown back to them here — so the one
   * part of the article they cannot check before it goes live was the picture.
   */
  imageUrl: string | null;
  imageAlt: string | null;
  /** Regenerations already used, so the UI can say how many remain. */
  imageAttempts: number;
  /** Where the post is on the customer's site, once it has been sent. */
  publishedUrl: string | null;
  /**
   * "publish" or "draft" while waiting for the WordPress plugin to collect
   * it after Publish was pressed; null otherwise.
   */
  publishRequested: string | null;
  /**
   * The two-step flow (lib/publishing/controls.ts): the article is not the
   * customer's to read yet. "writing" while it is first written, "team" while
   * the RepGet team has it. Null otherwise, and always with the flow off.
   */
  preparing: "writing" | "team" | null;
  /**
   * The two-step flow: the team is working on a newer copy, and this is the last
   * approved revision. Publish sends exactly this; the text cannot be changed.
   */
  withTeam: boolean;
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

  const twoStep = await twoStepArticles();
  const working = WORKING.includes(row.status);
  /*
    The team's revision goes no further than this function: a page, a server
    action called by hand and the tab title all get the same empty article.
    A failed one stays failed, so the customer can still try again.
  */
  if (twoStep && heldFromCustomer(row)) {
    const stored = storedRevision(row.approvedRevision);
    if (stored) {
      return {
        id: row.id,
        calendarItemId: row.calendarItemId,
        title: stored.title,
        slug: stored.slug,
        targetKeyword: row.targetKeyword,
        wordCount: stored.wordCount,
        status: servedStatus(row),
        generationStep: null,
        error: null,
        updatedAt: new Date(stored.at),
        bodyHtml: stored.bodyHtml,
        metaDescription: stored.metaDescription,
        imageUrl: stored.imageUrl,
        imageAlt: stored.imageAlt,
        imageAttempts: row.imageAttempts,
        publishedUrl: row.publishedUrl,
        publishRequested: row.publishRequested,
        preparing: null,
        withTeam: true,
      };
    }
    const [planned] = row.calendarItemId
      ? await db.select({ title: calendarItems.title }).from(calendarItems).where(eq(calendarItems.id, row.calendarItemId)).limit(1)
      : [];
    return {
      id: row.id,
      calendarItemId: row.calendarItemId,
      title: planned?.title ?? PREPARING_TITLE,
      slug: null,
      targetKeyword: row.targetKeyword,
      wordCount: null,
      // A post on the website with no text RepGet can show stays what it is there.
      status: working || row.status === "failed" ? row.status : servedStatus(row),
      generationStep: working ? row.generationStep : null,
      error: row.status === "failed" ? row.error : null,
      updatedAt: row.updatedAt,
      bodyHtml: null,
      metaDescription: null,
      imageUrl: null,
      imageAlt: null,
      imageAttempts: 0,
      publishedUrl: row.publishedUrl,
      publishRequested: null,
      preparing: row.status === "failed" ? null : working ? "writing" : "team",
      withTeam: false,
    };
  }

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
    imageUrl: row.imageUrl,
    imageAlt: row.imageAlt,
    imageAttempts: row.imageAttempts,
    publishedUrl: row.publishedUrl,
    publishRequested: row.publishRequested,
    // Nothing written yet: the same waiting page, not an empty editor.
    preparing: twoStep && working && !row.bodyHtml ? "writing" : null,
    withTeam: false,
  };
}

/** Queues generation for a planned calendar item. */
export async function generateFromCalendarItem(
  websiteId: string,
  calendarItemId: string,
): Promise<ActionResult<{ articleId: string }>> {
  const guard = await requireEditor(websiteId);
  if (!guard.ok) return { ok: false, error: guard.error };
  const { site } = guard.context;

  // Billed to the website's owner, whoever pressed the button.
  const result = await queueArticleForCalendarItem(site.id, calendarItemId);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/websites/${site.id}/content`);
  return { ok: true, data: { articleId: result.articleId } };
}

/** Re-runs generation for an article that failed or needs another attempt. */
export async function regenerateArticle(
  websiteId: string,
  articleId: string,
): Promise<ActionResult<null>> {
  const guard = await requireEditor(websiteId);
  if (!guard.ok) return { ok: false, error: guard.error };
  const { site } = guard.context;

  const [article] = await db
    .select({ id: articles.id, calendarItemId: articles.calendarItemId })
    .from(articles)
    .where(and(eq(articles.id, articleId), eq(articles.websiteId, site.id)))
    .limit(1);
  if (!article) return { ok: false, error: "Article not found" };
  if (!article.calendarItemId) {
    return { ok: false, error: "This article has no plan entry to rebuild from" };
  }

  // This exact article, not whichever one a calendar lookup finds first.
  const result = await requeueArticle({
    websiteId: site.id,
    articleId: article.id,
    status: "queued",
  });
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/websites/${site.id}/articles/${articleId}`);
  return { ok: true, data: null };
}

export async function updateArticle(
  websiteId: string,
  articleId: string,
  input: {
    title?: string;
    bodyHtml?: string;
    metaDescription?: string;
    slug?: string;
  },
): Promise<ActionResult<null>> {
  const guard = await requireEditor(websiteId);
  if (!guard.ok) return { ok: false, error: guard.error };
  const { site } = guard.context;

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
  if (typeof input.slug === "string") {
    // Normalised rather than rejected; empty clears it (see normaliseSlug).
    patch.slug = normaliseSlug(input.slug);
  }
  if (typeof input.bodyHtml === "string") {
    /**
     * Sanitised on the way in, not only at generation. This body is editable
     * by the user and later published to their live site, so a script pasted
     * into the editor must not survive the round trip.
     */
    // Links to the site itself stay followed internal links (see sanitize.ts).
    const clean = sanitizeHtml(input.bodyHtml, { siteHosts: siteScope(site).hosts });
    patch.bodyHtml = clean;
    patch.wordCount = countWords(clean);
  }

  /*
    Under the article's row lock, refused while a revision is being sent to
    the website (lib/publishing/dispatch.ts): an edit must either be in what
    is sent, or wait - never race it.
  */
  try {
    await editArticle(articleId, async (tx) => {
      // Read under the lock: an article the team has is theirs until they approve it.
      const [current] = await tx.select().from(articles).where(eq(articles.id, articleId)).limit(1);
      if (current && heldFromCustomer(current) && (await twoStepArticles(tx))) throw new HeldFromCustomerError();
      // Snapshot the PREVIOUS body so an edit is always recoverable.
      if (typeof patch.bodyHtml === "string" && existing.bodyHtml && existing.bodyHtml !== patch.bodyHtml) {
        await tx.insert(articleVersions).values({
          articleId,
          bodyHtml: existing.bodyHtml,
        });
      }
      await tx.update(articles).set(patch).where(eq(articles.id, articleId));
      // Changed after the RepGet team approved it: back to their queue.
      await afterArticleEdit(articleId, tx);
    });
  } catch (error) {
    if (error instanceof ArticleInFlightError || error instanceof HeldFromCustomerError) return { ok: false, error: error.message };
    throw error;
  }

  revalidatePath(`/websites/${site.id}/articles/${articleId}`);
  revalidatePath(`/websites/${site.id}/content`);
  return { ok: true, data: null };
}

export async function deleteArticle(
  websiteId: string,
  articleId: string,
): Promise<ActionResult<null>> {
  const guard = await requireEditor(websiteId);
  if (!guard.ok) return { ok: false, error: guard.error };
  const { site } = guard.context;

  // With what the article's backlinks held, in one transaction (lib/articles/deletion.ts).
  try {
    await deleteArticleAndSettleLinks(site.id, articleId);
  } catch (error) {
    if (error instanceof ArticleInFlightError) return { ok: false, error: error.message };
    throw error;
  }

  revalidatePath(`/websites/${site.id}/content`);
  return { ok: true, data: null };
}
