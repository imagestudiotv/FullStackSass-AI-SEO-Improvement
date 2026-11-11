import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { user } from "@/lib/db/auth-tables";
import { adminAuditLog, blogComments, blogPosts } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";

/**
 * Customer stories in the blog editor and comment moderation (client,
 * 2026-11-11): the "Business" section's fields are checked and stored (the
 * website http(s) only, the logo one of the blog's pictures), copied to a
 * translation, and a save of a live customer story rebuilds the homepages;
 * administrators remove and restore comments, audited, and nobody else can.
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

import { createBlogTranslation, getBlogPostAdmin, saveBlogPost, type BlogPostInput } from "@/lib/admin/blog";
import { listCommentsAdmin, setCommentRemoved } from "@/lib/admin/blog-comments";
import { businessWebsite } from "@/lib/blog/business";
import { addComment, postEngagement } from "@/lib/blog/engagement";

let test: TestDb;
const ADMIN = "admin@repget.test";
const LOGO = "https://store.example.test/storage/v1/object/public/article-images/blog/posts/en/logo.webp";

beforeAll(async () => {
  vi.stubEnv("ADMIN_EMAILS", ADMIN);
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://repget.test");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://store.example.test");
  test = await createTestDb();
  state.db = test.db;
});
beforeEach(() => {
  asAdmin();
  cache.revalidatePath.mockClear();
});

function asAdmin() {
  state.session = { user: { id: "admin_user", email: ADMIN, emailVerified: true }, session: { id: "s_admin", activeOrganizationId: null } };
}
function asCustomer() {
  state.session = { user: { id: "u1", email: "customer@example.test", emailVerified: true }, session: { id: "s1", activeOrganizationId: "o1" } };
}

let n = 0;
function input(overrides: Partial<BlogPostInput> = {}): BlogPostInput {
  n += 1;
  return {
    title: `Story ${n}`,
    slug: "",
    description: "How a studio grew.",
    seoTitle: "",
    primaryKeyword: "",
    secondaryKeywords: [],
    breadcrumbLabel: "",
    category: "Customer stories",
    author: "",
    shortAnswer: "",
    bodyHtml: "<p>Text.</p>",
    faqs: [],
    sources: [],
    ...overrides,
  };
}
const business = (overrides: Partial<NonNullable<BlogPostInput["business"]>> = {}) => ({
  logoUrl: "",
  name: "",
  category: "",
  websiteUrl: "",
  tagline: "",
  ...overrides,
});

describe("the business website", () => {
  it("accepts only http(s) addresses of a public host", () => {
    expect(businessWebsite("https://imagestudio.tv")).toBe("https://imagestudio.tv/");
    expect(businessWebsite("http://example.com/path?a=1")).toBe("http://example.com/path?a=1");
    expect(businessWebsite("imagestudio.tv")).toBe("https://imagestudio.tv/");
    for (const bad of ["javascript:alert(1)", "data:text/html,hi", "ftp://example.com", "mailto:a@b.co", "https://localhost", "https://user:pw@example.com", "not a site", "https://", "example"]) {
      expect(businessWebsite(bad), bad).toBeNull();
    }
  });
});

describe("the editor's Business section", () => {
  it("stores the fields, refuses a bad website or a logo from elsewhere, and copies them to a translation", async () => {
    const refused = await saveBlogPost({ id: null, expectedVersion: 0, status: "draft", post: input({ business: business({ websiteUrl: "javascript:alert(1)" }) }) });
    expect(refused.ok).toBe(false);
    const foreign = await saveBlogPost({ id: null, expectedVersion: 0, status: "draft", post: input({ business: business({ logoUrl: "https://evil.test/logo.png" }) }) });
    expect(foreign).toMatchObject({ ok: false, error: expect.stringContaining("logo") });

    const saved = await saveBlogPost({
      id: null,
      expectedVersion: 0,
      status: "published",
      post: input({ business: business({ logoUrl: LOGO, name: "  Image   Studio ", category: "Photography & Film", websiteUrl: "imagestudio.tv", tagline: "Films that last" }) }),
    });
    if (!saved.ok) throw new Error(saved.error);
    const post = await getBlogPostAdmin(saved.data.id);
    expect(post?.business).toEqual({ logoUrl: LOGO, name: "Image Studio", category: "Photography & Film", websiteUrl: "https://imagestudio.tv/", tagline: "Films that last" });
    // A live customer story: every homepage is rebuilt.
    expect(cache.revalidatePath).toHaveBeenCalledWith("/");
    expect(cache.revalidatePath).toHaveBeenCalledWith("/it");

    const translated = await createBlogTranslation({ sourceId: saved.data.id, locale: "it", mode: "copy" });
    if (!translated.ok) throw new Error(translated.error);
    expect((await getBlogPostAdmin(translated.data.id))?.business).toEqual(post?.business);
  });

  it("a save without the section keeps it; a guide does not rebuild the homepage", async () => {
    const saved = await saveBlogPost({ id: null, expectedVersion: 0, status: "draft", post: input({ business: business({ name: "Kept" }) }) });
    if (!saved.ok) throw new Error(saved.error);
    const again = await saveBlogPost({ id: saved.data.id, expectedVersion: saved.data.version, status: "draft", post: input({ title: "Renamed" }) });
    expect(again.ok).toBe(true);
    expect((await getBlogPostAdmin(saved.data.id))?.business.name).toBe("Kept");

    cache.revalidatePath.mockClear();
    const guide = await saveBlogPost({ id: null, expectedVersion: 0, status: "published", post: input({ category: "Guides" }) });
    expect(guide.ok).toBe(true);
    expect(cache.revalidatePath).not.toHaveBeenCalledWith("/");
  });
});

describe("moderating comments", () => {
  async function comment() {
    const [p] = await test.db
      .insert(blogPosts)
      .values({ slug: `c-${randomUUID().slice(0, 8)}`, title: "Commented", category: "Guides", author: "RepGet team", status: "published", publishedAt: new Date() })
      .returning({ id: blogPosts.id });
    const userId = `u_${randomUUID().slice(0, 8)}`;
    await test.db.insert(user).values({ id: userId, name: "Reader", email: `${userId}@example.test` });
    const added = await addComment({ userId, postId: p.id, body: "Rude words" });
    if (!added.ok) throw new Error("not added");
    return { postId: p.id, commentId: added.commentId };
  }

  it("removes and restores a comment, audited, and lists it in the right view", async () => {
    const { postId, commentId } = await comment();
    expect((await listCommentsAdmin("shown")).rows.map((r) => r.id)).toContain(commentId);

    expect(await setCommentRemoved({ id: commentId, removed: true })).toEqual({ ok: true, data: null });
    expect((await postEngagement(postId, null)).comments).toEqual([]);
    const [row] = await test.db.select().from(blogComments).where(eq(blogComments.id, commentId));
    expect(row.removedBy).toBe(ADMIN);
    expect((await listCommentsAdmin("removed")).rows.map((r) => r.id)).toContain(commentId);
    expect((await listCommentsAdmin("shown")).rows.map((r) => r.id)).not.toContain(commentId);

    expect(await setCommentRemoved({ id: commentId, removed: false })).toEqual({ ok: true, data: null });
    expect((await postEngagement(postId, null)).comments).toHaveLength(1);

    const audit = await test.db
      .select({ action: adminAuditLog.action, actor: adminAuditLog.actorEmail })
      .from(adminAuditLog)
      .where(and(eq(adminAuditLog.targetType, "blog_comment"), eq(adminAuditLog.targetId, commentId)));
    expect(audit.map((a) => a.action).sort()).toEqual(["blog.comment_removed", "blog.comment_restored"]);
    expect(audit.every((a) => a.actor === ADMIN)).toBe(true);
  });

  it("is for administrators only", async () => {
    const { commentId } = await comment();
    asCustomer();
    await expect(setCommentRemoved({ id: commentId, removed: true })).rejects.toThrow();
    await expect(listCommentsAdmin()).rejects.toThrow();
    const [row] = await test.db.select().from(blogComments).where(eq(blogComments.id, commentId));
    expect(row.removedAt).toBeNull();
  });
});
