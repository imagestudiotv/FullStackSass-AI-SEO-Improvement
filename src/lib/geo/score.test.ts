import { describe, expect, it } from "vitest";

import type { AnswerOutcome } from "@/lib/geo/check";
import { combineAnswers, positionWeight, summarise } from "@/lib/geo/score";

const answer = (over: Partial<AnswerOutcome> = {}): AnswerOutcome => ({
  engine: "claude",
  model: "claude-sonnet-5",
  webSearch: true,
  language: "Ukrainian",
  region: "Ukraine",
  mentioned: false,
  position: null,
  competitors: [],
  excerpt: null,
  cited: false,
  ...over,
});

/**
 * Each question is asked several times and the row keeps the share: one
 * answer is a sample of one (review of 2026-11-27).
 */
describe("several answers to one question", () => {
  it("become one row: named in 2 of 3, position and weight from every answer", () => {
    const row = combineAnswers([
      answer({ mentioned: true, position: 1, competitors: ["Rival A", "Rival B"], excerpt: "Try Acme." }),
      answer({ mentioned: true, position: 3, competitors: ["rival a"] }),
      answer({ engine: "chatgpt", model: "gpt-5-mini", competitors: ["Rival C"] }),
    ]);
    expect(row).not.toBeNull();
    expect(row).toMatchObject({
      samples: 3,
      mentionCount: 2,
      mentioned: true,
      averagePosition: 2,
      position: 2,
      excerpt: "Try Acme.",
      engines: ["claude", "chatgpt"],
    });
    expect(row?.weight).toBeCloseTo((positionWeight(1) + positionWeight(3)) / 3, 3);
    // Rivals by how many answers named them; one spelling kept.
    expect(row?.competitors).toEqual(["Rival A", "Rival B", "Rival C"]);
    expect(row?.answers[2]).toEqual({
      engine: "chatgpt", model: "gpt-5-mini", webSearch: true, language: "Ukrainian", region: "Ukraine", mentioned: false, position: null,
    });
  });

  it("records nothing when no answer came back", () => {
    expect(combineAnswers([])).toBeNull();
  });

  it("scores the share, not one lucky answer", () => {
    const once = combineAnswers([answer({ mentioned: true, position: 1 }), answer(), answer()])!;
    const always = combineAnswers([1, 1, 1].map((position) => answer({ mentioned: true, position })))!;
    expect(summarise([once]).score).toBe(33);
    expect(summarise([always]).score).toBe(100);
    const both = summarise([once, always]);
    expect(both).toMatchObject({ mentions: 2, total: 2, answers: 6, answersNamed: 4, averagePosition: 1 });
  });

  it("weights the average position by the answers that named the business", () => {
    const a = combineAnswers([answer({ mentioned: true, position: 1 }), answer({ mentioned: true, position: 1 }), answer({ mentioned: true, position: 1 })])!;
    const b = combineAnswers([answer({ mentioned: true, position: 4 }), answer(), answer()])!;
    // (1 * 3 + 4 * 1) / 4 = 1.75 -> 1.8
    expect(summarise([a, b]).averagePosition).toBe(1.8);
  });

  it("still reads a row from before, as one answer", () => {
    const old = { mentioned: true, position: 2, competitors: [], excerpt: null, cited: false };
    expect(summarise([old])).toMatchObject({ score: Math.round(positionWeight(2) * 100), answers: 1, answersNamed: 1, averagePosition: 2 });
  });
});
