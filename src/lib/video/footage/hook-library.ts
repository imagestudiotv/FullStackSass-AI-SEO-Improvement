import type { HookType } from "../formats";

/**
 * The hand-picked hook clips (client, 2026-11-18): Pixabay videos reviewed
 * once, by type, each with the moment its climax starts - so the opening is
 * cut just before it and the payoff plays from it. Fetched by id through the
 * Pixabay API and stored like any stock file (footage/store.ts); Pixabay
 * Content License. Picked with scripts/hook-library.mjs.
 *
 * A video with a visual hook tries these first (footage/hooks.ts), then a
 * Pixabay search with safe words (strategy/hooks.ts).
 */
export type HookLibraryClip = {
  /** The Pixabay video id. */
  id: string;
  type: HookType;
  /** What it shows, for matching the writer's search words. */
  tags: string[];
  /** Where the climax starts, in ms from the clip's start. */
  climaxMs: number;
  /** Where the subject sits across a landscape clip, 0..1 from the left (the 9:16 crop); default the centre. */
  focalX?: number;
};

export const HOOK_LIBRARY: readonly HookLibraryClip[] = [];
