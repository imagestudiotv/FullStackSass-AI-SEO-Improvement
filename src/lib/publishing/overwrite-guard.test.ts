import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { articles, calendarItems, integrations, publicationDispatches, publishLogs, websites } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { seedWebsite } from "@/test/fixtures";
import { NEW_SITE_DEFAULTS } from "@/lib/websites/new-site-defaults";

/**
 * An update over a post on the customer's website, through a direct connection:
 * what is refused, what goes out, and that none of it loops. The real publish job
 * against a simulated CMS. What each real provider asks its platform is in
 * providers/overwrite.test.ts.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const inngestMock = vi.hoisted(() => ({
  send: vi.fn(async () => ({ ids: ["evt"] })),
  createFunction: vi.fn((config: unknown, handler: unknown) => ({ config, handler })),
}));
vi.mock("@/inngest/client", () => ({ inngest: inngestMock }));
vi.mock("@/lib/plugin/sync", () => ({ nudgePluginIfDue: vi.fn(async () => "nothing-due"), recordSyncUrl: vi.fn(), triggerPluginSync: vi.fn(async () => "skipped") }));
const bell = vi.hoisted(() => ({ sent: [] as Array<{ type: string; title: string; body?: string }> }));
vi.mock("@/lib/notifications/create", () => ({ notify: vi.fn(async (input: { type: string; title: string; body?: string }) => void bell.sent.push(input)) }));
const emails = vi.hoisted(() => ({ failed: vi.fn(async () => undefined), published: vi.fn(async () => undefined) }));
vi.mock("@/lib/email/lifecycle-triggers", () => ({ emailArticleFailed: emails.failed, emailArticlePublished: emails.published }));
vi.mock("@/lib/publishing/credentials", () => ({
  resolveIntegration: vi.fn(async () => ({ integrationId: cms.integrationId, providerId: "wordpress" })),
  loadCredentialsById: vi.fn(async () => ({ integrationId: cms.integrationId, providerId: "wordpress", credentials: {} })),
}));

type Remote = { modifiedAt: string | null; hash: string | null; status: string | null; rawContent: string | null };
const cms = vi.hoisted(() => ({
  integrationId: "",
  /** What the site answers when read. Null: the post is gone. */
  remote: null as unknown as Remote | null,
  /** Read fails: the site cannot be asked. */
  readError: null as Error | null,
  /** False: a platform that cannot be read, as the webhook. */
  readable: true,
  /** The update reaches the site and then fails, or fails on the way. */
  updateError: null as Error | null,
  updateLands: false,
  baseline: { modifiedAt: "2026-01-01T10:00:00", hash: "first" } as { modifiedAt: string; hash: string } | undefined,
  calls: [] as string[],
  /** The read straight after a write, which keeps the baseline. */
  justWrote: false,
  readBacks: 0,
  readBack: null as Remote | null,
  readBackError: null as Error | null,
  guards: [] as unknown[],
  sent: [] as string[],
}));
vi.mock("@/lib/publishing/registry", () => {
  const provider = {
    id: "wordpress",
    createPost: vi.fn(async (_c: unknown, input: { status: string; contentHtml: string }) => {
      cms.calls.push("create");
      cms.sent.push(input.contentHtml);
      cms.justWrote = true;
      return { remoteId: "7", remoteUrl: "https://site.test/?p=7", status: input.status, baseline: cms.baseline };
    }),
    updatePost: vi.fn(async (_c: unknown, remoteId: string, input: { status: string; contentHtml: string }, guard: unknown) => {
      cms.calls.push(`update:${remoteId}`);
      cms.guards.push(guard);
      cms.sent.push(input.contentHtml);
      if (cms.updateError) {
        const error = cms.updateError;
        // The send itself changes the post, whether or not its answer comes back.
        if (cms.updateLands) cms.remote = { modifiedAt: new Date().toISOString(), hash: "ours, unanswered", status: "publish", rawContent: input.contentHtml };
        cms.updateError = null;
        throw error;
      }
      cms.justWrote = true;
      cms.remote = { modifiedAt: "2026-02-02T10:00:00", hash: "second", status: "publish", rawContent: null };
      return { remoteId, remoteUrl: "https://site.test/?p=7", status: input.status, baseline: { modifiedAt: "2026-02-02T10:00:00", hash: "second" } };
    }),
    readRemote: vi.fn(async () => {
      if (cms.justWrote) {
        cms.justWrote = false;
        cms.readBacks += 1;
        if (cms.readBackError) throw cms.readBackError;
        return cms.readBack ?? cms.remote;
      }
      cms.calls.push("read");
      if (cms.readError) throw cms.readError;
      return cms.remote;
    }),
  };
  return { getProvider: () => (cms.readable ? provider : { ...provider, readRemote: undefined }) };
});

import { publishArticleJob } from "@/inngest/functions/publish-article";
import { publishDueDrafts } from "@/inngest/functions/scheduled-articles";
import { DRAFT_REFUSALS, draftRefusalOf, type DraftRefusal } from "@/lib/articles/review";
import { ARTICLE_DELIVERY, draftRefusalText } from "@/lib/i18n/article-delivery";
import { LOCALES } from "@/lib/i18n/config";
import { judgeUpdate, SEND_TIME_TOLERANCE_MS } from "@/lib/publishing/overwrite-guard";
import { ProviderError, RemoteChangedError } from "@/lib/publishing/provider";

let test: TestDb;
beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});
beforeEach(() => {
  bell.sent.length = 0;
  cms.calls.length = 0;
  cms.justWrote = false;
  cms.readBacks = 0;
  cms.readBack = null;
  cms.readBackError = null;
  cms.guards.length = 0;
  cms.sent.length = 0;
  cms.readError = null;
  cms.readable = true;
  cms.updateError = null;
  cms.updateLands = false;
  cms.baseline = { modifiedAt: "2026-01-01T10:00:00", hash: "first" };
  cms.remote = { modifiedAt: "2026-01-01T10:00:00", hash: "first", status: "publish", rawContent: null };
  inngestMock.send.mockClear();
});
afterEach(() => vi.useRealTimers());

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
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
type Job = { handler: (ctx: unknown) => Promise<{ held?: unknown; remoteUrl?: string } | undefined> };
type Scene = { orgId: string; websiteId: string; post: { id: string } };
function run(s: Scene, steps = replayingSteps(), trigger = "manual") {
  return (publishArticleJob as unknown as Job).handler({
    event: { id: `evt-${randomUUID()}`, data: { articleId: s.post.id, websiteId: s.websiteId, organizationId: s.orgId, status: "publish", trigger } },
    step: steps,
    logger,
  });
}

async function scene(): Promise<Scene> {
  const { orgId, websiteId } = await seedWebsite(test);
  const domain = `d-${randomUUID().slice(0, 8)}.test`;
  await test.db.update(websites).set({ ...NEW_SITE_DEFAULTS, url: `https://${domain}`, domain, autoPublish: true, poweredByLink: false, firstArticleSentAt: new Date() }).where(eq(websites.id, websiteId));
  const [integration] = await test.db.insert(integrations).values({ websiteId, kind: "wordpress", status: "connected" }).returning();
  cms.integrationId = integration.id;
  const [post] = await test.db
    .insert(articles)
    .values({ websiteId, title: "Wedding films", slug: `wedding-films-${randomUUID().slice(0, 6)}`, status: "draft", bodyHtml: "<p>Wedding films last for decades.</p>" })
    .returning();
  return { orgId, websiteId, post };
}
const dispatches = (articleId: string) => test.db.select().from(publicationDispatches).where(eq(publicationDispatches.articleId, articleId)).orderBy(publicationDispatches.claimedAt);
const logs = (articleId: string) => test.db.select().from(publishLogs).where(eq(publishLogs.articleId, articleId));
const row = async (id: string) => (await test.db.select().from(articles).where(eq(articles.id, id)))[0];
/** A new revision to send: an edit of the article, as nothing is sent twice. */
const edit = (id: string, text: string) => test.db.update(articles).set({ bodyHtml: `<p>${text}</p>` }).where(eq(articles.id, id));
async function delivered(): Promise<Scene> {
  const s = await scene();
  await run(s);
  expect(cms.calls).toEqual(["create"]);
  cms.calls.length = 0;
  await edit(s.post.id, "The edited text.");
  return s;
}
function expectRefused(refusal: DraftRefusal) {
  expect(cms.calls.some((call) => call.startsWith("update"))).toBe(false);
  expect(bell.sent.filter((n) => n.type === "article.failed")).toHaveLength(1);
  expect(bell.sent.at(-1)?.body).toContain(draftRefusalText(refusal, ARTICLE_DELIVERY.en));
}

describe("the baseline", () => {
  it("is kept with the send that returned it, on a create and on an update", async () => {
    const s = await delivered();
    expect((await dispatches(s.post.id))[0].requestSnapshot).toMatchObject({ remoteBaseline: { modifiedAt: "2026-01-01T10:00:00", hash: "first" } });
    await run(s);
    expect((await dispatches(s.post.id))[1].requestSnapshot).toMatchObject({ remoteBaseline: { modifiedAt: "2026-02-02T10:00:00", hash: "second" } });
  });
});

describe("the baseline is a read, so a read is compared with a read", () => {
  it("a platform that answers a write in another shape: the next update is not refused for it", async () => {
    cms.baseline = { modifiedAt: "2026-01-01T10:00:00", hash: "the write's shape" };
    cms.readBack = { modifiedAt: "2026-01-01T10:00:00", hash: "first", status: "publish", rawContent: null };
    const s = await delivered();
    expect(cms.readBacks).toBe(1);
    expect((await dispatches(s.post.id))[0].requestSnapshot).toMatchObject({ remoteBaseline: { hash: "first" } });
    await run(s);
    expect(cms.calls).toEqual(["read", "update:7"]);
  });

  it("the read-back fails: the send stands, with what the write answered", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    cms.readBackError = new Error("site busy");
    const s = await delivered();
    expect(await row(s.post.id)).toMatchObject({ status: "published", error: null });
    expect((await dispatches(s.post.id))[0].requestSnapshot).toMatchObject({ remoteBaseline: { hash: "first" } });
    log.mockRestore();
  });

  it("edited in the same second as the send: refused, with the time unchanged", async () => {
    const s = await delivered();
    cms.remote = { modifiedAt: "2026-01-01T10:00:00", hash: "somebody's", status: "publish", rawContent: null };
    await expect(run(s)).resolves.toEqual({ held: "post_changed" });
    expectRefused("post_changed");
  });
});

describe("an update of a post unchanged since RepGet sent it", () => {
  it("goes out, after reading it, carrying the time read for a platform with a precondition", async () => {
    const s = await delivered();
    await run(s);
    expect(cms.calls).toEqual(["read", "update:7"]);
    expect(cms.guards).toEqual([{ expectedModifiedAt: "2026-01-01T10:00:00" }]);
    expect(await row(s.post.id)).toMatchObject({ status: "published", error: null });
  });

  it("a Save with no change moved the time only: the hash says it is unchanged", async () => {
    const s = await delivered();
    cms.remote = { modifiedAt: "2026-01-05T10:00:00", hash: "first", status: "publish", rawContent: null };
    await run(s);
    expect(cms.calls).toEqual(["read", "update:7"]);
    expect(cms.guards).toEqual([{ expectedModifiedAt: "2026-01-05T10:00:00" }]);
  });
});

describe("a refusal", () => {
  it("changed on the website: nothing sent, said once, nothing thrown or retried", async () => {
    const s = await delivered();
    cms.remote = { modifiedAt: "2026-01-05T10:00:00", hash: "somebody's", status: "publish", rawContent: null };
    await expect(run(s)).resolves.toEqual({ held: "post_changed" });
    expectRefused("post_changed");
    expect(inngestMock.send).not.toHaveBeenCalled();
    expect(emails.failed).not.toHaveBeenCalled();

    const last = (await dispatches(s.post.id)).at(-1);
    expect(last).toMatchObject({ status: "failed", error: DRAFT_REFUSALS.post_changed });
    const log = (await logs(s.post.id)).find((entry) => entry.status === "failed");
    expect(draftRefusalOf(log?.error)).toBe("post_changed");
    expect((await row(s.post.id)).error).toBe(DRAFT_REFUSALS.post_changed);
  });

  it("a press asks the site again, and tells the customer again; once it holds what was sent, it goes", async () => {
    const s = await delivered();
    cms.remote = { modifiedAt: "2026-01-05T10:00:00", hash: "somebody's", status: "publish", rawContent: null };
    await run(s);
    await run(s);
    expect(bell.sent.filter((n) => n.type === "article.failed")).toHaveLength(2);
    cms.remote = { modifiedAt: "2026-01-06T10:00:00", hash: "first", status: "publish", rawContent: null };
    await run(s);
    expect(cms.calls.at(-1)).toBe("update:7");
    expect((await row(s.post.id)).error).toBeNull();
  });

  it("an automatic release of the same revision is said once, however many days it looks", async () => {
    const s = await delivered();
    cms.remote = { modifiedAt: "2026-01-05T10:00:00", hash: "somebody's", status: "publish", rawContent: null };
    await run(s, replayingSteps(), "automatic");
    await run(s, replayingSteps(), "automatic");
    await run(s, replayingSteps(), "automatic");
    expect(bell.sent.filter((n) => n.type === "article.failed")).toHaveLength(1);
    expect(cms.calls.some((call) => call.startsWith("update"))).toBe(false);
  });

  it.each([
    ["in the trash", { modifiedAt: "2026-01-01T10:00:00", hash: "first", status: "trash", rawContent: null }, "update_trashed"],
    ["deleted, and nothing made in its place", null, "update_deleted"],
  ] as const)("%s", async (_what, remote, refusal) => {
    const s = await delivered();
    cms.remote = remote;
    await expect(run(s)).resolves.toEqual({ held: refusal });
    expectRefused(refusal);
    expect(cms.calls).not.toContain("create");
  });

  it("a platform that cannot be read: every update refused, the first send unaffected", async () => {
    const s = await delivered();
    cms.readable = false;
    await expect(run(s)).resolves.toEqual({ held: "update_unavailable" });
    expectRefused("update_unavailable");
  });

  it("the platform's own precondition refuses it: the same refusal, and no retry", async () => {
    const s = await delivered();
    cms.updateError = new RemoteChangedError("Saving failed! Someone else is editing this post.", 409);
    await expect(run(s)).resolves.toEqual({ held: "post_changed" });
    expect((await dispatches(s.post.id)).at(-1)).toMatchObject({ status: "failed", error: DRAFT_REFUSALS.post_changed });
    expect(bell.sent.filter((n) => n.type === "article.failed")).toHaveLength(1);
  });

  it("the site cannot be read: an ordinary failure to retry, nothing written, nothing refused", async () => {
    const s = await delivered();
    cms.readError = new ProviderError("Could not reach the site", "unreachable");
    await expect(run(s)).rejects.toThrow("Could not reach the site");
    expect(cms.calls).toEqual(["read"]);
    const last = (await dispatches(s.post.id)).at(-1);
    expect(last).toMatchObject({ status: "failed", error: "Could not reach the site" });
    expect(last?.requestSnapshot).not.toHaveProperty("mayHaveLanded");
  });
});

describe("a refusal is not retried on a schedule", () => {
  /** On an automatic site, delivered as a CMS draft on its planned day, with a newer revision to send: what the daily release picks up. */
  async function dueAgain(): Promise<Scene> {
    const s = await scene();
    const [item] = await test.db.insert(calendarItems).values({ websiteId: s.websiteId, title: "Wedding films", scheduledFor: new Date(Date.now() - 86_400_000) }).returning();
    await test.db.update(articles).set({ calendarItemId: item.id }).where(eq(articles.id, s.post.id));
    await test.db.update(websites).set({ publishAs: "draft" }).where(eq(websites.id, s.websiteId));
    await run(s, replayingSteps(), "automatic");
    expect(cms.calls).toEqual(["create"]);
    expect((await row(s.post.id)).status).toBe("draft");
    cms.calls.length = 0;
    await edit(s.post.id, "The edited text.");
    return s;
  }
  async function dailyReleaseSends(s: Scene) {
    inngestMock.send.mockClear();
    await publishDueDrafts();
    return (inngestMock.send.mock.calls as unknown as [{ data: { articleId: string } }][]).filter(([event]) => event.data.articleId === s.post.id);
  }

  it.each([
    ["post_changed", { modifiedAt: "2026-01-05T10:00:00", hash: "somebody's", status: "publish", rawContent: null }, { modifiedAt: "2026-01-01T10:00:00", hash: "first" }],
    ["post_unverified", { modifiedAt: null, hash: null, status: "publish", rawContent: null }, undefined],
  ] as const)("%s: one notification, nothing written, and the daily release leaves it from then on", async (refusal, remote, baseline) => {
    cms.baseline = baseline ? { ...baseline } : undefined;
    // No baseline at all: the write answered none, and neither did the read straight after it.
    cms.readBackError = baseline ? null : new Error("site busy");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const s = await dueAgain();
    log.mockRestore();
    cms.remote = { ...remote };
    // What this is about: without a refusal it IS due.
    expect(await dailyReleaseSends(s)).toHaveLength(1);

    await expect(run(s, replayingSteps(), "automatic")).resolves.toEqual({ held: refusal });
    expectRefused(refusal);
    const attempts = (await dispatches(s.post.id)).length;

    cms.calls.length = 0;
    for (let day = 0; day < 3; day++) expect(await dailyReleaseSends(s)).toEqual([]);
    expect(cms.calls).toEqual([]);
    expect(await dispatches(s.post.id)).toHaveLength(attempts);
    expect(bell.sent.filter((n) => n.type === "article.failed")).toHaveLength(1);
  });

  it("an edit in RepGet does not start it again; a person's press does, and then it is ordinary", async () => {
    const s = await dueAgain();
    cms.remote = { modifiedAt: "2026-01-05T10:00:00", hash: "somebody's", status: "publish", rawContent: null };
    await run(s, replayingSteps(), "automatic");

    await edit(s.post.id, "Edited again.");
    expect(await dailyReleaseSends(s)).toEqual([]);

    // The customer put it back on the website: pressing asks the site again, and it goes.
    cms.remote = { modifiedAt: "2026-01-06T10:00:00", hash: "first", status: "publish", rawContent: null };
    await run(s);
    expect(cms.calls.at(-1)).toBe("update:7");
    await test.db.update(articles).set({ status: "draft" }).where(eq(articles.id, s.post.id));
    await edit(s.post.id, "Edited once more.");
    expect(await dailyReleaseSends(s)).toHaveLength(1);
  });

  it("nothing an event can carry makes the job write over a refusal", async () => {
    const s = await delivered();
    cms.remote = { modifiedAt: "2026-01-05T10:00:00", hash: "somebody's", status: "publish", rawContent: null };
    const result = await (publishArticleJob as unknown as Job).handler({
      event: {
        id: `evt-${randomUUID()}`,
        data: { articleId: s.post.id, websiteId: s.websiteId, organizationId: s.orgId, status: "publish", trigger: "manual", force: true, overwrite: true, skipGuard: true, expectedModifiedAt: "2026-01-05T10:00:00" },
      },
      step: replayingSteps(),
      logger,
    });
    expect(result).toEqual({ held: "post_changed" });
    expect(cms.calls.some((call) => call.startsWith("update"))).toBe(false);
  });
});

describe("a retry after a lost answer: the send itself changed the post", () => {
  it("is not taken for somebody's edit, and there is one post", async () => {
    const s = await delivered();
    const steps = replayingSteps();
    cms.updateError = new ProviderError("connection reset", "unreachable");
    cms.updateLands = true;
    await expect(run(s, steps)).rejects.toThrow("connection reset");
    expect((await dispatches(s.post.id)).at(-1)?.requestSnapshot).toMatchObject({ mayHaveLanded: true });

    await run(s, steps);
    expect(cms.calls).toEqual(["read", "update:7", "read", "update:7"]);
    expect(cms.calls).not.toContain("create");
    expect((await row(s.post.id)).status).toBe("published");
    expect(bell.sent.filter((n) => n.type === "article.failed")).toHaveLength(0);
  });

  it("the post carries no marker of that attempt: somebody's, refused", async () => {
    const s = await delivered();
    const steps = replayingSteps();
    cms.updateError = new ProviderError("connection reset", "unreachable");
    await expect(run(s, steps)).rejects.toThrow("connection reset");
    cms.remote = { modifiedAt: new Date().toISOString(), hash: "somebody's", status: "publish", rawContent: "<p>An editor wrote this.</p>" };
    await expect(run(s, steps)).resolves.toEqual({ held: "post_changed" });
  });

  it("the site answered no: that attempt cannot have landed, so nothing excuses a change", async () => {
    const s = await delivered();
    const steps = replayingSteps();
    cms.updateError = new ProviderError("Sorry, you are not allowed", "permission", 403);
    await expect(run(s, steps)).rejects.toThrow("not allowed");
    expect((await dispatches(s.post.id)).at(-1)?.requestSnapshot).not.toHaveProperty("mayHaveLanded");
    cms.remote = { modifiedAt: new Date().toISOString(), hash: "somebody's", status: "publish", rawContent: null };
    await expect(run(s, steps)).resolves.toEqual({ held: "post_changed" });
  });

  it("a refused attempt never sent anything, so it excuses nothing either", async () => {
    const s = await delivered();
    cms.remote = { modifiedAt: new Date().toISOString(), hash: "somebody's", status: "publish", rawContent: null };
    await run(s);
    await expect(run(s)).resolves.toEqual({ held: "post_changed" });
  });
});

describe("a post sent before baselines existed", () => {
  async function legacy(): Promise<Scene> {
    const s = await delivered();
    const [first] = await dispatches(s.post.id);
    await test.db.update(publicationDispatches).set({ requestSnapshot: {} }).where(eq(publicationDispatches.id, first.id));
    return s;
  }
  const sentAt = async (s: Scene) => (await dispatches(s.post.id))[0].completedAt as Date;

  it("not saved since the send, within the tolerance: goes out", async () => {
    const s = await legacy();
    cms.remote = { modifiedAt: new Date((await sentAt(s)).getTime() + SEND_TIME_TOLERANCE_MS - 1000).toISOString(), hash: "unknown to us", status: "publish", rawContent: null };
    await run(s);
    expect(cms.calls).toEqual(["read", "update:7"]);
  });

  it("saved after it: refused", async () => {
    const s = await legacy();
    cms.remote = { modifiedAt: new Date((await sentAt(s)).getTime() + SEND_TIME_TOLERANCE_MS + 1000).toISOString(), hash: "unknown to us", status: "publish", rawContent: null };
    await expect(run(s)).resolves.toEqual({ held: "post_changed" });
  });

  it("the platform gives no time: refused as unverifiable", async () => {
    const s = await legacy();
    cms.remote = { modifiedAt: null, hash: null, status: "publish", rawContent: null };
    await expect(run(s)).resolves.toEqual({ held: "post_unverified" });
    expectRefused("post_unverified");
  });
});

describe("judgeUpdate", () => {
  const remote = (over: Partial<Remote> = {}): Remote => ({ modifiedAt: "2026-01-01T10:00:00", hash: "h", status: "publish", rawContent: null, ...over });
  const none = { baseline: null, sentAt: null, unanswered: [] };

  it("a time with no zone is UTC, as WordPress's modified_gmt", () => {
    const sentAt = new Date("2026-01-01T10:00:00Z");
    expect(judgeUpdate({ ...none, sentAt, remote: remote({ modifiedAt: "2026-01-01T10:01:00", hash: null }) }).ok).toBe(true);
    expect(judgeUpdate({ ...none, sentAt, remote: remote({ modifiedAt: "2026-01-01T10:03:00", hash: null }) })).toEqual({ ok: false, refusal: "post_changed" });
  });

  it("the same second, with a hash that differs: changed, whatever the time says", () => {
    const baseline = { modifiedAt: "2026-01-01T10:00:00", hash: "a" };
    expect(judgeUpdate({ ...none, baseline, remote: remote({ hash: "b" }) })).toEqual({ ok: false, refusal: "post_changed" });
  });

  it("the same hash with a later time: unchanged", () => {
    const baseline = { modifiedAt: "2026-01-01T10:00:00", hash: "a" };
    expect(judgeUpdate({ ...none, baseline, remote: remote({ hash: "a", modifiedAt: "2026-01-09T10:00:00" }) }).ok).toBe(true);
  });

  it("no hash to compare on one side: the time decides, and a different time is a change", () => {
    const withHash = { modifiedAt: "2026-01-01T10:00:00", hash: "a" };
    const noHash = { modifiedAt: "2026-01-01T10:00:00", hash: null };
    expect(judgeUpdate({ ...none, baseline: withHash, remote: remote({ hash: null }) }).ok).toBe(true);
    expect(judgeUpdate({ ...none, baseline: noHash, remote: remote({ hash: "a" }) }).ok).toBe(true);
    expect(judgeUpdate({ ...none, baseline: noHash, remote: remote({ hash: "a", modifiedAt: "2026-01-09T10:00:00" }) })).toEqual({ ok: false, refusal: "post_changed" });
  });

  it("nothing to compare on either side: not called unchanged", () => {
    const baseline = { modifiedAt: null, hash: "a" };
    expect(judgeUpdate({ ...none, baseline, remote: remote({ hash: null }) })).toEqual({ ok: false, refusal: "post_changed" });
  });

  it("no send on record at all: cannot be shown", () => {
    expect(judgeUpdate({ ...none, remote: remote() })).toEqual({ ok: false, refusal: "post_unverified" });
  });

  it("an empty baseline is no baseline", () => {
    const sentAt = new Date("2026-01-01T10:00:00Z");
    expect(judgeUpdate({ ...none, sentAt, baseline: { modifiedAt: null, hash: null }, remote: remote() }).ok).toBe(true);
  });

  it("a platform keeping the marker: the marker must be that attempt's", () => {
    const attempt = { marker: "<!-- repget:v1 a -->", claimedAt: new Date("2026-01-01T10:00:00Z"), completedAt: new Date("2026-01-01T10:00:30Z") };
    const baseline = { modifiedAt: "2025-12-01T10:00:00", hash: "old" };
    expect(judgeUpdate({ baseline, sentAt: null, unanswered: [attempt], remote: remote({ rawContent: "<p>x</p><!-- repget:v1 a -->" }) })).toMatchObject({ ok: true, because: "own_unanswered_send" });
    expect(judgeUpdate({ baseline, sentAt: null, unanswered: [attempt], remote: remote({ rawContent: "<p>x</p><!-- repget:v1 b -->" }) })).toEqual({ ok: false, refusal: "post_changed" });
  });
});

describe("the words", () => {
  const added = ["post_changed", "post_unverified", "post_locked", "update_trashed", "update_deleted", "update_unavailable"] as const;

  it("every refusal says something of its own, in every language", () => {
    for (const locale of LOCALES) {
      const texts = added.map((refusal) => draftRefusalText(refusal, ARTICLE_DELIVERY[locale]));
      expect(new Set(texts).size).toBe(added.length);
      for (const text of texts) expect(text.length).toBeGreaterThan(40);
    }
  });

  it("is told apart from a failure by what is stored", () => {
    for (const refusal of added) expect(draftRefusalOf(DRAFT_REFUSALS[refusal])).toBe(refusal);
  });
});
