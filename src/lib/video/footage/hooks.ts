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
