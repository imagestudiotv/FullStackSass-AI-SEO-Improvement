import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The autopilot's pictures (client's choice 4): diagrams in the blog's look,
 * every word given, in the article's language; WebP in the blog's folder for
 * that language; placed in the section they illustrate.
 */

const images = vi.hoisted(() => ({ generate: vi.fn(), configured: vi.fn(() => true), store: vi.fn(), storage: vi.fn(() => true) }));
vi.mock("@/lib/images/generate", () => ({ generateOpenAiImage: images.generate, isOpenAiImageConfigured: images.configured }));
vi.mock("@/lib/images/storage", () => ({ storeArticleImage: images.store, isImageStorageConfigured: images.storage }));

import { canMakePictures, makePicture, picturePrompt, placePictures } from "./pictures";

const BRIEF = {
  title: "Le 3 fasi della SEO locale",
  idea: "Three cards side by side, each with an icon",
  labels: ["Pertinenza", "Distanza", "Notorietà", 'Il "profilo"'],
  alt: "Le tre fasi della SEO locale",
};

beforeEach(() => {
  images.generate.mockReset();
  images.store.mockReset();
});

describe("a picture", () => {
  it("is briefed in the blog's look, with its headline and every word spelled out, in the article's language", () => {
    const prompt = picturePrompt(BRIEF, "it");
    expect(prompt).toContain("infographic diagram");
    expect(prompt).toContain("pastel accents");
    expect(prompt).toContain('Headline at the top, large: "Le 3 fasi della SEO locale".');
    expect(prompt).toContain(`"Pertinenza"; "Distanza"; "Notorietà"; "Il 'profilo'"`);
    expect(prompt).toContain("All text is in Italian, correctly spelled. Use no other words.");
    expect(prompt).toContain("No logos");
  });

  it("is made at medium quality, stored as WebP in the blog's folder for its language", async () => {
    const png = await sharp({ create: { width: 1536, height: 1024, channels: 3, background: "#ffffff" } }).png().toBuffer();
    images.generate.mockResolvedValue({ data: png, costUsd: 0.19 });
    images.store.mockResolvedValue("https://storage.example/article-images/blog/posts/it/1-a.webp");
    const made = await makePicture(BRIEF, "it");
    expect(images.generate).toHaveBeenCalledWith(expect.stringContaining("Italian"), "medium");
    const [folder, subfolder, data, type] = images.store.mock.calls[0];
    expect([folder, subfolder, type]).toEqual(["blog", "posts/it", "image/webp"]);
    expect((await sharp(data as Buffer).metadata()).format).toBe("webp");
    expect(made).toEqual({ url: "https://storage.example/article-images/blog/posts/it/1-a.webp", alt: BRIEF.alt, width: 1536, height: 1024, costUsd: 0.19 });
  });

  it("needs OpenAI images and storage", () => {
    expect(canMakePictures()).toBe(true);
    images.configured.mockReturnValueOnce(false);
    expect(canMakePictures()).toBe(false);
    images.storage.mockReturnValueOnce(false);
    expect(canMakePictures()).toBe(false);
  });
});

describe("placing pictures", () => {
  const picture = (section: number, url = `https://cdn.example/${section}.webp`) => ({ url, alt: `Picture "${section}"`, width: 1536, height: 1024, section });
  const body = [
    "<p>Opening.</p>",
    "<h2>One</h2><p>Intro.</p><table><tbody><tr><td><p>Cell</p></td></tr></tbody></table><p>After the table.</p>",
    "<h2>Two</h2><p>Intro.</p><p>More.</p><h3>First sub</h3><p>Sub text.</p>",
    "<h2>Three</h2><p>Only text.</p><p>Last paragraph.</p>",
    "<h2>Four</h2>",
  ].join("");

  it("goes after the section's table, else before its first subheading, else at its end", () => {
    const html = placePictures(body, [picture(1), picture(2), picture(3), picture(4)]);
    expect(html).toContain('</table><img src="https://cdn.example/1.webp" alt="Picture &quot;1&quot;" width="1536" height="1024"><p>After the table.</p>');
    expect(html).toContain('<p>More.</p><img src="https://cdn.example/2.webp"');
    expect(html).toContain('<p>Last paragraph.</p><img src="https://cdn.example/3.webp"');
    expect(html).toContain('<h2>Four</h2><img src="https://cdn.example/4.webp"');
  });

  it("leaves out a picture for a section that is not there, or with an address that is not https", () => {
    expect(placePictures(body, [picture(9), picture(2, "javascript:alert(1)")])).toBe(body);
  });
});
