import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { articles, gaMetrics, gscPageMetrics, publishLogs, websites } from "@/lib/db/schema";
import { organization } from "@/lib/db/auth-tables";
import { createTestDb, type TestDb } from "@/test/db";

/**
 * Regression tests for reporting identity and totals: page identity is
 * conservative (query strings and path case are meaningful), totals cover
 * every page (not a truncated list), and only confirmed live deliveries count
 * as publications.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }) }));

import { getDashboardOverview } from "@/lib/dashboard/overview";
import { pageKey } from "@/lib/reporting/page-key";

let test: TestDb;
beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

const DAY = 86_400_000;
const day = (n: number) => new Date(Date.now() - n * DAY).toISOString().slice(0, 10);

async function site() {
  const orgId = `org_${randomUUID().slice(0, 8)}`;
  await test.db.insert(organization).values({ id: orgId, name: "W", slug: orgId, createdAt: new Date() });
  const domain = `id-${randomUUID().slice(0, 6)}.test`;
  const [w] = await test.db.insert(websites).values({ organizationId: orgId, url: `https://${domain}`, domain, status: "ready" }).returning();
  return { orgId, site: w };
}
async function article(websiteId: string, url: string, live: { at?: Date; remoteStatus?: string | null } = {}) {
  const [a] = await test.db.insert(articles).values({ websiteId, title: `A ${url}`, status: "published", bodyHtml: "<p>x</p>", publishedUrl: url }).returning();
  await test.db.insert(publishLogs).values({ articleId: a.id, status: "published", remoteId: "1", remoteUrl: url, remoteStatus: live.remoteStatus === undefined ? "publish" : live.remoteStatus, createdAt: live.at ?? new Date(Date.now() - 10 * DAY) });
  await test.db.update(articles).set({ firstLiveAt: live.remoteStatus === "draft" ? null : live.at ?? new Date(Date.now() - 10 * DAY) }).where(eq(articles.id, a.id));
  return a;
}
const overview = async (orgId: string, websiteId: string) => {
  const o = await getDashboardOverview({ websiteId, ownerOrgId: orgId, showCredits: true, range: "30d" });
  if (!o?.achievements.ok) throw new Error("achievements failed");
  return o.achievements.data;
};

describe("page identity", () => {
  it("keeps query strings, path case and language variants distinct; strips only tracking parameters", () => {
    expect(pageKey("https://example.com/?p=101")).not.toBe(pageKey("https://example.com/?p=202"));
    expect(pageKey("https://example.com/Blog/A")).not.toBe(pageKey("https://example.com/blog/a"));
    expect(pageKey("https://example.com/post/?lang=fr")).not.toBe(pageKey("https://example.com/post/?lang=en"));
    expect(pageKey("https://EXAMPLE.com/post/?utm_source=x&b=2&a=1")).toBe(pageKey("http://www.example.com/post?a=1&b=2#top"));
    expect(pageKey("/blog/x/", "example.com")).toBe(pageKey("https://example.com/blog/x"));
  });

  it("does not merge WordPress query-string permalinks, and the database agrees with the code", async () => {
    const { orgId, site: w } = await site();
    await article(w.id, `https://${w.domain}/?p=101`);
    await article(w.id, `https://${w.domain}/?p=202`);
    await test.db.insert(gscPageMetrics).values([
      { websiteId: w.id, date: day(3), pageUrl: `https://${w.domain}/?p=101`, clicks: 7, impressions: 70 },
      { websiteId: w.id, date: day(3), pageUrl: `https://${w.domain}/?p=202`, clicks: 3, impressions: 30 },
    ]);
    const a = await overview(orgId, w.id);
    expect(a.clicks).toBe(10);
    expect(a.breakdown.map((r) => r.clicks).sort()).toEqual([3, 7]);
    const sqlKey = await test.db.execute(`select repget_page_key('https://EXAMPLE.com/post/?utm_source=x&b=2&a=1', null) as k`);
    const k = ((sqlKey as unknown as { rows: Array<{ k: string }> }).rows ?? (sqlKey as unknown as Array<{ k: string }>))[0].k;
    expect(k).toBe(pageKey("https://EXAMPLE.com/post/?utm_source=x&b=2&a=1"));
  });

  it("counts a page once even when two article rows point at it", async () => {
    const { orgId, site: w } = await site();
    await article(w.id, `https://${w.domain}/guide/`);
    await article(w.id, `https://${w.domain}/guide`);
    await test.db.insert(gscPageMetrics).values({ websiteId: w.id, date: day(3), pageUrl: `https://${w.domain}/guide/`, clicks: 5, impressions: 50 });
    const a = await overview(orgId, w.id);
    expect(a.clicks).toBe(5);
    expect(a.breakdown.reduce((s, r) => s + r.clicks, 0)).toBe(5);
  });

  it("matches Google Analytics page paths (which carry no host) to article URLs", async () => {
    const { orgId, site: w } = await site();
    await article(w.id, `https://${w.domain}/blog/post-1/`);
    await test.db.insert(gaMetrics).values({ websiteId: w.id, date: day(3), pageUrl: "/blog/post-1/", sessions: 9, users: 8 });
    const a = await overview(orgId, w.id);
    expect(a.sessions).toBe(9);
  });
});

describe("complete totals", () => {
  it("totals cover more than the 200 articles the breakdown shows, and agree with the chart", async () => {
    const { orgId, site: w } = await site();
    for (let i = 0; i < 205; i++) {
      await article(w.id, `https://${w.domain}/post-${i}/`);
    }
    await test.db.insert(gscPageMetrics).values(
      Array.from({ length: 205 }, (_, i) => ({ websiteId: w.id, date: day(4), pageUrl: `https://${w.domain}/post-${i}/`, clicks: 1, impressions: 10 })),
    );
    const a = await overview(orgId, w.id);
    expect(a.clicks).toBe(205);
    expect(a.impressions).toBe(2050);
    expect(a.series.clicks.reduce((s, p) => s + (p.value ?? 0), 0)).toBe(205);
    expect(a.breakdown.length).toBeLessThanOrEqual(200);
    expect(a.breakdownTotal).toBe(205);
  });
});

describe("actual publication events", () => {
  it("a draft delivered today is not a publication; it counts when it goes live next week", async () => {
    const { orgId, site: w } = await site();
    const a = await article(w.id, `https://${w.domain}/draft-first/`, { remoteStatus: "draft", at: new Date(Date.now() - 20 * DAY) });
    expect((await overview(orgId, w.id)).articlesPublished).toBe(0);
    await test.db.insert(publishLogs).values({ articleId: a.id, status: "published", remoteId: "1", remoteStatus: "publish", createdAt: new Date(Date.now() - 13 * DAY) });
    await test.db.update(articles).set({ firstLiveAt: new Date(Date.now() - 13 * DAY) }).where(eq(articles.id, a.id));
    // Republishing later is not another publication.
    await test.db.insert(publishLogs).values({ articleId: a.id, status: "published", remoteId: "1", remoteStatus: "publish", createdAt: new Date(Date.now() - 2 * DAY) });
    const o = await overview(orgId, w.id);
    expect(o.articlesPublished).toBe(1);
    expect(o.series.articles.find((p) => p.day === day(13))?.value).toBe(1);
  });

  it("an article with only ambiguous historical logs has an unknown publication date, not an invented one", async () => {
    const { orgId, site: w } = await site();
    const [a] = await test.db.insert(articles).values({ websiteId: w.id, title: "Old", status: "published", bodyHtml: "<p>x</p>", publishedUrl: `https://${w.domain}/old/` }).returning();
    await test.db.insert(publishLogs).values([
      { articleId: a.id, status: "published", remoteId: "1", createdAt: new Date(Date.now() - 8 * DAY) },
      { articleId: a.id, status: "published", remoteId: "1", createdAt: new Date(Date.now() - 5 * DAY) },
    ]);
    const o = await overview(orgId, w.id);
    expect(o.articlesPublished).toBe(0);
    expect(o.unknownPublicationDates).toBe(1);
  });
});
