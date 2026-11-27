import { beforeEach, describe, expect, it, vi } from "vitest";

const ai = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@/lib/ai/client", () => ({
  anthropic: { messages: { create: ai.create } },
  isAiConfigured: () => true,
  MODELS: { EXTRACTION: "claude-haiku-4-5" },
}));

import { applyIntents, classifyKeywordIntents, INTENT_BATCH, providerIntentsTrustworthy, termsToClassify } from "./intent";

const profile = {
  brandName: "Infomind",
  industry: "Information portal",
  country: "Ukraine",
  language: "Ukrainian",
  description: "Greetings and wishes for every occasion",
  targetAudience: null,
  services: [],
};

const answer = (body: unknown) => ({
  stop_reason: "end_turn",
  usage: { input_tokens: 1000, output_tokens: 200 },
  content: [{ type: "text", text: JSON.stringify(body) }],
});

const provider = (term: string, intent: "transactional" | "informational" | null) => ({ term, intent, source: "dataforseo_ideas" });

beforeEach(() => ai.create.mockReset());

describe("providerIntentsTrustworthy", () => {
  it("distrusts one label on nearly everything", () => {
    const rows = Array.from({ length: 30 }, (_, i) => provider(`term ${i}`, "transactional"));
    expect(providerIntentsTrustworthy(rows)).toBe(false);
    rows.slice(0, 5).forEach((row) => (row.intent = "informational"));
    expect(providerIntentsTrustworthy(rows)).toBe(true);
  });

  it("trusts a small sample, which cannot show a pattern", () => {
    expect(providerIntentsTrustworthy(Array.from({ length: 10 }, (_, i) => provider(`t${i}`, "transactional")))).toBe(true);
  });
});

describe("termsToClassify", () => {
  it("sends seeds and blanks, and keeps healthy provider labels", () => {
    const rows = [
      { term: "seed", intent: "transactional" as const, source: "ai_seed" },
      provider("blank", null),
      provider("labelled", "informational"),
    ];
    expect(termsToClassify(rows)).toEqual(["seed", "blank"]);
  });

  it("sends every row when the provider's labels are degenerate", () => {
    const rows = Array.from({ length: 25 }, (_, i) => provider(`term ${i}`, "transactional"));
    expect(termsToClassify(rows)).toHaveLength(25);
  });
});

describe("applyIntents", () => {
  it("applies labels, and drops an untrusted provider label that came back blank", () => {
    const rows = [
      { term: "a", intent: "transactional" as const, source: "dataforseo_ideas" },
      { term: "b", intent: "transactional" as const, source: "dataforseo_ideas" },
      { term: "c", intent: "commercial" as const, source: "ai_seed" },
      { term: "d", intent: "commercial" as const, source: "dataforseo_ideas" },
    ];
    const out = applyIntents(rows, new Map([["a", "informational" as const]]), new Set(["a", "b", "c"]));
    expect(out.map((row) => row.intent)).toEqual(["informational", null, "commercial", "commercial"]);
  });
});

describe("classifyKeywordIntents", () => {
  it("labels numbered terms and reads the site type", async () => {
    ai.create.mockResolvedValueOnce(answer({ siteType: "publisher", keywords: [{ n: 1, t: "i" }, { n: 2, t: "c" }, { n: 9, t: "t" }, { n: 3, t: "x" }] }));
    const result = await classifyKeywordIntents(profile, ["привітання зятю", "best greeting cards", "buy cards"]);
    expect(result.siteType).toBe("publisher");
    expect([...result.intents]).toEqual([["привітання зятю", "informational"], ["best greeting cards", "commercial"]]);
    expect(result.usage).toEqual({ inputTokens: 1000, outputTokens: 200 });
    const request = ai.create.mock.calls[0][0];
    expect(request.model).toBe("claude-haiku-4-5");
    // The profile and the keywords as material, never as instructions.
    expect(request.messages[0].content).toContain("<business_profile>");
    expect(request.messages[0].content).toContain("<site_data>\n1. привітання зятю");
    expect(request.system).toContain("Never by what would suit the website");
  });

  it("sends a large set in turns", async () => {
    ai.create.mockImplementation(async () => answer({ siteType: "business", keywords: [{ n: 1, t: "t" }] }));
    const terms = Array.from({ length: INTENT_BATCH + 5 }, (_, i) => `term ${i}`);
    const result = await classifyKeywordIntents(profile, terms);
    expect(ai.create).toHaveBeenCalledTimes(2);
    expect(result.intents.get("term 0")).toBe("transactional");
    expect(result.intents.get(`term ${INTENT_BATCH}`)).toBe("transactional");
    expect(result.usage.inputTokens).toBe(2000);
  });

  it("names a truncated answer instead of mislabelling", async () => {
    ai.create.mockResolvedValueOnce({ ...answer({}), stop_reason: "max_tokens" });
    await expect(classifyKeywordIntents(profile, ["a"])).rejects.toThrow("ran out of room");
  });
});
