import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "@/test/db";
import { articles, audits, organization, socialAccounts, socialSuggestions, videoIdeas, websites } from "@/lib/db/schema";

const state = vi.hoisted(() => ({ db: null as unknown, plan: "paid" as "paid" | "trial" | "none" }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }) }));
/* A paid plan passes both checks; a trial only the free-articles one. */
vi.mock("@/lib/billing/entitled", () => ({
  isEntitledToSpend: async (_id: string, options?: { freeArticles?: boolean }) => ({
    ok: state.plan === "paid" || (state.plan === "trial" && Boolean(options?.freeArticles)),
  }),
}));
import { getTasks } from "./tasks";

let test: TestDb;
beforeAll(async () => { test = await createTestDb(); state.db = test.db; });
afterAll(async () => { await test.client.close(); });
beforeEach(() => { state.plan = "paid"; });

const NOW = new Date("2026-11-03T09:00:00Z");

async function fixture(autoPublish = false) {
  const orgId = randomUUID();
  await test.db.insert(organization).values({ id: orgId, name: "QA", slug: orgId, createdAt: new Date() });
  const [site] = await test.db.insert(websites).values({ organizationId: orgId, url: "https://example.test", domain: "example.test", autoPublish }).returning();
  return { orgId, id: site.id };
}

const idea = (websiteId: string, day: string, status = "new") => ({
  websiteId, day, status, style: "tips", language: "en", title: "Idea", script: {}, caption: "Caption",
});

describe("tasks page", () => {
  it("counts today's waiting work for one website only", async () => {
    const a = await fixture(), b = await fixture();
    await test.db.insert(articles).values([
      { websiteId: a.id, title: "Failed 1", status: "failed" },
      { websiteId: a.id, title: "Failed 2", status: "failed" },
      { websiteId: a.id, title: "Draft", status: "draft" },
      { websiteId: b.id, title: "Someone else's", status: "failed" },
    ]);
    await test.db.insert(socialSuggestions).values([
      { websiteId: a.id, platform: "reddit", kind: "reply", day: "2026-11-02", body: "Fresh", createdAt: new Date("2026-11-02T10:00:00Z") },
      { websiteId: a.id, platform: "reddit", kind: "reply", day: "2026-10-01", body: "Stale", createdAt: new Date("2026-10-01T10:00:00Z") },
      { websiteId: a.id, platform: "reddit", kind: "reply", day: "2026-11-02", body: "Done", status: "posted", createdAt: new Date("2026-11-02T10:00:00Z") },
      // Edited and saved, not posted yet: still the customer's to do.
      { websiteId: a.id, platform: "reddit", kind: "reply", day: "2026-11-02", body: "Saved", status: "draft", createdAt: new Date("2026-11-02T10:00:00Z") },
    ]);
    await test.db.insert(videoIdeas).values([idea(a.id, "2026-11-03"), idea(a.id, "2026-11-02"), idea(a.id, "2026-11-03", "approved")]);

    const tasks = await getTasks(a.id, a.orgId, true, NOW);
    expect(Object.fromEntries(tasks!.work.map((w) => [w.id, w.count]))).toEqual({ failed: 2, drafts: 1, social: 2, videos: 1 });
    expect(tasks!.work.find((w) => w.id === "failed")!.href).toBe(`/websites/${a.id}/content`);
    // Another workspace's id never opens this website's tasks.
    expect(await getTasks(a.id, b.orgId, true, NOW)).toBeNull();
  });

  it("leaves drafts out when the website publishes them by itself", async () => {
    const a = await fixture(true);
    await test.db.insert(articles).values({ websiteId: a.id, title: "Draft", status: "draft" });
    const tasks = await getTasks(a.id, a.orgId, true, NOW);
    expect(tasks!.work.find((w) => w.id === "drafts")!.count).toBe(0);
  });

  it("lists set-up and accounts for the owner, ticked from real state", async () => {
    const a = await fixture();
    await test.db.insert(audits).values({ websiteId: a.id });
    await test.db.insert(socialAccounts).values([
      { websiteId: a.id, platform: "quora", username: "qa", warmupEndsAt: NOW },
      { websiteId: a.id, platform: "instagram", username: "qa", warmupEndsAt: NOW },
      { websiteId: a.id, platform: "tiktok", username: "qa", bundleAccountId: "b-1", warmupEndsAt: NOW },
    ]);
    const tasks = (await getTasks(a.id, a.orgId, true, NOW))!;
    expect(tasks.setup.map((s) => s.id)).not.toContain("launched");
    expect(tasks.setup.find((s) => s.id === "audit")!.done).toBe(true);
    expect(tasks.setup.find((s) => s.id === "site")!.done).toBe(false);
    // Quora is a username; a video channel needs a real connection, so the bare Instagram name does not count.
    expect(tasks.accounts).toEqual([
      { id: "social", connected: 1, available: 6, href: `/websites/${a.id}/social` },
      { id: "video", connected: 1, available: 6, href: `/websites/${a.id}/videos` },
    ]);
    expect(tasks.total).toBe(tasks.setup.length + 2);
    expect(tasks.done).toBe(tasks.setup.filter((s) => s.done).length + 2);
  });

  it("offers a trial only the channels it may use, and nothing without a plan", async () => {
    const a = await fixture();
    state.plan = "trial";
    expect((await getTasks(a.id, a.orgId, true, NOW))!.accounts.map((x) => [x.id, x.available])).toEqual([["social", 1], ["video", 6]]);
    state.plan = "none";
    expect((await getTasks(a.id, a.orgId, true, NOW))!.accounts).toEqual([]);
  });

  it("gives a guest today's work but not the owner's set-up or accounts", async () => {
    const a = await fixture();
    const tasks = (await getTasks(a.id, a.orgId, false, NOW))!;
    expect(tasks.work).toHaveLength(4);
    expect(tasks.setup).toEqual([]);
    expect(tasks.accounts).toEqual([]);
    expect(tasks.total).toBe(0);
  });
});
