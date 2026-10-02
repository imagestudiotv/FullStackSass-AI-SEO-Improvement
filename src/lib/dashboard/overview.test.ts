import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  articles,
  backlinkRequests,
  gaMetrics,
  gscPageMetrics,
  keywords,
  networkSites,
  placements,
  publishLogs,
  siteDailyMetrics,
  valuationPolicies,
  websites,
} from "@/lib/db/schema";
import { organization } from "@/lib/db/auth-tables";
import { createTestDb, type TestDb } from "@/test/db";

/**
 * The dashboard's figures (lib/dashboard/overview.ts) on a disposable
 * database: one window everywhere, page-scoped article traffic, first
 * publications only, honest "not connected", and the shared backlink numbers.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }) }));

import { getDashboardOverview } from "@/lib/dashboard/overview";
import { applyCheck, recordArticlePublication } from "@/lib/backlinks/placements";
import { backlinkMetrics, resolveWindow } from "@/lib/reporting/backlinks";

let test: TestDb;
beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});
beforeEach(async () => {
  await test.db.delete(valuationPolicies);
});

const DAY = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);

async function workspace() {
  const orgId = `org_${randomUUID().slice(0, 8)}`;
  await test.db.insert(organization).values({ id: orgId, name: "W", slug: orgId, createdAt: new Date() });
  const domain = `site-${randomUUID().slice(0, 6)}.test`;
  const [site] = await test.db.insert(websites).values({ organizationId: orgId, url: `https://${domain}`, domain, status: "ready" }).returning();
  return { orgId, site };
}

async function publishedArticle(websiteId: string, domain: string, slug: string, firstPublished: Date, keyword?: { term: string; cpc: string }) {
  const [a] = await test.db
    .insert(articles)
    .values({ websiteId, title: `Article ${slug}`, slug, status: "published", bodyHtml: "<p>x</p>", publishedUrl: `https://${domain}/${slug}/`, targetKeyword: keyword?.term ?? null, firstLiveAt: firstPublished })
    .returning();
  // As the publish paths record it: the delivery, with the status the CMS stored, and the first live date.
  await test.db.insert(publishLogs).values({ articleId: a.id, status: "published", remoteId: "1", remoteUrl: a.publishedUrl, remoteStatus: "publish", createdAt: firstPublished });
  if (keyword) await test.db.insert(keywords).values({ websiteId, term: keyword.term, cpc: keyword.cpc }).onConflictDoNothing();
  return a;
}

const overview = (orgId: string, websiteId: string, range = "30d") =>
  getDashboardOverview({ websiteId, ownerOrgId: orgId, showCredits: true, range });

describe("achievements", () => {
  it("counts FIRST publications in the window: a republish or an edit is not a new one", async () => {
    const { orgId, site } = await workspace();
    const a = await publishedArticle(site.id, site.domain, "old", daysAgo(60));
    // Edited and republished this week: still published 60 days ago.
    await test.db.update(articles).set({ updatedAt: new Date() }).where(eq(articles.id, a.id));
    await test.db.insert(publishLogs).values({ articleId: a.id, status: "published", remoteId: "1", remoteStatus: "publish", createdAt: daysAgo(1) });
    await publishedArticle(site.id, site.domain, "new", daysAgo(2));
    const o = await overview(orgId, site.id);
    expect(o?.achievements.ok && o.achievements.data.articlesPublished).toBe(1);
    const wins = o?.wins.ok ? o.wins.data.items.filter((w) => w.kind === "published") : [];
    expect(wins.map((w) => (w.kind === "published" ? w.title : ""))).toEqual(["Article new"]);
  });

  it("article clicks are page-scoped (other pages excluded) and GA sessions stay a separate measure", async () => {
    const { orgId, site } = await workspace();
    await publishedArticle(site.id, site.domain, "guide", daysAgo(20));
    const day = iso(daysAgo(3));
    await test.db.insert(gscPageMetrics).values([
      // The article, with and without trailing slash / www - one page.
      { websiteId: site.id, date: day, pageUrl: `https://www.${site.domain}/guide`, clicks: 7, impressions: 100, position: 4 },
      // The homepage: not a RepGet article.
      { websiteId: site.id, date: day, pageUrl: `https://${site.domain}/`, clicks: 500, impressions: 9000, position: 2 },
    ]);
    await test.db.insert(gaMetrics).values({ websiteId: site.id, date: day, pageUrl: `https://${site.domain}/guide/`, sessions: 11, users: 9 });
    const o = await overview(orgId, site.id);
    const a = o?.achievements.ok ? o.achievements.data : null;
    expect(a).toMatchObject({ clicks: 7, impressions: 100, sessions: 11 });
    expect(a?.series.clicks.find((p) => p.day === day)?.value).toBe(7);
  });

  it("says 'not connected' rather than zero when Search Console or Analytics has no data", async () => {
    const { orgId, site } = await workspace();
    await publishedArticle(site.id, site.domain, "guide", daysAgo(5));
    const o = await overview(orgId, site.id);
    const a = o?.achievements.ok ? o.achievements.data : null;
    expect(a).toMatchObject({ clicks: null, impressions: null, sessions: null, trafficValue: null, totalValue: null });
    expect(a?.series.clicks.every((p) => p.value === null)).toBe(true);
    expect(o?.bestArticles.ok && o.bestArticles.data.connected).toBe(false);
  });

  it("values traffic by each article's keyword CPC under a USD policy, and refuses a currency mismatch", async () => {
    const { orgId, site } = await workspace();
    await publishedArticle(site.id, site.domain, "a", daysAgo(10), { term: "wedding films", cpc: "2.00" });
    await publishedArticle(site.id, site.domain, "b", daysAgo(10), { term: "photo studio", cpc: "0.50" });
    const day = iso(daysAgo(4));
    await test.db.insert(gscPageMetrics).values([
      { websiteId: site.id, date: day, pageUrl: `https://${site.domain}/a/`, clicks: 10, impressions: 50 },
      { websiteId: site.id, date: day, pageUrl: `https://${site.domain}/b/`, clicks: 4, impressions: 20 },
    ]);
    await test.db.insert(valuationPolicies).values({ version: 1, currency: "USD", clickValueMode: "keyword_cpc", backlinkRates: [], sources: "Keyword CPC from DataForSEO", effectiveFrom: daysAgo(30) });
    let a = (await overview(orgId, site.id))!.achievements;
    expect(a.ok && a.data.trafficValue).toBe(22); // 10 x 2.00 + 4 x 0.50
    expect(a.ok && a.data.backlinkValue).toBeNull();

    await test.db.insert(valuationPolicies).values({ version: 2, currency: "EUR", clickValueMode: "keyword_cpc", backlinkRates: [], sources: "Mismatched on purpose", effectiveFrom: daysAgo(1) });
    a = (await overview(orgId, site.id))!.achievements;
    expect(a.ok && a.data).toMatchObject({ trafficValue: null, trafficValueReason: "currency_mismatch" });
  });

  it("uses the same backlink numbers as the Backlinks pages", async () => {
    const { orgId, site } = await workspace();
    const partnerOrg = `org_${randomUUID().slice(0, 8)}`;
    await test.db.insert(organization).values({ id: partnerOrg, name: "P", slug: partnerOrg, createdAt: new Date() });
    const [host] = await test.db.insert(websites).values({ organizationId: partnerOrg, url: "https://host.test", domain: `host-${randomUUID().slice(0, 4)}.test` }).returning();
    await test.db.insert(networkSites).values([{ websiteId: host.id }, { websiteId: site.id }]);
    for (let i = 0; i < 2; i++) {
      const [req] = await test.db.insert(backlinkRequests).values({ websiteId: site.id, targetUrl: `https://${site.domain}/p${i}/`, status: "matched", creditsReserved: 1 }).returning();
      const [art] = await test.db.insert(articles).values({ websiteId: host.id, title: "h", status: "draft", bodyHtml: "<p>x</p>" }).returning();
      const [p] = await test.db.insert(placements).values({ requestId: req.id, hostWebsiteId: host.id, articleId: art.id, status: "drafted", credits: 1 }).returning();
      await recordArticlePublication(art.id, `https://${host.domain}/post${i}/`, "publish");
      await applyCheck(p.id, "alive", 200);
    }
    const o = (await overview(orgId, site.id))!;
    const shared = await backlinkMetrics({ websiteId: site.id, orgId, domain: site.domain }, resolveWindow("30d"));
    expect(o.backlinks.ok && o.backlinks.data.received.verified).toBe(shared.received.verified);
    expect(o.achievements.ok && o.achievements.data.backlinksReceived).toBe(shared.received.firstVerifiedInWindow);
    expect(o.history.ok && o.history.data.points.at(-1)?.active).toBe(2);
    const wins = o.wins.ok ? o.wins.data.items.find((w) => w.kind === "links_received") : null;
    expect(wins).toMatchObject({ count: 2 });
  });
});

describe("today's article and search", () => {
  it("shows an article held for review as with the RepGet team, never as publishable", async () => {
    const { orgId, site } = await workspace();
    await test.db.insert(articles).values({ websiteId: site.id, title: "Held", status: "draft", bodyHtml: "<p>x</p>", reviewStatus: "pending" });
    const o = await overview(orgId, site.id);
    expect(o?.todaysArticle.ok && o.todaysArticle.data).toMatchObject({ title: "Held", state: "awaiting_review" });
  });

  it("shows no change against a previous period Search Console did not fully report", async () => {
    const { orgId, site } = await workspace();
    for (let i = 1; i <= 5; i++) {
      await test.db.insert(siteDailyMetrics).values({ websiteId: site.id, date: iso(daysAgo(i)), gscClicks: 10, gscImpressions: 100, gscPosition: 5 });
    }
    const o = await overview(orgId, site.id, "7d");
    expect(o?.search.ok && o.search.data.google).toMatchObject({ connected: true, clicks: 50, clicksChange: null });
  });

  it("another workspace's website is not found", async () => {
    const a = await workspace();
    const b = await workspace();
    expect(await overview(b.orgId, a.site.id)).toBeNull();
  });
});

/*
  The dashboard passes showCredits only for the website's owner. A guest
  (website_members) gets the same site figures under the OWNER's workspace,
  but never the workspace's credits, and ownerView false so the cards offer
  nothing to buy.
*/
describe("who is looking", () => {
  it("an owner's view carries ownerView true", async () => {
    const { orgId, site } = await workspace();
    const o = await getDashboardOverview({ websiteId: site.id, ownerOrgId: orgId, showCredits: true, range: "30d" });
    expect(o?.ownerView).toBe(true);
  });

  it("a guest's view has no credits and ownerView false, but the site's own figures", async () => {
    const { orgId, site } = await workspace();
    await test.db.insert(articles).values({ websiteId: site.id, title: "Shared draft", status: "draft", bodyHtml: "<p>x</p>" });
    const o = await getDashboardOverview({ websiteId: site.id, ownerOrgId: orgId, showCredits: false, range: "30d" });
    expect(o).not.toBeNull();
    expect(o?.credits).toBeNull();
    expect(o?.ownerView).toBe(false);
    expect(o?.todaysArticle.ok && o.todaysArticle.data).toMatchObject({ title: "Shared draft" });
  });
});
