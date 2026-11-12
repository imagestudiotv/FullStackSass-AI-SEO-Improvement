import "server-only";

import { eq } from "drizzle-orm";

import { isEntitledToSpend } from "@/lib/billing/entitled";
import { db } from "@/lib/db";
import { videoSettings, websites } from "@/lib/db/schema";
import type { Executor } from "@/lib/db/types";

import {
  AUDIO_MODES,
  CAPTION_STYLES,
  CONTENT_GOALS,
  DEFAULT_TECHNIQUES,
  DURATION_RANGES,
  HUMOR_LEVELS,
  isVideoFormat,
  isVideoPlatform,
  isVideoStyle,
  isVoice,
  MUSIC_DIRECTIONS,
  NARRATION_STYLES,
  ORIGINAL_VIDEO_PLATFORMS,
  POSTING_FREQUENCIES,
  PUBLISH_MODES,
  TONE_PRESETS,
  VIDEO_FORMATS,
  VIDEO_PLATFORMS as VIDEO_PLATFORMS_LIST,
  VIRAL_TECHNIQUES,
  type AudioMode,
  type BrandLook,
  type CaptionStyle,
  type ContentGoal,
  type DurationRange,
  type HumorLevel,
  type MusicDirection,
  type NarrationStyle,
  type PostingFrequency,
  type PublishMode,
  type TonePreset,
  type VideoFormat,
  type VideoPlatform,
  type VideoStyle,
  type ViralTechnique,
  type Voice,
} from "./formats";

/**
 * A website's video settings, with the defaults where it has no row yet, and
 * who may use videos at all.
 *
 * Audience, language, market, tone and avoided topics are not video settings:
 * they are the website's profile and Brand Voice, read and saved there.
 */

export type VideoSettings = {
  style: VideoStyle;
  voice: Voice | null;
  music: boolean;
  captions: boolean;
  publishMode: PublishMode;
  platforms: VideoPlatform[];
  logoUrl: string | null;
  /* Content strategy (2026-11-12). */
  viralMix: number;
  goal: ContentGoal;
  techniques: ViralTechnique[];
  trendInspired: boolean;
  priorityTopics: string | null;
  tonePreset: TonePreset;
  humor: HumorLevel;
  allowControversial: boolean;
  strongLanguage: boolean;
  requireFactReview: boolean;
  requireControversyReview: boolean;
  /* Video & audio. */
  formats: VideoFormat[];
  duration: DurationRange;
  audioMode: AudioMode;
  narration: NarrationStyle;
  captionStyle: CaptionStyle;
  musicDirection: MusicDirection;
  showHook: boolean;
  includeCta: boolean;
  defaultCta: string | null;
  /* Publishing: null = as before 2026-11-12, each made video at the next best hour. */
  frequency: PostingFrequency | null;
};

export const DEFAULT_SETTINGS: VideoSettings = {
  style: "bold",
  voice: "coral",
  music: true,
  captions: true,
  publishMode: "manual",
  platforms: [...ORIGINAL_VIDEO_PLATFORMS],
  logoUrl: null,
  viralMix: 40,
  goal: "balanced",
  techniques: [...DEFAULT_TECHNIQUES],
  trendInspired: true,
  priorityTopics: null,
  tonePreset: "professional",
  humor: "light",
  allowControversial: false,
  strongLanguage: false,
  requireFactReview: true,
  requireControversyReview: true,
  formats: [...VIDEO_FORMATS],
  duration: "30-45",
  audioMode: "auto",
  narration: "natural",
  captionStyle: "bold",
  musicDirection: "auto",
  showHook: true,
  includeCta: true,
  defaultCta: null,
  frequency: "5_week",
};

const oneOf = <T extends string>(list: readonly T[], value: unknown, fallback: T): T =>
  typeof value === "string" && (list as readonly string[]).includes(value) ? (value as T) : fallback;

/** A stored or submitted viral mix, held to 0-100 in steps of 10. */
export function normalMix(value: unknown, fallback = DEFAULT_SETTINGS.viralMix): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(100, Math.max(0, Math.round(n / 10) * 10));
}

export async function readVideoSettings(websiteId: string, executor: Executor = db): Promise<VideoSettings> {
  const [row] = await executor.select().from(videoSettings).where(eq(videoSettings.websiteId, websiteId));
  if (!row) return { ...DEFAULT_SETTINGS, platforms: [...DEFAULT_SETTINGS.platforms], techniques: [...DEFAULT_SETTINGS.techniques], formats: [...DEFAULT_SETTINGS.formats] };
  const d = DEFAULT_SETTINGS;
  const formats = row.formats.filter(isVideoFormat);
  return {
    style: isVideoStyle(row.style) ? row.style : d.style,
    voice: row.voice && isVoice(row.voice) ? row.voice : null,
    music: row.music,
    captions: row.captions,
    publishMode: oneOf(PUBLISH_MODES, row.publishMode, "manual"),
    platforms: row.platforms.filter(isVideoPlatform),
    logoUrl: row.logoUrl,
    viralMix: normalMix(row.viralMix),
    goal: oneOf(CONTENT_GOALS, row.goal, d.goal),
    techniques: row.techniques.filter((t): t is ViralTechnique => (VIRAL_TECHNIQUES as readonly string[]).includes(t)),
    trendInspired: row.trendInspired,
    priorityTopics: row.priorityTopics,
    tonePreset: oneOf(TONE_PRESETS, row.tonePreset, d.tonePreset),
    humor: oneOf(HUMOR_LEVELS, row.humor, d.humor),
    allowControversial: row.allowControversial,
    strongLanguage: row.strongLanguage,
    requireFactReview: row.requireFactReview,
    requireControversyReview: row.requireControversyReview,
    formats: formats.length > 0 ? formats : [...d.formats],
    duration: oneOf(DURATION_RANGES, row.duration, d.duration),
    audioMode: oneOf(AUDIO_MODES, row.audioMode, d.audioMode),
    narration: oneOf(NARRATION_STYLES, row.narration, d.narration),
    captionStyle: oneOf(CAPTION_STYLES, row.captionStyle, d.captionStyle),
    musicDirection: oneOf(MUSIC_DIRECTIONS, row.musicDirection, d.musicDirection),
    showHook: row.showHook,
    includeCta: row.includeCta,
    defaultCta: row.defaultCta,
    // A saved row without a frequency predates it: keep posting as before.
    frequency: row.frequency ? oneOf(POSTING_FREQUENCIES, row.frequency, d.frequency ?? "5_week") : null,
  };
}

/* ------------------------------------------------------------- saving */

export type SettingsInput = { [K in keyof VideoSettings]?: unknown };
export type SettingsCheck = { ok: true; settings: VideoSettings } | { ok: false; field: keyof VideoSettings };

export const MAX_DEFAULT_CTA = 150;
export const MAX_PRIORITY_TOPICS = 500;

/**
 * A Save from the Videos page held to what the settings can be. A field left
 * out keeps its value; a field sent with a value it cannot have refuses the
 * whole Save (field named), rather than storing something else. Nothing is
 * switched on that was not sent: automatic posting and platforms change only
 * when they are in the Save. The legacy music/voice columns follow the new
 * choices, so older readers see the same thing.
 */
export function validateVideoSettings(input: SettingsInput, current: VideoSettings, options: { logoAllowed: (url: string) => boolean }): SettingsCheck {
  const next: VideoSettings = { ...current, platforms: [...current.platforms], techniques: [...current.techniques], formats: [...current.formats] };
  const errors: (keyof VideoSettings)[] = [];
  const has = (key: keyof VideoSettings) => input[key] !== undefined;
  const flag = (key: "music" | "captions" | "trendInspired" | "allowControversial" | "strongLanguage" | "requireFactReview" | "requireControversyReview" | "showHook" | "includeCta") => {
    const value = input[key];
    if (value === undefined) return;
    if (typeof value !== "boolean") errors.push(key);
    else next[key] = value;
  };
  const pick = <T extends string>(key: keyof VideoSettings, list: readonly T[]): T | undefined => {
    if (!has(key)) return undefined;
    const value = input[key];
    if (typeof value === "string" && (list as readonly string[]).includes(value)) return value as T;
    errors.push(key);
    return undefined;
  };
  const text = (key: "priorityTopics" | "defaultCta", max: number) => {
    if (!has(key)) return;
    const value = input[key];
    if (value === null) return void (next[key] = null);
    if (typeof value !== "string") return void (errors.push(key));
    const trimmed = value.replace(/\s+/g, " ").trim();
    if (trimmed.length > max) return void (errors.push(key));
    next[key] = trimmed || null;
  };
  const subset = <T extends string>(key: "techniques" | "formats" | "platforms", list: readonly T[], nonEmpty: boolean): T[] | undefined => {
    if (!has(key)) return undefined;
    const value = input[key];
    if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !(list as readonly string[]).includes(item))) {
      errors.push(key);
      return undefined;
    }
    const unique = [...new Set(value as T[])];
    if (nonEmpty && unique.length === 0) {
      errors.push(key);
      return undefined;
    }
    return unique;
  };

  // The original settings, as lenient as before: an unknown style keeps the current one.
  if (typeof input.style === "string" && isVideoStyle(input.style)) next.style = input.style;
  if (has("voice") || input.voice === null) next.voice = typeof input.voice === "string" && isVoice(input.voice) ? input.voice : null;
  flag("music");
  flag("captions");
  const publishMode = pick("publishMode", PUBLISH_MODES);
  if (publishMode) next.publishMode = publishMode;
  const platforms = subset("platforms", VIDEO_PLATFORMS_LIST, false);
  if (platforms) next.platforms = platforms;
  if (has("logoUrl") || input.logoUrl === null) {
    next.logoUrl = typeof input.logoUrl === "string" && input.logoUrl && options.logoAllowed(input.logoUrl) ? input.logoUrl : null;
  }

  // Strategy.
  if (has("viralMix")) {
    const mix = input.viralMix;
    if (typeof mix !== "number" || !Number.isInteger(mix) || mix < 0 || mix > 100 || mix % 10 !== 0) errors.push("viralMix");
    else next.viralMix = mix;
  }
  const goal = pick("goal", CONTENT_GOALS);
  if (goal) next.goal = goal;
  const techniques = subset("techniques", VIRAL_TECHNIQUES, false);
  if (techniques) next.techniques = techniques;
  flag("trendInspired");
  text("priorityTopics", MAX_PRIORITY_TOPICS);
  const tonePreset = pick("tonePreset", TONE_PRESETS);
  if (tonePreset) next.tonePreset = tonePreset;
  const humor = pick("humor", HUMOR_LEVELS);
  if (humor) next.humor = humor;
  flag("allowControversial");
  flag("strongLanguage");
  flag("requireFactReview");
  flag("requireControversyReview");

  // Video and audio.
  const formats = subset("formats", VIDEO_FORMATS, true);
  if (formats) next.formats = formats;
  const duration = pick("duration", DURATION_RANGES);
  if (duration) next.duration = duration;
  const audioMode = pick("audioMode", AUDIO_MODES);
  if (audioMode) next.audioMode = audioMode;
  const narration = pick("narration", NARRATION_STYLES);
  if (narration) next.narration = narration;
  const captionStyle = pick("captionStyle", CAPTION_STYLES);
  if (captionStyle) next.captionStyle = captionStyle;
  const musicDirection = pick("musicDirection", MUSIC_DIRECTIONS);
  if (musicDirection) next.musicDirection = musicDirection;
  flag("showHook");
  flag("includeCta");
  text("defaultCta", MAX_DEFAULT_CTA);

  // Publishing: null keeps the behaviour from before frequencies.
  if (has("frequency") || input.frequency === null) {
    if (input.frequency === null) next.frequency = null;
    else {
      const frequency = pick("frequency", POSTING_FREQUENCIES);
      if (frequency) next.frequency = frequency;
    }
  }
  if (errors.length > 0) return { ok: false, field: errors[0] };

  // The legacy columns follow: music on/off with the music direction, a voice with narration.
  if (musicDirection) next.music = musicDirection !== "none";
  else if (has("music")) next.musicDirection = next.music ? (current.musicDirection === "none" ? "auto" : current.musicDirection) : "none";
  if (audioMode && audioMode !== "text_music" && next.voice === null) next.voice = DEFAULT_SETTINGS.voice;
  else if (!audioMode && has("voice") && next.voice === null) next.audioMode = "text_music";
  return { ok: true, settings: next };
}

/**
 * Reset: the strategy, video, audio and safety panes back to the defaults.
 * The customer's publishing choices stay - platforms, publishing mode,
 * frequency, logo and default CTA - and so do the profile-side fields
 * (priority topics, tone preset): a reset never switches posting on or adds
 * a platform.
 */
export function resetVideoSettings(current: VideoSettings): VideoSettings {
  return {
    ...DEFAULT_SETTINGS,
    techniques: [...DEFAULT_SETTINGS.techniques],
    formats: [...DEFAULT_SETTINGS.formats],
    platforms: [...current.platforms],
    publishMode: current.publishMode,
    frequency: current.frequency,
    logoUrl: current.logoUrl,
    defaultCta: current.defaultCta,
    priorityTopics: current.priorityTopics,
    tonePreset: current.tonePreset,
  };
}

export async function saveVideoSettings(websiteId: string, settings: VideoSettings): Promise<void> {
  const values = { ...settings, updatedAt: new Date() };
  await db
    .insert(videoSettings)
    .values({ websiteId, ...values })
    .onConflictDoUpdate({ target: videoSettings.websiteId, set: values });
}

/**
 * Who may make videos (client, 2026-10-29: "we can include video in trials
 * too, for convincing people to stay"): a paid plan and the free-articles
 * trial alike. Without a plan, nothing.
 */
export async function videoAccess(websiteId: string): Promise<"paid" | "trial" | "none"> {
  if ((await isEntitledToSpend(websiteId)).ok) return "paid";
  if ((await isEntitledToSpend(websiteId, { freeArticles: true })).ok) return "trial";
  return "none";
}

const HEX = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i;

function normalHex(value: string | null | undefined): string | null {
  const match = value?.trim().match(HEX);
  if (!match) return null;
  const hex = match[1].length === 3 ? [...match[1]].map((c) => c + c).join("") : match[1];
  return `#${hex.toLowerCase()}`;
}

function channels(hex: string): [number, number, number] {
  return [0, 2, 4].map((at) => parseInt(hex.slice(1 + at, 3 + at), 16)) as [number, number, number];
}

function toHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("")}`;
}

function mix(a: string, b: string, t: number): string {
  const [x, y] = [channels(a), channels(b)];
  return toHex([0, 1, 2].map((i) => x[i] + (y[i] - x[i]) * t) as [number, number, number]);
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * The colours a video uses, from the website's one brand colour (the same
 * one its article pictures use): the colour itself, a lighter accent, and a
 * deep background, so text stays readable whatever the brand picked.
 */
export function brandLook(
  site: { brandName: string | null; domain: string; brandColor: string | null },
  logoUrl: string | null,
): BrandLook {
  const primary = normalHex(site.brandColor) ?? "#4f46e5";
  const light = luminance(primary) > 0.45;
  return {
    name: site.brandName?.trim() || site.domain,
    domain: site.domain.replace(/^www\./, ""),
    primary,
    accent: light ? mix(primary, "#000000", 0.35) : mix(primary, "#ffffff", 0.45),
    background: mix(primary, "#05060a", light ? 0.85 : 0.72),
    text: "#ffffff",
    // The customer's uploaded logo, or none: the closing card then shows the brand's initial.
    // (Not a favicon service: a render must not wait on another site's answer.)
    logoUrl,
  };
}

export async function websiteBrand(websiteId: string): Promise<BrandLook | null> {
  const [site] = await db
    .select({ brandName: websites.brandName, domain: websites.domain, brandColor: websites.brandColor })
    .from(websites)
    .where(eq(websites.id, websiteId));
  if (!site) return null;
  return brandLook(site, (await readVideoSettings(websiteId)).logoUrl);
}
