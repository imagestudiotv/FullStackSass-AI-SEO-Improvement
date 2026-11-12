/**
 * Where a video can go, and what happened there (client, 2026-11-12):
 * pure helpers shared by the Videos page (what to tick, what to warn about)
 * and the server (validation before making, scheduling and publishing).
 *
 * No server imports: client components use these. Whether X is configured
 * for videos (its env flags and spending limit) is decided on the server
 * (lib/video/x-spend.ts) and passed in as `xAvailable`.
 */

import {
  DURATION_SECONDS,
  isVideoPlatform,
  VIDEO_PLATFORM_SPECS,
  type DestinationState,
  type DestinationStatus,
  type DurationRange,
  type VideoFormat,
  type VideoPlatform,
} from "./formats";

/**
 * Why a platform cannot take a video:
 *  - no_story: the platform has no Stories through bundle.social (never a reel sent as a Story);
 *  - no_carousel: the platform takes no photo carousel;
 *  - too_long: longer than the platform's limit for that format;
 *  - too_short: a Story under STORY_MIN_SECONDS;
 *  - x_not_configured: X is not set up for videos (flags or spending limit; server-side).
 */
export type DestinationProblem = "no_story" | "no_carousel" | "too_long" | "too_short" | "x_not_configured";

/** Instagram and Facebook take Story videos of 3 to 60 seconds (VIDEO_PLATFORM_SPECS.storyMaxSeconds). */
export const STORY_MIN_SECONDS = 3;

export type CompatibilityInput = {
  format: VideoFormat;
  /**
   * The video's length: the made video's seconds when known, otherwise the
   * chosen DurationRange (its maximum is checked, the conservative side).
   * null: not known yet (only the format is checked).
   */
  duration: number | DurationRange | null;
  platforms: readonly string[];
  /** Whether X is configured for videos (server-side: xVideoStatus().available). Default false. */
  xAvailable?: boolean;
};

export type Compatibility = {
  /** The chosen platforms that can take it, in the order given. */
  ok: VideoPlatform[];
  /** The chosen platforms that cannot, and why. */
  problems: Partial<Record<VideoPlatform, DestinationProblem>>;
};

function seconds(duration: CompatibilityInput["duration"]): number | null {
  if (duration === null) return null;
  if (typeof duration === "number") return Number.isFinite(duration) && duration > 0 ? duration : null;
  return DURATION_SECONDS[duration]?.max ?? null;
}

/** The problem one platform has with a video, or null. */
export function destinationProblem(platform: VideoPlatform, input: Omit<CompatibilityInput, "platforms">): DestinationProblem | null {
  const spec = VIDEO_PLATFORM_SPECS[platform];
  const length = seconds(input.duration);
  if (platform === "x" && !input.xAvailable) return "x_not_configured";
  if (input.format === "carousel") return spec.carousel ? null : "no_carousel";
  if (input.format === "story") {
    if (!spec.story || spec.storyMaxSeconds === null) return "no_story";
    if (length !== null && length > spec.storyMaxSeconds) return "too_long";
    if (typeof input.duration === "number" && length !== null && length < STORY_MIN_SECONDS) return "too_short";
    return null;
  }
  if (length !== null && length > spec.maxVideoSeconds) return "too_long";
  return null;
}

/** Which of the chosen platforms can take a video of this format and length, and why the others cannot. */
export function compatibility(input: CompatibilityInput): Compatibility {
  const ok: VideoPlatform[] = [];
  const problems: Partial<Record<VideoPlatform, DestinationProblem>> = {};
  for (const platform of [...new Set(input.platforms)].filter(isVideoPlatform)) {
    const problem = destinationProblem(platform, input);
    if (problem) problems[platform] = problem;
    else ok.push(platform);
  }
  return { ok, problems };
}

/* ------------------------------------------------------------------ state */

/**
 * The codes a destination's `error` can hold (DestinationState.error); any
 * other text is the platform's own refusal, shown as it came.
 *  - not_connected / paused: no usable account (a refusal paused it: Resume on Settings);
 *  - no_board: Pinterest without a board; linkedin_no_target: LinkedIn without a profile or page chosen;
 *  - daily_limit: the platform had its MAX_POSTS_PER_DAY videos today;
 *  - the DestinationProblem codes (format, length, X not configured);
 *  - x_limit_reached: X's monthly spending limit is used up (it waits for next month or a higher limit);
 *  - native_audio_login: the Instagram track needs Instagram connected through Facebook Login;
 *  - native_audio_file: the version without RepGet's music could not be made;
 */
export const DESTINATION_CODES = [
  "not_connected",
  "paused",
  "no_board",
  "linkedin_no_target",
  "daily_limit",
  "no_story",
  "no_carousel",
  "too_long",
  "too_short",
  "x_not_configured",
  "x_limit_reached",
  "native_audio_login",
  "native_audio_file",
] as const;
export type DestinationCode = (typeof DESTINATION_CODES)[number];

export function isDestinationCode(value: string | null | undefined): value is DestinationCode {
  return typeof value === "string" && (DESTINATION_CODES as readonly string[]).includes(value);
}

const STATUSES: readonly DestinationStatus[] = ["pending", "scheduled", "posting", "posted", "failed", "skipped"];

export const emptyDestination = (status: DestinationStatus = "pending"): DestinationState => ({
  status,
  bundlePostId: null,
  url: null,
  error: null,
  attempts: 0,
});

/** video_ideas.destinations as stored (jsonb) to DestinationState per platform; anything malformed is dropped. */
export function readDestinations(raw: unknown): Partial<Record<VideoPlatform, DestinationState>> {
  const out: Partial<Record<VideoPlatform, DestinationState>> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isVideoPlatform(key) || !value || typeof value !== "object") continue;
    const item = value as Record<string, unknown>;
    const status = STATUSES.includes(item.status as DestinationStatus) ? (item.status as DestinationStatus) : null;
    if (!status) continue;
    out[key] = {
      status,
      bundlePostId: typeof item.bundlePostId === "string" ? item.bundlePostId : null,
      url: typeof item.url === "string" ? item.url : null,
      error: typeof item.error === "string" ? item.error : null,
      attempts: Number.isFinite(Number(item.attempts)) ? Math.max(0, Math.floor(Number(item.attempts))) : 0,
    };
  }
  return out;
}

/** The platforms a video is already on: a retry never posts there again. */
export function postedPlatforms(destinations: Partial<Record<VideoPlatform, DestinationState>>): VideoPlatform[] {
  return (Object.keys(destinations) as VideoPlatform[]).filter((platform) => destinations[platform]?.status === "posted");
}

/* ---------------------------------------------------------------- captions */

/**
 * A caption cut to a platform's limit without breaking a word or a hashtag:
 * the text first, then as many whole hashtags (from the end of the caption)
 * as still fit. X counts 280 characters, hashtags included.
 */
export function fitCaption(caption: string, max: number): string {
  const text = caption.replace(/[ \t]+/g, " ").trim();
  if ([...text].length <= max) return text;
  const words = text.split(/\s+/);
  const tags = words.filter((word) => /^#[\p{L}\p{N}_]+$/u.test(word));
  const body = words.filter((word) => !tags.includes(word)).join(" ");
  const length = (value: string) => [...value].length;
  let out = body;
  if (length(out) > max) {
    // Cut at the last whole word that fits, with an ellipsis.
    const room = max - 1;
    let cut = "";
    for (const word of out.split(" ")) {
      const next = cut ? `${cut} ${word}` : word;
      if (length(next) > room) break;
      cut = next;
    }
    out = `${(cut || [...out].slice(0, room).join("")).replace(/[\s,.;:!?-]+$/u, "")}…`;
    return out;
  }
  for (const tag of tags) {
    const next = `${out} ${tag}`;
    if (length(next) > max) break;
    out = next;
  }
  return out;
}
