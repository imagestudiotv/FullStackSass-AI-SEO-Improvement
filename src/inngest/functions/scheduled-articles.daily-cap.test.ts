import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { articles, calendarItems, creditSettings, organization, websites } from "@/lib/db/schema";
import { dailyLimitKey, DEFAULT_DAILY_LIMITS } from "@/lib/publishing/daily-cap";
import { createTestDb, type TestDb } from "@/test/db";

/**
 * The scheduler itself, on PGlite, with the daily article limits set on
 * Admin -> Websites (lib/publishing/daily-cap.ts; client, 2026-11-21: one
 * article a day for imagestudio.com, for testing). Its agency allowance of 500
 * a month is a batch of 34 per run; with the limit, both daily runs together
 * write ONE article a day, and only for that website.
 */

const state = vi.hoisted(() => ({ db: null as unknown, used: new Map<string, number>() }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
}));
vi.mock("@/inngest/client", () => ({
  inngest: { createFunction: vi.fn((config: unknown, handler: unknown) => ({ config, handler })) },
}));
// Queueing writes the article row straight away, as generate-article does, and takes the topic off the calendar.
vi.mock("@/inngest/functions/generate-article", () => ({
  queueArticleForCalendarItem: vi.fn(async (websiteId: string, itemId: string) => {
    const db = state.db as TestDb["db"];
    const [item] = await db.select().from(calendarItems).where(eq(calendarItems.id, itemId));
    await db.insert(articles).values({ websiteId, calendarItemId: itemId, title: item!.title, status: "draft", createdAt: new Date(), updatedAt: new Date() });
    await db.update(calendarItems).set({ status: "queued" }).where(eq(calendarItems.id, itemId));
    state.used.set(websiteId, (state.used.get(websiteId) ?? 0) + 1);
    return { ok: true };
  }),
}));
// An agency workspace: 500 articles a month, plenty left.
vi.mock("@/lib/usage", () => ({
  checkLimit: vi.fn(async (websiteId: string) => {
    const used = 100 + (state.used.get(websiteId) ?? 0);
    return { allowed: true, used, limit: 500, monthlyLimit: 500 };
  }),
}));
vi.mock("@/lib/notifications/create", () => ({ notify: vi.fn() }));
vi.mock("@/lib/plugin/sync", () => ({ nudgePluginIfDue: vi.fn() }));
// Publishing frozen: this test is about writing, not releasing drafts.
vi.mock("@/lib/publishing/controls", () => ({ isControlEnabled: vi.fn(async () => true) }));

import { scheduledArticles } from "./scheduled-articles";

type Job = { handler: (ctx: unknown) => Promise<{ queued: number }> };
const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
const step = { run: async (_id: string, fn: () => unknown) => fn() };
const run = (at: string) => {
  vi.setSystemTime(new Date(at));
  return (scheduledArticles as unknown as Job).handler({ step, logger });
};

const IMAGESTUDIO = DEFAULT_DAILY_LIMITS[0]!.websiteId;

let test: TestDb;
beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  state.used.clear();
});
afterEach(() => {
  vi.useRealTimers();
});

/** An automatic, ready website with `topics` planned topics, overdue and in the coming days. */
async function site(id: string, topics = 40) {
  const orgId = `org_${randomUUID()}`;
  await test.db.insert(organization).values({ id: orgId, name: "Agency", slug: orgId, createdAt: new Date() });
  await test.db.insert(websites).values({ id, organizationId: orgId, url: `https://${id}.example`, domain: `${id}.example`, status: "ready", generationMode: "automatic", autoPublish: false });
  const start = new Date("2026-11-19T09:00:00Z").getTime();
  await test.db.insert(calendarItems).values(
    Array.from({ length: topics }, (_, i) => ({ websiteId: id, title: `Topic ${i + 1}`, status: "planned", scheduledFor: new Date(start + (i % 6) * 86_400_000) })),
  );
}
const written = async (id: string) => (await test.db.select().from(articles).where(eq(articles.websiteId, id))).length;
const writtenOn = async (id: string, day: string) =>
  (await test.db.select().from(articles).where(and(eq(articles.websiteId, id)))).filter((a) => a.createdAt.toISOString().startsWith(day)).length;

describe("scheduled articles with imagestudio.com's daily cap", () => {
  it("writes one article a day for imagestudio.com across both daily runs, and a normal batch for any other site", async () => {
    const other = randomUUID();
    await site(IMAGESTUDIO);
    await site(other);

    await run("2026-11-22T06:00:00Z");
    expect(await written(IMAGESTUDIO)).toBe(1);
    // The same run writes a full batch for a site without a cap: the cap is imagestudio.com's alone.
    expect(await written(other)).toBeGreaterThan(1);

    // The afternoon run of the same day writes nothing more.
    await run("2026-11-22T14:00:00Z");
    expect(await written(IMAGESTUDIO)).toBe(1);

    // Next day: one more, and again nothing in the afternoon.
    await run("2026-11-23T06:00:00Z");
    await run("2026-11-23T14:00:00Z");
    expect(await writtenOn(IMAGESTUDIO, "2026-11-22")).toBe(1);
    expect(await writtenOn(IMAGESTUDIO, "2026-11-23")).toBe(1);
    expect(await written(IMAGESTUDIO)).toBe(2);
  });

  it("counts an article written by hand the same day, so the scheduler adds none", async () => {
    await test.db.delete(articles).where(eq(articles.websiteId, IMAGESTUDIO));
    const [item] = await test.db.select().from(calendarItems).where(eq(calendarItems.websiteId, IMAGESTUDIO)).limit(1);
    await test.db.insert(articles).values({ websiteId: IMAGESTUDIO, calendarItemId: item!.id, title: "By hand", createdAt: new Date("2026-11-24T05:00:00Z"), updatedAt: new Date("2026-11-24T05:00:00Z") });

    await run("2026-11-24T06:00:00Z");
    await run("2026-11-24T14:00:00Z");
    expect(await writtenOn(IMAGESTUDIO, "2026-11-24")).toBe(1);
  });

  it("stays at one a day after 1 December: the limit no longer ends by itself", async () => {
    await run("2026-12-01T06:00:00Z");
    await run("2026-12-01T14:00:00Z");
    await run("2026-12-02T06:00:00Z");
    expect(await writtenOn(IMAGESTUDIO, "2026-12-01")).toBe(1);
    expect(await writtenOn(IMAGESTUDIO, "2026-12-02")).toBe(1);
  });

  it("follows the administrator's setting: 3 a day, then 'No limit' gives the normal batch back", async () => {
    await test.db.insert(creditSettings).values({ key: dailyLimitKey(IMAGESTUDIO), value: 3 });
    await run("2026-12-03T06:00:00Z");
    await run("2026-12-03T14:00:00Z");
    expect(await writtenOn(IMAGESTUDIO, "2026-12-03")).toBe(3);

    await test.db.update(creditSettings).set({ value: 0 }).where(eq(creditSettings.key, dailyLimitKey(IMAGESTUDIO)));
    await run("2026-12-04T06:00:00Z");
    expect(await writtenOn(IMAGESTUDIO, "2026-12-04")).toBeGreaterThan(3);
  });

  it("limits any website an administrator sets, not only imagestudio.com", async () => {
    const other = randomUUID();
    await site(other);
    await test.db.insert(creditSettings).values({ key: dailyLimitKey(other), value: 2 });
    await run("2026-12-05T06:00:00Z");
    await run("2026-12-05T14:00:00Z");
    expect(await writtenOn(other, "2026-12-05")).toBe(2);
  });
});
