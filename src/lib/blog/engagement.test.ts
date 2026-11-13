import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { user } from "@/lib/db/auth-tables";
import { blogComments, blogPosts } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";

/**
 * Blog engagement (client, 2026-11-11) on a disposable database: one upvote
 * per user and item, toggled; comments checked, rate-limited and hidden when
 * removed or deleted; only signed-in callers act; customer stories listed in
 * the visitor's language with the English fallback; Earn Credits' progress
 * counts only shown comments on published customer stories.
 */

const state = vi.hoisted(() => ({ db: null as unknown, session: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
  isDatabaseConfigured: () => true,
}));
vi.mock("@/lib/auth-guard", () => ({ getSession: async () => state.session }));

import {
  addComment,
  COMMENT_RATE,
  deleteOwnComment,
  discoverProgress,
  homeCustomerStories,
  listCustomerStories,
  postEngagement,
  setCommentUpvote,
  setPostUpvote,
  viewerEngagement,
} from "@/lib/blog/engagement";
import { deleteMyComment, loadPostEngagement, postComment, togglePostUpvote } from "@/lib/blog/engagement-actions";

let test: TestDb;
beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});
beforeEach(() => {
  state.session = null;
});

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
      slug: `post-${n}-${randomUUID().slice(0, 6)}`,
      title: `Post ${n}`,
      description: `About post ${n}`,
      category: "Guides",
      author: "RepGet team",
      bodyHtml: "<p>Text</p>",
      status: "published",
      publishedAt: new Date(Date.now() - (1000 - n) * 1000),
      ...fields,
    })
    .returning({ id: blogPosts.id, slug: blogPosts.slug });
  return row;
}

describe("upvotes", () => {
  it("counts one per user and toggles off, idempotently", async () => {
    const { id } = await post();
    const [a, b] = [await member(), await member()];
    expect(await setPostUpvote(a, id, true)).toEqual({ upvoted: true, count: 1 });
    expect(await setPostUpvote(a, id, true)).toEqual({ upvoted: true, count: 1 });
    await Promise.all([setPostUpvote(b, id, true), setPostUpvote(b, id, true)]);
    expect((await postEngagement(id, b)).upvotes).toBe(2);
    expect(await setPostUpvote(a, id, false)).toEqual({ upvoted: false, count: 1 });
    expect(await setPostUpvote(a, id, false)).toEqual({ upvoted: false, count: 1 });
    expect((await postEngagement(id, a)).upvoted).toBe(false);
    expect((await postEngagement(id, b)).upvoted).toBe(true);
  });

  it("refuses drafts and unknown posts", async () => {
    const draft = await post({ status: "draft", publishedAt: null });
    const a = await member();
    await expect(setPostUpvote(a, draft.id, true)).rejects.toThrow("not_found");
    await expect(setPostUpvote(a, "not-a-uuid", true)).rejects.toThrow("not_found");
  });

  it("upvotes a comment once per user, and not a removed one", async () => {
    const { id } = await post();
    const [a, b] = [await member(), await member()];
    const added = await addComment({ userId: a, postId: id, body: "Useful" });
    if (!added.ok) throw new Error("not added");
    expect(await setCommentUpvote(b, added.commentId, true)).toEqual({ upvoted: true, count: 1 });
    expect(await setCommentUpvote(b, added.commentId, true)).toEqual({ upvoted: true, count: 1 });
    expect(await setCommentUpvote(a, added.commentId, true)).toEqual({ upvoted: true, count: 2 });
    expect(await setCommentUpvote(b, added.commentId, false)).toEqual({ upvoted: false, count: 1 });
    const [shown] = (await postEngagement(id, a)).comments;
    expect(shown).toMatchObject({ upvotes: 1, upvoted: true, own: true, authorName: "Ana Member", body: "Useful" });
    await test.db.update(blogComments).set({ removedAt: new Date(), removedBy: "admin@repget.test" }).where(eq(blogComments.id, added.commentId));
    await expect(setCommentUpvote(b, added.commentId, true)).rejects.toThrow("not_found");
  });
});

describe("comments", () => {
  it("checks the text: empty, too long, plain and tidied", async () => {
    const { id } = await post();
    const a = await member();
    expect(await addComment({ userId: a, postId: id, body: "   \n " })).toEqual({ ok: false, reason: "empty" });
    expect(await addComment({ userId: a, postId: id, body: "x".repeat(751) })).toEqual({ ok: false, reason: "too_long" });
    expect(await addComment({ userId: a, postId: randomUUID(), body: "Hello" })).toEqual({ ok: false, reason: "not_found" });
    expect((await addComment({ userId: a, postId: id, body: "é".repeat(750) })).ok).toBe(true);
    expect((await addComment({ userId: a, postId: id, body: "  <b>Hi</b>\u0007\r\n\n\n\nthere  " })).ok).toBe(true);
    const [latest] = (await postEngagement(id, null)).comments;
    // Stored as typed (shown escaped by React), control characters and blank runs dropped.
    expect(latest.body).toBe("<b>Hi</b>\n\nthere");
  });

  it("limits how many a user posts in a window, deleted ones included", async () => {
    const { id } = await post();
    const a = await member();
    const max = COMMENT_RATE[0].max;
    const results = await Promise.all(Array.from({ length: max + 2 }, (_, i) => addComment({ userId: a, postId: id, body: `Comment ${i}` })));
    expect(results.filter((r) => r.ok)).toHaveLength(max);
    expect(results.filter((r) => !r.ok && r.reason === "rate_limited")).toHaveLength(2);
    const first = results.find((r) => r.ok);
    if (!first?.ok) throw new Error("none added");
    expect(await deleteOwnComment(a, first.commentId)).toBe(true);
    expect(await addComment({ userId: a, postId: id, body: "Again" })).toEqual({ ok: false, reason: "rate_limited" });
    // Another user is not affected.
    expect((await addComment({ userId: await member(), postId: id, body: "Mine" })).ok).toBe(true);
  });

  it("lets only the author delete their comment, and hides it", async () => {
    const { id } = await post();
    const [a, b] = [await member(), await member()];
    const added = await addComment({ userId: a, postId: id, body: "Mine" });
    if (!added.ok) throw new Error("not added");
    expect(await deleteOwnComment(b, added.commentId)).toBe(false);
    expect((await postEngagement(id, null)).comments).toHaveLength(1);
    expect(await deleteOwnComment(a, added.commentId)).toBe(true);
    expect((await postEngagement(id, null)).comments).toHaveLength(0);
  });
});

describe("the post page's actions", () => {
  it("need a signed-in user to write anything", async () => {
    const { id } = await post();
    expect(await togglePostUpvote(id, true)).toEqual({ ok: false, error: "signed_out" });
    expect(await postComment(id, "Hello")).toEqual({ ok: false, error: "signed_out" });
    expect(await deleteMyComment(randomUUID())).toEqual({ ok: false, error: "signed_out" });
    const read = await loadPostEngagement(id);
    expect(read).toMatchObject({ ok: true, data: { signedIn: false, upvotes: 0, comments: [] } });

    const a = await member("Signed In");
    state.session = { user: { id: a }, session: { id: "s" } };
    expect(await togglePostUpvote(id, true)).toEqual({ ok: true, data: { upvoted: true, count: 1 } });
    const posted = await postComment(id, "Hello");
    expect(posted).toMatchObject({ ok: true, data: { signedIn: true, upvoted: true, comments: [{ body: "Hello", own: true, authorName: "Signed In" }] } });
    expect(await postComment(id, "")).toEqual({ ok: false, error: "empty" });
    expect(await togglePostUpvote(randomUUID(), true)).toEqual({ ok: false, error: "not_found" });
  });
});

describe("customer stories", () => {
  const STORIES = "Customer stories";

  it("exists after migration 0090, translated", async () => {
    const rows = await test.client.query<{ name: string; slug: string; translations: Record<string, { name: string }> }>(
      `select name, slug, translations from blog_categories where slug = 'customer-stories'`,
    );
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].name).toBe(STORIES);
    expect(rows.rows[0].translations.it.name).toBe("Storie dei clienti");
  });

  it("lists the latest published ones in the language, falling back to English", async () => {
    await test.db.delete(blogPosts).where(eq(blogPosts.category, STORIES));
    const old = await post({ category: STORIES, businessName: "Old Co" });
    const en1 = await post({ category: STORIES, businessName: "Image Studio", businessCategory: "Photography & Film", businessLogoUrl: "https://x.test/logo.webp", businessWebsiteUrl: "https://imagestudio.test/" });
    const en2 = await post({ category: STORIES, author: "Jane Writer", businessTagline: "Plants, delivered" });
    await post({ category: STORIES, status: "draft", publishedAt: null });
    await post({ category: "Guides" });
    const it1 = await post({ category: STORIES, locale: "it", businessName: "Studio IT" });

    const en = await listCustomerStories("en", 3);
    expect(en.map((s) => s.postId)).toEqual([en2.id, en1.id, old.id]);
    expect(en[1]).toMatchObject({ name: "Image Studio", category: "Photography & Film", logoUrl: "https://x.test/logo.webp", websiteUrl: "https://imagestudio.test/", tagline: en[1].description, href: `/blog/${en1.slug}`, locale: "en" });
    expect(en[0]).toMatchObject({ name: "Jane Writer", tagline: "Plants, delivered", logoUrl: null, category: null });
    expect(await listCustomerStories("en", 1)).toHaveLength(1);

    expect((await listCustomerStories("it")).map((s) => [s.postId, s.href])).toEqual([[it1.id, `/it/blog/${it1.slug}`]]);
    // German has none: the English ones.
    expect((await listCustomerStories("de")).map((s) => s.postId)).toEqual([en2.id, en1.id, old.id]);

    // "View all": the page in the language when it has stories, else the English page (not an empty, noindex one).
    expect((await homeCustomerStories("it"))?.viewAllHref).toBe("/it/blog/category/customer-stories");
    expect((await homeCustomerStories("de"))?.viewAllHref).toBe("/blog/category/customer-stories");
    expect((await homeCustomerStories("en"))?.viewAllHref).toBe("/blog/category/customer-stories");
  });

  it("progress counts distinct published stories upvoted and with a shown comment, in any language", async () => {
    const a = await member();
    const story = await post({ category: STORIES });
    const italian = await post({ category: STORIES, locale: "it" });
    const guide = await post({ category: "Guides" });
    const later = await post({ category: STORIES });
    await setPostUpvote(a, story.id, true);
    await setPostUpvote(a, italian.id, true);
    await setPostUpvote(a, guide.id, true);
    const c1 = await addComment({ userId: a, postId: story.id, body: "One" });
    await addComment({ userId: a, postId: story.id, body: "Two" });
    const c3 = await addComment({ userId: a, postId: later.id, body: "Three" });
    await addComment({ userId: a, postId: guide.id, body: "Guide" });
    expect(await discoverProgress(a)).toEqual({ upvotes: 2, comments: 2 });

    if (!c3.ok || !c1.ok) throw new Error("not added");
    await test.db.update(blogComments).set({ removedAt: new Date(), removedBy: "admin@repget.test" }).where(eq(blogComments.id, c3.commentId));
    expect(await discoverProgress(a)).toEqual({ upvotes: 2, comments: 1 });
    // One of two comments on a story deleted: still commented.
    await deleteOwnComment(a, c1.commentId);
    expect(await discoverProgress(a)).toEqual({ upvotes: 2, comments: 1 });
    // A story taken down stops counting.
    await test.db.update(blogPosts).set({ status: "draft" }).where(eq(blogPosts.id, italian.id));
    expect(await discoverProgress(a)).toEqual({ upvotes: 1, comments: 1 });

    expect(await viewerEngagement(a, [story.id, later.id, guide.id, "bad"])).toEqual({
      [story.id]: { upvoted: true, commented: true },
      [later.id]: { upvoted: false, commented: false },
      [guide.id]: { upvoted: true, commented: true },
      bad: { upvoted: false, commented: false },
    });
  });
});
