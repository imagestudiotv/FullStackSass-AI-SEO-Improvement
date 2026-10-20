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
  outline: vi.fn(), body: vi.fn(), plan: vi.fn(), rank: vi.fn(), collect: vi.fn(), synthesize: vi.fn(), check: vi.fn(), correct: vi.fn(),
}));
vi.mock("@/lib/articles/generate", () => ({ generateOutline: calls.outline, generateBody: calls.body, sanitizeHtml: (s: string) => s, countWords: () => 10 }));
vi.mock("@/lib/articles/research", () => ({ planResearchSearch: calls.plan, rankResearchSources: calls.rank, collectResearchSources: calls.collect, synthesizeResearch: calls.synthesize, checkResearchEvidence: calls.check }));
vi.mock("@/lib/articles/evidence-correction", async original => ({
  ...(await original<object>()), correctResearchDraft: calls.correct,
}));
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
  vi.resetAllMocks();
  vi.stubEnv("ARTICLE_RESEARCH_MODE", "pilot");
  vi.stubEnv("ARTICLE_RESEARCH_WEBSITE_IDS", "*");
  queue.send.mockResolvedValue({ ids: ["test-event"] });
  calls.plan.mockResolvedValue({ primaryQuery: "site:example.org reader question" });
  calls.rank.mockResolvedValue([]);
  calls.collect.mockImplementation(async (_brief, _cost, _diagnostic, options) => {
    await options.rank([{ url: "https://example.org/guide" }, { url: "https://example.net/guide" }]);
    return [];
  });
  calls.synthesize.mockResolvedValue(research);
  calls.outline.mockResolvedValue({ sections: [{ heading: "Reader question", subheadings: [], points: ["Answer"] }], metaDescription: "Meta", faq: [] });
  calls.body.mockResolvedValue({ bodyHtml: "<h2>Reader question</h2><p>Answer to the reader's question.</p>", metaDescription: "Meta", slug: "test", wordCount: 10 });
  calls.check.mockResolvedValue({ checked: true, issues: [] });
  calls.correct.mockResolvedValue({ bodyHtml: "<h2>Reader question</h2><p>Corrected, supported advice.</p>", wordCount: 7 });
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
    expect(calls.rank).toHaveBeenCalledTimes(1);
    expect(calls.plan).toHaveBeenCalledTimes(1);
    expect(calls.body).toHaveBeenCalledTimes(1);
    expect(calls.correct).not.toHaveBeenCalled();
  });
  it("corrects once, checks the actual revision, saves its audit and reuses completed paid steps", async () => {
    calls.check.mockResolvedValueOnce({ checked: true, issues: ["Overstated business figure"] });
    const f = await setup();
    await f.run();
    const [article] = await test.db.select().from(articles).where(eq(articles.id, f.articleId));
    expect(article.bodyHtml).toContain("Corrected, supported advice.");
    expect(article.wordCount).toBe(7);
    expect(article.research).toMatchObject({ quality: { checked: true, issues: [] },
      correction: { attempted: true, applied: true, initialIssues: ["Overstated business figure"] } });
    expect(calls.check.mock.calls[1][0]).toContain("Corrected, supported advice.");
    // The fresh checker receives evidence, not the earlier verdict.
    expect(calls.check.mock.calls[1][2]).not.toHaveProperty("quality");
    await f.run();
    expect(calls.correct).toHaveBeenCalledTimes(1);
    expect(calls.check).toHaveBeenCalledTimes(2);
    expect(article.researchReviewRequired).toBe(true);
  });
  it.each(["correction", "recheck", "remaining-issue"] as const)("keeps the hold when %s fails", async failure => {
    vi.stubEnv("ARTICLE_RESEARCH_MODE", "on");
    calls.synthesize.mockResolvedValue({ ...research, mode: "on" });
    calls.check.mockResolvedValueOnce({ checked: true, issues: ["Unsupported feature"] });
    if (failure === "correction") calls.correct.mockRejectedValueOnce(new Error("Provider unavailable"));
    if (failure === "recheck") calls.check.mockRejectedValueOnce(new Error("Provider unavailable"));
    if (failure === "remaining-issue") calls.check.mockResolvedValue({ checked: true, issues: ["Another unsupported claim"] });
    const f = await setup();
    await f.run();
    const [article] = await test.db.select().from(articles).where(eq(articles.id, f.articleId));
    expect(article.status).toBe("draft");
    expect(article.researchReviewRequired).toBe(true);
    expect(calls.correct).toHaveBeenCalledTimes(failure === "remaining-issue" ? 2 : 1);
    expect(calls.check).toHaveBeenCalledTimes(failure === "correction" ? 1 : failure === "remaining-issue" ? 3 : 2);
    expect(article.bodyHtml).toContain(failure === "correction" ? "Answer to the reader" : "Corrected, supported advice.");
    if (failure === "recheck") expect(article.research).toMatchObject({ quality: { checked: false } });
  });
  it.each(["success", "edit-failure", "check-failure"] as const)("memoizes a bounded final correction and preserves the last usable draft: %s", async outcome => {
    calls.check.mockResolvedValueOnce({ checked: true, issues: ["First issue"] })
      .mockResolvedValueOnce({ checked: true, issues: ["Missed source descriptor"] });
    calls.correct.mockResolvedValueOnce({ bodyHtml: "<h2>First revision</h2><p>First corrected draft.</p>", wordCount: 7 });
    if (outcome === "edit-failure") calls.correct.mockRejectedValueOnce(new Error("Edit unavailable"));
    else calls.correct.mockResolvedValueOnce({ bodyHtml: "<h2>Final revision</h2><p>Fully supported advice.</p>", wordCount: 7 });
    if (outcome === "check-failure") calls.check.mockRejectedValueOnce(new Error("Check unavailable"));
    const f = await setup(); await f.run(); await f.run();
    const [article] = await test.db.select().from(articles).where(eq(articles.id, f.articleId));
    expect(calls.correct).toHaveBeenCalledTimes(2);
    expect(calls.check).toHaveBeenCalledTimes(outcome === "edit-failure" ? 2 : 3);
    expect(calls.correct.mock.calls[1][0]).toContain("First corrected draft");
    expect(calls.correct.mock.calls[1][2].quality.issues).toEqual(["Missed source descriptor"]);
    expect(article.bodyHtml).toContain(outcome === "edit-failure" ? "First corrected draft" : "Fully supported advice");
    expect(article.research).toMatchObject({ correction: { initialIssues: ["First issue"],
      followUp: { applied: outcome !== "edit-failure", issues: ["Missed source descriptor"] } } });
    expect(article.research).toMatchObject({ quality: { checked: outcome !== "check-failure" } });
    expect(article.researchReviewRequired).toBe(true);
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
  it("holds a draft when source ranking fails and records incomplete research", async () => {
    calls.rank.mockRejectedValue(new Error("Selection unavailable"));
    calls.synthesize.mockResolvedValue({ ...research, status: "incomplete", warnings: ["No selected evidence"] });
    const f = await setup();
    await f.run();
    const [article] = await test.db.select().from(articles).where(eq(articles.id, f.articleId));
    expect(calls.synthesize.mock.calls[0][1]).toEqual([]);
    expect(calls.rank).toHaveBeenCalledTimes(1);
    expect(article.status).toBe("draft");
    expect(article.researchReviewRequired).toBe(true);
    expect(await checkReleasable(article.id)).toEqual({ ok: false, reason: "pending_review" });
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
  it("does not start paid research when the rollout scope is missing", async () => {
    vi.stubEnv("ARTICLE_RESEARCH_WEBSITE_IDS", "");
    const f = await setup();
    await f.run();
    expect(calls.plan).not.toHaveBeenCalled();
    expect(calls.collect).not.toHaveBeenCalled();
    expect(calls.synthesize).not.toHaveBeenCalled();
    const [article] = await test.db.select().from(articles).where(eq(articles.id, f.articleId));
    expect(article.research).toBeNull();
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
