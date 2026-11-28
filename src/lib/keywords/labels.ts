import { knownDifficulty } from "./score";

/**
 * Keyword figures in the reader's words, for client and server components
 * alike (no imports beyond the pure score helpers).
 */

/**
 * A planned topic's card line: "Difficulty 34 · Volume 900". The provider's
 * difficulty 0 is "not measured" (lib/keywords/score.ts) and shows as a dash,
 * as on the keyword table; the old cards printed "Difficulty 0" in English
 * whatever the language (outside review of 2026-11-28). Null when neither
 * figure is known.
 */
export function topicMetrics(
  difficulty: number | null,
  volume: number | null,
  t: { difficulty: string; volume: string },
): string | null {
  const known = knownDifficulty(difficulty);
  if (known === null && volume === null) return null;
  const parts = [`${t.difficulty} ${known ?? "-"}`];
  if (volume !== null) parts.push(`${t.volume} ${volume}`);
  return parts.join(" · ");
}
