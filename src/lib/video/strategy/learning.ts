import { CREATIVE_DIRECTIONS, VIRAL_TECHNIQUES, type CreativeDirection, type ViralTechnique } from "../formats";

/**
 * Learning from the website's own posted videos (client, 2026-11-12: "learn
 * from the performance of the customer's previously published videos"). The
 * numbers read daily (video_ideas.stats) of the last LEARNING_DAYS are
 * grouped by creative direction, category and technique, and turned into
 * soft weights and a short note for the idea writer.
 *
 * Learning never takes over: a weight only nudges shares, which stay within
 * MAX_SHARE and above an exploration floor (boundedShares), so a website
 * whose first storytelling video did well still gets every other direction.
 * Pure: the reader is in lib/video/ideas.ts.
 */

export const LEARNING_DAYS = 60;
/** Posted videos needed before anything is learnt, and per group before it gets a weight. */
export const MIN_VIDEOS = 3;
export const MIN_GROUP = 2;
/** The most one direction or technique may get of a batch, learning included (client: real variety). */
export const MAX_SHARE = 0.4;
/** The least each available direction gets, so new ones keep being tried. */
export const EXPLORATION_SHARE = 0.1;
const MIN_WEIGHT = 0.6;
const MAX_WEIGHT = 1.6;

export type PostedVideo = {
  direction: string;
  category: string;
  techniques: string[];
  stats: Record<string, { views: number; likes: number; comments: number; shares: number }> | null;
};

export type Learning = {
  directionWeights: Partial<Record<CreativeDirection, number>>;
  techniqueWeights: Partial<Record<ViralTechnique, number>>;
  /** Short lines for the writer ("storytelling: 4 videos, 1.8x the usual views"), empty when nothing is known yet. */
  summary: string[];
};

export const NO_LEARNING: Learning = { directionWeights: {}, techniqueWeights: {}, summary: [] };

/** One video's result: its views, with shares, comments and likes counted as stronger signals. */
export function videoScore(stats: PostedVideo["stats"]): number {
  if (!stats) return 0;
  let score = 0;
  for (const platform of Object.values(stats)) {
    const n = (value: unknown) => (typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0);
    score += n(platform?.views) + 2 * n(platform?.likes) + 3 * n(platform?.comments) + 10 * n(platform?.shares);
  }
  return score;
}

const clampWeight = (ratio: number) => Math.min(MAX_WEIGHT, Math.max(MIN_WEIGHT, 0.5 + 0.5 * ratio));

function groupWeights<K extends string>(videos: { keys: string[]; score: number }[], known: readonly K[], mean: number) {
  const groups = new Map<K, number[]>();
  for (const video of videos) {
    for (const key of new Set(video.keys)) {
      if (!(known as readonly string[]).includes(key)) continue;
      const list = groups.get(key as K) ?? [];
      list.push(video.score);
      groups.set(key as K, list);
    }
  }
  const weights: Partial<Record<K, number>> = {};
  const lines: { key: K; count: number; ratio: number }[] = [];
  for (const [key, scores] of groups) {
    if (scores.length < MIN_GROUP) continue;
    const ratio = scores.reduce((a, b) => a + b, 0) / scores.length / mean;
    weights[key] = Number(clampWeight(ratio).toFixed(2));
    lines.push({ key, count: scores.length, ratio });
  }
  return { weights, lines: lines.sort((a, b) => b.ratio - a.ratio) };
}

export function learnFrom(videos: PostedVideo[]): Learning {
  const scored = videos.map((video) => ({ ...video, score: videoScore(video.stats) })).filter((video) => video.stats);
  if (scored.length < MIN_VIDEOS) return NO_LEARNING;
  const mean = scored.reduce((a, b) => a + b.score, 0) / scored.length;
  if (mean <= 0) return NO_LEARNING;
  const directions = groupWeights(scored.map((v) => ({ keys: [v.direction], score: v.score })), CREATIVE_DIRECTIONS, mean);
  const techniques = groupWeights(scored.map((v) => ({ keys: v.techniques, score: v.score })), VIRAL_TECHNIQUES, mean);
  const categories = groupWeights(scored.map((v) => ({ keys: [v.category], score: v.score })), ["viral", "educational", "authority", "promotional"] as const, mean);
  const line = (label: string) => (item: { key: string; count: number; ratio: number }) =>
    `${label} "${item.key}": ${item.count} videos, ${item.ratio.toFixed(1)}x the website's average result`;
  const pick = <T,>(list: T[]) => (list.length > 3 ? [...list.slice(0, 2), list[list.length - 1]] : list);
  return {
    directionWeights: directions.weights,
    techniqueWeights: techniques.weights,
    summary: [
      `Based on ${scored.length} posted videos of the last ${LEARNING_DAYS} days (a hint, not a rule - keep exploring other approaches):`,
      ...pick(directions.lines).map(line("Direction")),
      ...pick(categories.lines).map(line("Category")),
      ...pick(techniques.lines).map(line("Technique")),
    ].slice(0, 10),
  };
}

/**
 * Shares for `keys` from soft weights (missing = 1), each at most `cap` and
 * at least `floor`, adding up to 1. With fewer than three keys the cap gives
 * way (two directions are 50/50 at best). Water-filling: clamp what breaks a
 * bound, spread the rest over the others by weight, repeat.
 */
export function boundedShares<K extends string>(
  keys: readonly K[],
  weights: Partial<Record<K, number>> = {},
  cap = MAX_SHARE,
  floor = EXPLORATION_SHARE,
): Record<K, number> {
  const out = {} as Record<K, number>;
  if (keys.length === 0) return out;
  const n = keys.length;
  const hi = Math.max(cap, 1 / n);
  const lo = Math.min(floor, 1 / n);
  const weight = (key: K) => Math.max(0.0001, weights[key] ?? 1);
  const fixed = new Map<K, number>();
  for (let round = 0; round < n * 2 + 2; round++) {
    const free = keys.filter((key) => !fixed.has(key));
    if (free.length === 0) break;
    const left = 1 - [...fixed.values()].reduce((a, b) => a + b, 0);
    const total = free.reduce((a, key) => a + weight(key), 0);
    for (const key of free) out[key] = (left * weight(key)) / total;
    const over = free.filter((key) => out[key] > hi + 1e-9);
    if (over.length > 0) {
      for (const key of over) fixed.set(key, hi);
      continue;
    }
    const under = free.filter((key) => out[key] < lo - 1e-9);
    if (under.length > 0) {
      for (const key of under) fixed.set(key, lo);
      continue;
    }
    break;
  }
  for (const [key, value] of fixed) out[key] = value;
  return out;
}
