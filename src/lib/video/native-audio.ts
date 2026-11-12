import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { socialAccounts, socialTeams } from "@/lib/db/schema";
import { BundleError, instagramAudio, isBundleConfigured, type InstagramAudio } from "@/lib/social/bundle";

import type { NativeAudioSelection, VideoFormat, VideoPlatform } from "./formats";

/**
 * Instagram's own music on Reels (client, 2026-11-12: "investigate Meta's
 * Instagram Audio API introduced in June 2026 ... attaching certain
 * authorized audio tracks to Reels through Facebook Login").
 *
 * Through bundle.social (https://info.bundle.social/api-reference/platforms/instagram-music.md):
 *  - search: GET /misc/instagram/audio?teamId&audioType=music&searchQuery (max 100 characters);
 *  - attach: data.INSTAGRAM.musicSoundInfo = { musicSoundId, musicSoundVolume 0-100,
 *    videoOriginalSoundVolume 0-100 }, both volumes defaulting to 100;
 *  - only on an Instagram REEL (not a feed post, carousel or Story), and only
 *    for an account connected through Facebook Login - Instagram's own login
 *    gets a 400.
 * The search returns no trending data, so no track is ever called trending.
 *
 * The Reel sent to Instagram with a native track is the version without
 * RepGet's music (video_ideas.alt_video_url, lib/video/make.ts), so the two
 * never play over each other; every other platform and the download keep
 * RepGet's licensed music. The final mix is made by Instagram: RepGet cannot
 * preview it.
 */

export const NATIVE_VOLUME = { min: 0, max: 100, default: 100 } as const;

/** Why native Instagram music cannot be used. */
export type NativeAudioUnavailable =
  /** bundle.social is not set up. */
  | "not_configured"
  /** No Instagram account is connected (or it is paused). */
  | "not_connected"
  /** Connected with Instagram's own login: reconnect Instagram through Facebook Login. */
  | "needs_facebook_login";

export type NativeAudioEligibility = { available: true } | { available: false; reason: NativeAudioUnavailable };

/** Whether native music applies to a destination at all: Instagram Reels only. */
export function nativeAudioApplies(platform: VideoPlatform, format: VideoFormat): boolean {
  return platform === "instagram" && format === "reel";
}

const volume = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return Number.NaN;
  return Math.round(n);
};

/**
 * A selection as submitted or stored, checked: an audio id, a title, and
 * volumes within 0-100 (null: Instagram's default). Never marked trending:
 * the provider gives no trending data. null when it does not hold.
 */
export function cleanNativeAudio(input: unknown, now: Date = new Date()): NativeAudioSelection | null {
  if (!input || typeof input !== "object") return null;
  const item = input as Record<string, unknown>;
  const audioId = typeof item.audioId === "string" || typeof item.audioId === "number" ? String(item.audioId).trim() : "";
  if (!/^[A-Za-z0-9_:-]{1,64}$/.test(audioId)) return null;
  const level = volume(item.volume);
  const original = volume(item.originalVolume);
  for (const value of [level, original]) {
    if (value !== null && (Number.isNaN(value) || value < NATIVE_VOLUME.min || value > NATIVE_VOLUME.max)) return null;
  }
  const text = (value: unknown, max: number) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "");
  return {
    provider: "instagram",
    audioId,
    title: text(item.title, 200) || "Instagram audio",
    artist: text(item.artist, 200) || null,
    volume: level,
    originalVolume: original,
    trending: false,
    selectedAt: typeof item.selectedAt === "string" && !Number.isNaN(Date.parse(item.selectedAt)) ? item.selectedAt : now.toISOString(),
  };
}

/** The stored selection (video_ideas.native_audio), or null. */
export const readNativeAudio = (raw: unknown): NativeAudioSelection | null => cleanNativeAudio(raw);

/** bundle.social's musicSoundInfo for an Instagram Reel. */
export function musicSoundInfo(selection: NativeAudioSelection): Record<string, unknown> {
  return {
    musicSoundId: selection.audioId,
    ...(selection.volume !== null ? { musicSoundVolume: selection.volume } : {}),
    ...(selection.originalVolume !== null ? { videoOriginalSoundVolume: selection.originalVolume } : {}),
  };
}

/** Whether the website's Instagram can use native music, from its stored connection (social_accounts.target, lib/social/accounts.ts). */
export async function instagramAudioEligibility(websiteId: string): Promise<NativeAudioEligibility> {
  if (!isBundleConfigured()) return { available: false, reason: "not_configured" };
  const [account] = await db
    .select()
    .from(socialAccounts)
    .where(and(eq(socialAccounts.websiteId, websiteId), eq(socialAccounts.platform, "instagram")));
  if (!account?.bundleAccountId || account.pausedAt) return { available: false, reason: "not_connected" };
  if (account.target !== "facebook_login") return { available: false, reason: "needs_facebook_login" };
  return { available: true };
}

export type AudioSearch = { ok: true; tracks: InstagramAudio[] } | { ok: false; reason: NativeAudioUnavailable | "search_failed" };

/**
 * Instagram's permitted tracks for the website's account. A 400 from the
 * provider means the account is not on Facebook Login after all (it changed
 * on bundle.social): said as such, so the customer reconnects.
 */
export async function searchNativeAudio(websiteId: string, query: string): Promise<AudioSearch> {
  const eligibility = await instagramAudioEligibility(websiteId);
  if (!eligibility.available) return { ok: false, reason: eligibility.reason };
  const [team] = await db.select().from(socialTeams).where(eq(socialTeams.websiteId, websiteId));
  if (!team) return { ok: false, reason: "not_connected" };
  try {
    return { ok: true, tracks: (await instagramAudio(team.teamId, query)).slice(0, 30) };
  } catch (error) {
    if (error instanceof BundleError && error.status === 400) return { ok: false, reason: "needs_facebook_login" };
    console.error("[video] Instagram audio search failed", { websiteId, error });
    return { ok: false, reason: "search_failed" };
  }
}

/** Whether a refusal from Instagram is about the chosen native track (then the account is not paused: the customer picks another). */
export const isAudioRefusal = (message: string) => /audio|music|sound/i.test(message);
