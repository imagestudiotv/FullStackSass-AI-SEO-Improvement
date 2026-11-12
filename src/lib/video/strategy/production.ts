import {
  CAPTION_STYLES,
  DURATION_RANGES,
  MUSIC_DIRECTIONS,
  NARRATION_STYLES,
  TONE_PRESETS,
  type IdeaOverrides,
  type ProductionChoices,
  type ResolvedAudio,
  type VideoFormat,
} from "../formats";
import { durationFor } from "./allocation";

/**
 * An idea's production choices (ProductionChoices) and per-video overrides
 * (IdeaOverrides): reading them from a row (ideas from before 2026-11-12
 * have none - they are derived from the legacy voice/captions/music
 * columns), and checking an edit of them. Pure.
 */

export const MAX_CTA_TEXT = 150;
export const MAX_OVERRIDE = 300;

type ProductionDefaults = {
  narration: ProductionChoices["narration"];
  captionStyle: ProductionChoices["captionStyle"];
  musicDirection: ProductionChoices["music"];
  duration: ProductionChoices["duration"];
  showHook: boolean;
  includeCta: boolean;
  defaultCta: string | null;
};

const oneOf = <T extends string>(list: readonly T[], value: unknown): value is T => typeof value === "string" && (list as readonly string[]).includes(value);

/** The row's production choices, or those it implies (legacy rows: the voice decides the audio, a "none" track no music). */
export function productionOf(
  row: { production: unknown; voice: string | null; musicTrack: string | null; format: string },
  defaults: ProductionDefaults,
): ProductionChoices {
  const stored = (row.production && typeof row.production === "object" ? row.production : {}) as Partial<ProductionChoices>;
  const format = (["reel", "story", "carousel"].includes(row.format) ? row.format : "reel") as VideoFormat;
  return {
    audio: stored.audio === "voiceover" || stored.audio === "text_music" ? stored.audio : row.voice ? "voiceover" : "text_music",
    narration: oneOf(NARRATION_STYLES, stored.narration) ? stored.narration : defaults.narration,
    captionStyle: oneOf(CAPTION_STYLES, stored.captionStyle) ? stored.captionStyle : defaults.captionStyle,
    music: oneOf(MUSIC_DIRECTIONS, stored.music) ? stored.music : row.musicTrack === "none" ? "none" : defaults.musicDirection,
    duration: durationFor(format, oneOf(DURATION_RANGES, stored.duration) ? stored.duration : defaults.duration),
    showHook: typeof stored.showHook === "boolean" ? stored.showHook : defaults.showHook,
    includeCta: typeof stored.includeCta === "boolean" ? stored.includeCta : defaults.includeCta,
    ctaText: typeof stored.ctaText === "string" ? stored.ctaText : stored.ctaText === null ? null : defaults.includeCta ? defaults.defaultCta : null,
  };
}

/** An edit of production choices merged into the current ones; null when a field is not a value it can have. */
export function mergeProduction(current: ProductionChoices, edit: Partial<Record<keyof ProductionChoices, unknown>>): ProductionChoices | null {
  const next = { ...current };
  if (edit.audio !== undefined) {
    if (edit.audio !== "voiceover" && edit.audio !== "text_music") return null;
    next.audio = edit.audio as ResolvedAudio;
  }
  if (edit.narration !== undefined) {
    if (!oneOf(NARRATION_STYLES, edit.narration)) return null;
    next.narration = edit.narration;
  }
  if (edit.captionStyle !== undefined) {
    if (!oneOf(CAPTION_STYLES, edit.captionStyle)) return null;
    next.captionStyle = edit.captionStyle;
  }
  if (edit.music !== undefined) {
    if (!oneOf(MUSIC_DIRECTIONS, edit.music)) return null;
    next.music = edit.music;
  }
  if (edit.duration !== undefined) {
    if (!oneOf(DURATION_RANGES, edit.duration)) return null;
    next.duration = edit.duration;
  }
  for (const key of ["showHook", "includeCta"] as const) {
    if (edit[key] === undefined) continue;
    if (typeof edit[key] !== "boolean") return null;
    next[key] = edit[key] as boolean;
  }
  if (edit.ctaText !== undefined) {
    if (edit.ctaText === null) next.ctaText = null;
    else if (typeof edit.ctaText !== "string") return null;
    else {
      const text = edit.ctaText.replace(/\s+/g, " ").trim();
      if (text.length > MAX_CTA_TEXT) return null;
      next.ctaText = text || null;
    }
  }
  return next;
}

/** A video's overrides checked: each text at most MAX_OVERRIDE characters, the preset one of TONE_PRESETS; null clears them all. */
export function cleanOverrides(edit: unknown): IdeaOverrides | null {
  if (edit === null) return {};
  if (!edit || typeof edit !== "object") return null;
  const input = edit as Record<string, unknown>;
  const out: IdeaOverrides = {};
  for (const key of ["audience", "tone", "avoid"] as const) {
    const value = input[key];
    if (value === undefined || value === null) continue;
    if (typeof value !== "string") return null;
    const text = value.replace(/\s+/g, " ").trim();
    if (text.length > MAX_OVERRIDE) return null;
    if (text) out[key] = text;
  }
  if (input.tonePreset !== undefined && input.tonePreset !== null) {
    if (!oneOf(TONE_PRESETS, input.tonePreset)) return null;
    out.tonePreset = input.tonePreset;
  }
  return out;
}
