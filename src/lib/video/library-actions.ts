"use server";

import { and, eq, notInArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { videoIdeas } from "@/lib/db/schema";
import { requireEditor } from "@/lib/websites/require-editor";

import { deleteVideo } from "./delete";
import { cleanTags, YOUTUBE_TAGS_KEY } from "./youtube-tags";

/**
 * Keeping the Social Content page tidy (Daniel, 2026-11-24): deleting videos
 * (lib/video/delete.ts) and a Short's tags. An editor of the website, and no
 * plan needed: a customer whose plan ended may still clean up.
 */

export type LibraryResult<D> = { ok: true; data: D } | { ok: false; error: "view_only" | "not_found" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** More than the page ever lists (Saved Videos and Posted show 40 each). */
const MAX_AT_ONCE = 100;

const pagePath = (websiteId: string) => `/websites/${websiteId}/videos`;

/** Deletes one or several videos: which are gone, and how many are being published right now and stayed. */
export async function deleteVideoIdeas(websiteId: string, ids: string[]): Promise<LibraryResult<{ deleted: string[]; busy: number }>> {
  const editor = await requireEditor(websiteId);
  if (!editor.ok) return { ok: false, error: "view_only" };
  const wanted = [...new Set(Array.isArray(ids) ? ids : [])].filter((id) => typeof id === "string" && UUID.test(id)).slice(0, MAX_AT_ONCE);
  const deleted: string[] = [];
  let busy = 0;
  // One at a time, each in its own short transaction: a lock is never held on many rows.
  for (const id of wanted) {
    const outcome = await deleteVideo(websiteId, id);
    if (outcome === "deleted") deleted.push(id);
    else if (outcome === "busy") busy += 1;
  }
  if (deleted.length === 0 && busy === 0) return { ok: false, error: "not_found" };
  revalidatePath(pagePath(websiteId));
  return { ok: true, data: { deleted, busy } };
}

/**
 * Saves a YouTube Short's tags with its idea, cleaned and within YouTube's
 * limit. One key of the jsonb in one statement, so nothing else in it moves
 * and no job's write is lost.
 */
export async function saveYoutubeTags(websiteId: string, id: string, text: string): Promise<LibraryResult<{ tags: string }>> {
  const editor = await requireEditor(websiteId);
  if (!editor.ok) return { ok: false, error: "view_only" };
  if (typeof id !== "string" || !UUID.test(id) || typeof text !== "string") return { ok: false, error: "not_found" };
  const tags = cleanTags(text.slice(0, 5000));
  const saved = await db
    .update(videoIdeas)
    // updatedAt stays: it says when the video itself last moved (the claims' stale checks and the lists read it).
    .set({ overrides: sql`${videoIdeas.overrides} || jsonb_build_object(${YOUTUBE_TAGS_KEY}::text, ${tags}::text)`, updatedAt: sql`${videoIdeas.updatedAt}` })
    .where(and(eq(videoIdeas.id, id), eq(videoIdeas.websiteId, websiteId), notInArray(videoIdeas.status, ["deleted", "skipped"])))
    .returning({ id: videoIdeas.id });
  if (saved.length === 0) return { ok: false, error: "not_found" };
  revalidatePath(pagePath(websiteId));
  return { ok: true, data: { tags } };
}
