import {
  DURATION_SECONDS,
  endsOnClip,
  MAX_REEL_SECONDS,
  REEL,
  spokenParts,
  type CaptionWord,
  type DurationRange,
  type Pacing,
  type ProductionChoices,
  type ShotPlan,
  type ShotScene,
  type Transition,
  type VideoScript,
} from "../lib/video/formats";
import type { ProductionReelProps } from "./props";

/**
 * The timeline of a production (a direction other than "animated"): which
 * parts of the script are on screen, when each starts, and how long the
 * video is. Shared by the composition, the app's Player and the make job, so
 * a preview, the render and the duration checks agree on every frame.
 *
 * Pure: no server imports.
 */

export type SceneRole = "hook" | "point" | "proof" | "cta";

export type ProductionPart = {
  /** Index in spokenParts(script): hook 0, points 1..n, proof n+1, CTA n+2. */
  part: number;
  role: SceneRole;
  /** What the voice says for it (and what silent captions show). */
  spoken: string;
  /** The big on-screen words. */
  title: string;
  /** The supporting line, or null. */
  detail: string | null;
  scene: ShotScene | null;
};

/** The longest Story video (VIDEO_PLATFORM_SPECS storyMaxSeconds for Instagram/Facebook). */
export const STORY_MAX_SECONDS = 60;
/** The music and the last card run on this long after the last word (as timing.ts TAIL_MS). */
export const PRODUCTION_TAIL_MS = 1200;
/** Silent text is read at about 2.5-3 words a second (client: readable text). */
export const READING_WPS: Record<Pacing, number> = { fast: 3, medium: 2.75, calm: 2.5 };
/** The fastest reading speed a silent video is ever squeezed to, to fit its range. */
const FASTEST_WPS = 3.2;
/** No scene is shorter than this, so even one word can be read. */
export const MIN_SCENE_MS = 1600;
/** A silent scene is never stretched past this to reach the range's minimum. */
const MAX_SCENE_MS = 9000;
/** A beat to land on each scene before the words count. */
const SETTLE_MS = 450;

export const DEFAULT_PRODUCTION: ProductionChoices = {
  audio: "voiceover",
  narration: "natural",
  captionStyle: "bold",
  music: "auto",
  duration: "30-45",
  showHook: true,
  includeCta: true,
  ctaText: null,
};

export function productionOf(props: Pick<ProductionReelProps, "production">): ProductionChoices {
  return { ...DEFAULT_PRODUCTION, ...(props.production ?? {}) };
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** A POV clip video (client, 2026-11-21): the clip's length when unknown, and the longest clip played. */
export const POV_CLIP_MS = 10_000;
const POV_MAX_CLIP_MS = 15_000;

/**
 * The parts a production shows, in order: the hook only when showHook (else
 * the video opens straight on the first point), the CTA only when includeCta
 * (with ctaText when set). A Viral video ending on its clip (formats.ts
 * endsOnClip: a POV clip video or a visual hook clip; client, 2026-11-23)
 * never has the CTA. A POV clip video (plan.povClip, client, 2026-11-21) is
 * its POV line alone - always shown, it is the video; no points or proof.
 */
export function productionParts(script: VideoScript, production: ProductionChoices, plan: ShotPlan | null | undefined): ProductionPart[] {
  const spoken = spokenParts(script);
  const n = script.points.length;
  const cta = production.ctaText?.trim() || script.cta;
  const parts: ProductionPart[] = [];
  if (plan?.povClip) {
    parts.push({ part: 0, role: "hook", spoken: script.hook, title: script.hook, detail: null, scene: plan.scenes?.[0] ?? null });
    return parts;
  }
  const closes = production.includeCta && !endsOnClip(plan);
  spoken.forEach((text, part) => {
    const role: SceneRole = part === 0 ? "hook" : part <= n ? "point" : part === n + 1 ? "proof" : "cta";
    if (role === "hook" && !production.showHook) return;
    if (role === "cta" && !closes) return;
    const scene = plan?.scenes?.[part] ?? null;
    if (role === "hook") parts.push({ part, role, spoken: text, title: script.hook, detail: null, scene });
    else if (role === "point") {
      const point = script.points[part - 1];
      parts.push({ part, role, spoken: text, title: point.title, detail: point.detail || null, scene });
    } else if (role === "proof") parts.push({ part, role, spoken: text, title: script.proof, detail: null, scene });
    else parts.push({ part, role, spoken: cta, title: cta, detail: null, scene });
  });
  return parts;
}

/** The text a part shows when there is no voice (what is read). */
export function screenText(part: ProductionPart): string {
  return part.detail ? `${part.title} ${part.detail}` : part.title;
}

export type ReadingTiming = { startsMs: number[]; totalMs: number; fits: boolean; minMs: number; maxMs: number };

/** The seconds a destination allows: the chosen range, the Story limit, MAX_REEL_SECONDS. */
export function durationLimits(range: DurationRange, story: boolean): { minMs: number; maxMs: number } {
  const seconds = DURATION_SECONDS[range] ?? DURATION_SECONDS["30-45"];
  const hard = story ? STORY_MAX_SECONDS : MAX_REEL_SECONDS;
  const maxMs = Math.min(seconds.max, hard) * 1000;
  return { minMs: Math.min(seconds.min * 1000, maxMs), maxMs };
}

/**
 * Silent scene times by reading speed (Text + Music): each scene long enough
 * to read its words at the pacing's speed, stretched evenly to reach the
 * range's minimum, squeezed (never under FASTEST_WPS or MIN_SCENE_MS) to stay
 * within its maximum. `fits` is false when even the squeezed text is longer
 * than the range allows - the job then refuses instead of cutting text.
 */
export function readingTiming(texts: string[], pacing: Pacing, range: DurationRange, story = false): ReadingTiming {
  const { minMs, maxMs } = durationLimits(range, story);
  const budget = maxMs - PRODUCTION_TAIL_MS;
  const length = (wps: number) => texts.map((text) => Math.max(MIN_SCENE_MS, SETTLE_MS + (wordCount(text) / wps) * 1000));
  let lengths = length(READING_WPS[pacing] ?? READING_WPS.medium);
  let total = lengths.reduce((a, b) => a + b, 0);
  let fits = true;
  if (total > budget) {
    const fastest = length(FASTEST_WPS);
    const fastestTotal = fastest.reduce((a, b) => a + b, 0);
    if (fastestTotal > budget) {
      lengths = fastest;
      fits = false;
    } else {
      // Squeeze proportionally between the comfortable and the fastest reading.
      const t = (total - budget) / Math.max(1, total - fastestTotal);
      lengths = lengths.map((ms, i) => ms - (ms - fastest[i]) * t);
    }
  } else if (total + PRODUCTION_TAIL_MS < minMs) {
    const scale = (minMs - PRODUCTION_TAIL_MS) / Math.max(1, total);
    lengths = lengths.map((ms) => Math.min(MAX_SCENE_MS, ms * scale));
  }
  total = lengths.reduce((a, b) => a + b, 0);
  const startsMs: number[] = [];
  let at = 0;
  for (const ms of lengths) {
    startsMs.push(Math.round(at));
    at += ms;
  }
  return { startsMs, totalMs: Math.round(total + PRODUCTION_TAIL_MS), fits, minMs, maxMs };
}

export type ProductionTimeline = {
  parts: ProductionPart[];
  /** Start frame of each part. */
  starts: number[];
  durationInFrames: number;
  /** Whether the words fit the destination's limit (false: the make job refuses). */
  fits: boolean;
  voiced: boolean;
  /** The captions: the voice's words, or the screen text paced at reading speed when silent. */
  words: CaptionWord[];
};

/** Words spread evenly over a scene, for silent captions. */
export function pacedWords(text: string, startMs: number, durationMs: number): CaptionWord[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const usable = Math.max(400, durationMs - SETTLE_MS * 0.6);
  const step = usable / words.length;
  return words.map((word, i) => ({
    text: word,
    startMs: Math.round(startMs + 120 + i * step),
    endMs: Math.round(startMs + 120 + (i + 1) * step - 40),
  }));
}

/**
 * The production's timeline. Voiced: the scenes follow the voice
 * (sceneStartsMs aligned with props.spokenParts, or with every part).
 * Silent: reading speed within the chosen duration range.
 */
export function productionTimeline(props: ProductionReelProps, fps: number = REEL.fps): ProductionTimeline {
  const production = productionOf(props);
  const parts = productionParts(props.script, production, props.plan);
  if (props.plan?.povClip) return povTimeline(props, parts, fps);
  const story = props.format === "story";
  const hardMs = (story ? STORY_MAX_SECONDS : MAX_REEL_SECONDS) * 1000;
  const spokenIndexes = props.spokenParts ?? null;
  const aligned = spokenIndexes ? spokenIndexes.length === parts.length && spokenIndexes.every((p, i) => parts[i]?.part === p) : props.sceneStartsMs.length === parts.length;
  const voiced = Boolean(props.voiceUrl) && props.voiceMs > 0 && aligned && props.sceneStartsMs.length === parts.length;

  let startsMs: number[];
  let totalMs: number;
  let fits: boolean;
  let words: CaptionWord[];
  if (voiced) {
    startsMs = props.sceneStartsMs;
    totalMs = props.voiceMs + PRODUCTION_TAIL_MS;
    // The voice is never cut: a voice past the limit is refused before rendering (lib/video/make.ts).
    fits = totalMs <= durationLimits(production.duration, story).maxMs + PRODUCTION_TAIL_MS;
    words = props.words;
  } else {
    const timing = readingTiming(
      parts.map((part) => screenText(part)),
      props.plan?.pacing ?? "medium",
      production.duration,
      story,
    );
    startsMs = timing.startsMs;
    totalMs = timing.totalMs;
    fits = timing.fits;
    words = parts.flatMap((part, i) => {
      const end = i + 1 < startsMs.length ? startsMs[i + 1] : totalMs - PRODUCTION_TAIL_MS;
      // Silent: the titles are on screen already; the captions carry the supporting line.
      return part.detail ? pacedWords(part.detail, startsMs[i], end - startsMs[i]) : [];
    });
  }
  const durationInFrames = Math.max(1, Math.round((Math.min(totalMs, hardMs) / 1000) * fps));
  const starts: number[] = [];
  startsMs.forEach((ms, i) => {
    const frame = i === 0 ? 0 : Math.round((ms / 1000) * fps);
    const floor = i === 0 ? 0 : starts[i - 1] + 6;
    starts.push(Math.max(0, Math.min(Math.max(frame, floor), durationInFrames - (parts.length - i) * 6)));
  });
  return { parts, starts, durationInFrames, fits: fits && totalMs <= hardMs + PRODUCTION_TAIL_MS, voiced, words };
}

/**
 * A POV clip video's timeline (client, 2026-11-21): silent, the POV line for
 * the clip's whole length (sceneMedia[0], else POV_CLIP_MS; at most 15 s),
 * and nothing after it. The component draws the line itself, so there are no
 * word captions.
 */
function povTimeline(props: ProductionReelProps, parts: ProductionPart[], fps: number): ProductionTimeline {
  const clipMs = props.sceneMedia?.[0]?.durationMs;
  const hookMs = Math.min(POV_MAX_CLIP_MS, typeof clipMs === "number" && clipMs > 0 ? clipMs : POV_CLIP_MS);
  const hookFrames = Math.max(1, Math.round((hookMs / 1000) * fps));
  return { parts, starts: parts.map(() => 0), durationInFrames: hookFrames, fits: true, voiced: false, words: [] };
}

/** The frame part `index` ends at. */
export function partEnd(timeline: Pick<ProductionTimeline, "starts" | "durationInFrames">, index: number): number {
  return index + 1 < timeline.starts.length ? timeline.starts[index + 1] : timeline.durationInFrames;
}

/** Frames a transition into a scene takes (directions/common.tsx Enter; the cover frame waits for it too). */
export const ENTER_FRAMES: Record<Transition, number> = { cut: 0, zoom: 8, whip: 7, slide: 9, flash: 6, glitch: 7, fade: 12 };

/**
 * A visual hook's three moments (ShotPlan.hookClip), in frames of the video
 * and of the clip:
 *  - open: the hook part, the clip full screen from its start;
 *  - inset: the points, the clip small in a corner, slowed (never below
 *    HOOK_MIN_RATE) so it reaches the run-up to its climax only at the
 *    proof, held still before it when it would get there sooner;
 *  - payoff: the proof part, full screen from HOOK_LEAD_MS before the
 *    climax, held on its last frame if the clip ends first.
 * The climax is the hook library's (SceneMedia.climaxMs), else
 * HOOK_CLIMAX_SHARE of the clip. Without the clip's length, or without a
 * hook or proof part on screen, only what can be timed: the opening, or null.
 */
export const HOOK_LEAD_MS = 1000;
export const HOOK_CLIMAX_SHARE = 0.6;
export const HOOK_MIN_RATE = 0.25;

export type HookSegment = { from: number; frames: number; clipFrom: number; rate: number; playFrames: number };
export type HookTiming = { open: HookSegment; inset: HookSegment | null; payoff: HookSegment | null };

export function hookTiming(
  timeline: Pick<ProductionTimeline, "parts" | "starts" | "durationInFrames">,
  clip: { durationMs?: number | null; climaxMs?: number | null },
  fps: number = REEL.fps,
): HookTiming | null {
  if (timeline.parts[0]?.role !== "hook") return null;
  const openFrames = partEnd(timeline, 0);
  const clipFrames = clip.durationMs ? Math.floor((clip.durationMs / 1000) * fps) - 1 : null;
  const proof = timeline.parts.findIndex((part) => part.role === "proof");
  if (!clipFrames || clipFrames < fps || proof < 1) {
    return { open: { from: 0, frames: openFrames, clipFrom: 0, rate: 1, playFrames: clipFrames ? Math.min(openFrames, clipFrames) : openFrames }, inset: null, payoff: null };
  }
  const climax = typeof clip.climaxMs === "number" ? Math.round((clip.climaxMs / 1000) * fps) : Math.round(clipFrames * HOOK_CLIMAX_SHARE);
  // The payoff shows the run-up and the climax, with at least a second of clip left.
  const payoffFrom = Math.max(0, Math.min(climax - Math.round((HOOK_LEAD_MS / 1000) * fps), clipFrames - fps));
  // The opening never shows the payoff: slowed down to half speed at most, then held.
  const openRate = openFrames > payoffFrom ? Math.max(0.5, payoffFrom / Math.max(1, openFrames)) : 1;
  const openPlay = Math.min(openFrames, Math.floor(payoffFrom / openRate));
  const openEnd = Math.min(payoffFrom, Math.round(openPlay * openRate));
  const proofFrom = timeline.starts[proof];
  const insetFrames = proofFrom - openFrames;
  const remaining = payoffFrom - openEnd;
  const insetRate = insetFrames > 0 ? Math.min(1, Math.max(HOOK_MIN_RATE, remaining / insetFrames)) : 1;
  const proofFrames = partEnd(timeline, proof) - proofFrom;
  return {
    open: { from: 0, frames: openFrames, clipFrom: 0, rate: openRate, playFrames: openPlay },
    inset: insetFrames > 0 ? { from: openFrames, frames: insetFrames, clipFrom: openEnd, rate: insetRate, playFrames: Math.max(1, Math.min(insetFrames, Math.floor(remaining / insetRate))) } : null,
    payoff: proofFrames > 0 ? { from: proofFrom, frames: proofFrames, clipFrom: payoffFrom, rate: 1, playFrames: Math.max(1, Math.min(proofFrames, clipFrames - payoffFrom)) } : null,
  };
}

/** Sub-shot length for the footage cuts (client: fast editing), in frames. */
export function cutFrames(pacing: Pacing, fps: number = REEL.fps): number {
  return Math.round((pacing === "fast" ? 1.3 : pacing === "calm" ? 2.5 : 1.9) * fps);
}

/** Safe area for text: out of the bottom fifth and the right-hand buttons; a Story also keeps its top 250 px and bottom 340 px clear. */
export function safeArea(story: boolean): { top: number; bottom: number; left: number; right: number } {
  return story ? { top: 270, bottom: 1580, left: 80, right: 940 } : { top: 130, bottom: 1536, left: 80, right: 940 };
}
