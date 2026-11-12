/**
 * TODO(viral-integration): thin stand-ins for Worker D's publishing actions
 * and client-safe helper (feature/viral-publishing, 176065bc), with the same
 * names and signatures. Nothing here is billable or posts anything: the
 * actions not yet available answer "not_configured". At integration each
 * export is replaced by an import from its real module (named beside it)
 * and this file is deleted. Worker A's stand-ins were swapped on 2026-11-12.
 */

import { connectVideoPlatform as connectNow, type VideoResult } from "@/lib/video/actions";
import { DURATION_SECONDS, isVideoPlatform, VIDEO_PLATFORM_SPECS, type DurationRange, type NativeAudioSelection, type VideoFormat, type VideoPlatform } from "@/lib/video/formats";

type Pending<T = null> = Promise<VideoResult<T>>;
const notReady = async <T>(): Pending<T> => ({ ok: false, error: "not_configured" });

/* ------------------------------------- Worker D: lib/video/publish-actions.ts */
/* Mirrors feature/viral-publishing (176065bc) so the swap is an import change. */

/** Real: `InstagramAudio` from "@/lib/social/bundle". */
export type InstagramAudio = { audioId: string; title: string; artist: string | null; durationMs: number | null; coverUrl: string | null; previewUrl: string | null };
/** Real: `NativeAudioUnavailable` from "@/lib/video/native-audio". */
export type NativeAudioUnavailable = "not_configured" | "not_connected" | "needs_facebook_login";
/** Real: `XUnavailable` from "@/lib/video/x-spend". */
export type XUnavailable = "disabled" | "no_limit" | "limit_reached";
/** Real: `VideoPublishingStatus` from "@/lib/video/publish-actions". */
export type VideoPublishingStatus = {
  x: { available: boolean; reason: XUnavailable | null };
  instagramAudio: { available: true } | { available: false; reason: NativeAudioUnavailable };
  linkedin: { connected: boolean; target: string | null };
};

/** Real: `searchInstagramAudio` from "@/lib/video/publish-actions" (errors: NativeAudioUnavailable | search_failed). */
export function searchInstagramAudio(websiteId: string, query: string): Pending<{ tracks: InstagramAudio[] }> {
  void websiteId;
  void query;
  return notReady();
}

/** Real: `setNativeAudio` from "@/lib/video/publish-actions" (null removes it). */
export function setNativeAudio(websiteId: string, ideaId: string, selection: Partial<NativeAudioSelection> | null): Pending<{ nativeAudio: NativeAudioSelection | null }> {
  void websiteId;
  void ideaId;
  void selection;
  return notReady();
}

/** Real: `connectVideoPlatform` from "@/lib/video/publish-actions" (facebookLogin: Instagram through Facebook Login). */
export function connectVideoPlatform(websiteId: string, platform: string, language = "en", options: { facebookLogin?: boolean } = {}): Pending<{ url: string }> {
  void options;
  return connectNow(websiteId, platform, language);
}

/* ----------------------------------------- Worker D: lib/video/destinations.ts */

/** Real: `DestinationProblem` from "@/lib/video/destinations". */
export type DestinationProblem = "no_story" | "no_carousel" | "too_long" | "too_short" | "x_not_configured";
export type Compatibility = { ok: VideoPlatform[]; problems: Partial<Record<VideoPlatform, DestinationProblem>> };

/**
 * Real: `compatibility` from "@/lib/video/destinations" (pure, client-safe).
 * The same rules, on the same platform specs, until the swap.
 */
export function compatibility(input: { format: VideoFormat; duration: number | DurationRange | null; platforms: readonly string[]; xAvailable?: boolean }): Compatibility {
  const ok: VideoPlatform[] = [];
  const problems: Compatibility["problems"] = {};
  const length = input.duration === null ? null : typeof input.duration === "number" ? input.duration : (DURATION_SECONDS[input.duration]?.max ?? null);
  for (const platform of [...new Set(input.platforms)].filter(isVideoPlatform)) {
    const spec = VIDEO_PLATFORM_SPECS[platform];
    let problem: DestinationProblem | null = null;
    if (platform === "x" && !input.xAvailable) problem = "x_not_configured";
    else if (input.format === "carousel") problem = spec.carousel ? null : "no_carousel";
    else if (input.format === "story") {
      if (!spec.story || spec.storyMaxSeconds === null) problem = "no_story";
      else if (length !== null && length > spec.storyMaxSeconds) problem = "too_long";
      else if (typeof input.duration === "number" && length !== null && length < 3) problem = "too_short";
    } else if (length !== null && length > spec.maxVideoSeconds) problem = "too_long";
    if (problem) problems[platform] = problem;
    else ok.push(platform);
  }
  return { ok, problems };
}
