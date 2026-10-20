import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { articles, articleTranslationAttempts, integrationKeys, spendReservations, usageEvents, websites } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { seedWebsite } from "@/test/fixtures";

/**
 * Live articles in their website's other languages (lib/articles/
 * translations.ts; client, 2026-10-20): which are due, what is saved, what
 * it costs and what it does not. The translator itself is mocked (its own
 * tests: translate-article.test.ts).
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }) }));
const translator = vi.hoisted(() => ({ translate: vi.fn() }));
vi.mock("./translate-article", async (original) => ({
  ...(await original<typeof import("./translate-article")>()),
  translateArticle: translator.translate,
}));

import { materializeArticleBaseline } from "@/lib/usage";

import { extraLanguageChoices, languageName, mainLanguageCode } from "./translation-languages";
import { TranslationError } from "./translate-article";
import { TRANSLATION_MAX_TRIES, translateLiveArticle, translationsDue } from "./translations";

let test: TestDb;

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

const USAGE = { calls: 2, inputTokens: 4000, outputTokens: 3000, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: 0.0019 };
const ITALIAN = {
  title: "Sposarsi sul Lago di Como",
  slug: "sposarsi-sul-lago-di-como",
  metaDescription: "Come organizzare un matrimonio.",
  imageAlt: "Una coppia in barca",
  bodyHtml: "<h2>Ville</h2><p>Villa del Balbianello e altre.</p>",
  usage: USAGE,
};

beforeEach(() => {
  translator.translate.mockReset();
  translator.translate.mockResolvedValue(ITALIAN);
});

/** A website publishing in English, Italian and Spanish, with the plugin at `plugin`, and one article live at `liveAt`. */
async function scene(options: { plugin?: string; liveAt?: Date; since?: Date; status?: string | null; languages?: string[] } = {}) {
  const { orgId, websiteId } = await seedWebsite(test, { status: options.status });
  await test.db
    .update(websites)
    .set({ language: "English", siteLanguages: ["en", "it", "es"], extraLanguages: options.languages ?? ["it", "es"], extraLanguagesSince: options.since ?? new Date("2026-10-20T10:00:00Z") })
    .where(eq(websites.id, websiteId));
  await test.db.insert(integrationKeys).values({
    websiteId,
    keyHash: randomUUID(),
    keyPrefix: "seo_x",
    siteInfo: `Image Studio - WordPress 6.8 - plugin ${options.plugin ?? "1.9.0"}`,
  });
  const [original] = await test.db
    .insert(articles)
    .values({
      websiteId,
      title: "Getting Married on Lake Como",
      slug: "lake-como-wedding",
      status: "published",
      bodyHtml: "<h2>Villas</h2><p>Villa del Balbianello and others.</p>",
      metaDescription: "How to plan a wedding.",
      imageUrl: "https://studio.test/uploads/boat.jpg",
      imageAlt: "A couple on a boat",
      publishedUrl: "https://studio.test/lake-como-wedding/",
      firstLiveAt: options.liveAt ?? new Date("2026-10-21T09:00:00Z"),
    })
    .returning();
  return { orgId, websiteId, original };
}

const NOW = new Date("2026-10-21T12:00:00Z");
const dueFor = async (websiteId: string, now = NOW) => (await translationsDue(50, now)).filter((d) => d.websiteId === websiteId).map((d) => d.language).sort();

describe("the languages a website can also publish in", () => {
  it("are its site's other languages that RepGet writes", () => {
    expect(extraLanguageChoices({ language: "English", siteLanguages: ["en", "it", "es", "ja"] })).toEqual(["it", "es"]);
    expect(extraLanguageChoices({ language: "Italian", siteLanguages: ["en", "it"] })).toEqual(["en"]);
    expect(extraLanguageChoices({ language: "English", siteLanguages: [] })).toEqual([]);
    expect(mainLanguageCode(null)).toBe("en");
    expect(languageName("es")).toBe("Spanish");
  });
});

describe("which live articles are translated", () => {
  it("each article live since the languages were chosen, into each of them", async () => {
    const { websiteId } = await scene();
    expect(await dueFor(websiteId)).toEqual(["es", "it"]);
  });

  it("not one that went live before - switching it on does not translate the past", async () => {
    const { websiteId } = await scene({ liveAt: new Date("2026-10-19T09:00:00Z") });
    expect(await dueFor(websiteId)).toEqual([]);
  });

  it("not while the site's plugin is older than 1.9.0: it would publish them in the main language", async () => {
    const { websiteId } = await scene({ plugin: "1.8.0" });
    expect(await dueFor(websiteId)).toEqual([]);
    await test.db.insert(integrationKeys).values({ websiteId, keyHash: randomUUID(), keyPrefix: "seo_y", siteInfo: "plugin 1.10.2" });
    expect(await dueFor(websiteId)).toEqual(["es", "it"]);
  });

  it("not a draft, nor a translation itself", async () => {
    const { websiteId, original } = await scene();
    await test.db.update(articles).set({ status: "draft", publishedUrl: null }).where(eq(articles.id, original.id));
    expect(await dueFor(websiteId)).toEqual([]);
  });
});

describe("a translation", () => {
  it("is saved as a draft of its own, naming its original and language, its cost recorded against the website", async () => {
    const { orgId, websiteId, original } = await scene();
    const outcome = await translateLiveArticle({ articleId: original.id, websiteId, organizationId: orgId, language: "it" });
    expect(outcome).toMatchObject({ status: "made", costUsd: 0.0019 });
    if (outcome.status !== "made") return;

    const [row] = await test.db.select().from(articles).where(eq(articles.id, outcome.translationId));
    expect(row).toMatchObject({
      websiteId,
      translationOf: original.id,
      languageCode: "it",
      status: "draft",
      title: "Sposarsi sul Lago di Como",
      slug: "sposarsi-sul-lago-di-como",
      imageUrl: original.imageUrl,
      imageAlt: "Una coppia in barca",
      calendarItemId: null,
      targetKeyword: null,
      reviewStatus: null,
    });
    expect(translator.translate).toHaveBeenCalledWith(expect.objectContaining({ from: "English", to: "Italian", title: "Getting Married on Lake Como" }));

    const [cost] = await test.db.select().from(usageEvents).where(eq(usageEvents.websiteId, websiteId));
    expect(cost).toMatchObject({ organizationId: orgId, kind: "llm", model: "claude-haiku-5-5", costUsd: "0.001900" });
    expect(cost.metadata).toMatchObject({ purpose: "article_translation", originalId: original.id, language: "it", articleId: outcome.translationId });

    // Now there: not due again.
    expect(await dueFor(websiteId)).toEqual(["es"]);
  });

  it("takes no article from the plan: the ledger knows it, and neither the trigger nor the baseline charges it", async () => {
    const { orgId, websiteId, original } = await scene();
    const outcome = await translateLiveArticle({ articleId: original.id, websiteId, organizationId: orgId, language: "es" });
    if (outcome.status !== "made") throw new Error("not made");
    // The app's db is postgres-js; the test one is PGlite, with the same execute().
    await materializeArticleBaseline(test.db as unknown as Parameters<typeof materializeArticleBaseline>[0], websiteId, new Date("2026-01-01T00:00:00Z"));
    const ledger = await test.db.select().from(spendReservations).where(eq(spendReservations.subjectId, outcome.translationId));
    expect(ledger.map((r) => [r.key, r.operation, r.state])).toEqual([[`articles:${websiteId}`, "article.translation", "released"]]);
  });

  it("is tried at most three times, an hour apart, each try counted before it is paid for", async () => {
    const { orgId, websiteId, original } = await scene();
    translator.translate.mockRejectedValue(new TranslationError("The Italian translation changed the article's headings, lists, tables, pictures or links.", USAGE));
    const due = { articleId: original.id, websiteId, organizationId: orgId, language: "it" };

    expect(await translateLiveArticle(due)).toMatchObject({ status: "failed", costUsd: 0.0019 });
    const [tried] = await test.db.select().from(articleTranslationAttempts).where(and(eq(articleTranslationAttempts.articleId, original.id), eq(articleTranslationAttempts.language, "it")));
    expect(tried).toMatchObject({ attempts: 1, lastError: expect.stringContaining("changed the article") });
    // The failed calls were paid for, and are recorded.
    expect(await test.db.select().from(usageEvents).where(eq(usageEvents.websiteId, websiteId))).toHaveLength(1);
    // Not again within the hour...
    expect(await dueFor(websiteId, new Date(Date.now() + 30 * 60_000))).toEqual(["es"]);
    // ...but after it, until the third try.
    expect(await dueFor(websiteId, new Date(Date.now() + 61 * 60_000))).toEqual(["es", "it"]);
    await translateLiveArticle(due);
    await translateLiveArticle(due);
    expect(await dueFor(websiteId, new Date(Date.now() + 5 * 60 * 60_000))).toEqual(["es"]);
    expect(await translateLiveArticle(due)).toEqual({ status: "skipped", reason: "tried enough" });
    expect(translator.translate).toHaveBeenCalledTimes(TRANSLATION_MAX_TRIES);
  });

  it("is never made twice for one language", async () => {
    const { orgId, websiteId, original } = await scene();
    const due = { articleId: original.id, websiteId, organizationId: orgId, language: "it" };
    expect((await translateLiveArticle(due)).status).toBe("made");
    expect(await translateLiveArticle(due)).toEqual({ status: "skipped", reason: "already translated" });
    expect(await test.db.select().from(articles).where(eq(articles.translationOf, original.id))).toHaveLength(1);
  });

  it("is not made without an active plan: nothing is spent", async () => {
    const { orgId, websiteId, original } = await scene({ status: null });
    expect(await translateLiveArticle({ articleId: original.id, websiteId, organizationId: orgId, language: "it" })).toEqual({ status: "skipped", reason: "no active plan" });
    expect(translator.translate).not.toHaveBeenCalled();
  });
});
