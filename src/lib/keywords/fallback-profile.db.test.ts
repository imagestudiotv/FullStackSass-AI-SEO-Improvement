import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { gscMetrics, websites } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { seedWebsite } from "@/test/fixtures";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
  isDatabaseConfigured: () => true,
}));

import { saveInferredProfile, topSearchQueries } from "./fallback-profile";

let test: TestDb;
beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

const inferred = {
  brandName: "L'erba del vicino",
  industry: "herbal shop",
  country: "Italy",
  language: "Italian",
  description: "A herbal shop.",
  targetAudience: null,
  services: ["herbal teas"],
  competitors: [],
};

describe("the profile of a website RepGet could not read", () => {
  it("is saved only where the website's fields are empty", async () => {
    const { websiteId } = await seedWebsite(test);
    await test.db.update(websites).set({ country: "Switzerland", services: [] }).where(eq(websites.id, websiteId));
    await saveInferredProfile(websiteId, inferred);
    const [row] = await test.db.select().from(websites).where(eq(websites.id, websiteId));
    expect(row).toMatchObject({ country: "Switzerland", industry: "herbal shop", language: "Italian", targetAudience: null, services: ["herbal teas"] });

    // Services already written stay.
    await test.db.update(websites).set({ services: ["mine"] }).where(eq(websites.id, websiteId));
    await saveInferredProfile(websiteId, { ...inferred, services: ["other"] });
    const [again] = await test.db.select().from(websites).where(eq(websites.id, websiteId));
    expect(again.services).toEqual(["mine"]);
  });

  it("reads the Search Console searches, most seen first, recent only", async () => {
    const { websiteId } = await seedWebsite(test);
    const now = new Date("2026-11-27T10:00:00Z");
    await test.db.insert(gscMetrics).values([
      { websiteId, query: "Tisane Naturali", impressions: 50, date: "2026-11-20", pageUrl: "/a" },
      { websiteId, query: "tisane naturali", impressions: 30, date: "2026-11-21", pageUrl: "/b" },
      { websiteId, query: "olio lavanda", impressions: 70, date: "2026-11-22", pageUrl: "/a" },
      { websiteId, query: "old search", impressions: 999, date: "2026-01-01", pageUrl: "/a" },
      { websiteId, query: null, impressions: 500, date: "2026-11-22", pageUrl: "/c" },
    ]);
    expect(await topSearchQueries(websiteId, 40, now)).toEqual(["tisane naturali", "olio lavanda"]);
  });
});
