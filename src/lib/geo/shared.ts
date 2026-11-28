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
  /** The language a suggested question was written in; null for the customer's own or an older one. */
  language?: string | null;
  /** Most recent result for this prompt, when it has ever been checked. */
  latest: {
    mentioned: boolean;
    position: number | null;
    excerpt: string | null;
    checkedAt: Date;
    /** Answers behind it (1 for a check before 2026-11-27) and how many named the business. */
    samples?: number;
    mentionCount?: number;
    /** Mean position over the answers that named it. */
    averagePosition?: number | null;
  } | null;
};

export type GeoOverview = {
  score: number;
  mentions: number;
  total: number;
  /** Answers behind the latest results, and how many named the business. */
  answers: number;
  answersNamed: number;
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
  /** How the latest check was asked, from its stored answers (lib/geo/last-check.ts); empty before the first. */
  lastCheck?: GeoCheckEngine[];
};

/** Web search in a check: on for every answer, off for every answer, or off for some. */
export type GeoSearchUse = "on" | "off" | "partly";

/** One assistant as the latest check really asked it (geo_results.answers). */
export type GeoCheckEngine = {
  /** The engine id ("claude", "chatgpt", "gemini"). */
  engine: string;
  /** The models that answered, as the provider reported them; empty when not recorded. */
  models: string[];
  webSearch: GeoSearchUse;
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
  // Launch is what Grow was at this price (scripts/plan-catalog.mjs).
  launch: 20,
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

/**
 * runGeoCheck's refusal when the website's checks for the last seven days
 * are used (lib/geo/check-limits.ts). The window rolls - it is not a
 * calendar week, and the Monday run takes a slot like a press - so the
 * refusal carries the moment the next check is available (weeklyCapError)
 * rather than promising "Monday" (review of 2026-11-28).
 */
export const WEEKLY_CAP_ERROR = "This website's AI visibility checks for the last seven days are used.";
const NEXT_CHECK = " The next check is available from ";

/** The refusal, with when the next check is available when that is known. */
export function weeklyCapError(next: Date | null): string {
  return next ? `${WEEKLY_CAP_ERROR}${NEXT_CHECK}${next.toISOString()}.` : WEEKLY_CAP_ERROR;
}

/** Reads weeklyCapError back: undefined when `error` is not it, null when it carries no time. */
export function weeklyCapNext(error: string): Date | null | undefined {
  if (!error.startsWith(WEEKLY_CAP_ERROR)) return undefined;
  const at = error.slice(WEEKLY_CAP_ERROR.length).startsWith(NEXT_CHECK)
    ? new Date(error.slice(WEEKLY_CAP_ERROR.length + NEXT_CHECK.length).replace(/\.$/, ""))
    : null;
  return at && !Number.isNaN(at.getTime()) ? at : null;
}
/** regenerateGeoPrompts' refusals. */
export const REGENERATE_LIMIT_ERROR = "Questions can be written again a few times a day. Please try again tomorrow.";
export const REGENERATE_FAILED_ERROR = "Could not write new questions. Your questions are unchanged. Try again.";

/** The event that writes a website's questions again after its article language changed (inngest/functions/first-visibility-questions.ts). */
export const GEO_REGENERATE_EVENT = "geo/questions.regenerate";

/**
 * How this deployment checks, for the method section: built on the server
 * (ai-visibility/page.tsx) from the settings the job reads, never written
 * into the copy.
 */
export type GeoMethod = {
  /**
   * The assistants asked, with the model and web search: as the latest check
   * stored them (GeoOverview.lastCheck), or before any check, as this
   * deployment will ask (lib/geo/engines.ts enginesInUse). An empty model
   * is one an older check did not record.
   */
  engines: { name: string; model: string; webSearch: GeoSearchUse }[];
  /** Times each question is put to each assistant per check. */
  runs: number;
  /** The language and market questions are written and asked in (lib/geo/market.ts). */
  language: string;
  region: string | null;
  /** Checks a website may have in seven days, the weekly one included. */
  weeklyChecks: number;
};
