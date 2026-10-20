import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { websites } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { seedWebsite } from "@/test/fixtures";

/**
 * "Where pictures come from" in Article Settings (client, 2026-10-20): new
 * pictures, or the website's own photos - and the first switch to its photos
 * reads the media library at once rather than at the next daily run.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }) }));
vi.mock("@/lib/websites/require-editor", () => ({
  requireEditor: vi.fn(async (id: string) => {
    const db = state.db as TestDb["db"];
    const [site] = await db.select().from(websites).where(eq(websites.id, id));
    return { ok: true, context: { site, orgId: site.organizationId, userId: "user_1", access: "owner" } };
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const jobs = vi.hoisted(() => ({ queue: vi.fn(async () => true) }));
vi.mock("@/inngest/send", () => ({ queueJob: jobs.queue }));

import { saveArticleSettings } from "./article-settings";

let test: TestDb;

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

beforeEach(() => {
  jobs.queue.mockClear();
});

const source = async (websiteId: string) => (await test.db.select({ value: websites.pictureSource }).from(websites).where(eq(websites.id, websiteId)))[0].value;

describe("where pictures come from", () => {
  it("is new pictures until the website's own photos are chosen, and nothing else is stored", async () => {
    const { websiteId } = await seedWebsite(test);
    expect(await source(websiteId)).toBe("generate");
    await saveArticleSettings(websiteId, { pictureSource: "elsewhere" });
    expect(await source(websiteId)).toBe("generate");
    await saveArticleSettings(websiteId, { pictureSource: "library" });
    expect(await source(websiteId)).toBe("library");
    // A save from a form without the field keeps it.
    await saveArticleSettings(websiteId, { bodyImages: 2 });
    expect(await source(websiteId)).toBe("library");
  });

  it("reads the media library at once the first time the website's photos are chosen", async () => {
    const { websiteId } = await seedWebsite(test);
    await saveArticleSettings(websiteId, { pictureSource: "library" });
    expect(jobs.queue).toHaveBeenCalledWith({ name: "sites/inventory.requested", data: { websiteId } });

    // Once read, the daily run keeps it fresh: no extra read.
    jobs.queue.mockClear();
    await test.db.update(websites).set({ inventoryCheckedAt: new Date() }).where(eq(websites.id, websiteId));
    await saveArticleSettings(websiteId, { pictureSource: "library" });
    expect(jobs.queue).not.toHaveBeenCalled();
  });
});
