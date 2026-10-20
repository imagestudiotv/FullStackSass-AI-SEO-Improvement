import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { websites } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { seedWebsite } from "@/test/fixtures";

/**
 * "Also publish in" in Article Settings (client, 2026-10-20): only the
 * languages the site itself publishes in, and a language newly chosen starts
 * now - articles live before it are not translated.
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
vi.mock("@/inngest/send", () => ({ queueJob: vi.fn(async () => true) }));

import { saveArticleSettings } from "./article-settings";

let test: TestDb;

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

const read = async (websiteId: string) =>
  (await test.db.select({ languages: websites.extraLanguages, since: websites.extraLanguagesSince }).from(websites).where(eq(websites.id, websiteId)))[0];

describe("also publish in", () => {
  it("keeps only the site's own other languages", async () => {
    const { websiteId } = await seedWebsite(test);
    await test.db.update(websites).set({ language: "English", siteLanguages: ["en", "it", "es"] }).where(eq(websites.id, websiteId));
    await saveArticleSettings(websiteId, { extraLanguages: ["it", "fr", "en", "it"] });
    expect((await read(websiteId)).languages).toEqual(["it"]);
  });

  it("dates a newly chosen language from now; an unchanged choice keeps its date", async () => {
    const { websiteId } = await seedWebsite(test);
    await test.db.update(websites).set({ language: "English", siteLanguages: ["en", "it", "es"] }).where(eq(websites.id, websiteId));
    await saveArticleSettings(websiteId, { extraLanguages: ["it"] });
    const first = await read(websiteId);
    expect(first.since).toBeInstanceOf(Date);

    await saveArticleSettings(websiteId, { extraLanguages: ["it"] });
    expect((await read(websiteId)).since).toEqual(first.since);
    // A save from a form without the field changes nothing.
    await saveArticleSettings(websiteId, { bodyImages: 1 });
    expect((await read(websiteId)).languages).toEqual(["it"]);

    await new Promise((resolve) => setTimeout(resolve, 5));
    await saveArticleSettings(websiteId, { extraLanguages: ["it", "es"] });
    const later = await read(websiteId);
    expect(later.languages).toEqual(["it", "es"]);
    expect(later.since!.getTime()).toBeGreaterThan(first.since!.getTime());

    await saveArticleSettings(websiteId, { extraLanguages: [] });
    expect((await read(websiteId)).languages).toEqual([]);
  });

  it("is none for a site in one language", async () => {
    const { websiteId } = await seedWebsite(test);
    await saveArticleSettings(websiteId, { extraLanguages: ["it"] });
    expect((await read(websiteId)).languages).toEqual([]);
  });
});
