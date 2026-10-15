import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/** Admin -> Blog -> Images, rendered with a filled library (lib/admin/blog-images.ts is replaced). */

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock("@/lib/admin/blog", () => ({ uploadBlogImage: vi.fn() }));
const library = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("@/lib/admin/blog-images", () => ({ listBlogImages: library.list, deleteBlogImage: vi.fn() }));

import BlogImagesPage from "./page";

const ITALIAN = {
  url: "https://store.test/article-images/blog/posts/it/c.webp",
  name: "c.webp",
  size: 30_000,
  createdAt: "2026-10-15T10:00:00Z",
  alt: "Schema in italiano",
  usedIn: [],
  languages: ["it"],
};
const USED = {
  url: "https://store.test/article-images/blog/posts/a.webp",
  name: "a.webp",
  size: 41_000,
  createdAt: "2026-10-09T10:00:00Z",
  alt: "Diagram of ChatGPT mentions",
  usedIn: [{ id: "p1", title: "How to Get Mentioned in ChatGPT", slug: "get-mentioned-in-chatgpt", status: "published" }],
  languages: ["en"],
};
const ORPHAN = { url: "https://store.test/article-images/blog/posts/b.webp", name: "b.webp", size: 2_400_000, createdAt: null, alt: null, usedIn: [], languages: [] };

async function render(params: { q?: string; show?: string; lang?: string } = {}, images: unknown[] = [ITALIAN, USED, ORPHAN]) {
  library.list.mockResolvedValue({ configured: true, images });
  return renderToStaticMarkup(await BlogImagesPage({ searchParams: Promise.resolve(params) }));
}

/** The filter link labelled `label`, from its opening tag to its count. */
const pill = (html: string, label: string) => html.split("<a ").find((link) => link.includes(`>${label}<span`)) ?? "";
const count = (html: string, label: string) => /<span[^>]*>(\d+)<\/span>/.exec(pill(html, label))?.[1];
const card = (html: string, name: string) => html.split("<li ").slice(1).find((item) => item.includes(name)) ?? "";

describe("the Images page", () => {
  it("shows each picture with its description, size and where it is used", async () => {
    const html = await render();
    expect(html).toContain('src="https://store.test/article-images/blog/posts/a.webp"');
    expect(html).toContain("Diagram of ChatGPT mentions");
    expect(html).toContain('href="/admin/blog/p1"');
    expect(html).toContain("How to Get Mentioned in ChatGPT");
    expect(html).toContain("Not used in any post");
    expect(html).toContain("No description");
    expect(html).toContain("40 KB");
    expect(html).toContain("2.3 MB");
  });

  it("does not offer to delete a picture a post uses", async () => {
    const html = await render();
    expect(card(html, "a.webp")).toMatch(/<button[^>]*disabled=""[^>]*title="Used in a post[^"]*"/);
    expect(card(html, "b.webp")).not.toMatch(/<button[^>]*disabled=""/);
  });

  it("filters to the pictures no post uses, keeping the search", async () => {
    const html = await render({ show: "unused", q: "b" });
    expect(library.list).toHaveBeenLastCalledWith("b");
    expect(html).toContain("b.webp");
    expect(html).not.toContain("a.webp");
    expect(html).toContain('name="show" value="unused"');
  });
});

describe("each language's pictures (client, 2026-10-15)", () => {
  it("shows the languages each picture is suggested in", async () => {
    const html = await render();
    expect(card(html, "c.webp")).toContain('<span class="sr-only">Languages:</span>');
    expect(card(html, "c.webp")).toContain(">Italian</span>");
    expect(card(html, "a.webp")).toContain(">English</span>");
    // From before languages and in no post: under "All languages" only.
    expect(card(html, "b.webp")).toContain(">No language</span>");
  });

  it("shows one language's pictures, keeping the search and the other filter", async () => {
    const html = await render({ lang: "it", q: "c" });
    expect(library.list).toHaveBeenLastCalledWith("c");
    expect(html).toContain("c.webp");
    expect(html).not.toContain("a.webp");
    expect(html).not.toContain("b.webp");
    expect(html).toContain('name="lang" value="it"');
    expect(pill(html, "Italian")).toContain('aria-current="page"');
    expect(pill(html, "All languages")).not.toContain("aria-current");
    expect(pill(html, "Not used")).toContain('href="/admin/blog/images?q=c&amp;show=unused&amp;lang=it"');
    expect(pill(html, "English")).toContain('href="/admin/blog/images?q=c&amp;lang=en"');
  });

  it("counts what each filter would show", async () => {
    const all = await render();
    expect(["All languages", "English", "Italian", "Spanish", "All", "Not used"].map((label) => count(all, label))).toEqual(["3", "1", "1", "0", "3", "2"]);
    const unusedItalian = await render({ show: "unused", lang: "it" });
    expect(["All languages", "English", "Italian", "All", "Not used"].map((label) => count(unusedItalian, label))).toEqual(["2", "0", "1", "1", "1"]);
  });

  it("uploads into the language shown, and asks for one when every language is", async () => {
    const select = (html: string) => /<select[^>]*id="blog-image-language"[\s\S]*?<\/select>/.exec(html)?.[0] ?? "";
    // The Upload button: the last button before its words.
    const uploadButton = (html: string) => {
      const before = html.slice(0, html.indexOf("Upload picture"));
      return before.slice(before.lastIndexOf("<button"));
    };

    const italian = await render({ lang: "it" });
    expect(italian).toMatch(/<label for="blog-image-language"[^>]*>Upload as<\/label>/);
    expect(select(italian)).toMatch(/<option value="it" selected="">Italian<\/option>/);
    expect(select(italian)).not.toContain("Choose a language");
    expect(uploadButton(italian)).not.toContain('disabled=""');

    // No language chosen for it: an Italian picture would be filed as English unnoticed.
    const every = await render();
    const placeholder = /<option([^>]*)>Choose a language<\/option>/.exec(select(every))?.[1] ?? "";
    expect(placeholder).toContain('selected=""');
    expect(placeholder).toContain('disabled=""');
    expect(select(every)).not.toMatch(/<option value="en" selected="">/);
    expect(uploadButton(every)).toContain('disabled=""');
    expect(uploadButton(every)).toContain("Choose the picture&#x27;s language first");
  });

  it("says when a language has no pictures yet", async () => {
    const spanish = await render({ lang: "es" });
    expect(spanish).toContain("No Spanish pictures yet");
    expect(spanish).toContain("uploaded in a Spanish post or here with Spanish chosen, or used in a Spanish post.");
    const italian = await render({ lang: "it" }, [USED, ORPHAN]);
    expect(italian).toContain("No Italian pictures yet");
    expect(italian).toContain("uploaded in an Italian post");
  });

  it("ignores a language the blog does not have", async () => {
    const html = await render({ lang: "xx" });
    expect(html).toContain("a.webp");
    expect(html).toContain("c.webp");
    expect(pill(html, "All languages")).toContain('aria-current="page"');
    expect(html).not.toContain('name="lang"');
  });
});
