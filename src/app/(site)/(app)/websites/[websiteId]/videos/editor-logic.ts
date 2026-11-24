/**
 * The video editor's pure rules (client, 2026-11-21: "the editor to be more
 * simple and focused"), kept apart from the component so they can be tested
 * without a browser: the form an idea opens with, the edit it saves, what
 * each simple control stands for in the idea's fields, and which controls
 * the renderer really honours for a look and a format (src/remotion):
 *
 *  - text style: the animated templates' style (Bold / Numbers / Story); the
 *    meme, footage, storytelling and voiceover productions' caption style;
 *    Text + music and the production carousels set their own;
 *  - hook and call-to-action switches: the productions only (the animated
 *    templates always open on the hook and close on the closing line; a
 *    production carousel always has the hook as its cover);
 *  - captions on/off: the animated reels and Stories only (the productions
 *    always draw their word captions, whatever the idea's captions flag -
 *    the renderer is left as it is so existing ideas render unchanged);
 *  - voiceover: off for Text + music and carousels, always on for Voiceover.
 *
 * No server imports: the editor's client component uses these.
 */

import type { IdeaEdit } from "@/lib/video/actions";
import {
  CAPTION_STYLES,
  endsOnClip,
  isVideoFormat,
  REEL,
  silentTiming,
  VIDEO_STYLES,
  type CreativeDirection,
  type IdeaCategory,
  type IdeaOverrides,
  type MusicDirection,
  type ProductionChoices,
  type ResolvedAudio,
  type ShotPlan,
  type VideoFormat,
  type VideoScript,
  type VideoStyle,
} from "@/lib/video/formats";
import { ideaTrack, MUSIC_VOLUME, musicUrl } from "@/lib/video/music";
import { maxPointsFor } from "@/lib/video/strategy/duration";
import { hookCaptionLook, povCaptionLook } from "@/remotion/caption-looks";
import { clipTextFromLook, type ClipTextStyle } from "@/remotion/clip-text";
import { partEnd, productionOf, productionParts, productionTimeline, safeArea } from "@/remotion/production";
import { isProduction, type ProductionReelProps } from "@/remotion/props";
import { reelTiming, sceneEnd } from "@/remotion/timing";

/** Only an idea not made yet, or one whose make failed, can be changed (editVideoIdea). */
export const EDITABLE_STATUSES = ["new", "failed"] as const;

export function canEditIdea(status: string): boolean {
  return (EDITABLE_STATUSES as readonly string[]).includes(status);
}

/** What the editor needs of an idea (IdeaView, shared.tsx). */
export type EditorIdea = {
  title: string;
  caption: string;
  style: string;
  format: string;
  voice: string | null;
  musicTrack: string | null;
  captions: boolean;
  category: IdeaCategory;
  direction: CreativeDirection;
  production: ProductionChoices;
  overrides: IdeaOverrides;
  props: { script: VideoScript; plan?: ShotPlan | null };
};

export type EditorForm = {
  title: string;
  script: VideoScript;
  caption: string;
  /** VideoStyle: the animated templates' look. */
  style: string;
  /** VideoFormat. */
  format: string;
  category: IdeaCategory;
  direction: CreativeDirection;
  production: ProductionChoices;
  /** The narrator while the voiceover is on. */
  voice: string;
  /** A library track; null = chosen for you. Not used while production.music is "none". */
  music: string | null;
  captions: boolean;
  overrides: IdeaOverrides;
  /** A POV clip video: its one line is the hook; no points, proof or closing line (client, 2026-11-21). */
  pov: boolean;
  /** A Viral video ending on its clip: no closing line (formats.ts endsOnClip; client, 2026-11-23). */
  clipOnly: boolean;
};

export function formFromIdea(idea: EditorIdea, defaultVoice: string): EditorForm {
  return {
    title: idea.title,
    script: idea.props.script,
    caption: idea.caption,
    style: idea.style,
    format: idea.format,
    category: idea.category,
    direction: idea.direction,
    // An idea saved with no music reads as the "No music" choice.
    production: { ...idea.production, music: idea.musicTrack === "none" ? "none" : idea.production.music },
    voice: idea.voice ?? defaultVoice,
    music: idea.musicTrack === "none" ? null : idea.musicTrack,
    captions: idea.captions,
    overrides: idea.overrides,
    pov: Boolean(idea.props.plan?.povClip),
    clipOnly: endsOnClip(idea.props.plan),
  };
}

const formatOf = (form: Pick<EditorForm, "format">): VideoFormat => (isVideoFormat(form.format) ? form.format : "reel");

/** The audio a look or format forces (as cleanEdit does on the server); null = the customer's choice. */
export function audioLock(direction: CreativeDirection, format: string): ResolvedAudio | null {
  if (format === "carousel" || direction === "text_music") return "text_music";
  if (direction === "voiceover") return "voiceover";
  return null;
}

export function effectiveAudio(form: Pick<EditorForm, "direction" | "format" | "production">): ResolvedAudio {
  return audioLock(form.direction, form.format) ?? form.production.audio;
}

export const VOICE_OFF = "off";

/** The Voiceover dropdown: "off", or the narrator. */
export function voiceChoice(form: EditorForm): string {
  return effectiveAudio(form) === "voiceover" ? form.voice : VOICE_OFF;
}

export function withVoiceChoice(form: EditorForm, value: string): EditorForm {
  if (value === VOICE_OFF) return { ...form, production: { ...form.production, audio: "text_music" } };
  return { ...form, voice: value, production: { ...form.production, audio: "voiceover" } };
}

/**
 * The one Music dropdown: a mood ("mood:upbeat", "mood:none") or a library
 * track ("track:<id>"), for the two fields it stands for (production.music
 * and the idea's music track).
 */
export function musicChoice(form: Pick<EditorForm, "production" | "music">): string {
  if (form.production.music === "none") return "mood:none";
  return form.music ? `track:${form.music}` : `mood:${form.production.music}`;
}

export function withMusicChoice(form: EditorForm, value: string): EditorForm {
  if (value.startsWith("track:")) {
    const music = form.production.music === "none" ? "auto" : form.production.music;
    return { ...form, music: value.slice(6), production: { ...form.production, music } };
  }
  const mood = value.slice(5) as MusicDirection;
  return { ...form, music: null, production: { ...form.production, music: mood } };
}

/** The text styles this look really has: the template's, the captions', or none to choose ("fixed"). */
export type TextStyles = { kind: "template"; options: readonly VideoStyle[] } | { kind: "captions"; options: readonly ProductionChoices["captionStyle"][] } | { kind: "fixed" };

export function textStyles(form: Pick<EditorForm, "direction" | "format">): TextStyles {
  if (form.direction === "animated") return { kind: "template", options: VIDEO_STYLES };
  if (form.format === "carousel" || form.direction === "text_music") return { kind: "fixed" };
  return { kind: "captions", options: CAPTION_STYLES };
}

/** The text style chosen now, for the kind textStyles gives. */
export function textStyleValue(form: EditorForm): string {
  return form.direction === "animated" ? form.style : form.production.captionStyle;
}

export function withTextStyle(form: EditorForm, value: string): EditorForm {
  if (form.direction === "animated") return { ...form, style: value };
  return { ...form, production: { ...form.production, captionStyle: value as ProductionChoices["captionStyle"] } };
}

/** Whether the text on the clip can be styled and moved: a POV clip video, or one opening on a hook clip (client, 2026-11-24). */
export function clipTextApplies(form: Pick<EditorForm, "direction" | "format" | "pov" | "clipOnly">): boolean {
  return form.pov || (form.clipOnly && form.direction !== "animated" && form.format !== "carousel");
}

/** The hook clip's chip above its text: its height and the gap (directions/HookClip.tsx). */
const HOOK_CHIP_PX = 83;

/** The text's style now: the customer's own, else one like the look picked for the video, where that look draws it (PovClip.tsx, HookClip.tsx). */
export function clipTextOf(form: EditorForm, plan: ShotPlan | null | undefined): ClipTextStyle {
  if (form.production.textStyle) return form.production.textStyle;
  const safe = safeArea(form.format === "story");
  if (plan?.povClip) return clipTextFromLook(povCaptionLook(plan.povClip), form.script.hook, { left: safe.left, top: safe.top + 20, width: safe.right - safe.left, align: "center" });
  return clipTextFromLook(hookCaptionLook(plan?.hookClip?.pick?.id, form.script.hook), form.script.hook, { left: safe.left, top: safe.top + 150 + HOOK_CHIP_PX, width: safe.right - safe.left - 40, align: "left", scale: 1.2 });
}

/** The text on the clip for the part shown (the hook; on a hook clip video the proof too), or null when that part has none to drag. */
export function clipTextPart(form: EditorForm, part: PartKey): string | null {
  if (!clipTextApplies(form)) return null;
  if (part === 0 || form.pov) return form.pov || form.production.showHook ? form.script.hook : null;
  return part === form.script.points.length + 1 ? form.script.proof || null : null;
}

/** Whether the "Show hook" switch changes the video: productions only, never a carousel (its cover is the hook) or a POV clip video (its hook is the video). */
export function hookSwitchApplies(form: Pick<EditorForm, "direction" | "format" | "pov">): boolean {
  return form.direction !== "animated" && form.format !== "carousel" && !form.pov;
}

/** Whether the call-to-action switch and text change the video: productions only, not a Viral video ending on its clip. */
export function ctaSwitchApplies(form: Pick<EditorForm, "direction" | "clipOnly">): boolean {
  return form.direction !== "animated" && !form.clipOnly;
}

/** Whether "Captions on video" changes the video: the animated reels and Stories (Reel.tsx reads props.captions there only). */
export function captionsApply(form: Pick<EditorForm, "direction" | "format">): boolean {
  return form.format !== "carousel" && form.direction === "animated";
}

/** Whether a point's figure (number, unit, label) is shown: the animated Numbers template. */
export function figuresApply(form: Pick<EditorForm, "direction" | "style">): boolean {
  return form.direction === "animated" && form.style === "numbers";
}

/** The most points this look and format show (the server keeps the first ones). */
export function maxPoints(form: Pick<EditorForm, "direction" | "format">): number {
  return maxPointsFor(form.direction, formatOf(form));
}
export const MIN_POINTS = 2;

/** The script as it will be made: the points this look shows. */
export function shownScript(form: EditorForm): VideoScript {
  const max = maxPoints(form);
  return form.script.points.length > max ? { ...form.script, points: form.script.points.slice(0, max) } : form.script;
}

/** The edit the form saves (editVideoIdea / approveVideoIdea). */
export function editFromForm(form: EditorForm): IdeaEdit {
  const audio = effectiveAudio(form);
  const narrated = formatOf(form) !== "carousel" && audio === "voiceover";
  const overrides = Object.fromEntries(Object.entries(form.overrides).filter(([, value]) => typeof value === "string" && value.trim() !== "")) as IdeaOverrides;
  return {
    title: form.title.trim(),
    script: shownScript(form),
    caption: form.caption,
    style: form.style,
    format: form.format,
    category: form.category,
    direction: form.direction,
    production: { ...form.production, audio, ctaText: form.production.ctaText?.trim() ? form.production.ctaText.trim() : null, textStyle: form.production.textStyle ?? null },
    overrides,
    // The older columns follow the new choices, so an older server reads them the same way.
    voice: narrated ? form.voice : null,
    musicTrack: form.production.music === "none" ? "none" : form.music,
    captions: form.captions,
  };
}

/** Whether the form holds changes not saved yet (pictures are saved as they are added). */
export function isDirty(initial: EditorForm, form: EditorForm): boolean {
  return JSON.stringify(editFromForm(initial)) !== JSON.stringify(editFromForm(form));
}

/** What the server would refuse (cleanEdit's bad_script), so the buttons can say it first. */
export type EditorProblem = "title" | "hook" | "point" | "caption";

export function editorProblems(form: EditorForm): EditorProblem[] {
  const problems: EditorProblem[] = [];
  if (!form.title.trim()) problems.push("title");
  if (!form.script.hook.trim()) problems.push("hook");
  if (shownScript(form).points.some((point) => !point.title.trim())) problems.push("point");
  if (!form.caption.trim()) problems.push("caption");
  return problems;
}

/**
 * The music the editor's preview plays: the idea's own while nothing about it
 * changed, else the track the video would be made with if saved like this
 * (music.ts ideaTrack) - so another track, another mood or "No music" is heard.
 */
export function previewMusic(ideaId: string, base: ProductionReelProps, initial: EditorForm, form: EditorForm): ProductionReelProps["music"] {
  if (musicChoice(form) === musicChoice(initial) && form.direction === initial.direction) return base.music;
  const track = ideaTrack({
    id: ideaId,
    style: form.style,
    musicTrack: form.production.music === "none" ? "none" : form.music,
    direction: form.direction,
    hasProduction: true,
    music: form.production.music,
    planMood: base.plan?.musicMood ?? null,
    websiteMusic: true,
  });
  return track ? { url: musicUrl(track, ""), volume: MUSIC_VOLUME.alone } : null;
}

/**
 * The preview's props: the idea's own, with the form's words and choices.
 * Never with a voice - the voice is spoken again after an edit, and the editor's
 * preview has none - so the scenes follow reading-speed timing.
 */
export function previewProps(base: ProductionReelProps, form: EditorForm, media: ProductionReelProps["media"]): ProductionReelProps {
  const script = shownScript(form);
  return {
    ...base,
    script,
    style: form.style as VideoStyle,
    captions: form.captions,
    media,
    direction: form.direction,
    format: formatOf(form),
    production: { ...form.production, audio: effectiveAudio(form) },
    voiceUrl: null,
    words: [],
    voiceMs: 0,
    sceneStartsMs: silentTiming(script).sceneStartsMs,
    spokenParts: null,
    concept: true,
  };
}

/** A part of the script: its spokenParts index (hook 0, points 1..n, proof n+1, closing n+2). */
export type PartKey = number;

/** The parts a viewer sees for this form, in order, as spokenParts indexes. */
export function visibleParts(props: ProductionReelProps): PartKey[] {
  const n = props.script.points.length;
  const all = Array.from({ length: n + 3 }, (_, i) => i);
  if (!isProduction(props)) return all;
  const production = props.format === "carousel" ? { ...productionOf(props), showHook: true } : productionOf(props);
  return productionParts(props.script, production, props.plan).map((part) => part.part);
}

/** The nearest part shown: the one asked for, else the next one, else the last. */
function nearest(parts: PartKey[], part: PartKey): number {
  const exact = parts.indexOf(part);
  if (exact >= 0) return exact;
  const next = parts.findIndex((value) => value > part);
  return next >= 0 ? next : Math.max(0, parts.length - 1);
}

/** The frame the preview shows a part at: well into its scene, when its words are on screen. */
export function partFrame(props: ProductionReelProps, part: PartKey, fps: number = REEL.fps): number {
  if (isProduction(props)) {
    const timeline = productionTimeline(props, fps);
    const index = nearest(
      timeline.parts.map((value) => value.part),
      part,
    );
    const start = timeline.starts[index] ?? 0;
    return Math.max(0, Math.min(timeline.durationInFrames - 1, start + Math.round((partEnd(timeline, index) - start) * 0.6)));
  }
  const timing = reelTiming(props, fps);
  const index = Math.max(0, Math.min(timing.starts.length - 1, part));
  const start = timing.starts[index] ?? 0;
  return Math.max(0, Math.min(timing.durationInFrames - 1, start + Math.round((sceneEnd(timing, index) - start) * 0.6)));
}

/** The carousel slide a part is on. */
export function partSlide(props: ProductionReelProps, part: PartKey): number {
  return nearest(visibleParts(props), part);
}
