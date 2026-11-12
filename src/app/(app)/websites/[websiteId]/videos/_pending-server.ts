import "server-only";

import { and, eq, gt, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { brandVoice, socialAccounts, videoIdeaBatches, videoIdeas, websites } from "@/lib/db/schema";
import type { VideoResult } from "@/lib/video/actions";
import { DAILY_BATCH_SIZE, EXTRA_BATCHES_PER_DAY, TONE_PRESETS, type TonePreset } from "@/lib/video/formats";
import { readVideoSettings } from "@/lib/video/settings";

import type { VideoPublishingStatus } from "./_pending";

/**
 * TODO(viral-integration): server-only stand-ins for the readers Workers A
 * and D are writing, read straight from the contract's tables so the page
 * shows real numbers meanwhile. Each is replaced by the import named beside
 * it, and this file deleted.
 */

export type IdeaAllowance = { dailyWritten: number; extraUsed: number; extraLeft: number; busy: boolean; nextAllowedAt: Date | null };

/** Real: `ideaAllowance(websiteId, now)` from "@/lib/video/batches". */
export async function ideaAllowance(websiteId: string, now: Date): Promise<IdeaAllowance> {
  const day = now.toISOString().slice(0, 10);
  const [[written], batches] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(videoIdeas)
      .where(and(eq(videoIdeas.websiteId, websiteId), eq(videoIdeas.day, day))),
    db
      .select({ slot: videoIdeaBatches.slot, status: videoIdeaBatches.status })
      .from(videoIdeaBatches)
      .where(and(eq(videoIdeaBatches.websiteId, websiteId), eq(videoIdeaBatches.day, day), gt(videoIdeaBatches.slot, 0))),
  ]);
  const extraUsed = batches.length;
  return {
    dailyWritten: Math.min(Number(written?.n ?? 0), DAILY_BATCH_SIZE),
    extraUsed,
    extraLeft: Math.max(0, EXTRA_BATCHES_PER_DAY - extraUsed),
    busy: batches.some((batch) => batch.status === "reserved" || batch.status === "writing"),
    nextAllowedAt: null,
  };
}

export type VideoProfile = {
  targetAudience: string;
  language: string;
  country: string;
  tone: string;
  avoid: string;
  priorityTopics: string;
  tonePreset: TonePreset;
};

/** Real: `videoProfile(websiteId)` from A's profile reader (websites + brand_voice + the two video fields). */
export async function videoProfile(websiteId: string): Promise<VideoProfile> {
  const [[site], [voice], settings] = await Promise.all([
    db.select({ targetAudience: websites.targetAudience, language: websites.language, country: websites.country }).from(websites).where(eq(websites.id, websiteId)),
    db.select({ tone: brandVoice.tone, avoid: brandVoice.avoid }).from(brandVoice).where(eq(brandVoice.websiteId, websiteId)),
    readVideoSettings(websiteId),
  ]);
  return {
    targetAudience: site?.targetAudience ?? "",
    language: site?.language ?? "",
    country: site?.country ?? "",
    tone: voice?.tone ?? "",
    avoid: voice?.avoid ?? "",
    priorityTopics: settings.priorityTopics ?? "",
    tonePreset: (TONE_PRESETS as readonly string[]).includes(settings.tonePreset) ? settings.tonePreset : "professional",
  };
}

/** Real: `reviewBlocksAutoPublish(idea)` from "@/lib/video/review" (also compares the content hash). */
export function reviewBlocksAutoPublish(idea: { reviewStatus: string }): boolean {
  return idea.reviewStatus === "required";
}

/**
 * Real: `videoPublishingStatus(websiteId)` from "@/lib/video/publish-actions"
 * (feature/viral-publishing). Until then X is never offered and Instagram's
 * own audio reads as not set up; LinkedIn's connection is read as it is.
 */
export async function videoPublishingStatus(websiteId: string): Promise<VideoResult<VideoPublishingStatus>> {
  const [linkedin] = await db
    .select({ bundle: socialAccounts.bundleAccountId, target: socialAccounts.target })
    .from(socialAccounts)
    .where(and(eq(socialAccounts.websiteId, websiteId), eq(socialAccounts.platform, "linkedin")));
  return {
    ok: true,
    data: {
      x: { available: false, reason: "disabled" },
      instagramAudio: { available: false, reason: "not_configured" },
      linkedin: { connected: Boolean(linkedin?.bundle), target: linkedin?.bundle ? (linkedin.target ?? null) : null },
    },
  };
}
