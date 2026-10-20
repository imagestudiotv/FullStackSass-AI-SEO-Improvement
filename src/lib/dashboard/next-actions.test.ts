import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb, type TestDb } from "@/test/db";
import { articles, audits, gscPageMetrics, issues, integrations, integrationKeys, organization, websites, searchImportCoverage, nextActionPreferences, publishLogs } from "@/lib/db/schema";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }) }));
import { getNextActions } from "./next-actions";
let test: TestDb;
beforeAll(async () => { test = await createTestDb(); state.db = test.db; });
afterAll(async () => { await test.client.close(); });
async function fixture() {
  const orgId = randomUUID();
  await test.db.insert(organization).values({ id: orgId, name: "QA", slug: orgId, createdAt: new Date() });
  const [site] = await test.db.insert(websites).values({ organizationId: orgId, url: "https://example.test", domain: "example.test", generationMode: "manual" }).returning();
  return { orgId, id: site.id };
}
describe("dashboard next steps", () => {
  it("prioritizes connection and failed content, scopes data to one workspace", async () => {
    const a = await fixture(), b = await fixture();
    const [failed] = await test.db.insert(articles).values({ websiteId: a.id, title: "Failed QA article", status: "failed" }).returning();
    await test.db.insert(articles).values({ websiteId: b.id, title: "Another customer's failure", status: "failed" });
    const actions = await getNextActions(a.id, a.orgId, true);
    expect(actions.map(x => x.kind)).toEqual(["publishing", "failed", "google"]);
    expect(actions[1].href).toBe(`/websites/${a.id}/articles/${failed.id}`);
    expect(await getNextActions(a.id, b.orgId, true)).toEqual([]);
    expect((await getNextActions(a.id, a.orgId, false)).map(x => x.kind)).toEqual(["failed"]);
  });
  it("recognizes the plugin and a selected Search Console property", async () => {
    const a = await fixture();
    await test.db.insert(integrationKeys).values({ websiteId: a.id, keyHash: randomUUID(), keyPrefix: "qa", lastUsedAt: new Date() });
    await test.db.insert(integrations).values({ websiteId: a.id, kind: "google_analytics", status: "connected", meta: { searchConsoleSite: "sc-domain:example.test" } });
    expect((await getNextActions(a.id, a.orgId, true)).map(x => x.kind)).toEqual(["searchData"]);
    await test.db.update(integrationKeys).set({ revokedAt: new Date() }).where(eq(integrationKeys.websiteId, a.id));
    expect((await getNextActions(a.id, a.orgId, true)).map(x => x.kind)).toEqual(["publishing", "searchData"]);
  });
  it("does not mistake Google for publishing, and uses only the latest audit", async () => {
    const a = await fixture();
    await test.db.insert(integrations).values({ websiteId: a.id, kind: "google_analytics", status: "connected" });
    const [old] = await test.db.insert(audits).values({ websiteId: a.id, createdAt: new Date("2020-01-01") }).returning();
    await test.db.insert(issues).values({ websiteId: a.id, auditId: old.id, type: "broken_link", severity: "error" });
    const [latest] = await test.db.insert(audits).values({ websiteId: a.id }).returning();
    expect((await getNextActions(a.id, a.orgId, true)).map(x => x.kind)).toEqual(["publishing", "google"]);
    await test.db.insert(issues).values({ websiteId: a.id, auditId: latest.id, type: "broken_link", severity: "error" });
    expect((await getNextActions(a.id, a.orgId, true)).map(x => x.kind)).toContain("audit");
  });
  it("does not ask customers to publish drafts held for team review or automatic publishing", async () => {
    const a = await fixture();
    await test.db.insert(articles).values({ websiteId: a.id, title: "Held", status: "draft", reviewStatus: "pending" });
    expect((await getNextActions(a.id, a.orgId, true)).map(x => x.kind)).not.toContain("draft");
    await test.db.insert(articles).values({ websiteId: a.id, title: "Ready", status: "draft" });
    expect((await getNextActions(a.id, a.orgId, true)).map(x => x.kind)).toContain("draft");
    await test.db.update(websites).set({ autoPublish: true }).where(eq(websites.id, a.id));
    expect((await getNextActions(a.id, a.orgId, true)).map(x => x.kind)).not.toContain("draft");
  });
  it("turns an imported search decline into a task for the affected site's page", async () => {
    const a = await fixture(), b = await fixture();
    const pageUrl = "https://example.test/guide";
    const [article] = await test.db.insert(articles).values({ websiteId: a.id, title: "Declining guide", publishedUrl: pageUrl, status: "published" }).returning();
    await test.db.insert(gscPageMetrics).values([
      { websiteId: a.id, pageUrl, date: "2026-09-01", clicks: 100, impressions: 1000, position: 4 },
      { websiteId: a.id, pageUrl, date: "2026-10-01", clicks: 20, impressions: 200, position: 9 },
    ]);
    await test.db.insert(searchImportCoverage).values({ websiteId: a.id, startDate: "2026-08-01", endDate: "2026-10-01" });
    expect((await getNextActions(a.id, a.orgId, true, { now: new Date("2026-10-04") })).find(x => x.kind === "traffic"))
      .toMatchObject({ kind: "traffic", href: `/websites/${a.id}/articles/${article.id}`, detail: "Declining guide", evidence: { before: 100, after: 20, end: "2026-10-01" } });
    expect((await getNextActions(b.id, b.orgId, true)).map(x => x.kind)).not.toContain("traffic");
  });
  it("does not interpret an incomplete or stale import as traffic loss", async () => {
    const a = await fixture();
    await test.db.insert(gscPageMetrics).values([
      { websiteId: a.id, pageUrl: "https://example.test/a", date: "2026-09-01", clicks: 100, impressions: 1000 },
      { websiteId: a.id, pageUrl: "https://example.test/a", date: "2026-10-01", clicks: 1, impressions: 10 },
    ]);
    expect((await getNextActions(a.id, a.orgId, true, { now: new Date("2026-10-04") })).some(a => a.kind === "traffic")).toBe(false);
    await test.db.insert(searchImportCoverage).values({ websiteId: a.id, startDate: "2026-08-01", endDate: "2026-10-01" });
    expect((await getNextActions(a.id, a.orgId, true, { now: new Date("2026-10-20") })).some(a => a.kind === "traffic")).toBe(false);
  });
  it("snoozes only the affected site's task until its reminder expires", async () => {
    const a = await fixture(), b = await fixture();
    const task = (await getNextActions(a.id, a.orgId, true))[0];
    await test.db.insert(nextActionPreferences).values({ websiteId: a.id, taskKey: task.id, actorId: "test", snoozedUntil: new Date("2099-01-01") });
    expect((await getNextActions(a.id, a.orgId, true)).some(t => t.id === task.id)).toBe(false);
    expect((await getNextActions(b.id, b.orgId, true))[0].kind).toBe("publishing");
    expect((await getNextActions(a.id, a.orgId, true, { now: new Date("2100-01-01") }))[0].id).toBe(task.id);
  });
  it("clears publishing failure recommendations after a successful delivery", async () => {
    const a = await fixture();
    const [article] = await test.db.insert(articles).values({ websiteId: a.id, title: "Delivery" }).returning();
    await test.db.insert(publishLogs).values({ articleId: article.id, status: "failed", createdAt: new Date("2026-10-01") });
    expect((await getNextActions(a.id, a.orgId, true)).map(t => t.kind)).toContain("publishFailed");
    await test.db.insert(publishLogs).values({ articleId: article.id, status: "published", createdAt: new Date("2026-10-02") });
    expect((await getNextActions(a.id, a.orgId, true)).map(t => t.kind)).not.toContain("publishFailed");
  });
  it("offers a search appearance review without interpreting absent pages as zero traffic", async () => {
    const a = await fixture();
    await test.db.insert(searchImportCoverage).values({ websiteId: a.id, startDate: "2026-08-01", endDate: "2026-10-01" });
    await test.db.insert(gscPageMetrics).values([
      { websiteId: a.id, pageUrl: "https://example.test/not-returned", date: "2026-09-01", clicks: 100, impressions: 1000, position: 4 },
      { websiteId: a.id, pageUrl: "https://example.test/opportunity", date: "2026-10-01", clicks: 5, impressions: 2000, position: 4 },
    ]);
    const actions = await getNextActions(a.id, a.orgId, true, { now: new Date("2026-10-04") });
    expect(actions.some(a => a.kind === "traffic")).toBe(false);
    expect(actions.find(a => a.kind === "snippet")).toMatchObject({
      priority: "opportunity", detail: "https://example.test/opportunity", evidence: { clicks: 5, impressions: 2000 },
    });
  });
});
