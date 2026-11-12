import { DURATION_SECONDS, type CreativeDirection, type DurationRange, type ResolvedAudio, type VideoFormat } from "../formats";

/**
 * How long an idea's script may be for its target length (settings.duration,
 * client 2026-11-12). Narration runs at about 2.4 words a second; Text +
 * Music has no voice, so its words are on-screen text, read at about 2.5-3
 * words a second, each scene held for at least MIN_SCENE_SECONDS. A Story is
 * 60 seconds at most. Pure.
 */

export const NARRATED_WORDS_PER_SECOND = 2.4;
export const READ_WORDS_PER_SECOND = 2.75;
export const MIN_SCENE_SECONDS = 1.6;

/**
 * The most points a script may have. The original templates (direction
 * "animated") and carousels show up to TEMPLATE_MAX_POINTS; the new
 * productions (Worker B) take up to MAX_POINTS for the longer lengths.
 */
export const MAX_POINTS = 6;
export const TEMPLATE_MAX_POINTS = 4;
export const MIN_POINTS = 2;

const POINTS: Record<DurationRange, { min: number; max: number }> = {
  "15-30": { min: 2, max: 3 },
  "30-45": { min: 3, max: 4 },
  "45-60": { min: 4, max: 5 },
  "60-90": { min: 5, max: 6 },
};

export type LengthPlan = {
  seconds: { min: number; max: number };
  words: { min: number; max: number };
  points: { min: number; max: number };
};

export function maxPointsFor(direction: CreativeDirection, format: VideoFormat): number {
  return direction === "animated" || format === "carousel" ? TEMPLATE_MAX_POINTS : MAX_POINTS;
}

export function lengthPlan(duration: DurationRange, audio: ResolvedAudio, format: VideoFormat, direction: CreativeDirection): LengthPlan {
  const base = DURATION_SECONDS[duration] ?? DURATION_SECONDS["30-45"];
  const seconds = format === "story" ? { min: Math.min(base.min, 45), max: Math.min(base.max, 60) } : { ...base };
  const cap = maxPointsFor(direction, format);
  const wanted = POINTS[duration] ?? POINTS["30-45"];
  const points = { min: Math.min(wanted.min, cap), max: Math.min(wanted.max, cap) };
  if (format === "carousel") {
    // Slides are read at the viewer's pace: enough to be worth a swipe, short enough for one slide each.
    return { seconds, words: { min: 50, max: 140 }, points };
  }
  if (audio === "text_music") {
    // Scenes (hook, points, proof, CTA) each need time on screen: fewer points when they cannot fit.
    const sceneRoom = Math.floor(seconds.max / MIN_SCENE_SECONDS) - 3;
    const max = Math.max(MIN_POINTS, Math.min(points.max, sceneRoom));
    return {
      seconds,
      words: { min: Math.round(seconds.min * 1.5), max: Math.round(seconds.max * READ_WORDS_PER_SECOND) },
      points: { min: Math.min(points.min, max), max },
    };
  }
  return {
    seconds,
    words: { min: Math.round(seconds.min * NARRATED_WORDS_PER_SECOND), max: Math.round(seconds.max * NARRATED_WORDS_PER_SECOND) },
    points,
  };
}
