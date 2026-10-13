import { eq } from "drizzle-orm";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { articleIndexing, articles, notifications, usageEvents } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { seedWebsite } from "@/test/fixtures";

/**
 * Google indexing of published articles (client, 2026-10-13: "Your article
 * was indexed"), on a disposable database. SpeedyIndex itself is mocked:
 * nothing here calls the real API.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }) }));
const api = vi.hoisted(() => ({ create: vi.fn(), statuses: vi.fn(), report: vi.fn() }));
vi.mock("@/lib/indexing/speedyindex", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  createIndexTask: api.create,
  readTaskStatuses: api.statuses,
  readTaskReport: api.report,
}));

import { SpeedyIndexError } from "./speedyindex";
import { announceIndexed, checkSubmitted, MAX_ATTEMPTS, queueNewlyLive, submitQueued } from "./run";

let test: TestDb;
beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
let tasks = 0;
beforeEach(async () => {
  await test.client.exec("delete from article_indexing; delete from articles; delete from notifications; delete from usage_events;");
  delete process.env.SPEEDYINDEX_DAILY_LIMIT;
  tasks = 0;
  api.create.mockReset().mockImplementation(async () => `task-${++tasks}`);
  api.statuses.mockReset().mockResolvedValue([]);
  api.report.mockReset().mockResolvedValue({ indexed: [], unindexed: [] });
});
afterEach(() => {
  delete process.env.SPEEDYINDEX_DAILY_LIMIT;
});

async function article(websiteId: string, over: Partial<typeof articles.$inferInsert> = {}) {
  const slug = Math.random().toString(36).slice(2, 8);
  const [row] = await test.db
    .insert(articles)
    .values({ websiteId, title: `Article ${slug}`, status: "published", publishedUrl: `https://site.test/${slug}/`, firstLiveAt: new Date(Date.now() - HOUR), ...over })
    .returning();
  return row;
}

const rows = () => test.db.select().from(articleIndexing);

describe("which articles are sent", () => {
  it("those that went live in the last three days, once per address; not older ones, drafts or articles without an address", async () => {
    const { websiteId } = await seedWebsite(test);
    const fresh = await article(websiteId);
    await article(websiteId, { firstLiveAt: new Date(Date.now() - 5 * DAY) });
    await article(websiteId, { status: "draft", firstLiveAt: null });
    await article(websiteId, { publishedUrl: null });
    await article(websiteId, { publishedUrl: "javascript:alert(1)" });

    expect(await queueNewlyLive()).toBe(1);
    expect(await queueNewlyLive()).toBe(0);
    const [row] = await rows();
    expect(row).toMatchObject({ articleId: fresh.id, url: fresh.publishedUrl, status: "queued", attempts: 0 });

    // The post moved to a new address: that address is sent too.
    await test.db.update(articles).set({ publishedUrl: "https://site.test/moved/" }).where(eq(articles.id, fresh.id));
    expect(await queueNewlyLive()).toBe(1);
  });
});

describe("sending", () => {
  it("sends what is queued as one task, and records it", async () => {
    const { websiteId } = await seedWebsite(test);
    const a = await article(websiteId);
    const b = await article(websiteId);
    await queueNewlyLive();

    const outcome = await submitQueued();
    expect(outcome).toMatchObject({ sent: 2, held: 0, taskId: "task-1" });
    expect(api.create).toHaveBeenCalledTimes(1);
    expect([...api.create.mock.calls[0][0]].sort()).toEqual([a.publishedUrl, b.publishedUrl].sort());
    expect((await rows()).every((row) => row.status === "submitted" && row.taskId === "task-1" && row.submittedAt)).toBe(true);
    // Nothing left to send.
    expect((await submitQueued()).sent).toBe(0);
    expect(api.create).toHaveBeenCalledTimes(1);
  });

  it("skips websites without a plan", async () => {
    const { websiteId } = await seedWebsite(test, { status: null });
    await article(websiteId);
    await queueNewlyLive();
    expect(await submitQueued()).toMatchObject({ sent: 0, skipped: 1 });
    expect(api.create).not.toHaveBeenCalled();
    expect((await rows())[0]).toMatchObject({ status: "skipped" });
  });

  it("keeps to the daily limit; the rest waits for the next run", async () => {
    process.env.SPEEDYINDEX_DAILY_LIMIT = "2";
    const { websiteId } = await seedWebsite(test);
    for (let i = 0; i < 3; i++) await article(websiteId);
    await queueNewlyLive();

    expect(await submitQueued()).toMatchObject({ sent: 2, held: 1 });
    expect(await submitQueued()).toMatchObject({ sent: 0, held: 1, reason: "daily_limit" });
    // A day later there is room again.
    expect(await submitQueued(new Date(Date.now() + DAY + HOUR))).toMatchObject({ sent: 1 });
  });

  it("an empty balance holds the articles, without using up their attempts, until it is topped up", async () => {
    const { websiteId } = await seedWebsite(test);
    await article(websiteId);
    await queueNewlyLive();
    api.create.mockRejectedValueOnce(new SpeedyIndexError("The SpeedyIndex balance is empty - top it up", "balance"));

    expect(await submitQueued()).toMatchObject({ sent: 0, held: 1, reason: "balance" });
    expect((await rows())[0]).toMatchObject({ status: "queued", attempts: 0, error: expect.stringContaining("balance") });
    expect(await submitQueued()).toMatchObject({ sent: 1 });
    expect((await rows())[0]).toMatchObject({ status: "submitted", error: null });
  });

  it("one refused address does not hold back the others", async () => {
    const { websiteId } = await seedWebsite(test);
    const good = await article(websiteId);
    const bad = await article(websiteId);
    await queueNewlyLive();
    api.create.mockImplementation(async (urls: string[]) => {
      if (urls.includes(bad.publishedUrl!)) throw new SpeedyIndexError("SpeedyIndex refused the request as invalid", "invalid");
      return `task-${++tasks}`;
    });

    expect(await submitQueued()).toMatchObject({ sent: 1, failed: 1 });
    const byArticle = new Map((await rows()).map((row) => [row.articleId, row]));
    expect(byArticle.get(good.id)).toMatchObject({ status: "submitted" });
    expect(byArticle.get(bad.id)).toMatchObject({ status: "failed" });
  });

  it("no answer is retried, and given up after three attempts", async () => {
    const { websiteId } = await seedWebsite(test);
    await article(websiteId);
    await queueNewlyLive();
    api.create.mockRejectedValue(new SpeedyIndexError("SpeedyIndex did not answer: TimeoutError", "network"));

    for (let i = 1; i < MAX_ATTEMPTS; i++) {
      await submitQueued();
      expect((await rows())[0]).toMatchObject({ status: "queued", attempts: i });
    }
    await submitQueued();
    expect((await rows())[0]).toMatchObject({ status: "failed", attempts: MAX_ATTEMPTS });
  });

  it("a row that could not be sent for a week is given up", async () => {
    const { websiteId } = await seedWebsite(test);
    await article(websiteId);
    await queueNewlyLive();
    await submitQueued(new Date(Date.now() + 8 * DAY));
    expect((await rows())[0]).toMatchObject({ status: "failed" });
    expect(api.create).not.toHaveBeenCalled();
  });
});

describe("results", () => {
  async function sent() {
    const { orgId, websiteId } = await seedWebsite(test);
    const a = await article(websiteId, { title: "Wedding videos in Rome" });
    const b = await article(websiteId);
    await queueNewlyLive();
    await submitQueued();
    return { orgId, websiteId, a, b };
  }

  it("records an indexed article once, then tells the customer and records the cost", async () => {
    const { orgId, websiteId, a, b } = await sent();
    api.statuses.mockResolvedValue([{ id: "task-1", size: 2, processed: 2, indexed: 1, completed: false }]);
    // SpeedyIndex may echo the address without its trailing slash.
    api.report.mockResolvedValue({ indexed: [a.publishedUrl!.replace(/\/$/, "")], unindexed: [] });

    const first = await checkSubmitted();
    expect(first.indexed).toEqual([expect.objectContaining({ articleId: a.id, websiteId, organizationId: orgId, title: "Wedding videos in Rome" })]);
    for (const indexed of first.indexed) await announceIndexed(indexed);
    expect((await checkSubmitted()).indexed).toEqual([]);

    const byArticle = new Map((await rows()).map((row) => [row.articleId, row]));
    expect(byArticle.get(a.id)).toMatchObject({ status: "indexed", indexedAt: expect.any(Date) });
    expect(byArticle.get(b.id)).toMatchObject({ status: "submitted" });

    const notes = await test.db.select().from(notifications).where(eq(notifications.organizationId, orgId));
    expect(notes).toEqual([
      expect.objectContaining({ type: "article.indexed", title: 'Google indexed "Wedding videos in Rome"', href: `/websites/${websiteId}/articles/${a.id}` }),
    ]);
    const costs = await test.db.select().from(usageEvents).where(eq(usageEvents.organizationId, orgId));
    expect(costs).toEqual([expect.objectContaining({ provider: "speedyindex", kind: "seo_api", costUsd: "0.100000" })]);
  });

  it("a finished task's other addresses are not indexed, with the reason when SpeedyIndex gives one", async () => {
    const { a, b } = await sent();
    api.statuses.mockResolvedValue([{ id: "task-1", size: 2, processed: 2, indexed: 0, completed: true }]);
    api.report.mockResolvedValue({ indexed: [], unindexed: [{ url: a.publishedUrl!, errorCode: -1 }] });

    expect(await checkSubmitted()).toMatchObject({ notIndexed: 2, indexed: [] });
    const byArticle = new Map((await rows()).map((row) => [row.articleId, row]));
    expect(byArticle.get(a.id)).toMatchObject({ status: "not_indexed", error: "The page has a noindex tag" });
    expect(byArticle.get(b.id)).toMatchObject({ status: "not_indexed", error: "No result from SpeedyIndex" });
  });

  it("nothing new: no report is read; after ten days without a result, it is not indexed", async () => {
    await sent();
    api.statuses.mockResolvedValue([{ id: "task-1", size: 2, processed: 1, indexed: 0, completed: false }]);
    expect(await checkSubmitted()).toMatchObject({ tasks: 0, notIndexed: 0 });
    expect(api.report).not.toHaveBeenCalled();
    expect((await rows()).every((row) => row.status === "submitted" && row.checkedAt)).toBe(true);

    expect(await checkSubmitted(new Date(Date.now() + 11 * DAY))).toMatchObject({ notIndexed: 2 });
    expect((await rows()).every((row) => row.status === "not_indexed")).toBe(true);
  });
});
