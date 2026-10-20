import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { adminAuditLog, blogPosts } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";

/**
 * The blog's picture library (client, 2026-10-09): every uploaded picture,
 * where it is used, reuse in the editor, and deleting only what no post uses.
 * And each language's own pictures (client, 2026-10-15). Storage is replaced
 * at its boundary; posts are real rows.
 */

const state = vi.hoisted(() => ({ db: null as unknown, session: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
}));
vi.mock("@/lib/auth-guard", () => ({ getSession: async () => state.session }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const storage = vi.hoisted(() => ({ list: vi.fn(), remove: vi.fn(), store: vi.fn(), configured: true }));
vi.mock("@/lib/images/storage", async (original) => ({
  ...(await original<typeof import("@/lib/images/storage")>()),
  isImageStorageConfigured: () => storage.configured,
  listStoredImages: storage.list,
  deleteStoredImage: storage.remove,
  storeArticleImage: storage.store,
}));

import { uploadBlogImage } from "@/lib/admin/blog";
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
  // The blog folder holds the pictures from before languages; the language folders are empty here.
  storage.list.mockImplementation(async (folder: string) => (folder === "blog/posts" ? [ORPHAN, USED] : []));
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

describe("each language's pictures (client, 2026-10-15)", () => {
  // The Italian translation below is made at 09:15 from the English post, which has USED.
  const TRANSLATED_AT = "2026-10-15T09:15:00Z";
  // From before languages, in an Italian post (not a translation).
  const IT_OLD = { ...file("1792067019505-y56yzp.webp"), createdAt: "2026-10-15T09:00:00Z" };
  // From before languages, put in the translation after it was made: its own picture.
  const IT_OWN = { ...file("1792067072537-jxr2ef.webp"), createdAt: "2026-10-15T09:30:00Z" };
  // Uploaded in an Italian post and not saved into it yet.
  const IT_NEW = { ...file("1792070000000-itnew1.webp", "blog/posts/it"), createdAt: "2026-10-15T12:00:00Z" };
  // Uploaded for German, in no post yet.
  const DE_NEW = { ...file("1792069500000-denew1.webp", "blog/posts/de"), createdAt: "2026-10-15T11:30:00Z" };
  // Uploaded while a new post was still English; the post was then switched to Italian.
  const EN_TO_IT = { ...file("1792069000000-entoit.webp", "blog/posts/en"), createdAt: "2026-10-15T11:00:00Z" };
  // Filed as English by mistake after the translation was made, and put in the translation only.
  const EN_AFTER = { ...file("1792068000000-enaftr.webp", "blog/posts/en"), createdAt: "2026-10-15T10:00:00Z" };
  // The English post's picture when the translation was made; the English post has replaced it since.
  const EN_LEFT = { ...file("1792060000000-enleft.webp", "blog/posts/en"), createdAt: "2026-10-15T08:00:00Z" };
  // The same, from before languages.
  const OLD_LEFT = { ...file("1791490000000-oldlft.webp"), createdAt: "2026-10-08T10:00:00Z" };
  const FOLDERS: Record<string, ReturnType<typeof file>[]> = {
    "blog/posts": [IT_OWN, IT_OLD, ORPHAN, USED, OLD_LEFT],
    "blog/posts/it": [IT_NEW],
    "blog/posts/de": [DE_NEW],
    "blog/posts/en": [EN_TO_IT, EN_AFTER, EN_LEFT],
  };
  const EVERY = [IT_NEW, DE_NEW, EN_TO_IT, EN_AFTER, IT_OWN, IT_OLD, EN_LEFT, ORPHAN, USED, OLD_LEFT].map((image) => image.url);

  beforeAll(async () => {
    const [english] = await test.db.select({ id: blogPosts.id }).from(blogPosts).where(eq(blogPosts.slug, "get-mentioned-in-chatgpt"));
    await test.db.insert(blogPosts).values([
      {
        slug: "sito-non-compare-su-google",
        title: "Il tuo sito non compare su Google?",
        category: "Guides",
        author: "RepGet team",
        status: "published",
        locale: "it",
        bodyHtml: `<p>Testo</p><img src="${IT_OLD.url}" alt="Schema: perché un sito non compare"><img src="${EN_TO_IT.url}" alt="Lista di controllo">`,
      },
      {
        // Made from the English post: it started with that post's pictures (USED, EN_LEFT, OLD_LEFT); IT_OWN and EN_AFTER were added since.
        slug: "come-farsi-citare-da-chatgpt",
        title: "Come farsi citare da ChatGPT",
        category: "Guides",
        author: "RepGet team",
        status: "draft",
        locale: "it",
        translationOf: english.id,
        needsReview: true,
        createdAt: new Date(TRANSLATED_AT),
        bodyHtml: [USED, EN_LEFT, OLD_LEFT, EN_AFTER].map((image) => `<img src="${image.url}" alt="">`).join("<p>Testo</p>") + `<img src="${IT_OWN.url}" alt="Le citazioni">`,
      },
    ]);
  });

  beforeEach(() => {
    storage.list.mockImplementation(async (folder: string) => FOLDERS[folder] ?? []);
  });

  it("lists the blog folder and every language's folder, newest first", async () => {
    const { images } = await listBlogImages();
    expect(storage.list.mock.calls.map(([folder]) => folder).sort()).toEqual([
      "blog/posts",
      "blog/posts/de",
      "blog/posts/en",
      "blog/posts/es",
      "blog/posts/fr",
      "blog/posts/it",
    ]);
    expect(images.map((image) => image.url)).toEqual(EVERY);
  });

  it("puts a picture in the languages of the posts that use it or, while none does, the one it was uploaded for", async () => {
    const { images } = await listBlogImages();
    expect(Object.fromEntries(images.map((image) => [image.name, image.languages]))).toEqual({
      [IT_NEW.name]: ["it"], // uploaded for Italian, in no post yet
      [DE_NEW.name]: ["de"], // uploaded for German, in no post yet
      [EN_TO_IT.name]: ["it"], // uploaded as English, used in an Italian post: the post decides
      [EN_AFTER.name]: ["it"], // filed as English, but added to the Italian translation after it was made
      [IT_OWN.name]: ["it"], // from before languages, added to the translation after it was made
      [IT_OLD.name]: ["it"], // from before languages, in an Italian post
      [EN_LEFT.name]: ["en"], // only the translation still has it, but it came with the copy
      [ORPHAN.name]: [], // from before languages, in no post
      [USED.name]: ["en"], // the English posts' picture, kept by the Italian translation made from one
      [OLD_LEFT.name]: [], // came with the copy, from before languages: no language, not Italian
    });
  });

  it("suggests a post the pictures in its language, or every picture", async () => {
    const urls = async (language?: string, term = "") => (await listBlogImagesForPicker(term, language)).map((image) => image.url);
    expect(await urls("it")).toEqual([IT_NEW.url, EN_TO_IT.url, EN_AFTER.url, IT_OWN.url, IT_OLD.url]);
    expect(await urls("en")).toEqual([EN_LEFT.url, USED.url]);
    expect(await urls("de")).toEqual([DE_NEW.url]);
    expect(await urls("es")).toEqual([]);
    expect(await urls("all")).toEqual(EVERY);
    // As before languages, and for a language the blog does not have.
    expect(await urls()).toEqual(EVERY);
    expect(await urls("xx")).toEqual(EVERY);
    // A search stays in the language.
    expect(await urls("it", "citazioni")).toEqual([IT_OWN.url]);
    expect(await urls("en", "citazioni")).toEqual([]);
  });

  it("deletes an unused picture from a language's folder, and nothing deeper or unknown", async () => {
    expect(await deleteBlogImage(IT_NEW.url)).toEqual({ ok: true, data: null });
    expect(storage.remove).toHaveBeenCalledWith(IT_NEW.path);
    const [entry] = await test.db.select().from(adminAuditLog).where(eq(adminAuditLog.targetId, IT_NEW.path));
    expect(entry.summary).toBe(`Deleted the blog picture it/${IT_NEW.name}`);

    // One a post uses is refused, naming the post, whatever folder it is in.
    const inUse = await deleteBlogImage(EN_TO_IT.url);
    expect(!inUse.ok && inUse.error).toMatch(/"Il tuo sito non compare su Google\?"/);

    for (const url of [
      `${BASE}blog/posts/it`, // a language's folder, not a picture
      `${BASE}blog/posts/it/nested/x.webp`,
      `${BASE}blog/posts/xx/x.webp`,
      `${BASE}blog/posts/it/`,
      `${BASE}blog/posts/..`,
      `${BASE}blog/posts/..%2Fx.webp`,
      `${BASE}blog/posts/it/..%2F..%2Fx.webp`,
    ]) {
      expect(await deleteBlogImage(url), url).toEqual({ ok: false, error: "That is not a blog picture." });
    }
    expect(storage.remove).toHaveBeenCalledTimes(1);
  });

  it("stores an upload in its language's folder", async () => {
    storage.store.mockReset();
    storage.store.mockImplementation(async (top: string, sub: string) => `${BASE}${top}/${sub}/new.webp`);
    const form = (locale?: string) => {
      const data = new FormData();
      data.set("file", new File([new Uint8Array([1, 2, 3])], "photo.webp", { type: "image/webp" }));
      if (locale !== undefined) data.set("locale", locale);
      return data;
    };
    expect(await uploadBlogImage(form("it"))).toEqual({ ok: true, data: { url: `${BASE}blog/posts/it/new.webp` } });
    // Named after the file it came from (client, 2026-10-20).
    expect(storage.store).toHaveBeenLastCalledWith("blog", "posts/it", expect.any(Buffer), "image/webp", "photo");
    await uploadBlogImage(form("en"));
    expect(storage.store).toHaveBeenLastCalledWith("blog", "posts/en", expect.any(Buffer), "image/webp", "photo");
    // No language, or one the blog does not have: the blog folder, as before languages.
    for (const locale of [undefined, "xx", "../de"]) {
      await uploadBlogImage(form(locale));
      expect(storage.store).toHaveBeenLastCalledWith("blog", "posts", expect.any(Buffer), "image/webp", "photo");
    }
  });
});
