import { asc, eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { adminAuditLog, blogAutopilotTopics, blogCategories, blogPosts } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";

/**
 * Admin -> Blog -> Autopilot (client, 2026-10-16): the settings, and the
 * topic list's rules - order, no duplicates, nothing changed under a run,
 * failed topics back at the front.
 */

const state = vi.hoisted(() => ({ db: null as unknown, session: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
  isDatabaseConfigured: () => true,
}));
vi.mock("@/lib/auth-guard", () => ({ getSession: async () => state.session }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  addBlogAutopilotTopics,
  deleteBlogAutopilotTopic,
  getBlogAutopilotAdmin,
  moveBlogAutopilotTopic,
  retryBlogAutopilotTopic,
  saveBlogAutopilotSettings,
  saveBlogAutopilotTopic,
} from "@/lib/admin/blog-autopilot";
import { parseTopicLines } from "@/app/admin/blog/autopilot/autopilot-topics";
import { DEFAULT_AUTOPILOT, readAutopilotSettings, romeHourLabel } from "@/lib/blog/autopilot/settings";

let test: TestDb;
const ADMIN = "admin@repget.test";

beforeAll(async () => {
  vi.stubEnv("ADMIN_EMAILS", ADMIN);
  test = await createTestDb();
  state.db = test.db;
});

beforeEach(async () => {
  state.session = { user: { id: "admin_user", email: ADMIN, emailVerified: true }, session: { id: "s", activeOrganizationId: null } };
  await test.db.delete(blogAutopilotTopics);
});

const queue = async () =>
  (await test.db.select().from(blogAutopilotTopics).orderBy(asc(blogAutopilotTopics.sortOrder))).filter((row) => row.status === "queued").map((row) => row.topic);
const topicId = async (topic: string) => (await test.db.select().from(blogAutopilotTopics).where(eq(blogAutopilotTopics.topic, topic)))[0].id;
const add = (...topics: string[]) => addBlogAutopilotTopics({ topics: topics.map((topic) => ({ topic })) });

describe("settings", () => {
  it("start off, at 06:00 UTC, in every language - until saved", async () => {
    expect(await readAutopilotSettings()).toEqual(DEFAULT_AUTOPILOT);
    expect(DEFAULT_AUTOPILOT).toMatchObject({ enabled: false, runHour: 6, languages: ["es", "fr", "it", "de"] });
  });

  it("are saved, cleaned, and the change is in the admin log", async () => {
    const saved = await saveBlogAutopilotSettings({ enabled: true, runHour: 7, languages: ["it", "xx", "de", "it", "en"] });
    expect(saved).toMatchObject({ ok: true, data: { enabled: true, runHour: 7, languages: ["it", "de"], updatedBy: ADMIN } });
    expect(await readAutopilotSettings()).toMatchObject({ enabled: true, runHour: 7, languages: ["it", "de"] });
    const [log] = await test.db.select().from(adminAuditLog).where(eq(adminAuditLog.action, "blog.autopilot_settings_saved"));
    expect(log).toMatchObject({ actorEmail: ADMIN, summary: "Turned the blog autopilot on" });
    expect(await saveBlogAutopilotSettings({ enabled: true, runHour: 24, languages: [] })).toEqual({ ok: false, error: "Choose the hour to write at" });
    expect(await saveBlogAutopilotSettings({ enabled: true, runHour: 6.5, languages: [] })).toEqual({ ok: false, error: "Choose the hour to write at" });
  });

  it("are for administrators only", async () => {
    state.session = { user: { id: "u", email: "customer@example.test", emailVerified: true }, session: { id: "s", activeOrganizationId: null } };
    await expect(saveBlogAutopilotSettings({ enabled: true, runHour: 6, languages: [] })).rejects.toThrow();
    await expect(add("Anything")).rejects.toThrow();
    await expect(getBlogAutopilotAdmin()).rejects.toThrow();
  });

  it("show the hour in Rome too, summer and winter", () => {
    expect(romeHourLabel(6, new Date("2026-07-01T00:00:00Z"))).toBe("08:00 in Rome");
    expect(romeHourLabel(6, new Date("2026-12-01T00:00:00Z"))).toBe("07:00 in Rome");
  });
});

describe("the topic list", () => {
  it("adds to the end, one or many, and never the same topic twice", async () => {
    expect(await add("Local SEO for restaurants")).toEqual({ ok: true, data: { added: 1, skipped: [] } });
    expect(await addBlogAutopilotTopics({ topics: [{ topic: "Service page SEO", keyword: "service page seo" }, { topic: "local seo  FOR restaurants" }, { topic: "Schema for small sites" }] })).toEqual({
      ok: true,
      data: { added: 2, skipped: ["local seo FOR restaurants"] },
    });
    expect(await queue()).toEqual(["Local SEO for restaurants", "Service page SEO", "Schema for small sites"]);
    const [service] = await test.db.select().from(blogAutopilotTopics).where(eq(blogAutopilotTopics.topic, "Service page SEO"));
    expect(service).toMatchObject({ keyword: "service page seo", source: "admin", status: "queued", createdBy: ADMIN });
  });

  it("refuses an already written topic, and says which line is wrong in a list", async () => {
    await add("Written before");
    await test.db.update(blogAutopilotTopics).set({ status: "written" }).where(eq(blogAutopilotTopics.topic, "Written before"));
    expect(await add("written before")).toEqual({ ok: true, data: { added: 0, skipped: ["written before"] } });
    expect(await add("ok topic", "x")).toEqual({ ok: false, error: "Line 2: Write what the article should be about" });
    expect(await add("a".repeat(201))).toEqual({ ok: false, error: "Keep the topic under 200 characters - add the details as notes" });
    expect(await addBlogAutopilotTopics({ topics: [] })).toEqual({ ok: false, error: "Write what the article should be about" });
  });

  it("moves a waiting topic up and down", async () => {
    await add("One", "Two", "Three");
    expect(await moveBlogAutopilotTopic(await topicId("Three"), "up")).toEqual({ ok: true, data: null });
    expect(await queue()).toEqual(["One", "Three", "Two"]);
    await moveBlogAutopilotTopic(await topicId("One"), "down");
    expect(await queue()).toEqual(["Three", "One", "Two"]);
    // The first cannot go higher.
    await moveBlogAutopilotTopic(await topicId("Three"), "up");
    expect(await queue()).toEqual(["Three", "One", "Two"]);
  });

  it("edits a waiting topic, but never one being written or already written", async () => {
    await add("Draft topic", "Other topic", "Busy topic");
    const id = await topicId("Draft topic");
    expect(await saveBlogAutopilotTopic({ id, topic: "Better topic", keyword: "better", notes: "Mention prices" })).toEqual({ ok: true, data: null });
    expect((await test.db.select().from(blogAutopilotTopics).where(eq(blogAutopilotTopics.id, id)))[0]).toMatchObject({
      topic: "Better topic",
      keyword: "better",
      notes: "Mention prices",
    });
    expect(await saveBlogAutopilotTopic({ id, topic: "other TOPIC" })).toEqual({ ok: false, error: "Another topic already says that" });
    const busy = await topicId("Busy topic");
    await test.db.update(blogAutopilotTopics).set({ status: "writing" }).where(eq(blogAutopilotTopics.id, busy));
    expect(await saveBlogAutopilotTopic({ id: busy, topic: "Changed" })).toMatchObject({ ok: false, error: expect.stringContaining("being written") });
    expect(await deleteBlogAutopilotTopic(busy)).toMatchObject({ ok: false, error: expect.stringContaining("being written") });
  });

  it("removes a written topic without touching its post", async () => {
    const [category] = await test.db.insert(blogCategories).values({ name: `Guides ${Date.now()}`, slug: `guides-${Date.now()}` }).returning();
    const [post] = await test.db.insert(blogPosts).values({ slug: `p-${Date.now()}`, title: "A post", category: category.name, author: "RepGet team" }).returning();
    await add("Has a post");
    const id = await topicId("Has a post");
    await test.db.update(blogAutopilotTopics).set({ status: "written", postId: post.id, writtenAt: new Date() }).where(eq(blogAutopilotTopics.id, id));
    const page = await getBlogAutopilotAdmin();
    expect(page.written).toEqual([expect.objectContaining({ topic: "Has a post", post: { id: post.id, title: "A post", status: "draft" } })]);
    expect(await deleteBlogAutopilotTopic(id)).toEqual({ ok: true, data: null });
    expect((await test.db.select().from(blogPosts).where(eq(blogPosts.id, post.id))).length).toBe(1);
  });

  it("puts a failed topic back at the front", async () => {
    await add("First", "Second", "Broken");
    const broken = await topicId("Broken");
    await test.db.update(blogAutopilotTopics).set({ status: "failed", error: "The AI did not answer" }).where(eq(blogAutopilotTopics.id, broken));
    expect((await getBlogAutopilotAdmin()).failed).toEqual([expect.objectContaining({ topic: "Broken", error: "The AI did not answer" })]);
    expect(await retryBlogAutopilotTopic(broken)).toEqual({ ok: true, data: null });
    expect(await queue()).toEqual(["Broken", "First", "Second"]);
    expect(await retryBlogAutopilotTopic(broken)).toMatchObject({ ok: false });
  });
});

describe("a pasted list", () => {
  it("reads one topic per line, with an optional search phrase after a bar", () => {
    expect(parseTopicLines("Local SEO for restaurants | local seo restaurants\n\n  Service pages  \r\nA | b | c")).toEqual([
      { topic: "Local SEO for restaurants", keyword: "local seo restaurants" },
      { topic: "Service pages", keyword: "" },
      { topic: "A", keyword: "b | c" },
    ]);
  });
});
