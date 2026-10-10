import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { adminAuditLog, blogPosts } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";

/**
 * The blog's picture library (client, 2026-10-09): every uploaded picture,
 * where it is used, reuse in the editor, and deleting only what no post uses.
 * Storage is replaced at its boundary; posts are real rows.
 */

const state = vi.hoisted(() => ({ db: null as unknown, session: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
}));
vi.mock("@/lib/auth-guard", () => ({ getSession: async () => state.session }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const storage = vi.hoisted(() => ({ list: vi.fn(), remove: vi.fn(), configured: true }));
vi.mock("@/lib/images/storage", async (original) => ({
  ...(await original<typeof import("@/lib/images/storage")>()),
  isImageStorageConfigured: () => storage.configured,
  listStoredImages: storage.list,
  deleteStoredImage: storage.remove,
}));

import { deleteBlogImage, listBlogImages, listBlogImagesForPicker } from "@/lib/admin/blog-images";

let test: TestDb;
const ADMIN = "admin@repget.test";
const BASE = "https://store.example.test/storage/v1/object/public/article-images/";
const file = (name: string, folder = "blog/posts") => ({
  url: `${BASE}${folder}/${name}`,
  name,
  path: `${folder}/${name}`,
  size: 41_000,
  createdAt: "2026-10-09T10:00:00Z",
});
const USED = file("1791570126595-3dob8p.webp");
const ORPHAN = file("1791572999999-zzzzzz.webp");

beforeAll(async () => {
  vi.stubEnv("ADMIN_EMAILS", ADMIN);
  test = await createTestDb();
  state.db = test.db;
  await test.db.insert(blogPosts).values([
    {
      slug: "get-mentioned-in-chatgpt",
      title: "How to Get Mentioned in ChatGPT",
      category: "Guides",
      author: "RepGet team",
      status: "published",
      bodyHtml: `<p>Intro</p><img src="${USED.url}" alt="Diagram showing how websites &amp; mentions lead to citations"><p>More</p>`,
    },
    {
      slug: "draft-post",
      title: "A draft about backlinks",
      category: "Guides",
      author: "RepGet team",
      status: "draft",
      bodyHtml: `<figure><img alt="" src="${USED.url}"></figure>`,
    },
  ]);
});

beforeEach(() => {
  state.session = { user: { id: "admin_user", email: ADMIN, emailVerified: true }, session: { id: "s", activeOrganizationId: null } };
  storage.configured = true;
  storage.list.mockReset();
  storage.list.mockResolvedValue([ORPHAN, USED]);
  storage.remove.mockReset();
  storage.remove.mockResolvedValue(undefined);
});

describe("the picture library", () => {
  it("lists every picture with its description and the posts that use it", async () => {
    const { configured, images } = await listBlogImages();
    expect(configured).toBe(true);
    expect(images.map((image) => image.name)).toEqual([ORPHAN.name, USED.name]);
    const used = images[1];
    expect(used.alt).toBe("Diagram showing how websites & mentions lead to citations");
    expect(used.usedIn.map((post) => [post.title, post.status])).toEqual([
      ["How to Get Mentioned in ChatGPT", "published"],
      ["A draft about backlinks", "draft"],
    ]);
    expect(images[0]).toMatchObject({ alt: null, usedIn: [] });
  });

  it("searches descriptions, file names and post titles", async () => {
    expect((await listBlogImages("citations")).images.map((i) => i.name)).toEqual([USED.name]);
    expect((await listBlogImages("BACKLINKS")).images.map((i) => i.name)).toEqual([USED.name]);
    expect((await listBlogImages("zzzzzz")).images.map((i) => i.name)).toEqual([ORPHAN.name]);
    expect((await listBlogImages("nothing like this")).images).toEqual([]);
  });

  it("feeds the post editor's picker, named by description when there is one", async () => {
    expect(await listBlogImagesForPicker("")).toEqual([
      { url: ORPHAN.url, name: ORPHAN.name },
      { url: USED.url, name: "Diagram showing how websites & mentions lead to citations" },
    ]);
  });

  it("says when storage is not set up instead of failing", async () => {
    storage.configured = false;
    expect(await listBlogImages()).toEqual({ configured: false, images: [] });
    expect(storage.list).not.toHaveBeenCalled();
  });

  it("is for administrators only", async () => {
    state.session = { user: { id: "u1", email: "customer@example.test", emailVerified: true }, session: { id: "s1", activeOrganizationId: "o1" } };
    await expect(listBlogImages()).rejects.toThrow();
    await expect(deleteBlogImage(ORPHAN.url)).rejects.toThrow();
    expect(storage.remove).not.toHaveBeenCalled();
  });
});

describe("deleting a picture", () => {
  it("deletes one no post uses, and records who did it", async () => {
    expect(await deleteBlogImage(ORPHAN.url)).toEqual({ ok: true, data: null });
    expect(storage.remove).toHaveBeenCalledWith(ORPHAN.path);
    const [entry] = await test.db.select().from(adminAuditLog).where(eq(adminAuditLog.targetId, ORPHAN.path));
    expect(entry).toMatchObject({ action: "blog.image_deleted", actorEmail: ADMIN, targetType: "blog_image" });
  });

  it("refuses one a post uses, naming the posts", async () => {
    const result = await deleteBlogImage(USED.url);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(/How to Get Mentioned in ChatGPT.*A draft about backlinks/);
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it("refuses anything outside the blog folder", async () => {
    for (const url of [
      file("x.webp", "website-1/article-2").url, // a customer's picture
      `${BASE}blog/posts/nested/x.webp`,
      `${BASE}blog/other.webp`,
      "https://elsewhere.example/blog/posts/x.webp",
      "",
    ]) {
      expect(await deleteBlogImage(url)).toEqual({ ok: false, error: "That is not a blog picture." });
    }
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it("reports a storage failure instead of claiming success", async () => {
    storage.remove.mockRejectedValue(new Error("network"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await deleteBlogImage(ORPHAN.url)).toEqual({ ok: false, error: "The picture could not be deleted. Try again." });
    log.mockRestore();
  });
});
