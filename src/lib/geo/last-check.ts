import type { GeoAnswerRecord } from "@/lib/db/schema";
import type { GeoCheckEngine } from "@/lib/geo/shared";

/**
 * How the latest check was really asked, from the answers it stored
 * (geo_results.answers): which assistants answered, with which models, and
 * whether web search was on for each answer.
 *
 * The method section said "web search on" from the settings alone (review of
 * 2026-11-28), but an assistant that refuses the search tool is asked again
 * without it (lib/geo/assistants.ts) and that answer is stored with
 * webSearch false. This is what the page reads instead.
 *
 * A row from before 2026-11-27 has no answers: it was one Claude answer with
 * no web search, and is counted as such with its model unknown.
 *
 * `rows` must be newest first; the latest check is the cluster of rows
 * written within `gapMs` of each other (as getGeoOverview splits runs).
 */
export function lastCheckEngines(
  rows: readonly { checkedAt: Date; engine: string; answers: GeoAnswerRecord[] | null }[],
  gapMs: number,
): GeoCheckEngine[] {
  const byEngine = new Map<string, { models: Set<string>; withSearch: number; withoutSearch: number }>();
  const entry = (engine: string) => {
    let found = byEngine.get(engine);
    if (!found) {
      found = { models: new Set(), withSearch: 0, withoutSearch: 0 };
      byEngine.set(engine, found);
    }
    return found;
  };

  for (let i = 0; i < rows.length; i += 1) {
    if (i > 0 && rows[i - 1].checkedAt.getTime() - rows[i].checkedAt.getTime() > gapMs) break;
    const row = rows[i];
    if (!row.answers || row.answers.length === 0) {
      // An older row: one answer, asked without web search.
      for (const engine of row.engine.split(",").filter(Boolean)) entry(engine).withoutSearch += 1;
      continue;
    }
    for (const answer of row.answers) {
      const e = entry(answer.engine);
      if (answer.model) e.models.add(answer.model);
      if (answer.webSearch) e.withSearch += 1;
      else e.withoutSearch += 1;
    }
  }

  return [...byEngine.entries()].map(([engine, e]) => ({
    engine,
    models: [...e.models].sort(),
    webSearch: e.withoutSearch === 0 ? "on" : e.withSearch === 0 ? "off" : "partly",
  }));
}
