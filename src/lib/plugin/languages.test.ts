import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { websites } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { seedWebsite } from "@/test/fixtures";

/**
 * The site's WPML languages as plugin 1.9.0+ reports them (lib/plugin/
 * languages.ts), for "Also publish in" - Image Studio's Spanish has no page
 * yet, so its language links do not name it.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }) }));

import { extraLanguageChoices } from "@/lib/articles/translation-languages";

import { parsePluginLanguages, recordPluginLanguages } from "./languages";

let test: TestDb;

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

describe("the languages the plugin reports", () => {
  it("are codes, each once, default first; anything else is ignored", () => {
    expect(parsePluginLanguages("en, IT,es,it")).toEqual(["en", "it", "es"]);
    expect(parsePluginLanguages("en,pt-br,zh-hans")).toEqual(["en", "pt-br", "zh-hans"]);
    expect(parsePluginLanguages("en;drop table")).toBeNull();
    expect(parsePluginLanguages("")).toBeNull();
    expect(parsePluginLanguages(null)).toBeNull();
    expect(parsePluginLanguages(Array.from({ length: 21 }, (_, i) => `l${String.fromCharCode(97 + (i % 26))}`).join(","))).toBeNull();
  });

  it("are stored for the website, and written again only when they change", async () => {
    const { websiteId } = await seedWebsite(test);
    const read = async () => (await test.db.select({ languages: websites.pluginLanguages, updatedAt: websites.updatedAt }).from(websites).where(eq(websites.id, websiteId)))[0];
    await recordPluginLanguages(websiteId, "en,it,es");
    expect((await read()).languages).toEqual(["en", "it", "es"]);
    // A header that is not the shape keeps what was stored.
    await recordPluginLanguages(websiteId, "<script>");
    expect((await read()).languages).toEqual(["en", "it", "es"]);
    await recordPluginLanguages(websiteId, "en,it");
    expect((await read()).languages).toEqual(["en", "it"]);
  });

  it("add a language the site's links do not name to the choices", () => {
    expect(extraLanguageChoices({ language: "English", siteLanguages: ["en", "it"], pluginLanguages: ["en", "it", "es"] })).toEqual(["it", "es"]);
    // A regional WPML code and the links' short one are one language.
    expect(extraLanguageChoices({ language: "English", siteLanguages: ["en", "pt"], pluginLanguages: ["en", "pt-br"] })).toEqual(["pt-br"]);
  });
});
