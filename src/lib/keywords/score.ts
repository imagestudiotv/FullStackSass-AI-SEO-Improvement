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

/**
 * What kind of website the keywords are for (lib/keywords/site-type.ts).
 *
 * "business": it sells something - products, a service, bookings.
 * "publisher": it lives from its readers - a blog, magazine, news or content
 * site, earning from ads or affiliate links rather than from a sale.
 */
export type SiteType = "business" | "publisher";

export type ScoreInput = {
  volume: number | null;
  /**
   * 0-100, as returned by the provider. Higher means harder to rank. 0 is
   * read as unknown (knownDifficulty), never as "easy".
   */
  difficulty: number | null;
  cpc: number | null;
  intent: SearchIntent | null;
};

/**
 * Intent weighting, by site type.
 *
 * For a business, someone searching "dental implants cost" is close to
 * booking; someone searching "what is a molar" is not a customer.
 *
 * For a publisher it is the other way round: the reader with a question IS
 * the audience. The business weights buried every informational search on a
 * Ukrainian greetings site, whose whole plan then leaned on "ready to buy"
 * terms nobody reads it for (review of 2026-11-27).
 *
 * Navigational terms are usually someone else's brand name - real traffic,
 * but not winnable and not ours - for both.
 */
const INTENT_WEIGHT: Record<SiteType, Record<SearchIntent, number>> = {
  business: {
    transactional: 1.0,
    commercial: 0.9,
    informational: 0.45,
    navigational: 0.15,
  },
  publisher: {
    informational: 1.0,
    commercial: 0.85,
    transactional: 0.6,
    navigational: 0.15,
  },
};

/**
 * A difficulty the provider actually measured, or null.
 *
 * DataForSEO answers 0 where it had nothing to measure from, which in a sparse
 * market is most keywords (review of 2026-11-27: every keyword "Competition:
 * Low", the day's article "difficulty 0/100"). A real 0 is vanishingly rare,
 * so 0 counts as unknown: shown as a dash, and scored like a missing value
 * rather than as the easiest keyword there is.
 */
export function knownDifficulty(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return Math.min(Math.round(value), 100);
}

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
 * An unknown difficulty (null, or the provider's 0) is treated as 50. Assuming
 * a missing value is easy would promote exactly the keywords we know least
 * about.
 */
function difficultyScore(difficulty: number | null): number {
  const value = knownDifficulty(difficulty) ?? 50;
  return Math.pow(1 - value / 100, 2);
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

export function scoreKeyword(input: ScoreInput, siteType: SiteType = "business"): number {
  /**
   * Intent is weighted as heavily as difficulty, and volume deliberately less.
   * For a business, a high-volume, low-difficulty encyclopaedia term ("what is
   * a molar") is easy to rank for and brings traffic that never books an
   * appointment. For a publisher that same reader is the point - which is why
   * the weights depend on the site type.
   */
  const weights = INTENT_WEIGHT[siteType] ?? INTENT_WEIGHT.business;
  // Unknown intent: the site's informational weight, neither promoted nor buried.
  const intent = input.intent ? weights[input.intent] : weights.informational;

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
  return (knownDifficulty(input.difficulty) ?? 50) >= 70;
}

export function rankKeywords<T extends ScoreInput>(
  keywords: T[],
  siteType: SiteType = "business",
): (T & { priorityScore: number })[] {
  return keywords
    .map((keyword) => ({ ...keyword, priorityScore: scoreKeyword(keyword, siteType) }))
    .sort((a, b) => b.priorityScore - a.priorityScore);
}
