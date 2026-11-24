import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { articles, calendarItems } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { seedWebsite } from "@/test/fixtures";

/**
 * moveMissedTopicsForward (lib/publishing/missed-days.ts): after a pause the
 * calendar restarts from today instead of writing every missed day at once
 * (imagestudio.com, 2026-11-20: six paused days caught up in batches).
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }) }));

import { moveMissedTopicsForward, spaceTopics } from "./missed-days";

const NOW = new Date("2026-11-20T06:00:00Z");
let test: TestDb;

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

/** A topic for a UTC day (null: undated), optionally with an article already started. */
async function topic(websiteId: string, day: string | null, options: { status?: string; article?: string } = {}) {
  const [item] = await test.db
    .insert(calendarItems)
    .values({
      websiteId,
      title: `Topic ${day}`,
      status: options.status ?? "planned",
      scheduledFor: day === null ? null : new Date(`${day}T09:00:00Z`),
    })
    .returning({ id: calendarItems.id });
  if (options.article) {
    await test.db.insert(articles).values({ websiteId, calendarItemId: item.id, title: `Article ${day}`, status: options.article });
  }
  return item.id;
}

async function dayOf(id: string) {
  const [row] = await test.db.select({ at: calendarItems.scheduledFor }).from(calendarItems).where(eq(calendarItems.id, id));
  return row.at ? row.at.toISOString() : null;
}

describe("missed days after a pause", () => {
  it("moves every unstarted topic by the gap, so the earliest missed one is today and the pace is kept", async () => {
    const { websiteId } = await seedWebsite(test);
    const missed = [await topic(websiteId, "2026-11-14"), await topic(websiteId, "2026-11-14"), await topic(websiteId, "2026-11-17")];
    const later = await topic(websiteId, "2026-11-25");

    expect(await moveMissedTopicsForward(websiteId, NOW)).toEqual({ days: 6, moved: 4 });
    expect(await Promise.all(missed.map(dayOf))).toEqual([
      "2026-11-20T09:00:00.000Z",
      "2026-11-20T09:00:00.000Z",
      "2026-11-23T09:00:00.000Z",
    ]);
    expect(await dayOf(later)).toBe("2026-12-01T09:00:00.000Z");
  });

  it("leaves topics with an article, written topics and undated topics where they are", async () => {
    const { websiteId } = await seedWebsite(test);
    const queued = await topic(websiteId, "2026-11-15", { article: "queued" });
    const failed = await topic(websiteId, "2026-11-15", { article: "failed" });
    const written = await topic(websiteId, "2026-11-16", { status: "generated" });
    const undated = await topic(websiteId, null);
    const missed = await topic(websiteId, "2026-11-18");

    expect(await moveMissedTopicsForward(websiteId, NOW)).toEqual({ days: 2, moved: 1 });
    expect(await dayOf(queued)).toBe("2026-11-15T09:00:00.000Z");
    expect(await dayOf(failed)).toBe("2026-11-15T09:00:00.000Z");
    expect(await dayOf(written)).toBe("2026-11-16T09:00:00.000Z");
    expect(await dayOf(undated)).toBeNull();
    expect(await dayOf(missed)).toBe("2026-11-20T09:00:00.000Z");
  });

  it("does nothing on a calendar that is on time (today's topic is not missed)", async () => {
    const { websiteId } = await seedWebsite(test);
    const today = await topic(websiteId, "2026-11-20");
    const tomorrow = await topic(websiteId, "2026-11-21");

    expect(await moveMissedTopicsForward(websiteId, NOW)).toEqual({ days: 0, moved: 0 });
    expect(await dayOf(today)).toBe("2026-11-20T09:00:00.000Z");
    expect(await dayOf(tomorrow)).toBe("2026-11-21T09:00:00.000Z");
  });

  it("touches only its own website", async () => {
    const mine = await seedWebsite(test);
    const other = await seedWebsite(test);
    await topic(mine.websiteId, "2026-11-10");
    const theirs = await topic(other.websiteId, "2026-11-10");

    expect((await moveMissedTopicsForward(mine.websiteId, NOW)).moved).toBe(1);
    expect(await dayOf(theirs)).toBe("2026-11-10T09:00:00.000Z");
  });
});

describe("Free's topics, a week apart (client, 2026-11-24)", () => {
  const utc = (day: string) => new Date(`${day}T00:00:00Z`);

  it("spaces a topic-a-day calendar from the next day the pace allows, and is the same when run again", async () => {
    const { websiteId } = await seedWebsite(test);
    const started = await topic(websiteId, "2026-11-20", { article: "draft" });
    const rest = [await topic(websiteId, "2026-11-21"), await topic(websiteId, "2026-11-22"), await topic(websiteId, "2026-11-23")];
    const undated = await topic(websiteId, null);

    expect(await spaceTopics(websiteId, 7, utc("2026-11-27"), NOW)).toEqual({ moved: 3 });
    expect(await Promise.all(rest.map(dayOf))).toEqual(["2026-11-27T09:00:00.000Z", "2026-12-04T09:00:00.000Z", "2026-12-11T09:00:00.000Z"]);
    expect(await dayOf(started)).toBe("2026-11-20T09:00:00.000Z");
    expect(await dayOf(undated)).toBeNull();
    expect(await spaceTopics(websiteId, 7, utc("2026-11-27"), NOW)).toEqual({ moved: 0 });
  });

  it("moves overdue topics to today, and leaves one that is far enough where it is", async () => {
    const { websiteId } = await seedWebsite(test);
    const overdue = await topic(websiteId, "2026-11-02");
    const far = await topic(websiteId, "2026-12-20");
    expect(await spaceTopics(websiteId, 7, utc("2026-11-10"), NOW)).toEqual({ moved: 1 });
    expect(await dayOf(overdue)).toBe("2026-11-20T09:00:00.000Z");
    expect(await dayOf(far)).toBe("2026-12-20T09:00:00.000Z");
  });

  it("brings the first topic forward only for a website still without an article", async () => {
    const { websiteId } = await seedWebsite(test);
    const first = await topic(websiteId, "2026-11-28");
    expect(await spaceTopics(websiteId, 7, utc("2026-11-20"), NOW)).toEqual({ moved: 0 });
    expect(await spaceTopics(websiteId, 7, utc("2026-11-20"), NOW, { startNow: true })).toEqual({ moved: 1 });
    expect(await dayOf(first)).toBe("2026-11-20T09:00:00.000Z");
  });
});
