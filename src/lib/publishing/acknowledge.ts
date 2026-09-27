import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { articles, publicationDispatches, publishLogs } from "@/lib/db/schema";
import { hasNewerDispatch, UNACKNOWLEDGED } from "@/lib/publishing/dispatch";

/**
 * A WordPress plugin's report on a hand-over (POST /api/plugin/published),
 * settled against EXACTLY the dispatch it answers.
 *
 * This used to settle "the article's in-flight plugin dispatch", whatever
 * that was by then. When hand-over A timed out and revision B was handed out,
 * A's delayed report settled B - B was recorded as delivered without ever
 * being reported - and a late failure could fail an article whose newer
 * revision had gone live. A repeated report wrote the log, the notification
 * and the first-article follow-up again.
 *
 * NOW, in one transaction holding the article's row lock (the lock claims
 * take):
 *   - a 1.6.0+ plugin names the dispatch; an older one names only the
 *     article, and since the feed never has two revisions outstanding for an
 *     older plugin (lib/publishing/dispatch.ts), its report settles that one
 *     outstanding hand-over;
 *   - a dispatch already settled is a DUPLICATE: nothing is written again;
 *   - a report for a dispatch that has a NEWER dispatch is LATE: it is
 *     recorded on its own row and log (history), but does not touch the
 *     article's current state, clear a newer Publish press, notify or
 *     continue anything. What it proves about the past is kept: a late
 *     report of a live post sets the first-live date if none was known;
 *   - the article records what the CMS actually stored (a 1.6.0+ plugin
 *     reports get_post_status; an older one reports the status it was asked
 *     for). Only a post stored as "publish" makes the article published.
 *
 * A report with no dispatch for a post already delivered, at a NEW address,
 * is the plugin saying it MOVED the post (a content-type change, 1.5.0+):
 * only the address is updated - it is not a delivery, so nothing is logged
 * or announced.
 *
 * Side effects outside the database (notification, backlink promotion, the
 * first-article follow-up) are returned for the caller to run once, after
 * commit, and only for the report that applied.
 */

export type PluginReport =
  | { kind: "sent"; remoteId: string | null; remoteUrl: string | null; remoteStatus: string }
  | { kind: "failed"; error: string };

export type Acknowledgement =
  | { result: "unknown_article" }
  | { result: "unknown_dispatch" }
  | { result: "duplicate"; dispatchId: string | null }
  | { result: "moved"; article: { id: string; title: string }; remoteUrl: string; live: boolean }
  | {
      result: "applied" | "late";
      dispatchId: string | null;
      article: { id: string; title: string };
      report: PluginReport;
      /** The article became live with this report (first time or again). */
      live: boolean;
    };

const LEGACY = or(eq(publicationDispatches.protocol, "plugin_legacy"), isNull(publicationDispatches.protocol));

export async function acknowledgePluginDispatch(input: {
  websiteId: string;
  articleId: string;
  /** Echoed by 1.6.0+; absent from older plugins. */
  dispatchId: string | null;
  report: PluginReport;
}): Promise<Acknowledgement> {
  return db.transaction(async (tx) => {
    const [article] = await tx
      .select({ id: articles.id, title: articles.title, publishRequested: articles.publishRequested, status: articles.status, publishedUrl: articles.publishedUrl })
      .from(articles)
      .where(and(eq(articles.id, input.articleId), eq(articles.websiteId, input.websiteId)))
      .for("update")
      .limit(1);
    if (!article) return { result: "unknown_article" } as const;

    const open = [...UNACKNOWLEDGED, "in_flight", "released"];
    let dispatch: typeof publicationDispatches.$inferSelect | undefined;
    if (input.dispatchId) {
      [dispatch] = await tx
        .select()
        .from(publicationDispatches)
        .where(
          and(
            eq(publicationDispatches.id, input.dispatchId),
            eq(publicationDispatches.articleId, article.id),
            eq(publicationDispatches.channel, "plugin"),
          ),
        )
        .for("update")
        .limit(1);
      if (!dispatch) return { result: "unknown_dispatch" } as const;
    } else {
      // An older plugin: the one outstanding legacy hand-over of this article.
      [dispatch] = await tx
        .select()
        .from(publicationDispatches)
        .where(and(eq(publicationDispatches.articleId, article.id), eq(publicationDispatches.channel, "plugin"), LEGACY, inArray(publicationDispatches.status, open)))
        .orderBy(desc(publicationDispatches.claimedAt))
        .for("update")
        .limit(1);
      if (!dispatch) {
        const [settled] = await tx
          .select({ id: publicationDispatches.id })
          .from(publicationDispatches)
          .where(and(eq(publicationDispatches.articleId, article.id), eq(publicationDispatches.channel, "plugin"), LEGACY))
          .limit(1);
        const moved = await movedPost(tx, article, input.report);
        if (moved) return moved;
        // Every legacy hand-over is settled: this repeats a report already recorded.
        if (settled) return { result: "duplicate", dispatchId: null } as const;
        // A hand-over from before dispatches were recorded (migration 0044).
        return applyUndispatched(tx, article, input.report);
      }
    }

    if (!open.includes(dispatch.status)) return { result: "duplicate", dispatchId: dispatch.id } as const;

    const late = await hasNewerDispatch(tx, dispatch);
    const now = new Date();
    const report = input.report;
    await tx
      .update(publicationDispatches)
      .set(
        report.kind === "sent"
          ? { status: "sent", remoteId: report.remoteId, remoteUrl: report.remoteUrl, remoteStatus: report.remoteStatus, late, completedAt: now }
          : { status: "failed", error: report.error.slice(0, 500), late, completedAt: now },
      )
      .where(eq(publicationDispatches.id, dispatch.id));

    await tx
      .insert(publishLogs)
      .values(
        report.kind === "sent"
          ? { articleId: article.id, dispatchId: dispatch.id, status: "published", remoteId: report.remoteId, remoteUrl: report.remoteUrl, remoteStatus: report.remoteStatus }
          : { articleId: article.id, dispatchId: dispatch.id, status: "failed", error: report.error.slice(0, 500) },
      )
      .onConflictDoNothing();

    const live = report.kind === "sent" && report.remoteStatus === "publish";
    if (late) {
      // History only - except the fact that the post was live at this time.
      if (live) {
        await tx.update(articles).set({ firstLiveAt: now }).where(and(eq(articles.id, article.id), isNull(articles.firstLiveAt)));
      }
      return { result: "late", dispatchId: dispatch.id, article, report, live } as const;
    }

    const snapshot = (dispatch.requestSnapshot ?? {}) as { publishRequested?: string | null };
    // A Publish press made AFTER this hand-over was claimed is not answered by it.
    const pressAnswered =
      snapshot.publishRequested === undefined || (article.publishRequested ?? null) === (snapshot.publishRequested ?? null);
    if (report.kind === "sent") {
      await tx
        .update(articles)
        .set({
          status: live ? "published" : "draft",
          publishedUrl: report.remoteUrl,
          ...(pressAnswered ? { publishRequested: null } : {}),
          firstLiveAt: live ? sql`coalesce(${articles.firstLiveAt}, ${now.toISOString()}::timestamp)` : sql`${articles.firstLiveAt}`,
          error: null,
          updatedAt: now,
        })
        .where(eq(articles.id, article.id));
    } else {
      await tx.update(articles).set({ error: report.error.slice(0, 500), updatedAt: now }).where(eq(articles.id, article.id));
    }
    return { result: "applied", dispatchId: dispatch.id, article, report, live } as const;
  });
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * The plugin moved a post RepGet already delivered: same post id as the
 * latest delivery, new address. Updates the address only.
 */
async function movedPost(
  tx: Tx,
  article: { id: string; title: string; status: string; publishedUrl: string | null },
  report: PluginReport,
): Promise<Acknowledgement | null> {
  if (report.kind !== "sent" || !report.remoteId || !report.remoteUrl || report.remoteUrl === article.publishedUrl) return null;
  const [latest] = await tx
    .select({ remoteId: publishLogs.remoteId })
    .from(publishLogs)
    .where(and(eq(publishLogs.articleId, article.id), eq(publishLogs.status, "published")))
    .orderBy(desc(publishLogs.createdAt))
    .limit(1);
  if (!latest || latest.remoteId !== report.remoteId) return null;
  await tx.update(articles).set({ publishedUrl: report.remoteUrl, updatedAt: new Date() }).where(eq(articles.id, article.id));
  return { result: "moved", article, remoteUrl: report.remoteUrl, live: article.status === "published" };
}

/**
 * A report for a hand-over made before dispatches were recorded. Nothing
 * identifies it, so it is applied as before - once: the same post reported
 * again for an article already recorded with it is a duplicate.
 */
async function applyUndispatched(
  tx: Tx,
  article: { id: string; title: string; status: string; publishedUrl: string | null },
  report: PluginReport,
): Promise<Acknowledgement> {
  const now = new Date();
  if (report.kind === "sent") {
    const [seen] = await tx
      .select({ id: publishLogs.id })
      .from(publishLogs)
      .where(
        and(
          eq(publishLogs.articleId, article.id),
          eq(publishLogs.status, "published"),
          report.remoteId === null ? isNull(publishLogs.remoteId) : eq(publishLogs.remoteId, report.remoteId),
          report.remoteUrl === null ? isNull(publishLogs.remoteUrl) : eq(publishLogs.remoteUrl, report.remoteUrl),
        ),
      )
      .limit(1);
    if (seen) return { result: "duplicate", dispatchId: null };
    await tx.insert(publishLogs).values({ articleId: article.id, status: "published", remoteId: report.remoteId, remoteUrl: report.remoteUrl, remoteStatus: report.remoteStatus });
    const live = report.remoteStatus === "publish";
    await tx
      .update(articles)
      .set({
        status: live ? "published" : "draft",
        publishedUrl: report.remoteUrl,
        publishRequested: null,
        firstLiveAt: live ? sql`coalesce(${articles.firstLiveAt}, ${now.toISOString()}::timestamp)` : sql`${articles.firstLiveAt}`,
        error: null,
        updatedAt: now,
      })
      .where(eq(articles.id, article.id));
    return { result: "applied", dispatchId: null, article, report, live };
  }
  await tx.insert(publishLogs).values({ articleId: article.id, status: "failed", error: report.error.slice(0, 500) });
  await tx.update(articles).set({ error: report.error.slice(0, 500), updatedAt: now }).where(eq(articles.id, article.id));
  return { result: "applied", dispatchId: null, article, report, live: false };
}
