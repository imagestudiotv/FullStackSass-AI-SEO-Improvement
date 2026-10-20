import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { articles, sitePosts, websites } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { seedWebsite } from "@/test/fixtures";

/**
 * What a website already covers, from its own blog (in its main language) and
 * from what RepGet wrote for it (client, 2026-10-20).
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }) }));

import { coveredTopics, isCovered } from "./covered";

let test: TestDb;

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

beforeEach(async () => {
  await test.client.exec("delete from site_posts; delete from articles;");
});

describe("what a website covers", () => {
  it("is its own blog in its main language, and every article RepGet wrote for it but a failed one", async () => {
    const { websiteId } = await seedWebsite(test);
    await test.db.update(websites).set({ siteLanguages: ["en", "it"] }).where(eq(websites.id, websiteId));
    await test.db.insert(sitePosts).values([
      { websiteId, postType: "custom_post", remoteId: 1, title: "Lake Como Wedding Photography: Venues, Light and Timing", url: "https://studio.test/editorial/post/lake-como/", language: "en" },
      { websiteId, postType: "custom_post", remoteId: 2, title: "Fotografo di matrimonio sul lago di Como", url: "https://studio.test/it/editorial/post/lago-como/", language: "it" },
    ]);
    await test.db.insert(articles).values([
      { websiteId, title: "Building a Music Video Production Crew: Key Roles", targetKeyword: "music video production crew", status: "published" },
      { websiteId, title: "Failed attempt", targetKeyword: "wedding film cost", status: "failed" },
    ]);

    const covered = await coveredTopics(websiteId);
    expect(covered.siteTitles).toEqual(["Lake Como Wedding Photography: Venues, Light and Timing"]);
    expect(covered.writtenKeywords).toEqual(["music video production crew"]);
    expect(isCovered("lake como wedding photographer", covered)).toBe(true);
    expect(isCovered("music video production crews", covered)).toBe(true);
    // A failure covers nothing: it can be planned again.
    expect(isCovered("wedding film cost", covered)).toBe(false);
  });
});
