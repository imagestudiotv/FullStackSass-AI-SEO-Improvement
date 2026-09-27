import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestDb, type TestDb } from "@/test/db";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
}));

/**
 * A simulated website behind fetchPage, the one network seam: every request
 * the verifier makes is answered from `site`, and recorded. Nothing leaves
 * the process.
 */
const net = vi.hoisted(() => ({
  site: new Map<string, { status: number; headers?: Record<string, string>; body?: string } | "throw">(),
  requested: [] as string[],
}));
vi.mock("@/lib/websites/fetch-page", () => ({
  fetchPage: vi.fn(async (url: string) => {
    net.requested.push(url);
    const answer = net.site.get(url);
    if (answer === "throw" || !answer) throw new Error("ETIMEDOUT");
    return new Response(answer.body ?? null, { status: answer.status, headers: answer.headers ?? {} });
  }),
}));

import { siteScope } from "./link-guard";
import { findVerifiedTargets, sitemapCandidates } from "./link-inventory";
import { cacheKey, verifyUrl, verifyUrls } from "./link-verify";

const scope = siteScope({ url: "https://imagestudio.com", domain: "imagestudio.com" });
const HTML = { "content-type": "text/html; charset=utf-8" };
const page = (title: string, body = "", bodyClass = "") =>
  `<html><head><title>${title}</title></head><body class="${bodyClass}"><h1>${title}</h1>${body}</body></html>`;

let test: TestDb;
beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});
beforeEach(async () => {
  net.site.clear();
  net.requested.length = 0;
  await test.client.exec("delete from provider_cache");
});

describe("what counts as a missing page", () => {
  it.each([404, 410])("%s is confirmed missing", async (status) => {
    net.site.set("https://imagestudio.com/destination-wedding-photography-films", { status, headers: HTML, body: "gone" });
    const verdict = await verifyUrl("https://imagestudio.com/destination-wedding-photography-films", scope);
    expect(verdict).toMatchObject({ status: "missing", httpStatus: status });
  });

  it.each([
    ["an English not-found title", page("Page not found - ImageStudio")],
    ["an Italian one", page("Pagina non trovata")],
    ["WordPress's error404 template", page("ImageStudio", "", "error404 wp-theme")],
  ])("an error page served as 200 is missing (%s)", async (_label, body) => {
    net.site.set("https://imagestudio.com/nope/", { status: 200, headers: HTML, body });
    expect((await verifyUrl("https://imagestudio.com/nope/", scope)).status).toBe("missing");
  });

  it("a missing page redirected to the homepage is missing, not a match", async () => {
    net.site.set("https://imagestudio.com/old-service/", { status: 301, headers: { location: "/" } });
    net.site.set("https://imagestudio.com/", { status: 200, headers: HTML, body: page("ImageStudio - Home") });
    const verdict = await verifyUrl("https://imagestudio.com/old-service/", scope);
    expect(verdict).toMatchObject({ status: "missing", reason: "redirected to the homepage" });
  });
});

describe("what counts as a real page", () => {
  it("a 200 HTML page is ok, with its title", async () => {
    net.site.set("https://imagestudio.com/wedding-photography/", { status: 200, headers: HTML, body: page("Wedding Photography | ImageStudio") });
    expect(await verifyUrl("https://imagestudio.com/wedding-photography/", scope)).toMatchObject({
      status: "ok",
      finalUrl: "https://imagestudio.com/wedding-photography/",
      title: "Wedding Photography | ImageStudio",
      isHtml: true,
    });
  });

  it("a page moved on the same site to a related address is ok, at its new address", async () => {
    net.site.set("https://imagestudio.com/wedding-films", { status: 301, headers: { location: "https://www.imagestudio.com/wedding-films/" } });
    net.site.set("https://www.imagestudio.com/wedding-films/", { status: 200, headers: HTML, body: page("Wedding Films") });
    expect(await verifyUrl("https://imagestudio.com/wedding-films", scope)).toMatchObject({
      status: "ok",
      finalUrl: "https://www.imagestudio.com/wedding-films/",
    });
  });

  it("a page redirected somewhere unrelated is rejected", async () => {
    net.site.set("https://imagestudio.com/destination-wedding-films/", { status: 301, headers: { location: "/corporate-events/" } });
    net.site.set("https://imagestudio.com/corporate-events/", { status: 200, headers: HTML, body: page("Corporate Events") });
    expect((await verifyUrl("https://imagestudio.com/destination-wedding-films/", scope)).status).toBe("rejected");
  });

  it("a redirect off the site, or to another subdomain, is rejected WITHOUT following it", async () => {
    net.site.set("https://imagestudio.com/a/", { status: 302, headers: { location: "https://evil.test/a/" } });
    net.site.set("https://imagestudio.com/b/", { status: 302, headers: { location: "https://shop.imagestudio.com/b/" } });
    expect(await verifyUrl("https://imagestudio.com/a/", scope)).toMatchObject({ status: "rejected", reason: /off the website/ });
    expect(await verifyUrl("https://imagestudio.com/b/", scope)).toMatchObject({ status: "rejected", reason: /off the website/ });
    expect(net.requested).not.toContain("https://evil.test/a/");
    expect(net.requested).not.toContain("https://shop.imagestudio.com/b/");
  });

  it("a login page is not a link destination", async () => {
    net.site.set("https://imagestudio.com/members/", { status: 302, headers: { location: "/wp-login.php?redirect_to=x" } });
    net.site.set("https://imagestudio.com/wp-login.php?redirect_to=x", { status: 200, headers: HTML, body: page("Log In") });
    expect((await verifyUrl("https://imagestudio.com/members/", scope)).status).toBe("rejected");
  });

  it("a URL on another site is never fetched", async () => {
    expect((await verifyUrl("https://other.test/page", scope)).status).toBe("rejected");
    expect(net.requested).toEqual([]);
  });
});

describe("uncertainty is not proof of a broken link", () => {
  it.each([
    ["a timeout", "throw" as const, /no response/],
    ["rate limiting", { status: 429 }, /rate limited/],
    ["a server error", { status: 503 }, /503/],
    ["a firewall refusal", { status: 403 }, /refused/],
  ])("%s is unavailable", async (_label, answer, reason) => {
    net.site.set("https://imagestudio.com/services/", answer);
    expect(await verifyUrl("https://imagestudio.com/services/", scope)).toMatchObject({ status: "unavailable", reason });
  });

  it("endless redirects are unavailable", async () => {
    for (let i = 0; i < 8; i++) {
      net.site.set(`https://imagestudio.com/r${i}`, { status: 302, headers: { location: `/r${i + 1}` } });
    }
    expect((await verifyUrl("https://imagestudio.com/r0", scope)).reason).toBe("too many redirects");
    expect(net.requested.length).toBeLessThanOrEqual(6);
  });
});

describe("caching, freshness and tenants", () => {
  const url = "https://imagestudio.com/wedding-photography/";
  const SITE_A = "11111111-1111-4111-8111-111111111111";
  const SITE_B = "22222222-2222-4222-8222-222222222222";

  it("answers from the cache while fresh, and checks again once it is not", async () => {
    net.site.set(url, { status: 200, headers: HTML, body: page("Wedding Photography") });
    const t0 = new Date("2026-09-27T00:00:00Z");
    await verifyUrls(SITE_A, [url], scope, { now: () => t0 });
    expect(net.requested).toHaveLength(1);

    const later = new Date(t0.getTime() + 60 * 60 * 1000);
    const cached = await verifyUrls(SITE_A, [url], scope, { now: () => later });
    expect(cached.get(url)?.status).toBe("ok");
    expect(net.requested).toHaveLength(1);

    const stale = new Date(t0.getTime() + 8 * 24 * 60 * 60 * 1000);
    await verifyUrls(SITE_A, [url], scope, { now: () => stale });
    expect(net.requested).toHaveLength(2);
  });

  it("forgets a temporary failure quickly", async () => {
    net.site.set(url, { status: 503 });
    const t0 = new Date("2026-09-27T00:00:00Z");
    await verifyUrls(SITE_A, [url], scope, { now: () => t0 });
    net.site.set(url, { status: 200, headers: HTML, body: page("Wedding Photography") });
    const soon = await verifyUrls(SITE_A, [url], scope, { now: () => new Date(t0.getTime() + 20 * 60 * 1000) });
    expect(soon.get(url)?.status).toBe("ok");
  });

  it("never reads one website's answers for another", async () => {
    net.site.set(url, { status: 200, headers: HTML, body: page("Wedding Photography") });
    await verifyUrls(SITE_A, [url], scope);
    net.site.set(url, { status: 404 });
    const forB = await verifyUrls(SITE_B, [url], scope);
    expect(forB.get(url)?.status).toBe("missing");
    expect(cacheKey(SITE_A, url)).not.toBe(cacheKey(SITE_B, url));
    const { rows } = await test.client.query<{ endpoint: string }>("select endpoint from provider_cache order by endpoint");
    expect(rows.map((r) => r.endpoint)).toEqual([SITE_A, SITE_B]);
  });

  it("writes nothing on a dry run, and checks nothing past the time budget", async () => {
    net.site.set(url, { status: 200, headers: HTML, body: page("Wedding Photography") });
    await verifyUrls(SITE_A, [url], scope, { writeCache: false });
    expect((await test.client.query("select 1 from provider_cache")).rows).toHaveLength(0);

    net.requested.length = 0;
    const late = await verifyUrls(SITE_A, [url], scope, { budgetMs: 0 });
    expect(late.get(url)).toMatchObject({ status: "unavailable", reason: "not checked in time" });
    expect(net.requested).toEqual([]);
  });
});

describe("sitemaps: candidates, never proof", () => {
  const XML = { "content-type": "application/xml" };
  const urlset = (paths: string[]) =>
    `<urlset>${paths.map((p) => `<url><loc>https://imagestudio.com${p}</loc></url>`).join("")}</urlset>`;

  it("uses the configured sitemap first, without guessing other locations", async () => {
    net.site.set("https://imagestudio.com/custom-map.xml", { status: 200, headers: XML, body: urlset(["/a-page/"]) });
    const urls = await sitemapCandidates(scope, "https://imagestudio.com/custom-map.xml");
    expect(urls).toEqual(["https://imagestudio.com/a-page/"]);
    expect(net.requested).toEqual(["https://imagestudio.com/custom-map.xml"]);
  });

  it("follows a sitemap index only so far: a few children, pages before archives", async () => {
    const children = Array.from({ length: 20 }, (_, i) => `https://imagestudio.com/map-${i}.xml`);
    net.site.set("https://imagestudio.com/robots.txt", { status: 200, body: "Sitemap: https://imagestudio.com/index.xml" });
    net.site.set("https://imagestudio.com/index.xml", {
      status: 200,
      headers: XML,
      body: `<sitemapindex>${["https://imagestudio.com/tag-sitemap.xml", ...children, "https://imagestudio.com/page-sitemap.xml"]
        .map((loc) => `<sitemap><loc>${loc}</loc></sitemap>`)
        .join("")}</sitemapindex>`,
    });
    net.site.set("https://imagestudio.com/page-sitemap.xml", { status: 200, headers: XML, body: urlset(["/services/"]) });
    for (const child of children) net.site.set(child, { status: 200, headers: XML, body: urlset(["/x/"]) });

    const urls = await sitemapCandidates(scope, null);
    expect(urls).toContain("https://imagestudio.com/services/");
    expect(net.requested.length).toBeLessThanOrEqual(8);
    expect(net.requested).not.toContain("https://imagestudio.com/tag-sitemap.xml");
  });

  it("ignores entries on other hosts and archive pages", async () => {
    net.site.set("https://imagestudio.com/custom-map.xml", {
      status: 200,
      headers: XML,
      body: `<urlset><url><loc>https://evil.test/page/</loc></url><url><loc>https://imagestudio.com/tag/news/</loc></url><url><loc>https://imagestudio.com/</loc></url></urlset>`,
    });
    expect(await sitemapCandidates(scope, "https://imagestudio.com/custom-map.xml")).toEqual([]);
  });

  it("an empty inventory means no targets - and no invented ones", async () => {
    const targets = await findVerifiedTargets({
      websiteId: "33333333-3333-4333-8333-333333333333",
      scope,
      sitemapUrl: null,
      subject: "Destination wedding photography in Italy",
      limit: 3,
    });
    expect(targets).toEqual([]);
  });
});
