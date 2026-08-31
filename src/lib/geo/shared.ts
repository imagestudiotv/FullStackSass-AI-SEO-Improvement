/**
 * Types and constants shared between GEO server actions and client components.
 *
 * Kept out of actions.ts because that file carries "use server", where every
 * export must be an async function — a type or a constant exported from there
 * is a build error.
 */

export type GeoPromptView = {
  id: string;
  prompt: string;
  isSuggested: boolean;
  active: boolean;
  /** Most recent result for this prompt, when it has ever been checked. */
  latest: {
    mentioned: boolean;
    position: number | null;
    excerpt: string | null;
    checkedAt: Date;
  } | null;
};

export type GeoOverview = {
  score: number;
  mentions: number;
  total: number;
  averagePosition: number | null;
  topCompetitors: { name: string; count: number }[];
  prompts: GeoPromptView[];
  /** When the most recent check ran; null before the first run. */
  lastCheckedAt: Date | null;
};

/** Prompts one website may track. Each is an AI call per run. */
export const MAX_PROMPTS = 20;

/** Longest question we will store. */
export const MAX_PROMPT_LENGTH = 300;
