import "server-only";

import { and, eq, like, ne, or, sql } from "drizzle-orm";

import { refundSpend } from "@/lib/credits/spend";
import { db } from "@/lib/db";
import { videoIdeas, videoMedia } from "@/lib/db/schema";

import { releaseScheduleSlot } from "./schedule";
import { readVideoSettings } from "./settings";
import { deleteVideoFiles, deleteVideoFolder, videoFilePath } from "./storage";

/**
 * Deleting a video or idea (Daniel, 2026-11-24: "a option for clients to
 * delete the video they want, in order to having their dashboard clean").
 *
 * The row stays, as status "deleted" (no migration), so that nothing is
 * counted wrongly: the day's twenty and the extra batches count rows, so a
 * deleted idea is never written again; its title keeps out repeats; a posted
 * one still counts towards the platform's posts of the day. Every list, job
 * and number that picks rows by status leaves it out (the follow-up's stats
 * and milestone emails, the reports, learning).
 *
 * By status, decided under the row's lock - the same lock or status
 * condition the make and publish jobs claim and finish with:
 *  - new, skipped, failed: gone;
 *  - approved (its job has not started): gone, and its credit returned;
 *  - making: the job stops at its next step; the credit is not returned (the
 *    work was started) and a render that ends meanwhile is thrown away
 *    (finishMaking);
 *  - ready, draft: gone, files removed, no refund (it was made);
 *  - scheduled: taken off the schedule (the publish job finds nothing due);
 *  - posting: refused ("busy") while the publish job is at work on it;
 *  - posted: removed from RepGet only - it stays on the platforms.
 *
 * Files: the idea's own folder (voice, video, slides, cover, its AI
 * pictures), and pictures or clips uploaded for it alone. The shared
 * footage, RepGet's AI clips, the customer's media library, the logo, and
 * anything another idea uses stay. What cannot be removed now is removed by
 * the daily job (followup.ts deleteOldFiles).
 */

export type DeleteOutcome = "deleted" | "busy" | "not_found";

type Idea = typeof videoIdeas.$inferSelect;

/** The publish job follows a post for half an hour; a "posting" this old has no job on it any more. */
export const STALE_POSTING_MS = 2 * 60 * 60 * 1000;

export async function deleteVideo(websiteId: string, id: string, now: Date = new Date()): Promise<DeleteOutcome> {
  const result = await db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(videoIdeas)
      .where(and(eq(videoIdeas.id, id), eq(videoIdeas.websiteId, websiteId)))
      .for("update");
    if (!row) return { outcome: "not_found" as const, row: null };
    if (row.status === "deleted") return { outcome: "deleted" as const, row: null };
    if (row.status === "posting" && now.getTime() - row.updatedAt.getTime() < STALE_POSTING_MS) return { outcome: "busy" as const, row: null };
    const unstarted = row.status === "approved";
    if (unstarted && row.creditSpendKey) await refundSpend(row.creditSpendKey, tx, now);
    // A video that is out keeps its hour on the calendar (it was posted then); one that only waited gives it back.
    const out = row.status === "posted" || row.status === "posting";
    if (!out) await releaseScheduleSlot(id, tx);
    await tx
      .update(videoIdeas)
      .set({
        status: "deleted",
        updatedAt: now,
        ...(out ? {} : { scheduledFor: null }),
        // Not made after all: it does not count among the day's makes.
        ...(unstarted ? { approvedAt: null, approvedBy: null, approvedVia: null } : {}),
      })
      .where(eq(videoIdeas.id, id));
    return { outcome: "deleted" as const, row };
  });
  if (result.row) {
    const gone = await removeIdeaFiles(result.row).catch((error) => {
      console.error("[video] a deleted video's files were not removed", { id, error });
      return false;
    });
    // While its job may still be storing files, the daily sweep has the last word.
    if (gone && result.row.status !== "making") {
      await db
        .update(videoIdeas)
        .set({ filesDeletedAt: now })
        .where(and(eq(videoIdeas.id, id), eq(videoIdeas.status, "deleted")));
    }
  }
  return result.outcome;
}

type Files = Pick<Idea, "id" | "websiteId" | "media" | "videoUrl" | "altVideoUrl" | "voiceUrl" | "coverUrl" | "slideUrls" | "assets">;

/** Removes a deleted idea's files from storage (see above for what stays). Whether storage took it. */
export async function removeIdeaFiles(row: Files): Promise<boolean> {
  const folder = `ideas/${row.id}`;
  const own = [
    row.videoUrl,
    row.altVideoUrl,
    row.voiceUrl,
    row.coverUrl,
    ...(row.slideUrls ?? []),
    ...(row.media ?? []).map((item) => item.url),
    // Only its own AI pictures are in this website's folder; stock and AI clips are shared files (videoFilePath says null).
    ...(row.assets ?? []).map((asset) => (typeof asset.url === "string" ? asset.url : null)),
  ].filter((url): url is string => Boolean(url && videoFilePath(url, row.websiteId)));
  const keep = await usedElsewhere(row, own, folder);
  const keptPaths = new Set([...keep].flatMap((url) => videoFilePath(url, row.websiteId) ?? []));
  const folderGone = await deleteVideoFolder(row.websiteId, folder, keptPaths);
  const filesGone = await deleteVideoFiles(
    row.websiteId,
    own.filter((url) => !keep.has(url)),
  );
  return folderGone && filesGone;
}

/** Which of the files are in the customer's library, the logo, or used by another idea of the website. */
async function usedElsewhere(row: Pick<Idea, "id" | "websiteId">, urls: string[], folder: string): Promise<Set<string>> {
  const media = `%/${row.websiteId}/media/%`;
  const [library, settings, others] = await Promise.all([
    db.select({ url: videoMedia.url }).from(videoMedia).where(eq(videoMedia.websiteId, row.websiteId)),
    readVideoSettings(row.websiteId),
    db
      .select({ media: videoIdeas.media, assets: videoIdeas.assets })
      .from(videoIdeas)
      .where(
        and(
          eq(videoIdeas.websiteId, row.websiteId),
          ne(videoIdeas.id, row.id),
          ne(videoIdeas.status, "deleted"),
          or(
            like(sql`${videoIdeas.media}::text`, `%/${folder}/%`),
            like(sql`${videoIdeas.assets}::text`, `%/${folder}/%`),
            like(sql`${videoIdeas.media}::text`, media),
            like(sql`${videoIdeas.assets}::text`, media),
          ),
        ),
      ),
  ]);
  const used = new Set<string>(library.map((item) => item.url));
  if (settings.logoUrl) used.add(settings.logoUrl);
  for (const other of others) {
    for (const item of other.media ?? []) used.add(item.url);
    for (const asset of other.assets ?? []) if (typeof asset.url === "string") used.add(asset.url);
  }
  return new Set([...used].filter((url) => urls.includes(url) || url.includes(`/${folder}/`)));
}
