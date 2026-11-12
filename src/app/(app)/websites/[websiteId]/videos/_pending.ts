/**
 * TODO(viral-integration): thin stand-ins for the server actions and the
 * client-safe helper Workers A and D are writing (names and signatures as
 * agreed, 2026-11-12). Nothing here is billable or posts anything: the not
 * yet available actions answer "not_configured". At integration each export
 * is replaced by an import from its real module (listed beside it) and this
 * file is deleted.
 */

import {
  approveVideoIdea as approveNow,
  connectVideoPlatform as connectNow,
  editVideoIdea as editNow,
  requestVideoIdeas as requestDailyNow,
  type IdeaEdit,
  type VideoResult,
} from "@/lib/video/actions";
import {
  DURATION_SECONDS,
  isVideoPlatform,
  VIDEO_PLATFORM_SPECS,
  type BatchKind,
  type CreativeDirection,
  type DurationRange,
  type IdeaCategory,
  type IdeaOverrides,
  type MakeVia,
  type NativeAudioSelection,
  type ProductionChoices,
  type VideoFormat,
  type VideoPlatform,
} from "@/lib/video/formats";
import type { VideoSettings } from "@/lib/video/settings";

import type { ProfileForm } from "./logic";

type Pending<T = null> = Promise<VideoResult<T>>;
const notReady = async <T>(): Pending<T> => ({ ok: false, error: "not_configured" });

/** The edit the extended editor sends (A extends IdeaEdit in lib/video/actions.ts). */
export type ViralIdeaEdit = IdeaEdit & {
  title?: string;
  category?: IdeaCategory;
  direction?: CreativeDirection;
  production?: Partial<ProductionChoices>;
  overrides?: IdeaOverrides;
};

/* -------------------------------------------- Worker A: lib/video/actions.ts */

/** Real: `requestVideoIdeas` from "@/lib/video/actions" (kind + requestKey; errors day_full | extra_used_up | busy | too_soon). */
export async function requestVideoIdeas(websiteId: string, kind: BatchKind = "daily", requestKey?: string): Pending {
  void requestKey;
  // Today's action only knows the daily batch.
  return kind === "daily" ? requestDailyNow(websiteId) : notReady();
}

/** Real: `editVideoIdea` from "@/lib/video/actions" (today's ignores the new fields). */
export function editVideoIdea(websiteId: string, id: string, edit: ViralIdeaEdit): Pending {
  return editNow(websiteId, id, edit);
}

/** Real: `approveVideoIdea` from "@/lib/video/actions". */
export function approveVideoIdea(websiteId: string, id: string, edit: ViralIdeaEdit = {}, via: MakeVia = "button"): Pending {
  return approveNow(websiteId, id, edit, via);
}

/** Real: `rewriteVideoIdea` from "@/lib/video/actions" (free; writes the script again with the idea's saved choices). */
export function rewriteVideoIdea(websiteId: string, id: string): Pending {
  void websiteId;
  void id;
  return notReady();
}

/** Real: `approveVideoReview` from "@/lib/video/actions" (ties the check to the content hash). */
export function approveVideoReview(websiteId: string, id: string): Pending {
  void websiteId;
  void id;
  return notReady();
}

/** Real: `resetVideoSettingsAction` from "@/lib/video/actions". */
export function resetVideoSettingsAction(websiteId: string): Pending<VideoSettings | null> {
  void websiteId;
  return notReady();
}

/** Real: `saveVideoProfileAction` from "@/lib/video/actions" (writes websites + brand_voice + the two video fields). */
export function saveVideoProfileAction(websiteId: string, profile: ProfileForm): Pending {
  void websiteId;
  void profile;
  return notReady();
}

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
