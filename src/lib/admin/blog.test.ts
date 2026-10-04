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
const indexNow = vi.hoisted(() => ({ notify: vi.fn() }));
vi.mock("@/lib/indexnow", () => ({ notifyIndexNow: indexNow.notify }));

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
import { FAQ_ANSWER_LIMIT, jsonLdScript, plainText } from "@/lib/blog/shared";

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

/** Every page reported to IndexNow since the last clear, in order. */
function reported(): string[] {
  return indexNow.notify.mock.calls.flatMap(([paths]) => paths as string[]);
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

  it("keeps an image's alt text through the save - what the editor's image panel writes", async () => {
    const post = await create("published", {
      bodyHtml: '<p>Intro</p><img src="https://cdn.test/blog/rome.jpg" alt="Bride &amp; groom in &quot;St Peter&#39;s&quot; Square">',
    });
    const stored = await row(post.id);
    expect(stored.bodyHtml).toContain('<img src="https://cdn.test/blog/rome.jpg" alt="Bride &amp; groom in &quot;St Peter\'s&quot; Square" />');
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

  /*
    FAQ answers are written in the text editor's compact form (2026-10-04):
    HTML, where an emptied answer still holds "<p></p>".
  */
  it("FAQ answers from the editor: markup without words is no answer; bold, links and lists are kept", async () => {
    for (const blank of ["<p></p>", "<p> </p>", "<p><br></p>", "<ul><li></li></ul>", "<p>&nbsp;</p>"]) {
      expect(
        await saveBlogPost({ id: null, expectedVersion: 0, status: "draft", post: input({ faqs: [{ question: "How long?", answer: blank }] }) }),
        blank,
      ).toMatchObject({ ok: false, error: expect.stringMatching(/both a question and an answer/) });
    }

    const post = await create("draft", {
      faqs: [
        // A row added and left empty, its answer typed and deleted again.
        { question: " ", answer: "<p></p>" },
        {
          question: "How long?",
          answer:
            '<p><strong>About a week</strong>, <em>sometimes</em> see <a target="_blank" rel="noopener nofollow" href="https://example.com/guide">the guide</a>:</p>' +
            "<ol><li><p>filming: a day</p></li><li><p>editing: the rest</p></li></ol><p></p>",
        },
      ],
    });
    expect((await row(post.id)).faqs).toEqual([
      {
        question: "How long?",
        answer:
          '<p><strong>About a week</strong>, <em>sometimes</em> see <a href="https://example.com/guide" target="_blank" rel="noopener nofollow">the guide</a>:</p>' +
          "<ol><li><p>filming: a day</p></li><li><p>editing: the rest</p></li></ol>",
      },
    ]);
  });

  it("a FAQ answer over the limit is refused, not cut: a cut could leave half a tag on the page", async () => {
    const tail = ' <a href="https://example.com/a-page">link</a></p>';
    // What the sanitiser adds to a link off the site, counted with the rest: the limit is on the answer as stored.
    const outside = ' target="_blank" rel="noopener nofollow"';
    const atLimit = `<p>${"a".repeat(FAQ_ANSWER_LIMIT - 3 - tail.length - outside.length)}${tail}`;
    // The link starting just before the limit: the old cut ended inside its tag.
    const over = `<p>${"a".repeat(FAQ_ANSWER_LIMIT - 15)}${tail}`;
    expect(over.slice(0, FAQ_ANSWER_LIMIT)).toMatch(/<a href="[^>]*$/);

    const refused = await saveBlogPost({
      id: null,
      expectedVersion: 0,
      status: "draft",
      post: input({ faqs: [{ question: "Short?", answer: "<p>Yes.</p>" }, { question: "Long?", answer: over }] }),
    });
    expect(refused).toMatchObject({
      ok: false,
      error: expect.stringContaining(
        `question 2 is too long: ${over.length + outside.length} characters with its formatting, and the limit is ${FAQ_ANSWER_LIMIT}`,
      ),
    });

    const post = await create("draft", { faqs: [{ question: "Long?", answer: atLimit }] });
    const [stored] = (await row(post.id)).faqs;
    expect(stored.answer).toMatch(/^<p>a+ <a href="https:\/\/example\.com\/a-page" target="_blank" rel="noopener nofollow">link<\/a><\/p>$/);
    expect(stored.answer).toHaveLength(FAQ_ANSWER_LIMIT);
  });

  /*
    The editor writes a line break (Shift+Enter) as <br>, which is stored as
    <br />. Counted as written, an answer let through just under the limit was
    stored over it, and every later save of that post was refused - even one
    that left the answer alone.
  */
  it("a FAQ answer is measured as stored: one that would grow past the limit is refused, a stored one saves again", async () => {
    // Under the limit as written; each <br> gains two characters on save.
    const growing = `<p>${"a".repeat(FAQ_ANSWER_LIMIT - 20)}<br>b<br>c</p>`;
    expect(growing).toHaveLength(FAQ_ANSWER_LIMIT - 3);
    expect(
      await saveBlogPost({ id: null, expectedVersion: 0, status: "draft", post: input({ faqs: [{ question: "Long?", answer: growing }] }) }),
    ).toMatchObject({
      ok: false,
      error: expect.stringContaining(`question 1 is too long: ${FAQ_ANSWER_LIMIT + 1} characters`),
    });

    const post = await create("draft", { faqs: [{ question: "Long?", answer: `<p>${"a".repeat(FAQ_ANSWER_LIMIT - 21)}<br>b<br>c</p>` }] });
    const { faqs } = await row(post.id);
    expect(faqs[0].answer).toHaveLength(FAQ_ANSWER_LIMIT);
    expect(faqs[0].answer).toContain("<br />b<br />c");
    // Saved again as the editor loads it after a reload: the stored answer, untouched.
    expect(
      await saveBlogPost({ id: post.id, expectedVersion: post.version, status: "draft", post: input({ slug: post.slug, faqs }) }),
    ).toMatchObject({ ok: true });
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

/**
 * Pages readers can see changed are reported to Bing and the other IndexNow
 * engines (lib/indexnow.ts, client's launch review 2026-10-03); a draft's
 * changes never are.
 */
describe("IndexNow: what a post's save reports", () => {
  beforeEach(() => indexNow.notify.mockClear());

  /** The same post, saved again with only `changes` different - nothing else, not even the title. */
  async function resave(id: string, version: number, status: "draft" | "published", changes: Partial<BlogPostInput> = {}) {
    const stored = await row(id);
    const result = await saveBlogPost({
      id,
      expectedVersion: version,
      status,
      post: {
        title: stored.title,
        slug: stored.slug,
        description: stored.description,
        category: stored.category,
        author: stored.author,
        shortAnswer: stored.shortAnswer ?? "",
        bodyHtml: stored.bodyHtml,
        faqs: stored.faqs,
        sources: stored.sources,
        ...changes,
      },
    });
    if (!result.ok) throw new Error(result.error);
    return result.data;
  }

  it("a draft is never reported; publishing reports the post, the blog and its category", async () => {
    const draft = await create("draft");
    await resave(draft.id, 0, "draft", { title: "Still a draft" });
    expect(reported()).toEqual([]);

    await resave(draft.id, 1, "published");
    expect(reported()).toEqual([`/blog/${draft.slug}`, "/blog", "/blog/category/guides"]);

    indexNow.notify.mockClear();
    const direct = await create("published", { category: "Comparisons" });
    expect(reported()).toEqual([`/blog/${direct.slug}`, "/blog", "/blog/category/comparisons"]);
  });

  it("a live post: only the pages that changed - its own for any edit, the listings when its card changes", async () => {
    const post = await create("published");
    indexNow.notify.mockClear();
    await resave(post.id, 0, "published");
    expect(reported()).toEqual([]);

    // Shown on its own page only.
    await resave(post.id, 1, "published", { author: "Jane Doe" });
    await resave(post.id, 2, "published", { bodyHtml: "<h2>Start here</h2><p>Ask to see a full film, not just a trailer.</p>" });
    await resave(post.id, 3, "published", { sources: [{ label: "Google", url: "https://developers.google.com/search" }] });
    expect(reported()).toEqual([`/blog/${post.slug}`, `/blog/${post.slug}`, `/blog/${post.slug}`]);

    // On its card too: the title, the description, the minutes to read.
    for (const [version, changes] of [
      [4, { title: "A new title" }],
      [5, { description: "A new description." }],
      [6, { bodyHtml: `<p>${"word ".repeat(600)}</p>` }],
    ] as const) {
      indexNow.notify.mockClear();
      await resave(post.id, version, "published", changes);
      expect(reported()).toEqual([`/blog/${post.slug}`, "/blog", "/blog/category/guides"]);
    }
  });

  /** Postgres hands jsonb keys back in its own order; that alone must not count as a change. */
  it("a live post with FAQs and sources, saved unchanged: nothing reported, and not marked as updated", async () => {
    const post = await create("published", {
      faqs: [{ question: "How long is a film?", answer: "<p>About ten minutes.</p>" }],
      sources: [{ label: "Google Search Central", url: "https://developers.google.com/search" }],
    });
    indexNow.notify.mockClear();
    const stored = await row(post.id);
    // As the editor sends it after "Add question" on a row left empty: clean() drops the row.
    await resave(post.id, 0, "published", { faqs: [...stored.faqs, { question: "", answer: "" }] });
    expect(reported()).toEqual([]);
    expect((await row(post.id)).revisedAt).toBeNull();
  });

  it("unpublishing reports the address that is now gone; deleting the post afterwards reports nothing", async () => {
    const post = await create("published");
    indexNow.notify.mockClear();
    await resave(post.id, 0, "draft");
    expect(reported()).toEqual([`/blog/${post.slug}`, "/blog", "/blog/category/guides"]);

    indexNow.notify.mockClear();
    expect(await deleteBlogPost({ id: post.id, expectedVersion: 1 })).toMatchObject({ ok: true });
    expect(reported()).toEqual([]);
  });

  it("moving a live post to another category reports both categories' pages; moving a draft reports nothing", async () => {
    const post = await create("published");
    indexNow.notify.mockClear();
    await resave(post.id, 0, "published", { category: "Playbooks" });
    expect(reported()).toEqual([`/blog/${post.slug}`, "/blog", "/blog/category/playbooks", "/blog/category/guides"]);

    const draft = await create("draft");
    indexNow.notify.mockClear();
    await resave(draft.id, 0, "draft", { category: "Playbooks" });
    expect(reported()).toEqual([]);
  });

  it("unpublished and moved in one save: the category it left, not the one it never appeared in", async () => {
    const post = await create("published");
    indexNow.notify.mockClear();
    await resave(post.id, 0, "draft", { category: "Playbooks" });
    expect(reported()).toEqual([`/blog/${post.slug}`, "/blog", "/blog/category/guides"]);
  });

  it("a refused save reports nothing", async () => {
    const post = await create("published");
    indexNow.notify.mockClear();
    // An older copy: refused, nothing changed.
    expect(await saveBlogPost({ id: post.id, expectedVersion: 7, status: "published", post: input({ slug: post.slug }) })).toMatchObject({ ok: false });
    // A live post's address cannot change.
    expect(await saveBlogPost({ id: post.id, expectedVersion: 0, status: "published", post: input({ slug: "somewhere-else" }) })).toMatchObject({ ok: false });
    expect(indexNow.notify).not.toHaveBeenCalled();
  });
});

describe("structured data", () => {
  it("a typed </script> cannot end the JSON-LD block, and the JSON still reads back the same", () => {
    const value = { headline: 'Tips </script><script>alert(1)</script>' };
    const out = jsonLdScript(value);
    expect(out).not.toContain("</script>");
    expect(JSON.parse(out)).toEqual(value);
  });

  it("a saved FAQ answer as the FAQPage text: list items apart, references decoded, no markup", async () => {
    const post = await create("published", {
      faqs: [
        {
          question: "What does it cost?",
          answer: "<p>Rome &amp; Florence&#39;s rates:</p><ul><li><p>half day</p></li><li><p>full&nbsp;day</p></li></ul>",
        },
      ],
    });
    const [faq] = (await getPost(post.slug))!.faqs!;
    // As the post page builds acceptedAnswer.text (app/(marketing)/blog/[slug]/page.tsx).
    expect(plainText(faq.answer)).toBe("Rome & Florence's rates:\nhalf day\nfull day");
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

  it("IndexNow: renaming a category with live posts reports its page, the blog and each live post", async () => {
    const added = await createBlogCategory({ name: "Case studies", blurb: "" });
    if (!added.ok) throw new Error(added.error);
    await create("draft", { category: "Case studies" });
    indexNow.notify.mockClear();
    // Only drafts: its page is not public, so nothing to report.
    expect(await saveBlogCategory({ id: added.data.id, name: "Case studies", blurb: "Real results." })).toEqual({ ok: true, data: null });
    expect(reported()).toEqual([]);

    const live = await create("published", { category: "Case studies" });
    indexNow.notify.mockClear();
    // A new description shows on its own page only.
    expect(await saveBlogCategory({ id: added.data.id, name: "Case studies", blurb: "Real results, step by step." })).toEqual({ ok: true, data: null });
    expect(reported()).toEqual(["/blog/category/case-studies"]);

    indexNow.notify.mockClear();
    // A new name also shows on the blog's front page and on each live post.
    expect(await saveBlogCategory({ id: added.data.id, name: "Customer stories", blurb: "Real results, step by step." })).toEqual({ ok: true, data: null });
    expect(reported()).toEqual(["/blog/category/case-studies", "/blog", `/blog/${live.slug}`]);

    indexNow.notify.mockClear();
    // Saved unchanged: nothing.
    expect(await saveBlogCategory({ id: added.data.id, name: "Customer stories", blurb: "Real results, step by step." })).toEqual({ ok: true, data: null });
    expect(reported()).toEqual([]);
  });

  /** Its address stays /blog/category/case-studies after the rename - not one made from the new name. */
  it("IndexNow: a post in a renamed category reports the category's real address", async () => {
    const added = await createBlogCategory({ name: "Case studies", blurb: "" });
    if (!added.ok) throw new Error(added.error);
    const post = await create("published", { category: "Case studies" });
    expect(await saveBlogCategory({ id: added.data.id, name: "Customer stories", blurb: "" })).toEqual({ ok: true, data: null });
    const stored = await row(post.id);
    const same = { slug: post.slug, title: stored.title, description: stored.description, category: "Customer stories" };

    indexNow.notify.mockClear();
    expect(await saveBlogPost({ id: post.id, expectedVersion: 0, status: "published", post: input({ ...same, title: "Retitled" }) })).toMatchObject({ ok: true });
    expect(reported()).toEqual([`/blog/${post.slug}`, "/blog", "/blog/category/case-studies"]);

    indexNow.notify.mockClear();
    expect(await saveBlogPost({ id: post.id, expectedVersion: 1, status: "published", post: input({ ...same, title: "Retitled", category: "Guides" }) })).toMatchObject({ ok: true });
    expect(reported()).toEqual([`/blog/${post.slug}`, "/blog", "/blog/category/guides", "/blog/category/case-studies"]);
  });

  it("IndexNow: deleting a category reports its page, which is gone", async () => {
    const added = await createBlogCategory({ name: "Case studies", blurb: "" });
    if (!added.ok) throw new Error(added.error);
    indexNow.notify.mockClear();
    expect(await deleteBlogCategory({ id: added.data.id })).toEqual({ ok: true, data: null });
    expect(reported()).toEqual(["/blog/category/case-studies"]);
  });

  it("only administrators", async () => {
    state.session = { user: { id: "u1", email: "customer@example.test", emailVerified: true }, session: { id: "s1", activeOrganizationId: "o1" } };
    await expect(listBlogCategoriesAdmin()).rejects.toThrow();
    await expect(createBlogCategory({ name: "Sneaky", blurb: "" })).rejects.toThrow();
    await expect(deleteBlogCategory({ id: "00000000-0000-0000-0000-000000000000" })).rejects.toThrow();
  });
});
