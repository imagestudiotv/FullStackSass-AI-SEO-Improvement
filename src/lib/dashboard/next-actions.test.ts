import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb, type TestDb } from "@/test/db";
import { articles, audits, gscPageMetrics, issues, integrations, integrationKeys, organization, websites } from "@/lib/db/schema";

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
    expect(await getNextActions(a.id, a.orgId, true)).toEqual([]);
    await test.db.update(integrationKeys).set({ revokedAt: new Date() }).where(eq(integrationKeys.websiteId, a.id));
    expect((await getNextActions(a.id, a.orgId, true)).map(x => x.kind)).toEqual(["publishing"]);
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
    await test.db.insert(articles).values({ websiteId: a.id, title: "Declining guide", publishedUrl: pageUrl, status: "published" });
    await test.db.insert(gscPageMetrics).values([
      { websiteId: a.id, pageUrl, date: "2026-09-01", clicks: 100, impressions: 1000, position: 4 },
      { websiteId: a.id, pageUrl, date: "2026-10-01", clicks: 20, impressions: 200, position: 9 },
    ]);
    expect((await getNextActions(a.id, a.orgId, true)).find(x => x.kind === "traffic"))
      .toEqual({ kind: "traffic", href: `/websites/${a.id}/traffic`, detail: "Declining guide" });
    expect((await getNextActions(b.id, b.orgId, true)).map(x => x.kind)).not.toContain("traffic");
  });
});
