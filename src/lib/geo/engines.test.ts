import { describe, expect, it } from "vitest";

import {
  aiVisibilityWords,
  ASKABLE_ENGINE_IDS,
  availableEngineIds,
  checkedEngineNames,
  DEFAULT_RUNS_PER_QUESTION,
  engineModel,
  engineNames,
  enginesInUse,
  runsPerQuestion,
  uncheckedEngineNames,
} from "@/lib/geo/engines";

/**
 * The assistants an AI visibility check asks are the ones with a client
 * here AND a key set (review of 2026-11-27: only Claude was ever asked,
 * though the page and the landing pages named more). What Copilot, the
 * method section and the sign-in panel say is built from the same list.
 */
describe("which assistants a check asks", () => {
  it("asks only the engines with a key", () => {
    const listed = { GEO_ENGINES: "claude,chatgpt,gemini" };
    expect(availableEngineIds(listed)).toEqual([]);
    expect(availableEngineIds({ ...listed, ANTHROPIC_API_KEY: "k" })).toEqual(["claude"]);
    expect(availableEngineIds({ ...listed, ANTHROPIC_API_KEY: "k", OPENAI_API_KEY: "k", GOOGLE_AI_API_KEY: "k" })).toEqual(["claude", "chatgpt", "gemini"]);
    // A blank value is no key.
    expect(availableEngineIds({ ...listed, OPENAI_API_KEY: "  " })).toEqual([]);
  });

  it("asks Claude alone while GEO_ENGINES is unset, whatever other keys are set", () => {
    // OPENAI_API_KEY is set in production for pictures: a key alone must not start ChatGPT.
    const keys = { ANTHROPIC_API_KEY: "k", OPENAI_API_KEY: "k", GOOGLE_AI_API_KEY: "k" };
    expect(availableEngineIds(keys)).toEqual(["claude"]);
    expect(availableEngineIds({ ...keys, GEO_ENGINES: " , " })).toEqual(["claude"]);
    expect(availableEngineIds({ OPENAI_API_KEY: "k", GOOGLE_AI_API_KEY: "k" })).toEqual([]);
  });

  it("never asks an engine it has no client for, whatever keys are set", () => {
    expect(availableEngineIds({ PERPLEXITY_API_KEY: "k", XAI_API_KEY: "k", DATAFORSEO_LOGIN: "k" })).toEqual([]);
    expect(ASKABLE_ENGINE_IDS).toEqual(["claude", "chatgpt", "gemini"]);
  });

  it("can be narrowed with GEO_ENGINES without removing a key", () => {
    const env = { ANTHROPIC_API_KEY: "k", OPENAI_API_KEY: "k", GOOGLE_AI_API_KEY: "k", GEO_ENGINES: "claude, Gemini" };
    expect(availableEngineIds(env)).toEqual(["claude", "gemini"]);
    // Naming an engine without its key does not turn it on.
    expect(availableEngineIds({ ANTHROPIC_API_KEY: "k", GEO_ENGINES: "chatgpt" })).toEqual([]);
  });

  it("uses each engine's default model unless one is set", () => {
    // The cheaper versions (owner option B, 2026-11-28); each one overridable.
    expect(engineModel("claude", {})).toBe("claude-haiku-5-5");
    expect(engineModel("chatgpt", {})).toBe("gpt-5-mini");
    expect(engineModel("gemini", {})).toBe("gemini-flash-lite-latest");
    expect(engineModel("claude", { GEO_CLAUDE_MODEL: "claude-sonnet-5" })).toBe("claude-sonnet-5");
    expect(engineModel("gemini", { GEO_GEMINI_MODEL: "gemini-flash-latest" })).toBe("gemini-flash-latest");
    expect(engineModel("chatgpt", { GEO_OPENAI_MODEL: "gpt-5.4-mini" })).toBe("gpt-5.4-mini");
    expect(enginesInUse({ OPENAI_API_KEY: "k", GEO_ENGINES: "chatgpt", GEO_OPENAI_MODEL: "gpt-x" })).toEqual([
      { id: "chatgpt", name: "ChatGPT", model: "gpt-x", webSearch: true },
    ]);
  });

  it("asks each question twice by default, one to five when set", () => {
    expect(runsPerQuestion({})).toBe(DEFAULT_RUNS_PER_QUESTION);
    expect(DEFAULT_RUNS_PER_QUESTION).toBe(2);
    expect(runsPerQuestion({ GEO_RUNS_PER_QUESTION: "1" })).toBe(1);
    expect(runsPerQuestion({ GEO_RUNS_PER_QUESTION: "40" })).toBe(5);
    expect(runsPerQuestion({ GEO_RUNS_PER_QUESTION: "0" })).toBe(1);
    expect(runsPerQuestion({ GEO_RUNS_PER_QUESTION: "many" })).toBe(2);
  });

  it("words what is checked from the same list, for Copilot", () => {
    const all = { ANTHROPIC_API_KEY: "k", OPENAI_API_KEY: "k", GOOGLE_AI_API_KEY: "k", GEO_ENGINES: "claude,chatgpt,gemini" };
    expect(checkedEngineNames(all)).toBe("Claude, ChatGPT and Gemini");
    expect(uncheckedEngineNames(all)).toBe("Perplexity and Google AI Overview");
    expect(aiVisibilityWords(all)).toBe(
      "RepGet's weekly check asks Claude, ChatGPT and Gemini, each with web search; Perplexity and Google AI Overview are not checked, so never say they are",
    );
    // One assistant reads as one: no "each".
    const claude = { ANTHROPIC_API_KEY: "k" };
    expect(checkedEngineNames(claude)).toBe("Claude");
    expect(aiVisibilityWords(claude)).toBe(
      "RepGet's weekly check asks Claude with web search; ChatGPT, Gemini, Perplexity and Google AI Overview are not checked, so never say they are",
    );
    // Claude left out names Claude among the ones not checked.
    expect(uncheckedEngineNames({ OPENAI_API_KEY: "k", GEO_ENGINES: "chatgpt" })).toBe("Claude, Gemini, Perplexity and Google AI Overview");
    expect(aiVisibilityWords({})).toMatch(/^RepGet's AI visibility check is not running on this deployment; /);
    expect(engineNames(["claude", "chatgpt"])).toBe("Claude and ChatGPT");
    expect(engineNames([])).toBe("");
  });
});
