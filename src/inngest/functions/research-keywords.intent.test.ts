import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { calendarItems, keywords, usageEvents, websites } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { seedWebsite } from "@/test/fixtures";

/*
  The review of 2026-11-27 (a Ukrainian publisher): every keyword
  "transactional", difficulty 0 shown as "Low", and inflections stored as
  separate keywords. The research job end to end, with the provider and every
  model call mocked and the rows real.
*/
const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }) }));
vi.mock("@/inngest/client", () => ({ inngest: { createFunction: (config: unknown, handler: unknown) => ({ config, handler }) } }));
vi.mock("@/inngest/send", () => ({ queueJob: vi.fn(async () => true) }));
vi.mock("@/lib/notifications/create", () => ({ notify: vi.fn() }));

const provider = vi.hoisted(() => ({ ideas: vi.fn(), site: vi.fn() }));
vi.mock("@/lib/providers/dataforseo", () => ({
  isDataForSeoConfigured: () => true,
  keywordIdeas: provider.ideas,
  keywordsForSite: provider.site,
}));
const seeds = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("@/lib/keywords/seeds", () => ({ generateSeedKeywords: seeds.generate }));
const classify = vi.hoisted(() => vi.fn());
vi.mock("@/lib/keywords/intent", async (original) => ({ ...(await original<object>()), classifyKeywordIntents: classify }));
vi.mock("@/lib/keywords/cluster", () => ({ clusterKeywords: vi.fn(async () => []) }));
const calendar = vi.hoisted(() => ({ planCalendar: vi.fn(async (..._args: unknown[]) => [] as unknown[]) }));
vi.mock("@/lib/keywords/calendar", async (original) => ({ ...(await original<object>()), planCalendar: calendar.planCalendar }));

import { researchKeywords } from "./research-keywords";

let test: TestDb;
beforeAll(async () => { test = await createTestDb(); state.db = test.db; });

const metrics = (term: string, volume: number, difficulty: number | null = 0) => ({
  term, volume, difficulty, cpc: null, intent: "transactional" as const, source: "dataforseo_ideas",
});

beforeEach(() => {
  classify.mockReset();
  seeds.generate.mockResolvedValue([{ term: "привітання зятю", intent: "transactional" }]);
  calendar.planCalendar.mockClear();
  provider.ideas.mockResolvedValue({
    cached: false,
    metrics: [
      ...Array.from({ length: 24 }, (_, i) => metrics(`побажання номер ${i}`, 100 + i)),
      metrics("привітання для мужчині", 20),
      metrics("привітання для мужчини", 900, 35),
      metrics("купити листівку", 50),
    ],
  });
  provider.site.mockResolvedValue({ cached: true, metrics: [] });
});

async function run(websiteId: string, organizationId: string) {
  const job = researchKeywords as unknown as { handler: (ctx: unknown) => Promise<unknown> };
  const step = { run: async (_id: string, fn: () => unknown) => fn() };
  return job.handler({ event: { data: { websiteId, organizationId } }, step, logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } });
}

async function publisher() {
  const f = await seedWebsite(test, { articleLimit: 30 });
  await test.db.update(websites).set({
    industry: "Інформаційний портал", description: "Привітання та побажання", country: "Ukraine", language: "Ukrainian",
  }).where(eq(websites.id, f.websiteId));
  return f;
}

const stored = async (websiteId: string) =>
  test.db.select({ term: keywords.term, intent: keywords.intent, difficulty: keywords.difficulty, priorityScore: keywords.priorityScore })
    .from(keywords).where(eq(keywords.websiteId, websiteId));

describe("keyword research intent, difficulty and variants", () => {
  it("relabels a degenerate provider by the searcher's intent, scores it as a publisher and folds variants", async () => {
    const { websiteId, orgId } = await publisher();
    classify.mockImplementation(async (_profile: unknown, terms: string[]) => ({
      siteType: "publisher",
      intents: new Map(terms.map((term) => [term, term.startsWith("купити") ? "transactional" : "informational"])),
      offTopic: new Set(),
      usage: { inputTokens: 900, outputTokens: 300 },
    }));
    await run(websiteId, orgId);

    // Every row was sent: 27 provider labels, all "transactional", are not a measurement.
    expect(classify.mock.calls[0][1]).toHaveLength(28);
    const rows = await stored(websiteId);
    const byTerm = new Map(rows.map((row) => [row.term, row]));
    expect(byTerm.get("побажання номер 3")?.intent).toBe("informational");
    expect(byTerm.get("купити листівку")?.intent).toBe("transactional");
    // One keyword per search: the inflection with fewer searches is gone.
    expect(byTerm.has("привітання для мужчині")).toBe(false);
    expect(byTerm.get("привітання для мужчини")?.difficulty).toBe(35);
    // The provider's 0 is stored as unknown, not as "easy".
    expect(byTerm.get("побажання номер 3")?.difficulty).toBeNull();
    // For a publisher the reader's question outranks the purchase.
    expect(byTerm.get("побажання номер 3")!.priorityScore!).toBeGreaterThan(byTerm.get("купити листівку")!.priorityScore!);

    const spend = await test.db.select().from(usageEvents).where(eq(usageEvents.websiteId, websiteId));
    expect(spend.find((event) => (event.metadata as { purpose?: string } | null)?.purpose === "keyword_intent")).toBeTruthy();
    expect(calendar.planCalendar).toHaveBeenCalled();
    expect(calendar.planCalendar.mock.calls[0][3]).toMatchObject({ language: "Ukrainian" });
  });

  it("drops untrusted labels rather than keeping them when the classifier fails", async () => {
    const { websiteId, orgId } = await publisher();
    classify.mockRejectedValue(new Error("Model down"));
    await run(websiteId, orgId);
    const rows = await stored(websiteId);
    expect(rows.filter((row) => row.intent === "transactional").map((row) => row.term)).toEqual(["привітання зятю"]);
    expect(rows.find((row) => row.term === "купити листівку")?.intent).toBeNull();
  });
});

/*
  Daniel, 2026-11-27: an interior-design site got articles about "iron". The
  provider expands seeds by shared words; the classifier marks what is not
  about the site, and those provider ideas never reach scoring or the plan.
*/
describe("keyword research relevance", () => {
  const idea = (term: string, volume: number, intent: "informational" | "commercial" | "transactional" = "commercial") => ({
    term, volume, difficulty: 20, cpc: null, intent, source: "dataforseo_ideas",
  });

  beforeEach(() => {
    seeds.generate.mockResolvedValue([
      { term: "interior design studio", intent: "commercial" },
      { term: "iron decor ideas", intent: "informational" },
    ]);
    provider.ideas.mockResolvedValue({
      cached: false,
      metrics: [
        idea("steam iron price", 9000, "transactional"),
        idea("best steam iron", 6000),
        idea("wrought iron railing design", 400),
        idea("living room design ideas", 3000, "informational"),
        idea("iron bed frame", 800),
        idea("iron decor ideas", 200, "informational"),
      ],
    });
    provider.site.mockResolvedValue({ cached: true, metrics: [] });
  });

  async function studio() {
    const f = await seedWebsite(test, { articleLimit: 30 });
    await test.db.update(websites).set({
      industry: "Interior design", description: "Interior design studio for homes and offices", country: "United Kingdom", language: "English",
      services: ["Interior design", "Bespoke metalwork railings", "Home staging"],
    }).where(eq(websites.id, f.websiteId));
    return f;
  }

  const offTopicModel = (marked: string[]) => async (_profile: unknown, terms: string[]) => ({
    siteType: "business",
    intents: new Map(terms.map((term) => [term, "informational"])),
    offTopic: new Set(terms.filter((term) => marked.includes(term))),
    usage: { inputTokens: 900, outputTokens: 300 },
  });

  it("drops off-topic provider ideas before scoring, and keeps the on-topic ones", async () => {
    const { websiteId, orgId } = await studio();
    classify.mockImplementation(offTopicModel(["steam iron price", "best steam iron"]));
    await run(websiteId, orgId);

    // The profile reaches the model, and every unprotected provider idea is asked about.
    expect(classify.mock.calls[0][0]).toMatchObject({ industry: "Interior design", services: expect.arrayContaining(["Bespoke metalwork railings"]) });
    expect(classify.mock.calls[0][1]).toEqual(expect.arrayContaining(["steam iron price", "wrought iron railing design", "living room design ideas"]));
    const rows = await stored(websiteId);
    const terms = rows.map((row) => row.term);
    expect(terms).not.toContain("steam iron price");
    expect(terms).not.toContain("best steam iron");
    expect(terms).toEqual(expect.arrayContaining(["wrought iron railing design", "living room design ideas", "interior design studio"]));
    // A term sent only for its topic keeps the provider's healthy label.
    expect(rows.find((row) => row.term === "wrought iron railing design")?.intent).toBe("commercial");
    const spend = await test.db.select().from(usageEvents).where(eq(usageEvents.websiteId, websiteId));
    expect(spend.find((event) => (event.metadata as { purpose?: string } | null)?.purpose === "keyword_intent")?.metadata)
      .toMatchObject({ offTopic: 2 });
  });

  it("never drops the seeds, the customer's own keywords or a planned topic's, whatever the model says", async () => {
    const { websiteId, orgId } = await studio();
    await test.db.insert(keywords).values({ websiteId, term: "iron bed frame", source: "manual" });
    await test.db.insert(calendarItems).values({ websiteId, title: "Living rooms", targetKeyword: "Living room design ideas" });
    classify.mockImplementation(offTopicModel(["steam iron price", "iron bed frame", "iron decor ideas", "living room design ideas", "interior design studio"]));
    await run(websiteId, orgId);

    const sent: string[] = classify.mock.calls[0][1];
    // Protected provider ideas are not asked about their topic (the seeds still go, for their intent).
    expect(sent).not.toContain("iron bed frame");
    expect(sent).not.toContain("living room design ideas");
    const terms = (await stored(websiteId)).map((row) => row.term);
    expect(terms).not.toContain("steam iron price");
    expect(terms).toEqual(expect.arrayContaining(["iron bed frame", "iron decor ideas", "living room design ideas", "interior design studio"]));
  });

  it("filters nothing when the model call fails", async () => {
    const { websiteId, orgId } = await studio();
    classify.mockRejectedValue(new Error("ANTHROPIC_API_KEY is not set"));
    await run(websiteId, orgId);
    const terms = (await stored(websiteId)).map((row) => row.term);
    expect(terms).toEqual(expect.arrayContaining(["steam iron price", "best steam iron", "wrought iron railing design"]));
  });
});
