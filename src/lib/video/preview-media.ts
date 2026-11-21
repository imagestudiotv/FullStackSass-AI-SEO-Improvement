import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import { videoStockAssets } from "@/lib/db/schema";
import type { SceneMedia } from "@/remotion/props";

import type { ShotPlan } from "./formats";
import { AI_HOOK_LIBRARY, aiClipPath, povClipById } from "./footage/ai-library";
import { HOOK_LIBRARY } from "./footage/hook-library";
import { sharedFileUrl } from "./storage";

/**
 * The clip an idea's preview plays before the video is made (client,
 * 2026-11-21: "I don't see this new viral videos on the dashboard"): a POV
 * clip video's AI clip, or the hook clip picked when the idea was written -
 * the same clip the video is then made with. A Pixabay pick shows once
 * RepGet has stored that file (any earlier video used it); otherwise the
 * preview keeps its placeholder.
 */

export type StoredClip = { url: string; durationMs: number | null };

/** Pure: the preview's scene 0 for a plan, from the AI clips' addresses and the stored Pixabay files. */
export function previewClip(plan: ShotPlan | null | undefined, aiUrl: (id: string) => string, pixabay: ReadonlyMap<string, StoredClip>): SceneMedia | null {
  if (!plan) return null;
  if (plan.povClip) {
    const clip = povClipById(plan.povClip.id);
    return clip ? { url: aiUrl(clip.id), kind: "video", source: "stock", durationMs: clip.durationMs } : null;
  }
  const pick = plan.hookClip?.pick;
  if (!pick) return null;
  if (pick.provider === "ai") {
    const clip = AI_HOOK_LIBRARY.find((entry) => entry.id === pick.id);
    return clip ? { url: aiUrl(clip.id), kind: "video", source: "stock", durationMs: clip.durationMs, climaxMs: clip.climaxMs } : null;
  }
  const clip = HOOK_LIBRARY.find((entry) => entry.id === pick.id);
  const stored = pixabay.get(pick.id);
  if (!clip || !stored) return null;
  return { url: stored.url, kind: "video", source: "stock", durationMs: stored.durationMs, climaxMs: clip.climaxMs, ...(typeof clip.focalX === "number" ? { focalX: clip.focalX } : {}) };
}

/** Each plan's preview clip (null = none), with one lookup for the Pixabay files. */
export async function previewClips(plans: (ShotPlan | null | undefined)[]): Promise<(SceneMedia | null)[]> {
  const ids = [...new Set(plans.flatMap((plan) => (plan?.hookClip?.pick?.provider === "pixabay" && !plan.povClip ? [plan.hookClip.pick.id] : [])))];
  const pixabay = new Map<string, StoredClip>();
  if (ids.length > 0) {
    const rows = await db
      .select({ providerId: videoStockAssets.providerId, url: videoStockAssets.url, durationMs: videoStockAssets.durationMs })
      .from(videoStockAssets)
      .where(and(eq(videoStockAssets.provider, "pixabay"), eq(videoStockAssets.kind, "video"), inArray(videoStockAssets.providerId, ids)));
    for (const row of rows) pixabay.set(row.providerId, { url: row.url, durationMs: row.durationMs });
  }
  const aiUrl = (id: string) => sharedFileUrl(aiClipPath(id));
  return plans.map((plan) => previewClip(plan, aiUrl, pixabay));
}
