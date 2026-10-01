import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { adminAuditLog, blogCategories, blogPosts } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";

const state = vi.hoisted(() => ({ db: null as unknown, session: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
}));
vi.mock("@/lib/auth-guard", () => ({ getSession: async () => state.session }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  createBlogCategory,
  deleteBlogCategory,
  deleteBlogPost,
  getBlogPostAdmin,
  listBlogCategoriesAdmin,
  listBlogPostsAdmin,
  saveBlogCategory,
  saveBlogPost,
  type BlogPostInput,
} from "@/lib/admin/blog";
import { categoryBySlug, listCategories } from "@/lib/blog/categories";
import { getPost, listPosts } from "@/lib/blog/posts";
import { jsonLdScript } from "@/lib/blog/shared";

let test: TestDb;
const ADMIN = "admin@repget.test";

beforeAll(async () => {
  vi.stubEnv("ADMIN_EMAILS", ADMIN);
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://repget.test");
  test = await createTestDb();
  state.db = test.db;
});

beforeEach(() => asAdmin());

function asAdmin(email = ADMIN) {
  state.session = { user: { id: "admin_user", email, emailVerified: true }, session: { id: "s_admin", activeOrganizationId: null } };
}

let n = 0;
function input(overrides: Partial<BlogPostInput> = {}): BlogPostInput {
  n += 1;
  return {
    title: `Choosing a wedding videographer ${n}`,
    slug: "",
    description: "What to ask before you book.",
    category: "Guides",
    author: "",
    shortAnswer: "",
    bodyHtml: "<h2>Start here</h2><p>Ask to see a full film, not a trailer.</p>",
    faqs: [],
    sources: [],
    ...overrides,
  };
}

async function create(status: "draft" | "published", overrides: Partial<BlogPostInput> = {}) {
  const result = await saveBlogPost({ id: null, expectedVersion: 0, status, post: input(overrides) });
  if (!result.ok) throw new Error(result.error);
  return result.data;
}

async function row(id: string) {
  const [found] = await test.db.select().from(blogPosts).where(eq(blogPosts.id, id));
  return found;
}

describe("the posts that were constants, moved by migration 0046", () => {
  it("are published, newest first, on their old dates and addresses, by RepGet team", async () => {
    const posts = await listPosts();
    const seeded = posts.filter((post) =>
      ["what-to-fix-first", "how-ai-assistants-recommend-businesses", "why-your-website-isnt-on-google"].includes(post.slug),
    );
    expect(seeded.map((post) => [post.slug, post.publishedAt, post.category])).toEqual([
      ["what-to-fix-first", "2026-08-27", "Playbooks"],
      ["how-ai-assistants-recommend-businesses", "2026-08-20", "Guides"],
      ["why-your-website-isnt-on-google", "2026-08-12", "Guides"],
    ]);
    const first = await getPost("why-your-website-isnt-on-google");
    expect(first).toMatchObject({ author: "RepGet team", title: "Why your website isn't showing up on Google" });
    expect(first!.faqs).toHaveLength(3);
    expect(first!.sources).toHaveLength(2);
    expect(first!.body).toContain("<h2>");
    expect(first!.readingMinutes).toBeGreaterThanOrEqual(1);
  });
});

describe("writing and publishing a post", () => {
  it("a draft is only in the admin panel; publishing puts it on the blog at once", async () => {
    const draft = await create("draft");
    expect(draft).toMatchObject({ status: "draft", version: 0, slug: expect.stringMatching(/^choosing-a-wedding-videographer-\d+$/) });
    expect(await getPost(draft.slug)).toBeNull();
    expect((await listPosts()).some((post) => post.slug === draft.slug)).toBe(false);
    expect((await listBlogPostsAdmin()).some((post) => post.id === draft.id)).toBe(true);
    expect((await row(draft.id)).publishedAt).toBeNull();

    const current = (await getBlogPostAdmin(draft.id))!;
    const published = await saveBlogPost({
      id: draft.id,
      expectedVersion: current.version,
      status: "published",
      post: { ...input(), title: current.title, slug: current.slug },
    });
    expect(published).toMatchObject({ ok: true, data: { status: "published", version: 1 } });
    const live = await getPost(draft.slug);
    expect(live).toMatchObject({ title: current.title, author: "RepGet team", publishedAt: new Date().toISOString().slice(0, 10) });
    expect(live!.updatedAt).toBeUndefined();

    const audit = await test.db.select().from(adminAuditLog).where(eq(adminAuditLog.targetId, draft.id));
    expect(audit.map((a) => a.action).sort()).toEqual(["blog.post_created", "blog.post_published"]);
  });

  it("publishing needs a description and some text; a draft does not", async () => {
    expect(await saveBlogPost({ id: null, expectedVersion: 0, status: "published", post: input({ description: " " }) })).toMatchObject({
      ok: false,
      error: expect.stringMatching(/description/),
    });
    expect(await saveBlogPost({ id: null, expectedVersion: 0, status: "published", post: input({ bodyHtml: "<p> </p>" }) })).toMatchObject({
      ok: false,
      error: expect.stringMatching(/no text/),
    });
    expect(await saveBlogPost({ id: null, expectedVersion: 0, status: "draft", post: input({ description: "", bodyHtml: "" }) })).toMatchObject({ ok: true });
    expect(await saveBlogPost({ id: null, expectedVersion: 0, status: "draft", post: input({ title: "  " }) })).toMatchObject({
      ok: false,
      error: expect.stringMatching(/title/),
    });
  });

  it("the address: tidied, unique, not a blog path, and fixed once published - even after unpublishing", async () => {
    const a = await create("draft", { slug: "  Café Films: Italy!  " });
    expect(a.slug).toBe("cafe-films-italy");
    expect(await saveBlogPost({ id: null, expectedVersion: 0, status: "draft", post: input({ slug: "cafe-films-italy" }) })).toMatchObject({
      ok: false,
      error: expect.stringMatching(/already uses the address \/blog\/cafe-films-italy/),
    });
    expect(await saveBlogPost({ id: null, expectedVersion: 0, status: "draft", post: input({ slug: "Category" }) })).toMatchObject({
      ok: false,
      error: expect.stringMatching(/used by the blog itself/),
    });

    // A draft's address can still change.
    const renamed = await saveBlogPost({ id: a.id, expectedVersion: 0, status: "draft", post: input({ slug: "cafe-films" }) });
    expect(renamed).toMatchObject({ ok: true, data: { slug: "cafe-films" } });
    const published = await saveBlogPost({ id: a.id, expectedVersion: 1, status: "published", post: input({ slug: "cafe-films" }) });
    expect(published).toMatchObject({ ok: true });
    const unpublished = await saveBlogPost({ id: a.id, expectedVersion: 2, status: "draft", post: input({ slug: "cafe-films" }) });
    expect(unpublished).toMatchObject({ ok: true, data: { status: "draft" } });
    expect(await saveBlogPost({ id: a.id, expectedVersion: 3, status: "draft", post: input({ slug: "cafe-films-2" }) })).toMatchObject({
      ok: false,
      error: expect.stringMatching(/published post cannot change/),
    });
  });

  it("two administrators: the later save from an older copy is refused, nothing overwritten", async () => {
    const post = await create("draft");
    const first = await saveBlogPost({ id: post.id, expectedVersion: 0, status: "draft", post: input({ title: "First admin's title", slug: post.slug }) });
    expect(first).toMatchObject({ ok: true });
    const second = await saveBlogPost({ id: post.id, expectedVersion: 0, status: "draft", post: input({ title: "Second admin's title", slug: post.slug }) });
    expect(second).toMatchObject({ ok: false, error: expect.stringMatching(/changed after you opened it/) });
    expect((await row(post.id)).title).toBe("First admin's title");
  });

  it("the text and FAQ answers are sanitised; links to RepGet stay followed, others are nofollow", async () => {
    const post = await create("published", {
      bodyHtml:
        '<p>Read <a href="https://repget.test/pricing">our prices</a> and <a href="https://example.com/guide">this guide</a>.</p>' +
        '<script>alert(1)</script><img src="x" onerror="alert(2)"><p><a href="javascript:alert(3)">x</a></p>',
      faqs: [{ question: "Is it safe?", answer: 'Yes.<script>alert(4)</script><img src=x onerror="alert(5)">' }],
    });
    const stored = await row(post.id);
    expect(stored.bodyHtml).not.toMatch(/script|onerror|javascript:/i);
    expect(stored.bodyHtml).toContain('<a href="https://repget.test/pricing">our prices</a>');
    expect(stored.bodyHtml).toContain('href="https://example.com/guide" target="_blank" rel="noopener nofollow"');
    expect(stored.faqs[0].answer).not.toMatch(/script|onerror/i);
    expect(stored.faqs[0].answer).toContain("Yes.");
  });

  it("FAQs need both halves (empty rows are dropped); sources need a real web address", async () => {
    expect(
      await saveBlogPost({ id: null, expectedVersion: 0, status: "draft", post: input({ faqs: [{ question: "Only a question", answer: "" }] }) }),
    ).toMatchObject({ ok: false, error: expect.stringMatching(/both a question and an answer/) });
    expect(
      await saveBlogPost({ id: null, expectedVersion: 0, status: "draft", post: input({ sources: [{ label: "Bad", url: "javascript:alert(1)" }] }) }),
    ).toMatchObject({ ok: false, error: expect.stringMatching(/not a web address/) });

    const post = await create("draft", {
      faqs: [{ question: "", answer: "" }, { question: "How long?", answer: "About a week." }],
      sources: [{ label: "", url: "" }, { label: "", url: "https://developers.google.com/search" }],
    });
    const stored = await row(post.id);
    expect(stored.faqs).toEqual([{ question: "How long?", answer: "About a week." }]);
    expect(stored.sources).toEqual([{ label: "developers.google.com", url: "https://developers.google.com/search" }]);
  });

  it("changing a live post on a later day shows it as updated; a save that changes nothing does not", async () => {
    const post = await create("published");
    await test.db.update(blogPosts).set({ publishedAt: new Date("2026-06-01T00:00:00Z") }).where(eq(blogPosts.id, post.id));
    const unchanged = await saveBlogPost({ id: post.id, expectedVersion: 0, status: "published", post: { ...input(), title: (await row(post.id)).title, slug: post.slug } });
    expect(unchanged).toMatchObject({ ok: true });
    expect((await getPost(post.slug))!.updatedAt).toBeUndefined();

    const changed = await saveBlogPost({ id: post.id, expectedVersion: 1, status: "published", post: input({ slug: post.slug, title: "A better title" }) });
    expect(changed).toMatchObject({ ok: true });
    expect(await getPost(post.slug)).toMatchObject({ title: "A better title", publishedAt: "2026-06-01", updatedAt: new Date().toISOString().slice(0, 10) });
  });

  it("unpublishing takes it off the blog; only a post that is not live can be deleted", async () => {
    const post = await create("published");
    expect(await deleteBlogPost({ id: post.id, expectedVersion: 0 })).toMatchObject({ ok: false, error: expect.stringMatching(/Unpublish/) });
    expect(await saveBlogPost({ id: post.id, expectedVersion: 0, status: "draft", post: input({ slug: post.slug }) })).toMatchObject({ ok: true });
    expect(await getPost(post.slug)).toBeNull();
    expect(await deleteBlogPost({ id: post.id, expectedVersion: 0 })).toMatchObject({ ok: false, error: expect.stringMatching(/changed/) });
    expect(await deleteBlogPost({ id: post.id, expectedVersion: 1 })).toMatchObject({ ok: true });
    expect(await row(post.id)).toBeUndefined();
    const audit = await test.db.select().from(adminAuditLog).where(eq(adminAuditLog.targetId, post.id));
    expect(audit.map((a) => a.action).sort()).toEqual(["blog.post_deleted", "blog.post_published", "blog.post_unpublished"]);
  });

  it("only administrators", async () => {
    state.session = { user: { id: "u1", email: "customer@example.test", emailVerified: true }, session: { id: "s1", activeOrganizationId: "o1" } };
    await expect(listBlogPostsAdmin()).rejects.toThrow();
    await expect(saveBlogPost({ id: null, expectedVersion: 0, status: "published", post: input() })).rejects.toThrow();
    asAdmin();
    expect(await getBlogPostAdmin("not-a-uuid")).toBeNull();
  });
});

describe("structured data", () => {
  it("a typed </script> cannot end the JSON-LD block, and the JSON still reads back the same", () => {
    const value = { headline: 'Tips </script><script>alert(1)</script>' };
    const out = jsonLdScript(value);
    expect(out).not.toContain("</script>");
    expect(JSON.parse(out)).toEqual(value);
  });
});

describe("categories (client, 2026-10-01: he adds his own)", () => {
  /** Leaves only the three the migration created, for each test. */
  beforeEach(async () => {
    await test.db.delete(blogPosts).where(eq(blogPosts.category, "Case studies"));
    await test.db.delete(blogPosts).where(eq(blogPosts.category, "Customer stories"));
    for (const row of await test.db.select().from(blogCategories)) {
      if (!["Guides", "Comparisons", "Playbooks"].includes(row.name)) {
        await test.db.delete(blogCategories).where(eq(blogCategories.id, row.id));
      }
    }
  });

  it("migration 0048 keeps the three the blog had, with their addresses and descriptions", async () => {
    expect((await listCategories()).map((c) => [c.name, c.slug])).toEqual([
      ["Guides", "guides"],
      ["Comparisons", "comparisons"],
      ["Playbooks", "playbooks"],
    ]);
    expect((await categoryBySlug("guides"))?.blurb).toMatch(/Plain-English/);
    // The posts that were constants point at them.
    expect((await getPost("what-to-fix-first"))?.categorySlug).toBe("playbooks");
  });

  it("adding one: its page exists at once, posts can use it, and it is logged", async () => {
    const added = await createBlogCategory({ name: "  Case   studies ", blurb: "Real results, step by step." });
    expect(added).toMatchObject({ ok: true, data: { name: "Case studies", slug: "case-studies", posts: 0 } });
    expect(await categoryBySlug("case-studies")).toEqual({ name: "Case studies", slug: "case-studies", blurb: "Real results, step by step." });
    // Last in the order.
    expect((await listCategories()).at(-1)?.name).toBe("Case studies");

    const post = await create("published", { category: "Case studies", title: "How a bakery doubled its bookings" });
    const live = await getPost(post.slug);
    expect(live).toMatchObject({ category: "Case studies", categorySlug: "case-studies" });
    expect((await listBlogCategoriesAdmin()).find((c) => c.slug === "case-studies")?.posts).toBe(1);

    const audit = await test.db.select().from(adminAuditLog).where(eq(adminAuditLog.action, "blog.category_created"));
    expect(audit.some((a) => a.summary === 'Added the blog category "Case studies"')).toBe(true);
  });

  it("names are checked: required, short, unique in any letter case", async () => {
    expect(await createBlogCategory({ name: "  ", blurb: "" })).toMatchObject({ ok: false, error: expect.stringMatching(/name/) });
    expect(await createBlogCategory({ name: "x".repeat(41), blurb: "" })).toMatchObject({ ok: false });
    expect(await createBlogCategory({ name: "!!!", blurb: "" })).toMatchObject({ ok: false });
    expect(await createBlogCategory({ name: "guides", blurb: "" })).toMatchObject({ ok: false, error: expect.stringMatching(/already a category/) });
  });

  it("a post cannot use a category that does not exist", async () => {
    const result = await saveBlogPost({ id: null, expectedVersion: 0, status: "draft", post: input({ category: "Nonsense" }) });
    expect(result).toMatchObject({ ok: false, error: expect.stringMatching(/category/) });
  });

  it("renaming keeps the address and moves its posts, drafts included", async () => {
    const added = await createBlogCategory({ name: "Case studies", blurb: "" });
    if (!added.ok) throw new Error(added.error);
    const draft = await create("draft", { category: "Case studies" });
    const live = await create("published", { category: "Case studies" });
    expect(await saveBlogCategory({ id: added.data.id, name: "Customer stories", blurb: "Told by the owners." })).toEqual({ ok: true, data: null });
    expect((await row(draft.id)).category).toBe("Customer stories");
    expect(await getPost(live.slug)).toMatchObject({ category: "Customer stories", categorySlug: "case-studies" });
    expect(await categoryBySlug("case-studies")).toMatchObject({ name: "Customer stories", blurb: "Told by the owners." });
    // Not onto another category's name.
    expect(await saveBlogCategory({ id: added.data.id, name: "Guides", blurb: "" })).toMatchObject({ ok: false });
  });

  it("only a category no post uses can be deleted, and its page then stops existing", async () => {
    const added = await createBlogCategory({ name: "Case studies", blurb: "" });
    if (!added.ok) throw new Error(added.error);
    const draft = await create("draft", { category: "Case studies" });
    expect(await deleteBlogCategory({ id: added.data.id })).toMatchObject({ ok: false, error: expect.stringMatching(/1 post/) });
    await saveBlogPost({ id: draft.id, expectedVersion: draft.version, status: "draft", post: input({ category: "Guides" }) });
    expect(await deleteBlogCategory({ id: added.data.id })).toEqual({ ok: true, data: null });
    expect(await categoryBySlug("case-studies")).toBeNull();
  });

  it("only administrators", async () => {
    state.session = { user: { id: "u1", email: "customer@example.test", emailVerified: true }, session: { id: "s1", activeOrganizationId: "o1" } };
    await expect(listBlogCategoriesAdmin()).rejects.toThrow();
    await expect(createBlogCategory({ name: "Sneaky", blurb: "" })).rejects.toThrow();
    await expect(deleteBlogCategory({ id: "00000000-0000-0000-0000-000000000000" })).rejects.toThrow();
  });
});
