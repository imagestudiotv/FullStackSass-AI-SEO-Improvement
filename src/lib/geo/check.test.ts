import { beforeEach, describe, expect, it, vi } from "vitest";

const ai = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@/lib/ai/client", () => ({
  anthropic: { messages: { create: ai.create } },
  isAiConfigured: () => true,
  MODELS: { GENERATION: "claude-sonnet-5", EXTRACTION: "claude-haiku-4-5" },
}));
const ask = vi.hoisted(() => ({ askEngine: vi.fn() }));
vi.mock("@/lib/geo/assistants", async (original) => ({ ...(await original<object>()), askEngine: ask.askEngine }));

import { isSameBrand, normalise, relevantCompetitors, runCheck, type NamedBusiness } from "@/lib/geo/check";

const UA = { language: "Ukrainian", region: "Ukraine", countryCode: "UA" };
const b = (name: string, domain = "", market: NamedBusiness["market"] = "unknown"): NamedBusiness => ({ name, domain, market });

/**
 * "Named instead of you" (review of 2026-11-27: a Ukrainian gift shop was
 * shown US magazines): rivals of the asker's market only, never the
 * customer's own business.
 */
describe("the rivals shown as named instead of you", () => {
  it("drops other markets' businesses and the customer's own", () => {
    const named = [
      b("Podarunky UA", "podarunky.ua", "local"),
      b("Good Housekeeping", "goodhousekeeping.com", "foreign"),
      b("Presentes BR", "presentes.com.br"),
      b("Acme Gifts", "acmegifts.ua"),
      b("acmegifts.ua"),
      b("Acmegifts"),
      b("Rozetka", "rozetka.com.ua"),
      b("Etsy", "etsy.com"),
      b("rozetka"),
    ];
    expect(relevantCompetitors(named, { brand: "Acme Gifts", domain: "acmegifts.ua" }, UA)).toEqual(["Podarunky UA", "Rozetka", "Etsy"]);
  });

  it("keeps a foreign-domain rival when the asker's country is not known", () => {
    expect(relevantCompetitors([b("Presentes BR", "presentes.com.br")], { brand: "Acme", domain: "acme.com" }, { countryCode: null })).toEqual(["Presentes BR"]);
  });
});

/**
 * Brands in any script (review of 2026-11-28: only [a-z0-9] were kept, so a
 * Ukrainian brand never matched and the customer's own name could be shown
 * as a rival). A fictional Ukrainian shop: "Подарункова Скриня".
 */
describe("brand names in Cyrillic", () => {
  it("keeps Cyrillic letters and digits, folded the same way on both sides", () => {
    expect(normalise("«Подарункова Скриня»")).toBe("подарунковаскриня");
    expect(normalise("ТОВ «Подарункова Скриня 24»")).toBe("подарунковаскриня24");
    // Full-width and accented Latin fold as before.
    expect(normalise("ＡＣＭＥ Café")).toBe("acmecafe");
  });

  it("matches a Ukrainian brand however the answer writes it", () => {
    expect(isSameBrand("ПОДАРУНКОВА СКРИНЯ", "Подарункова Скриня")).toBe(true);
    expect(isSameBrand("Подарункова Скриня (Київ)", "Подарункова Скриня")).toBe(true);
    expect(isSameBrand("ТОВ Подарункова Скриня", "Подарункова Скриня")).toBe(true);
    // A different Cyrillic name is not the brand: they used to both normalise to "".
    expect(isSameBrand("Розетка", "Подарункова Скриня")).toBe(false);
  });

  it("never lists the customer's own Cyrillic brand as a rival", () => {
    const named = [b("Подарункова Скриня", "", "local"), b("Розетка", "rozetka.com.ua", "local"), b("подарункова скриня")];
    expect(relevantCompetitors(named, { brand: "Подарункова Скриня", domain: "skrynia.ua" }, UA)).toEqual(["Розетка"]);
  });

  it("finds the Cyrillic brand in the answer and quotes the sentence", async () => {
    ask.askEngine.mockResolvedValue({
      engine: "claude",
      model: "claude-haiku-5-5",
      webSearch: true,
      text: "Найкращі набори: Розетка. Також «Подарункова Скриня» у Києві збирає подарунки на замовлення.",
      sources: [],
      searches: 1,
      usage: { inputTokens: 1000, outputTokens: 200 },
    });
    ai.create.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify({ brands: [{ name: "Розетка", domain: "rozetka.com.ua", market: "local" }, { name: "Подарункова Скриня", domain: "", market: "local" }], citedDomain: false }) }],
      usage: { input_tokens: 300, output_tokens: 50 },
    });
    const outcome = await runCheck("Де замовити подарунковий набір?", "Подарункова Скриня", "skrynia.ua", { engine: "claude", market: UA });
    expect(outcome).toMatchObject({ mentioned: true, position: 2, competitors: ["Розетка"] });
    expect(outcome.excerpt).toContain("Подарункова Скриня");
  });
});

describe("one answer, read", () => {
  beforeEach(() => {
    ai.create.mockReset();
    ask.askEngine.mockReset();
  });

  it("records the assistant, model, web search, language and region, and the position", async () => {
    ask.askEngine.mockResolvedValue({
      engine: "chatgpt",
      model: "gpt-5-mini-2026",
      webSearch: true,
      text: "Спробуйте Podarunky UA. Також Acme Gifts має гарні набори.",
      sources: ["https://acmegifts.ua/sets"],
      searches: 2,
      usage: { inputTokens: 1000, outputTokens: 200 },
    });
    ai.create.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify({ brands: [{ name: "Podarunky UA", domain: "podarunky.ua", market: "local" }, { name: "Acme Gifts", domain: "", market: "local" }], citedDomain: false }) }],
      usage: { input_tokens: 300, output_tokens: 50 },
    });
    const usage = vi.fn();

    const outcome = await runCheck("Де купити подарунок?", "Acme Gifts", "acmegifts.ua", { engine: "chatgpt", market: UA, onUsage: usage });

    expect(outcome).toMatchObject({
      engine: "chatgpt",
      model: "gpt-5-mini-2026",
      webSearch: true,
      language: "Ukrainian",
      region: "Ukraine",
      mentioned: true,
      position: 2,
      competitors: ["Podarunky UA"],
      // A cited page on the customer's own site counts as cited.
      cited: true,
    });
    expect(outcome.excerpt).toContain("Acme Gifts");
    // The extraction is told the asker's language and market, never the brand.
    const prompt = ai.create.mock.calls[0][0].messages[0].content as string;
    expect(prompt).toContain("writes in Ukrainian and is in Ukraine");
    expect(prompt).not.toContain("Acme Gifts\"");
    // The answer's cost, searches included, is reported with its provider.
    expect(usage.mock.calls[0][2]).toMatchObject({ engine: "chatgpt", provider: "openai", searches: 2, webSearch: true });
    expect(usage.mock.calls[0][2].costUsd).toBeGreaterThan(0.02);
  });

  it("throws, recording nothing, when the answer cannot be read", async () => {
    ask.askEngine.mockResolvedValue({ engine: "claude", model: "m", webSearch: true, text: "Some answer", sources: [], searches: 0, usage: { inputTokens: 1, outputTokens: 1 } });
    ai.create.mockResolvedValue({ content: [{ type: "text", text: "not json" }], usage: { input_tokens: 1, output_tokens: 1 } });
    await expect(runCheck("q", "Acme", "acme.com", { engine: "claude", market: UA })).rejects.toThrow(/Could not read/);
  });
});
