import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { articles, calendarItems, clusters } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { seedWebsite } from "@/test/fixtures";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
}));

// The job's queue and every paid call are mocked; rows and allowances are real.
vi.mock("@/inngest/client", () => ({
  inngest: { createFunction: (config: unknown, handler: unknown) => ({ config, handler }) },
}));
const queue = vi.hoisted(() => ({ queueJob: vi.fn(async () => true) }));
vi.mock("@/inngest/send", () => queue);
const notifications = vi.hoisted(() => ({ notify: vi.fn() }));
vi.mock("@/lib/notifications/create", () => notifications);
vi.mock("@/lib/providers/dataforseo", () => ({
  isDataForSeoConfigured: () => false,
  keywordIdeas: vi.fn(),
  keywordsForSite: vi.fn(),
}));
vi.mock("@/lib/keywords/seeds", () => ({
  generateSeedKeywords: vi.fn(async () => [
    { term: "wedding photographer", intent: "commercial" },
    { term: "elopement photographer", intent: "commercial" },
  ]),
}));
vi.mock("@/lib/keywords/cluster", () => ({
  clusterKeywords: vi.fn(async () => [
    { name: "Weddings", pillarKeyword: "wedding photographer", terms: ["wedding photographer", "elopement photographer"] },
  ]),
}));
/*
  The model call is replaced; the dating is not. Each slot gets a title and
  the real scheduleDates, with exactly what the job passed - so the test sees
  the count, rate and kept days the job asked for.
*/
const calendar = vi.hoisted(() => ({ planCalendar: vi.fn() }));
vi.mock("@/lib/keywords/calendar", async (original) => {
  const real = await original<typeof import("@/lib/keywords/calendar")>();
  calendar.planCalendar.mockImplementation(
    async (groups: { name: string }[], limit: number, _intents: unknown, schedule: Parameters<typeof real.scheduleDates>[2]) =>
      real.scheduleDates(limit, new Date(), schedule).map((date, index) => ({
        title: `New topic ${index + 1}`,
        targetKeyword: `new topic ${index + 1}`,
        intent: null,
        clusterName: groups[0].name,
        scheduledFor: date,
      })),
  );
  return { ...real, planCalendar: calendar.planCalendar };
});

import { researchKeywords } from "@/inngest/functions/research-keywords";
import { articlesToPlan, keptDates, replaceUnstartedPlan } from "./replan";

let test: TestDb;

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

beforeEach(() => {
  queue.queueJob.mockClear();
  notifications.notify.mockClear();
  calendar.planCalendar.mockClear();
});

const DAY = 24 * 60 * 60 * 1000;
const localDay = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

/** A calendar item, and optionally the article written for it. */
async function seedItem(
  websiteId: string,
  options: { status?: string; scheduledFor?: Date; article?: string; title?: string } = {},
) {
  const [item] = await test.db
    .insert(calendarItems)
    .values({
      websiteId,
      title: options.title ?? "An item",
      status: options.status ?? "planned",
      scheduledFor: options.scheduledFor ?? new Date(),
    })
    .returning({ id: calendarItems.id });
  if (options.article) {
    await test.db
      .insert(articles)
      .values({ websiteId, calendarItemId: item.id, title: "Written", status: options.article });
  }
  return item.id;
}

/**
 * The client's case: a Grow site (30 a month) twelve articles in, with one
 * more being written right now and the rest of the old plan still waiting.
 */
async function midMonthSite(articleLimit = 30, written = 12) {
  const { orgId, websiteId } = await seedWebsite(test, { articleLimit });
  const kept: string[] = [];
  for (let n = written; n >= 2; n--) {
    kept.push(await seedItem(websiteId, { status: "generated", scheduledFor: new Date(Date.now() - n * DAY), article: "published" }));
  }
  // Today's, written and waiting to go out.
  kept.push(await seedItem(websiteId, { status: "generated", scheduledFor: new Date(), article: "draft" }));
  // Tomorrow's, being written at this moment: its item is still "planned".
  kept.push(await seedItem(websiteId, { status: "planned", scheduledFor: new Date(Date.now() + DAY), article: "generating" }));
  const old: string[] = [];
  for (let n = 2; n < 20; n++) {
    old.push(await seedItem(websiteId, { title: "Old plan", scheduledFor: new Date(Date.now() + n * DAY) }));
  }
  return { orgId, websiteId, kept, old };
}

async function itemsOf(websiteId: string) {
  return test.db
    .select({ id: calendarItems.id, title: calendarItems.title, status: calendarItems.status, scheduledFor: calendarItems.scheduledFor })
    .from(calendarItems)
    .where(eq(calendarItems.websiteId, websiteId));
}

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
const step = { run: async (_id: string, fn: () => unknown) => fn() };

async function runResearch(websiteId: string, organizationId: string, trigger?: "renewal") {
  const job = researchKeywords as unknown as {
    handler: (ctx: unknown) => Promise<{ articles: number }>;
  };
  return job.handler({ event: { data: { websiteId, organizationId, trigger } }, step, logger });
}

describe("articlesToPlan", () => {
  it("is the month's allowance less what it has used", async () => {
    const { websiteId } = await midMonthSite();
    // Eleven published, one draft and one being written: 13 of 30.
    expect(await articlesToPlan(websiteId)).toMatchObject({ count: 17, perDay: 1, usedUp: false, limit: 30, used: 13 });
  });

  it("keeps the plan's own daily rate", async () => {
    const { websiteId } = await seedWebsite(test, { articleLimit: 100 });
    expect(await articlesToPlan(websiteId)).toMatchObject({ count: 100, perDay: 4 });
  });

  it("is used up when every article this month is spent, deleted ones included", async () => {
    const { websiteId } = await seedWebsite(test, { articleLimit: 2 });
    await seedItem(websiteId, { status: "generated", article: "published" });
    await seedItem(websiteId, { status: "generated", article: "published" });
    // Deleting an article does not give its slot back.
    await test.db.delete(articles).where(eq(articles.websiteId, websiteId));
    expect(await articlesToPlan(websiteId)).toMatchObject({ count: 0, usedUp: true });
  });

  it("is not used up for a site with no plan", async () => {
    const { websiteId } = await seedWebsite(test, { status: null });
    expect(await articlesToPlan(websiteId)).toMatchObject({ count: 0, usedUp: false });
  });
});

describe("keptDates", () => {
  it("lists today's and later items that have an article, never the unstarted ones", async () => {
    const { websiteId } = await midMonthSite();
    const dates = (await keptDates(websiteId)).map(localDay).sort();
    expect(dates).toEqual([localDay(new Date()), localDay(new Date(Date.now() + DAY))].sort());
  });
});

describe("replaceUnstartedPlan", () => {
  const plan = (count: number) =>
    Array.from({ length: count }, (_, index) => ({
      title: `New ${index}`,
      targetKeyword: `new ${index}`,
      intent: null,
      clusterName: "Nowhere",
      scheduledFor: new Date(Date.now() + (index + 2) * DAY).toISOString(),
    }));

  it("replaces only the items no article has started", async () => {
    const { websiteId, kept, old } = await midMonthSite();
    expect(await replaceUnstartedPlan(websiteId, plan(17))).toEqual({ saved: 17, usedUp: false });

    const items = await itemsOf(websiteId);
    const ids = new Set(items.map((item) => item.id));
    expect(kept.every((id) => ids.has(id))).toBe(true);
    expect(old.some((id) => ids.has(id))).toBe(false);
    expect(items.filter((item) => item.title.startsWith("New"))).toHaveLength(17);
  });

  it("keeps an item whose article failed: its slot of the month is spent", async () => {
    const { websiteId } = await seedWebsite(test);
    const failed = await seedItem(websiteId, { article: "failed" });
    await replaceUnstartedPlan(websiteId, []);
    expect((await itemsOf(websiteId)).map((item) => item.id)).toEqual([failed]);
  });

  it("trims a plan that no longer fits: an article was started after it was drawn up", async () => {
    const { websiteId } = await midMonthSite();
    // The scheduler starts one of the old plan's items between the two steps.
    await seedItem(websiteId, { scheduledFor: new Date(Date.now() + 2 * DAY), article: "queued" });
    expect(await replaceUnstartedPlan(websiteId, plan(17))).toEqual({ saved: 16, usedUp: false });
  });

  it("files new items under their topic", async () => {
    const { websiteId } = await seedWebsite(test);
    const [topic] = await test.db.insert(clusters).values({ websiteId, name: "Nowhere", pillarKeyword: "x" }).returning({ id: clusters.id });
    await replaceUnstartedPlan(websiteId, plan(1));
    const [item] = await test.db.select({ clusterId: calendarItems.clusterId }).from(calendarItems).where(eq(calendarItems.websiteId, websiteId));
    expect(item.clusterId).toBe(topic.id);
  });
});

describe("re-planning through the research job", () => {
  it("keeps what is written and plans only what is left of the month, from the first free day", async () => {
    const { orgId, websiteId, kept } = await midMonthSite();

    const result = await runResearch(websiteId, orgId);

    // 30 a month, 13 used: 17 new, not another 30.
    expect(result.articles).toBe(17);
    expect(calendar.planCalendar).toHaveBeenCalledWith(expect.anything(), 17, expect.anything(), expect.objectContaining({ perDay: 1 }));

    const items = await itemsOf(websiteId);
    const fresh = items.filter((item) => item.title.startsWith("New topic"));
    expect(fresh).toHaveLength(17);
    expect(items.some((item) => item.title === "Old plan")).toBe(false);
    const ids = new Set(items.map((item) => item.id));
    expect(kept.every((id) => ids.has(id))).toBe(true);
    // 13 kept + 17 new: the month's thirty.
    expect(items).toHaveLength(30);

    // Today and tomorrow already have theirs, so the new plan starts the day after.
    const days = new Set(fresh.map((item) => localDay(item.scheduledFor!)));
    expect(days.has(localDay(new Date()))).toBe(false);
    expect(days.has(localDay(new Date(Date.now() + DAY)))).toBe(false);
    expect(days.has(localDay(new Date(Date.now() + 2 * DAY)))).toBe(true);
    expect(days.size).toBe(17);

    expect(queue.queueJob).toHaveBeenCalledTimes(1);
  });

  it("plans nothing new once the month is used up, and says why", async () => {
    const { orgId, websiteId, kept } = await midMonthSite(13);

    const result = await runResearch(websiteId, orgId);

    expect(result.articles).toBe(0);
    // No model call to plan an empty calendar.
    expect(calendar.planCalendar).not.toHaveBeenCalled();
    expect((await itemsOf(websiteId)).map((item) => item.id).sort()).toEqual([...kept].sort());
    expect(notifications.notify).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.stringContaining("all been used") }),
    );
    expect(queue.queueJob).not.toHaveBeenCalled();
    const [site] = await test.client.query<{ status: string }>("select status from websites where id = $1", [websiteId]).then((r) => r.rows);
    expect(site.status).toBe("ready");
  });

  it("says a renewal run is the new month's plan, which nobody asked for by hand", async () => {
    const { orgId, websiteId } = await seedWebsite(test, { articleLimit: 30 });

    expect((await runResearch(websiteId, orgId, "renewal")).articles).toBe(30);
    expect(notifications.notify).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Your content plan for the new month is ready",
        body: expect.stringContaining("30 articles planned"),
      }),
    );
  });
});
