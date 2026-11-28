import type { GeoAnswerRecord } from "@/lib/db/schema";
import type { AnswerOutcome, CheckOutcome } from "@/lib/geo/check";

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

/**
 * One question in one check, as geo_results stores it. Since 2026-11-27 each
 * assistant is asked the question several times and the row keeps the
 * share; an older row is one answer, and its share fields are null.
 */
export type ScoredOutcome = CheckOutcome & {
  /** Answers behind the row; null for an older row (one answer). */
  samples?: number | null;
  /** Answers that named the business. */
  mentionCount?: number | null;
  /** Mean position credit over the answers, 0-1. */
  weight?: number | null;
  /** Mean position over the answers that named the business. */
  averagePosition?: number | null;
};

/** What a row stands for, older rows read as one answer each. */
export function shareOf(o: ScoredOutcome): { samples: number; named: number; weight: number; averagePosition: number | null } {
  const samples = o.samples ?? 1;
  const named = o.mentionCount ?? (o.mentioned ? 1 : 0);
  return {
    samples,
    named,
    weight: o.weight ?? positionWeight(o.position),
    averagePosition: o.averagePosition ?? (o.mentioned ? o.position : null),
  };
}

/** One question's answers in one check, from every assistant asked, as the row geo_results keeps. */
export type CombinedOutcome = Required<Pick<ScoredOutcome, "samples" | "mentionCount" | "weight" | "averagePosition">> &
  CheckOutcome & { engines: string[]; answers: GeoAnswerRecord[] };

/**
 * Several answers to one question become one row: "named in 2 of 3".
 *
 * One answer is a sample of one - the same question asked again can name
 * other businesses - so a row from a single answer said "named" or "not
 * named" on luck. The weight is the mean position credit over EVERY answer,
 * so a business named first in one answer of three earns a third of a
 * first place, not a whole one. Null for no answers: nothing is recorded.
 */
export function combineAnswers(answers: AnswerOutcome[]): CombinedOutcome | null {
  if (answers.length === 0) return null;
  const named = answers.filter((a) => a.mentioned && a.position !== null);
  const positions = named.map((a) => a.position as number);
  const averagePosition = positions.length > 0 ? Math.round((positions.reduce((x, y) => x + y, 0) / positions.length) * 10) / 10 : null;
  const weight = answers.reduce((sum, a) => sum + positionWeight(a.mentioned ? a.position : null), 0) / answers.length;

  // Rivals by how many answers named them, then first seen.
  const counts = new Map<string, { name: string; count: number; first: number }>();
  let order = 0;
  for (const answer of answers) {
    const seen = new Set<string>();
    for (const name of answer.competitors) {
      const key = name.toLowerCase().trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const entry = counts.get(key);
      if (entry) entry.count += 1;
      else counts.set(key, { name: name.trim(), count: 1, first: order++ });
    }
  }

  return {
    samples: answers.length,
    mentionCount: named.length,
    weight: Math.round(weight * 10_000) / 10_000,
    averagePosition,
    mentioned: named.length > 0,
    position: averagePosition === null ? null : Math.round(averagePosition),
    competitors: [...counts.values()].sort((a, b) => b.count - a.count || a.first - b.first).map((e) => e.name).slice(0, 25),
    excerpt: answers.find((a) => a.excerpt)?.excerpt ?? null,
    cited: answers.some((a) => a.cited),
    engines: [...new Set(answers.map((a) => a.engine))],
    answers: answers.map((a) => ({
      engine: a.engine,
      model: a.model,
      webSearch: a.webSearch,
      language: a.language,
      region: a.region,
      mentioned: a.mentioned,
      position: a.position,
    })),
  };
}

export type GeoSummary = {
  /** 0-100. Position-weighted, not a bare mention rate. */
  score: number;
  /** Checks where the brand was named. */
  mentions: number;
  /** Total checks in the sample. */
  total: number;
  /** Answers behind those checks (several per question since 2026-11-27). */
  answers: number;
  /** Answers that named the business. */
  answersNamed: number;
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
export function summarise(outcomes: ScoredOutcome[]): GeoSummary {
  if (outcomes.length === 0) {
    return {
      score: 0,
      mentions: 0,
      total: 0,
      answers: 0,
      answersNamed: 0,
      averagePosition: null,
      topCompetitors: [],
    };
  }

  const mentioned = outcomes.filter((o) => o.mentioned);
  const shares = outcomes.map(shareOf);
  const weighted = shares.reduce((sum, s) => sum + s.weight, 0);

  /*
    The mean position over every answer that named the business: a question
    named in three answers counts three times, one named once counts once.
  */
  let positionSum = 0;
  let positionCount = 0;
  for (const share of shares) {
    if (share.averagePosition === null || share.named === 0) continue;
    positionSum += share.averagePosition * share.named;
    positionCount += share.named;
  }

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
    answers: shares.reduce((sum, s) => sum + s.samples, 0),
    answersNamed: shares.reduce((sum, s) => sum + s.named, 0),
    averagePosition: positionCount > 0 ? Math.round((positionSum / positionCount) * 10) / 10 : null,
    topCompetitors: [...tally.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
  };
}
