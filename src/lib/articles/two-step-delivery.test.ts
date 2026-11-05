import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  articles,
  backlinkRequests,
  calendarItems,
  integrationKeys,
  integrations,
  networkSites,
  placements,
  platformControls,
  publicationDispatches,
  publishLogs,
  websites,
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
const library = vi.hoisted(() => ({ images: [] as { url: string; name: string }[] }));
const cms = vi.hoisted(() => ({
  integrationId: "",
  posts: [] as { title: string; contentHtml: string; status: string }[],
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
import { publishArticleJob } from "@/inngest/functions/publish-article";
import { publishDueDrafts } from "@/inngest/functions/scheduled-articles";
import { ResearchPanel } from "@/components/articles/research-panel";
import { getArticle, listArticles, regenerateArticle, updateArticle } from "@/lib/articles/actions";
import { listReusableImages, removeArticleImage, updateArticleImageAlt } from "@/lib/articles/image-actions";
import { prepareStoredArticle } from "@/lib/articles/internal-links";
import { notifyReady, releaseAfterApproval } from "@/lib/articles/release";
import { approveArticleResearch } from "@/lib/articles/research-actions";
import { checkReleasable, PREPARING_MESSAGE, reviewHash } from "@/lib/articles/review";
import { listGiven } from "@/lib/backlinks/actions";
import { approveArticle, editReviewedArticle, reopenArticle } from "@/lib/backlinks/managed";
import { setParticipation } from "@/lib/backlinks/network-settings";
import { READ_TOOLS } from "@/lib/chat/tools";
import { getNextActions } from "@/lib/dashboard/next-actions";
import { getDashboardOverview } from "@/lib/dashboard/overview";
import { dueArticlesForPlugin } from "@/lib/plugin/due";
import { connectProvider, publishArticle } from "@/lib/publishing/actions";
import { switchControl, writeControl } from "@/lib/publishing/controls";
import { claimDispatch, type DispatchTrigger } from "@/lib/publishing/dispatch";
import { pendingFirstArticle } from "@/lib/publishing/policy";
import { ProviderError } from "@/lib/publishing/provider";
import { listLinks } from "@/lib/reporting/backlinks";
import { getTasks } from "@/lib/tasks/tasks";
import { NEW_SITE_DEFAULTS, newSiteDefaults } from "@/lib/websites/new-site-defaults";

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
    await test.db.insert(integrationKeys).values({ websiteId, name: "k", keyHash: randomUUID(), keyPrefix: "k", lastUsedAt: new Date() });
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
const pluginPull = () => pluginArticles(new NextRequest("https://app.test/api/plugin/articles", { headers: { "x-integration-key": "k", "x-repget-plugin-version": "1.9.0" } }));
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
    expect(actions.map((action) => action.kind)).not.toContain("ready");
    expect(leakIn(actions)).toEqual([]);

    const tasks = await getTasks(s.websiteId, s.orgId, false);
    expect(tasks?.work.find((task) => task.id === "drafts")?.count).toBe(0);
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
    expect((await getNextActions(s.websiteId, s.orgId, false)).map((action) => action.kind)).toContain("ready");

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

  it("the CMS's copy of the header picture does not lapse the approval or count as a new revision", async () => {
    const s = await scene();
    await approveAndRelease(s.post.id);
    await runJob(s);
    const after = await row(s.post.id);
    expect(after.imageUrl).toBe("https://site.test/m1.jpg");
    expect(after.reviewApprovedHash).toBe(reviewHash(after));
    expect(after.researchApprovedHash).toBe(reviewHash(after));
    const [sent] = await test.db.select().from(publicationDispatches).where(eq(publicationDispatches.articleId, s.post.id));
    expect(sent.revisionHash).toBe(reviewHash(after));
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
    cms.error = new ProviderError("The site refused it", "rejected", 422);
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

  it("a new website starts on the customer's own press under the flow; the default is unchanged with it off", () => {
    expect(newSiteDefaults(true)).toMatchObject({ autoPublish: false, publishAs: "live", tableOfContents: true });
    expect(newSiteDefaults(false)).toBe(NEW_SITE_DEFAULTS);
    expect(NEW_SITE_DEFAULTS.autoPublish).toBe(true);
  });

  it("automatic, not connected: ready, and told to connect; nothing pretends", async () => {
    const s = await scene({ autoPublish: true, plannedInDays: 0, connected: false });
    expect(await approveAndRelease(s.post.id)).toBe("nothing_connected");
    expect(bell.sent[0].body).toContain("Connect your website");
  });
});

/* ------------------------------------------------------------------------ */

describe("a later change, and stale work", () => {
  it("the customer's edit goes back to the team: held again, nothing asked, ready again after their approval", async () => {
    const s = await scene();
    await approveAndRelease(s.post.id);
    expect((await updateArticle(s.websiteId, s.post.id, { bodyHtml: "<p>My own sentence.</p>" })).ok).toBe(true);

    const held = await row(s.post.id);
    expect(held).toMatchObject({ reviewStatus: "pending", reviewApprovedHash: null, bodyHtml: "<p>My own sentence.</p>" });
    expect((await checkReleasable(s.post.id)).ok).toBe(false);
    expect(await getArticle(s.websiteId, s.post.id)).toMatchObject({ preparing: "team", bodyHtml: null });
    expect(await publishArticle(s.websiteId, s.post.id)).toEqual({ ok: false, error: PREPARING_MESSAGE });
    expect(bell.sent).toHaveLength(1);

    await approveAndRelease(s.post.id);
    expect(bell.sent).toHaveLength(2);
    expect(await getArticle(s.websiteId, s.post.id)).toMatchObject({ preparing: null, bodyHtml: "<p>My own sentence.</p>" });
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

  it("the team's later edit or reopening holds it from the customer too", async () => {
    const s = await scene();
    await approve(s.post.id);
    const approved = await row(s.post.id);
    await reopenArticle({ articleId: s.post.id, expectedVersion: approved.reviewVersion, actorEmail: ADMIN });
    expect(await getArticle(s.websiteId, s.post.id)).toMatchObject({ preparing: "team", bodyHtml: null });
  });

  it("an approval that no longer matches (stale): held, and not delivered by any path", async () => {
    const s = await scene({ autoPublish: true, plannedInDays: -1 });
    await approve(s.post.id);
    await test.db.update(articles).set({ bodyHtml: "<p>Changed behind the gate SECRET</p>" }).where(eq(articles.id, s.post.id));
    expect(await getArticle(s.websiteId, s.post.id)).toMatchObject({ preparing: "team", bodyHtml: null });
    expect(leakIn(await listArticles(s.websiteId))).toEqual([]);
    expect(await checkReleasable(s.post.id)).toEqual({ ok: false, reason: "changed_since_approval" });
    expect(await dailyReleaseSends(s.post.id)).toEqual([]);
    expect(await runJob(s, "automatic")).toEqual({ held: "changed_since_approval" });
    expect(cms.posts).toEqual([]);
  });

  it("a retry after an edit is held; the prepared revision never goes out", async () => {
    const s = await scene();
    await approve(s.post.id);
    const using = steps();
    await using.run("load-article", async () => {
      const first = await row(s.post.id);
      return {
        held: null, revisionHash: reviewHash(first), integrationId: cms.integrationId, providerId: "wordpress", remoteId: null, industry: null, image: null,
        post: { title: first.title, contentHtml: first.bodyHtml, slug: first.slug, excerpt: first.metaDescription, status: "publish" },
      };
    });
    await updateArticle(s.websiteId, s.post.id, { bodyHtml: "<p>Newer text</p>" });
    // Its sources' approval was for the earlier text too, and that is checked first.
    expect(await runJob(s, "manual", using)).toEqual({ held: "changed_since_approval" });
    expect((await row(s.post.id)).reviewStatus).toBe("pending");
    expect(cms.posts).toEqual([]);
  });

  it("a press made for an older revision does not carry the new one out: the customer presses again", async () => {
    const s = await scene();
    await approve(s.post.id);
    const using = steps();
    await using.run("load-article", async () => {
      const first = await row(s.post.id);
      return {
        held: null, revisionHash: reviewHash(first), integrationId: cms.integrationId, providerId: "wordpress", remoteId: null, industry: null, image: null,
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

  it("a dead link repaired at sending keeps the approval of the sources, or the press would stick", async () => {
    const s = await scene({ fields: { bodyHtml: '<p>Text with <a href="#">a dead link</a>.</p>' } });
    await approve(s.post.id);
    const checked = await prepareStoredArticle(s.post.id, s.websiteId, { budgetMs: 0 });
    expect(checked?.changed).toBe(true);
    const after = await row(s.post.id);
    expect(after.bodyHtml).not.toContain('href="#"');
    expect(after.reviewStatus).toBe("approved");
    expect(after.researchApprovedHash).toBe(reviewHash(after));
    expect(await checkReleasable(s.post.id)).toEqual({ ok: true });
  });

  it("a change to a post already live: its text stays readable, Update waits for the team, and approval republishes nothing", async () => {
    const s = await scene({ autoPublish: true, fields: { status: "published", publishedUrl: "https://site.test/?p=9", reviewStatus: "approved", researchReviewRequired: false } });
    const published = await row(s.post.id);
    await test.db.update(articles).set({ reviewApprovedHash: reviewHash(published) }).where(eq(articles.id, s.post.id));
    expect((await updateArticle(s.websiteId, s.post.id, { bodyHtml: "<p>A later change</p>" })).ok).toBe(true);
    expect(await getArticle(s.websiteId, s.post.id)).toMatchObject({ preparing: null, bodyHtml: "<p>A later change</p>" });
    expect(await publishArticle(s.websiteId, s.post.id)).toEqual({ ok: false, error: PREPARING_MESSAGE });

    expect(await approveAndRelease(s.post.id)).toBe("customer_publishes");
    expect(jobs.queued).toEqual([]);
    expect(bell.sent[0].title).toMatch(/update is ready/);
  });

  it("an older live post with held sources goes to the team at the customer's press, not to the customer", async () => {
    const s = await scene({ fields: { status: "published", publishedUrl: "https://site.test/?p=9", reviewStatus: null } });
    expect(await publishArticle(s.websiteId, s.post.id)).toEqual({ ok: false, error: PREPARING_MESSAGE });
    expect((await row(s.post.id)).reviewStatus).toBe("pending");
  });
});

/* ------------------------------------------------------------------------ */

describe("switching it on", () => {
  const on = () => test.db.transaction((tx) => switchControl(tx, "two_step_articles", true, { reason: "test", actor: "test" }));

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
    expect(moved).toBe(4);

    const result = await on();
    expect(result.heldForReview - moving(before)).toBe(4);
    expect((await counted()).filter((row: { class: string }) => row.class.startsWith("moves_"))).toEqual([]);

    const statusOf = async (id: string) => (await row(id)).reviewStatus;
    expect(await statusOf(waitingForSources.id)).toBe("pending");
    expect(await statusOf(scheduledAuto.id)).toBe("pending");
    expect(await statusOf(approvedStale.id)).toBe("pending");
    expect((await row(approvedStale.id)).reviewApprovedHash).toBeNull();
    expect(await statusOf(approvedWaiting.id)).toBe("pending");

    expect(await statusOf(manual.id)).toBeNull();
    expect(await statusOf(pressed.id)).toBeNull();
    expect(await statusOf(live.id)).toBeNull();
    expect(await statusOf(cmsDraft.id)).toBeNull();
    expect(await statusOf(queue.id)).toBe("pending");
    expect(await statusOf(approvedOk.id)).toBe("approved");
    expect(await statusOf(inFlight.id)).toBeNull();

    // Nothing was approved, sent or announced by switching.
    expect((await row(waitingForSources.id)).reviewApprovedHash).toBeNull();
    expect((await row(live.id)).publishedUrl).toBe("https://site.test/a");
    expect(jobs.queued).toEqual([]);
    expect(inngestMock.send).not.toHaveBeenCalled();
    expect(bell.sent).toEqual([]);
  });

  it("an older draft the switch left alone cannot go out automatically, only by the customer's press", async () => {
    const s = await scene({ autoPublish: true, fields: { reviewStatus: null, researchReviewRequired: false } });
    expect(await claimDispatch({ articleId: s.post.id, websiteId: s.websiteId, channel: "direct", trigger: "automatic" })).toEqual({ ok: false, reason: "pending_review" });
    expect(await claimDispatch({ articleId: s.post.id, websiteId: s.websiteId, channel: "plugin", trigger: "plugin" })).toEqual({ ok: false, reason: "pending_review" });
    await expect(claimDispatch({ articleId: s.post.id, websiteId: s.websiteId, channel: "direct", trigger: "manual", requestedStatus: "publish" })).resolves.toMatchObject({ ok: true });
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
    expect(kinds).not.toContain("ready");
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
        held: null, revisionHash: reviewHash(first), integrationId: cms.integrationId, providerId: "wordpress", remoteId: null, industry: null, image: null,
        post: { title: first.title, contentHtml: first.bodyHtml, slug: first.slug, excerpt: first.metaDescription, status: "publish" },
      };
    });
    await updateArticle(s.websiteId, s.post.id, { bodyHtml: "<p>Newer</p>" });
    expect(await runJob(s, "manual", using)).toEqual({ held: "revision_changed" });
    expect(inngestMock.send).toHaveBeenCalledTimes(1);
  });
});
