import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Stored pictures are named after what they show (client, 2026-10-20: the
 * blog's pictures were "just numbers"), numbered when the name is taken,
 * and never stored over an existing file. Supabase Storage is replaced by an
 * in-memory bucket.
 */

const bucket = vi.hoisted(() => ({
  files: new Map<string, Buffer>(),
  failNext: null as string | null,
  uploads: [] as string[],
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    storage: {
      from: () => ({
        list: async (folder: string, options: { search?: string }) => ({
          data: [...bucket.files.keys()]
            .filter((path) => path.startsWith(`${folder}/`) && path.slice(folder.length + 1).startsWith(options.search ?? ""))
            .map((path) => ({ name: path.slice(folder.length + 1) })),
          error: null,
        }),
        upload: async (path: string, data: Buffer, options: { upsert: boolean }) => {
          bucket.uploads.push(path);
          if (bucket.failNext) {
            const message = bucket.failNext;
            bucket.failNext = null;
            return { data: null, error: { message } };
          }
          if (bucket.files.has(path) && !options.upsert) return { data: null, error: { message: "The resource already exists" } };
          bucket.files.set(path, data);
          return { data: { path }, error: null };
        },
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://store.test/article-images/${path}` } }),
      }),
    },
  }),
}));

import { storeArticleImage } from "./storage";

const PNG = Buffer.from("png");

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://store.test");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-placeholder");
  bucket.files.clear();
  bucket.uploads.length = 0;
  bucket.failNext = null;
});

describe("a stored picture's name", () => {
  it("says what it shows, in the folder's language", async () => {
    expect(await storeArticleImage("blog", "posts/en", PNG, "image/webp", "Reach Keyword Planner Without Running Ads")).toBe(
      "https://store.test/article-images/blog/posts/en/reach-keyword-planner-without-running-ads.webp",
    );
    expect(await storeArticleImage("blog", "posts/es", PNG, "image/webp", "Accede a Keyword Planner sin anuncios: guía rápida")).toBe(
      "https://store.test/article-images/blog/posts/es/accede-a-keyword-planner-sin-anuncios-guia-rapida.webp",
    );
  });

  it("is numbered when the name is taken, never stored over the other picture", async () => {
    const first = await storeArticleImage("blog", "posts/en", PNG, "image/png", "Keyword planner steps");
    const second = await storeArticleImage("blog", "posts/en", Buffer.from("other"), "image/png", "Keyword planner steps");
    const third = await storeArticleImage("blog", "posts/en", Buffer.from("third"), "image/png", "keyword-planner-steps");
    expect([first, second, third].map((url) => url.split("/").pop())).toEqual(["keyword-planner-steps.png", "keyword-planner-steps-2.png", "keyword-planner-steps-3.png"]);
    expect(bucket.files.get("blog/posts/en/keyword-planner-steps.png")?.toString()).toBe("png");
  });

  it("is a time-and-random one without a name, or with one that says nothing", async () => {
    for (const name of [undefined, null, "  ", "image", "2026-10-20"]) {
      const url = await storeArticleImage("blog", "posts", PNG, "image/jpeg", name);
      expect(url).toMatch(/\/blog\/posts\/\d{13}-[a-z0-9]{1,6}\.jpg$/);
    }
  });

  it("falls back to a time-and-random one when its name is taken a moment before", async () => {
    bucket.failNext = "The resource already exists";
    const url = await storeArticleImage("site-1", "article-1", PNG, "image/png", "A plumber at work");
    expect(url).toMatch(/\/site-1\/article-1\/\d{13}-[a-z0-9]{1,6}\.png$/);
    expect(bucket.uploads[0]).toBe("site-1/article-1/a-plumber-at-work.png");
  });

  it("says why when storage refuses it", async () => {
    bucket.failNext = "Payload too large";
    await expect(storeArticleImage("blog", "posts", PNG, "image/png", "A diagram")).rejects.toThrow("Could not store the image: Payload too large");
  });
});
