import { beforeEach, describe, expect, it, vi } from "vitest";

const ai = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@/lib/ai/client", () => ({
  anthropic: { messages: { create: ai.create } },
  isAiConfigured: () => true,
  MODELS: { EXTRACTION: "claude-haiku-4-5" },
}));

import { applyIntents, classifyKeywordIntents, dropOffTopic, INTENT_BATCH, providerIntentsTrustworthy, termsToCheckTopic, termsToClassify } from "./intent";

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

/*
  Daniel, 2026-11-27: an interior-design site got articles about "iron". The
  model is mocked; what is tested is how its marks are read and applied.
*/
describe("keyword topic", () => {
  const studio = {
    brandName: "Studio North",
    industry: "Interior design",
    country: "United Kingdom",
    language: "English",
    description: "Interior design studio for homes and offices",
    targetAudience: "Homeowners renovating",
    services: ["Interior design", "Bespoke metalwork railings"],
  };

  it("asks for a topic mark on every keyword, with the site's profile", async () => {
    ai.create.mockResolvedValueOnce(answer({
      siteType: "business",
      keywords: [{ n: 1, t: "t", o: false }, { n: 2, t: "c", o: true }, { n: 3, t: "i" }],
    }));
    const result = await classifyKeywordIntents(studio, ["steam iron price", "wrought iron railing design", "living room ideas"]);
    expect([...result.offTopic]).toEqual(["steam iron price"]);
    // An unmarked keyword is on topic.
    expect(result.offTopic.has("living room ideas")).toBe(false);
    const request = ai.create.mock.calls[0][0];
    expect(request.output_config.format.schema.properties.keywords.items.required).toEqual(["n", "t", "o"]);
    expect(request.system).toContain('"steam iron price" is about clothes irons');
    expect(request.messages[0].content).toContain("Offers: Interior design, Bespoke metalwork railings");
    expect(request.messages[0].content).toContain("Audience: Homeowners renovating");
  });

  it("asks only about unprotected provider ideas", () => {
    const rows = [
      { term: "interior design studio", source: "ai_seed" },
      { term: "steam iron price", source: "dataforseo_ideas" },
      { term: "Iron bed frame", source: "dataforseo_ideas" },
      { term: "studio north reviews", source: "dataforseo_ranked" },
    ];
    expect(termsToCheckTopic(rows, new Set(["iron bed frame"]))).toEqual(["steam iron price"]);
  });

  it("drops off-topic provider ideas and nothing else", () => {
    const rows = [
      { term: "steam iron price", source: "dataforseo_ideas" },
      { term: "wrought iron railing design", source: "dataforseo_ideas" },
      { term: "iron decor ideas", source: "dataforseo_ideas" },
      { term: "interior design studio", source: "ai_seed" },
      { term: "iron bed frame", source: "dataforseo_ideas" },
      { term: "studio north iron", source: "dataforseo_ranked" },
    ];
    const marked = new Set(["steam iron price", "iron decor ideas", "interior design studio", "iron bed frame", "studio north iron"]);
    // "iron decor ideas" was a seed the provider returned too; "iron bed frame" the customer typed.
    const { rows: kept, dropped } = dropOffTopic(rows, marked, new Set(["iron decor ideas", "iron bed frame"]));
    expect(dropped).toEqual(["steam iron price"]);
    expect(kept.map((row) => row.term)).toEqual([
      "wrought iron railing design", "iron decor ideas", "interior design studio", "iron bed frame", "studio north iron",
    ]);
  });
});
