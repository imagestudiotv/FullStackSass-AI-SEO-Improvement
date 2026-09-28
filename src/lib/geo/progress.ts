import type { GeoPromptView } from "@/lib/geo/shared";

/**
 * Progress of a check the customer just started, for the AI Visibility panel.
 *
 * The check runs as a background job that asks the questions one after
 * another, so answers arrive over minutes. The panel used to wait for "more
 * questions have a result than before", which was wrong both ways:
 *
 *   - it stopped refreshing as soon as the FIRST answer arrived, so the rest
 *     kept showing "Not checked" until the customer reloaded by hand;
 *   - on a re-check, where every question already had an answer, that count
 *     never rose, so the panel said "Checking…" for ever.
 *
 * Instead, the moment the check is started, each question's latest answer
 * time is taken as its baseline; a question is done once it has a NEWER
 * answer. Questions added after the press were not part of that check and are
 * ignored; removed ones no longer count.
 */

/** Baseline: question id -> time of its latest answer (ms), or null if never checked. */
export type CheckBaseline = Map<string, number | null>;

/** How long the panel keeps refreshing before giving up on stragglers. */
export const CHECK_WAIT_LIMIT_MS = 10 * 60 * 1000;

const answeredAt = (prompt: GeoPromptView): number | null =>
  prompt.latest ? new Date(prompt.latest.checkedAt).getTime() : null;

export function checkBaseline(prompts: GeoPromptView[]): CheckBaseline {
  return new Map(prompts.filter((p) => p.active).map((p) => [p.id, answeredAt(p)]));
}

/** Questions from the baseline that have no answer newer than it yet. */
export function questionsStillChecking(baseline: CheckBaseline, prompts: GeoPromptView[]): number {
  let waiting = 0;
  for (const prompt of prompts) {
    if (!baseline.has(prompt.id)) continue;
    const before = baseline.get(prompt.id) ?? null;
    const now = answeredAt(prompt);
    if (now === null || (before !== null && now <= before)) waiting += 1;
  }
  return waiting;
}
