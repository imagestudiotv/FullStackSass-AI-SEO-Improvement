import { randomUUID } from "node:crypto";

import { and, asc, eq, sql } from "drizzle-orm";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { user } from "@/lib/db/auth-tables";
import { agencyWorkspaces, articles, calendarItems, creditSettings, freePlanAccounts, notifications, organization, websites } from "@/lib/db/schema";
import { dailyLimitKey, DEFAULT_DAILY_LIMITS } from "@/lib/publishing/daily-cap";
import { createTestDb, type TestDb } from "@/test/db";
import { seedWebsite } from "@/test/fixtures";

/**
 * The scheduler's PACE (client, 2026-11-24: a Free website had three articles
 * in one day; "one article per week ... for subscribers 1 article a day"),
 * and the daily limits of Admin -> Websites (2026-11-21, imagestudio.com).
 *
 * The real scheduler and the real queueing (reservations, allowances and the
 * pace counted under its lock), on PGlite. Only the writing itself, and what
 * leaves the process, is stood in for.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
}));
vi.mock("@/inngest/client", () => ({
  inngest: {
    send: vi.fn(async () => ({ ids: ["evt"] })),
    createFunction: vi.fn((config: unknown, handler: unknown) => ({ config, handler })),
  },
}));
vi.mock("@/lib/articles/generate", () => ({ generateOutline: vi.fn(), generateBody: vi.fn(), sanitizeHtml: (html: string) => html, countWords: () => 0 }));
vi.mock("@/lib/images/generate", () => ({ isImageGenerationConfigured: () => false, generateArticleImage: vi.fn() }));
vi.mock("@/lib/plugin/sync", () => ({ nudgePluginIfDue: vi.fn() }));
// Publishing frozen: this test is about writing, not releasing drafts.
vi.mock("@/lib/publishing/controls", () => ({ isControlEnabled: vi.fn(async () => true) }));

import { AUTO_RETRIES, queueArticleForCalendarItem } from "./generate-article";
import { scheduledArticles } from "./scheduled-articles";

type Job = { handler: (ctx: unknown) => Promise<{ queued: number }> };
const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
const step = { run: async (_id: string, fn: () => unknown) => fn() };
const run = (at: string) => {
  vi.setSystemTime(new Date(at));
  return (scheduledArticles as unknown as Job).handler({ step, logger });
};
const days = (from: string, count: number) =>
  Array.from({ length: count }, (_, i) => new Date(new Date(`${from}T00:00:00Z`).getTime() + i * 86_400_000).toISOString().slice(0, 10));

const IMAGESTUDIO = DEFAULT_DAILY_LIMITS[0]!.websiteId;

let test: TestDb;
beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-20T00:00:00Z"));
  // One website per test: the scheduler looks at every one there is.
  await test.client.exec("delete from articles; delete from calendar_items; delete from spend_reservations; delete from free_plan_accounts; delete from notifications; delete from websites; delete from credit_settings; delete from job_outbox");
});
afterEach(() => {
  vi.useRealTimers();
});

/** `count` planned topics, one a day from `from` (overdue ones included). */
async function plan(websiteId: string, from: string, count: number) {
  await test.db.insert(calendarItems).values(
    days(from, count).map((day, i) => ({ websiteId, title: `Topic ${i + 1}`, status: "planned", scheduledFor: new Date(`${day}T09:00:00Z`) })),
  );
}

/** A website of a paying customer, `articleLimit` a month, from a month that opened at `opened`. */
async function paid(articleLimit: number, opened = "2026-11-20T10:00:00Z") {
  const { websiteId, orgId } = await seedWebsite(test, { articleLimit });
  await test.db.update(websites).set({ generationMode: "automatic", autoPublish: true }).where(eq(websites.id, websiteId));
  await test.client.query("update subscriptions set current_period_start = $2 where website_id = $1", [websiteId, opened]);
  return { websiteId, orgId };
}

async function free() {
  const { websiteId, orgId } = await seedWebsite(test, { status: null });
  await test.db.update(websites).set({ generationMode: "automatic", autoPublish: true }).where(eq(websites.id, websiteId));
  const userId = `user_${randomUUID()}`;
  await test.db.insert(user).values({ id: userId, name: "Free", email: `${userId}@example.test`, emailVerified: true, createdAt: new Date(), updatedAt: new Date() });
  await test.db.insert(freePlanAccounts).values({ organizationId: orgId, websiteId, domain: `${orgId}.example`, userId });
  return { websiteId, orgId };
}

async function agency(id: string, articleLimit = 500) {
  const orgId = `org_${randomUUID()}`;
  await test.db.insert(organization).values({ id: orgId, name: "Agency", slug: orgId, createdAt: new Date() });
  await test.db.insert(agencyWorkspaces).values({ organizationId: orgId });
  await test.client.query("update agency_workspaces set article_limit = $2 where organization_id = $1", [orgId, articleLimit]);
  await test.db.insert(websites).values({ id, organizationId: orgId, url: `https://${id}.example`, domain: `${id}.example`, status: "ready", generationMode: "automatic", autoPublish: false });
  return { websiteId: id, orgId };
}

/** What generate-article does with everything queued. */
async function write(websiteId: string) {
  await test.client.query("update articles set status = 'draft', body_html = '<p>x</p>' where website_id = $1 and status = 'queued'", [websiteId]);
  await test.client.query("update calendar_items ci set status = 'generated' from articles a where a.calendar_item_id = ci.id and a.website_id = $1 and a.status = 'draft'", [websiteId]);
}
async function fail(websiteId: string, spent = true) {
  await test.client.query("update articles set status = 'failed', updated_at = $2 where website_id = $1 and status = 'queued'", [websiteId, new Date().toISOString()]);
  await test.client.query(`update spend_reservations set state = '${spent ? "consumed" : "released"}' where website_id = $1 and state = 'reserved'`, [websiteId]);
}
const rows = (websiteId: string) => test.db.select().from(articles).where(eq(articles.websiteId, websiteId)).orderBy(asc(articles.createdAt));
const written = async (websiteId: string) => (await rows(websiteId)).length;
const startedOn = async (websiteId: string) => {
  const perDay: Record<string, number> = {};
  for (const row of await rows(websiteId)) {
    // created_at is stamped by the database's own clock; the reservation carries the scheduler's.
    const { rows: ledger } = await test.client.query<{ day: string }>("select to_char(counted_at, 'YYYY-MM-DD') as day from spend_reservations where subject_id = $1 and key like 'articles:%'", [row.id]);
    perDay[ledger[0]!.day] = (perDay[ledger[0]!.day] ?? 0) + 1;
  }
  return perDay;
};
const planned = async (websiteId: string) =>
  (await test.db
    .select({ at: calendarItems.scheduledFor })
    .from(calendarItems)
    .where(and(eq(calendarItems.websiteId, websiteId), sql`not exists (select 1 from articles a where a.calendar_item_id = ${calendarItems.id})`))
    .orderBy(asc(calendarItems.scheduledFor))).map((row) => row.at!.toISOString().slice(0, 10));

/** PGlite stamps rows with the real clock: give a started article the scheduler's time. */
async function runAt(at: string, websiteId: string) {
  const before = new Set((await rows(websiteId)).map((row) => row.id));
  const result = await run(at);
  for (const row of await rows(websiteId)) {
    if (!before.has(row.id)) await test.client.query("update articles set created_at = $2, updated_at = $2 where id = $1", [row.id, at]);
  }
  return result;
}

describe("Free: the first article at once, then one a week", () => {
  it("starts one article on the first day, whatever the number of runs, and lays the rest out a week apart", async () => {
    const { websiteId } = await free();
    // Planned before the rule: a topic a day.
    await plan(websiteId, "2026-11-21", 4);
    for (const at of ["2026-11-21T13:40:00Z", "2026-11-21T13:41:00Z", "2026-11-21T14:00:00Z", "2026-11-21T22:00:00Z"]) {
      await runAt(at, websiteId);
      await write(websiteId);
    }
    expect(await written(websiteId)).toBe(1);
    expect(await planned(websiteId)).toEqual(["2026-11-28", "2026-12-05", "2026-12-12"]);
  });

  it("starts one every seven days over a month of runs, twice a day", async () => {
    const { websiteId } = await free();
    await plan(websiteId, "2026-11-21", 4);
    for (const day of days("2026-11-21", 24)) {
      for (const hour of ["06:00", "14:00"]) {
        await runAt(`${day}T${hour}:00Z`, websiteId);
        await write(websiteId);
      }
    }
    expect(await startedOn(websiteId)).toEqual({ "2026-11-21": 1, "2026-11-28": 1, "2026-12-05": 1, "2026-12-12": 1 });
  });

  it("counts an article written by hand, and a deleted one", async () => {
    const { websiteId } = await free();
    await plan(websiteId, "2026-11-21", 4);
    vi.setSystemTime(new Date("2026-11-21T09:00:00Z"));
    const [item] = await test.db.select().from(calendarItems).where(eq(calendarItems.websiteId, websiteId)).limit(1);
    expect((await queueArticleForCalendarItem(websiteId, item!.id, { now: new Date() })).ok).toBe(true);
    await test.client.query("update articles set created_at = '2026-11-21T09:00:00Z' where website_id = $1", [websiteId]);
    await write(websiteId);
    await runAt("2026-11-21T14:00:00Z", websiteId);
    expect(await written(websiteId)).toBe(1);

    await test.client.query("delete from articles where website_id = $1", [websiteId]);
    await runAt("2026-11-24T06:00:00Z", websiteId);
    expect(await written(websiteId)).toBe(0);
    await runAt("2026-11-28T06:00:00Z", websiteId);
    expect(await written(websiteId)).toBe(1);
  });

  it("writes the first article at once on a day outside the chosen weekdays", async () => {
    const { websiteId } = await free();
    // 21 November 2026 is a Saturday.
    await test.db.update(websites).set({ publishingDays: [1, 2, 3, 4, 5] }).where(eq(websites.id, websiteId));
    await plan(websiteId, "2026-11-21", 4);
    await runAt("2026-11-21T13:40:00Z", websiteId);
    expect(await written(websiteId)).toBe(1);
  });

  it("does not wait a week when the first article could not be written: tries again, bounded, then the next topic", async () => {
    const { websiteId } = await free();
    await plan(websiteId, "2026-11-21", 4);
    await runAt("2026-11-21T06:00:00Z", websiteId);
    expect(await written(websiteId)).toBe(1);
    await fail(websiteId);

    // Not at once: the next run that comes two hours later or more, the same day.
    await runAt("2026-11-21T07:00:00Z", websiteId);
    expect((await rows(websiteId))[0]!.status).toBe("failed");
    await runAt("2026-11-21T14:00:00Z", websiteId);
    expect((await rows(websiteId)).map((row) => row.status)).toEqual(["queued"]);
    await fail(websiteId);
    // The next day, its last try; nothing else is started beside it.
    await runAt("2026-11-22T06:00:00Z", websiteId);
    expect((await rows(websiteId)).map((row) => row.status)).toEqual(["queued"]);
    await fail(websiteId);
    expect(AUTO_RETRIES.spent).toBe(2);

    await runAt("2026-11-22T14:00:00Z", websiteId);
    expect((await rows(websiteId)).map((row) => row.status)).toEqual(["failed"]);
    await runAt("2026-11-23T06:00:00Z", websiteId);
    expect((await rows(websiteId)).map((row) => row.status).sort()).toEqual(["failed", "queued"]);
    await write(websiteId);
    // That one was written: from here it is one a week.
    await runAt("2026-11-24T06:00:00Z", websiteId);
    expect(await written(websiteId)).toBe(2);
  });

  it("says once that the month's articles are used, not on every run", async () => {
    const { websiteId, orgId } = await free();
    await plan(websiteId, "2026-11-01", 6);
    for (const day of ["2026-11-01", "2026-11-08", "2026-11-15", "2026-11-22"]) {
      await runAt(`${day}T06:00:00Z`, websiteId);
      await write(websiteId);
    }
    expect(await written(websiteId)).toBe(4);
    for (const at of ["2026-11-29T06:00:00Z", "2026-11-29T14:00:00Z", "2026-11-30T06:00:00Z"]) await runAt(at, websiteId);
    expect(await written(websiteId)).toBe(4);
    const told = await test.db.select().from(notifications).where(and(eq(notifications.organizationId, orgId), eq(notifications.type, "articles.limit_reached")));
    expect(told).toHaveLength(1);
    // The new month: one again.
    await runAt("2026-12-01T06:00:00Z", websiteId);
    expect(await written(websiteId)).toBe(5);
  });
});

describe("deleting an article never reopens the pace", () => {
  it.each([
    ["Free, the same week", () => free(), ["2026-11-21T14:00:00Z", "2026-11-22T06:00:00Z", "2026-11-25T14:00:00Z", "2026-11-27T22:00:00Z"], "2026-11-28T06:00:00Z"],
    ["a paid website, the same UTC day", () => paid(30), ["2026-11-21T09:00:00Z", "2026-11-21T14:00:00Z", "2026-11-21T23:59:00Z"], "2026-11-22T06:00:00Z"],
  ] as const)("%s", async (_name, make, sameWindow, next) => {
    const { websiteId } = await make();
    await plan(websiteId, "2026-11-21", 6);
    await runAt("2026-11-21T06:00:00Z", websiteId);
    await write(websiteId);
    // Written and paid for, then deleted - by the customer, or by an administrator, who drops the topic too.
    await test.client.query("update spend_reservations set state = 'consumed' where website_id = $1 and state = 'reserved'", [websiteId]);
    const [deleted] = await rows(websiteId);
    await test.client.query("delete from articles where id = $1", [deleted!.id]);
    await test.client.query("update calendar_items set status = 'skipped', scheduled_for = null where id = $1", [deleted!.calendarItemId]);

    for (const at of sameWindow) {
      await runAt(at, websiteId);
      expect(await written(websiteId), at).toBe(0);
    }
    await runAt(next, websiteId);
    expect(await written(websiteId)).toBe(1);
    // The dropped topic was neither picked nor dated again.
    const [topic] = await test.db.select().from(calendarItems).where(eq(calendarItems.id, deleted!.calendarItemId!));
    expect(topic).toMatchObject({ status: "skipped", scheduledFor: null });
    expect((await rows(websiteId))[0]!.calendarItemId).not.toBe(topic!.id);
  });

  it("not even one that failed without costing anything: deleting it starts no other the same day", async () => {
    const { websiteId } = await paid(30);
    await plan(websiteId, "2026-11-21", 6);
    await runAt("2026-11-21T06:00:00Z", websiteId);
    await fail(websiteId, false);
    await test.client.query("delete from articles where website_id = $1", [websiteId]);
    await test.client.query("update calendar_items set status = 'skipped', scheduled_for = null where website_id = $1 and title = 'Topic 1'", [websiteId]);
    for (const at of ["2026-11-21T09:00:00Z", "2026-11-21T14:00:00Z"]) await runAt(at, websiteId);
    expect(await written(websiteId)).toBe(0);
    await runAt("2026-11-22T06:00:00Z", websiteId);
    expect(await written(websiteId)).toBe(1);
  });

  it("a failed article that cost nothing is tried again a bounded number of times", async () => {
    const { websiteId } = await paid(30);
    await plan(websiteId, "2026-11-21", 1);
    let starts = 0;
    for (const day of days("2026-11-21", 6)) {
      for (const hour of ["06:00", "14:00", "20:00"]) {
        starts += (await runAt(`${day}T${hour}:00Z`, websiteId)).queued;
        await fail(websiteId, false);
      }
    }
    expect(starts).toBe(1 + AUTO_RETRIES.total);
  });

  it("the topic of a skipped status is refused where the article is reserved too, and never moved", async () => {
    const { websiteId } = await free();
    const [item] = await test.db.insert(calendarItems).values({ websiteId, title: "Dropped", status: "skipped", scheduledFor: new Date("2026-11-01T09:00:00Z") }).returning();
    expect((await queueArticleForCalendarItem(websiteId, item!.id, { automatic: true, now: new Date() })).ok).toBe(false);
    await plan(websiteId, "2026-11-21", 2);
    await runAt("2026-11-21T06:00:00Z", websiteId);
    const [after] = await test.db.select().from(calendarItems).where(eq(calendarItems.id, item!.id));
    expect(after).toMatchObject({ status: "skipped", scheduledFor: new Date("2026-11-01T09:00:00Z") });
  });
});

describe("from Free to the free trial: one a day, not one a week (client, 2026-11-26)", () => {
  it("brings Free's week-apart topics forward, and writes one a day during the trial", async () => {
    const { websiteId, orgId } = await paid(30, "2026-11-21T00:00:00Z");
    // Was on Free: its row stays, and its topics were laid out a week apart.
    const userId = `user_${randomUUID()}`;
    await test.db.insert(user).values({ id: userId, name: "Was free", email: `${userId}@example.test`, emailVerified: true, createdAt: new Date(), updatedAt: new Date() });
    await test.db.insert(freePlanAccounts).values({ organizationId: orgId, websiteId, domain: `${orgId}.example`, userId });
    await test.client.query("update subscriptions set status = 'trialing', current_period_end = $2 where website_id = $1", [websiteId, "2026-11-24T00:00:00Z"]);
    await test.db.insert(calendarItems).values(
      ["2026-11-28", "2026-12-05", "2026-12-12", "2026-12-19"].map((day, i) => ({ websiteId, title: `Topic ${i + 1}`, status: "planned", scheduledFor: new Date(`${day}T09:00:00Z`) })),
    );
    for (const day of days("2026-11-21", 3)) {
      for (const hour of ["06:00", "14:00"]) {
        await runAt(`${day}T${hour}:00Z`, websiteId);
        await write(websiteId);
      }
    }
    // Grow's 30 a month pro-rated to the 3-day trial is 3: one each day.
    expect(await startedOn(websiteId)).toEqual({ "2026-11-21": 1, "2026-11-22": 1, "2026-11-23": 1 });
  });
});

describe("paid plans: one a day, or the plan's own share above 30 a month", () => {
  it("starts one a day on a 30 plan, with many runs a day and nothing written ahead", async () => {
    const { websiteId } = await paid(30);
    await plan(websiteId, "2026-11-21", 20);
    for (const day of days("2026-11-21", 5)) {
      for (const hour of ["06:00", "06:01", "09:30", "14:00", "20:00"]) {
        await runAt(`${day}T${hour}:00Z`, websiteId);
        await write(websiteId);
      }
    }
    expect(await startedOn(websiteId)).toEqual({ "2026-11-21": 1, "2026-11-22": 1, "2026-11-23": 1, "2026-11-24": 1, "2026-11-25": 1 });
    expect((await planned(websiteId))[0]).toBe("2026-11-26");
  });

  it("does not catch a backlog up: one a day, the calendar moved to today", async () => {
    const { websiteId } = await paid(30);
    await plan(websiteId, "2026-11-01", 15);
    for (const at of ["2026-11-21T06:00:00Z", "2026-11-21T14:00:00Z", "2026-11-22T06:00:00Z", "2026-11-22T14:00:00Z"]) {
      await runAt(at, websiteId);
      await write(websiteId);
    }
    expect(await startedOn(websiteId)).toEqual({ "2026-11-21": 1, "2026-11-22": 1 });
    expect((await planned(websiteId))[0]).toBe("2026-11-23");
  });

  it("keeps Scale at two a day", async () => {
    const { websiteId } = await paid(60);
    const twice = [...days("2026-11-21", 6), ...days("2026-11-21", 6)];
    await test.db.insert(calendarItems).values(twice.map((day, i) => ({ websiteId, title: `T${i}`, status: "planned", scheduledFor: new Date(`${day}T09:00:00Z`) })));
    for (const day of days("2026-11-21", 4)) {
      for (const hour of ["06:00", "10:00", "14:00"]) {
        await runAt(`${day}T${hour}:00Z`, websiteId);
        await write(websiteId);
      }
    }
    expect(await startedOn(websiteId)).toEqual({ "2026-11-21": 2, "2026-11-22": 2, "2026-11-23": 2, "2026-11-24": 2 });
  });

  it("starts no more than the pace when runs overlap", async () => {
    const { websiteId } = await paid(30);
    await plan(websiteId, "2026-11-21", 10);
    vi.setSystemTime(new Date("2026-11-21T06:00:00Z"));
    const job = scheduledArticles as unknown as Job;
    await Promise.all(Array.from({ length: 4 }, () => job.handler({ step, logger })));
    expect(await written(websiteId)).toBe(1);

    // And at the reservation itself, for different topics at once.
    const items = await test.db.select().from(calendarItems).where(eq(calendarItems.websiteId, websiteId)).orderBy(asc(calendarItems.scheduledFor));
    vi.setSystemTime(new Date("2026-11-22T06:00:00Z"));
    await test.client.query("update articles set created_at = '2026-11-21T06:00:00Z' where website_id = $1", [websiteId]);
    const outcomes = await Promise.all(items.slice(1, 6).map((item) => queueArticleForCalendarItem(websiteId, item.id, { automatic: true, now: new Date("2026-11-22T06:00:00Z") })));
    expect(outcomes.filter((outcome) => outcome.ok)).toHaveLength(1);
  });

  it("never refuses a person's Write, and counts it", async () => {
    const { websiteId } = await paid(30);
    await plan(websiteId, "2026-11-21", 10);
    await runAt("2026-11-21T06:00:00Z", websiteId);
    await write(websiteId);
    const [item] = await test.db.select().from(calendarItems).where(and(eq(calendarItems.websiteId, websiteId), eq(calendarItems.status, "planned"))).limit(1);
    expect((await queueArticleForCalendarItem(websiteId, item!.id, { now: new Date("2026-11-21T08:00:00Z") })).ok).toBe(true);
    expect(await written(websiteId)).toBe(2);
  });

  it("does not count translations, which are made from an article already live", async () => {
    const { websiteId } = await paid(30);
    await plan(websiteId, "2026-11-21", 5);
    await runAt("2026-11-21T06:00:00Z", websiteId);
    await write(websiteId);
    const [original] = await rows(websiteId);
    await test.db.insert(articles).values({ websiteId, title: "Tradotto", status: "draft", bodyHtml: "<p>x</p>", translationOf: original!.id, createdAt: new Date("2026-11-22T05:00:00Z") });
    await runAt("2026-11-22T06:00:00Z", websiteId);
    expect(await written(websiteId)).toBe(3);
  });

  it("moves on from a topic that cannot be written, at one start a day", async () => {
    const { websiteId } = await paid(30);
    await plan(websiteId, "2026-11-21", 10);
    const statuses: string[][] = [];
    for (const day of days("2026-11-21", 4)) {
      for (const hour of ["06:00", "14:00"]) {
        await runAt(`${day}T${hour}:00Z`, websiteId);
        // The first article always fails; the others are written.
        const [first] = await rows(websiteId);
        await test.client.query("update articles set status = 'failed', updated_at = $2 where id = $1", [first!.id, `${day}T${hour}:00Z`]);
        await test.client.query("update spend_reservations set state = 'consumed' where website_id = $1 and state = 'reserved'", [websiteId]);
        await write(websiteId);
      }
      statuses.push((await rows(websiteId)).map((row) => row.status));
    }
    // Day 1: started, tried again. Day 2: the last try, nothing beside it. Then one new topic a day.
    expect(statuses).toEqual([["failed"], ["failed"], ["failed", "draft"], ["failed", "draft", "draft"]]);
  });

  it("looks at no website without a plan, however many overdue topics it has", async () => {
    const { websiteId } = await seedWebsite(test, { status: "canceled" });
    await test.db.update(websites).set({ generationMode: "automatic" }).where(eq(websites.id, websiteId));
    await plan(websiteId, "2026-11-01", 5);
    expect(await run("2026-11-21T06:00:00Z")).toMatchObject({ websites: 0, queued: 0 });
  });
});

describe("the administrator's daily limit and agency workspaces", () => {
  it("keeps imagestudio.com at one a day, and gives an agency website without a limit its month's pace", async () => {
    const other = randomUUID();
    await agency(IMAGESTUDIO);
    await agency(other);
    for (const id of [IMAGESTUDIO, other]) {
      await test.db.insert(calendarItems).values(Array.from({ length: 60 }, (_, i) => ({ websiteId: id, title: `T${i}`, status: "planned", scheduledFor: new Date(`2026-11-2${1 + (i % 3)}T09:00:00Z`) })));
    }
    for (const at of ["2026-11-22T06:00:00Z", "2026-11-22T14:00:00Z", "2026-11-22T18:00:00Z"]) {
      await run(at);
      await write(IMAGESTUDIO);
      await write(other);
    }
    expect(await startedOn(IMAGESTUDIO)).toEqual({ "2026-11-22": 1 });
    // 500 a month is 16 or 17 a day, not a batch of 34 per run.
    const count = (await startedOn(other))["2026-11-22"]!;
    expect(count).toBeGreaterThan(1);
    expect(count).toBeLessThanOrEqual(17);
  });

  it("follows the administrator's setting, and the lower of the two wins", async () => {
    await agency(IMAGESTUDIO);
    await test.db.insert(calendarItems).values(Array.from({ length: 30 }, (_, i) => ({ websiteId: IMAGESTUDIO, title: `T${i}`, status: "planned", scheduledFor: new Date("2026-11-22T09:00:00Z") })));
    await test.db.insert(creditSettings).values({ key: dailyLimitKey(IMAGESTUDIO), value: 3 });
    for (const at of ["2026-11-22T06:00:00Z", "2026-11-22T14:00:00Z", "2026-11-22T18:00:00Z"]) await runAt(at, IMAGESTUDIO);
    expect(await startedOn(IMAGESTUDIO)).toEqual({ "2026-11-22": 3 });

    // A limit above the plan's pace changes nothing: one a day is still one a day.
    const { websiteId } = await paid(30);
    await plan(websiteId, "2026-11-23", 6);
    await test.db.insert(creditSettings).values({ key: dailyLimitKey(websiteId), value: 5 });
    for (const at of ["2026-11-23T06:00:00Z", "2026-11-23T14:00:00Z"]) await runAt(at, websiteId);
    expect(await written(websiteId)).toBe(1);
  });
});
