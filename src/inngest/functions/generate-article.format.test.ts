import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { articles, usageEvents, websites } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { seedCalendarItem, seedWebsite } from "@/test/fixtures";
import { releaseCheckFor } from "@/lib/articles/review";

/*
  The article's format (lib/articles/format.ts) inside the real job: read
  before the outline, given to both writing calls, checked after writing and
  corrected at most once - each a memoized paid step. Every model call and
  the search are mocked; rows and steps are real.
*/
const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }) }));
const queue = vi.hoisted(() => ({ send: vi.fn(), createFunction: vi.fn((config: unknown, handler: unknown) => ({ config, handler })) }));
vi.mock("@/inngest/client", () => ({ inngest: queue }));
const calls = vi.hoisted(() => ({ outline: vi.fn(), body: vi.fn(), classify: vi.fn(), check: vi.fn(), correct: vi.fn(), search: vi.fn() }));
vi.mock("@/lib/articles/generate", () => ({ generateOutline: calls.outline, generateBody: calls.body, sanitizeHtml: (s: string) => s, countWords: () => 10 }));
vi.mock("@/lib/articles/format", async (original) => ({
  ...(await original<object>()),
  classifyArticleFormat: calls.classify, checkArticleFormat: calls.check, correctArticleFormat: calls.correct,
}));
vi.mock("@/lib/providers/dataforseo", async (original) => ({
  ...(await original<object>()), isDataForSeoConfigured: () => true, articleSearch: calls.search,
}));
vi.mock("@/lib/images/generate", () => ({ isImageGenerationConfigured: () => false, generateArticleImage: vi.fn() }));
vi.mock("@/lib/notifications/create", () => ({ notify: vi.fn() }));
import { generateArticle, queueArticleForCalendarItem } from "./generate-article";

const EXAMPLES = { format: "examples", minItems: 20, basis: "serp", results: 10 };
let test: TestDb;
beforeAll(async () => { test = await createTestDb(); state.db = test.db; });
afterAll(async () => { await test.client.close(); });
afterEach(() => { vi.unstubAllEnvs(); });
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("ARTICLE_RESEARCH_MODE", "off");
  queue.send.mockResolvedValue({ ids: ["test-event"] });
  calls.search.mockImplementation(async (_keyword: string, _location: string, _language: string, onCost: (cost: number) => Promise<void>) => {
    await onCost(0.002);
    return { cached: false, items: [{ url: "https://a.example/wishes", title: "50 привітань зятю", description: "Привітання" }] };
  });
  calls.classify.mockResolvedValue(EXAMPLES);
  calls.outline.mockResolvedValue({ sections: [{ heading: "Як написати", subheadings: [], points: ["Порада"] }], metaDescription: "Meta", faq: [] });
  calls.body.mockResolvedValue({ bodyHtml: "<h2>Як написати</h2><p>Порада без привітань.</p>", metaDescription: "Meta", slug: "test", wordCount: 10 });
  calls.check.mockResolvedValue({ delivers: false, items: 0, problems: ["No wishes, only advice"] });
  calls.correct.mockResolvedValue({ bodyHtml: "<h2>Привітання</h2><ul><li>Зятю, будь щасливий!</li></ul><p>Порада.</p>", wordCount: 6 });
});

async function setup() {
  const f = await seedWebsite(test);
  await test.db.update(websites).set({ autoPublish: false, bodyImages: 0, internalLinkTarget: 0, country: "Ukraine", language: "Ukrainian" })
    .where(eq(websites.id, f.websiteId));
  const item = await seedCalendarItem(test, f.websiteId);
  const queued = await queueArticleForCalendarItem(f.websiteId, item);
  if (!queued.ok) throw new Error(queued.error);
  const data = queue.send.mock.calls.at(-1)![0].data;
  const done = new Map<string, unknown>();
  const step = { run: async (id: string, fn: () => Promise<unknown>) => {
    if (done.has(id)) return done.get(id);
    const value = await fn(); done.set(id, value); return value;
  } };
  const run = () => (generateArticle as unknown as { handler: (context: unknown) => Promise<unknown> }).handler({
    event: { data, id: "test-run" }, step, logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  });
  return { ...f, articleId: queued.articleId, run };
}

describe("the article's format", () => {
  it("reads the website's own search results before the outline and gives the format to both writing calls", async () => {
    const f = await setup();
    await f.run();
    expect(calls.search).toHaveBeenCalledWith(expect.any(String), "Ukraine", "Ukrainian", expect.any(Function));
    expect(calls.classify.mock.invocationCallOrder[0]).toBeLessThan(calls.outline.mock.invocationCallOrder[0]);
    expect(calls.classify.mock.calls[0][1]).toEqual([expect.objectContaining({ title: "50 привітань зятю" })]);
    expect(calls.outline.mock.calls[0][0]).toMatchObject({ format: EXAMPLES });
    expect(calls.body.mock.calls[0][0]).toMatchObject({ format: EXAMPLES });
    const spend = await test.db.select().from(usageEvents).where(eq(usageEvents.websiteId, f.websiteId));
    expect(spend.some((row) => (row.metadata as { purpose?: string } | null)?.purpose === "article_format_search")).toBe(true);
  });

  it("corrects a draft that misses its format exactly once, re-checks the correction, and saves it", async () => {
    calls.check
      .mockResolvedValueOnce({ delivers: false, items: 0, problems: ["No wishes, only advice"] })
      .mockResolvedValueOnce({ delivers: true, items: 22, problems: [] });
    const f = await setup();
    await f.run();
    await f.run();
    const [article] = await test.db.select().from(articles).where(eq(articles.id, f.articleId));
    expect(article.bodyHtml).toContain("Зятю, будь щасливий!");
    expect(article.wordCount).toBe(6);
    expect(calls.check).toHaveBeenCalledTimes(2);
    expect(calls.check.mock.calls[1][0]).toContain("Зятю, будь щасливий!");
    expect(calls.correct).toHaveBeenCalledTimes(1);
    expect(calls.correct.mock.calls[0][3]).toMatchObject({ problems: ["No wishes, only advice"] });
    expect(article.researchReviewRequired).toBe(false);
  });

  it("holds the article for review when the corrected draft still misses its format, with no second correction", async () => {
    const f = await setup();
    await f.run();
    await f.run();
    const [article] = await test.db.select().from(articles).where(eq(articles.id, f.articleId));
    expect(article.bodyHtml).toContain("Зятю, будь щасливий!");
    expect(article.status).toBe("draft");
    expect(article.researchReviewRequired).toBe(true);
    expect(article.researchApprovedHash).toBeNull();
    expect(releaseCheckFor(article)).toEqual({ ok: false, reason: "pending_review" });
    expect(calls.check).toHaveBeenCalledTimes(2);
    expect(calls.correct).toHaveBeenCalledTimes(1);
  });

  it("holds the article when the corrected draft cannot be re-checked", async () => {
    calls.check
      .mockResolvedValueOnce({ delivers: false, items: 0, problems: ["No wishes, only advice"] })
      .mockRejectedValueOnce(new Error("Model down"));
    const f = await setup();
    await f.run();
    const [article] = await test.db.select().from(articles).where(eq(articles.id, f.articleId));
    expect(article.researchReviewRequired).toBe(true);
  });

  it("leaves a draft that delivers its format alone", async () => {
    calls.check.mockResolvedValue({ delivers: true, items: 25, problems: [] });
    const f = await setup();
    await f.run();
    const [article] = await test.db.select().from(articles).where(eq(articles.id, f.articleId));
    expect(article.bodyHtml).toContain("Порада без привітань.");
    expect(calls.correct).not.toHaveBeenCalled();
    expect(calls.check).toHaveBeenCalledTimes(1);
    expect(article.researchReviewRequired).toBe(false);
  });

  it("writes the article as before when the format cannot be read, or the check or correction fails", async () => {
    calls.search.mockRejectedValue(new Error("Search down"));
    calls.classify.mockRejectedValueOnce(new Error("Model down"));
    const f = await setup();
    await f.run();
    expect(calls.outline.mock.calls[0][0].format).toBeNull();
    expect(calls.check).not.toHaveBeenCalled();
    const [article] = await test.db.select().from(articles).where(eq(articles.id, f.articleId));
    expect(article.status).toBe("draft");

    calls.correct.mockRejectedValueOnce(new Error("Edit failed"));
    const g = await setup();
    await g.run();
    const [kept] = await test.db.select().from(articles).where(eq(articles.id, g.articleId));
    expect(kept.bodyHtml).toContain("Порада без привітань.");
    expect(calls.correct).toHaveBeenCalledTimes(1);
    // The draft is known to miss its format and was never fixed: held, not passed.
    expect(kept.researchReviewRequired).toBe(true);
    // Nothing known about the format: written and released as before.
    expect(article.researchReviewRequired).toBe(false);
  });

  it("does not check a plain guide", async () => {
    calls.classify.mockResolvedValue({ format: "guide", minItems: null, basis: "keyword", results: 0 });
    const f = await setup();
    await f.run();
    expect(calls.check).not.toHaveBeenCalled();
  });
});
