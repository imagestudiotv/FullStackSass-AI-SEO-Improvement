import { randomUUID } from "node:crypto";

import { and, eq, sql } from "drizzle-orm";
import { NextRequest } from "next/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  platformControls,
  adminAuditLog,
  articles,
  backlinkRequests,
  backlinkTargets,
  calendarItems,
  creditLedger,
  integrationKeys,
  integrations,
  member,
  networkSites,
  organization,
  placements,
  plans,
  subscriptions,
  user,
  websiteMembers,
  websites,
} from "@/lib/db/schema";
import { applyMigration, createTestDb, type TestDb } from "@/test/db";
import { NEW_SITE_DEFAULTS } from "@/lib/websites/new-site-defaults";

/**
 * The managed Partner Network end to end, on a disposable database with a
 * simulated web: the review gate on every publishing path, administrator
 * placements, and credits from reservation to verified settlement.
 */

const state = vi.hoisted(() => ({ db: null as unknown, session: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
}));
vi.mock("@/lib/auth-guard", () => ({ getSession: async () => state.session }));
vi.mock("@/lib/auth", () => ({ ensureOrganization: async () => {} }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
  notFound: () => {
    throw new Error("notFound");
  },
}));

/** Every page on every site exists, except those listed as gone. */
const net = vi.hoisted(() => ({ gone: new Set<string>(), onRequest: null as null | ((url: string) => Promise<void>) }));
vi.mock("@/lib/websites/fetch-page", () => ({
  fetchPage: vi.fn(async (url: string) => {
    if (net.onRequest) await net.onRequest(url);
    if (net.gone.has(url)) return new Response("gone", { status: 404, headers: { "content-type": "text/html" } });
    const title = new URL(url).pathname.replace(/\W+/g, " ").trim() || "Home";
    return new Response(`<html><head><title>${title}</title></head><body><h1>${title}</h1></body></html>`, {
      status: 200,
      headers: { "content-type": "text/html" },
    });
  }),
}));

const inngestMock = vi.hoisted(() => ({
  send: vi.fn(async () => ({ ids: ["evt"] })),
  createFunction: vi.fn((config: unknown, handler: unknown) => ({ config, handler })),
}));
vi.mock("@/inngest/client", () => ({ inngest: inngestMock }));
vi.mock("@/lib/plugin/sync", () => ({ nudgePluginIfDue: vi.fn(async () => "nothing-due"), recordSyncUrl: vi.fn(), triggerPluginSync: vi.fn(async () => "synced") }));
vi.mock("@/lib/publishing/credentials", () => ({
  resolveIntegration: vi.fn(async () => ({ integrationId: "int-1", providerId: "wordpress" })),
  loadCredentialsById: vi.fn(),
}));
vi.mock("@/lib/notifications/create", () => ({ notify: vi.fn() }));
const keyMock = vi.hoisted(() => ({ websiteId: "" }));
vi.mock("@/lib/plugin/keys", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/plugin/keys")>()),
  resolveIntegrationKey: vi.fn(async () => ({ keyId: "k", websiteId: keyMock.websiteId, organizationId: "o", websiteDomain: "host.test" })),
}));

import { GET as pluginArticles } from "@/app/api/plugin/articles/route";
import { publishDueDrafts } from "@/inngest/functions/scheduled-articles";
import { publishArticleJob } from "@/inngest/functions/publish-article";
import { prepareForDelivery } from "@/lib/articles/delivery";
import { prepareStoredArticle } from "@/lib/articles/internal-links";
import { checkReleasable, syncApproval } from "@/lib/articles/review";
import {
  approveForRelease,
  changePlacementCredits,
  getReviewArticle,
  getReviewQueue,
  placeLink,
  removePlacement,
} from "@/lib/admin/network";
import { cancelRequest, listGiven, listRequests, requestBacklink } from "@/lib/backlinks/actions";
import { approveArticle, placeManagedLink } from "@/lib/backlinks/managed";
import { workspaceCredits } from "@/lib/reporting/backlinks";
import { addTarget, moveTarget, getPartnerNetwork, setParticipation, setTargetPriority } from "@/lib/backlinks/network-settings";
import { applyCheck, recordArticlePublication } from "@/lib/backlinks/placements";
import { dueArticlesForPlugin } from "@/lib/plugin/due";
import { publishArticle } from "@/lib/publishing/actions";
import { pendingFirstArticle } from "@/lib/publishing/policy";

let test: TestDb;
const ADMIN = "admin@repget.test";

beforeAll(async () => {
  vi.stubEnv("ADMIN_EMAILS", ADMIN);
  test = await createTestDb();
  state.db = test.db;
  // The operator has switched the managed review on (lib/publishing/controls.ts).
  await test.db.insert(platformControls).values({ key: "managed_review", enabled: true, updatedBy: "test" });
});

beforeEach(() => {
  net.gone.clear();
  net.onRequest = null;
  inngestMock.send.mockClear();
  asAdmin();
});

/* --- fixtures ------------------------------------------------------------ */

async function workspace(name = "ws") {
  const id = `org_${name}_${randomUUID().slice(0, 8)}`;
  const userId = `user_${id}`;
  const now = new Date();
  await test.db.insert(organization).values({ id, name, slug: id, createdAt: now });
  await test.db.insert(user).values({ id: userId, name, email: `${userId}@example.test`, emailVerified: true, createdAt: now, updatedAt: now });
  await test.db.insert(member).values({ id: `m_${id}`, organizationId: id, userId, role: "owner", createdAt: now });
  return { orgId: id, userId };
}

async function site(
  orgId: string,
  domain: string,
  options: { industry?: string | null; language?: string | null; accepting?: boolean; cap?: number; cms?: boolean } = {},
) {
  const [row] = await test.db
    .insert(websites)
    .values({
      organizationId: orgId,
      url: `https://${domain}`,
      domain,
      status: "ready",
      // A website created by this build: the application writes these.
      ...NEW_SITE_DEFAULTS,
      industry: options.industry === undefined ? "wedding photography studio" : options.industry,
      language: options.language === undefined ? "English" : options.language,
    })
    .returning({ id: websites.id });
  await test.db.insert(networkSites).values({ websiteId: row.id, acceptingLinks: options.accepting ?? true, monthlyCap: options.cap ?? 3 });
  if (options.cms) await test.db.insert(integrations).values({ websiteId: row.id, kind: "wordpress", status: "connected" });
  return row.id;
}

async function grant(orgId: string, amount: number) {
  await test.db.insert(creditLedger).values({ organizationId: orgId, type: "purchase", amount, note: "test" });
}

const BODY =
  "<h2>Planning</h2><p>Great wedding videography captures the day. Our team also covers engagement portraits and destination wedding films.</p>" +
  "<h2>Costs</h2><p>Prices depend on travel and wedding videography hours.</p>";

async function article(
  websiteId: string,
  options: { reviewStatus?: string | null; plannedFor?: Date | null; body?: string; createdAt?: Date } = {},
) {
  let calendarItemId: string | null = null;
  if (options.plannedFor !== undefined && options.plannedFor !== null) {
    const [item] = await test.db
      .insert(calendarItems)
      .values({ websiteId, title: "Planned", scheduledFor: options.plannedFor })
      .returning({ id: calendarItems.id });
    calendarItemId = item.id;
  }
  const [row] = await test.db
    .insert(articles)
    .values({
      websiteId,
      calendarItemId,
      title: "Wedding films guide",
      status: "draft",
      bodyHtml: options.body ?? BODY,
      reviewStatus: options.reviewStatus === undefined ? "pending" : options.reviewStatus,
      ...(options.createdAt ? { createdAt: options.createdAt } : {}),
    })
    .returning({ id: articles.id, reviewVersion: articles.reviewVersion });
  return row;
}

async function domainOf(websiteId: string) {
  const [found] = await test.db.select({ domain: websites.domain }).from(websites).where(eq(websites.id, websiteId));
  return found.domain;
}

async function row(articleId: string) {
  const [found] = await test.db.select().from(articles).where(eq(articles.id, articleId));
  return found;
}

async function balance(orgId: string) {
  const rows = await test.db.select({ amount: creditLedger.amount }).from(creditLedger).where(eq(creditLedger.organizationId, orgId));
  return rows.reduce((sum, r) => sum + r.amount, 0);
}

async function reserved(orgId: string) {
  const rows = await test.db
    .select({ n: backlinkRequests.creditsReserved, status: backlinkRequests.status })
    .from(backlinkRequests)
    .innerJoin(websites, eq(websites.id, backlinkRequests.websiteId))
    .where(eq(websites.organizationId, orgId));
  return rows.filter((r) => r.status === "pending" || r.status === "matched").reduce((s, r) => s + r.n, 0);
}

function asAdmin(email = ADMIN, emailVerified = true) {
  state.session = { user: { id: "admin_user", email, emailVerified }, session: { id: "s_admin", activeOrganizationId: null } };
}
function asMember(userId: string, orgId: string) {
  state.session = { user: { id: userId, email: `${userId}@example.test`, emailVerified: true }, session: { id: `s_${userId}`, activeOrganizationId: orgId } };
}

/** A host article with a beneficiary ready to receive a link. */
async function scene(options: { credits?: number; hostCms?: boolean } = {}) {
  const hostWs = await workspace("host");
  const benWs = await workspace("ben");
  const host = await site(hostWs.orgId, `host-${randomUUID().slice(0, 6)}.test`, { cms: options.hostCms ?? true });
  const beneficiary = await site(benWs.orgId, `ben-${randomUUID().slice(0, 6)}.test`);
  await grant(benWs.orgId, options.credits ?? 5);
  const post = await article(host);
  const [ben] = await test.db.select({ domain: websites.domain }).from(websites).where(eq(websites.id, beneficiary));
  return { hostWs, benWs, host, beneficiary, benDomain: ben.domain, post };
}

async function place(s: Awaited<ReturnType<typeof scene>>, overrides: Partial<Parameters<typeof placeLink>[0]> = {}) {
  const current = await row(s.post.id);
  return placeLink({
    articleId: s.post.id,
    expectedVersion: current.reviewVersion,
    beneficiaryWebsiteId: s.beneficiary,
    targetUrl: `https://${s.benDomain}/wedding-videography/`,
    anchor: "wedding videography",
    credits: 1,
    reason: "Same field, same language",
    ...overrides,
  });
}

async function approve(articleId: string) {
  const current = await row(articleId);
  return approveForRelease({ articleId, expectedVersion: current.reviewVersion, note: "" });
}

function memoisedStep(stopAfter?: string) {
  const captured: Record<string, unknown> = {};
  return {
    captured,
    run: async (id: string, fn: () => unknown) => {
      const result = await fn();
      captured[id] = result;
      if (id === stopAfter) throw new Error(`stop after ${id}`);
      return result;
    },
  };
}
const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

/* --- defaults -------------------------------------------------------------- */

describe("defaults for new websites, and existing ones untouched", () => {
  it("migration 0043 changes no default: existing websites, and websites an OLDER build creates mid-deploy, keep the old behaviour", async () => {
    const old = await createTestDb({ through: "0042_article_baseline_trigger" });
    const now = new Date();
    await old.client.query(`insert into organization (id, name, slug, created_at) values ('o1','O','o1',$1)`, [now]);
    await old.client.exec(`insert into websites (organization_id, url, domain) values ('o1','https://old.test','old.test')`);
    await applyMigration(old.client, "0043_managed_network");
    await old.client.exec(`insert into websites (organization_id, url, domain) values ('o1','https://new.test','new.test')`);
    const { rows } = await old.client.query<{ domain: string; auto_publish: boolean; table_of_contents: boolean; mention_similar_products: boolean; powered_by_link: boolean; publish_as: string }>(
      "select domain, auto_publish, table_of_contents, mention_similar_products, powered_by_link, publish_as from websites order by domain desc",
    );
    expect(rows).toEqual([
      { domain: "old.test", auto_publish: false, table_of_contents: false, mention_similar_products: false, powered_by_link: true, publish_as: "live" },
      // Inserted as the previous build inserts: no values for these columns.
      { domain: "new.test", auto_publish: false, table_of_contents: false, mention_similar_products: false, powered_by_link: true, publish_as: "live" },
    ].sort((a, b) => b.domain.localeCompare(a.domain)));
    // No article was put into review by the migration.
    const { rows: reviewed } = await old.client.query("select 1 from articles where review_status is not null");
    expect(reviewed).toHaveLength(0);
  });
});

/* --- the review gate ------------------------------------------------------- */

describe("the review gate holds a pending article on every publishing path", () => {
  it("first-article release, plugin pull, scheduled release, Publish press and the publish job", async () => {
    const ws = await workspace("gate");
    const host = await site(ws.orgId, `gate-${randomUUID().slice(0, 6)}.test`, { cms: true });
    const post = await article(host, { plannedFor: new Date(Date.now() - 86_400_000) });

    expect(await pendingFirstArticle(host)).toBeNull();
    expect(await dueArticlesForPlugin(host, 5)).toEqual([]);
    await publishDueDrafts();
    expect(inngestMock.send.mock.calls.flat().filter((e) => (e as { data?: { articleId?: string } }).data?.articleId === post.id)).toEqual([]);

    asMember(ws.userId, ws.orgId);
    expect(await publishArticle(host, post.id)).toEqual({ ok: false, error: expect.stringMatching(/RepGet team/) });

    const job = publishArticleJob as unknown as { handler: (ctx: unknown) => Promise<unknown> };
    await expect(
      job.handler({ event: { data: { articleId: post.id, websiteId: host, organizationId: ws.orgId, status: "publish" } }, step: memoisedStep(), logger }),
    ).resolves.toEqual({ held: "pending_review" });

    keyMock.websiteId = host;
    await test.db.insert(integrationKeys).values({ websiteId: host, keyHash: randomUUID(), keyPrefix: "seo_x" });
    const pulled = await (await pluginArticles(new NextRequest("https://app.test/api/plugin/articles", { headers: { "x-integration-key": "seo_k" } }))).json();
    expect(pulled.articles).toEqual([]);
  });

  it("after approval, every path releases it - once its planned day has come", async () => {
    const ws = await workspace("rel");
    const host = await site(ws.orgId, `rel-${randomUUID().slice(0, 6)}.test`, { cms: true });
    const post = await article(host, { plannedFor: new Date(Date.now() - 86_400_000) });

    asAdmin();
    const approved = await approve(post.id);
    expect(approved).toMatchObject({ ok: true, data: { placements: 0, release: "queued" } });
    // The approval queued exactly one publish, live (first article).
    expect(await checkReleasable(post.id)).toEqual({ ok: true });
    expect((await pendingFirstArticle(host))?.id).toBe(post.id);
    expect((await dueArticlesForPlugin(host, 5)).map((r) => r.id)).toEqual([post.id]);
  });

  it("the first-article exception never releases a reviewed article before its planned day", async () => {
    const ws = await workspace("early");
    const host = await site(ws.orgId, `early-${randomUUID().slice(0, 6)}.test`, { cms: true });
    const tomorrow = new Date(Date.now() + 2 * 86_400_000);
    const post = await article(host, { plannedFor: tomorrow });

    const approved = await approve(post.id);
    expect(approved).toMatchObject({ ok: true, data: { release: "waiting_for_day" } });
    expect(await pendingFirstArticle(host)).toBeNull();
    expect(await dueArticlesForPlugin(host, 5)).toEqual([]);

    // The day comes: it is released, and its planned date is unchanged.
    const [item] = await test.db.select().from(calendarItems).innerJoin(articles, eq(articles.calendarItemId, calendarItems.id)).where(eq(articles.id, post.id));
    await test.db.update(calendarItems).set({ scheduledFor: new Date(Date.now() - 3600_000) }).where(eq(calendarItems.id, item.calendar_items.id));
    expect((await pendingFirstArticle(host))?.id).toBe(post.id);
  });

  it("approved late: released at once, and the schedule is not rewritten", async () => {
    const ws = await workspace("late");
    const host = await site(ws.orgId, `late-${randomUUID().slice(0, 6)}.test`, { cms: true });
    const planned = new Date(Date.now() - 5 * 86_400_000);
    const post = await article(host, { plannedFor: planned });
    const approved = await approve(post.id);
    expect(approved).toMatchObject({ ok: true, data: { release: "queued" } });
    const [item] = await test.db.select({ at: calendarItems.scheduledFor }).from(calendarItems).innerJoin(articles, eq(articles.calendarItemId, calendarItems.id)).where(eq(articles.id, post.id));
    expect(item.at?.getTime()).toBe(planned.getTime());
  });

  it("an article outside the network (review_status null) keeps the old first-article rule", async () => {
    const ws = await workspace("legacy");
    const host = await site(ws.orgId, `legacy-${randomUUID().slice(0, 6)}.test`, { cms: true, accepting: false });
    const post = await article(host, { reviewStatus: null });
    expect((await pendingFirstArticle(host))?.id).toBe(post.id);
  });
});

describe("approval, edits and races", () => {
  it("an edit after approval holds the article again, and the queue shows it", async () => {
    const s = await scene();
    await approve(s.post.id);
    expect(await checkReleasable(s.post.id)).toEqual({ ok: true });

    await test.db.update(articles).set({ bodyHtml: `${BODY}<p>Edited later.</p>` }).where(eq(articles.id, s.post.id));
    // Held by the hash alone, before anything else runs...
    expect(await checkReleasable(s.post.id)).toEqual({ ok: false, reason: "changed_since_approval" });
    // ...and back in the queue once the edit path syncs it.
    await syncApproval(s.post.id);
    expect((await row(s.post.id)).reviewStatus).toBe("pending");
    const queue = await getReviewQueue();
    expect(queue.articles.find((a) => a.id === s.post.id)?.approvedCurrent).toBe(false);
  });

  it("a stale or duplicate approval is refused - two administrators cannot both approve different versions", async () => {
    const s = await scene();
    const version = (await row(s.post.id)).reviewVersion;
    const [a, b] = await Promise.all([
      approveForRelease({ articleId: s.post.id, expectedVersion: version, note: "" }),
      approveForRelease({ articleId: s.post.id, expectedVersion: version, note: "" }),
    ]);
    expect([a.ok, b.ok].sort()).toEqual([false, true]);
    const stale = await placeLink({
      articleId: s.post.id,
      expectedVersion: version,
      beneficiaryWebsiteId: s.beneficiary,
      targetUrl: `https://${s.benDomain}/x/`,
      anchor: "engagement portraits",
      credits: 1,
      reason: "",
    });
    expect(stale).toMatchObject({ ok: false, error: expect.stringMatching(/changed/) });
  });

  it("the publish job never sends a revision edited while it was running", async () => {
    const s = await scene();
    await approve(s.post.id);
    // An edit lands in the middle of the job's link check.
    // An internal link, so the job's link check makes a request (the moment the edit lands).
    await test.db.update(articles).set({ bodyHtml: `${BODY}<p><a href="https://${await domainOf(s.host)}/checked/">x</a></p>` }).where(eq(articles.id, s.post.id));
    await syncApproval(s.post.id);
    const version = (await row(s.post.id)).reviewVersion;
    await approveForRelease({ articleId: s.post.id, expectedVersion: version, note: "" });
    net.onRequest = async () => {
      net.onRequest = null;
      await test.db.update(articles).set({ title: "Changed mid-job" }).where(eq(articles.id, s.post.id));
    };
    const job = publishArticleJob as unknown as { handler: (ctx: unknown) => Promise<unknown> };
    await expect(
      job.handler({ event: { data: { articleId: s.post.id, websiteId: s.host, organizationId: s.hostWs.orgId, status: "publish" } }, step: memoisedStep(), logger }),
    ).resolves.toEqual({ held: "changed_since_approval" });
  });
});

/* --- placements and credits ------------------------------------------------ */

describe("administrator placements", () => {
  it("commit a structured placement: link in the draft, credits reserved, audit row written", async () => {
    const s = await scene({ credits: 5 });
    const placed = await place(s, { credits: 2 });
    expect(placed).toMatchObject({ ok: true });

    const body = (await row(s.post.id)).bodyHtml!;
    expect(body).toContain(`<a href="https://${s.benDomain}/wedding-videography/" target="_blank" rel="noopener nofollow">wedding videography</a>`);
    const [p] = await test.db.select().from(placements).where(eq(placements.articleId, s.post.id));
    expect(p).toMatchObject({ status: "drafted", managed: true, credits: 2, createdBy: ADMIN, reason: "Same field, same language" });
    expect(await reserved(s.benWs.orgId)).toBe(2);
    expect(await balance(s.benWs.orgId)).toBe(5); // reserved, not spent
    const audit = await test.db.select().from(adminAuditLog).where(eq(adminAuditLog.targetId, p.id));
    expect(audit[0]).toMatchObject({ actorEmail: ADMIN, action: "network.placement_added" });
  });

  it("refuses when the workspace cannot cover it, and writes nothing", async () => {
    const s = await scene({ credits: 1 });
    const before = (await row(s.post.id)).bodyHtml;
    expect(await place(s, { credits: 2 })).toMatchObject({ ok: false, error: expect.stringMatching(/Not enough credits: 1 available/) });
    expect((await row(s.post.id)).bodyHtml).toBe(before);
    expect(await test.db.select().from(placements).where(eq(placements.articleId, s.post.id))).toHaveLength(0);
    expect(await reserved(s.benWs.orgId)).toBe(0);
  });

  it("two administrators cannot spend the same available credit", async () => {
    const s = await scene({ credits: 1 });
    const other = await article(s.host);
    const [v1, v2] = [(await row(s.post.id)).reviewVersion, (await row(other.id)).reviewVersion];
    const results = await Promise.allSettled([
      placeManagedLink({ articleId: s.post.id, expectedVersion: v1, beneficiaryWebsiteId: s.beneficiary, targetUrl: `https://${s.benDomain}/a/`, anchor: "wedding videography", credits: 1, actorEmail: ADMIN }),
      placeManagedLink({ articleId: other.id, expectedVersion: v2, beneficiaryWebsiteId: s.beneficiary, targetUrl: `https://${s.benDomain}/b/`, anchor: "wedding videography", credits: 1, actorEmail: ADMIN }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await reserved(s.benWs.orgId)).toBe(1);
  });

  it("credits are the workspace's: two of its websites share one balance", async () => {
    const s = await scene({ credits: 1 });
    const secondSite = await site(s.benWs.orgId, `ben2-${randomUUID().slice(0, 6)}.test`);
    const [second] = await test.db.select({ domain: websites.domain }).from(websites).where(eq(websites.id, secondSite));
    const otherHostWs = await workspace("host2");
    const otherHost = await site(otherHostWs.orgId, `h2-${randomUUID().slice(0, 6)}.test`);
    const otherPost = await article(otherHost);

    expect(await place(s)).toMatchObject({ ok: true });
    const refused = await placeLink({
      articleId: otherPost.id,
      expectedVersion: (await row(otherPost.id)).reviewVersion,
      beneficiaryWebsiteId: secondSite,
      targetUrl: `https://${second.domain}/page/`,
      anchor: "wedding videography",
      credits: 1,
      reason: "",
    });
    expect(refused).toMatchObject({ ok: false, error: expect.stringMatching(/Not enough credits: 0 available/) });
  });

  it("allows several relevant placements in one article, up to the limit, one per website", async () => {
    const s = await scene();
    expect(await place(s)).toMatchObject({ ok: true });
    // The same website again in this article: refused.
    expect(await place(s, { targetUrl: `https://${s.benDomain}/other/`, anchor: "engagement portraits" })).toMatchObject({
      ok: false,
      error: expect.stringMatching(/already links to that website/),
    });
    // A second, different website: allowed.
    const ws2 = await workspace("ben-b");
    const b2 = await site(ws2.orgId, `benb-${randomUUID().slice(0, 6)}.test`);
    await grant(ws2.orgId, 3);
    const [d2] = await test.db.select({ domain: websites.domain }).from(websites).where(eq(websites.id, b2));
    expect(await place(s, { beneficiaryWebsiteId: b2, targetUrl: `https://${d2.domain}/films/`, anchor: "destination wedding films" })).toMatchObject({ ok: true });
    expect(await test.db.select().from(placements).where(eq(placements.articleId, s.post.id))).toHaveLength(2);
  });

  it.each([
    ["a page on another domain", () => ({ targetUrl: "https://elsewhere.test/page/" }), /must be a valid address on/],
    ["a page that does not exist", (s: Awaited<ReturnType<typeof scene>>) => {
      net.gone.add(`https://${s.benDomain}/missing/`);
      return { targetUrl: `https://${s.benDomain}/missing/` };
    }, /could not be confirmed/],
    ["words not in the article", () => ({ anchor: "crypto trading tips" }), /not in a paragraph/],
    ["words only inside a heading", () => ({ anchor: "Planning" }), /not in a paragraph/],
    ["an out-of-range credit amount", () => ({ credits: 11 }), /whole number from 1 to 10/],
  ])("refuses %s", async (_label, overrides, error) => {
    const s = await scene();
    expect(await place(s, overrides(s))).toMatchObject({ ok: false, error: expect.stringMatching(error) });
  });

  it("keeps the self, same-workspace, reciprocal, relevance and language protections", async () => {
    const s = await scene();
    // Same workspace as the host.
    const sibling = await site(s.hostWs.orgId, `sib-${randomUUID().slice(0, 6)}.test`);
    expect(await place(s, { beneficiaryWebsiteId: sibling, targetUrl: `https://${await domainOf(sibling)}/x/` })).toMatchObject({
      ok: false,
      error: expect.stringMatching(/same workspace/),
    });
    // The host itself.
    expect(await place(s, { beneficiaryWebsiteId: s.host, targetUrl: `https://${await domainOf(s.host)}/x/` })).toMatchObject({
      ok: false,
      error: expect.stringMatching(/cannot link to itself/),
    });
    // Unrelated field.
    const crypto = await workspace("crypto");
    const cryptoSite = await site(crypto.orgId, `c-${randomUUID().slice(0, 6)}.test`, { industry: "software saas" });
    await grant(crypto.orgId, 3);
    expect(await place(s, { beneficiaryWebsiteId: cryptoSite, targetUrl: `https://${await domainOf(cryptoSite)}/x/` })).toMatchObject({
      ok: false,
      error: expect.stringMatching(/not in related fields/),
    });
    // Different language.
    const it1 = await workspace("it");
    const itSite = await site(it1.orgId, `it-${randomUUID().slice(0, 6)}.test`, { language: "Italian" });
    await grant(it1.orgId, 3);
    const [itDomain] = await test.db.select({ d: websites.domain }).from(websites).where(eq(websites.id, itSite));
    expect(await place(s, { beneficiaryWebsiteId: itSite, targetUrl: `https://${itDomain.d}/x/` })).toMatchObject({ ok: false, error: expect.stringMatching(/different languages/) });
    // Reciprocal: the beneficiary once hosted a link to the host.
    const [req] = await test.db.insert(backlinkRequests).values({ websiteId: s.host, targetUrl: "https://host/x", status: "live" }).returning({ id: backlinkRequests.id });
    await test.db.insert(placements).values({ requestId: req.id, hostWebsiteId: s.beneficiary, status: "live", credits: 1 });
    expect(await place(s)).toMatchObject({ ok: false, error: expect.stringMatching(/reciprocal/) });
  });

  it("an approved placement's link survives the link checks and delivery, and the approval holds", async () => {
    const s = await scene();
    await place(s);
    await approve(s.post.id);
    const prepared = await prepareStoredArticle(s.post.id, s.host);
    expect(prepared?.html).toContain(`https://${s.benDomain}/wedding-videography/`);
    expect(await checkReleasable(s.post.id)).toEqual({ ok: true });
    expect(prepareForDelivery(prepared!.html, { poweredBy: true })).toContain(`https://${s.benDomain}/wedding-videography/`);
  });

  it("withdrawing before publication unwraps the link and releases the credits; after publication it is refused", async () => {
    const s = await scene();
    await place(s);
    const [p] = await test.db.select().from(placements).where(eq(placements.articleId, s.post.id));
    const withdrawn = await removePlacement({ articleId: s.post.id, placementId: p.id, expectedVersion: (await row(s.post.id)).reviewVersion, reason: "Not needed" });
    expect(withdrawn).toMatchObject({ ok: true });
    expect((await row(s.post.id)).bodyHtml).not.toContain(s.benDomain);
    expect((await row(s.post.id)).bodyHtml).toContain("wedding videography");
    expect(await reserved(s.benWs.orgId)).toBe(0);

    await place(s);
    const [p2] = await test.db.select().from(placements).where(and(eq(placements.articleId, s.post.id), eq(placements.status, "drafted")));
    await test.db.update(placements).set({ status: "published" }).where(eq(placements.id, p2.id));
    expect(await removePlacement({ articleId: s.post.id, placementId: p2.id, expectedVersion: (await row(s.post.id)).reviewVersion, reason: "" })).toMatchObject({
      ok: false,
      error: expect.stringMatching(/already published/),
    });
  });

  it("the amount can change before publication (increase reserved), never after settlement", async () => {
    const s = await scene({ credits: 2 });
    await place(s);
    const [p] = await test.db.select().from(placements).where(eq(placements.articleId, s.post.id));
    const v = async () => (await row(s.post.id)).reviewVersion;
    expect(await changePlacementCredits({ articleId: s.post.id, placementId: p.id, expectedVersion: await v(), credits: 3, reason: "" })).toMatchObject({ ok: false, error: expect.stringMatching(/Not enough credits/) });
    expect(await changePlacementCredits({ articleId: s.post.id, placementId: p.id, expectedVersion: await v(), credits: 2, reason: "Better slot" })).toMatchObject({ ok: true });
    expect(await reserved(s.benWs.orgId)).toBe(2);
    await test.db.update(placements).set({ status: "live" }).where(eq(placements.id, p.id));
    expect(await changePlacementCredits({ articleId: s.post.id, placementId: p.id, expectedVersion: await v(), credits: 1, reason: "" })).toMatchObject({ ok: false, error: expect.stringMatching(/not yet published/) });
  });
});

describe("settlement: only after the link is seen live, exactly once", () => {
  it("no credits for a draft, an approval, a CMS draft or a failed publication; charged and rewarded once when seen live", async () => {
    const s = await scene({ credits: 5 });
    await place(s, { credits: 2 });
    await approve(s.post.id);
    const [p] = await test.db.select().from(placements).where(eq(placements.articleId, s.post.id));

    // A CMS draft, and a publish with no URL, are not publication.
    expect(await recordArticlePublication(s.post.id, "https://host/post", "draft")).toBe(0);
    expect(await recordArticlePublication(s.post.id, null, "publish")).toBe(0);
    expect(await balance(s.benWs.orgId)).toBe(5);
    expect(await balance(s.hostWs.orgId)).toBe(0);

    expect(await recordArticlePublication(s.post.id, "https://host.test/post/", "publish")).toBe(1);
    // A check that could not reach the page moves nothing.
    expect(await applyCheck(p.id, "error", null)).toBeNull();
    expect(await balance(s.benWs.orgId)).toBe(5);

    // Seen live, twice at once: exactly one charge and one reward.
    await Promise.all([applyCheck(p.id, "alive", 200), applyCheck(p.id, "alive", 200)]);
    await applyCheck(p.id, "alive", 200);
    expect(await balance(s.benWs.orgId)).toBe(3);
    expect(await balance(s.hostWs.orgId)).toBe(2);
    expect(await reserved(s.benWs.orgId)).toBe(0);

    // Removed after repeated confirmed misses: refunded and reversed, once.
    for (let i = 0; i < 4; i++) await applyCheck(p.id, "missing", 200);
    expect(await balance(s.benWs.orgId)).toBe(5);
    expect(await balance(s.hostWs.orgId)).toBe(0);
    // ...and the refund is spendable: the managed request is closed, not held
    // as a reservation that nothing would ever match again.
    expect(await reserved(s.benWs.orgId)).toBe(0);
    const [request] = await test.db
      .select({ status: backlinkRequests.status, creditsReserved: backlinkRequests.creditsReserved })
      .from(backlinkRequests)
      .where(eq(backlinkRequests.id, p.requestId));
    expect(request).toEqual({ status: "cancelled", creditsReserved: 0 });
    const moves = await test.db.select({ key: creditLedger.idempotencyKey }).from(creditLedger).where(eq(creditLedger.referenceId, p.id));
    expect(moves.map((m) => m.key).sort()).toEqual([
      `placement:${p.id}:charge`,
      `placement:${p.id}:host_reversal`,
      `placement:${p.id}:host_reward`,
      `placement:${p.id}:refund`,
    ]);
  });
});

/* --- authorization and customer preferences ------------------------------- */

describe("who may do what", () => {
  it("admin actions refuse a customer, and an unverified allowlisted address", async () => {
    const s = await scene();
    asMember(s.benWs.userId, s.benWs.orgId);
    await expect(place(s)).rejects.toThrow();
    await expect(getReviewQueue()).rejects.toThrow();
    asAdmin(ADMIN, false);
    await expect(approve(s.post.id)).rejects.toThrow();
    expect(await test.db.select().from(placements).where(eq(placements.articleId, s.post.id))).toHaveLength(0);
  });

  it("customer-side matching and spending are off; a managed link cannot be cancelled by the customer", async () => {
    const s = await scene();
    await place(s);
    asMember(s.benWs.userId, s.benWs.orgId);
    expect(await requestBacklink(s.beneficiary, { targetUrl: `https://${s.benDomain}/x/` })).toMatchObject({ ok: false, error: expect.stringMatching(/RepGet team/) });
    const [req] = await test.db.select().from(backlinkRequests).where(eq(backlinkRequests.websiteId, s.beneficiary));
    expect(await cancelRequest(s.beneficiary, req.id)).toMatchObject({ ok: false, error: expect.stringMatching(/arranged by the RepGet team/) });
    expect(await reserved(s.benWs.orgId)).toBe(1);

    // What the panels are given: a managed, still-unsettled link on both sides
    // (shown as credits held / earned once live, with no cancel control).
    expect(await listRequests(s.beneficiary)).toEqual([expect.objectContaining({ status: "matched", managed: true, creditsUsed: 1 })]);
    asMember(s.hostWs.userId, s.hostWs.orgId);
    expect(await listGiven(s.host)).toEqual([expect.objectContaining({ status: "drafted", credits: 1 })]);
  });
});

describe("the customer's Partner Network preferences", () => {
  it("targets are verified, on the customer's own site, ordered and prioritised - and persist", async () => {
    const ws = await workspace("prefs");
    const siteId = await site(ws.orgId, `prefs-${randomUUID().slice(0, 6)}.test`);
    const [d] = await test.db.select({ domain: websites.domain }).from(websites).where(eq(websites.id, siteId));
    asMember(ws.userId, ws.orgId);

    expect(await addTarget(siteId, { url: "https://elsewhere.test/x" })).toMatchObject({ ok: false, error: expect.stringMatching(/must be on/) });
    net.gone.add(`https://${d.domain}/gone/`);
    expect(await addTarget(siteId, { url: `https://${d.domain}/gone/` })).toMatchObject({ ok: false });
    const a = await addTarget(siteId, { url: `https://${d.domain}/commercial/`, note: "Commercial video", priority: "high" });
    const b = await addTarget(siteId, { url: `${d.domain}/weddings-italy/`, priority: "low" });
    expect(a).toMatchObject({ ok: true });
    expect(b).toMatchObject({ ok: true, data: { url: `https://${d.domain}/weddings-italy/` } });
    expect(await addTarget(siteId, { url: `https://${d.domain}/commercial/` })).toMatchObject({ ok: false, error: expect.stringMatching(/already/) });

    await moveTarget(siteId, (b as { data: { id: string } }).data.id, "up");
    await setTargetPriority(siteId, (b as { data: { id: string } }).data.id, "medium");
    const network = await getPartnerNetwork(siteId);
    expect(network.targets.map((t) => [t.url.replace(`https://${d.domain}`, ""), t.priority])).toEqual([
      ["/weddings-italy/", "medium"],
      ["/commercial/", "high"],
    ]);
    // Preferences never reserve or spend anything.
    expect(await test.db.select().from(backlinkRequests).where(eq(backlinkRequests.websiteId, siteId))).toHaveLength(0);
  });

  it("a viewer can read but not change anything", async () => {
    const owner = await workspace("own");
    const siteId = await site(owner.orgId, `v-${randomUUID().slice(0, 6)}.test`);
    const viewer = await workspace("viewer");
    await test.db.insert(websiteMembers).values({ websiteId: siteId, userId: viewer.userId, role: "viewer" });
    asMember(viewer.userId, viewer.orgId);
    expect((await getPartnerNetwork(siteId)).participating).toBe(true);
    expect(await setParticipation(siteId, false)).toMatchObject({ ok: false });
    expect(await addTarget(siteId, { url: "https://x.test/" })).toMatchObject({ ok: false });
    expect(await test.db.select().from(backlinkTargets).where(eq(backlinkTargets.websiteId, siteId))).toHaveLength(0);
  });

  it("turning participation off stops new placements, releases articles with no link, keeps committed ones", async () => {
    const s = await scene();
    const plain = await article(s.host);
    await place(s); // s.post now carries a committed link
    asMember(s.hostWs.userId, s.hostWs.orgId);
    expect(await setParticipation(s.host, false)).toEqual({ ok: true, data: { released: 1, keptInReview: 1 } });
    expect((await row(plain.id)).reviewStatus).toBeNull();
    expect((await row(s.post.id)).reviewStatus).toBe("pending");
    // No new placement in (or to) a non-participating website.
    asAdmin();
    const other = await article(s.beneficiary);
    expect(
      await placeLink({
        articleId: other.id,
        expectedVersion: (await row(other.id)).reviewVersion,
        beneficiaryWebsiteId: s.host,
        targetUrl: `https://${(await test.db.select({ d: websites.domain }).from(websites).where(eq(websites.id, s.host)))[0].d}/x/`,
        anchor: "wedding videography",
        credits: 1,
        reason: "",
      }),
    ).toMatchObject({ ok: false, error: expect.stringMatching(/not taking part/) });
  });
});

describe("approval into a publishing mode", () => {
  it("approval does not approve on the site's behalf when its mode is review: the customer publishes", async () => {
    const ws = await workspace("rev");
    const host = await site(ws.orgId, `rev-${randomUUID().slice(0, 6)}.test`, { cms: true });
    await article(host, { reviewStatus: null, createdAt: new Date(Date.now() - 10 * 86_400_000) }); // an earlier, first article
    await test.db.update(websites).set({ autoPublish: false, firstArticleSentAt: new Date() }).where(eq(websites.id, host));
    const post = await article(host);
    expect(await approve(post.id)).toMatchObject({ ok: true, data: { release: "customer_publishes" } });
    // And now their Publish press works.
    asMember(ws.userId, ws.orgId);
    expect(await publishArticle(host, post.id)).toMatchObject({ ok: true });
    expect(await approveArticle({ articleId: post.id, expectedVersion: (await row(post.id)).reviewVersion, actorEmail: ADMIN }).catch((e) => e.message)).toMatch(/Already approved/);
  });
});

/* ------------------------------------------------------------------------ */
/* Monthly plan credits are granted where the balance is shown or spent       */
/* ------------------------------------------------------------------------ */

/** A paid plan with monthly backlink credits (Grow-like), attached to a website. */
async function subscribe(orgId: string, websiteId: string, monthlyCredits: number) {
  const [plan] = await test.db
    .insert(plans)
    .values({ name: "Grow", tier: `grow_${randomUUID().slice(0, 6)}`, interval: "month", priceCents: 4900, articleLimit: 30, keywordLimit: 100, siteLimit: 1, monthlyCredits })
    .returning({ id: plans.id });
  await test.db.insert(subscriptions).values({
    organizationId: orgId,
    websiteId,
    provider: "stripe",
    planId: plan.id,
    status: "active",
    currentPeriodStart: new Date(Date.now() - 2 * 86_400_000),
    currentPeriodEnd: new Date(Date.now() + 28 * 86_400_000),
  });
}

describe("monthly plan credits", () => {
  it("a new subscriber sees this month's credits on the Backlinks pages - no other page has to grant them first", async () => {
    // Before: only the old Backlinks page granted them, and it was replaced; the balance stayed 0.
    const ws = await workspace("grow");
    const siteId = await site(ws.orgId, `grow-${randomUUID().slice(0, 6)}.test`);
    await subscribe(ws.orgId, siteId, 10);
    expect(await balance(ws.orgId)).toBe(0);

    const credits = await workspaceCredits(ws.orgId);
    expect(credits).toMatchObject({ balance: 10, available: 10 });
    // Showing it again grants nothing more.
    await workspaceCredits(ws.orgId);
    expect(await balance(ws.orgId)).toBe(10);
  });

  it("an administrator can place a link for a customer whose only credits are this month's plan credits", async () => {
    const s = await scene({ credits: 0 });
    await subscribe(s.benWs.orgId, s.beneficiary, 10);
    const current = await row(s.post.id);
    await expect(
      placeManagedLink({
        articleId: s.post.id,
        expectedVersion: current.reviewVersion,
        beneficiaryWebsiteId: s.beneficiary,
        targetUrl: `https://${s.benDomain}/wedding-videography/`,
        anchor: "wedding videography",
        credits: 1,
        actorEmail: ADMIN,
      }),
    ).resolves.toMatchObject({ placementId: expect.any(String) });
    expect(await balance(s.benWs.orgId)).toBe(10);
    expect(await reserved(s.benWs.orgId)).toBe(1);
  });
});

/* ------------------------------------------------------------------------ */
/* No hosting cap; up to 15 links an article; approving with none is normal   */
/* ------------------------------------------------------------------------ */

const PHRASES = [
  "alpha weddings", "bravo portraits", "charlie films", "delta ceremonies", "echo receptions", "foxtrot venues",
  "golf elopements", "hotel ballrooms", "india destinations", "juliet bouquets", "kilo gowns", "lima albums",
  "mike drones", "november editing", "oscar lighting", "papa studios",
];
const MANY = PHRASES.map((p) => `<p>Our guide covers ${p} in detail for every couple.</p>`).join("");

/** A receiving website in its own workspace, with credits. */
async function beneficiary(tag: string) {
  const ws = await workspace(`b-${tag}`);
  const id = await site(ws.orgId, `${tag}-${randomUUID().slice(0, 6)}.test`);
  await grant(ws.orgId, 5);
  return { id, domain: await domainOf(id) };
}

async function placeOn(articleId: string, websiteId: string, domain: string, anchor: string) {
  const current = await row(articleId);
  return placeLink({
    articleId,
    expectedVersion: current.reviewVersion,
    beneficiaryWebsiteId: websiteId,
    targetUrl: `https://${domain}/page/`,
    anchor,
    credits: 1,
    reason: "Relevant mention",
  });
}

describe("no hosting cap, up to 15 links an article", () => {
  it("a website hosts as many links as administrators place - the old monthly cap limits nothing", async () => {
    const hostWs = await workspace("host-uncapped");
    const host = await site(hostWs.orgId, `unc-${randomUUID().slice(0, 6)}.test`, { cms: true });
    // Even a stored cap of 0 (it used to refuse the first link) no longer applies.
    await test.db.update(networkSites).set({ monthlyCap: 0 }).where(eq(networkSites.websiteId, host));
    // Five links this month across five articles - the old cap allowed three.
    for (let i = 0; i < 5; i++) {
      const post = await article(host);
      const b = await beneficiary(`many${i}`);
      expect(await placeOn(post.id, b.id, b.domain, "wedding videography")).toMatchObject({ ok: true });
    }
    const queue = await getReviewQueue();
    expect(queue.sites.find((s) => s.websiteId === host)?.hosted).toEqual({ today: 5, thisMonth: 5 });
  });

  it("an article carries up to 15 network links; the 16th is refused", async () => {
    const hostWs = await workspace("host-15");
    const host = await site(hostWs.orgId, `h15-${randomUUID().slice(0, 6)}.test`, { cms: true });
    const post = await article(host, { body: MANY });
    for (let i = 0; i < 15; i++) {
      const b = await beneficiary(`f${i}`);
      expect(await placeOn(post.id, b.id, b.domain, PHRASES[i])).toMatchObject({ ok: true });
    }
    const extra = await beneficiary("f15");
    expect(await placeOn(post.id, extra.id, extra.domain, PHRASES[15])).toMatchObject({
      ok: false,
      error: expect.stringMatching(/at most 15 network links/),
    });
    expect(await test.db.select().from(placements).where(eq(placements.articleId, post.id))).toHaveLength(15);

    // The review screen: 15 of 15, and the host's pacing counts.
    const review = await getReviewArticle(post.id);
    expect(review?.limits.maxPerArticle).toBe(15);
    expect(review?.hostUsage).toEqual({ today: 15, thisMonth: 15 });
  });

  it("marks a website already linked in the article, so it is not offered twice", async () => {
    const s = await scene();
    expect(await place(s)).toMatchObject({ ok: true });
    const review = await getReviewArticle(s.post.id);
    const candidate = review?.candidates.find((c) => c.websiteId === s.beneficiary);
    expect(candidate?.linkedHere).toBe(true);
    expect(review?.candidates.filter((c) => c.websiteId !== s.beneficiary).every((c) => !c.linkedHere)).toBe(true);
  });

  it("approving with no network links is an ordinary approval, recorded as such", async () => {
    const ws = await workspace("zero");
    const host = await site(ws.orgId, `zero-${randomUUID().slice(0, 6)}.test`, { cms: true });
    const post = await article(host, { plannedFor: new Date(Date.now() - 86_400_000) });
    expect(await approve(post.id)).toMatchObject({ ok: true, data: { placements: 0 } });
    const audit = await test.db.select().from(adminAuditLog).where(eq(adminAuditLog.targetId, post.id));
    expect(audit.map((a) => a.summary)).toContain("Approved an article with no network links");
  });
});

describe("links to URLs with a query string", () => {
  const query = (domain: string) => `https://${domain}/wedding-videography/?utm_source=repget&utm_medium=partner`;

  it("places and approves a link whose URL has '&' (stored in the HTML as &amp;)", async () => {
    const s = await scene();
    expect(await place(s, { targetUrl: query(s.benDomain) })).toMatchObject({ ok: true });
    expect((await row(s.post.id)).bodyHtml).toContain("&amp;utm_medium=partner");
    expect(await approve(s.post.id)).toMatchObject({ ok: true, data: { placements: 1 } });
  });

  it("refuses a page the article already links to, query string and all", async () => {
    const s = await scene();
    const existing = query(s.benDomain).replace("&", "&amp;");
    await test.db
      .update(articles)
      .set({ bodyHtml: `${BODY}<p>See <a href="${existing}">their films</a>.</p>` })
      .where(eq(articles.id, s.post.id));
    expect(await place(s, { targetUrl: query(s.benDomain) })).toMatchObject({
      ok: false,
      error: expect.stringMatching(/already links to that page/),
    });
  });
});

describe("hosted counts, for pacing by hand", () => {
  it("counts links placed today and this month; withdrawn, removed and earlier months are not counted", async () => {
    const hostWs = await workspace("host-counts");
    const host = await site(hostWs.orgId, `cnt-${randomUUID().slice(0, 6)}.test`, { cms: true });
    const post = await article(host, { body: MANY });
    for (let i = 0; i < 5; i++) {
      const b = await beneficiary(`cnt${i}`);
      expect(await placeOn(post.id, b.id, b.domain, PHRASES[i])).toMatchObject({ ok: true });
    }
    const [withdrawn, removed, unverified, lastMonth, earlier] = await test.db
      .select({ id: placements.id })
      .from(placements)
      .where(eq(placements.articleId, post.id));

    await test.db.update(placements).set({ status: "cancelled" }).where(eq(placements.id, withdrawn.id));
    await test.db.update(placements).set({ status: "removed" }).where(eq(placements.id, removed.id));
    // Published but not seen by the checker yet: it may well be on the page.
    await test.db.update(placements).set({ status: "unverified" }).where(eq(placements.id, unverified.id));
    // Dates on the database's own clock - the one that stamps created_at.
    await test.db
      .update(placements)
      .set({ createdAt: sql`date_trunc('month', localtimestamp) - interval '1 day'` })
      .where(eq(placements.id, lastMonth.id));
    await test.db
      .update(placements)
      .set({ createdAt: sql`greatest(date_trunc('month', localtimestamp), date_trunc('day', localtimestamp) - interval '1 hour')` })
      .where(eq(placements.id, earlier.id));
    // On the 1st of the month "earlier this month" can only be today.
    const firstDay = await test.db.execute(
      sql`select date_trunc('day', localtimestamp) = date_trunc('month', localtimestamp) as first`,
    );
    const first = ((firstDay as unknown as { rows: Array<{ first: boolean }> }).rows ??
      (firstDay as unknown as Array<{ first: boolean }>))[0].first;

    const expected = { today: first ? 2 : 1, thisMonth: 2 };
    const queue = await getReviewQueue();
    expect(queue.sites.find((s) => s.websiteId === host)?.hosted).toEqual(expected);
    expect((await getReviewArticle(post.id))?.hostUsage).toEqual(expected);
  });
});
