import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  articles,
  calendarItems,
  integrationKeys,
  integrations,
  networkSites,
  platformControls,
  publicationDispatches,
  publishLogs,
  websites,
} from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { seedWebsite } from "@/test/fixtures";
import { NEW_SITE_DEFAULTS } from "@/lib/websites/new-site-defaults";

/**
 * The dispatch boundary (lib/publishing/dispatch.ts): every external send
 * re-checks the review gate, the exact revision, the schedule and the
 * freeze, in the transaction that records it as in flight - and edits wait
 * for it. Run against the real publish job with a simulated CMS whose calls
 * can do things mid-flight (an edit during the image upload, a lost answer).
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
vi.mock("@/lib/websites/fetch-page", () => ({
  fetchPage: vi.fn(async () => new Response("<html><title>x</title></html>", { status: 200, headers: { "content-type": "text/html" } })),
}));
const inngestMock = vi.hoisted(() => ({
  send: vi.fn(async () => ({ ids: ["evt"] })),
  createFunction: vi.fn((config: unknown, handler: unknown) => ({ config, handler })),
}));
vi.mock("@/inngest/client", () => ({ inngest: inngestMock }));
vi.mock("@/lib/plugin/sync", () => ({ nudgePluginIfDue: vi.fn(async () => "nothing-due"), recordSyncUrl: vi.fn(), triggerPluginSync: vi.fn(async () => "synced") }));
vi.mock("@/lib/notifications/create", () => ({ notify: vi.fn() }));
vi.mock("@/lib/publishing/credentials", () => ({
  resolveIntegration: vi.fn(async () => ({ integrationId: cms.integrationId, providerId: "wordpress" })),
  loadCredentialsById: vi.fn(async () => ({ integrationId: cms.integrationId, providerId: "wordpress", credentials: {} })),
}));
/** The saved header image the job re-uploads to the CMS. */
vi.mock("@/lib/net/safe-fetch", () => ({
  safeFetch: vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "content-type": "image/jpeg" } })),
}));

/** A simulated CMS. Each call can run a hook first - that is how "mid-flight" happens. */
const cms = vi.hoisted(() => ({
  integrationId: "",
  posts: new Map<string, { title: string; contentHtml: string; slug: string | null; status: string }>(),
  onUpload: null as null | (() => Promise<void>),
  onCreate: null as null | (() => Promise<void>),
  createError: null as null | Error,
  searchable: true,
  calls: [] as string[],
}));
vi.mock("@/lib/publishing/registry", async () => {
  const { ProviderError } = await import("@/lib/publishing/provider");
  void ProviderError;
  const provider = {
    uploadMedia: vi.fn(async () => {
      cms.calls.push("upload");
      if (cms.onUpload) await cms.onUpload();
      return { id: "m1", url: "https://site.test/m1.jpg" };
    }),
    createPost: vi.fn(async (_c: unknown, input: { title: string; contentHtml: string; slug: string | null; status: string }) => {
      cms.calls.push("create");
      if (cms.onCreate) await cms.onCreate();
      const id = String(cms.posts.size + 1);
      cms.posts.set(id, input);
      if (cms.createError) throw cms.createError;
      return { remoteId: id, remoteUrl: `https://site.test/?p=${id}`, status: input.status };
    }),
    updatePost: vi.fn(async (_c: unknown, remoteId: string, input: { title: string; contentHtml: string; slug: string | null; status: string }) => {
      cms.calls.push(`update:${remoteId}`);
      cms.posts.set(remoteId, input);
      return { remoteId, remoteUrl: `https://site.test/?p=${remoteId}`, status: input.status };
    }),
    // The ownership lookup: WordPress's text search, returning stored content (lib/publishing/ownership.ts).
    searchPostsByMarker: vi.fn(async (_c: unknown, term: string) => {
      cms.calls.push(`search:${term}`);
      return [...cms.posts]
        .filter(([, post]) => post.contentHtml.includes(term))
        .map(([id, post]) => ({ remoteId: id, remoteUrl: `https://site.test/?p=${id}`, status: post.status, rawContent: post.contentHtml }));
    }),
  };
  return {
    getProvider: () => (cms.searchable ? provider : { ...provider, searchPostsByMarker: undefined }),
  };
});
const keyMock = vi.hoisted(() => ({ websiteId: "" }));
vi.mock("@/lib/plugin/keys", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/plugin/keys")>()),
  resolveIntegrationKey: vi.fn(async () => ({ keyId: "k", websiteId: keyMock.websiteId, organizationId: "o", websiteDomain: "host.test" })),
}));

import { GET as pluginArticles } from "@/app/api/plugin/articles/route";
import { POST as pluginPublished } from "@/app/api/plugin/published/route";
import { publishArticleJob } from "@/inngest/functions/publish-article";
import { publishDueDrafts } from "@/inngest/functions/scheduled-articles";
import { updateArticle } from "@/lib/articles/actions";
import { reviewHash } from "@/lib/articles/review";
import { approveArticle, reopenArticle } from "@/lib/backlinks/managed";
import { confirmNotPublished } from "@/lib/publishing/actions";
import { writeControl } from "@/lib/publishing/controls";
import { claimDispatch, IN_FLIGHT_TIMEOUT_MS, settleDispatch } from "@/lib/publishing/dispatch";
import { ProviderError } from "@/lib/publishing/provider";

let test: TestDb;
const ADMIN = "admin@repget.test";

beforeAll(async () => {
  vi.stubEnv("ADMIN_EMAILS", ADMIN);
  test = await createTestDb();
  state.db = test.db;
});

beforeEach(() => {
  cms.posts.clear();
  cms.calls.length = 0;
  cms.onUpload = null;
  cms.onCreate = null;
  cms.createError = null;
  cms.searchable = true;
  inngestMock.send.mockClear();
});

afterEach(async () => {
  await test.db.delete(platformControls);
});

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

/**
 * Inngest's replay: a step that finished is not run again - its recorded
 * result is returned - and a step that threw runs again on the next attempt.
 * Shared across attempts of one run.
 */
function replayingSteps() {
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

async function scene(options: { reviewed?: boolean; plannedFor?: Date | null; autoPublish?: boolean; image?: boolean; slug?: string | null } = {}) {
  const { orgId, websiteId } = await seedWebsite(test);
  const domain = `d-${randomUUID().slice(0, 8)}.test`;
  await test.db
    .update(websites)
    .set({ ...NEW_SITE_DEFAULTS, url: `https://${domain}`, domain, autoPublish: options.autoPublish ?? true, poweredByLink: false })
    .where(eq(websites.id, websiteId));
  await test.db.insert(networkSites).values({ websiteId, acceptingLinks: true, monthlyCap: 3 });
  const [integration] = await test.db.insert(integrations).values({ websiteId, kind: "wordpress", status: "connected" }).returning();
  cms.integrationId = integration.id;
  // An earlier article went out already, so the first-article rule is spent.
  await test.db.update(websites).set({ firstArticleSentAt: new Date() }).where(eq(websites.id, websiteId));
  let calendarItemId: string | null = null;
  if (options.plannedFor !== undefined && options.plannedFor !== null) {
    const [item] = await test.db.insert(calendarItems).values({ websiteId, title: "Planned", scheduledFor: options.plannedFor }).returning();
    calendarItemId = item.id;
  }
  const [post] = await test.db
    .insert(articles)
    .values({
      websiteId,
      calendarItemId,
      title: "Wedding films",
      slug: options.slug === undefined ? `wedding-films-${randomUUID().slice(0, 6)}` : options.slug,
      status: "draft",
      bodyHtml: "<p>Wedding films last for decades.</p>",
      imageUrl: options.image ? "https://storage.test/header.jpg" : null,
      imageAlt: options.image ? "A couple" : null,
      reviewStatus: options.reviewed ? "pending" : null,
    })
    .returning();
  return { orgId, websiteId, post };
}

async function approve(articleId: string) {
  const [row] = await test.db.select().from(articles).where(eq(articles.id, articleId));
  await approveArticle({ articleId, expectedVersion: row.reviewVersion, actorEmail: ADMIN });
}

type Job = { handler: (ctx: unknown) => Promise<unknown> };
function run(
  s: { orgId: string; websiteId: string; post: { id: string } },
  steps = replayingSteps(),
  data: Record<string, unknown> = {},
) {
  return (publishArticleJob as unknown as Job).handler({
    event: { id: `evt-${randomUUID()}`, data: { articleId: s.post.id, websiteId: s.websiteId, organizationId: s.orgId, status: "publish", trigger: "manual", ...data } },
    step: steps,
    logger,
  });
}

async function dispatches(articleId: string) {
  return test.db.select().from(publicationDispatches).where(eq(publicationDispatches.articleId, articleId)).orderBy(publicationDispatches.claimedAt);
}

function asMember(userId: string, orgId: string) {
  state.session = { user: { id: userId, email: `${userId}@example.test`, emailVerified: true }, session: { id: `s_${userId}`, activeOrganizationId: orgId } };
}

/* ------------------------------------------------------------------------ */

describe("an approval or revision that changes after preparation", () => {
  it("approved, then edited during the image upload: nothing is sent", async () => {
    const s = await scene({ reviewed: true, image: true });
    await approve(s.post.id);
    // The customer saves an edit while the job is uploading the image.
    cms.onUpload = async () => {
      cms.onUpload = null;
      await test.db.transaction(async (tx) => {
        const { lockForEdit } = await import("@/lib/publishing/dispatch");
        const { syncApproval } = await import("@/lib/articles/review");
        await lockForEdit(tx, s.post.id);
        await tx.update(articles).set({ bodyHtml: "<p>Edited after approval.</p>" }).where(eq(articles.id, s.post.id));
        await syncApproval(s.post.id, tx);
      });
    };
    await expect(run(s)).resolves.toEqual({ held: "pending_review" });
    expect(cms.calls).toEqual(["upload"]);
    expect(await dispatches(s.post.id)).toEqual([]);
  });

  it("approved, then reopened by an administrator during the image upload: nothing is sent", async () => {
    const s = await scene({ reviewed: true, image: true });
    await approve(s.post.id);
    cms.onUpload = async () => {
      cms.onUpload = null;
      const [row] = await test.db.select().from(articles).where(eq(articles.id, s.post.id));
      await reopenArticle({ articleId: s.post.id, expectedVersion: row.reviewVersion, actorEmail: ADMIN });
    };
    await expect(run(s)).resolves.toEqual({ held: "pending_review" });
    expect(cms.calls).toEqual(["upload"]);
  });

  it("an unreviewed article edited mid-job is not sent stale - a fresh job is queued for the new revision", async () => {
    const s = await scene({ image: true });
    cms.onUpload = async () => {
      cms.onUpload = null;
      await test.db.update(articles).set({ title: "A newer title" }).where(eq(articles.id, s.post.id));
    };
    await expect(run(s)).resolves.toEqual({ held: "revision_changed" });
    expect(cms.calls).toEqual(["upload"]);
    const requeued = inngestMock.send.mock.calls.flat() as Array<{ name: string; data: Record<string, unknown> }>;
    expect(requeued).toEqual([expect.objectContaining({ name: "article/publish.requested", data: expect.objectContaining({ articleId: s.post.id, trigger: "manual" }) })]);
    // The fresh job sends the new revision.
    await expect(run(s)).resolves.toMatchObject({ status: "publish" });
    expect([...cms.posts.values()].map((p) => p.title)).toEqual(["A newer title"]);
  });

  it("a failed send retried after a reopen, with the earlier steps replayed from cache: the retry sends nothing", async () => {
    const s = await scene({ reviewed: true });
    await approve(s.post.id);
    const steps = replayingSteps();
    cms.createError = new ProviderError("Sorry, you are not allowed to publish", "permission", 403);
    await expect(run(s, steps)).rejects.toThrow(/not allowed/);
    // A refusal the site answered: provably nothing created, recorded as failed.
    expect((await dispatches(s.post.id)).map((d) => d.status)).toEqual(["failed"]);

    const [row] = await test.db.select().from(articles).where(eq(articles.id, s.post.id));
    await reopenArticle({ articleId: s.post.id, expectedVersion: row.reviewVersion, actorEmail: ADMIN });
    cms.createError = null;
    // Same run, next attempt: load-article and upload-image come from cache.
    await expect(run(s, steps)).resolves.toEqual({ held: "pending_review" });
    expect(cms.calls).toEqual(["create"]);
  });

  it("a failed send retried after the text changed: the old prepared HTML is never sent", async () => {
    const s = await scene();
    const steps = replayingSteps();
    cms.createError = new ProviderError("Bad Gateway", "unknown", 422);
    await expect(run(s, steps)).rejects.toThrow();
    await test.db.update(articles).set({ bodyHtml: "<p>Corrected text.</p>" }).where(eq(articles.id, s.post.id));
    cms.createError = null;
    cms.posts.clear();
    await expect(run(s, steps)).resolves.toEqual({ held: "revision_changed" });
    expect(cms.posts.size).toBe(0);
  });
});

describe("the schedule is checked at dispatch, for automatic sends", () => {
  it("a planned date moved later after the release was queued: held until the day", async () => {
    const s = await scene({ plannedFor: new Date(Date.now() - 86_400_000) });
    const steps = replayingSteps();
    // Queued automatically for today; the customer then moves the date.
    const [item] = await test.db.select({ id: articles.calendarItemId }).from(articles).where(eq(articles.id, s.post.id));
    await test.db.update(calendarItems).set({ scheduledFor: new Date(Date.now() + 3 * 86_400_000) }).where(eq(calendarItems.id, item.id!));
    await expect(run(s, steps, { trigger: "automatic" })).resolves.toEqual({ held: "not_due" });
    expect(cms.calls).toEqual([]);
  });

  it("automatic publishing switched off before dispatch: held", async () => {
    const s = await scene();
    await test.db.update(websites).set({ autoPublish: false }).where(eq(websites.id, s.websiteId));
    await expect(run(s, replayingSteps(), { trigger: "automatic" })).resolves.toEqual({ held: "auto_publish_off" });
  });

  it("a Publish press is the customer's decision: no date rule, but the gate still applies", async () => {
    const s = await scene({ plannedFor: new Date(Date.now() + 5 * 86_400_000), autoPublish: false });
    await expect(run(s, replayingSteps(), { trigger: "manual" })).resolves.toMatchObject({ status: "publish" });
    const reviewed = await scene({ reviewed: true });
    await expect(run(reviewed, replayingSteps(), { trigger: "manual" })).resolves.toEqual({ held: "pending_review" });
  });

  it("an event from the previous build (no trigger) gets the strict automatic rule, never a press's - and the gate", async () => {
    // Nothing says whether a person pressed Publish or a schedule queued it.
    const s = await scene({ plannedFor: new Date(Date.now() + 5 * 86_400_000) });
    await expect(run(s, replayingSteps(), { trigger: undefined })).resolves.toEqual({ held: "not_due" });
    const due = await scene({ plannedFor: new Date(Date.now() - 86_400_000) });
    await expect(run(due, replayingSteps(), { trigger: undefined })).resolves.toMatchObject({ status: "publish" });
    const reviewed = await scene({ reviewed: true });
    await expect(run(reviewed, replayingSteps(), { trigger: undefined })).resolves.toEqual({ held: "pending_review" });
  });
});

describe("one revision, one send", () => {
  it("two claims for the same article: one wins; a repeat of the sent revision sends nothing", async () => {
    const s = await scene();
    const claim = () =>
      claimDispatch({ articleId: s.post.id, websiteId: s.websiteId, channel: "direct", trigger: "manual", requestedStatus: "publish" });
    const [a, b] = await Promise.all([claim(), claim()]);
    expect([a.ok, b.ok].sort()).toEqual([false, true]);
    const loser = (a.ok ? b : a) as { ok: false; reason: string };
    expect(loser.reason).toBe("in_flight");
    const winner = (a.ok ? a : b) as { ok: true; dispatchId: string };
    await settleDispatch(winner.dispatchId, { status: "sent", remoteId: "9", remoteUrl: "https://site.test/?p=9" });
    await expect(claim()).resolves.toEqual({ ok: false, reason: "already_sent" });
  });

  it("the job run twice for the same revision creates one post", async () => {
    const s = await scene();
    await expect(run(s)).resolves.toMatchObject({ status: "publish" });
    await expect(run(s)).resolves.toEqual({ held: "already_sent" });
    expect(cms.calls).toEqual(["create"]);
  });

  it("a new revision of a published article is an update of the same post", async () => {
    const s = await scene();
    await run(s);
    await test.db.update(articles).set({ title: "Updated" }).where(eq(articles.id, s.post.id));
    await expect(run(s)).resolves.toMatchObject({ status: "publish" });
    expect(cms.calls).toEqual(["create", "update:1"]);
  });
});

describe("edits wait while a revision is in flight", () => {
  it("a customer edit and an administrator reopen are refused mid-send, and allowed once it is settled", async () => {
    const s = await scene({ reviewed: true });
    await approve(s.post.id);
    const claim = await claimDispatch({ articleId: s.post.id, websiteId: s.websiteId, channel: "direct", trigger: "manual", requestedStatus: "publish" });
    if (!claim.ok) throw new Error(claim.reason);

    asMember("u_editor", s.orgId);
    const { member, user } = await import("@/lib/db/auth-tables");
    await test.db.insert(user).values({ id: "u_editor_" + s.orgId, name: "E", email: `${randomUUID()}@e.test`, emailVerified: true, createdAt: new Date(), updatedAt: new Date() });
    await test.db.insert(member).values({ id: `m_${randomUUID()}`, organizationId: s.orgId, userId: "u_editor_" + s.orgId, role: "owner", createdAt: new Date() });
    asMember("u_editor_" + s.orgId, s.orgId);
    await expect(updateArticle(s.websiteId, s.post.id, { title: "Too late" })).resolves.toEqual({
      ok: false,
      error: expect.stringMatching(/being delivered/),
    });
    const [row] = await test.db.select().from(articles).where(eq(articles.id, s.post.id));
    await expect(reopenArticle({ articleId: s.post.id, expectedVersion: row.reviewVersion, actorEmail: ADMIN })).rejects.toThrow(/can no longer be recalled/);
    expect(row.title).toBe("Wedding films");

    await settleDispatch(claim.dispatchId, { status: "sent", remoteId: "1", remoteUrl: "https://site.test/?p=1" });
    await expect(updateArticle(s.websiteId, s.post.id, { title: "After delivery" })).resolves.toEqual({ ok: true, data: null });
    const [after] = await test.db.select().from(articles).where(eq(articles.id, s.post.id));
    // Changed after approval: back in the review queue.
    expect(after).toMatchObject({ title: "After delivery", reviewStatus: "pending" });
  });

  it("a claim nobody settled stops blocking after the timeout, and its outcome is recorded as unknown", async () => {
    const s = await scene();
    const t0 = new Date();
    const claim = await claimDispatch({ articleId: s.post.id, websiteId: s.websiteId, channel: "direct", trigger: "manual", requestedStatus: "publish", now: t0 });
    expect(claim.ok).toBe(true);
    const later = new Date(t0.getTime() + IN_FLIGHT_TIMEOUT_MS + 1000);
    const again = await claimDispatch({ articleId: s.post.id, websiteId: s.websiteId, channel: "direct", trigger: "manual", requestedStatus: "publish", now: later, refuseAfterUncertain: true });
    expect(again).toEqual({ ok: false, reason: "uncertain_previous" });
    expect((await dispatches(s.post.id)).map((d) => d.status)).toEqual(["uncertain"]);
  });
});

describe("a send whose answer was lost", () => {
  it("is reconciled on the site before anything is created again", async () => {
    const s = await scene();
    const steps = replayingSteps();
    // The site created the post, but the answer never came back.
    cms.createError = new ProviderError("The site took too long to respond", "unreachable");
    await expect(run(s, steps)).rejects.toThrow(/too long/);
    expect((await dispatches(s.post.id)).map((d) => d.status)).toEqual(["uncertain"]);
    expect(cms.posts.size).toBe(1);

    cms.createError = null;
    await expect(run(s, steps)).resolves.toMatchObject({ status: "publish", remoteUrl: "https://site.test/?p=1" });
    // Found by its dispatch's marker - the same revision, so nothing is sent again, and no second post.
    expect(cms.calls.filter((c) => c === "create")).toHaveLength(1);
    expect(cms.posts.size).toBe(1);
    expect((await dispatches(s.post.id)).map((d) => d.status)).toEqual(["sent"]);
    const [row] = await test.db.select().from(articles).where(eq(articles.id, s.post.id));
    expect(row).toMatchObject({ status: "published", publishedUrl: "https://site.test/?p=1" });

    // A later revision is an UPDATE of that post.
    await test.db.update(articles).set({ title: "Revised" }).where(eq(articles.id, s.post.id));
    await expect(run(s)).resolves.toMatchObject({ status: "publish" });
    expect(cms.calls).toContain("update:1");
    expect(cms.posts.size).toBe(1);
  });

  it("a lookup that finds nothing is not proof: nothing is created, and it stays uncertain for a later lookup or a person", async () => {
    const s = await scene();
    const steps = replayingSteps();
    cms.createError = new ProviderError("Bad gateway", "unknown", 502);
    await expect(run(s, steps)).rejects.toThrow();
    // A 5xx that did NOT create it - but nothing on our side can know that.
    cms.posts.clear();
    cms.createError = null;
    await expect(run(s, steps)).resolves.toEqual({ held: "uncertain_previous" });
    expect(cms.calls.filter((c) => c === "create")).toHaveLength(1);
    expect((await dispatches(s.post.id)).map((d) => [d.status, d.lookupResult])).toEqual([["uncertain", "none"]]);
  });

  it("a site that cannot be searched waits for a person; their confirmation allows a new attempt", async () => {
    const s = await scene();
    cms.searchable = false;
    cms.createError = new ProviderError("connection reset", "unreachable");
    await expect(run(s)).rejects.toThrow();
    cms.createError = null;
    await expect(run(s)).resolves.toEqual({ held: "uncertain_previous" });
    const [held] = await test.db.select({ error: articles.error }).from(articles).where(eq(articles.id, s.post.id));
    expect(held.error).toMatch(/may already exist/);

    const { member, user } = await import("@/lib/db/auth-tables");
    const uid = `u_${randomUUID().slice(0, 8)}`;
    await test.db.insert(user).values({ id: uid, name: "E", email: `${uid}@e.test`, emailVerified: true, createdAt: new Date(), updatedAt: new Date() });
    await test.db.insert(member).values({ id: `m_${randomUUID()}`, organizationId: s.orgId, userId: uid, role: "owner", createdAt: new Date() });
    asMember(uid, s.orgId);
    await expect(confirmNotPublished(s.websiteId, s.post.id)).resolves.toEqual({ ok: true, data: null });
    await expect(run(s)).resolves.toMatchObject({ status: "publish" });
  });
});

describe("the publication freeze", () => {
  it("holds direct sends, the plugin feed and the scheduled release", async () => {
    const s = await scene({ plannedFor: new Date(Date.now() - 86_400_000) });
    await writeControl("publication_freeze", true, { reason: "rollback", actor: ADMIN });

    await expect(run(s, replayingSteps(), { trigger: "automatic" })).resolves.toEqual({ held: "frozen" });
    expect(await publishDueDrafts()).toBe(0);
    keyMock.websiteId = s.websiteId;
    await test.db.insert(integrationKeys).values({ websiteId: s.websiteId, keyHash: randomUUID(), keyPrefix: "seo_x" });
    const feed = await (await pluginArticles(new NextRequest("https://app.test/api/plugin/articles", { headers: { "x-integration-key": "seo_k" } }))).json();
    expect(feed.articles).toEqual([]);
    expect(cms.calls).toEqual([]);

    await writeControl("publication_freeze", false, { reason: "done", actor: ADMIN });
    await expect(run(s, replayingSteps(), { trigger: "automatic" })).resolves.toMatchObject({ status: "publish" });
  });
});

describe("the plugin hand-over", () => {
  async function pluginScene() {
    const s = await scene({ plannedFor: new Date(Date.now() - 86_400_000) });
    // Plugin sites have no direct connection.
    await test.db.delete(integrations).where(eq(integrations.websiteId, s.websiteId));
    await test.db.insert(integrationKeys).values({ websiteId: s.websiteId, keyHash: randomUUID(), keyPrefix: "seo_x" });
    keyMock.websiteId = s.websiteId;
    return s;
  }
  const poll = async () =>
    (await (await pluginArticles(new NextRequest("https://app.test/api/plugin/articles", { headers: { "x-integration-key": "seo_k" } }))).json()) as {
      articles: Array<{ id: string; title: string; html: string }>;
    };
  const ack = (body: Record<string, unknown>) =>
    pluginPublished(new NextRequest("https://app.test/api/plugin/published", { method: "POST", headers: { "x-integration-key": "seo_k" }, body: JSON.stringify(body) }));

  it("is a dispatch: in flight until acknowledged, edits wait, and the acknowledgement settles it", async () => {
    const s = await pluginScene();
    const first = await poll();
    expect(first.articles.map((a) => a.id)).toEqual([s.post.id]);
    expect((await dispatches(s.post.id)).map((d) => [d.channel, d.status])).toEqual([["plugin", "in_flight"]]);
    // Not handed out twice while the plugin works on it.
    expect((await poll()).articles).toEqual([]);

    await ack({ articleId: s.post.id, url: "https://site.test/wedding-films/", remoteId: 44, status: "publish" });
    expect((await dispatches(s.post.id)).map((d) => [d.status, d.remoteId])).toEqual([["sent", "44"]]);
  });

  it("an unacknowledged hand-over is offered again after the timeout, under the same dispatch for an older plugin", async () => {
    const s = await pluginScene();
    await poll();
    await test.db
      .update(publicationDispatches)
      .set({ claimedAt: new Date(Date.now() - IN_FLIGHT_TIMEOUT_MS - 60_000) })
      .where(eq(publicationDispatches.articleId, s.post.id));
    expect((await poll()).articles.map((a) => a.id)).toEqual([s.post.id]);
    // A pre-1.6 plugin reports by article only: the same revision stays one hand-over.
    expect((await dispatches(s.post.id)).map((d) => [d.status, d.protocol])).toEqual([["in_flight", "plugin_legacy"]]);
  });

  it("sends the revision it claimed: an article held for review is not handed over", async () => {
    const s = await pluginScene();
    await test.db.update(articles).set({ reviewStatus: "pending" }).where(eq(articles.id, s.post.id));
    expect((await poll()).articles).toEqual([]);
    await approve(s.post.id);
    const [row] = await test.db.select().from(articles).where(eq(articles.id, s.post.id));
    const [sent] = (await poll()).articles;
    expect(sent.title).toBe(row.title);
    const [d] = await test.db.select().from(publicationDispatches).where(and(eq(publicationDispatches.articleId, s.post.id), eq(publicationDispatches.status, "in_flight")));
    expect(d.revisionHash).toBe(reviewHash(row));
  });
});

describe("the record of what was sent", () => {
  it("every send records its revision, and the published log names the post", async () => {
    const s = await scene();
    await run(s);
    const [d] = await dispatches(s.post.id);
    const [row] = await test.db.select().from(articles).where(eq(articles.id, s.post.id));
    expect(d).toMatchObject({ status: "sent", channel: "direct", trigger: "manual", revisionHash: reviewHash(row), remoteId: "1" });
    const logs = await test.db.select().from(publishLogs).where(eq(publishLogs.articleId, s.post.id));
    expect(logs.map((l) => [l.status, l.remoteId])).toEqual([["published", "1"]]);
  });
});
