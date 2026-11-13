import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  articles,
  backlinkRequests,
  calendarItems,
  gscPageMetrics,
  linkChecks,
  searchImportCoverage,
  spendReservations,
  integrationKeys,
  integrations,
  networkSites,
  placements,
  platformControls,
  publicationDispatches,
  publishLogs,
  websites,
  articleVersions,
} from "@/lib/db/schema";
import { member, user } from "@/lib/db/auth-tables";
import { createTestDb, type TestDb } from "@/test/db";
import { seedWebsite } from "@/test/fixtures";

/**
 * The customer's article delivery under the two_step_articles switch (ticket
 * of 2026-11-05, docs/two-step-articles.md), with the real publish job, plugin
 * routes and server actions on a real Postgres engine, and a simulated CMS:
 *
 *   before the team's approval, nothing of the article reaches the customer on
 *   any path, and nothing can send it;
 *   after it, that exact revision is ready, with one notification and one
 *   Publish, which works once; a later change goes back to the team.
 *
 * Every secret below is a marker a leak would carry.
 */

const state = vi.hoisted(() => ({ db: null as unknown, session: null as unknown }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }) }));
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
vi.mock("@/lib/websites/fetch-page", () => ({
  fetchPage: vi.fn(async () => new Response("<html><title>x</title></html>", { status: 200, headers: { "content-type": "text/html" } })),
}));
const inngestMock = vi.hoisted(() => ({
  send: vi.fn(async () => ({ ids: ["evt"] })),
  createFunction: vi.fn((config: unknown, handler: unknown) => ({ config, handler })),
}));
vi.mock("@/inngest/client", () => ({ inngest: inngestMock }));
const jobs = vi.hoisted(() => ({ queued: [] as { name: string; data: Record<string, unknown> }[] }));
vi.mock("@/inngest/send", () => ({
  queueJob: vi.fn(async (job: { name: string; data: Record<string, unknown> }) => {
    jobs.queued.push(job);
  }),
}));
vi.mock("@/lib/plugin/sync", () => ({
  nudgePluginIfDue: vi.fn(async () => "nothing-due"),
  recordSyncUrl: vi.fn(),
  triggerPluginSync: vi.fn(async () => "unreachable"),
}));
const bell = vi.hoisted(() => ({ sent: [] as { type: string; title: string; body?: string | null; href?: string | null }[] }));
vi.mock("@/lib/notifications/create", () => ({
  notify: vi.fn(async (message: { type: string; title: string }) => {
    bell.sent.push(message);
    return true;
  }),
}));
vi.mock("@/lib/email/lifecycle-triggers", () => ({ emailArticlePublished: vi.fn(), emailArticleFailed: vi.fn() }));
vi.mock("@/lib/publishing/credentials", () => ({
  resolveIntegration: vi.fn(async () => ({ integrationId: cms.integrationId, providerId: "wordpress" })),
  loadCredentialsById: vi.fn(async () => ({ integrationId: cms.integrationId, providerId: "wordpress", credentials: {} })),
}));
vi.mock("@/lib/net/safe-fetch", () => ({
  safeFetch: vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "content-type": "image/jpeg" } })),
}));
vi.mock("@/lib/images/storage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/images/storage")>()),
  isImageStorageConfigured: () => true,
  listWebsiteImages: vi.fn(async () => library.images),
  storeArticleImage: vi.fn(async () => "https://storage.test/new.jpg"),
  deleteArticleImage: vi.fn(),
}));
const images = vi.hoisted(() => ({ configured: false, generated: [] as string[] }));
vi.mock("@/lib/images/generate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/images/generate")>()),
  isImageGenerationConfigured: () => images.configured,
  generateArticleImage: vi.fn(async (title: string) => {
    images.generated.push(title);
    return { data: Buffer.from([1, 2, 3]), contentType: "image/jpeg", alt: "made", costUsd: 0.04 };
  }),
}));
vi.mock("@/lib/images/scene", () => ({ describeArticleScene: vi.fn(async () => null) }));
const emails = vi.hoisted(() => ({ built: [] as unknown[] }));
vi.mock("@/lib/email/lifecycle", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/email/lifecycle")>()),
  sendLifecycleEmail: vi.fn(async (request: { build: () => Promise<unknown> }) => {
    emails.built.push(await request.build());
    return { status: "sent" };
  }),
}));
const translator = vi.hoisted(() => ({ inputs: [] as { title: string; bodyHtml: string }[] }));
vi.mock("@/lib/articles/translate-article", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/articles/translate-article")>()),
  translateArticle: vi.fn(async (input: { title: string; bodyHtml: string }) => {
    translator.inputs.push(input);
    return { title: "T", slug: "t", metaDescription: null, imageAlt: null, bodyHtml: "<p>T</p>", usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: 0, calls: 0 } };
  }),
}));
const library = vi.hoisted(() => ({ images: [] as { url: string; name: string }[] }));
const cms = vi.hoisted(() => ({
  integrationId: "",
  posts: [] as { title: string; contentHtml: string; status: string; featuredMediaId?: string | null; featuredImageUrl?: string | null }[],
  error: null as null | Error,
}));
vi.mock("@/lib/publishing/registry", () => {
  const provider = {
    id: "wordpress",
    name: "WordPress",
    fields: [],
    testConnection: vi.fn(async () => ({ siteName: "Site", accountLabel: "me" })),
    uploadMedia: vi.fn(async () => ({ id: "m1", url: "https://site.test/m1.jpg" })),
    createPost: vi.fn(async (_c: unknown, input: { title: string; contentHtml: string; status: string }) => {
      if (cms.error) throw cms.error;
      cms.posts.push(input);
      return { remoteId: String(cms.posts.length), remoteUrl: `https://site.test/?p=${cms.posts.length}`, status: input.status };
    }),
    // Not saved on the site since it was sent. See lib/publishing/overwrite-guard.ts.
    readRemote: vi.fn(async () => ({ modifiedAt: "2020-01-01T00:00:00Z", hash: null, status: "publish", rawContent: null })),
    updatePost: vi.fn(async (_c: unknown, remoteId: string, input: { title: string; contentHtml: string; status: string }) => {
      cms.posts.push(input);
      return { remoteId, remoteUrl: `https://site.test/?p=${remoteId}`, status: input.status };
    }),
  };
  return { getProvider: () => provider, listProviders: () => [provider], providerInfo: () => ({}) };
});
const key = vi.hoisted(() => ({ websiteId: "" }));
vi.mock("@/lib/plugin/keys", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/plugin/keys")>()),
  resolveIntegrationKey: vi.fn(async () => ({ keyId: "k", websiteId: key.websiteId, organizationId: "o", websiteDomain: "host.test" })),
  recordPluginVersion: vi.fn(async () => undefined),
}));

import { GET as pluginArticles } from "@/app/api/plugin/articles/route";
import { POST as pluginPublished } from "@/app/api/plugin/published/route";
import { getReviewQueue } from "@/lib/admin/network";
import { discoverPublishedPlacements } from "@/lib/backlinks/placements";
import { pluginUpdates } from "@/lib/plugin/protocol";
import { updateAnyArticle } from "@/lib/admin/actions";
import { partnerLinksInText } from "@/app/(site)/(app)/websites/[websiteId]/articles/[articleId]/article-data";
import { actionErrorText } from "@/app/(site)/(app)/websites/[websiteId]/articles/[articleId]/failure-copy";
import { translateLiveArticle } from "@/lib/articles/translations";
import { alertIfNewlyUnfollowed } from "@/lib/backlinks/nofollow";
import { getMessages } from "@/lib/i18n/messages";
import { CONTENT_COPY } from "@/lib/i18n/content-improvements";
import { NEXT_ACTIONS_COPY } from "@/lib/i18n/next-actions";
import { coveredTopics } from "@/lib/sites/covered";
import { creditsFor } from "@/lib/backlinks/managed";
import { ARTICLE_DELIVERY, articleTitleText, draftRefusalText, PREPARING_TITLE } from "@/lib/i18n/article-delivery";
import { emailArticleFailed } from "@/lib/email/lifecycle-triggers";
import { triggerPluginSync } from "@/lib/plugin/sync";
import { queueArticleForCalendarItem } from "@/inngest/functions/generate-article";
import { checkLimit } from "@/lib/usage";
import { publishArticleJob } from "@/inngest/functions/publish-article";
import { publishDueDrafts } from "@/inngest/functions/scheduled-articles";
import { ResearchPanel } from "@/components/articles/research-panel";
import { findTrafficChanges } from "@/lib/articles/decay";
import { deleteArticle, getArticle, listArticles, regenerateArticle, updateArticle } from "@/lib/articles/actions";
import { listReusableImages, removeArticleImage, updateArticleImageAlt } from "@/lib/articles/image-actions";
import { prepareStoredArticle } from "@/lib/articles/internal-links";
import { notifyReady, releaseAfterApproval } from "@/lib/articles/release";
import { approveArticleResearch } from "@/lib/articles/research-actions";
import { checkReleasable, customerTitleSql, DRAFT_REFUSALS, draftRefusalOf, PLUGIN_DRAFT_MESSAGE, PLUGIN_UPDATE_NEEDED, PREPARING_MESSAGE, publicFieldSql, publicRevisionSql, revisionToStore, reviewHash, sendableRevision, storedRevision, type StoredRevision } from "@/lib/articles/review";
import { listGiven } from "@/lib/backlinks/actions";
import { approveArticle, editReviewedArticle, removeManagedPlacement, reopenArticle } from "@/lib/backlinks/managed";
import { setParticipation } from "@/lib/backlinks/network-settings";
import { READ_TOOLS } from "@/lib/chat/tools";
import { getNextActions } from "@/lib/dashboard/next-actions";
import { getDashboardOverview } from "@/lib/dashboard/overview";
import { dueArticlesForPlugin } from "@/lib/plugin/due";
import { connectProvider, publishArticle } from "@/lib/publishing/actions";
import { switchControl, writeControl } from "@/lib/publishing/controls";
import { claimDispatch, IN_FLIGHT_TIMEOUT_MS, type DispatchTrigger } from "@/lib/publishing/dispatch";
import { pendingFirstArticle } from "@/lib/publishing/policy";
import { ProviderError } from "@/lib/publishing/provider";
import { listLinks } from "@/lib/reporting/backlinks";
import { getTasks } from "@/lib/tasks/tasks";
import { NEW_SITE_DEFAULTS } from "@/lib/websites/new-site-defaults";

const BODY = "SECRETBODY";
const NOTE = "SECRETNOTE";
const LINK = "secretpartner.example";
const IMAGE = "SECRETIMAGE";
const STAFF_TITLE = "SECRETTITLE";
const PLANNED = "Planned topic";
const ADMIN = "admin@repget.test";

let test: TestDb;
beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});
beforeEach(async () => {
  cms.posts.length = 0;
  cms.error = null;
  jobs.queued.length = 0;
  bell.sent.length = 0;
  emails.built.length = 0;
  translator.inputs.length = 0;
  inngestMock.send.mockClear();
  library.images = [];
  await twoStep(true);
});
afterEach(async () => {
  await test.db.delete(platformControls);
});

const twoStep = (enabled: boolean) => writeControl("two_step_articles", enabled, { reason: "test", actor: "test" }, test.db);

async function customer(orgId: string) {
  const id = `u_${randomUUID()}`;
  await test.db.insert(user).values({ id, name: "C", email: `${id}@e.test`, emailVerified: true, createdAt: new Date(), updatedAt: new Date() });
  await test.db.insert(member).values({ id: `m_${randomUUID()}`, organizationId: orgId, userId: id, role: "owner", createdAt: new Date() });
  state.session = { user: { id, email: `${id}@e.test`, emailVerified: true }, session: { id: `s_${id}`, activeOrganizationId: orgId } };
}

type SceneOptions = {
  autoPublish?: boolean;
  publishAs?: "live" | "draft";
  connected?: boolean;
  plugin?: boolean;
  /** Days from today; undefined: no date, no plan entry. */
  plannedInDays?: number;
  firstArticlePending?: boolean;
  fields?: Partial<typeof articles.$inferInsert>;
};

/** A website and one article the team is working on: edited title, a staff note in its research, a placed link. */
async function scene(options: SceneOptions = {}) {
  const { orgId, websiteId } = await seedWebsite(test);
  await test.db
    .update(websites)
    .set({
      autoPublish: options.autoPublish ?? false,
      publishAs: options.publishAs ?? "live",
      firstArticleSentAt: options.firstArticlePending ? null : new Date(),
    })
    .where(eq(websites.id, websiteId));
  if (options.connected !== false && !options.plugin) {
    const [integration] = await test.db.insert(integrations).values({ websiteId, kind: "wordpress", status: "connected" }).returning();
    cms.integrationId = integration.id;
  }
  if (options.plugin) {
    await test.db.insert(integrationKeys).values({ websiteId, keyHash: randomUUID(), keyPrefix: "k", lastUsedAt: new Date() });
    key.websiteId = websiteId;
  }
  const [item] = await test.db
    .insert(calendarItems)
    .values({ websiteId, title: PLANNED, scheduledFor: options.plannedInDays === undefined ? null : new Date(Date.now() + options.plannedInDays * 86_400_000) })
    .returning();
  const [post] = await test.db
    .insert(articles)
    .values({
      websiteId,
      calendarItemId: item.id,
      title: STAFF_TITLE,
      slug: `secretslug-${randomUUID().slice(0, 6)}`,
      status: "draft",
      bodyHtml: `<p>${BODY} with <a href="https://${LINK}/page">secret anchor</a>.</p>`,
      metaDescription: "SECRETEXCERPT",
      imageUrl: `https://storage.test/${websiteId}/x/${IMAGE}.jpg`,
      imageAlt: "SECRETALT",
      wordCount: 77,
      reviewStatus: "pending",
      researchReviewRequired: true,
      research: {
        version: 1, mode: "on", status: "ready", question: NOTE, intent: "informational", businessAngle: NOTE,
        subquestions: [], claims: [], sources: [], checkedAt: new Date().toISOString(), warnings: [NOTE],
      },
      ...options.fields,
    })
    .returning();
  await customer(orgId);
  return { orgId, websiteId, post };
}

/** A partner paying for a link placed in this article. */
async function placeLink(s: { websiteId: string; post: { id: string } }) {
  const partner = await seedWebsite(test);
  const target = `https://${LINK}/page`;
  const [request] = await test.db.insert(backlinkRequests).values({ websiteId: partner.websiteId, targetUrl: target }).returning();
  await test.db.insert(placements).values({ requestId: request.id, hostWebsiteId: s.websiteId, articleId: s.post.id, anchor: "secret anchor", status: "drafted", managed: true });
  return target;
}

const row = async (id: string) => (await test.db.select().from(articles).where(eq(articles.id, id)))[0];

async function approve(id: string) {
  const current = await row(id);
  await approveArticle({ articleId: id, expectedVersion: current.reviewVersion, expectedHash: reviewHash(current), actorEmail: ADMIN });
}

/** What the admin's Approve does, after its commit (approveForRelease). */
async function approveAndRelease(id: string) {
  await approve(id);
  const outcome = await releaseAfterApproval(id);
  await notifyReady(id, outcome);
  return outcome;
}

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
function steps() {
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
function runJob(s: { orgId: string; websiteId: string; post: { id: string } }, trigger: DispatchTrigger = "manual", using = steps()) {
  return (publishArticleJob as unknown as { handler: (ctx: unknown) => Promise<{ held?: string | null; remoteUrl?: string | null }> }).handler({
    event: { id: `evt-${randomUUID()}`, data: { articleId: s.post.id, websiteId: s.websiteId, organizationId: s.orgId, status: "publish", trigger } },
    step: using,
    logger,
  });
}
/** The daily release scans every website: did it pick this article? */
async function dailyReleaseSends(articleId: string) {
  inngestMock.send.mockClear();
  await publishDueDrafts();
  return (inngestMock.send.mock.calls as unknown as [{ data: { articleId: string; trigger: string; status: string } }][])
    .map(([event]) => event.data)
    .filter((data) => data.articleId === articleId);
}
const pluginPull = (version = "1.10.0") => pluginArticles(new NextRequest("https://app.test/api/plugin/articles", { headers: { "x-integration-key": "k", "x-repget-plugin-version": version } }));
const leakIn = (value: unknown) => {
  const text = JSON.stringify(value);
  return ["SECRET", LINK, "secret anchor"].filter((marker) => text.includes(marker));
};
const form = (revision: string) => {
  const data = new FormData();
  data.set("revision", revision);
  data.set("reviewed", "yes");
  return data;
};

/** 28 days of healthy clicks, then 28 days at a tenth, ending yesterday: every page here is declining. */
async function seedDecline(websiteId: string, pages: string[]) {
  const day = (back: number) => new Date(Date.now() - back * 86_400_000).toISOString().slice(0, 10);
  const rows = pages.flatMap((pageUrl) =>
    Array.from({ length: 56 }, (_, i) => ({
      websiteId,
      pageUrl,
      date: day(i + 1),
      clicks: i < 28 ? 1 : 10,
      impressions: 100,
      position: 5,
    })),
  );
  await test.db.insert(gscPageMetrics).values(rows);
  await test.db.insert(searchImportCoverage).values({ websiteId, startDate: day(56), endDate: day(1) });
}

/* ------------------------------------------------------------------------ */

describe("before the team's approval: nothing reaches the customer", () => {
  it("the article page's read is empty, and says the team has it", async () => {
    const s = await scene();
    const article = await getArticle(s.websiteId, s.post.id);
    expect(leakIn(article)).toEqual([]);
    expect(article).toMatchObject({ preparing: "team", title: PLANNED, bodyHtml: null, metaDescription: null, slug: null, imageUrl: null, wordCount: null });
  });

  it("the article list, its search and the calendar it feeds", async () => {
    const s = await scene();
    const list = await listArticles(s.websiteId);
    expect(leakIn(list)).toEqual([]);
    expect(list[0]).toMatchObject({ status: "preparing", title: PLANNED, wordCount: null, slug: null });
    expect(Object.keys(list[0])).not.toContain("reviewStatus");
  });

  it("the dashboard's card and its next actions: no approval is asked", async () => {
    const s = await scene({ plannedInDays: 0 });
    const overview = await getDashboardOverview({ websiteId: s.websiteId, ownerOrgId: s.orgId, showCredits: false });
    expect(overview?.todaysArticle.ok).toBe(true);
    const card = overview?.todaysArticle.ok ? overview.todaysArticle.data : null;
    expect(leakIn(card)).toEqual([]);
    expect(card).toMatchObject({ state: "preparing", title: PLANNED, imageUrl: null });

    const actions = await getNextActions(s.websiteId, s.orgId, false);
    expect(actions.map((action) => action.kind)).not.toContain("research");
    expect(actions.map((action) => action.kind)).not.toContain("readyToPublish");
    expect(leakIn(actions)).toEqual([]);

    const tasks = await getTasks(s.websiteId, s.orgId, false);
    expect(tasks?.work.find((task) => task.id === "drafts")?.count).toBe(0);
  });

  it("a held article whose rewrite failed: the failed task names only its planned title", async () => {
    const s = await scene({ fields: { status: "failed" } });
    const task = (await getNextActions(s.websiteId, s.orgId, false)).find((action) => action.kind === "failed");
    expect(task?.detail).toBe(PLANNED);
    await twoStep(false);
    expect((await getNextActions(s.websiteId, s.orgId, false)).find((action) => action.kind === "failed")?.detail).toBe(STAFF_TITLE);
  });

  it("a held article's failed publish: the same, in the publish-failed task", async () => {
    const s = await scene();
    await test.db.insert(publishLogs).values({ articleId: s.post.id, status: "failed", error: "x" });
    const task = (await getNextActions(s.websiteId, s.orgId, false)).find((action) => action.kind === "publishFailed");
    expect(task?.detail).toBe(PLANNED);
  });

  it("with no plan entry the reads return the marker, which every language says, and the chat gets words", async () => {
    const s = await scene({ fields: { status: "failed" } });
    await test.db.update(articles).set({ calendarItemId: null }).where(eq(articles.id, s.post.id));
    expect((await getArticle(s.websiteId, s.post.id))?.title).toBe(PREPARING_TITLE);
    expect((await listArticles(s.websiteId))[0].title).toBe(PREPARING_TITLE);
    const task = (await getNextActions(s.websiteId, s.orgId, false)).find((action) => action.kind === "failed");
    expect(task?.detail).toBe(PREPARING_TITLE);

    const words = (["en", "es", "fr", "it", "de"] as const).map((locale) => articleTitleText(PREPARING_TITLE, locale));
    expect(words).toEqual(["Article in preparation", "Artículo en preparación", "Article en préparation", "Articolo in preparazione", "Artikel in Vorbereitung"]);
    expect(articleTitleText("A real title", "de")).toBe("A real title");
    expect(ARTICLE_DELIVERY.de.preparingTitle).toBe(words[4]);

    const ctx = { websiteId: s.websiteId, ownerOrgId: s.orgId, userId: "u", access: "owner", domain: "d.test", brandName: null, locale: "de", level: "paid" };
    const said = JSON.stringify(await READ_TOOLS.find((tool) => tool.name === "get_articles")!.run(ctx as never, {} as never));
    expect(said).toContain("Artikel in Vorbereitung");
    expect(said).not.toContain("preparing");
  });

  it("the AI chat's tools", async () => {
    const s = await scene({ plannedInDays: 0 });
    const ctx = { websiteId: s.websiteId, ownerOrgId: s.orgId, userId: "u", access: "owner", domain: "d.test", brandName: null, locale: "en", level: "paid" };
    for (const name of ["get_articles", "get_overview"]) {
      const tool = READ_TOOLS.find((candidate) => candidate.name === name)!;
      expect(leakIn(await tool.run(ctx as never, {} as never))).toEqual([]);
    }
  });

  it("the backlink lists: the team's link in the draft is not listed for the host", async () => {
    const s = await scene();
    await placeLink(s);
    expect(leakIn(await listGiven(s.websiteId))).toEqual([]);
    expect(await listGiven(s.websiteId)).toEqual([]);
    const page = await listLinks("given", { websiteId: s.websiteId, orgId: s.orgId }, {
      tab: "all", type: "all", q: "", from: null, to: null, issue: null, sort: "date", dir: "desc", page: 1, pageSize: 25,
    } as never);
    expect(leakIn(page)).toEqual([]);
    expect(page.rows).toEqual([]);
    expect(page.total).toBe(0);
  });

  it("the traffic report, with search data on the page: a held rewrite of a live page is listed by address, with no title or link", async () => {
    const url = `https://site.test/held-${randomUUID().slice(0, 6)}`;
    const control = `https://site.test/live-${randomUUID().slice(0, 6)}`;
    const s = await scene({ fields: { publishedUrl: url } });
    const [live] = await test.db
      .insert(articles)
      .values({ websiteId: s.websiteId, title: "A live article", status: "published", publishedUrl: control, bodyHtml: "<p>Live</p>" })
      .returning();
    await seedDecline(s.websiteId, [url, control]);

    const report = await findTrafficChanges(s.websiteId);
    expect(report.dataStatus).toBe("ready");
    const page = (address: string) => report.losingClicks.find((change) => change.pageUrl === address);
    // Both pages decline, so both are in the report: the filter is what differs.
    expect(page(url)).toMatchObject({ clicksBefore: 280, clicksAfter: 28, articleId: null, articleTitle: null });
    expect(page(control)).toMatchObject({ articleId: live.id, articleTitle: "A live article" });
    expect(leakIn(report)).toEqual([]);

    await twoStep(false);
    const off = await findTrafficChanges(s.websiteId);
    expect(off.losingClicks.find((change) => change.pageUrl === url)).toMatchObject({ articleId: s.post.id, articleTitle: STAFF_TITLE });
  });

  it("the traffic report, with a stored revision: the approved title, never the working copy's", async () => {
    const url = `https://site.test/stored-${randomUUID().slice(0, 6)}`;
    const s = await scene({ fields: { publishedUrl: url, status: "published", title: "The approved title" } });
    await approve(s.post.id);
    await test.db.update(articles).set({ title: STAFF_TITLE, reviewStatus: "pending", reviewApprovedHash: null }).where(eq(articles.id, s.post.id));
    await seedDecline(s.websiteId, [url]);
    const report = await findTrafficChanges(s.websiteId);
    expect(report.losingClicks.find((change) => change.pageUrl === url)).toMatchObject({ articleId: s.post.id, articleTitle: "The approved title" });
    expect(leakIn(report)).toEqual([]);
  });

  it("the sources panel renders nothing", async () => {
    const s = await scene();
    await expect(ResearchPanel({ websiteId: s.websiteId, articleId: s.post.id, locale: "en" })).resolves.toBeNull();
  });

  it("the picture library leaves out its pictures", async () => {
    const s = await scene();
    library.images = [
      { url: `https://storage.test/${s.websiteId}/${s.post.id}/held.jpg`, name: "held.jpg" },
      { url: `https://storage.test/${s.websiteId}/other-article/fine.jpg`, name: "fine.jpg" },
    ];
    expect(await listReusableImages(s.websiteId)).toEqual({ ok: true, data: { images: [library.images[1]] } });
  });

  it("no action works on it: edit, rewrite, picture, source approval, publish", async () => {
    const s = await scene();
    const refused = { ok: false, error: PREPARING_MESSAGE };
    expect(await updateArticle(s.websiteId, s.post.id, { bodyHtml: "<p>Mine</p>" })).toEqual(refused);
    expect(await regenerateArticle(s.websiteId, s.post.id)).toEqual(refused);
    expect(await updateArticleImageAlt(s.websiteId, s.post.id, "x")).toEqual(refused);
    expect(await removeArticleImage(s.websiteId, s.post.id)).toEqual(refused);
    expect(await publishArticle(s.websiteId, s.post.id)).toEqual(refused);
    await expect(approveArticleResearch(s.websiteId, s.post.id, form(reviewHash(s.post)))).rejects.toThrow(/Nothing is needed from you/);
    const after = await row(s.post.id);
    expect(after.bodyHtml).toBe(s.post.bodyHtml);
    expect(after.researchApprovedHash).toBeNull();
    expect(jobs.queued).toEqual([]);
  });

  it("a viewer or another tenant gets no more than the owner", async () => {
    const s = await scene();
    const other = await seedWebsite(test);
    await customer(other.orgId);
    await expect(getArticle(s.websiteId, s.post.id)).rejects.toThrow();
  });

  it("the WordPress plugin's pull hands out nothing, with a press recorded or not", async () => {
    const s = await scene({ plugin: true, autoPublish: true, firstArticlePending: true });
    const empty = await (await pluginPull()).json();
    expect(leakIn(empty)).toEqual([]);
    expect(empty.articles).toEqual([]);
    expect(await dueArticlesForPlugin(s.websiteId, 5)).toEqual([]);

    await test.db.update(articles).set({ publishRequested: "publish" }).where(eq(articles.id, s.post.id));
    expect((await (await pluginPull()).json()).articles).toEqual([]);
    expect(await test.db.select().from(publicationDispatches).where(eq(publicationDispatches.articleId, s.post.id))).toEqual([]);
  });

  it("no publishing path sends it: every trigger, the daily release, the CMS", async () => {
    const s = await scene({ autoPublish: true, plannedInDays: -1, firstArticlePending: true });
    const triggers: DispatchTrigger[] = ["manual", "automatic", "first_article", "approval", "connection", "plugin", "legacy"];
    for (const trigger of triggers) {
      expect(await claimDispatch({ articleId: s.post.id, websiteId: s.websiteId, channel: trigger === "plugin" ? "plugin" : "direct", trigger })).toEqual({ ok: false, reason: "pending_review" });
      expect(await runJob(s, trigger)).toEqual({ held: "pending_review" });
    }
    expect(await dailyReleaseSends(s.post.id)).toEqual([]);
    expect(cms.posts).toEqual([]);
    expect(bell.sent).toEqual([]);
    expect((await row(s.post.id)).status).toBe("draft");
  });

  it("leaving the Partner Network does not release it", async () => {
    const s = await scene();
    await test.db.insert(networkSites).values({ websiteId: s.websiteId, acceptingLinks: true, monthlyCap: 3 });
    expect(await setParticipation(s.websiteId, false)).toEqual({ ok: true, data: { released: 0, keptInReview: 1 } });
    expect((await row(s.post.id)).reviewStatus).toBe("pending");
  });
});

/* ------------------------------------------------------------------------ */

describe("after the team's approval: the exact revision, one notification, one Publish", () => {
  it("the team's edits are in it, nobody else approves anything, and it is ready", async () => {
    const s = await scene();
    const target = await placeLink(s);
    const before = await row(s.post.id);
    await editReviewedArticle({
      articleId: s.post.id,
      expectedVersion: before.reviewVersion,
      expectedHash: reviewHash(before),
      title: "The finished title",
      slug: "finished",
      metaDescription: "Finished excerpt",
      bodyHtml: `<p>The finished text with <a href="${target}">secret anchor</a>.</p>`,
      actorEmail: ADMIN,
    });
    expect(await approveAndRelease(s.post.id)).toBe("customer_publishes");

    const article = await getArticle(s.websiteId, s.post.id);
    const stored = await row(s.post.id);
    expect(article).toMatchObject({ preparing: null, title: "The finished title", bodyHtml: stored.bodyHtml, metaDescription: "Finished excerpt" });
    expect(stored.reviewApprovedHash).toBe(reviewHash(stored));
    expect(stored.researchApprovedHash).toBe(reviewHash(stored));
    expect(await checkReleasable(s.post.id)).toEqual({ ok: true });
    expect((await listArticles(s.websiteId))[0].status).toBe("ready");
    expect((await getNextActions(s.websiteId, s.orgId, false)).map((action) => action.kind)).toContain("readyToPublish");

    expect(bell.sent).toHaveLength(1);
    expect(bell.sent[0]).toMatchObject({ type: "article.ready", title: "Your article is ready to publish", href: `/websites/${s.websiteId}/articles/${s.post.id}` });
  });

  it("approving again sends nothing more", async () => {
    const s = await scene();
    await approveAndRelease(s.post.id);
    await expect(approve(s.post.id)).rejects.toThrow("Already approved");
    expect(bell.sent).toHaveLength(1);
  });

  it("the customer publishes once: exactly that revision goes out, and a second press is refused", async () => {
    const s = await scene();
    await approveAndRelease(s.post.id);
    expect(await publishArticle(s.websiteId, s.post.id)).toEqual({ ok: true, data: { publishedUrl: null, queued: false } });
    expect(jobs.queued).toHaveLength(1);
    expect(jobs.queued[0].data).toMatchObject({ trigger: "manual", status: "publish" });

    const approved = await row(s.post.id);
    const result = await runJob(s);
    expect(result).toMatchObject({ status: "publish", remoteUrl: "https://site.test/?p=1" });
    expect(cms.posts).toHaveLength(1);
    expect(cms.posts[0].title).toBe(approved.title);
    expect(cms.posts[0].contentHtml).toContain(BODY);
    expect(cms.posts[0].status).toBe("publish");
    expect((await row(s.post.id)).status).toBe("published");

    expect(await publishArticle(s.websiteId, s.post.id)).toEqual({ ok: false, error: "This exact version is already on the website." });
    expect(await runJob(s)).toEqual({ held: "already_sent" });
    expect(cms.posts).toHaveLength(1);
  });

  it("a send changes nothing in the approved revision: the article keeps its picture, its hash and its approval", async () => {
    const s = await scene();
    await approveAndRelease(s.post.id);
    const approved = await row(s.post.id);
    await runJob(s);
    const after = await row(s.post.id);
    expect(after.imageUrl).toBe(approved.imageUrl);
    expect(after.reviewApprovedHash).toBe(reviewHash(after));
    expect(reviewHash(after)).toBe(reviewHash(approved));
    const [sent] = await test.db.select().from(publicationDispatches).where(eq(publicationDispatches.articleId, s.post.id));
    expect(sent.revisionHash).toBe(reviewHash(approved));
    expect(storedRevision(after.approvedRevision)?.hash).toBe(sent.revisionHash);
  });


  it("a press is always Publish: a crafted draft press still sends one live post", async () => {
    const s = await scene();
    await approveAndRelease(s.post.id);
    await publishArticle(s.websiteId, s.post.id, "draft");
    expect(jobs.queued[0].data.status).toBe("publish");
  });

  it("a CMS failure is recorded and said; the customer can press again", async () => {
    const s = await scene();
    await approveAndRelease(s.post.id);
    cms.error = new ProviderError("The site refused it", "permission", 422);
    await expect(runJob(s)).rejects.toThrow("The site refused it");
    const logs = await test.db.select().from(publishLogs).where(eq(publishLogs.articleId, s.post.id));
    expect(logs[0]).toMatchObject({ status: "failed" });
    expect((await row(s.post.id)).status).toBe("draft");

    cms.error = null;
    expect((await publishArticle(s.websiteId, s.post.id)).ok).toBe(true);
    await expect(runJob(s)).resolves.toMatchObject({ status: "publish" });
    expect(cms.posts).toHaveLength(1);
  });

  it("not connected: the notification and the refusal say so, and nothing claims it is live", async () => {
    const s = await scene({ connected: false });
    expect(await approveAndRelease(s.post.id)).toBe("customer_publishes");
    expect(bell.sent[0].body).toContain("Connect your website");
    expect(await publishArticle(s.websiteId, s.post.id)).toEqual({ ok: false, error: "Connect somewhere to publish to first" });
    const after = await row(s.post.id);
    expect(after).toMatchObject({ status: "draft", publishedUrl: null, publishRequested: null });
    expect(jobs.queued).toEqual([]);
  });

  it("through the plugin: the press is collected once, and only after approval", async () => {
    const s = await scene({ plugin: true });
    await approveAndRelease(s.post.id);
    expect((await (await pluginPull()).json()).articles).toEqual([]);
    expect((await publishArticle(s.websiteId, s.post.id)).ok).toBe(true);
    const first = await (await pluginPull()).json();
    expect(first.articles).toHaveLength(1);
    expect(first.articles[0]).toMatchObject({ status: "publish", title: STAFF_TITLE });
    expect(first.articles[0].html).toContain(BODY);
    expect((await (await pluginPull()).json()).articles).toEqual([]);
  });
});

/* ------------------------------------------------------------------------ */

describe("the first article", () => {
  it("is not released by the first-article exception, the connection, or the daily release", async () => {
    const s = await scene({ firstArticlePending: true, connected: false });
    expect(await pendingFirstArticle(s.websiteId)).toBeNull();
    await approve(s.post.id);
    expect(await pendingFirstArticle(s.websiteId)).toBeNull();

    // Connecting a CMS.
    expect((await connectProvider(s.websiteId, "wordpress", {})).ok).toBe(true);
    expect(jobs.queued).toEqual([]);

    // The daily release, and any job a previous build queued.
    expect(await dailyReleaseSends(s.post.id)).toEqual([]);
    expect(await runJob(s, "first_article")).toEqual({ held: "auto_publish_off" });
    expect(await runJob(s, "connection")).toEqual({ held: "auto_publish_off" });
    expect(cms.posts).toEqual([]);
  });

  it("goes out by the customer's press, which then records the first article as sent", async () => {
    const s = await scene({ firstArticlePending: true });
    expect(await approveAndRelease(s.post.id)).toBe("customer_publishes");
    expect(jobs.queued).toEqual([]);
    await runJob(s);
    expect(cms.posts).toHaveLength(1);
    const [site] = await test.db.select().from(websites).where(eq(websites.id, s.websiteId));
    expect(site.firstArticleSentAt).not.toBeNull();
  });

  it("through the plugin too: not in the feed until pressed", async () => {
    const s = await scene({ firstArticlePending: true, plugin: true });
    await approve(s.post.id);
    expect(await dueArticlesForPlugin(s.websiteId, 5)).toEqual([]);
  });

  it("with the switch off, the exception is as it was", async () => {
    const s = await scene({ firstArticlePending: true, fields: { reviewStatus: null, researchReviewRequired: false } });
    await twoStep(false);
    expect(await pendingFirstArticle(s.websiteId)).toEqual({ id: s.post.id });
    expect(await releaseAfterApproval(s.post.id)).toBe("queued");
    expect(jobs.queued[0].data).toMatchObject({ status: "publish" });
  });
});

/* ------------------------------------------------------------------------ */

describe("publishing the customer chose: automatic and scheduled", () => {
  it("automatic, due: sent at approval, no second 'ready' message, told when live", async () => {
    const s = await scene({ autoPublish: true, plannedInDays: 0 });
    expect(await approveAndRelease(s.post.id)).toBe("queued");
    expect(bell.sent).toEqual([]);
    expect(jobs.queued[0].data).toMatchObject({ trigger: "approval", status: "publish" });
    await expect(runJob(s, "approval")).resolves.toMatchObject({ status: "publish" });
    expect(bell.sent.map((message) => message.type)).toEqual(["article.published"]);
  });

  it("automatic, planned ahead: ready now, held until its day, sooner only by a press", async () => {
    const s = await scene({ autoPublish: true, plannedInDays: 3 });
    expect(await approveAndRelease(s.post.id)).toBe("waiting_for_day");
    expect(jobs.queued).toEqual([]);
    expect(bell.sent[0].body).toContain("on its planned day");
    expect(await dailyReleaseSends(s.post.id)).toEqual([]);
    expect(await runJob(s, "automatic")).toEqual({ held: "not_due" });
    expect(cms.posts).toEqual([]);
    await expect(runJob(s, "manual")).resolves.toMatchObject({ status: "publish" });
    expect(cms.posts).toHaveLength(1);
  });

  it("automatic: its day comes, and the daily release sends the approved revision", async () => {
    const s = await scene({ autoPublish: true, plannedInDays: 3 });
    await approve(s.post.id);
    await test.db.update(calendarItems).set({ scheduledFor: new Date(Date.now() - 86_400_000) }).where(eq(calendarItems.id, s.post.calendarItemId!));
    expect(await dailyReleaseSends(s.post.id)).toEqual([expect.objectContaining({ trigger: "automatic", status: "publish" })]);
  });

  it("automatic, as drafts: its own setting still makes a CMS draft; the customer's press makes it live", async () => {
    const s = await scene({ autoPublish: true, publishAs: "draft", plannedInDays: 0 });
    expect(await approveAndRelease(s.post.id)).toBe("queued");
    expect(jobs.queued[0].data).toMatchObject({ status: "draft" });
    await expect(runJob(s, "approval")).resolves.toMatchObject({ status: "draft" });
    expect(cms.posts[0].status).toBe("draft");
    expect((await publishArticle(s.websiteId, s.post.id)).ok).toBe(true);
    await expect(runJob(s, "manual")).resolves.toMatchObject({ status: "publish" });
    expect(cms.posts.map((post) => post.status)).toEqual(["draft", "publish"]);
  });

  it("a new website starts automatic and live, with the switch on or off", () => {
    expect(NEW_SITE_DEFAULTS).toMatchObject({ autoPublish: true, publishAs: "live" });
  });

  it("a new website's first article needs no press: approved and due, the exact revision goes live by itself", async () => {
    const s = await scene({ firstArticlePending: true, autoPublish: true, plannedInDays: 0 });
    expect(await approveAndRelease(s.post.id)).toBe("queued");
    expect(jobs.queued).toHaveLength(1);
    expect(jobs.queued[0].data).toMatchObject({ articleId: s.post.id, status: "publish", trigger: "approval" });
    await expect(runJob(s, "approval")).resolves.toMatchObject({ status: "publish" });
    expect(cms.posts).toHaveLength(1);
    const [row] = await test.db.select().from(articles).where(eq(articles.id, s.post.id));
    const [dispatch] = await test.db.select().from(publicationDispatches).where(eq(publicationDispatches.articleId, s.post.id));
    expect(dispatch.revisionHash).toBe(row.reviewApprovedHash);
    const [site] = await test.db.select().from(websites).where(eq(websites.id, s.websiteId));
    expect(site.firstArticleSentAt).not.toBeNull();
  });

  it("a new website's article planned for later waits for its day, then the daily release sends it, with no press", async () => {
    const s = await scene({ firstArticlePending: true, autoPublish: true, plannedInDays: 3 });
    expect(await approveAndRelease(s.post.id)).toBe("waiting_for_day");
    expect(jobs.queued).toEqual([]);
    expect(await dailyReleaseSends(s.post.id)).toEqual([]);
    const past = new Date(Date.now() - 86_400_000);
    await test.db.update(calendarItems).set({ scheduledFor: past }).where(eq(calendarItems.id, s.post.calendarItemId!));
    expect(await dailyReleaseSends(s.post.id)).toHaveLength(1);
  });

  it("an automatic website sends nothing the team has not approved, however due", async () => {
    const s = await scene({ firstArticlePending: true, autoPublish: true, plannedInDays: 0 });
    expect(await dailyReleaseSends(s.post.id)).toEqual([]);
    await expect(runJob(s, "automatic")).resolves.toHaveProperty("held");
    expect(cms.posts).toEqual([]);
  });

  it("an edit after approval on an automatic website does not reach the site: the approved revision does, or nothing", async () => {
    const s = await scene({ firstArticlePending: true, autoPublish: true, plannedInDays: 3 });
    expect(await approveAndRelease(s.post.id)).toBe("waiting_for_day");
    const [approved] = await test.db.select().from(articles).where(eq(articles.id, s.post.id));
    await test.db.update(articles).set({ bodyHtml: "<p>NOT APPROVED</p>", reviewStatus: "pending" }).where(eq(articles.id, s.post.id));
    const past = new Date(Date.now() - 86_400_000);
    await test.db.update(calendarItems).set({ scheduledFor: past }).where(eq(calendarItems.id, s.post.calendarItemId!));
    await runJob(s, "automatic");
    expect(cms.posts).toHaveLength(1);
    expect(JSON.stringify(cms.posts[0])).not.toContain("NOT APPROVED");
    const [dispatch] = await test.db.select().from(publicationDispatches).where(eq(publicationDispatches.articleId, s.post.id));
    expect(dispatch.revisionHash).toBe(approved.reviewApprovedHash);
  });

  it("automatic, not connected: ready, and told to connect; nothing pretends", async () => {
    const s = await scene({ autoPublish: true, plannedInDays: 0, connected: false });
    expect(await approveAndRelease(s.post.id)).toBe("nothing_connected");
    expect(bell.sent[0].body).toContain("Connect your website");
  });
});

/* ------------------------------------------------------------------------ */

describe("a later change, and stale work", () => {
  it("the customer's edit goes back to the team: they keep the approved version and Publish, are asked nothing, and get one message when it is ready again", async () => {
    const s = await scene();
    await approveAndRelease(s.post.id);
    const approved = await row(s.post.id);
    expect((await updateArticle(s.websiteId, s.post.id, { bodyHtml: "<p>My own sentence.</p>" })).ok).toBe(true);

    const held = await row(s.post.id);
    expect(held).toMatchObject({ reviewStatus: "pending", reviewApprovedHash: null, bodyHtml: "<p>My own sentence.</p>" });
    expect(await getArticle(s.websiteId, s.post.id)).toMatchObject({ preparing: null, withTeam: true, bodyHtml: approved.bodyHtml, title: approved.title });
    expect((await listArticles(s.websiteId))[0]).toMatchObject({ status: "ready", title: approved.title });
    // Refused while the team has the working copy: it would overwrite their work.
    expect(await updateArticle(s.websiteId, s.post.id, { bodyHtml: "<p>Again</p>" })).toEqual({ ok: false, error: PREPARING_MESSAGE });
    expect(bell.sent).toHaveLength(1);

    await approveAndRelease(s.post.id);
    expect(bell.sent).toHaveLength(2);
    expect(await getArticle(s.websiteId, s.post.id)).toMatchObject({ preparing: null, withTeam: false, bodyHtml: "<p>My own sentence.</p>" });
  });


  it("a save that changed nothing keeps the approval", async () => {
    const s = await scene();
    await approveAndRelease(s.post.id);
    const { title } = await row(s.post.id);
    expect((await updateArticle(s.websiteId, s.post.id, { title })).ok).toBe(true);
    expect((await row(s.post.id)).reviewStatus).toBe("approved");
  });

  it("removing a placed link: back to the team, whose approval refuses until it is resolved", async () => {
    const s = await scene();
    await placeLink(s);
    await approve(s.post.id);
    await updateArticle(s.websiteId, s.post.id, { bodyHtml: "<p>No link now.</p>" });
    expect((await row(s.post.id)).reviewStatus).toBe("pending");
    await expect(approve(s.post.id)).rejects.toThrow(/placed link is missing/);
  });

  it("no 'publish this' task while the team has a newer copy", async () => {
    const s = await scene();
    await approve(s.post.id);
    expect((await getNextActions(s.websiteId, s.orgId, false)).map((action) => action.kind)).toContain("readyToPublish");
    const approved = await row(s.post.id);
    await reopenArticle({ articleId: s.post.id, expectedVersion: approved.reviewVersion, actorEmail: ADMIN });
    expect((await getNextActions(s.websiteId, s.orgId, false)).map((action) => action.kind)).not.toContain("readyToPublish");
  });

  it("the team reopening an approved article: the customer keeps the approved version, and the team's edit stays private", async () => {
    const s = await scene();
    await approve(s.post.id);
    const approved = await row(s.post.id);
    await reopenArticle({ articleId: s.post.id, expectedVersion: approved.reviewVersion, actorEmail: ADMIN });
    const reopened = await row(s.post.id);
    await editReviewedArticle({
      articleId: s.post.id, expectedVersion: reopened.reviewVersion, expectedHash: reviewHash(reopened),
      title: "WORKINGTITLE", slug: "working", metaDescription: "WORKINGEXCERPT", bodyHtml: `<p>WORKINGBODY <a href="https://${LINK}/page">secret anchor</a></p>`, actorEmail: ADMIN,
    });
    const article = await getArticle(s.websiteId, s.post.id);
    expect(article).toMatchObject({ preparing: null, withTeam: true, title: approved.title, bodyHtml: approved.bodyHtml, metaDescription: approved.metaDescription });
    expect(JSON.stringify([article, await listArticles(s.websiteId), await getNextActions(s.websiteId, s.orgId, false)])).not.toMatch(/WORKING/);
  });


  it("an approval that no longer matches (stale): the working copy reaches nothing, and what can go out is the approved revision, by its hash", async () => {
    const s = await scene({ autoPublish: true, plannedInDays: -1 });
    await approve(s.post.id);
    const approved = await row(s.post.id);
    await test.db.update(articles).set({ bodyHtml: "<p>Changed behind the gate SECRET</p>" }).where(eq(articles.id, s.post.id));
    expect(await getArticle(s.websiteId, s.post.id)).toMatchObject({ withTeam: true, bodyHtml: approved.bodyHtml });
    expect(JSON.stringify(await listArticles(s.websiteId))).not.toContain("Changed behind");
    await expect(runJob(s, "automatic")).resolves.toMatchObject({ status: "publish" });
    expect(cms.posts).toHaveLength(1);
    expect(cms.posts[0].contentHtml).toContain(BODY);
    expect(cms.posts[0].contentHtml).not.toContain("Changed behind the gate");
    const [sent] = await test.db.select().from(publicationDispatches).where(eq(publicationDispatches.articleId, s.post.id));
    expect(sent.revisionHash).toBe(reviewHash(approved));
  });


  it("a retry after an edit sends the approved revision it was prepared from, never the edit", async () => {
    const s = await scene();
    await approve(s.post.id);
    const using = steps();
    await using.run("load-article", async () => {
      const first = await row(s.post.id);
      return {
        held: null, revisionHash: reviewHash(first), linkFindings: [], integrationId: cms.integrationId, providerId: "wordpress", remoteId: null, industry: null, image: null,
        post: { title: first.title, contentHtml: first.bodyHtml, slug: first.slug, excerpt: first.metaDescription, status: "publish" },
      };
    });
    await updateArticle(s.websiteId, s.post.id, { bodyHtml: "<p>Newer text</p>" });
    await expect(runJob(s, "manual", using)).resolves.toMatchObject({ status: "publish" });
    expect(cms.posts).toHaveLength(1);
    expect(cms.posts[0].contentHtml).toContain(BODY);
    expect(cms.posts[0].contentHtml).not.toContain("Newer text");
  });


  it("a press made for an older revision does not carry the new one out: the customer presses again", async () => {
    const s = await scene();
    await approve(s.post.id);
    const using = steps();
    await using.run("load-article", async () => {
      const first = await row(s.post.id);
      return {
        held: null, revisionHash: reviewHash(first), linkFindings: [], integrationId: cms.integrationId, providerId: "wordpress", remoteId: null, industry: null, image: null,
        post: { title: first.title, contentHtml: first.bodyHtml, slug: first.slug, excerpt: first.metaDescription, status: "publish" },
      };
    });
    await updateArticle(s.websiteId, s.post.id, { bodyHtml: "<p>Newer text</p>" });
    await approve(s.post.id);

    expect(await runJob(s, "manual", using)).toEqual({ held: "revision_changed" });
    expect(cms.posts).toEqual([]);
    expect(inngestMock.send).not.toHaveBeenCalled();
    expect((await row(s.post.id)).reviewStatus).toBe("approved");
  });

  it("a recorded plugin press does not survive a new approval", async () => {
    const s = await scene({ plugin: true });
    await approve(s.post.id);
    await publishArticle(s.websiteId, s.post.id);
    expect((await row(s.post.id)).publishRequested).toBe("publish");
    await updateArticle(s.websiteId, s.post.id, { bodyHtml: "<p>Newer</p>" });
    await approve(s.post.id);
    expect((await row(s.post.id)).publishRequested).toBeNull();
    expect((await (await pluginPull()).json()).articles).toEqual([]);
  });

  it("a dead link at sending: nothing is repaired under the approval; it goes out as approved and is on record with the send", async () => {
    const s = await scene({ fields: { bodyHtml: '<p>Text with <a href="#">a dead link</a>.</p>' } });
    await approve(s.post.id);
    const approved = await row(s.post.id);
    const checked = await prepareStoredArticle(s.post.id, s.websiteId, { budgetMs: 0 });
    expect(checked).toMatchObject({ changed: false, html: approved.bodyHtml });
    expect(checked?.findings.some((finding) => finding.outcome !== "kept" && finding.outcome !== "unverified")).toBe(true);

    await expect(runJob(s)).resolves.toMatchObject({ status: "publish" });
    const after = await row(s.post.id);
    expect(after).toMatchObject({ bodyHtml: approved.bodyHtml, reviewStatus: "approved", reviewApprovedHash: reviewHash(approved) });
    const [sent] = await test.db.select().from(publicationDispatches).where(eq(publicationDispatches.articleId, s.post.id));
    expect(sent.revisionHash).toBe(reviewHash(approved));
    expect((sent.requestSnapshot as { linkDefects?: unknown[] }).linkDefects?.length).toBeGreaterThan(0);
    expect(cms.posts[0].contentHtml).toContain("a dead link");
  });

  it("with the switch off, the repair is as it was", async () => {
    const s = await scene({ fields: { bodyHtml: '<p>Text with <a href="#">a dead link</a>.</p>', researchReviewRequired: false } });
    await twoStep(false);
    await approve(s.post.id);
    const checked = await prepareStoredArticle(s.post.id, s.websiteId, { budgetMs: 0 });
    expect(checked?.changed).toBe(true);
    expect((await row(s.post.id)).bodyHtml).not.toContain('href="#"');
  });


  it("a change to a post already live: the customer keeps what is live, and approval republishes nothing", async () => {
    const s = await scene({ autoPublish: true, fields: { status: "published", publishedUrl: "https://site.test/?p=9", reviewStatus: "pending", researchReviewRequired: false } });
    await approve(s.post.id);
    const published = await row(s.post.id);
    bell.sent.length = 0;
    expect((await updateArticle(s.websiteId, s.post.id, { bodyHtml: "<p>A later change</p>" })).ok).toBe(true);
    expect(await getArticle(s.websiteId, s.post.id)).toMatchObject({ withTeam: true, status: "published", bodyHtml: published.bodyHtml });

    expect(await approveAndRelease(s.post.id)).toBe("customer_publishes");
    expect(jobs.queued).toEqual([]);
    expect(bell.sent[0].title).toMatch(/update is ready/);
    expect(await getArticle(s.websiteId, s.post.id)).toMatchObject({ withTeam: false, bodyHtml: "<p>A later change</p>" });
  });


  it("an older live post with held sources goes to the team at the customer's press, not to the customer", async () => {
    const s = await scene({ fields: { status: "published", publishedUrl: "https://site.test/?p=9", reviewStatus: null } });
    expect(await publishArticle(s.websiteId, s.post.id)).toEqual({ ok: false, error: PREPARING_MESSAGE });
    expect((await row(s.post.id)).reviewStatus).toBe("pending");
  });
});

/* ------------------------------------------------------------------------ */

describe("the stored article title never reaches a customer output", () => {
  const GENERATED = "GENMARKERTITLE";
  const EDITED = "STAFFMARKERTITLE";
  const noMarker = (value: unknown) => {
    const text = JSON.stringify(value);
    expect(text).not.toContain(GENERATED);
    expect(text).not.toContain(EDITED);
  };

  /** Every customer-facing read of this article's title that takes no AI or provider. */
  async function allOutputs(s: { orgId: string; websiteId: string; post: { id: string } }) {
    const ctx = { websiteId: s.websiteId, ownerOrgId: s.orgId, userId: "u", access: "owner", domain: "d.test", brandName: null, locale: "en", level: "paid" };
    const query = { tab: "all", type: "all", q: "", from: null, to: null, issue: null, sort: "date", dir: "desc", page: 1, pageSize: 25 } as never;
    const overview = await getDashboardOverview({ websiteId: s.websiteId, ownerOrgId: s.orgId, showCredits: false });
    return {
      article: await getArticle(s.websiteId, s.post.id),
      list: await listArticles(s.websiteId),
      todays: overview?.todaysArticle,
      wins: overview?.wins,
      best: overview?.bestArticles,
      actions: await getNextActions(s.websiteId, s.orgId, false),
      tasks: await getTasks(s.websiteId, s.orgId, false),
      chatArticles: await READ_TOOLS.find((tool) => tool.name === "get_articles")!.run(ctx as never, {} as never),
      chatOverview: await READ_TOOLS.find((tool) => tool.name === "get_overview")!.run(ctx as never, {} as never),
      given: await listGiven(s.websiteId),
      links: await listLinks("given", { websiteId: s.websiteId, orgId: s.orgId }, query),
      traffic: await findTrafficChanges(s.websiteId),
      covered: await coveredTopics(s.websiteId),
      bell: bell.sent,
    };
  }

  async function staffEditTitle(id: string) {
    const current = await row(id);
    await editReviewedArticle({
      articleId: id, expectedVersion: current.reviewVersion, expectedHash: reviewHash(current),
      title: EDITED, slug: "edited", metaDescription: "Edited", bodyHtml: current.bodyHtml ?? "<p>Text</p>", actorEmail: ADMIN,
    });
  }

  it("while awaiting approval: only the customer's own plan topic, whether generation or staff set the title", async () => {
    const s = await scene({ plannedInDays: 0, fields: { title: GENERATED } });
    await placeLink(s);
    let outputs = await allOutputs(s);
    noMarker(outputs);
    expect(outputs.article?.title).toBe(PLANNED);

    await staffEditTitle(s.post.id);
    expect((await row(s.post.id)).title).toBe(EDITED);
    outputs = await allOutputs(s);
    noMarker(outputs);
    expect(outputs.article?.title).toBe(PLANNED);
    expect(outputs.list[0].title).toBe(PLANNED);
    // The plan row is untouched by the edit.
    const [plan] = await test.db.select().from(calendarItems).where(eq(calendarItems.id, s.post.calendarItemId!));
    expect(plan.title).toBe(PLANNED);

    await test.db.update(articles).set({ status: "failed" }).where(eq(articles.id, s.post.id));
    outputs = await allOutputs(s);
    noMarker(outputs);
    expect(outputs.actions.find((action) => action.kind === "failed")?.detail).toBe(PLANNED);
  });

  it("no plan row (a translation, a removed topic): only the translated fallback", async () => {
    const s = await scene({ fields: { title: GENERATED, status: "failed" } });
    await test.db.update(articles).set({ calendarItemId: null }).where(eq(articles.id, s.post.id));
    const outputs = await allOutputs(s);
    noMarker(outputs);
    expect(outputs.article?.title).toBe(PREPARING_TITLE);
    expect(outputs.list[0].title).toBe(PREPARING_TITLE);
    expect(JSON.stringify(outputs.chatArticles)).toContain("Article in preparation");
    expect(outputs.covered.writtenTitles).toEqual([]);
  });

  it("a live article being re-edited: the approved title on every output, and in the bell, email, nofollow notice and translation", async () => {
    const url = `https://site.test/live-${randomUUID().slice(0, 6)}`;
    const s = await scene({ plannedInDays: 0, fields: { title: "The approved title", status: "published", publishedUrl: url, firstLiveAt: new Date() } });
    const target = await placeLink(s);
    await approve(s.post.id);
    await seedDecline(s.websiteId, [url]);
    await test.db.update(placements).set({ status: "live", liveUrl: url }).where(eq(placements.articleId, s.post.id));
    await test.db.update(articles).set({ title: EDITED, bodyHtml: `<p>WORKINGBODY <a href="${target}">secret anchor</a></p>`, metaDescription: "WORKINGEXCERPT", imageUrl: "https://storage.test/WORKING.jpg", reviewStatus: "pending", reviewApprovedHash: null }).where(eq(articles.id, s.post.id));

    const outputs = await allOutputs(s);
    noMarker(outputs);
    expect(JSON.stringify(outputs)).not.toContain("WORKING");
    expect(outputs.article).toMatchObject({ title: "The approved title", status: "published", withTeam: true });
    expect(outputs.traffic.losingClicks[0].articleTitle).toBe("The approved title");
    expect(outputs.given[0].articleTitle).toBe("The approved title");

    // What the public outputs (social, video) read: the same two expressions.
    const [publicRead] = await test.db.select({ title: customerTitleSql, summary: publicFieldSql(articles.metaDescription, "metaDescription"), image: publicFieldSql(articles.imageUrl, "imageUrl") }).from(articles).where(eq(articles.id, s.post.id));
    expect(publicRead.title).toBe("The approved title");
    expect(JSON.stringify(publicRead)).not.toContain("WORKING");

    // The failure email, built by the real trigger.
    const real = await vi.importActual<typeof import("@/lib/email/lifecycle-triggers")>("@/lib/email/lifecycle-triggers");
    await real.emailArticleFailed({ organizationId: s.orgId, websiteId: s.websiteId, articleId: s.post.id, error: "x" });
    expect(JSON.stringify(emails.built)).toContain("The approved title");
    noMarker(emails.built);

    // The nofollow notice, in the bell.
    const [placement] = await test.db.select().from(placements).where(eq(placements.articleId, s.post.id));
    await test.db.insert(linkChecks).values({ placementId: placement.id, alive: true, outcome: "alive", rel: "nofollow" });
    expect(await alertIfNewlyUnfollowed(placement.id)).toBe(true);
    expect(JSON.stringify(bell.sent)).toContain("The approved title");
    noMarker(bell.sent);

    // A translation is made from what is live.
    await translateLiveArticle({ articleId: s.post.id, websiteId: s.websiteId, organizationId: s.orgId, language: "it" });
    expect(translator.inputs[0]).toMatchObject({ title: "The approved title" });
    expect(translator.inputs[0].bodyHtml).not.toContain("WORKING");
  });

  it("the plugin's report and the published notice name the revision sent, not the row's title by then", async () => {
    const s = await scene({ fields: { title: "The approved title" } });
    await approve(s.post.id);
    await test.db.update(articles).set({ title: EDITED, reviewStatus: "pending", reviewApprovedHash: null }).where(eq(articles.id, s.post.id));
    await expect(runJob(s)).resolves.toMatchObject({ status: "publish" });
    expect(cms.posts[0].title).toBe("The approved title");
    expect(bell.sent.map((message) => message.title)).toEqual(['"The approved title" is live']);
    noMarker(bell.sent);
  });

  it("with the switch off, reads are as they were", async () => {
    const s = await scene({ fields: { title: GENERATED } });
    await twoStep(false);
    expect((await getArticle(s.websiteId, s.post.id))?.title).toBe(GENERATED);
    expect((await listArticles(s.websiteId))[0].title).toBe(GENERATED);
  });
});

describe("every string added for the flow, in every language", () => {
  const locales = ["en", "es", "fr", "it", "de"] as const;

  it("the delivery copy: every key in all five, and translated", () => {
    const keys = Object.keys(ARTICLE_DELIVERY.en) as (keyof typeof ARTICLE_DELIVERY.en)[];
    expect(keys.length).toBeGreaterThan(20);
    for (const locale of locales) {
      expect(Object.keys(ARTICLE_DELIVERY[locale]).sort()).toEqual([...keys].sort());
      for (const key of keys) {
        expect(ARTICLE_DELIVERY[locale][key].trim().length).toBeGreaterThan(0);
        if (locale !== "en") expect(ARTICLE_DELIVERY[locale][key], `${locale}.${key}`).not.toBe(ARTICLE_DELIVERY.en[key]);
      }
    }
  });

  it("the status word and the next action", () => {
    const words = locales.map((locale) => getMessages(locale).app.status.preparing);
    expect(new Set(words).size).toBe(5);
    expect(new Set(locales.map((locale) => NEXT_ACTIONS_COPY[locale].readyToPublish)).size).toBe(5);
    expect(new Set(locales.map((locale) => NEXT_ACTIONS_COPY[locale].readyToPublishHelp)).size).toBe(5);
    // The page merges these with CONTENT_COPY: a shared key would show the wrong words (it did, under "ready").
    for (const locale of locales) {
      const merged = { ...NEXT_ACTIONS_COPY[locale], ...CONTENT_COPY[locale] };
      expect(merged.readyToPublish).toBe(NEXT_ACTIONS_COPY[locale].readyToPublish);
    }
  });

  it("the server's refusals, as the page says them", () => {
    for (const locale of locales) {
      const t = getMessages(locale).app;
      const copy = { t: t.editor, tWorkspace: t.workspace, tImage: t.image, delivery: ARTICLE_DELIVERY[locale] };
      expect(actionErrorText(PREPARING_MESSAGE, copy)).toBe(ARTICLE_DELIVERY[locale].errPreparing);
      expect(actionErrorText("This exact version is already on the website.", copy)).toBe(ARTICLE_DELIVERY[locale].errAlreadyOnSite);
      expect(actionErrorText("Already being delivered.", copy)).toBe(ARTICLE_DELIVERY[locale].errAlreadyDelivering);
    }
  });

  it("the ready notification, in the workspace owner's language", async () => {
    for (const locale of locales) {
      const s = await scene();
      const members = await test.db.select().from(member).where(eq(member.organizationId, s.orgId));
      await test.db.update(user).set({ locale }).where(eq(user.id, members[0].userId));
      bell.sent.length = 0;
      await approveAndRelease(s.post.id);
      expect(bell.sent[0].title).toBe(ARTICLE_DELIVERY[locale].notifyReady);
    }
  });
});

describe("staff edits stay private, and every path checks the exact revision it sends", () => {
  /** Approved, then reopened and edited by the team. */
  async function reEdited(options: SceneOptions = {}) {
    const s = await scene(options);
    await approve(s.post.id);
    const approved = await row(s.post.id);
    await reopenArticle({ articleId: s.post.id, expectedVersion: approved.reviewVersion, actorEmail: ADMIN });
    const reopened = await row(s.post.id);
    await test.db.update(articles).set({ title: "WORKINGTITLE", bodyHtml: "<p>WORKINGBODY</p>", metaDescription: "WORKINGEXCERPT" }).where(eq(articles.id, reopened.id));
    return { ...s, approved };
  }
  const sentHash = async (id: string) => (await test.db.select().from(publicationDispatches).where(eq(publicationDispatches.articleId, id)))[0]?.revisionHash;

  it("Publish during re-editing is on, and sends the last approved revision: direct job", async () => {
    const s = await reEdited();
    expect(await publishArticle(s.websiteId, s.post.id)).toEqual({ ok: true, data: { publishedUrl: null, queued: false } });
    await expect(runJob(s)).resolves.toMatchObject({ status: "publish" });
    expect(cms.posts[0].title).toBe(s.approved.title);
    expect(cms.posts[0].contentHtml).toContain(BODY);
    expect(cms.posts[0].contentHtml).not.toContain("WORKING");
    expect(await sentHash(s.post.id)).toBe(reviewHash(s.approved));
    // The working copy is still the team's, unapproved, and sending it did not change that.
    expect(await row(s.post.id)).toMatchObject({ title: "WORKINGTITLE", reviewStatus: "pending", status: "published" });
    expect(await getArticle(s.websiteId, s.post.id)).toMatchObject({ withTeam: true, status: "published", title: s.approved.title });
  });

  it("plugin pull and a recorded press send the last approved revision", async () => {
    const s = await reEdited({ plugin: true });
    expect((await publishArticle(s.websiteId, s.post.id)).ok).toBe(true);
    const pulled = (await (await pluginPull()).json()).articles;
    expect(pulled).toHaveLength(1);
    expect(pulled[0]).toMatchObject({ title: s.approved.title, status: "publish" });
    expect(pulled[0].html).toContain(BODY);
    expect(JSON.stringify(pulled)).not.toContain("WORKING");
    expect(pulled[0].dispatch.revision).toBe(reviewHash(s.approved));
  });

  it("the daily release and automatic modes send it on its day, and not before", async () => {
    const due = await reEdited({ autoPublish: true, plannedInDays: -1 });
    expect(await dailyReleaseSends(due.post.id)).toHaveLength(1);
    await expect(runJob(due, "automatic")).resolves.toMatchObject({ status: "publish" });
    expect(cms.posts.at(-1)?.contentHtml).not.toContain("WORKING");
    expect(await sentHash(due.post.id)).toBe(reviewHash(due.approved));

    const early = await reEdited({ autoPublish: true, plannedInDays: 3 });
    expect(await dailyReleaseSends(early.post.id)).toEqual([]);
    expect(await runJob(early, "automatic")).toEqual({ held: "not_due" });
  });

  it("the general admin editor on a live article: private, on what is live, for the customer, Publish and a translation", async () => {
    vi.stubEnv("ADMIN_EMAILS", ADMIN);
    const s = await scene({ fields: { status: "published", publishedUrl: "https://site.test/?p=7", bodyHtml: "<p>As published</p>", researchReviewRequired: false } });
    await approve(s.post.id);
    const published = await row(s.post.id);
    const customerSession = state.session;
    state.session = { user: { id: "u_admin", email: ADMIN, emailVerified: true }, session: { id: "s_admin", activeOrganizationId: s.orgId } };
    expect((await updateAnyArticle(s.post.id, { title: "WORKINGTITLE", bodyHtml: "<p>WORKINGBODY</p>" })).ok).toBe(true);
    state.session = customerSession;
    vi.unstubAllEnvs();

    expect(await row(s.post.id)).toMatchObject({ reviewStatus: "pending", title: "WORKINGTITLE" });
    const article = await getArticle(s.websiteId, s.post.id);
    expect(article).toMatchObject({ withTeam: true, status: "published", title: published.title });
    expect(article?.bodyHtml).toBe("<p>As published</p>");
    expect(JSON.stringify(await listArticles(s.websiteId))).not.toContain("WORKING");

    await expect(runJob(s)).resolves.toMatchObject({ status: "publish" });
    expect(cms.posts[0].contentHtml).toContain("As published");
    expect(cms.posts[0].contentHtml).not.toContain("WORKING");
  });

  it("the general admin editor on an article from before the flow goes to the team too", async () => {
    vi.stubEnv("ADMIN_EMAILS", ADMIN);
    const s = await scene({ fields: { status: "published", publishedUrl: "https://site.test/?p=8", reviewStatus: null, bodyHtml: "<p>As published</p>", researchReviewRequired: false } });
    const baseline = await row(s.post.id);
    await test.db.update(articles).set({ approvedRevision: revisionToStore(baseline, "published") }).where(eq(articles.id, s.post.id));
    const customerSession = state.session;
    state.session = { user: { id: "u_admin", email: ADMIN, emailVerified: true }, session: { id: "s_admin", activeOrganizationId: s.orgId } };
    await updateAnyArticle(s.post.id, { bodyHtml: "<p>WORKINGBODY</p>" });
    state.session = customerSession;
    vi.unstubAllEnvs();
    expect((await row(s.post.id)).reviewStatus).toBe("pending");
    expect((await getArticle(s.websiteId, s.post.id))?.bodyHtml).toBe("<p>As published</p>");
  });

  it("a partner link the team placed only in the working copy is not named to the page showing the approved revision", () => {
    const placedInWorkingCopy = "https://partner.example/new";
    const inApproved = "https://partner.example/old";
    expect(partnerLinksInText([placedInWorkingCopy, inApproved], `<p><a href="${inApproved}">kept</a></p>`)).toEqual([inApproved]);
  });

  it("a stored revision whose hash no longer matches is not a revision: nothing shown as approved, nothing sent", async () => {
    const s = await reEdited();
    const stored = (await row(s.post.id)).approvedRevision as StoredRevision;
    await test.db.update(articles).set({ approvedRevision: { ...stored, bodyHtml: "<p>Tampered</p>" } }).where(eq(articles.id, s.post.id));
    expect(await getArticle(s.websiteId, s.post.id)).toMatchObject({ preparing: "team", bodyHtml: null, title: PLANNED });
    expect(await checkReleasable(s.post.id)).toEqual({ ok: false, reason: "pending_review" });
    expect(await claimDispatch({ articleId: s.post.id, websiteId: s.websiteId, channel: "direct", trigger: "manual" })).toEqual({ ok: false, reason: "pending_review" });
    expect(await runJob(s)).toEqual({ held: "pending_review" });
    expect(await publishArticle(s.websiteId, s.post.id)).toEqual({ ok: false, error: PREPARING_MESSAGE });
    expect(cms.posts).toEqual([]);
  });

  it("a claim for a revision other than the one prepared is refused, on the hash", async () => {
    const s = await scene();
    await approve(s.post.id);
    expect(await claimDispatch({ articleId: s.post.id, websiteId: s.websiteId, channel: "direct", trigger: "manual", expectedRevision: "0".repeat(64) })).toEqual({ ok: false, reason: "revision_changed" });
  });

  it("a link the team withdrew stops the stored revision going out; their next approval sends without it", async () => {
    const s = await scene();
    await placeLink(s);
    await approve(s.post.id);
    const approved = await row(s.post.id);
    await reopenArticle({ articleId: s.post.id, expectedVersion: approved.reviewVersion, actorEmail: ADMIN });
    const reopened = await row(s.post.id);
    const [placement] = await test.db.select().from(placements).where(eq(placements.articleId, s.post.id));
    await removeManagedPlacement({ placementId: placement.id, expectedVersion: reopened.reviewVersion, actorEmail: ADMIN });

    expect(await getArticle(s.websiteId, s.post.id)).toMatchObject({ withTeam: true });
    expect(await publishArticle(s.websiteId, s.post.id)).toEqual({ ok: false, error: PREPARING_MESSAGE });
    expect(await runJob(s)).toEqual({ held: "pending_review" });

    await approve(s.post.id);
    await expect(runJob(s)).resolves.toMatchObject({ status: "publish" });
    expect(cms.posts[0].contentHtml).not.toContain(LINK);
  });

  it("a link placed only in the working copy is not promoted by sending the stored revision", async () => {
    const s = await scene({ fields: { bodyHtml: "<p>No links here.</p>" } });
    await approve(s.post.id);
    const partner = await seedWebsite(test);
    const [request] = await test.db.insert(backlinkRequests).values({ websiteId: partner.websiteId, targetUrl: `https://${LINK}/new`, status: "matched", creditsReserved: 10 }).returning();
    const [placement] = await test.db.insert(placements).values({ requestId: request.id, hostWebsiteId: s.websiteId, articleId: s.post.id, anchor: "a", status: "drafted", managed: true, credits: 10 }).returning();
    await test.db.update(articles).set({ bodyHtml: `<p>With <a href="https://${LINK}/new">a</a>.</p>`, reviewStatus: "pending", reviewApprovedHash: null }).where(eq(articles.id, s.post.id));
    await expect(runJob(s)).resolves.toMatchObject({ status: "publish" });
    const [after] = await test.db.select().from(placements).where(eq(placements.id, placement.id));
    expect(after.status).toBe("drafted");
    expect(after.liveUrl).toBeNull();
  });

  it("with the switch off, a send still sends the row, and a reopened article reads as before", async () => {
    const s = await scene({ fields: { researchReviewRequired: false, imageUrl: null, imageAlt: null } });
    await twoStep(false);
    await approve(s.post.id);
    expect((await row(s.post.id)).approvedRevision).toBeNull();
    const approved = await row(s.post.id);
    await reopenArticle({ articleId: s.post.id, expectedVersion: approved.reviewVersion, actorEmail: ADMIN });
    expect(await getArticle(s.websiteId, s.post.id)).toMatchObject({ withTeam: false, preparing: null, title: approved.title });
    expect(await claimDispatch({ articleId: s.post.id, websiteId: s.websiteId, channel: "direct", trigger: "manual" })).toEqual({ ok: false, reason: "pending_review" });
  });
});

describe("the whole flow, on each mode: team, then finished article, then one action, no customer approval", () => {
  const FINISHED = "<p>The team's finished text.</p>";

  /** Written and held; the team edits and approves; the customer sees nothing before that and approves nothing. */
  async function prepared(options: SceneOptions) {
    const s = await scene(options);
    expect(await getArticle(s.websiteId, s.post.id)).toMatchObject({ preparing: "team", bodyHtml: null });
    expect(await publishArticle(s.websiteId, s.post.id)).toEqual({ ok: false, error: PREPARING_MESSAGE });
    expect(await dailyReleaseSends(s.post.id)).toEqual([]);
    const current = await row(s.post.id);
    await editReviewedArticle({
      articleId: s.post.id, expectedVersion: current.reviewVersion, expectedHash: reviewHash(current),
      title: "Finished title", slug: "finished", metaDescription: "Finished", bodyHtml: FINISHED, actorEmail: ADMIN,
    });
    return s;
  }
  async function finishedIsReady(s: { websiteId: string; post: { id: string } }) {
    expect(await getArticle(s.websiteId, s.post.id)).toMatchObject({ preparing: null, withTeam: false, title: "Finished title", bodyHtml: FINISHED });
    // The team's approval covered the sources; nobody else approved anything.
    expect(await row(s.post.id)).toMatchObject({ researchApprovedBy: ADMIN, reviewApprovedBy: ADMIN });
  }
  const sentExactly = (status: string) => {
    expect(cms.posts).toHaveLength(1);
    expect(cms.posts[0]).toMatchObject({ title: "Finished title", status });
    expect(cms.posts[0].contentHtml).toContain("finished text");
  };

  it("manual: one notification, one press, the exact text, then a second press is refused", async () => {
    const s = await prepared({});
    expect(await approveAndRelease(s.post.id)).toBe("customer_publishes");
    await finishedIsReady(s);
    expect(bell.sent.map((message) => message.type)).toEqual(["article.ready"]);
    expect(jobs.queued).toEqual([]);
    expect((await publishArticle(s.websiteId, s.post.id)).ok).toBe(true);
    await runJob(s);
    sentExactly("publish");
    expect((await publishArticle(s.websiteId, s.post.id)).ok).toBe(false);
  });

  it("first article, manual: the same, with no release of its own", async () => {
    const s = await prepared({ firstArticlePending: true });
    expect(await approveAndRelease(s.post.id)).toBe("customer_publishes");
    await finishedIsReady(s);
    expect(jobs.queued).toEqual([]);
    expect(await dailyReleaseSends(s.post.id)).toEqual([]);
    await runJob(s);
    sentExactly("publish");
  });

  it("automatic live, due: goes at approval, told when live", async () => {
    const s = await prepared({ autoPublish: true, plannedInDays: 0 });
    expect(await approveAndRelease(s.post.id)).toBe("queued");
    await finishedIsReady(s);
    await runJob(s, "approval");
    sentExactly("publish");
    expect(bell.sent.map((message) => message.type)).toEqual(["article.published"]);
  });

  it("automatic live, planned ahead: ready now, goes on its day by the daily release", async () => {
    const s = await prepared({ autoPublish: true, plannedInDays: 3 });
    expect(await approveAndRelease(s.post.id)).toBe("waiting_for_day");
    await finishedIsReady(s);
    expect(await dailyReleaseSends(s.post.id)).toEqual([]);
    await test.db.update(calendarItems).set({ scheduledFor: new Date(Date.now() - 86_400_000) }).where(eq(calendarItems.id, s.post.calendarItemId!));
    expect(await dailyReleaseSends(s.post.id)).toHaveLength(1);
    await runJob(s, "automatic");
    sentExactly("publish");
  });

  it("automatic drafts: a CMS draft by itself; the one press makes it live", async () => {
    const s = await prepared({ autoPublish: true, publishAs: "draft", plannedInDays: 0 });
    expect(await approveAndRelease(s.post.id)).toBe("queued");
    await runJob(s, "approval");
    sentExactly("draft");
    await finishedIsReady(s);
    expect((await publishArticle(s.websiteId, s.post.id)).ok).toBe(true);
    await runJob(s);
    expect(cms.posts.at(-1)).toMatchObject({ status: "publish", title: "Finished title" });
  });

  it("WordPress plugin: not in the feed until pressed, then the exact text, once", async () => {
    const s = await prepared({ plugin: true });
    await approveAndRelease(s.post.id);
    await finishedIsReady(s);
    expect((await (await pluginPull()).json()).articles).toEqual([]);
    await publishArticle(s.websiteId, s.post.id);
    const pulled = (await (await pluginPull()).json()).articles;
    expect(pulled).toHaveLength(1);
    expect(pulled[0]).toMatchObject({ title: "Finished title", status: "publish" });
    expect(pulled[0].html).toContain("finished text");
    expect((await (await pluginPull()).json()).articles).toEqual([]);
  });

  it("CMS connected afterwards: connecting sends nothing; the press does", async () => {
    const s = await prepared({ connected: false, firstArticlePending: true });
    await approveAndRelease(s.post.id);
    await finishedIsReady(s);
    expect((await connectProvider(s.websiteId, "wordpress", {})).ok).toBe(true);
    expect(jobs.queued).toEqual([]);
    expect((await publishArticle(s.websiteId, s.post.id)).ok).toBe(true);
    expect(jobs.queued).toHaveLength(1);
  });
});

describe("deleting a held article", () => {
  it("the plan's article slot is not returned (left as it is, for Daniel to decide), and a partner's reserved credits are released with it (lib/articles/deletion.test.ts)", async () => {
    const s = await scene();
    const [item] = await test.db.insert(calendarItems).values({ websiteId: s.websiteId, title: "Another topic" }).returning();
    const queued = await queueArticleForCalendarItem(s.websiteId, item.id);
    if (!queued.ok) throw new Error(queued.error);
    await test.db.update(articles).set({ status: "draft", bodyHtml: "<p>Written</p>", reviewStatus: "pending" }).where(eq(articles.id, queued.articleId));
    const before = await checkLimit(s.websiteId, "articles");
    const slot = await test.db.select().from(spendReservations).where(eq(spendReservations.subjectId, queued.articleId));
    expect(slot).toHaveLength(1);

    const partner = await seedWebsite(test);
    const [request] = await test.db.insert(backlinkRequests).values({ websiteId: partner.websiteId, targetUrl: `https://${LINK}/page`, status: "matched", creditsReserved: 40 }).returning();
    const [placement] = await test.db.insert(placements).values({ requestId: request.id, hostWebsiteId: s.websiteId, articleId: queued.articleId, anchor: "a", status: "drafted", managed: true, credits: 40 }).returning();
    const reserved = async () => (await creditsFor(test.db, partner.orgId)).reserved;
    expect(await reserved()).toBe(40);

    expect(await deleteArticle(s.websiteId, queued.articleId)).toEqual({ ok: true, data: null });

    expect(await test.db.select().from(articles).where(eq(articles.id, queued.articleId))).toEqual([]);
    expect((await checkLimit(s.websiteId, "articles")).used).toBe(before.used);
    expect((await test.db.select().from(spendReservations).where(eq(spendReservations.subjectId, queued.articleId)))[0].state).toBe(slot[0].state);

    const [after] = await test.db.select().from(placements).where(eq(placements.id, placement.id));
    expect(after).toMatchObject({ articleId: null, status: "cancelled" });
    const [closed] = await test.db.select().from(backlinkRequests).where(eq(backlinkRequests.id, request.id));
    expect(closed).toMatchObject({ status: "cancelled", creditsReserved: 0 });
    expect(await reserved()).toBe(0);
    await expect(removeManagedPlacement({ placementId: placement.id, expectedVersion: 0, actorEmail: ADMIN })).rejects.toThrow("Placement not found");

    // Writing the topic again takes a new slot.
    const again = await queueArticleForCalendarItem(s.websiteId, item.id);
    expect(again.ok).toBe(true);
    expect((await checkLimit(s.websiteId, "articles")).used).toBe(before.used + 1);
  });
});

/* ------------------------------------------------------------------------ */

describe("switching it on", () => {
  const on = () => test.db.transaction((tx) => switchControl(tx, "two_step_articles", true, { reason: "test", actor: "test" }));

  it("changes no website's publishing mode, and the dry run counts what waits on each", async () => {
    await twoStep(false);
    const { ROLLOUT_QUERY } = await import("../../../scripts/two-step-transition-dry-run.mjs");
    const rollout = async () => (await test.client.query<{ manual_press: number; manual_press_websites: number; automatic_due: number }>(ROLLOUT_QUERY)).rows[0];
    const before = await rollout();

    const manual = (await seedWebsite(test)).websiteId;
    const auto = (await seedWebsite(test)).websiteId;
    const drafts = (await seedWebsite(test)).websiteId;
    await test.db.update(websites).set({ autoPublish: false, publishAs: "live" }).where(eq(websites.id, manual));
    await test.db.update(websites).set({ autoPublish: true, publishAs: "live" }).where(eq(websites.id, auto));
    await test.db.update(websites).set({ autoPublish: true, publishAs: "draft" }).where(eq(websites.id, drafts));
    const written = { title: "T", bodyHtml: "<p>B</p>", status: "draft" as const };
    await test.db.insert(articles).values([{ websiteId: manual, ...written }, { websiteId: manual, ...written }, { websiteId: auto, ...written }]);
    const [later] = await test.db.insert(calendarItems).values({ websiteId: auto, title: "Later", scheduledFor: new Date(Date.now() + 5 * 86_400_000) }).returning();
    await test.db.insert(articles).values({ websiteId: auto, calendarItemId: later.id, ...written });

    const modes = () => test.db.select({ id: websites.id, autoPublish: websites.autoPublish, publishAs: websites.publishAs }).from(websites).orderBy(websites.id);
    const modesBefore = await modes();
    const after = await rollout();
    expect(Number(after.manual_press) - Number(before.manual_press)).toBe(2);
    expect(Number(after.manual_press_websites) - Number(before.manual_press_websites)).toBe(1);
    expect(Number(after.automatic_due) - Number(before.automatic_due)).toBe(1);

    await on();
    expect(await modes()).toEqual(modesBefore);
  });

  it("sorts drafts without approving or sending anything, and the dry run agrees", async () => {
    await twoStep(false);
    const { TRANSITION_QUERY, moving } = await import("../../../scripts/two-step-transition-dry-run.mjs");
    const counted = async () => (await test.client.query<{ class: string; articles: number }>(TRANSITION_QUERY)).rows;
    const before = await counted();

    const asItIs = (await seedWebsite(test)).websiteId;
    const auto = (await seedWebsite(test)).websiteId;
    await test.db.update(websites).set({ autoPublish: true }).where(eq(websites.id, auto));
    const draft = async (websiteId: string, fields: Partial<typeof articles.$inferInsert>) =>
      (await test.db.insert(articles).values({ websiteId, title: "T", bodyHtml: "<p>B</p>", status: "draft", ...fields }).returning())[0];

    const waitingForSources = await draft(asItIs, { researchReviewRequired: true });
    const scheduledAuto = await draft(auto, {});
    const manual = await draft(asItIs, {});
    const pressed = await draft(auto, { publishRequested: "publish" });
    const live = await draft(auto, { status: "published", publishedUrl: "https://site.test/a", researchReviewRequired: true });
    const cmsDraft = await draft(auto, { publishedUrl: "https://site.test/b" });
    const queue = await draft(asItIs, { reviewStatus: "pending" });
    const approvedOk = await draft(asItIs, { reviewStatus: "approved", reviewApprovedHash: "" });
    await test.db.update(articles).set({ reviewApprovedHash: reviewHash(approvedOk) }).where(eq(articles.id, approvedOk.id));
    const approvedStale = await draft(asItIs, { reviewStatus: "approved", reviewApprovedHash: "old" });
    const approvedWaiting = await draft(asItIs, { reviewStatus: "approved", researchReviewRequired: true });
    await test.db.update(articles).set({ reviewApprovedHash: reviewHash(approvedWaiting) }).where(eq(articles.id, approvedWaiting.id));
    const inFlight = await draft(auto, {});
    await test.db.insert(publicationDispatches).values({ articleId: inFlight.id, websiteId: auto, channel: "direct", trigger: "manual", revisionHash: "r", requestedStatus: "publish", status: "in_flight", claimedAt: new Date() });

    const rows = await counted();
    const moved = moving(rows) - moving(before);
    expect(moved).toBe(6);

    const result = await on();
    expect(result.heldForReview - moving(before)).toBe(6);
    expect((await counted()).filter((row: { class: string }) => row.class.startsWith("moves_"))).toEqual([]);

    const statusOf = async (id: string) => (await row(id)).reviewStatus;
    expect(await statusOf(waitingForSources.id)).toBe("pending");
    expect(await statusOf(scheduledAuto.id)).toBe("pending");
    expect(await statusOf(approvedStale.id)).toBe("pending");
    expect((await row(approvedStale.id)).reviewApprovedHash).toBeNull();
    expect(await statusOf(approvedWaiting.id)).toBe("pending");

    // Never approved: every path now checks approval, so these go to the team too.
    expect(await statusOf(manual.id)).toBe("pending");
    expect(await statusOf(pressed.id)).toBe("pending");
    expect(await statusOf(live.id)).toBeNull();
    expect(await statusOf(cmsDraft.id)).toBeNull();
    expect(await statusOf(queue.id)).toBe("pending");
    expect(await statusOf(approvedOk.id)).toBe("approved");
    expect(await statusOf(inFlight.id)).toBeNull();

    // What stands is stored, so a later working copy stays private; nothing never approved is.
    expect(storedRevision((await row(live.id)).approvedRevision)).toMatchObject({ source: "published" });
    expect(storedRevision((await row(cmsDraft.id)).approvedRevision)).toMatchObject({ source: "published" });
    expect(storedRevision((await row(approvedOk.id)).approvedRevision)).toMatchObject({ source: "approved" });
    expect((await row(manual.id)).approvedRevision).toBeNull();
    expect((await row(approvedStale.id)).approvedRevision).toBeNull();

    // Nothing was approved, sent or announced by switching.
    expect((await row(waitingForSources.id)).reviewApprovedHash).toBeNull();
    expect((await row(live.id)).publishedUrl).toBe("https://site.test/a");
    expect(jobs.queued).toEqual([]);
    expect(inngestMock.send).not.toHaveBeenCalled();
    expect(bell.sent).toEqual([]);
  });

  it("an unapproved article the switch did not reach goes out by no path, a press included; a press hands it to the team", async () => {
    const s = await scene({ autoPublish: true, fields: { reviewStatus: null, researchReviewRequired: false } });
    for (const trigger of ["automatic", "manual", "plugin"] as const) {
      expect(await claimDispatch({ articleId: s.post.id, websiteId: s.websiteId, channel: trigger === "plugin" ? "plugin" : "direct", trigger })).toEqual({ ok: false, reason: "pending_review" });
    }
    expect(await publishArticle(s.websiteId, s.post.id)).toEqual({ ok: false, error: PREPARING_MESSAGE });
    expect((await row(s.post.id)).reviewStatus).toBe("pending");
  });

  it("what stood on the website at switch-on: readable, sent by no path, a press included, and an edit makes it a working copy", async () => {
    const s = await scene({ fields: { status: "published", publishedUrl: "https://site.test/?p=5", reviewStatus: null, researchReviewRequired: false } });
    await twoStep(false);
    await on();
    const baseline = await row(s.post.id);
    expect(storedRevision(baseline.approvedRevision)).toMatchObject({ source: "published", hash: reviewHash(baseline) });
    expect(sendableRevision(baseline)).toEqual({ ok: false, reason: "pending_review" });
    for (const trigger of ["automatic", "manual"] as const) {
      expect(await claimDispatch({ articleId: s.post.id, websiteId: s.websiteId, channel: "direct", trigger })).toEqual({ ok: false, reason: "pending_review" });
    }
    expect(await claimDispatch({ articleId: s.post.id, websiteId: s.websiteId, channel: "plugin", trigger: "plugin" })).toEqual({ ok: false, reason: "pending_review" });
    expect(cms.posts).toEqual([]);

    await updateArticle(s.websiteId, s.post.id, { bodyHtml: "<p>Customer change</p>" });
    expect((await row(s.post.id)).reviewStatus).toBe("pending");
    expect(await getArticle(s.websiteId, s.post.id)).toMatchObject({ withTeam: true, status: "published", bodyHtml: baseline.bodyHtml });
  });


  it("switched off again: what is in the queue stays there, and its customer reads it again", async () => {
    const s = await scene();
    await twoStep(false);
    const article = await getArticle(s.websiteId, s.post.id);
    expect(article).toMatchObject({ preparing: null, title: STAFF_TITLE });
    expect(article?.bodyHtml).toContain(BODY);
    expect((await row(s.post.id)).reviewStatus).toBe("pending");
    expect(await checkReleasable(s.post.id)).toEqual({ ok: false, reason: "pending_review" });
  });
});

/* ------------------------------------------------------------------------ */

describe("with the switch off, nothing changes", () => {
  beforeEach(async () => {
    await twoStep(false);
  });

  it("a held article reads as before, and the list shows its stored status", async () => {
    const s = await scene();
    expect((await getArticle(s.websiteId, s.post.id))?.bodyHtml).toContain(BODY);
    expect((await listArticles(s.websiteId))[0]).toMatchObject({ status: "draft", title: STAFF_TITLE, wordCount: 77 });
  });

  it("an edit after approval goes to the queue as before, the customer's source approval still works, and Send as draft is a draft", async () => {
    const s = await scene({ fields: { researchReviewRequired: false } });
    await approve(s.post.id);
    await updateArticle(s.websiteId, s.post.id, { bodyHtml: "<p>Edited</p>" });
    expect((await row(s.post.id)).reviewStatus).toBe("pending");

    const research = await scene({ fields: { reviewStatus: null } });
    await approveArticleResearch(research.websiteId, research.post.id, form(reviewHash(research.post)));
    expect((await row(research.post.id)).researchApprovedHash).toBe(reviewHash(research.post));
    await publishArticle(research.websiteId, research.post.id, "draft");
    expect(jobs.queued.at(-1)?.data.status).toBe("draft");
  });

  it("the next-action list keeps its research task and its draft wording", async () => {
    const s = await scene({ fields: { reviewStatus: null } });
    const kinds = (await getNextActions(s.websiteId, s.orgId, false)).map((action) => action.kind);
    expect(kinds).toContain("research");
    expect(kinds).not.toContain("readyToPublish");
  });

  it("no ready notification is sent by this flow, and a press twice is the job's to refuse", async () => {
    const s = await scene({ fields: { researchReviewRequired: false, imageUrl: null, imageAlt: null } });
    expect(await approveAndRelease(s.post.id)).toBe("customer_publishes");
    expect(bell.sent).toEqual([]);
    await runJob(s);
    expect((await publishArticle(s.websiteId, s.post.id)).ok).toBe(true);
    expect(await runJob(s)).toEqual({ held: "already_sent" });
  });

  it("leaving the Partner Network releases as before", async () => {
    const s = await scene();
    await test.db.insert(networkSites).values({ websiteId: s.websiteId, acceptingLinks: true, monthlyCap: 3 });
    expect(await setParticipation(s.websiteId, false)).toEqual({ ok: true, data: { released: 1, keptInReview: 0 } });
  });

  it("a stale press's new revision is prepared again, as before", async () => {
    const s = await scene({ fields: { reviewStatus: null, researchReviewRequired: false } });
    const using = steps();
    await using.run("load-article", async () => {
      const first = await row(s.post.id);
      return {
        held: null, revisionHash: reviewHash(first), linkFindings: [], integrationId: cms.integrationId, providerId: "wordpress", remoteId: null, industry: null, image: null,
        post: { title: first.title, contentHtml: first.bodyHtml, slug: first.slug, excerpt: first.metaDescription, status: "publish" },
      };
    });
    await updateArticle(s.websiteId, s.post.id, { bodyHtml: "<p>Newer</p>" });
    expect(await runJob(s, "manual", using)).toEqual({ held: "revision_changed" });
    expect(inngestMock.send).toHaveBeenCalledTimes(1);
  });
});

/* ------------------------------------------------------------------------ */

describe("review of the combined diff: what stays true on the edges", () => {
  const on = () => test.db.transaction((tx) => switchControl(tx, "two_step_articles", true, { reason: "test", actor: "test" }));
  const asAdmin = async <T,>(orgId: string, fn: () => Promise<T>) => {
    vi.stubEnv("ADMIN_EMAILS", ADMIN);
    const customerSession = state.session;
    state.session = { user: { id: "u_admin", email: ADMIN, emailVerified: true }, session: { id: "s_admin", activeOrganizationId: orgId } };
    try {
      return await fn();
    } finally {
      state.session = customerSession;
      vi.unstubAllEnvs();
    }
  };

  const STALE = { status: "published", publishedUrl: "https://site.test/old", firstLiveAt: new Date("2026-10-01T10:00:00Z"), reviewStatus: "approved", reviewApprovedHash: "stale", researchReviewRequired: false, title: STAFF_TITLE, bodyHtml: `<p>${BODY} changed since the approval</p>` } as const;
  const noPathSends = async (s: { websiteId: string; post: { id: string } }) => {
    expect(sendableRevision(await row(s.post.id))).toEqual({ ok: false, reason: "pending_review" });
    for (const trigger of ["automatic", "manual", "approval", "connection"] as const) {
      expect(await claimDispatch({ articleId: s.post.id, websiteId: s.websiteId, channel: "direct", trigger })).toEqual({ ok: false, reason: "pending_review" });
    }
    expect(await claimDispatch({ articleId: s.post.id, websiteId: s.websiteId, channel: "plugin", trigger: "plugin" })).toEqual({ ok: false, reason: "pending_review" });
    expect(await publishArticle(s.websiteId, s.post.id)).toEqual({ ok: false, error: PREPARING_MESSAGE });
    expect(cms.posts).toEqual([]);
  };

  it("switch-on, a live post whose approval no longer matches: its working copy cannot be published by anyone until the team approves that exact revision, and the post stays", async () => {
    await twoStep(false);
    const before = await inClass("moves_on_site_approval_no_longer_stands");
    const s = await scene({ plannedInDays: 0, fields: STALE });
    expect(await inClass("moves_on_site_approval_no_longer_stands")).toBe(before + 1);
    const result = await on();
    expect(result.heldForReview).toBeGreaterThanOrEqual(1);
    expect(await inClass("moves_on_site_approval_no_longer_stands")).toBe(0);

    // Back with the team, nothing approved or stored, and the post where it was.
    expect(await row(s.post.id)).toMatchObject({ reviewStatus: "pending", reviewApprovedHash: null, reviewApprovedAt: null, approvedRevision: null, status: "published", publishedUrl: STALE.publishedUrl });

    // The customer sees that it stands, and none of the working copy.
    const article = await getArticle(s.websiteId, s.post.id);
    expect(article).toMatchObject({ preparing: "team", status: "published", publishedUrl: STALE.publishedUrl, bodyHtml: null, title: PLANNED });
    expect(JSON.stringify(article)).not.toContain(BODY);

    await noPathSends(s);
    expect(await runJob(s)).toEqual({ held: "pending_review" });
    expect(jobs.queued).toEqual([]);
    expect(inngestMock.send).not.toHaveBeenCalled();
    expect((await asAdmin(s.orgId, () => getReviewQueue())).articles.map((item) => item.id)).toContain(s.post.id);

    // The team's approval covers exactly that revision: its hash is what goes out.
    expect(await approveAndRelease(s.post.id)).toBe("customer_publishes");
    const approved = await row(s.post.id);
    expect(approved.reviewApprovedHash).toBe(reviewHash(approved));
    expect(sendableRevision(approved)).toMatchObject({ ok: true, hash: reviewHash(approved) });
    expect(cms.posts).toEqual([]);
    await expect(runJob(s)).resolves.toMatchObject({ status: "publish" });
    expect(cms.posts[0].contentHtml).toContain(BODY);
  });

  it("the same post with proof of what was sent: the customer reads that text, and it still cannot be sent", async () => {
    await twoStep(false);
    const s = await scene({ fields: STALE });
    const sentBody = "<p>As it stands on the website</p>";
    await test.db.insert(articleVersions).values({ articleId: s.post.id, bodyHtml: sentBody });
    await recordSend(s.post, { bodyHtml: sentBody });
    await on();
    expect(storedRevision((await row(s.post.id)).approvedRevision)).toMatchObject({ source: "published", bodyHtml: sentBody });
    expect(await getArticle(s.websiteId, s.post.id)).toMatchObject({ preparing: null, withTeam: true, bodyHtml: sentBody, status: "published" });
    expect(await row(s.post.id)).toMatchObject({ reviewStatus: "pending", reviewApprovedHash: null });
    await noPathSends(s);
  });

  it("a stale approval with a revision stored earlier keeps it: that is still the last approved one", async () => {
    const s = await scene({ fields: { status: "published", publishedUrl: "https://site.test/kept", bodyHtml: "<p>Approved</p>", researchReviewRequired: false } });
    await approve(s.post.id);
    await test.db.update(articles).set({ bodyHtml: `<p>${BODY}</p>` }).where(eq(articles.id, s.post.id));
    await twoStep(false);
    await on();
    expect(storedRevision((await row(s.post.id)).approvedRevision)).toMatchObject({ source: "approved", bodyHtml: "<p>Approved</p>" });
    expect(await getArticle(s.websiteId, s.post.id)).toMatchObject({ withTeam: true, bodyHtml: "<p>Approved</p>" });
    expect(sendableRevision(await row(s.post.id))).toMatchObject({ ok: true, from: "stored" });
  });

  it("a WordPress draft from before the flow: a press hands it to the team, and approval is what publishes it", async () => {
    await twoStep(false);
    const s = await scene({ fields: { status: "draft", publishedUrl: "https://site.test/?p=3", reviewStatus: null, researchReviewRequired: false, bodyHtml: "<p>On the site as a draft</p>" } });
    await on();
    expect(storedRevision((await row(s.post.id)).approvedRevision)).toMatchObject({ source: "published" });
    expect(await publishArticle(s.websiteId, s.post.id)).toEqual({ ok: false, error: PREPARING_MESSAGE });
    expect(await row(s.post.id)).toMatchObject({ reviewStatus: "pending", status: "draft", publishedUrl: "https://site.test/?p=3" });
    expect(cms.posts).toEqual([]);
    await approve(s.post.id);
    expect(sendableRevision(await row(s.post.id))).toMatchObject({ ok: true });
  });

  const inClass = async (name: string) => {
    const { TRANSITION_QUERY } = await import("../../../scripts/two-step-transition-dry-run.mjs");
    return (await test.client.query<{ class: string; articles: number }>(TRANSITION_QUERY)).rows.find((row) => row.class === name)?.articles ?? 0;
  };
  /** A delivery of exactly these fields, as the dispatch claim records it. */
  const recordSend = (post: typeof articles.$inferSelect, sent: Partial<typeof articles.$inferSelect>, fields: Partial<typeof publicationDispatches.$inferInsert> = {}) =>
    test.db.insert(publicationDispatches).values({
      articleId: post.id,
      websiteId: post.websiteId,
      channel: "direct",
      trigger: "manual",
      revisionHash: reviewHash({ ...post, ...sent }),
      requestedStatus: "publish",
      status: "sent",
      remoteStatus: "publish",
      requestSnapshot: { title: sent.title ?? post.title, slug: sent.slug === undefined ? post.slug : sent.slug },
      ...fields,
    });
  const WAITING = { status: "published", publishedUrl: "https://site.test/wait", firstLiveAt: new Date("2026-10-01T10:00:00Z"), reviewStatus: "pending", researchReviewRequired: false, bodyHtml: `<p>${BODY} pending</p>`, title: STAFF_TITLE } as const;

  it("switch-on, a live post with a pending change and no proof of what was sent: no working copy, the post stays, and nothing is approved or sent", async () => {
    await twoStep(false);
    const before = await inClass("on_site_change_waiting_text_unavailable");
    const s = await scene({ fields: WAITING });
    expect(await inClass("on_site_change_waiting_text_unavailable")).toBe(before + 1);
    await on();

    // Nothing was stored or made up, and the review stays open.
    const after = await row(s.post.id);
    expect(after).toMatchObject({ approvedRevision: null, reviewStatus: "pending", reviewApprovedHash: null, status: "published", publishedUrl: WAITING.publishedUrl });

    // The customer sees that it stands on their website, and not one word of the working copy.
    const article = await getArticle(s.websiteId, s.post.id);
    expect(article).toMatchObject({ preparing: "team", withTeam: false, status: "published", publishedUrl: WAITING.publishedUrl, title: PLANNED, bodyHtml: null, metaDescription: null, imageUrl: null, imageAlt: null, slug: null });
    const listed = (await listArticles(s.websiteId)).find((item) => item.id === s.post.id);
    expect(listed).toMatchObject({ title: PLANNED, status: "published", slug: null, wordCount: null });
    for (const read of [article, listed, await getDashboardOverview({ websiteId: s.websiteId, ownerOrgId: s.orgId, showCredits: false }), await getTasks(s.websiteId, s.orgId, true)]) {
      const seen = JSON.stringify(read);
      for (const secret of [BODY, STAFF_TITLE, "SECRETEXCERPT", IMAGE, "SECRETALT", LINK]) expect(seen).not.toContain(secret);
    }

    // No path sends it.
    expect(sendableRevision(after)).toEqual({ ok: false, reason: "pending_review" });
    expect(await publishArticle(s.websiteId, s.post.id)).toEqual({ ok: false, error: PREPARING_MESSAGE });
    expect(await runJob(s)).toEqual({ held: "pending_review" });
    expect(await claimDispatch({ articleId: s.post.id, websiteId: s.websiteId, channel: "direct", trigger: "automatic" })).toEqual({ ok: false, reason: "pending_review" });
    expect(cms.posts).toEqual([]);
    expect(inngestMock.send).not.toHaveBeenCalled();
    // The customer can change nothing in it.
    expect(await updateArticle(s.websiteId, s.post.id, { title: "Mine" })).toEqual({ ok: false, error: PREPARING_MESSAGE });

    // Not for public outputs, and not translated.
    const [{ ok }] = await test.db.select({ ok: publicRevisionSql }).from(articles).where(eq(articles.id, s.post.id));
    expect(ok).toBe(false);
    expect(await translateLiveArticle({ articleId: s.post.id, websiteId: s.websiteId, organizationId: s.orgId, language: "it" })).toMatchObject({ status: "skipped" });

    // It stays in the team's queue; their approval is what makes it readable, and tells the customer.
    const queue = await asAdmin(s.orgId, () => getReviewQueue());
    expect(queue.articles.map((item) => item.id)).toContain(s.post.id);
    expect(await approveAndRelease(s.post.id)).toBe("customer_publishes");
    expect(storedRevision((await row(s.post.id)).approvedRevision)).toMatchObject({ source: "approved" });
    expect(sendableRevision(await row(s.post.id))).toMatchObject({ ok: true });
    expect(await getArticle(s.websiteId, s.post.id)).toMatchObject({ preparing: null, bodyHtml: WAITING.bodyHtml });
    // Approval tells the customer once, and never republishes the post by itself.
    expect(bell.sent).toHaveLength(1);
    expect(cms.posts).toEqual([]);
  });

  it("switch-on recovers the text last sent when its hash proves it: a saved earlier body, with the send's title and slug", async () => {
    await twoStep(false);
    const s = await scene({ fields: WAITING });
    const sentBody = "<p>As it stands on the website</p>";
    await test.db.insert(articleVersions).values([{ articleId: s.post.id, bodyHtml: "<p>Older still</p>" }, { articleId: s.post.id, bodyHtml: sentBody }]);
    await recordSend(s.post, { title: "As sent", slug: "as-sent", bodyHtml: sentBody });
    expect(await inClass("on_site_change_waiting_sent_text_recovered")).toBe(1);
    await on();
    expect(await inClass("on_site_change_waiting_sent_text_recovered")).toBe(0);

    const after = await row(s.post.id);
    expect(storedRevision(after.approvedRevision)).toMatchObject({ source: "published", title: "As sent", slug: "as-sent", bodyHtml: sentBody });
    // Still the team's: nothing was approved, and the working copy stays where it was.
    expect(after).toMatchObject({ reviewStatus: "pending", reviewApprovedHash: null, title: STAFF_TITLE, bodyHtml: WAITING.bodyHtml });
    const article = await getArticle(s.websiteId, s.post.id);
    expect(article).toMatchObject({ preparing: null, withTeam: true, status: "published", title: "As sent", bodyHtml: sentBody });
    expect(JSON.stringify(article)).not.toContain(BODY);
    // Nobody approved it, so nothing automatic sends it.
    expect(await claimDispatch({ articleId: s.post.id, websiteId: s.websiteId, channel: "direct", trigger: "automatic" })).toEqual({ ok: false, reason: "pending_review" });
    expect(cms.posts).toEqual([]);
  });

  it("switch-on recovers a working copy that still is what was sent", async () => {
    await twoStep(false);
    const s = await scene({ fields: WAITING });
    await recordSend(s.post, {});
    await on();
    expect(storedRevision((await row(s.post.id)).approvedRevision)).toMatchObject({ source: "published", hash: reviewHash(s.post) });
    expect(await row(s.post.id)).toMatchObject({ reviewStatus: "pending", reviewApprovedHash: null });
  });

  it.each([
    ["a send that does not match anything RepGet holds", { status: "sent" }, { bodyHtml: "<p>Gone for good</p>" }],
    ["a send that failed, though the text matches", { status: "failed" }, {}],
    ["a late send, though the text matches", { status: "sent", late: true }, {}],
  ] as const)("switch-on recovers nothing from %s", async (_name, dispatch, sent) => {
    await twoStep(false);
    const before = await inClass("on_site_change_waiting_text_unavailable");
    const s = await scene({ fields: WAITING });
    await recordSend(s.post, sent, dispatch);
    expect(await inClass("on_site_change_waiting_text_unavailable")).toBe(before + 1);
    await on();
    expect((await row(s.post.id)).approvedRevision).toBeNull();
    expect(await getArticle(s.websiteId, s.post.id)).toMatchObject({ preparing: "team", bodyHtml: null, publishedUrl: WAITING.publishedUrl });
  });

  it("only the latest send counts: an older match does not stand for a newer send", async () => {
    await twoStep(false);
    const s = await scene({ fields: WAITING });
    await recordSend(s.post, {}, { claimedAt: new Date("2026-10-01T10:00:00Z") });
    await recordSend(s.post, { bodyHtml: "<p>Newer, gone</p>" }, { claimedAt: new Date("2026-10-02T10:00:00Z") });
    await on();
    expect((await row(s.post.id)).approvedRevision).toBeNull();
  });

  it("a WordPress draft with a pending change and no proof: stays a draft there, and shows no working copy", async () => {
    await twoStep(false);
    const s = await scene({ fields: { ...WAITING, status: "draft", firstLiveAt: null } });
    await on();
    expect(await getArticle(s.websiteId, s.post.id)).toMatchObject({ preparing: "team", status: "draft", publishedUrl: WAITING.publishedUrl, bodyHtml: null });
    expect((await listArticles(s.websiteId)).find((item) => item.id === s.post.id)).toMatchObject({ status: "preparing", title: PLANNED });
  });

  it("switching on a second time keeps a post with no proof as it is, and picks up one that has proof by then", async () => {
    await twoStep(false);
    const s = await scene({ fields: WAITING });
    await on();
    await twoStep(false);
    await on();
    expect((await row(s.post.id)).approvedRevision).toBeNull();
    await twoStep(false);
    await recordSend(s.post, {});
    await on();
    expect(storedRevision((await row(s.post.id)).approvedRevision)).toMatchObject({ source: "published" });
  });

  it("switch-on keeps a revision stored earlier, rather than storing a working copy over it", async () => {
    const s = await scene({ fields: { status: "published", publishedUrl: "https://site.test/x", bodyHtml: "<p>Approved</p>", researchReviewRequired: false } });
    await approve(s.post.id);
    await test.db.update(articles).set({ bodyHtml: "<p>Later</p>", reviewStatus: "pending", reviewApprovedHash: null }).where(eq(articles.id, s.post.id));
    await twoStep(false);
    await on();
    expect(await getArticle(s.websiteId, s.post.id)).toMatchObject({ bodyHtml: "<p>Approved</p>" });
    expect(storedRevision((await row(s.post.id)).approvedRevision)).toMatchObject({ source: "approved" });
  });

  it("an approved revision with no picture goes out with none: nothing is generated at send time", async () => {
    images.configured = true;
    images.generated.length = 0;
    const s = await scene({ fields: { imageUrl: null, imageAlt: null } });
    await approve(s.post.id);
    const approved = await row(s.post.id);
    await expect(runJob(s)).resolves.toMatchObject({ status: "publish" });
    expect(images.generated).toEqual([]);
    expect(cms.posts[0]).toMatchObject({ featuredMediaId: null, featuredImageUrl: null });
    const [sent] = await test.db.select().from(publicationDispatches).where(eq(publicationDispatches.articleId, s.post.id));
    expect(sent.revisionHash).toBe(reviewHash(approved));
    expect(reviewHash(await row(s.post.id))).toBe(reviewHash(approved));

    // With the switch off it is as it was.
    const off = await scene({ fields: { imageUrl: null, imageAlt: null, reviewStatus: null, researchReviewRequired: false } });
    await twoStep(false);
    await expect(runJob(off)).resolves.toMatchObject({ status: "publish" });
    expect(images.generated).toHaveLength(1);
    images.configured = false;
  });

  it("a placement counts as published only if it is in what was actually sent", async () => {
    const partner = await seedWebsite(test);
    const link = `https://${LINK}/discover`;
    const addPlacement = async (websiteId: string, articleId: string) => {
      const [request] = await test.db.insert(backlinkRequests).values({ websiteId: partner.websiteId, targetUrl: link, status: "matched", creditsReserved: 10 }).returning();
      const [placement] = await test.db.insert(placements).values({ requestId: request.id, hostWebsiteId: websiteId, articleId, anchor: "a", status: "drafted", managed: true, credits: 10 }).returning();
      return placement.id;
    };
    const statusOf = async (id: string) => (await test.db.select().from(placements).where(eq(placements.id, id)))[0].status;

    // On the site is the first text; the team has approved a second, with the link, that has not gone out.
    const s = await scene({ fields: { bodyHtml: "<p>First text</p>", researchReviewRequired: false } });
    await approve(s.post.id);
    await runJob(s);
    await test.db.update(articles).set({ bodyHtml: `<p>Second text with <a href="${link}">a</a></p>`, reviewStatus: "pending", reviewApprovedHash: null }).where(eq(articles.id, s.post.id));
    const placementId = await addPlacement(s.websiteId, s.post.id);
    await approve(s.post.id);
    expect(await row(s.post.id)).toMatchObject({ status: "published", reviewStatus: "approved" });

    await discoverPublishedPlacements();
    expect(await statusOf(placementId)).toBe("drafted");

    // Once it goes out, it counts.
    await runJob(s);
    expect(cms.posts.at(-1)?.contentHtml).toContain(LINK);
    await discoverPublishedPlacements();
    expect(await statusOf(placementId)).toBe("published");
  });

  it("an approved update on a plugin site: one press, through the plugin's real protocol, to the post it already has", async () => {
    const s = await scene({ plugin: true, fields: { status: "published", publishedUrl: "https://site.test/p", firstLiveAt: new Date(), reviewStatus: "pending", researchReviewRequired: false, bodyHtml: "<p>Update</p>", title: "Updated title" } });
    await test.db.update(integrationKeys).set({ siteInfo: "6.4.3 / plugin 1.10.0" }).where(eq(integrationKeys.websiteId, s.websiteId));
    expect(await approveAndRelease(s.post.id)).toBe("customer_publishes");
    expect(bell.sent[0].title).toMatch(/update is ready/);
    // Offered only once pressed.
    expect((await (await pluginPull()).json()).articles).toEqual([]);

    const pressed = await publishArticle(s.websiteId, s.post.id);
    expect(pressed).toEqual({ ok: true, data: { publishedUrl: null, queued: true } });
    const handed = (await (await pluginPull()).json()).articles;
    expect(handed).toHaveLength(1);
    expect(handed[0]).toMatchObject({ id: s.post.id, title: "Updated title", status: "publish" });

    const report = await pluginPublished(new NextRequest("https://app.test/api/plugin/published", {
      method: "POST",
      headers: { "x-integration-key": "k", "content-type": "application/json" },
      body: JSON.stringify({ articleId: s.post.id, dispatchId: handed[0].dispatch.id, url: "https://site.test/p", remoteId: 7, status: "publish" }),
    }));
    expect(report.status).toBe(200);
    expect(await row(s.post.id)).toMatchObject({ publishRequested: null, status: "published" });
    expect((await (await pluginPull()).json()).articles).toEqual([]);
    expect(await publishArticle(s.websiteId, s.post.id)).toEqual({ ok: false, error: "This exact version is already on the website." });
  });

  it("an update is not offered to a plugin too old to make one, and the customer is told why", async () => {
    const s = await scene({ plugin: true, fields: { status: "published", publishedUrl: "https://site.test/q", reviewStatus: "pending", researchReviewRequired: false } });
    await test.db.update(integrationKeys).set({ siteInfo: "6.4.3 / plugin 1.9.0" }).where(eq(integrationKeys.websiteId, s.websiteId));
    await approve(s.post.id);
    expect(await publishArticle(s.websiteId, s.post.id)).toEqual({ ok: false, error: PLUGIN_UPDATE_NEEDED });
    expect((await row(s.post.id)).publishRequested).toBeNull();
    // And the feed for such a plugin leaves a recorded press alone.
    await test.db.update(articles).set({ publishRequested: "publish" }).where(eq(articles.id, s.post.id));
    expect(await dueArticlesForPlugin(s.websiteId, 5, new Date(), { updates: false })).toEqual([]);
    expect(await dueArticlesForPlugin(s.websiteId, 5, new Date(), { updates: true })).toHaveLength(1);
    expect(pluginUpdates("1.9.9")).toBe(false);
    expect(pluginUpdates("1.10.0")).toBe(true);
    expect((await (await pluginPull("1.9.0")).json()).articles).toEqual([]);
    const t = getMessages("de").app;
    expect(actionErrorText(PLUGIN_UPDATE_NEEDED, { t: t.editor, tWorkspace: t.workspace, tImage: t.image, delivery: ARTICLE_DELIVERY.de })).toBe(ARTICLE_DELIVERY.de.errPluginUpdate);
  });

  describe("a Publish press on a post held as a WordPress draft", () => {
    const DRAFT_URL = "https://site.test/?p=7";
    const LIVE_URL = "https://site.test/the-article/";
    /** Delivered as a draft by the site's automatic mode, then approved: what the plugin holds, as it last reported. */
    const heldDraft = async (version = "1.10.0", options: SceneOptions = {}) => {
      const s = await scene({
        plugin: true,
        ...options,
        fields: { status: "draft", publishedUrl: DRAFT_URL, reviewStatus: "pending", researchReviewRequired: false, title: "Approved title", bodyHtml: "<p>Approved text</p>", metaDescription: "Approved excerpt", imageUrl: null, imageAlt: null, ...options.fields },
      });
      await test.db.update(integrationKeys).set({ siteInfo: `6.4.3 / plugin ${version}` }).where(eq(integrationKeys.websiteId, s.websiteId));
      await approve(s.post.id);
      await test.db.insert(publicationDispatches).values({ articleId: s.post.id, websiteId: s.websiteId, channel: "plugin", trigger: "plugin", protocol: "plugin_v2", revisionHash: reviewHash(await row(s.post.id)), requestedStatus: "draft", status: "sent", remoteStatus: "draft", remoteId: "7", remoteUrl: DRAFT_URL, claimedAt: new Date(Date.now() - 3_600_000) });
      await test.db.insert(publishLogs).values({ articleId: s.post.id, status: "published", remoteId: "7", remoteUrl: DRAFT_URL, remoteStatus: "draft" });
      return s;
    };
    const report = (body: Record<string, unknown>) =>
      pluginPublished(new NextRequest("https://app.test/api/plugin/published", { method: "POST", headers: { "x-integration-key": "k", "content-type": "application/json" }, body: JSON.stringify(body) }));
    const handOver = async (version?: string) => (await (await pluginPull(version)).json()).articles as { id: string; title: string; html: string; status: string; existingDraft?: { delivered: boolean }; dispatch: { id: string; revision: string } }[];
    const live = (id: string, dispatchId: string) => report({ articleId: id, dispatchId, url: LIVE_URL, remoteId: 7, status: "publish" });
    const dispatches = async (id: string) => test.db.select().from(publicationDispatches).where(eq(publicationDispatches.articleId, id));
    const logs = async (id: string) => test.db.select().from(publishLogs).where(eq(publishLogs.articleId, id));

    it("one press: the post it already has goes live, with its real address", async () => {
      const s = await heldDraft();
      expect((await handOver())).toEqual([]);
      expect(await publishArticle(s.websiteId, s.post.id)).toEqual({ ok: true, data: { publishedUrl: null, queued: true } });
      expect((await row(s.post.id)).publishRequested).toBe("publish");

      const [handed, ...others] = await handOver();
      expect(others).toEqual([]);
      expect(handed).toMatchObject({ id: s.post.id, status: "publish", title: "Approved title", existingDraft: { delivered: true }, dispatch: { revision: reviewHash(await row(s.post.id)) } });

      expect((await live(s.post.id, handed.dispatch.id)).status).toBe(200);
      expect(await row(s.post.id)).toMatchObject({ status: "published", publishedUrl: LIVE_URL, publishRequested: null, error: null });
      expect((await row(s.post.id)).firstLiveAt).not.toBeNull();
      expect(bell.sent.at(-1)).toMatchObject({ type: "article.published", title: '"Approved title" is live', body: LIVE_URL });

      expect(await handOver()).toEqual([]);
      expect(await publishArticle(s.websiteId, s.post.id)).toEqual({ ok: false, error: "This exact version is already on the website." });
    });

    it("the plugin answers while the press waits: the customer is told at once, and only a live post counts as on the site", async () => {
      const synced = vi.mocked(triggerPluginSync);
      const s = await heldDraft();
      synced.mockImplementationOnce(async () => {
        await live(s.post.id, (await handOver())[0].dispatch.id);
        return "synced";
      });
      expect(await publishArticle(s.websiteId, s.post.id)).toEqual({ ok: true, data: { publishedUrl: LIVE_URL, queued: false } });

      const refused = await heldDraft();
      synced.mockImplementationOnce(async () => {
        await report({ articleId: refused.post.id, dispatchId: (await handOver())[0].dispatch.id, url: null, remoteId: 7, error: "draft_changed", status: "draft", outcome: "draft_changed" });
        return "synced";
      });
      expect(await publishArticle(refused.websiteId, refused.post.id)).toEqual({ ok: true, data: { publishedUrl: null, queued: false } });
    });

    it("a press updating a live post says so to the plugin; a refusal leaves it live, answered and said once", async () => {
      const s = await heldDraft();
      await publishArticle(s.websiteId, s.post.id);
      await live(s.post.id, (await handOver())[0].dispatch.id);
      await test.db.update(articles).set({ bodyHtml: "<p>A newer approved text</p>", reviewStatus: "pending" }).where(eq(articles.id, s.post.id));
      await approve(s.post.id);
      await publishArticle(s.websiteId, s.post.id);

      const [handed, ...others] = await handOver();
      expect(others).toEqual([]);
      expect(handed).toMatchObject({ id: s.post.id, status: "publish", existingPost: { delivered: true } });
      expect(handed).not.toHaveProperty("existingDraft");

      const before = bell.sent.length;
      const body = { articleId: s.post.id, dispatchId: handed.dispatch.id, url: null, remoteId: 7, error: "post_changed", status: "draft", outcome: "post_changed" };
      expect(await (await report(body)).json()).toEqual({ ok: true, recorded: "post_changed" });
      expect(await row(s.post.id)).toMatchObject({ status: "published", publishedUrl: LIVE_URL, publishRequested: null, error: DRAFT_REFUSALS.post_changed });
      expect(await handOver()).toEqual([]);
      expect(bell.sent.length).toBe(before + 1);
      expect(bell.sent.at(-1)).toMatchObject({ type: "article.failed", body: `Approved title. ${ARTICLE_DELIVERY.en.refusedPostChanged}` });
      expect(await (await report(body)).json()).toEqual({ ok: true, recorded: "duplicate" });
      expect(bell.sent.length).toBe(before + 1);
    });

    it("a post reported in the trash is not recorded as live", async () => {
      const s = await heldDraft();
      await publishArticle(s.websiteId, s.post.id);
      const [handed] = await handOver();
      await report({ articleId: s.post.id, dispatchId: handed.dispatch.id, url: DRAFT_URL, remoteId: 7, status: "trash" });
      expect(await row(s.post.id)).toMatchObject({ status: "draft", firstLiveAt: null });
    });

    it("a hand-over nobody pressed carries no such instruction", async () => {
      const s = await heldDraft();
      await publishArticle(s.websiteId, s.post.id);
      await live(s.post.id, (await handOver())[0].dispatch.id);
      await test.db.update(articles).set({ bodyHtml: "<p>A newer approved text</p>", reviewStatus: "pending" }).where(eq(articles.id, s.post.id));
      await approve(s.post.id);
      await test.db.update(websites).set({ autoPublish: true }).where(eq(websites.id, s.websiteId));
      const claim = await claimDispatch({ articleId: s.post.id, websiteId: s.websiteId, channel: "plugin", trigger: "plugin" });
      expect(claim).toMatchObject({ ok: true, existingPost: null, existingDraft: null });
    });

    it("changed in WordPress: a distinct outcome, the press answered, nothing live and no address changed", async () => {
      const s = await heldDraft();
      await publishArticle(s.websiteId, s.post.id);
      const [handed] = await handOver();
      const body = { articleId: s.post.id, dispatchId: handed.dispatch.id, url: null, remoteId: 7, error: "draft_changed", status: "draft", outcome: "draft_changed" };
      expect(await (await report(body)).json()).toEqual({ ok: true, recorded: "draft_changed" });

      expect(await row(s.post.id)).toMatchObject({ status: "draft", publishedUrl: DRAFT_URL, publishRequested: null, error: DRAFT_REFUSALS.draft_changed, firstLiveAt: null });
      expect(await handOver()).toEqual([]);
      const settled = (await dispatches(s.post.id)).find((dispatch) => dispatch.id === handed.dispatch.id);
      expect(settled).toMatchObject({ status: "failed", error: DRAFT_REFUSALS.draft_changed, remoteStatus: null });
      expect(draftRefusalOf((await logs(s.post.id)).find((log) => log.status === "failed")?.error)).toBe("draft_changed");
      expect(bell.sent.at(-1)).toMatchObject({ type: "article.failed", title: ARTICLE_DELIVERY.en.notifyNotPublished, body: `Approved title. ${ARTICLE_DELIVERY.en.refusedChanged}` });
      expect(vi.mocked(emailArticleFailed)).not.toHaveBeenCalled();

      // The same report again: nothing more.
      const before = bell.sent.length;
      expect(await (await report(body)).json()).toEqual({ ok: true, recorded: "duplicate" });
      expect(bell.sent).toHaveLength(before);
      expect((await logs(s.post.id)).filter((log) => log.status === "failed")).toHaveLength(1);

      // Not auto-resolved, and not a dead end: pressing again asks the site again.
      expect(await publishArticle(s.websiteId, s.post.id)).toMatchObject({ ok: true, data: { publishedUrl: null } });
      const [again] = await handOver();
      expect(again.dispatch.id).not.toBe(handed.dispatch.id);
      expect(again.existingDraft).toEqual({ delivered: true });

      // Somebody published it in WordPress meanwhile: true, recorded, and marked as not this revision's doing.
      await report({ articleId: s.post.id, dispatchId: again.dispatch.id, url: LIVE_URL, remoteId: 7, status: "publish", outcome: "published_in_wordpress" });
      expect(await row(s.post.id)).toMatchObject({ status: "published", publishedUrl: LIVE_URL, publishRequested: null, error: null });
      expect((await dispatches(s.post.id)).find((dispatch) => dispatch.id === again.dispatch.id)?.requestSnapshot).toMatchObject({ publishedInWordPress: true });
    });

    it.each(["draft_changed", "post_changed", "post_unverified"] as const)("%s on the plugin: said once, offered to nobody again, and the daily release leaves it", async (refusal) => {
      const s = await heldDraft();
      await publishArticle(s.websiteId, s.post.id);
      const [handed] = await handOver();
      const before = bell.sent.length;
      const body = { articleId: s.post.id, dispatchId: handed.dispatch.id, url: null, remoteId: 7, error: refusal, status: "draft", outcome: refusal };
      expect(await (await report(body)).json()).toEqual({ ok: true, recorded: refusal });
      expect(await row(s.post.id)).toMatchObject({ publishRequested: null, error: DRAFT_REFUSALS[refusal] });
      const attempts = (await dispatches(s.post.id)).length;

      for (let day = 0; day < 3; day++) {
        expect(await dailyReleaseSends(s.post.id)).toEqual([]);
        expect(await handOver()).toEqual([]);
      }
      expect(await dispatches(s.post.id)).toHaveLength(attempts);
      expect(bell.sent.length).toBe(before + 1);
      expect(vi.mocked(emailArticleFailed)).not.toHaveBeenCalled();
    });

    it.each(["draft_unverified", "post_trashed", "post_deleted"] as const)("%s: answered, nothing live, and its own text in all five languages", async (refusal) => {
      const s = await heldDraft();
      await publishArticle(s.websiteId, s.post.id);
      const [handed] = await handOver();
      await report({ articleId: s.post.id, dispatchId: handed.dispatch.id, url: null, remoteId: null, error: refusal, status: "draft", outcome: refusal });
      expect(await row(s.post.id)).toMatchObject({ status: "draft", publishedUrl: DRAFT_URL, publishRequested: null, error: DRAFT_REFUSALS[refusal] });
      expect(await handOver()).toEqual([]);
      for (const locale of ["en", "es", "fr", "it", "de"] as const) {
        const text = draftRefusalText(refusal, ARTICLE_DELIVERY[locale]);
        expect(text).toBeTruthy();
        expect(new Set((["draft_changed", "draft_unverified", "post_trashed", "post_deleted"] as const).map((key) => draftRefusalText(key, ARTICLE_DELIVERY[locale]))).size).toBe(4);
      }
    });

    it("an unknown outcome is no refusal, and a plain failure is retried rather than answered", async () => {
      const s = await heldDraft();
      await publishArticle(s.websiteId, s.post.id);
      const [handed] = await handOver();
      await report({ articleId: s.post.id, dispatchId: handed.dispatch.id, url: null, remoteId: 7, error: "The site database refused the change", status: "draft", outcome: "nonsense" });
      expect(await row(s.post.id)).toMatchObject({ status: "draft", publishRequested: "publish", error: "The site database refused the change" });
      expect(await handOver()).toHaveLength(1);
    });

    it("a double press: one delivery in flight, and the second is told so", async () => {
      const s = await heldDraft();
      await publishArticle(s.websiteId, s.post.id);
      expect(await handOver()).toHaveLength(1);
      expect(await publishArticle(s.websiteId, s.post.id)).toEqual({ ok: false, error: "Already being delivered." });
      expect(await handOver()).toEqual([]);
      expect((await dispatches(s.post.id)).filter((dispatch) => dispatch.status === "in_flight")).toHaveLength(1);
    });

    it("a lost response: the parked report settles its own hand-over, and a re-offer after the lease is answered once", async () => {
      const s = await heldDraft();
      await publishArticle(s.websiteId, s.post.id);
      const [first] = await handOver();
      const expire = () => test.db.update(publicationDispatches).set({ claimedAt: new Date(Date.now() - IN_FLIGHT_TIMEOUT_MS - 60_000) }).where(eq(publicationDispatches.id, first.dispatch.id));

      // The plugin published, its report never arrived, and the lease ran out.
      await expire();
      const [second] = await handOver();
      expect(second.dispatch.id).not.toBe(first.dispatch.id);
      expect(second.dispatch.revision).toBe(first.dispatch.revision);
      expect(second.existingDraft).toEqual({ delivered: true });

      // On that re-offer the plugin finds it published. Then the parked report arrives, out of order.
      await live(s.post.id, second.dispatch.id);
      expect(await row(s.post.id)).toMatchObject({ status: "published", publishedUrl: LIVE_URL, publishRequested: null });
      const bells = bell.sent.length;
      expect(await (await live(s.post.id, first.dispatch.id)).json()).toEqual({ ok: true, recorded: "late" });
      expect(bell.sent).toHaveLength(bells);
      expect((await dispatches(s.post.id)).filter((dispatch) => dispatch.id !== first.dispatch.id && dispatch.status === "sent" && dispatch.remoteStatus === "publish")).toHaveLength(1);
      expect(await handOver()).toEqual([]);
    });

    it("exactly the sendable revision: a working copy with the team stays home, a newer approval clears the press", async () => {
      const s = await heldDraft();
      const approved = await row(s.post.id);
      await reopenArticle({ articleId: s.post.id, expectedVersion: approved.reviewVersion, actorEmail: ADMIN });
      await test.db.update(articles).set({ title: STAFF_TITLE, bodyHtml: `<p>${BODY}</p>`, metaDescription: "SECRETEXCERPT" }).where(eq(articles.id, s.post.id));

      expect((await publishArticle(s.websiteId, s.post.id)).ok).toBe(true);
      const [handed] = await handOver();
      expect(handed).toMatchObject({ title: "Approved title", dispatch: { revision: reviewHash(approved) } });
      expect(leakIn(handed)).toEqual([]);
      await live(s.post.id, handed.dispatch.id);

      // Pressed, and before the plugin collected it the team approved something newer: the press covered the older one.
      const other = await heldDraft();
      await publishArticle(other.websiteId, other.post.id);
      const current = await row(other.post.id);
      await reopenArticle({ articleId: other.post.id, expectedVersion: current.reviewVersion, actorEmail: ADMIN });
      await test.db.update(articles).set({ bodyHtml: "<p>Newer text</p>" }).where(eq(articles.id, other.post.id));
      await approve(other.post.id);
      expect((await row(other.post.id)).publishRequested).toBeNull();
      expect(await handOver()).toEqual([]);

      // Its own press then carries that revision, for the plugin to write to the same post if the draft is unchanged.
      await publishArticle(other.websiteId, other.post.id);
      const [newer] = await handOver();
      expect(newer.dispatch.revision).toBe(reviewHash(await row(other.post.id)));
      expect(newer.dispatch.revision).not.toBe(reviewHash(current));
      expect(newer.html).toContain("Newer text");
    });

    it("the same revision asked for live, but stored as a draft, is not \"already there\"", async () => {
      const s = await heldDraft();
      await test.db.update(publicationDispatches).set({ requestedStatus: "publish" }).where(eq(publicationDispatches.articleId, s.post.id));
      expect((await publishArticle(s.websiteId, s.post.id)).ok).toBe(true);
      expect(await handOver()).toHaveLength(1);
    });

    it("plugin 1.9.0 or older: no press taken, no instruction it would misread, and the customer is told to update", async () => {
      const s = await heldDraft("1.9.0");
      expect(await publishArticle(s.websiteId, s.post.id)).toEqual({ ok: false, error: PLUGIN_DRAFT_MESSAGE });
      expect((await row(s.post.id)).publishRequested).toBeNull();

      // Even a press recorded some other way goes nowhere: it would overwrite the draft and leave it a draft.
      await test.db.update(articles).set({ publishRequested: "publish" }).where(eq(articles.id, s.post.id));
      expect(await handOver("1.9.0")).toEqual([]);
      expect(await handOver("1.5.0")).toEqual([]);
      expect(await dueArticlesForPlugin(s.websiteId, 5, new Date(), { updates: false })).toEqual([]);
      expect((await dispatches(s.post.id)).filter((dispatch) => dispatch.status === "in_flight")).toEqual([]);

      const t = getMessages("it").app;
      expect(actionErrorText(PLUGIN_DRAFT_MESSAGE, { t: t.editor, tWorkspace: t.workspace, tImage: t.image, delivery: ARTICLE_DELIVERY.it })).toBe(ARTICLE_DELIVERY.it.pluginDraftNote);

      // Never delivered: an older plugin still creates it as before, with nothing it does not know.
      const fresh = await scene({ plugin: true, fields: { reviewStatus: "pending", researchReviewRequired: false } });
      await test.db.update(integrationKeys).set({ siteInfo: "6.4.3 / plugin 1.9.0" }).where(eq(integrationKeys.websiteId, fresh.websiteId));
      await approve(fresh.post.id);
      await publishArticle(fresh.websiteId, fresh.post.id);
      const [created] = await handOver("1.9.0");
      expect(created.status).toBe("publish");
      expect(created).not.toHaveProperty("existingDraft");
    });

    it("never delivered, on a current plugin: it may find a post whose report was lost, and otherwise creates one", async () => {
      const s = await scene({ plugin: true, fields: { reviewStatus: "pending", researchReviewRequired: false } });
      await test.db.update(integrationKeys).set({ siteInfo: "6.4.3 / plugin 1.10.0" }).where(eq(integrationKeys.websiteId, s.websiteId));
      await approve(s.post.id);
      await publishArticle(s.websiteId, s.post.id);
      expect((await handOver())[0].existingDraft).toEqual({ delivered: false });
    });

    it("automatic paths never publish a draft: only a person's press does", async () => {
      const s = await heldDraft("1.10.0", { autoPublish: true, publishAs: "draft", plannedInDays: -1 });
      expect(await handOver()).toEqual([]);
      expect(await dueArticlesForPlugin(s.websiteId, 5, new Date(), { updates: true })).toEqual([]);
      // An approval releases nothing onto a post already there.
      expect(await releaseAfterApproval(s.post.id)).toBe("customer_publishes");
      // A leftover press for a draft is not this one.
      await test.db.update(articles).set({ publishRequested: "draft" }).where(eq(articles.id, s.post.id));
      expect(await handOver()).toEqual([]);
      // An automatic send of a draft not delivered yet carries no instruction.
      const fresh = await scene({ plugin: true, autoPublish: true, publishAs: "draft", plannedInDays: -1, fields: { reviewStatus: "pending", researchReviewRequired: false } });
      await test.db.update(integrationKeys).set({ siteInfo: "6.4.3 / plugin 1.10.0" }).where(eq(integrationKeys.websiteId, fresh.websiteId));
      await approve(fresh.post.id);
      const [sent] = await handOver();
      expect(sent.status).toBe("draft");
      expect(sent).not.toHaveProperty("existingDraft");
    });

    it("with the switch off, as before: a delivered draft is not in the feed, and nothing carries the instruction", async () => {
      const s = await heldDraft();
      await twoStep(false);
      await test.db.update(articles).set({ publishRequested: "publish" }).where(eq(articles.id, s.post.id));
      expect(await dueArticlesForPlugin(s.websiteId, 5, new Date(), { updates: true })).toEqual([]);
      expect(await handOver()).toEqual([]);
    });
  });

  it("a rewrite of a post that is live (the row reads draft) can still be updated: the last delivery says it is live", async () => {
    const s = await scene({ plugin: true, fields: { status: "draft", publishedUrl: "https://site.test/live-rewrite", reviewStatus: "pending", researchReviewRequired: false } });
    await test.db.update(integrationKeys).set({ siteInfo: "6.4.3 / plugin 1.10.0" }).where(eq(integrationKeys.websiteId, s.websiteId));
    await test.db.insert(publicationDispatches).values({ articleId: s.post.id, websiteId: s.websiteId, channel: "plugin", trigger: "manual", revisionHash: "older", requestedStatus: "publish", status: "sent", remoteStatus: "publish", claimedAt: new Date() });
    await approve(s.post.id);
    expect((await publishArticle(s.websiteId, s.post.id)).ok).toBe(true);
    expect((await (await pluginPull()).json()).articles).toHaveLength(1);
  });

  it("switch-on clears a press left on a delivered article: the first poll overwrites nothing, and the dry run counts it", async () => {
    await twoStep(false);
    const s = await scene({ plugin: true, fields: { status: "published", publishedUrl: "https://site.test/stale", reviewStatus: null, researchReviewRequired: false, publishRequested: "publish" } });
    const { STALE_PRESS_QUERY } = await import("../../../scripts/two-step-transition-dry-run.mjs");
    const counted = async () => (await test.client.query<{ articles: number }>(STALE_PRESS_QUERY)).rows[0].articles;
    expect(await counted()).toBeGreaterThan(0);
    await on();
    expect((await row(s.post.id)).publishRequested).toBeNull();
    expect(await counted()).toBe(0);
    expect((await (await pluginPull()).json()).articles).toEqual([]);
    expect(await test.db.select().from(publicationDispatches).where(eq(publicationDispatches.articleId, s.post.id))).toEqual([]);
  });

  it("with the switch off, the plugin's feed is as it was: never a live post", async () => {
    const s = await scene({ plugin: true, fields: { status: "published", publishedUrl: "https://site.test/r", reviewStatus: null, researchReviewRequired: false, publishRequested: "publish" } });
    await twoStep(false);
    expect(await dueArticlesForPlugin(s.websiteId, 5, new Date(), { updates: true })).toEqual([]);
  });

  it("the reopening rule, as stated: a stored revision stays in force, so an automatic site still sends the old text on its day", async () => {
    const s = await scene({ autoPublish: true, plannedInDays: -1 });
    await approve(s.post.id);
    const approved = await row(s.post.id);
    await reopenArticle({ articleId: s.post.id, expectedVersion: approved.reviewVersion, actorEmail: ADMIN });
    expect(await dailyReleaseSends(s.post.id)).toHaveLength(1);
    expect(sendableRevision(await row(s.post.id))).toMatchObject({ ok: true, from: "stored", hash: reviewHash(approved) });
  });
});
