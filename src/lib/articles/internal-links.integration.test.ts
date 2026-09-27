import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { articles, articleVersions, calendarItems, pages, publishLogs, websites } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { seedWebsite } from "@/test/fixtures";
import { NEW_SITE_DEFAULTS } from "@/lib/websites/new-site-defaults";
import { acknowledgePluginDispatch } from "@/lib/publishing/acknowledge";

/**
 * Internal links end to end, against a disposable database and a simulated
 * website: the writer's output -> the add-internal-links step -> storage ->
 * the WordPress plugin's payload and the direct publisher's payload, plus
 * drafts written before this fix and the dry-run audit.
 *
 * The site is the reported one's shape: imagestudio.com, a Yoast-style
 * sitemap index, some pages real and some stale. Nothing leaves the process.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
}));

const net = vi.hoisted(() => ({
  site: new Map<string, { status: number; headers?: Record<string, string>; body?: string } | "throw">(),
  requested: [] as string[],
  onRequest: null as null | ((url: string) => Promise<void>),
}));
vi.mock("@/lib/websites/fetch-page", () => ({
  fetchPage: vi.fn(async (url: string) => {
    net.requested.push(url);
    if (net.onRequest) await net.onRequest(url);
    const answer = net.site.get(url);
    if (answer === "throw" || !answer) throw new Error("ETIMEDOUT");
    return new Response(answer.body ?? null, { status: answer.status, headers: answer.headers ?? {} });
  }),
}));

const inngestMock = vi.hoisted(() => ({
  send: vi.fn(async () => ({ ids: ["evt"] })),
  createFunction: vi.fn((config: unknown, handler: unknown) => ({ config, handler })),
}));
vi.mock("@/inngest/client", () => ({ inngest: inngestMock }));

const writer = vi.hoisted(() => ({ generateOutline: vi.fn(), generateBody: vi.fn() }));
vi.mock("@/lib/articles/generate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/articles/generate")>()),
  generateOutline: writer.generateOutline,
  generateBody: writer.generateBody,
}));
vi.mock("@/lib/images/generate", () => ({ isImageGenerationConfigured: () => false, generateArticleImage: vi.fn() }));
vi.mock("@/lib/notifications/create", () => ({ notify: vi.fn() }));
vi.mock("@/lib/plugin/sync", () => ({ nudgePluginIfDue: vi.fn(async () => "none"), recordSyncUrl: vi.fn() }));
const keys = vi.hoisted(() => ({ websiteId: "" }));
vi.mock("@/lib/plugin/keys", () => ({
  resolveIntegrationKey: vi.fn(async () => ({ keyId: "key-1", websiteId: keys.websiteId, websiteDomain: "imagestudio.com" })),
}));
vi.mock("@/lib/publishing/credentials", () => ({
  resolveIntegration: vi.fn(async () => ({ integrationId: "integration-1", providerId: "wordpress" })),
  loadCredentialsById: vi.fn(),
}));

import { sanitizeHtml } from "@/lib/articles/sanitize";
import { generateArticle, queueArticleForCalendarItem } from "@/inngest/functions/generate-article";
import { publishArticleJob } from "@/inngest/functions/publish-article";
import { GET as pluginArticles } from "@/app/api/plugin/articles/route";

import { poweredByHtml } from "./delivery";
import { auditArticleLinks, prepareStoredArticle } from "./internal-links";

const ORIGIN = "https://imagestudio.com";
const HTML = { "content-type": "text/html; charset=utf-8" };
const XML = { "content-type": "application/xml" };
const page = (title: string, bodyClass = "") =>
  `<html><head><title>${title} | ImageStudio</title></head><body class="${bodyClass}"><h1>${title}</h1><p>...</p></body></html>`;
const urlset = (paths: string[]) =>
  `<?xml version="1.0"?><urlset>${paths.map((p) => `<url><loc>${ORIGIN}${p}</loc></url>`).join("")}</urlset>`;

function serveSite() {
  net.site.clear();
  const set = (path: string, answer: { status: number; headers?: Record<string, string>; body?: string } | "throw") =>
    net.site.set(`${ORIGIN}${path}`, answer);
  set("/robots.txt", { status: 200, headers: { "content-type": "text/plain" }, body: `User-agent: *\nSitemap: ${ORIGIN}/sitemap_index.xml\n` });
  set("/sitemap_index.xml", {
    status: 200,
    headers: XML,
    body: `<?xml version="1.0"?><sitemapindex>
      <sitemap><loc>${ORIGIN}/category-sitemap.xml</loc></sitemap>
      <sitemap><loc>${ORIGIN}/post-sitemap.xml</loc></sitemap>
      <sitemap><loc>${ORIGIN}/page-sitemap.xml</loc></sitemap>
    </sitemapindex>`,
  });
  set("/page-sitemap.xml", {
    status: 200,
    headers: XML,
    body: urlset(["/", "/wedding-photography/", "/destination-wedding-photography/", "/engagement-photography-sessions/", "/contact/"]),
  });
  set("/post-sitemap.xml", { status: 200, headers: XML, body: urlset(["/blog/tuscany-wedding-guide/"]) });
  set("/category-sitemap.xml", { status: 200, headers: XML, body: urlset(["/category/weddings/"]) });

  set("/wedding-photography/", { status: 200, headers: HTML, body: page("Wedding Photography") });
  set("/destination-wedding-photography/", { status: 200, headers: HTML, body: page("Destination Wedding Photography") });
  // Stale: listed in the sitemap, gone from the site.
  set("/engagement-photography-sessions/", { status: 404, headers: HTML, body: page("Page not found", "error404") });
  set("/blog/tuscany-wedding-guide/", { status: 200, headers: HTML, body: page("Tuscany Wedding Guide") });
  set("/contact/", { status: 200, headers: HTML, body: page("Contact") });
  // What the client reported: an invented address.
  set("/destination-wedding-photography-films", { status: 404, headers: HTML, body: page("Page not found", "error404") });
}

/** What the writer produced for posts like 11186 and 11180. */
const WRITTEN = sanitizeHtml(
  '<ul><li><a href="#planning">Planning</a></li><li><a href="#costs">Costs</a></li></ul>' +
    '<h2 id="planning">Planning a destination wedding</h2>' +
    '<p>Book a <a href="#">free consultation</a> with our team, or see our ' +
    '<a href="/destination-wedding-photography-films">destination wedding photography films</a>.</p>' +
    "<h2>What engagement photography costs</h2>" +
    "<p>Engagement photography pricing depends on travel.</p>" +
    '<p>Wedding photography in Tuscany is shaped by the light (<a href="https://en.wikipedia.org/wiki/Tuscany">Tuscany</a>).</p>',
);

let test: TestDb;
beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});
beforeEach(async () => {
  serveSite();
  net.requested.length = 0;
  net.onRequest = null;
  inngestMock.send.mockClear();
  writer.generateOutline.mockReset();
  writer.generateBody.mockReset();
  await test.client.exec("delete from provider_cache; delete from job_outbox;");
});

/** A paying website at imagestudio.com (each test its own tenant). */
async function imagestudio(options: { internalLinkTarget?: number } = {}) {
  const { orgId, websiteId } = await seedWebsite(test);
  await test.db
    .update(websites)
    // A website created by this build (lib/websites/new-site-defaults.ts).
    .set({ url: ORIGIN, domain: "imagestudio.com", internalLinkTarget: options.internalLinkTarget ?? 3, ...NEW_SITE_DEFAULTS })
    .where(eq(websites.id, websiteId));
  keys.websiteId = websiteId;
  return { orgId, websiteId };
}

async function storedBody(articleId: string) {
  const [row] = await test.db.select({ bodyHtml: articles.bodyHtml }).from(articles).where(eq(articles.id, articleId));
  return row.bodyHtml;
}

async function pluginPayload() {
  const response = await pluginArticles(
    new NextRequest("https://app.test/api/plugin/articles", { headers: { "x-integration-key": "k" } }),
  );
  return (await response.json()) as { articles: { id: string; html: string }[] };
}

function memoisedStep() {
  const done = new Map<string, unknown>();
  return {
    run: async (id: string, fn: () => unknown) => {
      if (done.has(id)) return done.get(id);
      const result = await fn();
      done.set(id, result);
      return result;
    },
  };
}
const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

/** Runs the real generation job for a new article on this website. */
async function generate(websiteId: string, body: string) {
  const [item] = await test.db
    .insert(calendarItems)
    .values({ websiteId, title: "Destination wedding photography in Italy" })
    .returning({ id: calendarItems.id });
  const queued = await queueArticleForCalendarItem(websiteId, item.id);
  if (!queued.ok) throw new Error(queued.error);
  const data = (inngestMock.send.mock.calls.at(-1) as unknown as [{ data: unknown }])[0].data;

  writer.generateOutline.mockResolvedValue({ sections: [{ heading: "Planning", points: [] }], metaDescription: "m" });
  writer.generateBody.mockResolvedValue({ bodyHtml: body, metaDescription: "m", slug: "s", wordCount: 60 });
  const job = generateArticle as unknown as { handler: (ctx: unknown) => Promise<unknown> };
  await job.handler({ event: { data }, step: memoisedStep(), logger });
  return queued.articleId;
}

describe("a new article, from the writer to WordPress", () => {
  it("stores and sends only links that exist, and adds verified ones", async () => {
    const { websiteId } = await imagestudio();
    const articleId = await generate(websiteId, WRITTEN);
    const stored = await storedBody(articleId);

    // The reported defects are gone, with their words kept.
    expect(stored).not.toContain('href="#"');
    expect(stored).not.toContain("destination-wedding-photography-films");
    expect(stored).toContain("Book a free consultation with our team");
    // The invented link was replaced by the verified page it clearly meant.
    expect(stored).toContain(
      `<a href="${ORIGIN}/destination-wedding-photography/">destination wedding photography films</a>`,
    );
    // Contents: rebuilt from the real headings (lib/articles/toc.ts) - the
    // writer's "#costs" entry pointed at nothing and is gone.
    expect(stored).toContain('<a href="#planning">Planning a destination wedding</a>');
    expect(stored).toContain('<a href="#what-engagement-photography-costs">What engagement photography costs</a>');
    expect(stored).toContain('<h2 id="what-engagement-photography-costs">');
    expect(stored).not.toContain("#costs");
    expect(stored).toContain('<h2 id="planning">');
    // A verified, relevant page was linked from the article's own words -
    // internal, so followed and in the same tab.
    expect(stored).toContain(`<a href="${ORIGIN}/wedding-photography/">Wedding photography</a> in Tuscany`);
    // The stale sitemap entry (404) never became a link; nor the homepage,
    // a category archive, or an unrelated post.
    expect(stored).not.toContain("engagement-photography-sessions");
    expect(stored).not.toMatch(new RegExp(`href="${ORIGIN}/?"`));
    expect(stored).not.toContain("/category/");
    // External citations are untouched.
    expect(stored).toContain('<a href="https://en.wikipedia.org/wiki/Tuscany" target="_blank" rel="noopener nofollow">');
    // Every internal href in the stored article is one the site answered 200 for.
    for (const [, href] of stored!.matchAll(/href="(https:\/\/imagestudio\.com[^"]*)"/g)) {
      const answer = net.site.get(href);
      expect(answer !== "throw" && answer?.status).toBe(200);
    }

    // What the plugin receives is what was stored, plus the delivery-only
    // "Powered by RepGet" line (on by default) - once.
    const payload = await pluginPayload();
    expect(payload.articles.find((a) => a.id === articleId)?.html).toBe(`${stored}
${poweredByHtml()}`);
  });

  it("with internalLinkTarget 0, adds no links and removes the writer's own", async () => {
    const { websiteId } = await imagestudio({ internalLinkTarget: 0 });
    const articleId = await generate(
      websiteId,
      WRITTEN.replace("our team", `our <a href="${ORIGIN}/contact/">team</a>`),
    );
    const stored = (await storedBody(articleId))!;
    expect(stored).not.toMatch(/href="https:\/\/imagestudio\.com/);
    expect(stored).toContain("our team");
    expect(stored).toContain("https://en.wikipedia.org/wiki/Tuscany");
  });

  it("when the site cannot be reached at all, adds nothing and keeps nothing it could not check", async () => {
    const { websiteId } = await imagestudio();
    net.site.clear();
    const articleId = await generate(websiteId, WRITTEN);
    const stored = (await storedBody(articleId))!;
    expect(stored).not.toMatch(/href="(https:\/\/imagestudio\.com|\/)/);
    expect(stored).not.toContain('href="#"');
    expect(stored).toContain("destination wedding photography films");
  });
});

describe("drafts written before the fix", () => {
  const OLD =
    '<p>Call us: <a href="#">book now</a>.</p>' +
    '<p>Our <a href="/destination-wedding-photography-films">films</a>, our <a href="/wedding-photography/">wedding photography</a>, ' +
    'and <a href="/services/">services</a>.</p>' +
    '<p>See <a href="#faq">the FAQ</a>.</p>';

  async function queuedDraft(websiteId: string, bodyHtml = OLD) {
    const [row] = await test.db
      .insert(articles)
      .values({ websiteId, title: "Old draft", status: "draft", bodyHtml })
      .returning({ id: articles.id });
    return row.id;
  }

  it("are repaired before the plugin receives them: confirmed defects fixed, uncertain links kept, original versioned", async () => {
    const { websiteId } = await imagestudio();
    net.site.set(`${ORIGIN}/services/`, "throw"); // timing out right now
    const articleId = await queuedDraft(websiteId);

    const payload = await pluginPayload();
    const sent = payload.articles.find((a) => a.id === articleId)!.html;

    const repaired =
      "<p>Call us: book now.</p>" +
      `<p>Our films, our <a href="${ORIGIN}/wedding-photography/">wedding photography</a>, ` +
      'and <a href="/services/">services</a>.</p>' +
      "<p>See the FAQ.</p>";
    expect(sent).toBe(`${repaired}
${poweredByHtml()}`);
    // Stored copy repaired too (without the delivery-only credit line), and the original kept as a version.
    expect(await storedBody(articleId)).toBe(repaired);
    const versions = await test.db.select().from(articleVersions).where(eq(articleVersions.articleId, articleId));
    expect(versions.map((v) => v.bodyHtml)).toEqual([OLD]);

    // The next poll: nothing more to fix, no new version, and no request at
    // all - verified pages are cached for days, and a timeout for minutes so
    // an hourly poll cannot hammer a struggling site.
    net.requested.length = 0;
    // Handed over and not yet acknowledged: in flight, so not offered again
    // (lib/publishing/dispatch.ts) ...
    expect((await pluginPayload()).articles.find((a) => a.id === articleId)).toBeUndefined();
    // ... until the plugin reports back - here, that it could not create it.
    await acknowledgePluginDispatch({ websiteId, articleId, dispatchId: null, report: { kind: "failed", error: "simulated plugin error" } });
    const again = await pluginPayload();
    expect(again.articles.find((a) => a.id === articleId)!.html).toBe(sent);
    expect(await test.db.select().from(articleVersions).where(eq(articleVersions.articleId, articleId))).toHaveLength(1);
    expect(net.requested).toEqual([]);
  });

  it("are repaired before a direct CMS publish, and the publish sends the repaired copy", async () => {
    const { orgId, websiteId } = await imagestudio();
    const articleId = await queuedDraft(websiteId);

    const job = publishArticleJob as unknown as { handler: (ctx: unknown) => Promise<unknown> };
    let prepared: { post: { contentHtml: string } } | null = null;
    const step = {
      run: async (id: string, fn: () => unknown) => {
        const result = await fn();
        if (id === "load-article") {
          prepared = result as typeof prepared;
          throw new Error("stop after load-article");
        }
        return result;
      },
    };
    await expect(
      job.handler({ event: { data: { articleId, websiteId, organizationId: orgId, status: "publish" } }, step, logger }),
    ).rejects.toThrow("stop after load-article");

    expect(prepared!.post.contentHtml).toBe(`${await storedBody(articleId)}
${poweredByHtml()}`);
    expect(prepared!.post.contentHtml).not.toContain('href="#"');
    expect(prepared!.post.contentHtml).not.toContain("destination-wedding-photography-films");
  });

  it("an edit saved while links were being checked wins, and is itself checked", async () => {
    const { websiteId } = await imagestudio();
    const articleId = await queuedDraft(websiteId);
    const edited = '<p>Edited: <a href="#">book</a> and <a href="/wedding-photography/">wedding photography</a>.</p>';
    net.onRequest = async () => {
      net.onRequest = null;
      await test.db.update(articles).set({ bodyHtml: edited }).where(eq(articles.id, articleId));
    };

    const prepared = await prepareStoredArticle(articleId, websiteId);
    expect(prepared?.html).toBe(`<p>Edited: book and <a href="${ORIGIN}/wedding-photography/">wedding photography</a>.</p>`);
    expect(await storedBody(articleId)).toBe(prepared?.html);
    const versions = await test.db.select().from(articleVersions).where(eq(articleVersions.articleId, articleId));
    // The edit is the version kept, not the body it replaced.
    expect(versions.map((v) => v.bodyHtml)).toEqual([edited]);
  });

  it("are never checked against another tenant's site or verdicts", async () => {
    const a = await imagestudio();
    const aArticle = await queuedDraft(a.websiteId);
    await prepareStoredArticle(aArticle, a.websiteId);

    // Tenant B: a different site. A's cached answers for imagestudio.com are
    // not B's, and B's article is checked against B's own domain.
    const b = await seedWebsite(test);
    await test.db.update(websites).set({ url: "https://other-studio.test", domain: "other-studio.test" }).where(eq(websites.id, b.websiteId));
    const bArticle = await queuedDraft(b.websiteId, `<p><a href="${ORIGIN}/wedding-photography/">x</a> <a href="/about/">y</a></p>`);
    net.requested.length = 0;
    const prepared = await prepareStoredArticle(bArticle, b.websiteId);
    // imagestudio.com is not B's site: an external link, left alone and never fetched.
    expect(prepared?.html).toContain(`href="${ORIGIN}/wedding-photography/"`);
    expect(net.requested).toEqual(["https://other-studio.test/about/"]);
    // And an article id from another website finds nothing.
    expect(await prepareStoredArticle(aArticle, b.websiteId)).toBeNull();
  });
});

describe("the dry-run audit", () => {
  it("reports each problem with the WordPress post it lives in, and changes nothing", async () => {
    const { websiteId } = await imagestudio();
    const [row] = await test.db
      .insert(articles)
      .values({
        websiteId,
        title: "Published post",
        status: "published",
        publishedUrl: `${ORIGIN}/blog/destination-wedding-planning/`,
        bodyHtml: '<p>A <a href="#">placeholder</a> and <a href="/destination-wedding-photography-films">films</a>.</p>',
      })
      .returning({ id: articles.id });
    await test.db.insert(publishLogs).values({
      articleId: row.id,
      status: "published",
      remoteId: "11180",
      remoteUrl: `${ORIGIN}/blog/destination-wedding-planning/`,
    });
    await test.db.insert(pages).values({ websiteId, url: `${ORIGIN}/wedding-photography/`, title: "Wedding Photography", statusCode: 200 });
    const before = await storedBody(row.id);

    const [report] = await auditArticleLinks(websiteId, [row.id]);

    expect(report).toMatchObject({ articleId: row.id, remotePostId: "11180", wouldChange: true });
    expect(report.findings).toMatchObject([
      { href: "#", text: "placeholder", outcome: "unwrapped", before: '<a href="#">placeholder</a>', after: "placeholder" },
      {
        href: "/destination-wedding-photography-films",
        outcome: "unwrapped",
        verdict: "missing",
        reason: "the page does not exist (404)",
      },
    ]);
    // Nothing written: the article, its versions, the cache.
    expect(await storedBody(row.id)).toBe(before);
    expect(await test.db.select().from(articleVersions).where(eq(articleVersions.articleId, row.id))).toHaveLength(0);
    expect((await test.client.query("select 1 from provider_cache")).rows).toHaveLength(0);
    // Scoped to the website.
    expect(await auditArticleLinks(websiteId, ["00000000-0000-4000-8000-000000000000"])).toEqual([]);
  });
});
