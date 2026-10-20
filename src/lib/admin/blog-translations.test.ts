import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { adminAuditLog, blogPosts } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";

/**
 * The blog in more than one language (client, 2026-10-09): a post's
 * language, translations started from an English post (AI draft or a copy),
 * the "needs review" gate before publishing, the public reads per language,
 * and what is reported to IndexNow. The AI is replaced at its boundary.
 */

const state = vi.hoisted(() => ({ db: null as unknown, session: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
}));
vi.mock("@/lib/auth-guard", () => ({ getSession: async () => state.session }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const indexNow = vi.hoisted(() => ({ notify: vi.fn() }));
vi.mock("@/lib/indexnow", () => ({ notifyIndexNow: indexNow.notify }));
const ai = vi.hoisted(() => ({ translate: vi.fn(), configured: true }));
vi.mock("@/lib/blog/translate", () => ({ translateBlogPost: ai.translate }));
vi.mock("@/lib/ai/client", () => ({ isAiConfigured: () => ai.configured }));

import { createBlogTranslation, getBlogPostAdmin, saveBlogPost, type BlogPostInput } from "@/lib/admin/blog";
import { getPost, listPostPage, listPosts, postVersions, publishedLocales } from "@/lib/blog/posts";
import { readTranslation } from "@/lib/blog/translate-read";

let test: TestDb;
const ADMIN = "admin@repget.test";

beforeAll(async () => {
  vi.stubEnv("ADMIN_EMAILS", ADMIN);
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://repget.test");
  test = await createTestDb();
  state.db = test.db;
});

beforeEach(() => {
  state.session = { user: { id: "admin_user", email: ADMIN, emailVerified: true }, session: { id: "s", activeOrganizationId: null } };
  ai.configured = true;
  ai.translate.mockReset();
  indexNow.notify.mockReset();
});

let n = 0;
function input(overrides: Partial<BlogPostInput> = {}): BlogPostInput {
  n += 1;
  return {
    title: `How to get mentioned in ChatGPT ${n}`,
    slug: "",
    description: "A practical guide.",
    seoTitle: "",
    primaryKeyword: "get mentioned in chatgpt",
    secondaryKeywords: [],
    breadcrumbLabel: "",
    category: "Guides",
    author: "",
    shortAnswer: "Be easy to find and easy to quote.",
    bodyHtml: '<h2>Start here</h2><p>Read <a href="https://repget.test/blog/other">this</a>.</p><img src="https://store.test/a.webp" alt="A diagram">',
    faqs: [{ question: "Does it cost anything?", answer: "<p>No.</p>" }],
    sources: [{ label: "OpenAI", url: "https://openai.com/" }],
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

const ITALIAN = {
  title: "Come farsi citare da ChatGPT",
  slug: "farsi-citare-da-chatgpt",
  seoTitle: "",
  description: "Una guida pratica.",
  shortAnswer: "Fatti trovare e fatti citare.",
  breadcrumbLabel: "",
  primaryKeyword: "farsi citare da chatgpt",
  secondaryKeywords: ["chatgpt per aziende"],
  bodyHtml: '<h2>Da dove iniziare</h2><p>Leggi <a href="https://repget.test/blog/other">questo</a>.</p><script>alert(1)</script>',
  faqs: [{ question: "Costa qualcosa?", answer: "<p>No.</p>" }],
};

describe("a post's language", () => {
  it("is English unless another is chosen when the post is created", async () => {
    const english = await create("draft");
    expect((await row(english.id)).locale).toBe("en");
    const german = await create("draft", { locale: "de" });
    expect((await row(german.id)).locale).toBe("de");
    const unknown = await create("draft", { locale: "xx" });
    expect((await row(unknown.id)).locale).toBe("en");
  });

  it("is published at its own language's address, and reported there", async () => {
    const post = await create("published", { locale: "it", slug: "una-guida-italiana" });
    // Its category page in Italian lists it too (client, 2026-10-15: categories in every language).
    expect(indexNow.notify).toHaveBeenLastCalledWith(["/it/blog/una-guida-italiana", "/it/blog", "/it/blog/category/guides"]);
    expect(await getPost("una-guida-italiana")).toBeNull();
    expect((await getPost("una-guida-italiana", "it"))?.locale).toBe("it");
    expect((await listPosts("it")).map((p) => p.slug)).toContain("una-guida-italiana");
    expect((await listPosts()).map((p) => p.slug)).not.toContain("una-guida-italiana");
    expect((await listPostPage(1, { locale: "it" })).total).toBeGreaterThan(0);
    expect(await publishedLocales()).toContain("it");
    expect((await row(post.id)).translationOf).toBeNull();
  });
});

describe("starting a translation", () => {
  it("copies the English post into a draft that needs review, in that language", async () => {
    const source = await create("published", { slug: "get-mentioned" });
    const result = await createBlogTranslation({ sourceId: source.id, locale: "fr", mode: "copy" });
    expect(result.ok).toBe(true);
    const copy = await row(result.ok ? result.data.id : "");
    expect(copy).toMatchObject({
      locale: "fr",
      translationOf: source.id,
      needsReview: true,
      status: "draft",
      slug: "get-mentioned-fr",
      category: "Guides",
      primaryKeyword: "get mentioned in chatgpt",
    });
    expect(copy.sources).toEqual([{ label: "OpenAI", url: "https://openai.com/" }]);
    const [audit] = await test.db.select().from(adminAuditLog).where(eq(adminAuditLog.targetId, copy.id));
    expect(audit).toMatchObject({ action: "blog.translation_created", actorEmail: ADMIN });

    // Asked again: the same draft, not a second one.
    expect(await createBlogTranslation({ sourceId: source.id, locale: "fr", mode: "ai" })).toEqual({ ok: true, data: { id: copy.id, existed: true } });
    expect(ai.translate).not.toHaveBeenCalled();
  });

  it("drafts it with AI, sanitised like any post, at an address made from the translated title", async () => {
    const source = await create("published");
    ai.translate.mockResolvedValue(ITALIAN);
    const result = await createBlogTranslation({ sourceId: source.id, locale: "it", mode: "ai" });
    expect(ai.translate).toHaveBeenCalledWith(expect.objectContaining({ title: (await row(source.id)).title }), "en", "it");
    const draft = await row(result.ok ? result.data.id : "");
    expect(draft).toMatchObject({ locale: "it", slug: "farsi-citare-da-chatgpt", title: ITALIAN.title, needsReview: true, status: "draft" });
    expect(draft.bodyHtml).not.toContain("<script");
    expect(draft.bodyHtml).toContain('href="https://repget.test/blog/other"');

    // The address is unique across languages: a second article with the same Italian title gets the language code.
    const other = await create("draft");
    ai.translate.mockResolvedValue(ITALIAN);
    const second = await createBlogTranslation({ sourceId: other.id, locale: "it", mode: "ai" });
    expect((await row(second.ok ? second.data.id : "")).slug).toBe("farsi-citare-da-chatgpt-it");
  });

  it("points its links at that language's pages, and drops a link to a post it does not have (client, 2026-10-20)", async () => {
    const local = await create("published", { slug: "local-seo-guide" });
    const spanish = await createBlogTranslation({ sourceId: local.id, locale: "es", mode: "copy" });
    await test.db.update(blogPosts).set({ status: "published", slug: "guia-seo-local", needsReview: false, publishedAt: new Date() }).where(eq(blogPosts.id, spanish.ok ? spanish.data.id : ""));
    await create("published", { slug: "keyword-guide" });
    const source = await create("published", {
      bodyHtml: [
        '<h2>Start here</h2><p>Run the <a href="https://repget.test/audit">free audit</a>,',
        ' try the <a href="https://www.repget.test/tools/keyword-density/">density checker</a>,',
        ' read the <a href="https://repget.test/blog/local-seo-guide#maps">local SEO guide</a>',
        ' and the <a href="https://repget.test/blog/keyword-guide">keyword guide</a>,',
        ' then see <a href="https://developers.google.com/search/docs">Google\'s own docs</a>.</p>',
      ].join(""),
      faqs: [{ question: "What does it cost?", answer: '<p>See <a href="https://repget.test/pricing">pricing</a>.</p>' }],
    });

    const result = await createBlogTranslation({ sourceId: source.id, locale: "es", mode: "copy" });
    const copy = await row(result.ok ? result.data.id : "");
    expect(copy.bodyHtml).toContain('<a href="https://repget.test/es/audit">free audit</a>');
    expect(copy.bodyHtml).toContain('<a href="https://repget.test/es/tools/keyword-density">density checker</a>');
    expect(copy.bodyHtml).toContain('<a href="https://repget.test/es/blog/guia-seo-local#maps">local SEO guide</a>');
    // No Spanish version of the keyword guide: its words stay, the link to the English one goes.
    expect(copy.bodyHtml).toContain(" and the keyword guide,");
    expect(copy.bodyHtml).not.toContain("keyword-guide");
    expect(copy.bodyHtml).toContain('href="https://developers.google.com/search/docs"');
    expect(copy.faqs[0].answer).toContain('<a href="https://repget.test/es/pricing">pricing</a>');
  });

  it("explains a failed AI draft and saves nothing", async () => {
    const source = await create("draft");
    ai.translate.mockRejectedValue(new Error("The post is too long to translate in one go"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await createBlogTranslation({ sourceId: source.id, locale: "de", mode: "ai" });
    log.mockRestore();
    expect(result).toEqual({ ok: false, error: expect.stringMatching(/German draft could not be written: The post is too long/) });
    expect((await getBlogPostAdmin(source.id))?.translations).toEqual([]);

    ai.configured = false;
    expect(await createBlogTranslation({ sourceId: source.id, locale: "de", mode: "ai" })).toEqual({ ok: false, error: expect.stringMatching(/AI is not set up/) });
  });

  it("starts only from an English original, into another language", async () => {
    const source = await create("draft");
    const italian = await create("draft", { locale: "it" });
    expect((await createBlogTranslation({ sourceId: source.id, locale: "en", mode: "copy" })).ok).toBe(false);
    expect((await createBlogTranslation({ sourceId: italian.id, locale: "fr", mode: "copy" })).ok).toBe(false);
    const copy = await createBlogTranslation({ sourceId: source.id, locale: "es", mode: "copy" });
    expect((await createBlogTranslation({ sourceId: copy.ok ? copy.data.id : "", locale: "fr", mode: "copy" })).ok).toBe(false);
  });

  it("is for administrators only", async () => {
    const source = await create("draft");
    state.session = { user: { id: "u1", email: "customer@example.test", emailVerified: true }, session: { id: "s1", activeOrganizationId: "o1" } };
    await expect(createBlogTranslation({ sourceId: source.id, locale: "it", mode: "copy" })).rejects.toThrow();
  });
});

describe("reviewing and publishing a translation", () => {
  async function translation() {
    const source = await create("published", { slug: `original-${n}` });
    const result = await createBlogTranslation({ sourceId: source.id, locale: "it", mode: "copy" });
    if (!result.ok) throw new Error(result.error);
    const post = (await getBlogPostAdmin(result.data.id))!;
    return { source, post };
  }

  it("cannot be published until someone confirms a native speaker reviewed it", async () => {
    const { post } = await translation();
    const fields: BlogPostInput = { ...input(), title: "Una traduzione", slug: post.slug, locale: "it" };
    const refused = await saveBlogPost({ id: post.id, expectedVersion: post.version, status: "published", post: fields });
    expect(refused).toEqual({ ok: false, error: expect.stringMatching(/not been reviewed/) });
    expect((await row(post.id)).status).toBe("draft");

    // Saving the draft keeps the mark.
    const draft = await saveBlogPost({ id: post.id, expectedVersion: post.version, status: "draft", post: fields });
    expect(draft.ok && draft.data.needsReview).toBe(true);

    const published = await saveBlogPost({ id: post.id, expectedVersion: post.version + 1, status: "published", post: fields, reviewed: true });
    expect(published.ok && published.data).toMatchObject({ status: "published", needsReview: false });
    expect(indexNow.notify).toHaveBeenLastCalledWith([`/it/blog/${post.slug}`, "/it/blog", "/it/blog/category/guides"]);
  });

  it("links the languages of one article to each other, published ones only", async () => {
    const { source, post } = await translation();
    const sourceRow = await row(source.id);
    expect(await postVersions(sourceRow.slug, "en")).toEqual([{ locale: "en", path: `/blog/${sourceRow.slug}` }]);
    await saveBlogPost({ id: post.id, expectedVersion: post.version, status: "published", post: { ...input(), slug: post.slug }, reviewed: true });
    const both = [
      { locale: "en", path: `/blog/${sourceRow.slug}` },
      { locale: "it", path: `/it/blog/${post.slug}` },
    ];
    expect(await postVersions(sourceRow.slug, "en")).toEqual(both);
    expect(await postVersions(post.slug, "it")).toEqual(both);
    const admin = await getBlogPostAdmin(source.id);
    expect(admin?.translations.map((t) => [t.locale, t.status, t.needsReview])).toEqual([["it", "published", false]]);
    expect((await getBlogPostAdmin(post.id))?.original?.id).toBe(source.id);
  });
});

describe("reading the AI's answer", () => {
  const original = { ...ITALIAN, seoTitle: "", shortAnswer: "" };

  it("keeps empty fields empty and refuses an answer without a title or text", () => {
    const read = readTranslation({ ...ITALIAN, seoTitle: "Invented", shortAnswer: "Invented", faqs: [{ question: "Q", answer: "" }] }, original);
    expect(read.seoTitle).toBe("");
    expect(read.shortAnswer).toBe("");
    expect(read.faqs).toEqual([]);
    expect(() => readTranslation({ ...ITALIAN, title: "" }, original)).toThrow();
    expect(() => readTranslation({ ...ITALIAN, bodyHtml: " " }, original)).toThrow();
    expect(() => readTranslation(null, original)).toThrow();
  });
});
