import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { calendarItems, keywords } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { seedWebsite } from "@/test/fixtures";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }) }));

import { foldKeywordVariants } from "./dedupe";

let test: TestDb;
beforeAll(async () => { test = await createTestDb(); state.db = test.db; });
afterAll(async () => { await test.client.close(); });

const row = (term: string, volume: number | null) => ({ term, volume, difficulty: null, cpc: null, intent: null, source: "dataforseo_ideas" });
const terms = async (websiteId: string) =>
  (await test.db.select({ term: keywords.term }).from(keywords).where(eq(keywords.websiteId, websiteId))).map((r) => r.term).sort();

describe("foldKeywordVariants", () => {
  it("keeps one form per search among the new rows: the most searched", async () => {
    const { websiteId } = await seedWebsite(test);
    const folded = await foldKeywordVariants(websiteId, [row("для мужчині", 30), row("для мужчини", 700), row("для жінки", 500)]);
    expect(folded.rows.map((r) => r.term)).toEqual(["для мужчини", "для жінки"]);
    expect(folded.dropped).toEqual(["для мужчині"]);
  });

  it("removes an earlier run's weaker spelling, but never the customer's or a targeted one", async () => {
    const { websiteId } = await seedWebsite(test);
    await test.db.insert(keywords).values([
      { websiteId, term: "dublin dentist", volume: 20, source: "dataforseo_ideas" },
      { websiteId, term: "привітання зятю", volume: null, source: "manual" },
      { websiteId, term: "teeth whitening cost", volume: 10, source: "ai_seed" },
    ]);
    await test.db.insert(calendarItems).values({ websiteId, title: "Costs", targetKeyword: "teeth whitening cost" });

    const folded = await foldKeywordVariants(websiteId, [
      row("dentist dublin", 900),
      row("привітаня зятю", 400),
      row("teeth whitening costs", 300),
    ]);
    // The better new form replaces the old one; the typed and the planned ones stand.
    expect(folded.removed).toEqual(["dublin dentist"]);
    expect(folded.rows.map((r) => r.term)).toEqual(["dentist dublin"]);
    expect(folded.dropped.sort()).toEqual(["teeth whitening costs", "привітаня зятю"].sort());
    expect(await terms(websiteId)).toEqual(["teeth whitening cost", "привітання зятю"].sort());
  });

  it("refreshes a keyword research finds again under the same term", async () => {
    const { websiteId } = await seedWebsite(test);
    await test.db.insert(keywords).values({ websiteId, term: "wedding films", volume: 50, source: "dataforseo_ideas" });
    const folded = await foldKeywordVariants(websiteId, [row("wedding films", 80)]);
    expect(folded).toEqual({ rows: [row("wedding films", 80)], removed: [], dropped: [] });
  });
});
