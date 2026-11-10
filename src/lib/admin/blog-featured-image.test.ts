import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { blogPosts } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";

/**
 * A blog post's featured image (client, 2026-11-07): uploaded straight to
 * storage on a signed address and checked by the server, saved with the
 * post, shown on its public page and in shared links, copied to a new
 * translation, and protected in the picture library while any post - a
 * draft included - has it as its cover. Storage is replaced at its boundary;
 * posts are real rows.
 */

const state = vi.hoisted(() => ({ db: null as unknown, session: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
}));
vi.mock("@/lib/auth-guard", () => ({ getSession: async () => state.session }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const indexNow = vi.hoisted(() => ({ notify: vi.fn() }));
vi.mock("@/lib/indexnow", () => ({ notifyIndexNow: indexNow.notify }));
const storage = vi.hoisted(() => ({ list: vi.fn(), remove: vi.fn(), store: vi.fn(), sign: vi.fn(), read: vi.fn() }));
vi.mock("@/lib/images/storage", async (original) => ({
  ...(await original<typeof import("@/lib/images/storage")>()),
  isImageStorageConfigured: () => true,
  listStoredImages: storage.list,
  deleteStoredImage: storage.remove,
  storeArticleImage: storage.store,
  signedImageUpload: storage.sign,
  readStoredFile: storage.read,
}));

import {
  createBlogTranslation,
  finishBlogImageUpload,
  getBlogPostAdmin,
  saveBlogPost,
  startBlogImageUpload,
  type BlogPostInput,
} from "@/lib/admin/blog";
import { deleteBlogImage, listBlogImages } from "@/lib/admin/blog-images";
import { getPost } from "@/lib/blog/posts";
import { postMetadata } from "@/app/(marketing)/blog/post-view";

let test: TestDb;
const ADMIN = "admin@repget.test";
const BASE = "https://store.example.test/storage/v1/object/public/article-images/";
const COVER = `${BASE}blog/posts/en/wedding-cover.webp`;
const OTHER = `${BASE}blog/posts/en/second-cover.webp`;
const MB = 1024 * 1024;

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);

beforeAll(async () => {
  vi.stubEnv("ADMIN_EMAILS", ADMIN);
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://repget.test");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://store.example.test");
  test = await createTestDb();
  state.db = test.db;
});

beforeEach(() => {
  asAdmin();
  for (const mock of Object.values(storage)) mock.mockReset();
  storage.list.mockResolvedValue([]);
  storage.remove.mockResolvedValue(undefined);
  storage.sign.mockImplementation(async (path: string) => `https://store.example.test/storage/v1/object/upload/sign/article-images/${path}?token=t`);
});

function asAdmin(email = ADMIN) {
  state.session = { user: { id: "admin_user", email, emailVerified: true }, session: { id: "s_admin", activeOrganizationId: null } };
}
function asCustomer() {
  state.session = { user: { id: "u1", email: "customer@example.test", emailVerified: true }, session: { id: "s1", activeOrganizationId: "o1" } };
}

let n = 0;
function input(overrides: Partial<BlogPostInput> = {}): BlogPostInput {
  n += 1;
  return {
    title: `Featured image post ${n}`,
    slug: "",
    description: "What to ask before you book.",
    seoTitle: "",
    primaryKeyword: "",
    secondaryKeywords: [],
    breadcrumbLabel: "",
    category: "Guides",
    author: "",
    shortAnswer: "",
    bodyHtml: "<p>Ask to see a full film, not a trailer.</p>",
    faqs: [],
    sources: [],
    ...overrides,
  };
}

async function save(id: string | null, version: number, status: "draft" | "published", post: BlogPostInput) {
  const result = await saveBlogPost({ id, expectedVersion: version, status, post });
  if (!result.ok) throw new Error(result.error);
  return result.data;
}

describe("uploading a picture straight to storage", () => {
  it("hands an administrator a signed address for one new file in the pending folder", async () => {
    const result = await startBlogImageUpload({ type: "image/png", size: 6 * MB });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.upload).toMatch(/^[0-9a-f-]{36}\.png$/);
    expect(storage.sign).toHaveBeenCalledWith(`blog/pending/${result.data.upload}`);
    // Never in the library's folder: an unchecked file is not offered to anyone.
    expect(result.data.signedUrl).toContain("blog/pending/");
  });

  it("refuses other types, empty and oversize files before anything is signed", async () => {
    expect(await startBlogImageUpload({ type: "image/gif", size: 1000 })).toEqual({ ok: false, error: "Use a PNG, JPEG or WebP image" });
    expect(await startBlogImageUpload({ type: "image/png", size: 0 })).toEqual({ ok: false, error: "Choose an image to upload" });
    expect(await startBlogImageUpload({ type: "image/png", size: 9 * MB })).toEqual({ ok: false, error: "That image is 9MB. The limit is 8MB." });
    expect(storage.sign).not.toHaveBeenCalled();
  });

  it("is for administrators only", async () => {
    asCustomer();
    await expect(startBlogImageUpload({ type: "image/png", size: 1000 })).rejects.toThrow();
    await expect(finishBlogImageUpload({ upload: "00000000-0000-4000-8000-000000000000.png", name: "x" })).rejects.toThrow();
    expect(storage.sign).not.toHaveBeenCalled();
    expect(storage.read).not.toHaveBeenCalled();
  });

  it("files a checked picture in its language's folder, named after the file, and removes the pending copy", async () => {
    storage.read.mockResolvedValue({ data: PNG, size: PNG.length });
    storage.store.mockResolvedValue(`${BASE}blog/posts/it/photo.png`);
    const upload = "00000000-0000-4000-8000-000000000001.png";
    expect(await finishBlogImageUpload({ upload, name: "photo.png", locale: "it" })).toEqual({ ok: true, data: { url: `${BASE}blog/posts/it/photo.png` } });
    expect(storage.read).toHaveBeenCalledWith(`blog/pending/${upload}`, 8 * MB);
    expect(storage.store).toHaveBeenCalledWith("blog", "posts/it", PNG, "image/png", "photo");
    expect(storage.remove).toHaveBeenCalledWith(`blog/pending/${upload}`);
  });

  it("refuses and removes a file that is too big or is not the picture it was sent as", async () => {
    const upload = "00000000-0000-4000-8000-000000000002.png";
    storage.read.mockResolvedValueOnce({ data: null, size: 12 * MB });
    expect(await finishBlogImageUpload({ upload, name: "big.png" })).toEqual({ ok: false, error: "That image is 12MB. The limit is 8MB." });
    storage.read.mockResolvedValueOnce({ data: Buffer.from("<script>alert(1)</script>"), size: 25 });
    expect(await finishBlogImageUpload({ upload, name: "fake.png" })).toEqual({ ok: false, error: "That file is not a PNG, JPEG or WebP image" });
    expect(storage.remove).toHaveBeenCalledTimes(2);
    expect(storage.store).not.toHaveBeenCalled();
  });

  it("refuses an upload id that is not one it handed out, and says when nothing arrived", async () => {
    for (const upload of ["../posts/x.png", "blog/posts/x.png", "00000000-0000-4000-8000-000000000003.gif", ""]) {
      expect(await finishBlogImageUpload({ upload, name: "x" }), upload).toEqual({ ok: false, error: "That upload does not exist. Upload the picture again." });
    }
    storage.read.mockResolvedValueOnce(null);
    expect(await finishBlogImageUpload({ upload: "00000000-0000-4000-8000-000000000004.webp", name: "x" })).toEqual({
      ok: false,
      error: "The picture did not arrive. Upload it again.",
    });
    expect(storage.store).not.toHaveBeenCalled();
  });
});

describe("a post's featured image", () => {
  it("is saved, reopened, replaced and removed, with its description", async () => {
    const created = await save(null, 0, "draft", input({ featuredImage: { url: COVER, alt: "  A couple   at sunset " } }));
    expect((await getBlogPostAdmin(created.id))?.featuredImage).toEqual({ url: COVER, alt: "A couple at sunset" });

    const replaced = await save(created.id, created.version, "draft", input({ title: "Same post", featuredImage: { url: OTHER, alt: "" } }));
    expect((await getBlogPostAdmin(created.id))?.featuredImage).toEqual({ url: OTHER, alt: "" });

    // Saved without the field (the autopilot's shape): the stored cover stays.
    const kept = await save(created.id, replaced.version, "draft", input({ title: "Same post" }));
    expect((await getBlogPostAdmin(created.id))?.featuredImage).toEqual({ url: OTHER, alt: "" });

    await save(created.id, kept.version, "draft", input({ title: "Same post", featuredImage: null }));
    const [stored] = await test.db.select().from(blogPosts).where(eq(blogPosts.id, created.id));
    expect([stored.featuredImageUrl, stored.featuredImageAlt]).toEqual([null, null]);
  });

  it("must be one of the blog's own pictures", async () => {
    for (const url of [
      "https://elsewhere.example/picture.webp",
      `${BASE}website-1/article-2/x.webp`, // a customer's picture
      `${BASE}blog/pending/00000000-0000-4000-8000-000000000001.png`, // not checked yet
      `${COVER}?v=2`,
      "javascript:alert(1)",
    ]) {
      const result = await saveBlogPost({ id: null, expectedVersion: 0, status: "draft", post: input({ featuredImage: { url, alt: "" } }) });
      expect(result.ok, url).toBe(false);
    }
    const long = await saveBlogPost({ id: null, expectedVersion: 0, status: "draft", post: input({ featuredImage: { url: COVER, alt: "x".repeat(301) } }) });
    expect(long).toEqual({ ok: false, error: "Keep the featured image's description under 300 characters" });
  });

  it("is on the public page, its shared links and its structured data, and an image-only change is reported", async () => {
    const live = await save(null, 0, "published", input({ title: "A live post with a cover", featuredImage: { url: COVER, alt: "The venue" } }));
    const post = await getPost(live.slug);
    expect(post?.featuredImage).toEqual({ url: COVER, alt: "The venue" });
    const metadata = postMetadata(post!, []);
    expect(metadata.openGraph?.images).toEqual([{ url: COVER, alt: "The venue" }]);
    expect(metadata.twitter?.images).toEqual([{ url: COVER, alt: "The venue" }]);

    indexNow.notify.mockClear();
    await save(live.id, live.version, "published", input({ title: "A live post with a cover", featuredImage: { url: OTHER, alt: "The venue" } }));
    const pages = indexNow.notify.mock.calls.flatMap(([paths]) => paths as string[]);
    // Its page and the listings that show its card; not marked "Updated" - the text is the same.
    expect(pages).toEqual(expect.arrayContaining([`/blog/${live.slug}`, "/blog", "/blog/category/guides"]));
    const [stored] = await test.db.select().from(blogPosts).where(eq(blogPosts.id, live.id));
    expect(stored.revisedAt).toBeNull();
  });

  it("without one, keeps the site's picture in shared links", async () => {
    const live = await save(null, 0, "published", input({ title: "A live post without a cover" }));
    const post = await getPost(live.slug);
    expect(post?.featuredImage).toBeUndefined();
    expect(postMetadata(post!, []).twitter?.images).toEqual([expect.objectContaining({ url: "/opengraph-image" })]);
  });

  it("is copied to a new translation, which can then change its own", async () => {
    const english = await save(null, 0, "draft", input({ title: "A post to translate", featuredImage: { url: COVER, alt: "The venue" } }));
    const made = await createBlogTranslation({ sourceId: english.id, locale: "it", mode: "copy" });
    expect(made.ok).toBe(true);
    if (!made.ok) return;
    const italian = await getBlogPostAdmin(made.data.id);
    expect(italian?.featuredImage).toEqual({ url: COVER, alt: "The venue" });

    await save(made.data.id, italian!.version, "draft", {
      ...input({ title: "Un post da tradurre", slug: italian!.slug }),
      featuredImage: { url: OTHER, alt: "La sala" },
    });
    expect((await getBlogPostAdmin(made.data.id))?.featuredImage).toEqual({ url: OTHER, alt: "La sala" });
    expect((await getBlogPostAdmin(english.id))?.featuredImage).toEqual({ url: COVER, alt: "The venue" });
  });
});

describe("the library and featured images", () => {
  it("counts a draft's featured image as a use: listed with its description, and not deletable", async () => {
    const only = `${BASE}blog/posts/en/only-a-cover.webp`;
    const draft = await save(null, 0, "draft", input({ title: "A draft whose only picture is its cover", featuredImage: { url: only, alt: "Only a cover" } }));
    storage.list.mockImplementation(async (folder: string) =>
      folder === "blog/posts/en" ? [{ url: only, name: "only-a-cover.webp", path: "blog/posts/en/only-a-cover.webp", size: 1, createdAt: null }] : [],
    );
    const [image] = (await listBlogImages()).images;
    expect(image).toMatchObject({ alt: "Only a cover", usedIn: [{ id: draft.id, status: "draft" }], languages: ["en"] });

    const refused = await deleteBlogImage(only);
    expect(refused.ok).toBe(false);
    expect(!refused.ok && refused.error).toMatch(/A draft whose only picture is its cover/);
    expect(storage.remove).not.toHaveBeenCalled();
  });
});
