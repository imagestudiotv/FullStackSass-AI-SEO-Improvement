import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { keywords, usageEvents, websites } from "@/lib/db/schema";
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
vi.mock("@/lib/keywords/seeds", () => ({
  generateSeedKeywords: vi.fn(async () => [{ term: "привітання зятю", intent: "transactional" }]),
}));
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
