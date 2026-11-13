import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { user } from "@/lib/db/auth-tables";
import { blogCommentUpvotes, blogComments, blogPosts, blogPostUpvotes, blogPostViews, creditLedger, organization } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";

/**
 * One discussion in every language (client, 2026-11-13: "Upvote and comments
 * on blogs and companies should reflect on all languages, without inserting
 * for each language separately"), on a disposable database: an article and
 * its translations share one upvote per member, one list of comments,
 * moderation, counts in the customer directory and Earn Credits' progress -
 * and the bonus is still given once.
 */

const state = vi.hoisted(() => ({ db: null as unknown, session: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
  isDatabaseConfigured: () => true,
}));
vi.mock("@/lib/auth-guard", () => ({ getSession: async () => state.session }));
const cache = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => cache);
vi.mock("@/lib/indexnow", () => ({ notifyIndexNow: vi.fn() }));

import { deleteBlogPost } from "@/lib/admin/blog";
import { setCommentRemoved } from "@/lib/admin/blog-comments";
import {
  addComment,
  deleteOwnComment,
  discoverProgress,
  discussionPaths,
  postEngagement,
  setCommentUpvote,
  setPostUpvote,
  viewerEngagement,
} from "@/lib/blog/engagement";
import { getDiscoverProfile, listDiscoverProfiles, recordProfileView, upvotesThisWeek } from "@/lib/discover/profiles";
import { claimDiscoverBonus, discoverBonusKey } from "@/lib/earn/discover";

const ADMIN = "admin@repget.test";
const STORIES = "Customer stories";
const BROWSER = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

let test: TestDb;
beforeAll(async () => {
  vi.stubEnv("ADMIN_EMAILS", ADMIN);
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://repget.test");
  test = await createTestDb();
  state.db = test.db;
});
beforeEach(() => {
  state.session = null;
  cache.revalidatePath.mockClear();
});

function asAdmin() {
  state.session = { user: { id: "admin_user", email: ADMIN, emailVerified: true }, session: { id: "s_admin", activeOrganizationId: null } };
}

async function member(name = "Ana Member") {
  const id = `u_${randomUUID().slice(0, 8)}`;
  await test.db.insert(user).values({ id, name, email: `${id}@example.test` });
  return id;
}

let n = 0;
async function post(fields: Partial<typeof blogPosts.$inferInsert> = {}) {
  n += 1;
  const [row] = await test.db
    .insert(blogPosts)
    .values({
      slug: `article-${n}-${randomUUID().slice(0, 6)}`,
      title: `Article ${n}`,
      description: `About article ${n}`,
      category: "Guides",
      author: "RepGet team",
      bodyHtml: "<p>Text</p>",
      status: "published",
      publishedAt: new Date(Date.now() - (1000 - n) * 1000),
      ...fields,
    })
    .returning({ id: blogPosts.id, slug: blogPosts.slug, discussionId: blogPosts.discussionId, locale: blogPosts.locale });
  return row;
}

/** An English article and its Italian and Spanish translations, all published. */
async function article(fields: Partial<typeof blogPosts.$inferInsert> = {}) {
  const en = await post(fields);
  const it = await post({ ...fields, locale: "it", translationOf: en.id });
  const es = await post({ ...fields, locale: "es", translationOf: en.id });
  return { en, it, es };
}

describe("a discussion", () => {
  it("is the original's id, shared by its translations and set by the database whatever the insert says", async () => {
    const { en, it, es } = await article();
    expect(en.discussionId).toBe(en.id);
    expect(it.discussionId).toBe(en.id);
    expect(es.discussionId).toBe(en.id);
    // An insert cannot choose another article's discussion, and an update cannot move a post.
    const other = await post();
    const sneaky = await post({ locale: "fr", discussionId: other.id });
    expect(sneaky.discussionId).toBe(sneaky.id);
    await test.db.update(blogPosts).set({ discussionId: other.id }).where(eq(blogPosts.id, it.id));
    const [still] = await test.db.select({ d: blogPosts.discussionId }).from(blogPosts).where(eq(blogPosts.id, it.id));
    expect(still.d).toBe(en.id);
  });

  it("an independent post in another language is a discussion of its own", async () => {
    const en = await post();
    const it = await post({ locale: "it" });
    expect(it.discussionId).not.toBe(en.discussionId);
  });
});

describe("upvotes across languages", () => {
  it("count once per member, whichever versions they press, and show on every version", async () => {
    const { en, it, es } = await article();
    const [a, b] = [await member(), await member()];
    expect(await setPostUpvote(a, en.id, true)).toEqual({ upvoted: true, count: 1 });
    // The same member on the Italian version: still one upvote.
    expect(await setPostUpvote(a, it.id, true)).toEqual({ upvoted: true, count: 1 });
    expect(await setPostUpvote(b, es.id, true)).toEqual({ upvoted: true, count: 2 });
    for (const version of [en, it, es]) {
      const seen = await postEngagement(version.id, a);
      expect(seen).toMatchObject({ postId: version.id, upvotes: 2, upvoted: true });
    }
    const rows = await test.db.select().from(blogPostUpvotes).where(eq(blogPostUpvotes.discussionId, en.id));
    expect(rows).toHaveLength(2);
    // The upvote keeps the version it was given on.
    expect(rows.find((row) => row.userId === a)?.postId).toBe(en.id);
    // Taken back from another language's page: gone everywhere.
    expect(await setPostUpvote(a, es.id, false)).toEqual({ upvoted: false, count: 1 });
    expect((await postEngagement(en.id, a)).upvoted).toBe(false);
    expect(await viewerEngagement(b, [en.id, it.id, es.id])).toEqual({
      [en.id]: { upvoted: true, commented: false },
      [it.id]: { upvoted: true, commented: false },
      [es.id]: { upvoted: true, commented: false },
    });
  });

  it("two simultaneous presses on two language versions make one upvote", async () => {
    const { en, it, es } = await article();
    const a = await member();
    const results = await Promise.all([setPostUpvote(a, en.id, true), setPostUpvote(a, it.id, true), setPostUpvote(a, es.id, true), setPostUpvote(a, it.id, true)]);
    expect(results.every((r) => r.upvoted)).toBe(true);
    expect(await test.db.select().from(blogPostUpvotes).where(and(eq(blogPostUpvotes.discussionId, en.id), eq(blogPostUpvotes.userId, a)))).toHaveLength(1);
    expect((await postEngagement(es.id, null)).upvotes).toBe(1);
  });

  it("the database refuses a second upvote for the same discussion and one naming another article's discussion", async () => {
    const { en, it } = await article();
    const other = await post();
    const a = await member();
    await test.db.insert(blogPostUpvotes).values({ postId: en.id, discussionId: en.discussionId, userId: a });
    await expect(test.db.insert(blogPostUpvotes).values({ postId: it.id, discussionId: it.discussionId, userId: a })).rejects.toThrow();
    await expect(test.db.insert(blogPostUpvotes).values({ postId: it.id, discussionId: other.discussionId, userId: await member() })).rejects.toThrow();
  });

  it("a draft version is not a way in, but the discussion stays live while another version is published", async () => {
    const en = await post();
    const it = await post({ locale: "it", translationOf: en.id, status: "draft", publishedAt: null });
    const a = await member();
    await expect(setPostUpvote(a, it.id, true)).rejects.toThrow("not_found");
    await setPostUpvote(a, en.id, true);
    await test.db.update(blogPosts).set({ status: "published", publishedAt: new Date() }).where(eq(blogPosts.id, it.id));
    expect(await postEngagement(it.id, a)).toMatchObject({ upvotes: 1, upvoted: true });
  });
});

describe("comments across languages", () => {
  it("one written on any version is listed on every version, as written (never translated)", async () => {
    const { en, it, es } = await article();
    const [a, b] = [await member("Giulia"), await member("John")];
    const italian = await addComment({ userId: a, postId: it.id, body: "Articolo molto utile" });
    const english = await addComment({ userId: b, postId: en.id, body: "Very useful" });
    if (!italian.ok || !english.ok) throw new Error("not added");
    for (const version of [en, it, es]) {
      const { comments } = await postEngagement(version.id, a);
      expect(comments.map((c) => [c.body, c.authorName, c.own])).toEqual([
        ["Very useful", "John", false],
        ["Articolo molto utile", "Giulia", true],
      ]);
    }
    const [stored] = await test.db.select().from(blogComments).where(eq(blogComments.id, italian.commentId));
    expect(stored).toMatchObject({ postId: it.id, discussionId: en.id, body: "Articolo molto utile" });
    // A comment's upvote is the one row, wherever it is pressed.
    expect(await setCommentUpvote(b, italian.commentId, true)).toEqual({ upvoted: true, count: 1 });
    expect((await postEngagement(es.id, b)).comments.find((c) => c.id === italian.commentId)).toMatchObject({ upvotes: 1, upvoted: true });
    expect(await viewerEngagement(a, [en.id, es.id])).toEqual({ [en.id]: { upvoted: false, commented: true }, [es.id]: { upvoted: false, commented: true } });
  });

  it("removed by an administrator, or deleted by its author, it is hidden on every version", async () => {
    const { en, it, es } = await article({ businessSlug: `mod-${randomUUID().slice(0, 6)}`, category: STORIES });
    const [a, b] = [await member(), await member()];
    const removed = await addComment({ userId: a, postId: it.id, body: "To be removed" });
    const deleted = await addComment({ userId: b, postId: es.id, body: "To be deleted" });
    if (!removed.ok || !deleted.ok) throw new Error("not added");

    asAdmin();
    expect(await setCommentRemoved({ id: removed.commentId, removed: true })).toEqual({ ok: true, data: null });
    // Every language's page and profile is refreshed.
    const refreshed = cache.revalidatePath.mock.calls.map((call) => call[0]);
    expect(refreshed).toEqual(expect.arrayContaining(await discussionPaths(en.discussionId)));
    expect(await discussionPaths(en.discussionId)).toHaveLength(6);
    expect(refreshed).toEqual(expect.arrayContaining([expect.stringMatching(/^\/blog\//), expect.stringMatching(/^\/it\/blog\//), expect.stringMatching(/^\/it\/discover\/mod-/)]));
    for (const version of [en, it, es]) expect((await postEngagement(version.id, null)).comments.map((c) => c.body)).toEqual(["To be deleted"]);
    await expect(setCommentUpvote(b, removed.commentId, true)).rejects.toThrow("not_found");

    expect(await deleteOwnComment(a, deleted.commentId)).toBe(false);
    expect(await deleteOwnComment(b, deleted.commentId)).toBe(true);
    for (const version of [en, it, es]) expect((await postEngagement(version.id, null)).comments).toEqual([]);
    expect((await listDiscoverProfiles("it")).find((entry) => entry.postId === it.id)?.comments).toBe(0);

    // Restored: back on every version, its history kept.
    expect(await setCommentRemoved({ id: removed.commentId, removed: false })).toEqual({ ok: true, data: null });
    for (const version of [en, it, es]) expect((await postEngagement(version.id, null)).comments.map((c) => c.body)).toEqual(["To be removed"]);
  });
});

describe("a deleted version", () => {
  it("leaves its upvotes and comments with the rest of its article", async () => {
    const { en, it } = await article();
    const [a, b] = [await member(), await member()];
    await setPostUpvote(a, it.id, true);
    await setPostUpvote(b, en.id, true);
    const said = await addComment({ userId: a, postId: it.id, body: "Scritto in italiano" });
    if (!said.ok) throw new Error("not added");
    await test.db.insert(blogPostViews).values({ postId: it.id, day: "2026-11-01", views: 4 });
    await test.db.update(blogPosts).set({ status: "draft" }).where(eq(blogPosts.id, it.id));
    const [{ version }] = await test.db.select({ version: blogPosts.version }).from(blogPosts).where(eq(blogPosts.id, it.id));

    asAdmin();
    expect(await deleteBlogPost({ id: it.id, expectedVersion: version })).toEqual({ ok: true, data: null });
    expect(await postEngagement(en.id, a)).toMatchObject({ upvotes: 2, upvoted: true, comments: [{ body: "Scritto in italiano" }] });
    const [views] = await test.db.select().from(blogPostViews).where(eq(blogPostViews.postId, en.id));
    expect(views?.views).toBe(4);
  });

  it("an original deleted after its translations keeps them in one discussion", async () => {
    const { en, it, es } = await article();
    const a = await member();
    await setPostUpvote(a, it.id, true);
    const said = await addComment({ userId: a, postId: es.id, body: "Comentario" });
    if (!said.ok) throw new Error("not added");
    await test.db.update(blogPosts).set({ status: "draft" }).where(eq(blogPosts.id, en.id));
    asAdmin();
    expect(await deleteBlogPost({ id: en.id, expectedVersion: 0 })).toEqual({ ok: true, data: null });
    const left = await test.db.select({ translationOf: blogPosts.translationOf, discussionId: blogPosts.discussionId }).from(blogPosts).where(eq(blogPosts.discussionId, en.id));
    expect(left).toHaveLength(2);
    expect(left.every((row) => row.translationOf === null)).toBe(true);
    expect(await postEngagement(it.id, a)).toMatchObject({ upvotes: 1, upvoted: true, comments: [{ body: "Comentario" }] });
    expect(await postEngagement(es.id, null)).toMatchObject({ upvotes: 1, comments: [{ body: "Comentario" }] });
  });
});

describe("the customer directory", () => {
  it("counts every language version's upvotes, comments and views together, and a visitor once a day", async () => {
    const slug = `dir-${randomUUID().slice(0, 6)}`;
    const { en, it } = await article({ category: STORIES, businessSlug: slug, businessName: "Studio" });
    const [a, b, c] = [await member(), await member(), await member()];
    await setPostUpvote(a, en.id, true);
    await setPostUpvote(a, it.id, true);
    await setPostUpvote(b, it.id, true);
    await addComment({ userId: c, postId: it.id, body: "Ottimo" });
    const day = new Date();
    expect(await recordProfileView({ postId: en.id, visitor: "203.0.113.5", userAgent: BROWSER, now: day })).toBe(true);
    // The same visitor on the Italian profile the same day: one view.
    expect(await recordProfileView({ postId: it.id, visitor: "203.0.113.5", userAgent: BROWSER, now: day })).toBe(false);
    expect(await recordProfileView({ postId: it.id, visitor: "198.51.100.9", userAgent: BROWSER, now: day })).toBe(true);

    const english = (await listDiscoverProfiles("en")).find((entry) => entry.slug === slug);
    const italian = (await listDiscoverProfiles("it")).find((entry) => entry.slug === slug);
    expect(english).toMatchObject({ postId: en.id, upvotes: 2, comments: 1, views: 2 });
    expect(italian).toMatchObject({ postId: it.id, upvotes: 2, comments: 1, views: 2 });
    expect(await getDiscoverProfile("it", slug)).toMatchObject({ upvotes: 2, upvotesWeek: 2, impressionsWeek: 2, comments: 1 });
    expect(await upvotesThisWeek(en.id)).toBe(2);
  });
});

describe("Earn Credits' Discover & earn", () => {
  async function workspace() {
    const id = `org_${randomUUID().slice(0, 8)}`;
    await test.db.insert(organization).values({ id, name: id, slug: id, createdAt: new Date() });
    return id;
  }
  /** A shown comment written some days ago (the posting rate limit is not what this tests). */
  async function oldComment(userId: string, version: { id: string; discussionId: string }, body: string) {
    await test.db.insert(blogComments).values({ postId: version.id, discussionId: version.discussionId, userId, body, createdAt: new Date(Date.now() - 7 * 86_400_000) });
  }

  it("counts a story once however many language versions were upvoted or commented on, and gives the bonus once", async () => {
    const a = await member();
    const org = await workspace();
    const before = await discoverProgress(a);
    const stories = await Promise.all(Array.from({ length: 20 }, () => article({ category: STORIES })));
    // Every version of the first ten: three pages pressed per story, ten stories.
    for (const story of stories.slice(0, 10)) for (const version of [story.en, story.it, story.es]) await setPostUpvote(a, version.id, true);
    for (const story of stories.slice(0, 5)) {
      await oldComment(a, story.en, "English words about this business");
      await oldComment(a, story.it, "Parole in italiano su questa azienda");
    }
    expect(await discoverProgress(a)).toEqual({ upvotes: before.upvotes + 10, comments: before.comments + 5 });
    expect((await claimDiscoverBonus(a, org)).outcome).toBe("not_reached");
    expect(await test.db.select().from(creditLedger).where(eq(creditLedger.idempotencyKey, discoverBonusKey(a)))).toHaveLength(0);

    for (const story of stories.slice(10)) await setPostUpvote(a, story.it.id, true);
    for (const story of stories.slice(5, 10)) await oldComment(a, story.es, "Palabras en español sobre esta empresa");
    expect(await discoverProgress(a)).toEqual({ upvotes: before.upvotes + 20, comments: before.comments + 10 });
    const claims = await Promise.all([claimDiscoverBonus(a, org), claimDiscoverBonus(a, org)]);
    expect(claims.filter((claim) => claim.outcome === "claimed")).toHaveLength(1);
    expect(await test.db.select().from(creditLedger).where(eq(creditLedger.idempotencyKey, discoverBonusKey(a)))).toHaveLength(1);
    // Pressing yet another language's upvote changes nothing.
    await setPostUpvote(a, stories[0].es.id, true);
    expect((await claimDiscoverBonus(a, org)).outcome).toBe("already_claimed");
    expect(await test.db.select().from(creditLedger).where(eq(creditLedger.idempotencyKey, discoverBonusKey(a)))).toHaveLength(1);
  });

  it("a story whose one published version is taken down stops counting; another version keeps it", async () => {
    const a = await member();
    const before = await discoverProgress(a);
    const { en, it } = await article({ category: STORIES });
    await setPostUpvote(a, it.id, true);
    await test.db.update(blogPosts).set({ status: "draft" }).where(eq(blogPosts.id, it.id));
    expect((await discoverProgress(a)).upvotes).toBe(before.upvotes + 1);
    await test.db.update(blogPosts).set({ status: "draft" }).where(eq(blogPosts.id, en.id));
    await test.db.update(blogPosts).set({ status: "draft" }).where(eq(blogPosts.discussionId, en.discussionId));
    expect((await discoverProgress(a)).upvotes).toBe(before.upvotes);
  });
});

describe("comment upvotes", () => {
  it("stay one per member and comment", async () => {
    const { en, it } = await article();
    const [a, b] = [await member(), await member()];
    const said = await addComment({ userId: a, postId: en.id, body: "Hello" });
    if (!said.ok) throw new Error("not added");
    await Promise.all([setCommentUpvote(b, said.commentId, true), setCommentUpvote(b, said.commentId, true)]);
    expect(await test.db.select().from(blogCommentUpvotes).where(eq(blogCommentUpvotes.commentId, said.commentId))).toHaveLength(1);
    expect((await postEngagement(it.id, b)).comments[0]).toMatchObject({ upvotes: 1, upvoted: true });
  });
});
