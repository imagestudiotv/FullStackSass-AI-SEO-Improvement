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
  editVideoIdea as editNow,
  requestVideoIdeas as requestDailyNow,
  type IdeaEdit,
  type VideoResult,
} from "@/lib/video/actions";
import {
  VIDEO_PLATFORM_SPECS,
  DURATION_SECONDS,
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

export type AudioTrack = { audioId: string; title: string; artist: string | null; durationMs: number | null; trending: boolean };
export type AudioSearch = { available: boolean; reason?: string; tracks: AudioTrack[] };

/** Real: `searchInstagramAudio` from "@/lib/video/publish-actions". */
export function searchInstagramAudio(websiteId: string, query: string): Pending<AudioSearch> {
  void websiteId;
  void query;
  return notReady();
}

/** Real: `setNativeAudio` from "@/lib/video/publish-actions" (null removes it). */
export function setNativeAudio(websiteId: string, id: string, selection: Omit<NativeAudioSelection, "provider" | "selectedAt"> | null): Pending {
  void websiteId;
  void id;
  void selection;
  return notReady();
}

/* ----------------------------------------- Worker D: lib/video/destinations.ts */

export type CompatibilityCode = "no_story" | "too_long" | "no_carousel";
export type Compatibility = { ok: boolean; problems: { platform: VideoPlatform; code: CompatibilityCode | string }[] };

/**
 * Real: `compatibility` from "@/lib/video/destinations" (pure, client-safe).
 * This stand-in reads the same platform specs, so the warnings are right
 * meanwhile.
 */
export function compatibility(input: { format: VideoFormat; duration: DurationRange; platforms: readonly VideoPlatform[] }): Compatibility {
  const problems: Compatibility["problems"] = [];
  const seconds = DURATION_SECONDS[input.duration]?.max ?? 0;
  for (const platform of input.platforms) {
    const spec = VIDEO_PLATFORM_SPECS[platform];
    if (input.format === "carousel") {
      if (!spec.carousel) problems.push({ platform, code: "no_carousel" });
    } else if (input.format === "story") {
      if (!spec.story) problems.push({ platform, code: "no_story" });
      else if (spec.storyMaxSeconds !== null && seconds > spec.storyMaxSeconds) problems.push({ platform, code: "too_long" });
    } else if (seconds > spec.maxVideoSeconds) {
      problems.push({ platform, code: "too_long" });
    }
  }
  return { ok: problems.length === 0, problems };
}
