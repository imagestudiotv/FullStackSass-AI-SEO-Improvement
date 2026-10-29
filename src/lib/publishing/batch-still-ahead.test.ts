import { beforeAll, describe, expect, it, vi } from "vitest";

import { articles, calendarItems } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { seedWebsite } from "@/test/fixtures";

/**
 * batchStillAhead (lib/publishing/policy.ts): with auto-publish on, the
 * scheduler writes the next batch only once the previous one has gone out.
 * Only articles dated inside the batch window may hold it up - imagestudio.com,
 * October 2026: one draft written by hand for the 31st stopped every run from
 * the 20th, and 26-30 October were never written.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }) }));

import { batchStillAhead } from "./policy";

const DAY = 24 * 60 * 60 * 1000;
let test: TestDb;

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

/** The scheduler's window: today plus the next two days, to the end of the day. */
function horizon(now = new Date()) {
  const end = new Date(now);
  end.setDate(end.getDate() + 2);
  end.setHours(23, 59, 59, 999);
  return end;
}

/** An article for a topic planned `days` from now (null: an undated topic). */
async function article(websiteId: string, days: number | null, status: string, publishedUrl: string | null = null) {
  const [item] = await test.db
    .insert(calendarItems)
    .values({
      websiteId,
      title: `Topic ${days}`,
      status: "generated",
      scheduledFor: days === null ? null : new Date(Date.now() + days * DAY),
    })
    .returning({ id: calendarItems.id });
  await test.db.insert(articles).values({ websiteId, calendarItemId: item.id, title: `Article ${days}`, status, publishedUrl });
}

describe("the batch still ahead", () => {
  it("is held by a draft due tomorrow, still waiting for its day", async () => {
    const { websiteId } = await seedWebsite(test);
    await article(websiteId, 1, "draft");
    expect(await batchStillAhead(websiteId, horizon())).toBe(1);
  });

  it("is not held by a draft written by hand for a day beyond the window", async () => {
    const { websiteId } = await seedWebsite(test);
    await article(websiteId, 3.5, "draft");
    await article(websiteId, 10, "draft");
    expect(await batchStillAhead(websiteId, horizon())).toBe(0);
  });

  it("is not held by drafts whose day has come, or that were already sent", async () => {
    const { websiteId } = await seedWebsite(test);
    await article(websiteId, -1, "draft");
    await article(websiteId, 1, "draft", "https://example.com/sent-as-a-wordpress-draft");
    await article(websiteId, 1, "failed");
    expect(await batchStillAhead(websiteId, horizon())).toBe(0);
  });

  it("is held by an article still being written, unless it is for a later day", async () => {
    const { websiteId } = await seedWebsite(test);
    await article(websiteId, -1, "queued");
    await article(websiteId, null, "generating");
    await article(websiteId, 10, "generating");
    expect(await batchStillAhead(websiteId, horizon())).toBe(2);
  });

  it("counts only its own website", async () => {
    const { websiteId } = await seedWebsite(test);
    const other = await seedWebsite(test);
    await article(other.websiteId, 1, "draft");
    expect(await batchStillAhead(websiteId, horizon())).toBe(0);
  });
});
