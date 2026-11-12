/**
 * The Social Content page's pure rules (client, 2026-11-12), kept apart from
 * the components so they can be tested without a browser: the idea filters
 * and their counts, the Ctrl/Cmd+Z guard, the viral split shown under the
 * slider, and the settings form's payload.
 *
 * No server imports: the page's client components use these.
 */

import {
  CAPTION_STYLES,
  CONTENT_GOALS,
  DAILY_BATCH_SIZE,
  DURATION_RANGES,
  HUMOR_LEVELS,
  IDEA_CATEGORIES,
  isVideoFormat,
  isVideoPlatform,
  MUSIC_DIRECTIONS,
  NARRATION_STYLES,
  POSTING_FREQUENCIES,
  PUBLISH_MODES,
  TONE_PRESETS,
  VIRAL_TECHNIQUES,
  AUDIO_MODES,
  type IdeaCategory,
  type TonePreset,
  type VideoFormat,
} from "@/lib/video/formats";
import type { VideoSettings } from "@/lib/video/settings";

// ---------------------------------------------------------------- filters

export type CategoryFilter = "all" | IdeaCategory;
export type FormatFilter = "all" | VideoFormat;

type Filterable = { id: string; category: string; format: string };

/** The ideas the deck shows: not handled on this screen, in the chosen category and format. */
export function visibleIdeas<I extends Filterable>(ideas: I[], gone: ReadonlySet<string>, category: CategoryFilter, format: FormatFilter): I[] {
  return ideas.filter(
    (idea) => !gone.has(idea.id) && (category === "all" || idea.category === category) && (format === "all" || idea.format === format),
  );
}

/**
 * The counts on the category chips: the ideas left in each category, within
 * the chosen format - so a chip never promises ideas the format filter hides.
 */
export function categoryCounts(ideas: Filterable[], gone: ReadonlySet<string>, format: FormatFilter): Record<CategoryFilter, number> {
  const counts = { all: 0, viral: 0, educational: 0, authority: 0, promotional: 0 } satisfies Record<CategoryFilter, number>;
  for (const idea of ideas) {
    if (gone.has(idea.id) || (format !== "all" && idea.format !== format)) continue;
    counts.all += 1;
    if ((IDEA_CATEGORIES as readonly string[]).includes(idea.category)) counts[idea.category as IdeaCategory] += 1;
  }
  return counts;
}

/** The browse position held inside the deck after it shrank or the filters changed. */
export function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return Math.min(Math.max(0, index), length - 1);
}

/** ‹ and › go round the filtered ideas. */
export function browse(index: number, delta: -1 | 1, length: number): number {
  if (length <= 0) return 0;
  return (((index + delta) % length) + length) % length;
}

// ---------------------------------------------------------------- Ctrl/Cmd+Z

export type UndoKeyEvent = {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  repeat: boolean;
  defaultPrevented: boolean;
  target: unknown;
};

const FIELD_SELECTOR = "input, textarea, select, [contenteditable=''], [contenteditable=true], [contenteditable=plaintext-only], [role=textbox], [role=combobox]";

/**
 * Whether a key press is the page's Undo (Ctrl+Z, or Cmd+Z on a Mac) rather
 * than the browser's: never inside a field or editable text (that is the
 * field's own undo), never with Shift (redo) or Alt, never on a held key,
 * and never while a dialog or menu is open over the deck.
 */
export function isPageUndo(event: UndoKeyEvent, overlayOpen: boolean): boolean {
  if (event.key.toLowerCase() !== "z") return false;
  if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey || event.repeat || event.defaultPrevented) return false;
  if (overlayOpen) return false;
  const target = event.target as { closest?: (selector: string) => unknown; isContentEditable?: boolean } | null;
  if (target?.isContentEditable) return false;
  if (typeof target?.closest === "function" && target.closest(FIELD_SELECTOR)) return false;
  return true;
}

/** Whether a modal dialog or an open menu covers the page (Radix marks both). */
export function overlayOpen(doc: Pick<Document, "querySelector">): boolean {
  return Boolean(doc.querySelector("[role=dialog][data-state=open], [role=alertdialog][data-state=open], [role=menu][data-state=open], [aria-modal=true]"));
}

export type LastAction = { kind: "make" | "skip"; id: string; at: number };

/**
 * What Ctrl/Cmd+Z takes back: the last make while its UNDO_SECONDS run (the
 * server refuses later ones), else the last skip - which, like the Undo
 * button after a skip, has no time limit until the next make.
 */
export function undoTarget(last: LastAction | null, now: number, undoSeconds: number): LastAction | null {
  if (!last) return null;
  if (last.kind === "make" && now - last.at > undoSeconds * 1000) return null;
  return last;
}

// ---------------------------------------------------------------- strategy

/** "8 viral ideas / 20" under the slider: the daily batch's split (the strategy rounds the same way). */
export function viralSplit(mix: number, size = DAILY_BATCH_SIZE): { viral: number; other: number } {
  const viral = Math.round((Math.min(100, Math.max(0, mix)) * size) / 100);
  return { viral, other: size - viral };
}

/** Splits a post text into its words and its trailing hashtags, for the detail panel. */
export function splitHashtags(caption: string): { text: string; hashtags: string } {
  const match = caption.match(/(\s*(?:#[\p{L}\p{N}_]+\s*)+)$/u);
  if (!match || match.index === undefined) return { text: caption, hashtags: "" };
  const text = caption.slice(0, match.index).trimEnd();
  if (!text) return { text: caption, hashtags: "" };
  return { text, hashtags: match[1].trim() };
}

// ---------------------------------------------------------------- settings form

/** The audience fields: the website's profile and Brand Voice, shared with the rest of RepGet. */
export type ProfileForm = {
  targetAudience: string;
  language: string;
  country: string;
  tone: string;
  avoid: string;
  priorityTopics: string;
  tonePreset: TonePreset;
};

export const DEFAULT_CTA_MAX = 120;
const PROFILE_MAX = 2000;

export type SettingsProblem = "no_format" | "cta_too_long" | "profile_too_long" | "bad_value";

const isOneOf = (list: readonly string[], value: unknown) => typeof value === "string" && list.includes(value);

/** Checks the form before it is sent; the server checks again and has the last word. */
export function settingsProblems(form: VideoSettings, profile: ProfileForm | null): SettingsProblem[] {
  const problems: SettingsProblem[] = [];
  if (form.formats.length === 0) problems.push("no_format");
  if ((form.defaultCta ?? "").length > DEFAULT_CTA_MAX) problems.push("cta_too_long");
  if (profile && [profile.targetAudience, profile.tone, profile.avoid, profile.priorityTopics].some((value) => value.length > PROFILE_MAX)) {
    problems.push("profile_too_long");
  }
  const enums: [readonly string[], unknown][] = [
    [CONTENT_GOALS, form.goal],
    [TONE_PRESETS, form.tonePreset],
    [HUMOR_LEVELS, form.humor],
    [DURATION_RANGES, form.duration],
    [AUDIO_MODES, form.audioMode],
    [NARRATION_STYLES, form.narration],
    [CAPTION_STYLES, form.captionStyle],
    [MUSIC_DIRECTIONS, form.musicDirection],
    [PUBLISH_MODES, form.publishMode],
  ];
  if (
    enums.some(([list, value]) => !isOneOf(list, value)) ||
    (form.frequency !== null && !isOneOf(POSTING_FREQUENCIES, form.frequency)) ||
    form.techniques.some((value) => !isOneOf(VIRAL_TECHNIQUES, value)) ||
    form.formats.some((value) => !isVideoFormat(value)) ||
    form.platforms.some((value) => !isVideoPlatform(value))
  ) {
    problems.push("bad_value");
  }
  return problems;
}

/**
 * The settings the Save button sends: the form's own fields that changed.
 * Uploads and the logo are saved on their own; priority topics and the tone
 * preset go with the profile (saveVideoProfileAction), which owns them.
 */
const FORM_KEYS = [
  "style",
  "voice",
  "captions",
  "publishMode",
  "platforms",
  "viralMix",
  "goal",
  "techniques",
  "trendInspired",
  "humor",
  "allowControversial",
  "strongLanguage",
  "requireFactReview",
  "requireControversyReview",
  "formats",
  "duration",
  "audioMode",
  "narration",
  "captionStyle",
  "musicDirection",
  "showHook",
  "includeCta",
  "defaultCta",
  "frequency",
] as const satisfies readonly (keyof VideoSettings)[];

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function settingsChanges(initial: VideoSettings, form: VideoSettings): Partial<VideoSettings> {
  const out: Partial<VideoSettings> = {};
  const normal: VideoSettings = {
    ...form,
    viralMix: Math.min(100, Math.max(0, Math.round(form.viralMix / 10) * 10)),
    defaultCta: form.defaultCta?.trim() ? form.defaultCta.trim() : null,
    // Kept in order and without repeats, so the same choice never reads as a change.
    platforms: [...new Set(form.platforms)],
    formats: [...new Set(form.formats)],
    techniques: [...new Set(form.techniques)],
  };
  for (const key of FORM_KEYS) {
    if (!same(initial[key], normal[key])) (out as Record<string, unknown>)[key] = normal[key];
  }
  // The older on/off switch follows the music direction, so the two never disagree.
  if ("musicDirection" in out) out.music = normal.musicDirection !== "none";
  return out;
}

export function profileChanged(initial: ProfileForm, form: ProfileForm): boolean {
  return (Object.keys(initial) as (keyof ProfileForm)[]).some((key) => initial[key].trim() !== form[key].trim());
}
