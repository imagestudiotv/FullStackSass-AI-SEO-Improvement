import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/** Admin -> Blog -> Images, rendered with a filled library (lib/admin/blog-images.ts is replaced). */

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock("@/lib/admin/blog", () => ({ uploadBlogImage: vi.fn() }));
const library = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("@/lib/admin/blog-images", () => ({ listBlogImages: library.list, deleteBlogImage: vi.fn() }));

import BlogImagesPage from "./page";

const USED = {
  url: "https://store.test/article-images/blog/posts/a.webp",
  name: "a.webp",
  size: 41_000,
  createdAt: "2026-10-09T10:00:00Z",
  alt: "Diagram of ChatGPT mentions",
  usedIn: [{ id: "p1", title: "How to Get Mentioned in ChatGPT", slug: "get-mentioned-in-chatgpt", status: "published" }],
};
const ORPHAN = { url: "https://store.test/article-images/blog/posts/b.webp", name: "b.webp", size: 2_400_000, createdAt: null, alt: null, usedIn: [] };

async function render(params: { q?: string; show?: string } = {}) {
  library.list.mockResolvedValue({ configured: true, images: [USED, ORPHAN] });
  return renderToStaticMarkup(await BlogImagesPage({ searchParams: Promise.resolve(params) }));
}

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
    const cards = html.split("<li ").slice(1);
    const usedCard = cards.find((card) => card.includes("a.webp"))!;
    const orphanCard = cards.find((card) => card.includes("b.webp"))!;
    expect(usedCard).toMatch(/<button[^>]*disabled=""[^>]*title="Used in a post[^"]*"/);
    expect(orphanCard).not.toMatch(/<button[^>]*disabled=""/);
  });

  it("filters to the pictures no post uses, keeping the search", async () => {
    const html = await render({ show: "unused", q: "b" });
    expect(library.list).toHaveBeenLastCalledWith("b");
    expect(html).toContain("b.webp");
    expect(html).not.toContain("a.webp");
    expect(html).toContain('name="show" value="unused"');
  });
});
