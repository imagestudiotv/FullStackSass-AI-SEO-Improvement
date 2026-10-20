import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { articles, websites } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { seedCalendarItem, seedWebsite } from "@/test/fixtures";
import type { ResearchBrief } from "@/lib/articles/research-types";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }) }));
const queue = vi.hoisted(() => ({ send: vi.fn(), createFunction: vi.fn((config: unknown, handler: unknown) => ({ config, handler })) }));
vi.mock("@/inngest/client", () => ({ inngest: queue }));
const calls = vi.hoisted(() => ({
  outline: vi.fn(), body: vi.fn(), plan: vi.fn(), collect: vi.fn(), synthesize: vi.fn(), check: vi.fn(),
}));
vi.mock("@/lib/articles/generate", () => ({ generateOutline: calls.outline, generateBody: calls.body, sanitizeHtml: (s: string) => s, countWords: () => 10 }));
vi.mock("@/lib/articles/research", () => ({ planResearchSearch: calls.plan, collectResearchSources: calls.collect, synthesizeResearch: calls.synthesize, checkResearchEvidence: calls.check }));
vi.mock("@/lib/images/generate", () => ({ isImageGenerationConfigured: () => false, generateArticleImage: vi.fn() }));
vi.mock("@/lib/notifications/create", () => ({ notify: vi.fn() }));
import { generateArticle, queueArticleForCalendarItem } from "./generate-article";
import { checkReleasable } from "@/lib/articles/review";

const research: ResearchBrief = { version: 1, status: "ready", mode: "pilot", question: "Reader question",
  intent: "commercial", businessAngle: "Relevant services", subquestions: ["What matters?"], claims: [], warnings: [],
  sources: [], checkedAt: "2026-10-20" };
let test: TestDb;
beforeAll(async () => { test = await createTestDb(); state.db = test.db; });
afterAll(async () => { await test.client.close(); });
afterEach(() => { vi.unstubAllEnvs(); });
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("ARTICLE_RESEARCH_MODE", "pilot");
  vi.stubEnv("ARTICLE_RESEARCH_WEBSITE_IDS", "");
  queue.send.mockResolvedValue({ ids: ["test-event"] });
  calls.plan.mockResolvedValue({ primaryQuery: "site:example.org reader question" });
  calls.collect.mockResolvedValue([]);
  calls.synthesize.mockResolvedValue(research);
  calls.outline.mockResolvedValue({ sections: [{ heading: "Reader question", subheadings: [], points: ["Answer"] }], metaDescription: "Meta", faq: [] });
  calls.body.mockResolvedValue({ bodyHtml: "<h2>Reader question</h2><p>Answer to the reader's question.</p>", metaDescription: "Meta", slug: "test", wordCount: 10 });
  calls.check.mockResolvedValue({ checked: true, issues: [] });
});
async function setup() {
  const f = await seedWebsite(test);
  await test.db.update(websites).set({ autoPublish: true, bodyImages: 0, internalLinkTarget: 0 }).where(eq(websites.id, f.websiteId));
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

describe("researched article pipeline", () => {
  it("researches before writing, persists evidence, holds even automatic publishing, and reuses completed steps", async () => {
    const f = await setup();
    await f.run();
    const [article] = await test.db.select().from(articles).where(eq(articles.id, f.articleId));
    expect(calls.collect.mock.invocationCallOrder[0]).toBeLessThan(calls.outline.mock.invocationCallOrder[0]);
    expect(calls.plan.mock.invocationCallOrder[0]).toBeLessThan(calls.collect.mock.invocationCallOrder[0]);
    expect(calls.collect.mock.calls[0][3]).toMatchObject({ primaryQuery: "site:example.org reader question" });
    expect(calls.outline.mock.calls[0][0]).toMatchObject({ research, intent: "commercial" });
    expect(calls.body.mock.calls[0][0]).toMatchObject({ research });
    expect(article.research).toMatchObject({ status: "ready", quality: { checked: true } });
    expect(article.researchReviewRequired).toBe(true);
    expect(await checkReleasable(article.id)).toEqual({ ok: false, reason: "pending_review" });
    await f.run();
    expect(calls.collect).toHaveBeenCalledTimes(1);
    expect(calls.plan).toHaveBeenCalledTimes(1);
    expect(calls.body).toHaveBeenCalledTimes(1);
  });
  it("saves a reviewable draft when research or checking fails instead of claiming success", async () => {
    calls.collect.mockRejectedValue(new Error("Unavailable"));
    calls.synthesize.mockRejectedValue(new Error("Unavailable"));
    calls.check.mockRejectedValue(new Error("Unavailable"));
    const f = await setup();
    await f.run();
    const [article] = await test.db.select().from(articles).where(eq(articles.id, f.articleId));
    expect(article.status).toBe("draft");
    expect(article.research).toMatchObject({ status: "unavailable", quality: { checked: false } });
    expect(article.researchReviewRequired).toBe(true);
    expect(calls.body).toHaveBeenCalledTimes(1);
  });
  it("keeps research disabled for websites outside the pilot", async () => {
    vi.stubEnv("ARTICLE_RESEARCH_WEBSITE_IDS", "another-site");
    const f = await setup();
    await f.run();
    expect(calls.plan).not.toHaveBeenCalled();
    expect(calls.collect).not.toHaveBeenCalled();
    expect(calls.synthesize).not.toHaveBeenCalled();
    expect(calls.check).not.toHaveBeenCalled();
  });
  it("falls back to the original search and keeps the review hold if planning fails", async () => {
    calls.plan.mockRejectedValueOnce(new Error("Planner unavailable"));
    const f = await setup();
    await f.run();
    expect(calls.collect.mock.calls[0][3].primaryQuery).toBeUndefined();
    expect(calls.body).toHaveBeenCalledTimes(1);
    expect(await checkReleasable(f.articleId)).toEqual({ ok: false, reason: "pending_review" });
  });
  it("remembers a writing experiment even if its override is removed before saving", async () => {
    vi.stubEnv("ARTICLE_RESEARCH_MODE", "off");
    vi.stubEnv("ARTICLE_MODEL_BODY", "candidate");
    calls.body.mockImplementationOnce(async () => {
      vi.stubEnv("ARTICLE_MODEL_BODY", "");
      return { bodyHtml: "<p>Experimental draft</p>", metaDescription: "Meta", slug: "test", wordCount: 2 };
    });
    const f = await setup();
    await f.run();
    const [article] = await test.db.select().from(articles).where(eq(articles.id, f.articleId));
    expect(article.researchReviewRequired).toBe(true);
  });
});
