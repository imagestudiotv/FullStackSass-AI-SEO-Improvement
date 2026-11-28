import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { competitors, geoPrompts, geoResults, websites } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { seedWebsite } from "@/test/fixtures";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }) }));
const ai = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@/lib/ai/client", () => ({ anthropic: { messages: { create: ai.create } }, MODELS: { EXTRACTION: "claude-haiku-4-5" } }));

import { hostOf, isListingSite, rankedNames, syncAiVisibilityCompetitors, websitesForNames } from "./competitors";

let test: TestDb;
beforeAll(async () => { test = await createTestDb(); state.db = test.db; });
afterAll(async () => { await test.client.close(); });
beforeEach(() => ai.create.mockReset());

/** Every address "answers": the network is not part of these tests. */
const verify = async (domains: string[]) => ({ live: domains.filter((d) => !d.startsWith("dead")), dropped: [] });

async function siteWithAnswers(lists: string[][], checkedAt = new Date()) {
  const f = await seedWebsite(test);
  await test.db.update(websites).set({ domain: "mysite.example", country: "Ukraine", industry: "Media" }).where(eq(websites.id, f.websiteId));
  const [prompt] = await test.db.insert(geoPrompts).values({ websiteId: f.websiteId, prompt: "Best greetings site?" }).returning({ id: geoPrompts.id });
  for (const list of lists) {
    await test.db.insert(geoResults).values({ geoPromptId: prompt.id, websiteId: f.websiteId, engine: "claude", competitors: list, checkedAt });
  }
  return f.websiteId;
}

const stored = async (websiteId: string) =>
  (await test.db.select({ domain: competitors.domain, source: competitors.source }).from(competitors).where(eq(competitors.websiteId, websiteId)))
    .sort((a, b) => a.domain.localeCompare(b.domain));

describe("helpers", () => {
  it("reads web addresses and refuses listings", () => {
    expect(hostOf("https://www.Rival.example/about")).toBe("rival.example");
    expect(hostOf("Rival Studio")).toBeNull();
    expect(isListingSite("yelp.com")).toBe(true);
    expect(isListingSite("maps.google.com")).toBe(true);
    expect(isListingSite("rival.example")).toBe(false);
  });

  it("ranks names by how often they are recommended", () => {
    expect(rankedNames([["Beta", "Alpha"], ["alpha", "Gamma", "X"], "junk", [42]])).toEqual(["Alpha", "Beta", "Gamma"]);
  });

  it("asks for official websites only, and drops the unknown", async () => {
    ai.create.mockResolvedValueOnce({
      stop_reason: "end_turn", usage: { input_tokens: 100, output_tokens: 20 },
      content: [{ type: "text", text: JSON.stringify({ websites: [{ n: 1, domain: "https://rival.example" }, { n: 2, domain: "" }] }) }],
    });
    expect(await websitesForNames(["Rival", "Unknown Co"], { country: "Ukraine", industry: "Media" }))
      .toEqual({ domains: ["rival.example"], usage: { inputTokens: 100, outputTokens: 20 } });
    expect(ai.create.mock.calls[0][0].messages[0].content).toContain("<site_data>");
  });
});

describe("syncAiVisibilityCompetitors", () => {
  it("adds the recommended rivals as suggestions, live websites only, never the site itself or a listing", async () => {
    const websiteId = await siteWithAnswers([["Rival One", "rivaltwo.example", "Yelp"], ["Rival One", "mysite.example", "Dead Co"]]);
    const lookUp = vi.fn(async (_names: string[], _market: { country: string | null; industry: string | null }) => ({ domains: ["rivalone.example", "yelp.com", "deadco.example"], usage: { inputTokens: 50, outputTokens: 10 } }));
    const result = await syncAiVisibilityCompetitors(websiteId, { lookUp, verify });
    expect(result.added.sort()).toEqual(["rivalone.example", "rivaltwo.example"]);
    expect(result.usage).toEqual({ inputTokens: 50, outputTokens: 10 });
    // Addresses are not looked up; names are.
    expect(lookUp.mock.calls[0][0]).toEqual(["Rival One", "Yelp", "Dead Co"]);
    expect(await stored(websiteId)).toEqual([
      { domain: "rivalone.example", source: "ai_visibility" },
      { domain: "rivaltwo.example", source: "ai_visibility" },
    ]);
  });

  it("never touches the customer's own entry, nor brings back one they removed", async () => {
    const websiteId = await siteWithAnswers([["rival.example", "gone.example", "new.example"]]);
    await test.db.insert(competitors).values([
      { websiteId, domain: "rival.example", source: "manual" },
      { websiteId, domain: "gone.example", source: "dismissed" },
    ]);
    const lookUp = vi.fn();
    const result = await syncAiVisibilityCompetitors(websiteId, { lookUp, verify });
    expect(result).toEqual({ added: ["new.example"], usage: null });
    expect(lookUp).not.toHaveBeenCalled();
    expect(await stored(websiteId)).toEqual([
      { domain: "gone.example", source: "dismissed" },
      { domain: "new.example", source: "ai_visibility" },
      { domain: "rival.example", source: "manual" },
    ]);
  });

  it("reads only recent answers, and does nothing without any", async () => {
    const old = await siteWithAnswers([["old.example"]], new Date(Date.now() - 90 * 86_400_000));
    expect(await syncAiVisibilityCompetitors(old, { verify })).toEqual({ added: [], usage: null });
    expect(await stored(old)).toEqual([]);
  });
});
