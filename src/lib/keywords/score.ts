/**
 * Keyword prioritisation.
 *
 * This is the judgement the product is actually selling. Search volume alone is
 * a trap: a term with 12,000 searches and difficulty 78 is national-brand
 * territory and a small business will not rank for it in any useful timeframe,
 * while 320 searches at difficulty 12 can be won in weeks and converts. Getting
 * this wrong produces a calendar full of articles that never rank.
 *
 * Scores are 0-100 and only meaningful RELATIVE to each other within one site.
 */

export type SearchIntent =
  | "transactional"
  | "commercial"
  | "informational"
  | "navigational";

export type ScoreInput = {
  volume: number | null;
  /** 0-100, as returned by the provider. Higher means harder to rank. */
  difficulty: number | null;
  cpc: number | null;
  intent: SearchIntent | null;
};

/**
 * Intent weighting.
 *
 * Someone searching "dental implants cost" is close to booking; someone
 * searching "what is a molar" is not a customer. Navigational terms are usually
 * a competitor's brand name — real traffic, but not winnable and not ours.
 */
const INTENT_WEIGHT: Record<SearchIntent, number> = {
  transactional: 1.0,
  commercial: 0.9,
  informational: 0.45,
  navigational: 0.15,
};

/**
 * Volume, compressed logarithmically.
 *
 * The gap between 100 and 1,000 searches matters far more than the gap between
 * 10,000 and 11,000. Linear scaling would let a few huge, unwinnable head terms
 * dominate the ranking and crowd out everything achievable.
 */
function volumeScore(volume: number | null): number {
  if (!volume || volume <= 0) return 0;
  // log10(10000) = 4, so 10k searches saturates at 1.0.
  return Math.min(Math.log10(volume) / 4, 1);
}

/**
 * Difficulty, inverted and curved.
 *
 * Squaring the inverse punishes hard keywords disproportionately: difficulty 40
 * scores 0.36 while difficulty 80 scores 0.04. That is deliberate — the
 * difference between "hard" and "hopeless" should be large, not linear.
 *
 * An unknown difficulty is treated as 50 rather than 0. Assuming a missing
 * value is easy would promote exactly the keywords we know least about.
 */
function difficultyScore(difficulty: number | null): number {
  const value = difficulty ?? 50;
  const clamped = Math.min(Math.max(value, 0), 100);
  return Math.pow(1 - clamped / 100, 2);
}

/**
 * CPC as a weak commercial signal.
 *
 * Advertisers only bid on terms that convert, so a high CPC is evidence of
 * commercial value. Weak, because it also tracks how crowded the ad auction is.
 */
function cpcScore(cpc: number | null): number {
  if (!cpc || cpc <= 0) return 0.3; // Neutral when unknown.
  return Math.min(Math.log10(cpc + 1) / Math.log10(11), 1); // €10 saturates.
}

/**
 * Weights. Difficulty carries the most because winnability is the constraint:
 * a keyword that cannot be ranked for is worth nothing regardless of volume.
 */
const WEIGHTS = {
  difficulty: 0.35,
  volume: 0.2,
  intent: 0.35,
  cpc: 0.1,
} as const;

export function scoreKeyword(input: ScoreInput): number {
  /**
   * Intent is weighted as heavily as difficulty, and volume deliberately less.
   * A high-volume, low-difficulty encyclopaedia term ("what is a molar") is
   * easy to rank for and brings traffic that never books an appointment.
   * Ranking those first would fill the calendar with articles that look
   * successful in analytics and produce no customers.
   */
  const intent = input.intent ? INTENT_WEIGHT[input.intent] : 0.45;

  const raw =
    difficultyScore(input.difficulty) * WEIGHTS.difficulty +
    volumeScore(input.volume) * WEIGHTS.volume +
    intent * WEIGHTS.intent +
    cpcScore(input.cpc) * WEIGHTS.cpc;

  return Math.round(raw * 1000) / 10; // 0-100, one decimal.
}

/**
 * Keywords a small site should not spend its first articles on.
 *
 * Not deleted — a growing site may target them later, and the user can always
 * schedule one by hand. They are only kept out of automatic planning.
 */
export function isOutOfReach(input: ScoreInput): boolean {
  return (input.difficulty ?? 50) >= 70;
}

export function rankKeywords<T extends ScoreInput>(
  keywords: T[],
): (T & { priorityScore: number })[] {
  return keywords
    .map((keyword) => ({ ...keyword, priorityScore: scoreKeyword(keyword) }))
    .sort((a, b) => b.priorityScore - a.priorityScore);
}
