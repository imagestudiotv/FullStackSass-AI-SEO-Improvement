import {
  PACINGS,
  spokenParts,
  TRANSITIONS,
  type AudioMode,
  type CaptionStyle,
  type CreativeDirection,
  type IdeaCategory,
  type MusicDirection,
  type Pacing,
  type ShotPlan,
  type ShotScene,
  type Transition,
  type VideoFormat,
  type VideoScript,
  type VisualSource,
} from "../formats";
import { boundedShares, MAX_SHARE } from "./learning";

/**
 * Creative variety (client, 2026-11-12: "the system should not repeatedly
 * create videos that look almost identical ... Viral should describe a
 * distinct creative direction, not simply a different script").
 *
 * Each idea gets a CreativeDirection and a ShotPlan. The directions of a
 * batch are chosen here BEFORE the writer runs (it is told each idea's
 * direction, and may only switch to another one allowed for it), and the
 * plan's production recipe - pacing, transitions, music mood, visual mix -
 * is chosen here AFTER, so the rules hold whatever the model answers:
 *  - no two ideas of a batch share a recipe, nor any of the last 7 days';
 *  - no direction above MAX_SHARE of a batch when three or more are possible.
 * Pure.
 */

/** Viral ideas lean to native, non-advert productions; the others keep narration and the original templates in the mix. */
export const DIRECTION_POOLS: Record<IdeaCategory, readonly CreativeDirection[]> = {
  viral: ["meme", "storytelling", "footage", "text_music"],
  educational: ["voiceover", "footage", "animated", "storytelling"],
  authority: ["voiceover", "storytelling", "footage", "animated"],
  promotional: ["footage", "voiceover", "text_music", "animated"],
};

/**
 * The directions an idea may use: its category's, without narration when the
 * customer chose Text + Music, without Text + Music when they chose
 * Voiceover, and without narration for a carousel (slides have no audio).
 */
export function allowedDirections(category: IdeaCategory, format: VideoFormat, audioMode: AudioMode): CreativeDirection[] {
  const pool = DIRECTION_POOLS[category].filter((direction) => {
    if (audioMode === "voiceover" && direction === "text_music") return false;
    if (audioMode === "text_music" && direction === "voiceover") return false;
    if (format === "carousel" && direction === "voiceover") return false;
    return true;
  });
  return pool.length > 0 ? pool : ["animated"];
}

export type Slot = { category: IdeaCategory; format: VideoFormat };

/** A small stable hash (FNV-1a), for seeds and fingerprints; not for security. */
export function stableHash(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** The most ideas one direction may have in a batch of `n` (when three or more directions are possible). */
export const directionCap = (n: number) => Math.max(1, Math.ceil(n * MAX_SHARE));

/**
 * The batch's directions, one per slot: each slot takes, of the directions it
 * allows, the one furthest below its share (learning weights nudge the
 * shares, within bounds), never above the batch cap when another is free,
 * and not the previous slot's when another is free. `seed` rotates the tie
 * order so days differ.
 */
export function assignDirections(
  slots: Slot[],
  audioMode: AudioMode,
  options: { seed?: number; weights?: Partial<Record<CreativeDirection, number>>; recent?: Partial<Record<CreativeDirection, number>> } = {},
): CreativeDirection[] {
  const all = [...new Set(slots.flatMap((slot) => allowedDirections(slot.category, slot.format, audioMode)))];
  const shares = boundedShares(all, options.weights);
  const cap = all.length >= 3 ? directionCap(slots.length) : slots.length;
  const used = new Map<CreativeDirection, number>();
  const seed = options.seed ?? 0;
  const out: CreativeDirection[] = [];
  slots.forEach((slot, index) => {
    const allowed = allowedDirections(slot.category, slot.format, audioMode);
    const rotated = allowed.map((_, i) => allowed[(i + seed + index) % allowed.length]);
    const score = (direction: CreativeDirection) => {
      const count = used.get(direction) ?? 0;
      // Directions used a lot lately count a little against, so the week varies too.
      const lately = (options.recent?.[direction] ?? 0) * 0.15;
      return (count + lately + 1) / Math.max(0.01, shares[direction] ?? 0.1);
    };
    const candidates = rotated.filter((direction) => (used.get(direction) ?? 0) < cap);
    const pool = (candidates.length > 0 ? candidates : rotated).filter((direction) => direction !== out[index - 1]);
    const choices = pool.length > 0 ? pool : candidates.length > 0 ? candidates : rotated;
    let best = choices[0];
    for (const direction of choices) if (score(direction) < score(best)) best = direction;
    used.set(best, (used.get(best) ?? 0) + 1);
    out.push(best);
  });
  return out;
}

/**
 * The writer's proposals reconciled with the rules: a proposal is kept when
 * the slot allows it and the batch cap is not reached, otherwise the planned
 * direction stays - or, when that one is over the cap by now, the least used
 * one the slot allows.
 */
export function settleDirections(slots: Slot[], planned: CreativeDirection[], proposed: (CreativeDirection | null)[], audioMode: AudioMode): CreativeDirection[] {
  const all = new Set(slots.flatMap((slot) => allowedDirections(slot.category, slot.format, audioMode)));
  const cap = all.size >= 3 ? directionCap(slots.length) : slots.length;
  const used = new Map<CreativeDirection, number>();
  return slots.map((slot, index) => {
    const allowed = allowedDirections(slot.category, slot.format, audioMode);
    const under = (direction: CreativeDirection) => (used.get(direction) ?? 0) < cap;
    const wish = proposed[index];
    let direction: CreativeDirection;
    if (wish && allowed.includes(wish) && under(wish)) direction = wish;
    else if (allowed.includes(planned[index]) && under(planned[index])) direction = planned[index];
    else direction = [...allowed].sort((a, b) => (used.get(a) ?? 0) - (used.get(b) ?? 0))[0];
    used.set(direction, (used.get(direction) ?? 0) + 1);
    return direction;
  });
}

/* ------------------------------------------------------------------ plans */

const PACING_BY_DIRECTION: Record<CreativeDirection, readonly Pacing[]> = {
  meme: ["fast", "medium"],
  text_music: ["fast", "medium"],
  footage: ["fast", "medium", "calm"],
  storytelling: ["medium", "calm", "fast"],
  voiceover: ["medium", "fast", "calm"],
  animated: ["medium", "fast"],
};

const TRANSITIONS_BY_DIRECTION: Record<CreativeDirection, readonly Transition[]> = {
  meme: ["cut", "zoom", "glitch", "flash"],
  text_music: ["whip", "flash", "zoom", "slide", "glitch"],
  footage: ["cut", "whip", "zoom", "fade"],
  storytelling: ["fade", "cut", "slide", "zoom"],
  voiceover: ["cut", "zoom", "slide", "fade"],
  animated: ["slide", "zoom", "cut", "whip"],
};

/** Moods for the licensed music when the customer left it on Auto; Worker B maps a mood to a track. */
const MOODS_BY_DIRECTION: Record<CreativeDirection, readonly string[]> = {
  meme: ["playful", "quirky"],
  text_music: ["energetic", "upbeat"],
  footage: ["upbeat", "inspiring"],
  storytelling: ["emotional", "cinematic"],
  voiceover: ["calm", "inspiring"],
  animated: ["upbeat", "corporate"],
};

const MOOD_FOR_MUSIC: Record<Exclude<MusicDirection, "auto" | "none">, string> = {
  cinematic: "cinematic",
  upbeat: "upbeat",
  ambient: "ambient",
};

/** What the writer said a scene should show. */
export type WrittenScene = { query: string; kind: "video" | "image"; overlay: string | null; reaction: string | null };

export type PlanInput = {
  direction: CreativeDirection;
  format: VideoFormat;
  script: VideoScript;
  scenes: WrittenScene[];
  captionStyle: CaptionStyle;
  music: MusicDirection;
  /** Whether the customer has their own pictures/clips (used first in some scenes). */
  ownMedia: boolean;
  /** Whether the idea has an article with a picture. */
  articlePicture: boolean;
  /** Variant counters the variety rules turn until the recipe is new. */
  variant?: { pacing: number; transitions: number; mood: number };
  /** Stock search words for a scene the writer left empty (the idea's title). */
  fallbackQuery: string;
};

const clipText = (value: string | null | undefined, max: number) => (value ? value.replace(/\s+/g, " ").trim().slice(0, max) || null : null);

/** A stock search: English words only from the writer, kept short and free of anything but words. */
function cleanQuery(query: string, fallback: string): string {
  const words = query.replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim().split(" ").slice(0, 8).join(" ");
  return words || fallback.replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim().split(" ").slice(0, 6).join(" ") || "small business work";
}

function sourceFor(input: PlanInput, index: number, count: number): VisualSource {
  if (input.direction === "animated") return index === 0 || index === count - 1 ? "brand" : input.articlePicture ? "article" : "brand";
  if (input.ownMedia && index % 3 === 1) return "customer";
  if (input.articlePicture && index === count - 2) return "article";
  return "stock";
}

/**
 * The ShotPlan of an idea: one scene per spoken part (hook, each point,
 * proof, CTA), each with what to show, its transition and, for memes and
 * stories, the top caption and reaction beat.
 */
export function buildPlan(input: PlanInput): ShotPlan {
  const parts = spokenParts(input.script).length;
  const variant = input.variant ?? { pacing: 0, transitions: 0, mood: 0 };
  const pacings = PACING_BY_DIRECTION[input.direction];
  const pacing = pacings[variant.pacing % pacings.length] ?? PACINGS[variant.pacing % PACINGS.length];
  const pool = TRANSITIONS_BY_DIRECTION[input.direction];
  const transitionAt = (index: number): Transition => {
    if (index === 0) return "cut";
    // Two alternating transitions per video, the pair rotated by the variant.
    const first = pool[variant.transitions % pool.length];
    const second = pool[(variant.transitions + 1 + Math.floor(variant.transitions / pool.length)) % pool.length];
    return index % 2 === 1 ? first : second;
  };
  const moods = MOODS_BY_DIRECTION[input.direction];
  const musicMood = input.music === "none" ? null : input.music === "auto" ? moods[variant.mood % moods.length] : MOOD_FOR_MUSIC[input.music];
  const kindFor = (written: WrittenScene | undefined): "video" | "image" => {
    if (input.format === "carousel") return "image";
    if (input.direction === "animated") return written?.kind === "video" ? "video" : "image";
    return written?.kind ?? "video";
  };
  const scenes: ShotScene[] = Array.from({ length: parts }, (_, index) => {
    const written = input.scenes[index] ?? input.scenes[input.scenes.length - 1];
    const meme = input.direction === "meme";
    const story = input.direction === "storytelling";
    return {
      visual: {
        source: sourceFor(input, index, parts),
        query: cleanQuery(written?.query ?? "", input.fallbackQuery),
        kind: kindFor(written),
      },
      transition: transitionAt(index),
      reaction: meme ? clipText(written?.reaction, 24) : null,
      overlay: meme || story ? clipText(written?.overlay, 70) : null,
    };
  });
  const plan: ShotPlan = { direction: input.direction, pacing, captionStyle: input.captionStyle, musicMood, scenes, recipe: "" };
  plan.recipe = recipeOf(plan);
  return plan;
}

/** The production fingerprint the variety rules compare: everything that makes two videos look and sound alike. */
export function recipeOf(plan: Omit<ShotPlan, "recipe">): string {
  const transitions = [...new Set(plan.scenes.slice(1).map((scene) => scene.transition))].sort().join("+") || "cut";
  const visuals = plan.scenes.map((scene) => `${scene.visual.source[0]}${scene.visual.kind[0]}`).join("");
  return [plan.direction, plan.pacing, transitions, plan.captionStyle, plan.musicMood ?? "none", visuals].join("|");
}

/**
 * Makes every recipe of a batch new: an idea whose recipe is already used
 * (in the batch or in the last 7 days) gets the next pacing, transition pair
 * or music mood until it is not. `rebuild` re-plans an idea with a variant.
 */
export function enforceRecipes<T>(
  items: T[],
  planOf: (item: T) => ShotPlan,
  rebuild: (item: T, variant: { pacing: number; transitions: number; mood: number }) => ShotPlan,
  recent: Iterable<string>,
  seed = 0,
): ShotPlan[] {
  const seen = new Set(recent);
  return items.map((item, index) => {
    let plan = planOf(item);
    const start = (seed + index) % 7;
    for (let attempt = 0; seen.has(plan.recipe) && attempt < 60; attempt++) {
      const step = start + attempt + 1;
      plan = rebuild(item, { pacing: step % 3, transitions: Math.floor(step / 3) % (TRANSITIONS.length * 2), mood: Math.floor(step / 21) % 2 });
    }
    seen.add(plan.recipe);
    return plan;
  });
}

/** A plan held to a script after an edit: one scene per spoken part, extra points copying the last point's look. */
export function alignPlan(plan: ShotPlan, script: VideoScript): ShotPlan {
  const parts = spokenParts(script).length;
  if (plan.scenes.length === parts) return plan;
  const hook = plan.scenes[0];
  const tail = plan.scenes.slice(-2);
  const points = plan.scenes.slice(1, -2);
  const wantedPoints = parts - 3;
  const lastPoint = points[points.length - 1] ?? hook;
  const nextPoints = Array.from({ length: wantedPoints }, (_, index) => points[index] ?? { ...lastPoint, transition: lastPoint.transition });
  const scenes = [hook, ...nextPoints, ...tail].slice(0, parts);
  const next = { ...plan, scenes };
  return { ...next, recipe: recipeOf(next) };
}
