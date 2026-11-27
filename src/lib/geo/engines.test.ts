import { describe, expect, it, vi } from "vitest";

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
    expect(checkedEngineNames()).toBe("Claude");
    expect(uncheckedEngineNames()).toBe("ChatGPT, Gemini and Perplexity");
    expect(engineNames(["claude", "chatgpt"])).toBe("Claude and ChatGPT");
    expect(engineNames([])).toBe("");
    expect(aiVisibilityWords()).toBe("RepGet's weekly check asks Claude; ChatGPT, Gemini and Perplexity are not checked, so never say they are");
  });
});
