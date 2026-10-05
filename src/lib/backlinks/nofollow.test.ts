import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { articles, backlinkRequests, networkSites, notifications, placements, websites } from "@/lib/db/schema";
import { organization } from "@/lib/db/auth-tables";
import { createTestDb, type TestDb } from "@/test/db";

/**
 * Network backlinks and nofollow (client, 2026-10-01): placements are SENT
 * followed, and a placement found nofollow on its live page is an issue on
 * both dashboards and raises one alert to each side.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }) }));
vi.mock("@/inngest/client", () => ({ inngest: { send: vi.fn(async () => ({ ids: ["evt"] })) } }));

import { prepareForDelivery } from "@/lib/articles/delivery";
import { followedRel, isUnfollowed } from "@/lib/backlinks/follow";
import { alertIfNewlyUnfollowed } from "@/lib/backlinks/nofollow";
import { applyCheck, placementUrlsForArticle, recordArticlePublication } from "@/lib/backlinks/placements";
import { backlinkIssues, linkDetail, listLinks, parseListQuery } from "@/lib/reporting/backlinks";

let test: TestDb;
beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

describe("rel tokens", () => {
  it("nofollow, sponsored and ugc are not followed; anything else, or no rel, is", () => {
    expect(isUnfollowed("noopener nofollow")).toBe(true);
    expect(isUnfollowed("Sponsored")).toBe(true);
    expect(isUnfollowed("ugc noopener")).toBe(true);
    expect(isUnfollowed("noopener noreferrer")).toBe(false);
    expect(isUnfollowed("")).toBe(false);
    // Not seen is unknown, never reported as nofollow.
    expect(isUnfollowed(null)).toBe(false);
  });

  it("followedRel keeps the other tokens", () => {
    expect(followedRel("noopener nofollow")).toBe("noopener");
    expect(followedRel("nofollow sponsored ugc")).toBe("");
  });
});

describe("delivery", () => {
  const body =
    '<p>See <a href="https://partner.test/wedding-films/" target="_blank" rel="noopener nofollow">wedding films</a> and ' +
    '<a href="https://en.wikipedia.org/wiki/Film" target="_blank" rel="noopener nofollow">Wikipedia</a>.</p>';

  it("sends the article's placements followed and leaves every other external link nofollow", () => {
    const out = prepareForDelivery(body, { poweredBy: true, followUrls: ["https://partner.test/wedding-films/"] });
    expect(out).toContain('<a href="https://partner.test/wedding-films/" target="_blank" rel="noopener">wedding films</a>');
    expect(out).toContain('<a href="https://en.wikipedia.org/wiki/Film" target="_blank" rel="noopener nofollow">Wikipedia</a>');
    // The credit line is RepGet's own link, not a placement.
    expect(out).toMatch(/powered by <a [^>]*rel="noopener nofollow">RepGet<\/a>/);
  });

  it("matches the placement the way the verifier does (www, http, trailing slash)", () => {
    const out = prepareForDelivery(body, { poweredBy: false, followUrls: ["http://www.partner.test/wedding-films"] });
    expect(out).toContain('rel="noopener">wedding films</a>');
  });

  it("removes nofollow from a stored placement while adding opener protection", () => {
    const out = prepareForDelivery('<p><a href="https://partner.test/x" rel="nofollow sponsored">x</a></p>', {
      poweredBy: false,
      followUrls: ["https://partner.test/x"],
    });
    expect(out).toBe('<p><a href="https://partner.test/x" target="_blank" rel="noopener">x</a></p>');
  });

  it("without placements, nothing changes", () => {
    expect(prepareForDelivery(body, { poweredBy: false })).toBe(body);
  });
});

async function org(name: string) {
  const id = `org_${name}_${randomUUID().slice(0, 6)}`;
  await test.db.insert(organization).values({ id, name, slug: id, createdAt: new Date() });
  return id;
}
async function site(orgId: string, domain: string) {
  const [row] = await test.db.insert(websites).values({ organizationId: orgId, url: `https://${domain}`, domain, status: "ready" }).returning();
  await test.db.insert(networkSites).values({ websiteId: row.id, acceptingLinks: true, monthlyCap: 10 });
  return row;
}

/** A host article carrying one placement to the beneficiary, published. */
async function world() {
  const hostOrg = await org("host");
  const host = await site(hostOrg, `host-${randomUUID().slice(0, 6)}.test`);
  const benOrg = await org("ben");
  const ben = await site(benOrg, `ben-${randomUUID().slice(0, 6)}.test`);
  const targetUrl = `https://${ben.domain}/films/`;
  const [request] = await test.db
    .insert(backlinkRequests)
    .values({ websiteId: ben.id, targetUrl, status: "matched", creditsReserved: 1 })
    .returning();
  const [article] = await test.db
    .insert(articles)
    .values({ websiteId: host.id, title: "Choosing a studio", status: "draft", bodyHtml: "<p>x</p>" })
    .returning();
  const [placement] = await test.db
    .insert(placements)
    .values({ requestId: request.id, hostWebsiteId: host.id, articleId: article.id, status: "drafted", credits: 1, anchor: "films", managed: true })
    .returning();
  await recordArticlePublication(article.id, `https://${host.domain}/choosing/`, "publish");
  return { hostOrg, host, benOrg, ben, targetUrl, article, placementId: placement.id };
}

async function told(orgId: string) {
  return test.db.select().from(notifications).where(eq(notifications.organizationId, orgId));
}

describe("placementUrlsForArticle", () => {
  it("lists the article's placements, not withdrawn or removed ones", async () => {
    const w = await world();
    expect(await placementUrlsForArticle(w.article.id)).toEqual([w.targetUrl]);
    await test.db.update(placements).set({ status: "cancelled" }).where(eq(placements.id, w.placementId));
    expect(await placementUrlsForArticle(w.article.id)).toEqual([]);
  });
});

describe("the nofollow rule", () => {
  it("a live link marked nofollow is an issue on both sides, filterable, and shown on the row", async () => {
    const w = await world();
    await applyCheck(w.placementId, "alive", 200, new Date(), { rel: "noopener nofollow" });

    const hosted = await backlinkIssues({ websiteId: w.host.id, orgId: w.hostOrg });
    expect(hosted).toMatchObject({ hostedNofollow: 1, receivedNofollow: 0 });
    const received = await backlinkIssues({ websiteId: w.ben.id, orgId: w.benOrg });
    expect(received).toMatchObject({ hostedNofollow: 0, receivedNofollow: 1 });

    const filtered = await listLinks("received", { websiteId: w.ben.id, orgId: w.benOrg }, parseListQuery({ issue: "nofollow" }));
    expect(filtered.rows.map((r) => [r.id, r.nofollow])).toEqual([[w.placementId, true]]);
    const detail = await linkDetail("given", { websiteId: w.host.id, orgId: w.hostOrg }, w.placementId);
    expect(detail).toMatchObject({ nofollow: true, rel: "noopener nofollow" });
  });

  it("a followed link is not an issue, and fixing one clears it", async () => {
    const w = await world();
    await applyCheck(w.placementId, "alive", 200, new Date(Date.now() - 60_000), { rel: "sponsored" });
    expect((await backlinkIssues({ websiteId: w.host.id, orgId: w.hostOrg })).hostedNofollow).toBe(1);
    await applyCheck(w.placementId, "alive", 200, new Date(), { rel: "noopener" });
    expect((await backlinkIssues({ websiteId: w.host.id, orgId: w.hostOrg })).hostedNofollow).toBe(0);
    const rows = await listLinks("given", { websiteId: w.host.id, orgId: w.hostOrg }, parseListQuery({ issue: "nofollow" }));
    expect(rows.rows).toEqual([]);
  });

  it("alerts host and beneficiary once when a link becomes nofollow, not on every re-check", async () => {
    const w = await world();
    await applyCheck(w.placementId, "alive", 200, new Date(Date.now() - 3 * 60_000), { rel: "noopener" });
    expect(await alertIfNewlyUnfollowed(w.placementId)).toBe(false);

    await applyCheck(w.placementId, "alive", 200, new Date(Date.now() - 2 * 60_000), { rel: "noopener nofollow" });
    expect(await alertIfNewlyUnfollowed(w.placementId)).toBe(true);
    const host = await told(w.hostOrg);
    const ben = await told(w.benOrg);
    expect(host).toHaveLength(1);
    expect(host[0]).toMatchObject({ type: "backlink.nofollow", href: `/websites/${w.host.id}/backlinks/hosted?issue=nofollow` });
    expect(host[0].body).toContain(w.ben.domain);
    expect(host[0].body).toContain('"Choosing a studio"');
    expect(ben).toHaveLength(1);
    expect(ben[0]).toMatchObject({ type: "backlink.nofollow", href: `/websites/${w.ben.id}/backlinks/links?issue=nofollow` });

    // Still nofollow the next day: no second alert.
    await applyCheck(w.placementId, "alive", 200, new Date(Date.now() - 60_000), { rel: "noopener nofollow" });
    expect(await alertIfNewlyUnfollowed(w.placementId)).toBe(false);
    expect(await told(w.hostOrg)).toHaveLength(1);
  });

  it("a link nofollow on its very first sighting alerts", async () => {
    const w = await world();
    await applyCheck(w.placementId, "alive", 200, new Date(), { rel: "ugc" });
    expect(await alertIfNewlyUnfollowed(w.placementId)).toBe(true);
  });
});
