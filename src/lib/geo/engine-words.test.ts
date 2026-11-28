import { describe, expect, it } from "vitest";

import { assistantNames, assistantWords, joinWords, notCheckedWords, withAssistants } from "@/lib/geo/engine-words";

/**
 * The public pages name the assistants this deployment asks, not a fixed
 * three (review of 2026-11-28): with GEO_ENGINES unset only Claude is asked,
 * so only Claude may be named, and the ones left out are said to be left out.
 */
const CLAUDE = { ANTHROPIC_API_KEY: "k", OPENAI_API_KEY: "k", GOOGLE_AI_API_KEY: "k" };
const ALL = { ...CLAUDE, GEO_ENGINES: "claude,chatgpt,gemini" };

describe("the assistants in words", () => {
  it("names Claude alone while GEO_ENGINES is unset, though every key is there", () => {
    expect(assistantNames(CLAUDE)).toEqual(["Claude"]);
    expect(assistantWords("en", CLAUDE)).toBe("Claude");
    expect(notCheckedWords("en", CLAUDE)).toBe("ChatGPT, Gemini, Perplexity and Google's AI results");
  });

  it("names all three once they are switched on, in each language", () => {
    expect(assistantWords("en", ALL)).toBe("Claude, ChatGPT and Gemini");
    expect(assistantWords("es", ALL)).toBe("Claude, ChatGPT y Gemini");
    expect(assistantWords("de", ALL)).toBe("Claude, ChatGPT und Gemini");
    expect(notCheckedWords("en", ALL)).toBe("Perplexity and Google's AI results");
    expect(notCheckedWords("fr", ALL)).toBe("Perplexity et les résultats IA de Google");
    expect(notCheckedWords("it", ALL)).toBe("Perplexity e i risultati IA di Google");
  });

  it("names the default set on a deployment with no key, never an empty list", () => {
    expect(assistantNames({})).toEqual(["Claude"]);
    expect(notCheckedWords("en", {})).not.toContain("Claude");
  });

  it("joins one, two or more words", () => {
    expect(joinWords([], "en")).toBe("");
    expect(joinWords(["A"], "it")).toBe("A");
    expect(joinWords(["A", "B"], "fr")).toBe("A et B");
  });

  it("fills every string of a copy object and leaves the rest alone", () => {
    const copy = { a: "Asks {assistants}.", b: ["{notChecked} are not checked.", 3], c: { d: "plain", e: null } };
    expect(withAssistants(copy, "en", CLAUDE)).toEqual({
      a: "Asks Claude.",
      b: ["ChatGPT, Gemini, Perplexity and Google's AI results are not checked.", 3],
      c: { d: "plain", e: null },
    });
    // The original is not changed.
    expect(copy.a).toBe("Asks {assistants}.");
  });
});
