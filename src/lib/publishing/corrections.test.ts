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
 * Regression tests for the staging corrections:
 *   1. WordPress reconciliation proves ownership by the dispatch's own marker,
 *      never by a slug;
 *   2. plugin acknowledgements settle exactly the hand-over they report;
 *   4. the publishing mode is re-read at dispatch.
 * The simulated WordPress below behaves like the real one where it matters:
 * a taken slug gets a -2 suffix, a response can be lost after the post was
 * created, and a slow request can create its post later.
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
vi.mock("@/lib/plugin/sync", () => ({ nudgePluginIfDue: vi.fn(async () => "nothing-due"), recordSyncUrl: vi.fn(), triggerPluginSync: vi.fn(async () => "synced") }));
const notifyMock = vi.hoisted(() => ({ calls: [] as unknown[] }));
vi.mock("@/lib/notifications/create", () => ({ notify: vi.fn(async (n: unknown) => { notifyMock.calls.push(n); }) }));
vi.mock("@/lib/publishing/credentials", () => ({
  resolveIntegration: vi.fn(async () => ({ integrationId: wp.integrationId, providerId: "wordpress" })),
  loadCredentialsById: vi.fn(async () => ({ integrationId: wp.integrationId, providerId: "wordpress", credentials: {} })),
}));

type Post = { id: string; slug: string; title: string; content: string; status: string };
/** A simulated WordPress site. */
const wp = vi.hoisted(() => ({
  integrationId: "",
  posts: [] as Post[],
  nextId: 100,
  /** What the next create does: answer, lose the answer, refuse, or create LATER (after n lookups). */
  createMode: "ok" as "ok" | "lost_after_create" | "no_answer_nothing_created" | "delayed" | "refused",
  delayedAfterLookups: 0,
  pending: null as null | Post,
  lookups: 0,
  calls: [] as string[],
}));
vi.mock("@/lib/publishing/registry", async () => {
  const { ProviderError } = await import("@/lib/publishing/provider");
  const store = (input: { title: string; contentHtml: string; slug: string | null; status: string }): Post => {
    let slug = input.slug ?? input.title.toLowerCase().replace(/\W+/g, "-");
    // WordPress keeps slugs unique by suffixing.
    let n = 2;
    const base = slug;
    while (wp.posts.some((p) => p.slug === slug)) slug = `${base}-${n++}`;
    return { id: String(wp.nextId++), slug, title: input.title, content: input.contentHtml, status: input.status };
  };
  const materialiseDelayed = () => {
    if (wp.pending && wp.lookups >= wp.delayedAfterLookups) {
      wp.posts.push(wp.pending);
      wp.pending = null;
    }
  };
  return {
    getProvider: () => ({
      uploadMedia: vi.fn(async () => ({ id: "m1", url: "https://site.test/m1.jpg" })),
      createPost: vi.fn(async (_c: unknown, input: { title: string; contentHtml: string; slug: string | null; status: string }) => {
        wp.calls.push("create");
        if (wp.createMode === "no_answer_nothing_created") throw new ProviderError("The site took too long to respond", "unreachable");
        if (wp.createMode === "refused") throw new ProviderError("Sorry, you are not allowed to create posts.", "permission", 403);
        const post = store(input);
        if (wp.createMode === "delayed") {
          wp.pending = post;
          throw new ProviderError("The site took too long to respond", "unreachable");
        }
        wp.posts.push(post);
        if (wp.createMode === "lost_after_create") throw new ProviderError("connection reset", "unreachable");
        return { remoteId: post.id, remoteUrl: `https://site.test/${post.slug}/`, status: post.status };
      }),
      updatePost: vi.fn(async (_c: unknown, remoteId: string, input: { title: string; contentHtml: string; status: string }) => {
        wp.calls.push(`update:${remoteId}`);
        const post = wp.posts.find((p) => p.id === remoteId);
        if (!post) throw new ProviderError("Invalid post ID.", "not_found", 404);
        post.title = input.title;
        post.content = input.contentHtml;
        post.status = input.status;
        return { remoteId, remoteUrl: `https://site.test/${post.slug}/`, status: post.status };
      }),
      // The OLD lookup, by slug - kept so the old code path can be exercised.
      findPostBySlug: vi.fn(async (_c: unknown, slug: string) => {
        wp.lookups++;
        materialiseDelayed();
        const post = wp.posts.find((p) => p.slug === slug);
        return post ? { remoteId: post.id, remoteUrl: `https://site.test/${post.slug}/`, status: post.status } : null;
      }),
      // The ownership lookup: a search for RepGet's marker, returning each
      // candidate's raw content so the caller can check the marker itself.
      searchPostsByMarker: vi.fn(async (_c: unknown, term: string) => {
        wp.lookups++;
        materialiseDelayed();
        return wp.posts
          .filter((p) => p.content.includes(term))
          .map((p) => ({ remoteId: p.id, remoteUrl: `https://site.test/${p.slug}/`, status: p.status, rawContent: p.content }));
      }),
    }),
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
import { IN_FLIGHT_TIMEOUT_MS } from "@/lib/publishing/dispatch";

let test: TestDb;
beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});
beforeEach(() => {
  wp.posts = [];
  wp.nextId = 100;
  wp.createMode = "ok";
  wp.pending = null;
  wp.lookups = 0;
  wp.delayedAfterLookups = 0;
  wp.calls = [];
  notifyMock.calls = [];
  inngestMock.send.mockClear();
});
afterEach(async () => {
  await test.db.delete(platformControls);
});

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

async function scene(options: { slug?: string; plannedFor?: Date; publishAs?: "live" | "draft"; autoPublish?: boolean; plugin?: boolean } = {}) {
  const { orgId, websiteId } = await seedWebsite(test);
  const domain = `c-${randomUUID().slice(0, 8)}.test`;
  await test.db
    .update(websites)
    .set({ ...NEW_SITE_DEFAULTS, url: `https://${domain}`, domain, poweredByLink: false, publishAs: options.publishAs ?? "live", autoPublish: options.autoPublish ?? true, firstArticleSentAt: new Date() })
    .where(eq(websites.id, websiteId));
  await test.db.insert(networkSites).values({ websiteId, acceptingLinks: true, monthlyCap: 3 });
  if (options.plugin) {
    await test.db.insert(integrationKeys).values({ websiteId, keyHash: randomUUID(), keyPrefix: "seo_x" });
    keyMock.websiteId = websiteId;
  } else {
    const [integration] = await test.db.insert(integrations).values({ websiteId, kind: "wordpress", status: "connected" }).returning();
    wp.integrationId = integration.id;
  }
  const [item] = await test.db.insert(calendarItems).values({ websiteId, title: "t", scheduledFor: options.plannedFor ?? new Date(Date.now() - 86_400_000) }).returning();
  const [post] = await test.db
    .insert(articles)
    .values({ websiteId, calendarItemId: item.id, title: "Wedding films", slug: options.slug === undefined ? "wedding-films" : options.slug, status: "draft", bodyHtml: "<p>Our article.</p>" })
    .returning();
  return { orgId, websiteId, post };
}

type Job = { handler: (ctx: unknown) => Promise<unknown> };
const run = (s: { orgId: string; websiteId: string; post: { id: string } }, st = steps(), data: Record<string, unknown> = {}) =>
  (publishArticleJob as unknown as Job).handler({
    event: { id: `evt-${randomUUID()}`, data: { articleId: s.post.id, websiteId: s.websiteId, organizationId: s.orgId, status: "publish", trigger: "manual", ...data } },
    step: st,
    logger,
  });

const dispatches = (articleId: string) =>
  test.db.select().from(publicationDispatches).where(eq(publicationDispatches.articleId, articleId)).orderBy(publicationDispatches.claimedAt);

/* ------------------------------------------------------------------------ */

describe("1. WordPress reconciliation proves ownership, never by slug", () => {
  it("an unrelated post that owns the slug is never adopted or overwritten", async () => {
    const s = await scene({ slug: "wedding-films" });
    wp.posts.push({ id: "7", slug: "wedding-films", title: "Someone else's post", content: "<p>Unrelated.</p>", status: "publish" });
    const st = steps();
    wp.createMode = "no_answer_nothing_created";
    await expect(run(s, st)).rejects.toThrow();
    wp.createMode = "ok";
    await expect(run(s, st)).resolves.toEqual({ held: "uncertain_previous" });
    const unrelated = wp.posts.find((p) => p.id === "7")!;
    expect(unrelated).toMatchObject({ title: "Someone else's post", content: "<p>Unrelated.</p>" });
    expect(wp.calls.filter((c) => c.startsWith("update"))).toEqual([]);
    expect(wp.calls.filter((c) => c === "create")).toHaveLength(1);
  });

  it("finds its own post when WordPress suffixed the slug, and never touches the post that owns the plain slug", async () => {
    const s = await scene({ slug: "wedding-films" });
    wp.posts.push({ id: "7", slug: "wedding-films", title: "Someone else's post", content: "<p>Unrelated.</p>", status: "publish" });
    const st = steps();
    wp.createMode = "lost_after_create";
    await expect(run(s, st)).rejects.toThrow();
    expect(wp.posts.map((p) => p.slug)).toEqual(["wedding-films", "wedding-films-2"]);
    wp.createMode = "ok";
    await expect(run(s, st)).resolves.toMatchObject({ remoteUrl: "https://site.test/wedding-films-2/" });
    expect(wp.posts).toHaveLength(2);
    expect(wp.posts[0]).toMatchObject({ title: "Someone else's post", content: "<p>Unrelated.</p>" });
    const [d] = await dispatches(s.post.id);
    expect(d).toMatchObject({ status: "sent", remoteId: "100", lookupResult: "found", reconciledBy: "system:ownership-marker" });
  });

  it("reconciles by the dispatch's own identity even after the article's slug changed", async () => {
    const s = await scene({ slug: "first-slug" });
    const st = steps();
    wp.createMode = "lost_after_create";
    await expect(run(s, st)).rejects.toThrow();
    await test.db.update(articles).set({ slug: "second-slug", title: "Wedding films, revised" }).where(eq(articles.id, s.post.id));
    wp.createMode = "ok";
    // The retry finds the first attempt's post, then the new revision goes out as an UPDATE of it.
    await run(s, st);
    await run(s);
    expect(wp.calls.filter((c) => c === "create")).toHaveLength(1);
    expect(wp.posts).toHaveLength(1);
    expect(wp.posts[0].title).toBe("Wedding films, revised");
  });

  it("a remote create that completes AFTER an empty lookup is found later - no second post in between", async () => {
    const s = await scene();
    const st = steps();
    wp.createMode = "delayed";
    wp.delayedAfterLookups = 2;
    await expect(run(s, st)).rejects.toThrow();
    wp.createMode = "ok";
    // First retry: nothing found yet - held, nothing created, a later lookup scheduled.
    await expect(run(s, st)).resolves.toEqual({ held: "uncertain_previous" });
    expect(wp.calls.filter((c) => c === "create")).toHaveLength(1);
    const recheck = inngestMock.send.mock.calls.map((c) => (c as unknown[])[0] as { id: string; ts?: number }).find((e) => e.id.startsWith("publish-recheck:"));
    expect(recheck?.ts).toBeGreaterThan(Date.now());
    // That later run (a new run, as Inngest delivers it): the slow create has landed and is adopted.
    await expect(run(s)).resolves.toMatchObject({ status: "publish" });
    expect(wp.posts).toHaveLength(1);
    expect(wp.calls.filter((c) => c === "create")).toHaveLength(1);
  });

  it("ambiguous results (two posts carrying the same dispatch) are held for a person", async () => {
    const s = await scene();
    const st = steps();
    wp.createMode = "lost_after_create";
    await expect(run(s, st)).rejects.toThrow();
    const copy = { ...wp.posts[0], id: "999", slug: "wedding-films-copy" };
    wp.posts.push(copy);
    wp.createMode = "ok";
    await expect(run(s, st)).resolves.toEqual({ held: "uncertain_previous" });
    expect(wp.calls.filter((c) => c.startsWith("update"))).toEqual([]);
    const [d] = await dispatches(s.post.id);
    expect(d.status).toBe("uncertain");
    expect(d.lookupResult).toBe("ambiguous");
  });

  it("repeated retries while nothing is found create nothing and change nothing", async () => {
    const s = await scene();
    wp.posts.push({ id: "7", slug: "wedding-films", title: "Someone else's post", content: "<p>Unrelated.</p>", status: "publish" });
    const st = steps();
    wp.createMode = "no_answer_nothing_created";
    await expect(run(s, st)).rejects.toThrow();
    wp.createMode = "ok";
    // Each later attempt is a new run (a re-check, or a Publish press).
    for (let i = 0; i < 4; i++) await expect(run(s)).resolves.toEqual({ held: "uncertain_previous" });
    expect(wp.calls).toEqual(["create"]);
    expect(wp.posts).toHaveLength(1);
    const [d] = await dispatches(s.post.id);
    expect(d.lookupAttempts).toBeGreaterThanOrEqual(4);
  });
});

/* ------------------------------------------------------------------------ */

describe("2. plugin acknowledgements settle exactly their own hand-over", () => {
  const V2 = { "x-integration-key": "seo_k", "x-repget-plugin-version": "1.6.0" };
  const poll = async (headers: Record<string, string> = V2) =>
    (await (await pluginArticles(new NextRequest("https://app.test/api/plugin/articles", { headers }))).json()) as {
      articles: Array<{ id: string; title: string; status: string; dispatch?: { id: string; revision: string } }>;
    };
  const ack = (body: Record<string, unknown>, headers: Record<string, string> = V2) =>
    pluginPublished(new NextRequest("https://app.test/api/plugin/published", { method: "POST", headers, body: JSON.stringify(body) }));
  const expire = (articleId: string) =>
    test.db
      .update(publicationDispatches)
      .set({ claimedAt: new Date(Date.now() - IN_FLIGHT_TIMEOUT_MS - 60_000) })
      .where(and(eq(publicationDispatches.articleId, articleId), eq(publicationDispatches.status, "in_flight")));

  it("A handed out, A expires, B handed out, A's delayed acknowledgement arrives: B is untouched", async () => {
    const s = await scene({ plugin: true });
    const [a] = (await poll()).articles;
    expect(a.dispatch?.id).toBeTruthy();
    await expire(s.post.id);
    await test.db.update(articles).set({ title: "Revision B" }).where(eq(articles.id, s.post.id));
    const [b] = (await poll()).articles;
    expect(b.title).toBe("Revision B");
    expect(b.dispatch?.id).not.toBe(a.dispatch?.id);

    await ack({ articleId: s.post.id, dispatchId: a.dispatch!.id, url: "https://site.test/wedding-films/", remoteId: 50, status: "publish" });
    const rows = await dispatches(s.post.id);
    expect(rows.find((r) => r.id === a.dispatch!.id)).toMatchObject({ status: "sent", late: true });
    expect(rows.find((r) => r.id === b.dispatch!.id)).toMatchObject({ status: "in_flight" });
  });

  it("an older plugin's acknowledgement (no dispatch id) cannot settle a newer revision", async () => {
    const legacy = { "x-integration-key": "seo_k" };
    const s = await scene({ plugin: true });
    await poll(legacy);
    await expire(s.post.id);
    await test.db.update(articles).set({ title: "Revision B" }).where(eq(articles.id, s.post.id));
    // A legacy hand-over is outstanding and unacknowledged: revision B is NOT handed out yet.
    expect((await poll(legacy)).articles).toEqual([]);
    await ack({ articleId: s.post.id, url: "https://site.test/wedding-films/", remoteId: 50, status: "publish" }, legacy);
    // The report settled A - the only hand-over there was - and nothing else.
    const rows = await dispatches(s.post.id);
    expect(rows.map((r) => [r.status, r.late])).toEqual([["sent", false]]);
    expect(rows[0].requestSnapshot).toMatchObject({ title: "Wedding films" });
  });

  it("an older plugin is re-offered the SAME revision under the same dispatch after its lease runs out", async () => {
    const legacy = { "x-integration-key": "seo_k" };
    const s = await scene({ plugin: true });
    const [first] = (await poll(legacy)).articles;
    await expire(s.post.id);
    const [again] = (await poll(legacy)).articles;
    expect(again.dispatch?.id).toBe(first.dispatch?.id);
    expect(await dispatches(s.post.id)).toHaveLength(1);
    await ack({ articleId: s.post.id, url: "https://site.test/wedding-films/", remoteId: 50, status: "publish" }, legacy);
    expect((await dispatches(s.post.id)).map((r) => r.status)).toEqual(["sent"]);
  });

  it("a duplicate acknowledgement writes nothing twice", async () => {
    const s = await scene({ plugin: true });
    const [a] = (await poll()).articles;
    const body = { articleId: s.post.id, dispatchId: a.dispatch!.id, url: "https://site.test/wedding-films/", remoteId: 50, status: "publish" };
    await ack(body);
    await ack(body);
    const logs = await test.db.select().from(publishLogs).where(eq(publishLogs.articleId, s.post.id));
    expect(logs).toHaveLength(1);
    expect(notifyMock.calls).toHaveLength(1);
  });

  it("a duplicate acknowledgement from an older plugin writes nothing twice either", async () => {
    const legacy = { "x-integration-key": "seo_k" };
    const s = await scene({ plugin: true });
    await poll(legacy);
    const body = { articleId: s.post.id, url: "https://site.test/wedding-films/", remoteId: 50, status: "publish" };
    await ack(body, legacy);
    await ack(body, legacy);
    expect(await test.db.select().from(publishLogs).where(eq(publishLogs.articleId, s.post.id))).toHaveLength(1);
    expect(notifyMock.calls).toHaveLength(1);
  });

  it("a late failure after a newer success is recorded, but does not fail the article or notify", async () => {
    const s = await scene({ plugin: true });
    const [a] = (await poll()).articles;
    await expire(s.post.id);
    await test.db.update(articles).set({ title: "Revision B" }).where(eq(articles.id, s.post.id));
    const [b] = (await poll()).articles;
    await ack({ articleId: s.post.id, dispatchId: b.dispatch!.id, url: "https://site.test/wedding-films/", remoteId: 50, status: "publish" });
    notifyMock.calls = [];
    await ack({ articleId: s.post.id, dispatchId: a.dispatch!.id, error: "Could not create the post" });
    const rows = await dispatches(s.post.id);
    expect(rows.find((r) => r.id === a.dispatch!.id)).toMatchObject({ status: "failed", late: true });
    const [article] = await test.db.select().from(articles).where(eq(articles.id, s.post.id));
    expect(article).toMatchObject({ status: "published", error: null });
    expect(notifyMock.calls).toEqual([]);
  });

  it("records the CMS's actual status: a post kept as a WordPress draft is not published", async () => {
    const s = await scene({ plugin: true });
    const [a] = (await poll()).articles;
    await ack({ articleId: s.post.id, dispatchId: a.dispatch!.id, url: "https://site.test/?p=50", remoteId: 50, status: "draft" });
    const [article] = await test.db.select().from(articles).where(eq(articles.id, s.post.id));
    expect(article.status).toBe("draft");
    expect(article.firstLiveAt).toBeNull();
    const [log] = await test.db.select().from(publishLogs).where(eq(publishLogs.articleId, s.post.id));
    expect(log.remoteStatus).toBe("draft");
  });
});

/* ------------------------------------------------------------------------ */

describe("4. the publishing mode is re-read at dispatch", () => {
  it("an automatic send after the site switched to drafts goes out as a draft", async () => {
    const s = await scene({ publishAs: "live" });
    await test.db.update(websites).set({ publishAs: "draft" }).where(eq(websites.id, s.websiteId));
    await run(s, steps(), { trigger: "automatic", status: "publish" });
    expect(wp.posts.map((p) => p.status)).toEqual(["draft"]);
  });

  it("the plugin feed follows the current mode, and a retry re-reads it", async () => {
    const s = await scene({ plugin: true, publishAs: "draft" });
    const feed = (await (await pluginArticles(new NextRequest("https://app.test/api/plugin/articles", { headers: { "x-integration-key": "seo_k", "x-repget-plugin-version": "1.6.0" } }))).json()) as {
      articles: Array<{ status: string }>;
    };
    expect(feed.articles.map((a) => a.status)).toEqual(["draft"]);
    // The hand-over is never reported; the site switches to live; the re-offer follows the new mode.
    await test.db
      .update(publicationDispatches)
      .set({ claimedAt: new Date(Date.now() - IN_FLIGHT_TIMEOUT_MS - 60_000) })
      .where(eq(publicationDispatches.articleId, s.post.id));
    await test.db.update(websites).set({ publishAs: "live" }).where(eq(websites.id, s.websiteId));
    const again = (await (await pluginArticles(new NextRequest("https://app.test/api/plugin/articles", { headers: { "x-integration-key": "seo_k", "x-repget-plugin-version": "1.6.0" } }))).json()) as {
      articles: Array<{ status: string }>;
    };
    expect(again.articles.map((a) => a.status)).toEqual(["publish"]);
  });

  it("an event queued by the previous build (no trigger) is not treated as a Publish press", async () => {
    const s = await scene({ autoPublish: false });
    await expect(run(s, steps(), { trigger: undefined })).resolves.toEqual({ held: "auto_publish_off" });
    expect(wp.calls).toEqual([]);
  });

  it("an explicit Publish press still publishes, whatever the automatic settings", async () => {
    const s = await scene({ autoPublish: false, publishAs: "draft", plannedFor: new Date(Date.now() + 5 * 86_400_000) });
    await expect(run(s, steps(), { trigger: "manual", status: "publish" })).resolves.toMatchObject({ status: "publish" });
  });

  it("the first-article exception publishes live even in draft mode, and only while it is the first article", async () => {
    const s = await scene({ publishAs: "draft" });
    await test.db.update(websites).set({ firstArticleSentAt: null }).where(eq(websites.id, s.websiteId));
    await run(s, steps(), { trigger: "first_article", status: "publish" });
    expect(wp.posts.map((p) => p.status)).toEqual(["publish"]);
  });

  it("a first-article event for an article that is no longer the first follows the current mode", async () => {
    const s = await scene({ publishAs: "draft" }); // firstArticleSentAt is set: another article went first
    await run(s, steps(), { trigger: "first_article", status: "publish" });
    expect(wp.posts.map((p) => p.status)).toEqual(["draft"]);
  });

  it("the plugin feed gives the first article live even in draft mode", async () => {
    const s = await scene({ plugin: true, publishAs: "draft" });
    await test.db.update(websites).set({ firstArticleSentAt: null }).where(eq(websites.id, s.websiteId));
    const feed = (await (await pluginArticles(new NextRequest("https://app.test/api/plugin/articles", { headers: { "x-integration-key": "seo_k", "x-repget-plugin-version": "1.6.0" } }))).json()) as {
      articles: Array<{ status: string }>;
    };
    expect(feed.articles.map((a) => a.status)).toEqual(["publish"]);
  });

  it("a retried job re-reads the mode: switched to drafts between a refused attempt and its retry", async () => {
    const s = await scene({ publishAs: "live" });
    const st = steps();
    wp.createMode = "refused";
    await expect(run(s, st, { trigger: "automatic", status: "publish" })).rejects.toThrow();
    wp.createMode = "ok";
    await test.db.update(websites).set({ publishAs: "draft" }).where(eq(websites.id, s.websiteId));
    await run(s, st, { trigger: "automatic", status: "publish" });
    expect(wp.posts.map((p) => p.status)).toEqual(["draft"]);
    expect((await dispatches(s.post.id)).map((d) => [d.status, d.requestedStatus])).toEqual([["failed", "publish"], ["sent", "draft"]]);
  });
});
