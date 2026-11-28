import { describe, expect, it, vi } from "vitest";

/*
  Which assistants the AI visibility check asks depends on the deployment's
  keys (lib/geo/engines.ts; with ChatGPT and Gemini, once their keys are set).
  Pinned to Claude alone, before anything is imported, so these words are the
  same on every machine and after the engine list is built from the keys.
*/
const ONLY_CLAUDE = vi.hoisted(() => {
  const env = { ANTHROPIC_API_KEY: "test-key-not-real", OPENAI_API_KEY: "", GOOGLE_AI_API_KEY: "", GEO_ENGINES: "" };
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  return env;
});
const pinEngines = () => {
  for (const [key, value] of Object.entries(ONLY_CLAUDE)) vi.stubEnv(key, value);
};

vi.mock("@/lib/ai/client", () => ({ anthropic: {}, isAiConfigured: () => true, MODELS: { GENERATION: "m", EXTRACTION: "m" } }));

import { ENGINE } from "@/lib/geo/check";
import { aiVisibilityWords, CHECKED_ENGINE_IDS, checkedEngineNames, engineNames, uncheckedEngineNames } from "@/lib/geo/engines";

/**
 * What Copilot says about AI visibility comes from the engines the checker
 * really asks (owner review, 2026-11-27: Copilot named ChatGPT, Gemini and
 * Perplexity while only Claude is asked).
 */
describe("the assistants the AI visibility check asks", () => {
  it("are the ones the checker uses", () => {
    expect(CHECKED_ENGINE_IDS).toEqual([ENGINE]);
  });

  it("are named in plain words, with the well-known ones it does not ask", () => {
    pinEngines();
    expect(checkedEngineNames()).toBe("Claude");
    expect(uncheckedEngineNames()).toBe("ChatGPT, Gemini and Perplexity");
    expect(engineNames(["claude", "chatgpt"])).toBe("Claude and ChatGPT");
    expect(engineNames([])).toBe("");
    expect(aiVisibilityWords()).toBe("RepGet's weekly check asks Claude; ChatGPT, Gemini and Perplexity are not checked, so never say they are");
  });
});
