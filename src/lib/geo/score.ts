import type { CheckOutcome } from "@/lib/geo/check";

/**
 * Turning a set of checks into one number.
 *
 * A bare mention rate ("named in 4 of 10 answers") hides the thing customers
 * most want to know: whether they are the first name an assistant gives or an
 * afterthought near the bottom. Assistants list their strongest recommendation
 * first, and attention drops steeply down that list — being named fifth is far
 * closer to being absent than to being named first.
 *
 * So position is weighted, not just presence.
 */

/** Credit for a mention at 1-based `position`. */
export function positionWeight(position: number | null): number {
  if (position === null || position < 1) return 0;
  // 1st -> 1.00, 2nd -> 0.70, 3rd -> 0.55, 4th -> 0.45 ... flattening out.
  // Deliberately steep at the top, where the real difference in attention is.
  return 1 / (1 + 0.43 * Math.log(position) + 0.1 * (position - 1));
}

export type GeoSummary = {
  /** 0-100. Position-weighted, not a bare mention rate. */
  score: number;
  /** Checks where the brand was named. */
  mentions: number;
  /** Total checks in the sample. */
  total: number;
  /** Mean position across mentions only; null when never mentioned. */
  averagePosition: number | null;
  /** Rival brands by how often they were named, most frequent first. */
  topCompetitors: { name: string; count: number }[];
};

/**
 * Summarises checks into the numbers shown on the panel.
 *
 * An empty sample scores 0 with `total: 0`, which the UI distinguishes from a
 * real zero — "never checked" and "checked and never mentioned" must not look
 * the same, since only the second is a problem the customer can act on.
 */
export function summarise(outcomes: CheckOutcome[]): GeoSummary {
  if (outcomes.length === 0) {
    return {
      score: 0,
      mentions: 0,
      total: 0,
      averagePosition: null,
      topCompetitors: [],
    };
  }

  const mentioned = outcomes.filter((o) => o.mentioned);
  const weighted = outcomes.reduce(
    (sum, o) => sum + positionWeight(o.position),
    0,
  );

  const positions = mentioned
    .map((o) => o.position)
    .filter((p): p is number => p !== null);

  /**
   * Counted case-insensitively so "Bright Smile" and "bright smile" are one
   * competitor, but the first spelling seen is kept for display — lowercasing
   * a brand name in the UI looks like a bug.
   */
  const tally = new Map<string, { name: string; count: number }>();
  for (const outcome of outcomes) {
    // A brand named twice in one answer is still one appearance.
    const seen = new Set<string>();
    for (const name of outcome.competitors) {
      const key = name.toLowerCase().trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const existing = tally.get(key);
      if (existing) existing.count += 1;
      else tally.set(key, { name: name.trim(), count: 1 });
    }
  }

  return {
    score: Math.round((weighted / outcomes.length) * 100),
    mentions: mentioned.length,
    total: outcomes.length,
    averagePosition:
      positions.length > 0
        ? Math.round(
            (positions.reduce((a, b) => a + b, 0) / positions.length) * 10,
          ) / 10
        : null,
    topCompetitors: [...tally.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
  };
}
