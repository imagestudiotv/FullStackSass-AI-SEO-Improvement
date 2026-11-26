import type { HookType } from "../formats";
import { HOOK_LIBRARY, type HookLibraryClip } from "./hook-library";
import type { StockCandidate } from "./types";

/** A hook clip ready to store: the stock file plus the library's timing and crop. */
export type HookCandidate = StockCandidate & { climaxMs: number | null; focalX: number | null };

/**
 * The library's clips of a type for a video, in the order to try: the ones
 * whose tags share the most words with the search words first, rotated by the
 * video's seed so two videos with the same words still open on different
 * clips. Clips the video already uses ("<provider>:<id>") are left out. Pure.
 */
export function libraryPicks<Clip extends HookLibraryClip = HookLibraryClip>(
  type: HookType,
  query: string,
  seed: number,
  exclude: Set<string> = new Set(),
  library: readonly Clip[] = HOOK_LIBRARY as readonly Clip[],
  provider = "pixabay",
): Clip[] {
  const words = new Set(query.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 2));
  const scored = library
    .filter((clip) => clip.type === type && !exclude.has(`${provider}:${clip.id}`))
    .map((clip) => ({ clip, hits: clip.tags.filter((tag) => tag.toLowerCase().split(/\s+/).some((word) => words.has(word))).length }))
    .sort((a, b) => b.hits - a.hits || a.clip.id.localeCompare(b.clip.id));
  if (!scored.length) return [];
  // The matching clips (or, with none matching, all of the type) take turns at the front.
  const matching = scored.filter((entry) => entry.hits > 0).length || scored.length;
  const shift = Math.abs(seed) % matching;
  const front = scored.slice(0, matching);
  return [...front.slice(shift), ...front.slice(0, shift), ...scored.slice(matching)].map((entry) => entry.clip);
}

/** The share of hooked videos that open on one of RepGet's AI clips, the rest on a Pixabay clip (client: "AI:pixabay = 65%:35%" on 2026-11-19, 70:30 on 2026-11-21). */
export const AI_HOOK_SHARE = 0.7;

/**
 * Whether a video opens on an AI clip: fixed for the video (its seed), true
 * for about AI_HOOK_SHARE of videos. The seed is mixed first, so the choice
 * never moves in step with the clip rotation in libraryPicks (seed % n). Pure.
 */
export function opensOnAiClip(seed: number, share: number = AI_HOOK_SHARE): boolean {
  let x = Math.imul(seed ^ (seed >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x ^= x >>> 16;
  return (x >>> 0) % 1000 < Math.round(share * 1000);
}

/* ------------------------------------------------------- a website's clip order */

/**
 * A clip a website has used: when it last did (the newest of its ideas'
 * written and made times, in ms) and whether one of its videos was made
 * with it. Read once per batch (lib/video/ideas.ts readSiteClips).
 */
export type ClipUse = { lastUsedAt: number; made: boolean };

/** A website's used clips: POV clips by id, hook clips by "<provider>:<id>". */
export type SiteClips = { pov: ReadonlyMap<string, ClipUse>; hooks: ReadonlyMap<string, ClipUse> };

export const NO_SITE_CLIPS: SiteClips = { pov: new Map(), hooks: new Map() };

/** How far along a website is with a clip: 0 never used, 1 in an idea only, 2 in a video it made. */
export function clipStanding(use: ClipUse | undefined): 0 | 1 | 2 {
  return !use ? 0 : use.made ? 2 : 1;
}

/**
 * A library in the order a website takes its clips (client, 2026-11-26: "We
 * don't want same client to having same clips. We need to set a logic that
 * every new client is following a clip order from clip a to clip y"):
 *
 *  1. the clips the website never used, in the library's own order (oldest
 *     batch first, new batches appended at the end), so no clip is skipped
 *     and left unused for ever;
 *  2. once every clip was used: the ones only ever shown in an idea, least
 *     recently used first;
 *  3. then the ones it made a video with, least recently used first;
 *  4. last, the clips this batch already holds (only when nothing else is left).
 *
 * `fit` (higher = better) only breaks ties of equal standing and time - clips
 * used in the same batch were used at the same moment - never the order of
 * never-used clips. Pure.
 */
export function siteClipOrder<Clip extends { id: string }>(
  library: readonly Clip[],
  keyOf: (clip: Clip) => string,
  use: ReadonlyMap<string, ClipUse>,
  batchUsed: ReadonlySet<string> = new Set(),
  fit: (clip: Clip) => number = () => 0,
): Clip[] {
  return library
    .map((clip, index) => {
      const key = keyOf(clip);
      const used = use.get(key);
      return { clip, index, inBatch: batchUsed.has(key), standing: clipStanding(used), at: used?.lastUsedAt ?? 0, fit: used ? fit(clip) : 0 };
    })
    .sort((a, b) => Number(a.inBatch) - Number(b.inBatch) || a.standing - b.standing || a.at - b.at || b.fit - a.fit || a.index - b.index)
    .map((entry) => entry.clip);
}
