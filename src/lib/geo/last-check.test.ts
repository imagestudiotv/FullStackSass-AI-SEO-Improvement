import { describe, expect, it } from "vitest";

import type { GeoAnswerRecord } from "@/lib/db/schema";
import { lastCheckEngines } from "@/lib/geo/last-check";

const HOUR = 60 * 60 * 1000;
const at = (minutes: number) => new Date(Date.UTC(2026, 10, 28, 12, 0) - minutes * 60_000);
const answer = (engine: string, model: string, webSearch: boolean): GeoAnswerRecord => ({
  engine, model, webSearch, language: "Ukrainian", region: "Ukraine", mentioned: false, position: null,
});

/**
 * The method section reads how the latest check was really asked (review of
 * 2026-11-28: it always said "web search on", though a refused search is
 * asked again without it and stored with webSearch false).
 */
describe("how the latest check was asked", () => {
  it("reads web search and models per assistant from the stored answers", () => {
    const rows = [
      { checkedAt: at(0), engine: "claude,chatgpt", answers: [answer("claude", "claude-haiku-5-5", false), answer("chatgpt", "gpt-5-mini-2026-08-07", true)] },
      { checkedAt: at(2), engine: "claude,chatgpt", answers: [answer("claude", "claude-haiku-5-5", false), answer("chatgpt", "gpt-5-mini-2026-08-07", false)] },
    ];
    expect(lastCheckEngines(rows, HOUR)).toEqual([
      { engine: "claude", models: ["claude-haiku-5-5"], webSearch: "off" },
      { engine: "chatgpt", models: ["gpt-5-mini-2026-08-07"], webSearch: "partly" },
    ]);
  });

  it("looks at the latest check only, not an earlier one", () => {
    const rows = [
      { checkedAt: at(0), engine: "claude", answers: [answer("claude", "claude-haiku-5-5", true)] },
      // A week earlier, without web search: not this check.
      { checkedAt: at(7 * 24 * 60), engine: "claude", answers: [answer("claude", "claude-sonnet-5", false)] },
    ];
    expect(lastCheckEngines(rows, HOUR)).toEqual([{ engine: "claude", models: ["claude-haiku-5-5"], webSearch: "on" }]);
  });

  it("counts a row from before the stored answers as Claude without web search", () => {
    expect(lastCheckEngines([{ checkedAt: at(0), engine: "claude", answers: null }], HOUR)).toEqual([
      { engine: "claude", models: [], webSearch: "off" },
    ]);
    expect(lastCheckEngines([], HOUR)).toEqual([]);
  });
});
