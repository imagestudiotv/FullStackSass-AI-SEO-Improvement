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

/** The four labels any messages section carrying them provides (app.common, app.reports). */
export type IntentLabels = {
  intentCommercial: string;
  intentTransactional: string;
  intentInformational: string;
  intentNavigational: string;
};

/**
 * A keyword's search intent in the reader's language. The stored value is an
 * English code ("informational"), and showing it as stored put English words
 * on every other locale's keyword table and plan (outside review of
 * 2026-11-28). An unknown code is shown as stored.
 */
export function intentLabel(intent: string, t: IntentLabels): string {
  switch (intent) {
    case "commercial":
      return t.intentCommercial;
    case "transactional":
      return t.intentTransactional;
    case "informational":
      return t.intentInformational;
    case "navigational":
      return t.intentNavigational;
    default:
      return intent;
  }
}
