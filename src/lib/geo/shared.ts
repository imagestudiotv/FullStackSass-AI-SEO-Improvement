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
  /**
   * Score from the run before the most recent one, for a change indicator.
   *
   * Null until a website has been checked twice — the first run has nothing to
   * compare against, and showing "+42" for it would invent a rise from zero
   * that never happened.
   */
  previousScore: number | null;
};

/**
 * Prompts one website may track, by plan tier. Each is an AI call per run,
 * against every engine — so this is the main cost driver of the feature and
 * the reason it is not unlimited.
 *
 * The client set these: "We are giving 20 prompts ready for grow plan, and 50
 * selected for scale plan."
 */
export const PROMPTS_BY_TIER: Record<string, number> = {
  grow: 20,
  scale: 50,
};

/**
 * Allowance for a website with no plan, or a plan not listed above.
 *
 * Matches Grow rather than zero: a customer on a withdrawn tier, or one
 * looking at the setup screen before the subscription webhook has landed,
 * should see a working screen rather than an empty one that says they may
 * track nothing.
 */
export const DEFAULT_MAX_PROMPTS = 20;

export function maxPromptsForTier(tier: string | null | undefined): number {
  return (tier && PROMPTS_BY_TIER[tier]) || DEFAULT_MAX_PROMPTS;
}

/**
 * The ceiling any plan can reach, for validation that has no tier to hand.
 *
 * Kept as the old constant's name so existing call sites still compile; the
 * per-tier figure above is what the UI and the add action actually enforce.
 */
export const MAX_PROMPTS = Math.max(...Object.values(PROMPTS_BY_TIER));

/** Longest question we will store. */
export const MAX_PROMPT_LENGTH = 300;
