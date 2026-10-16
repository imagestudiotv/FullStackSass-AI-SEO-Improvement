import { describe, expect, it } from "vitest";

import { pointAtCopies, readPictureCopies, storedPictures } from "@/lib/publishing/picture-copies";

const PREFIX = "https://store.test/storage/v1/object/public/article-images/";
const A = `${PREFIX}site/article/1791986572090-96wum8.jpg`;
const B = `${PREFIX}site/article/1791986573111-ab12cd.png`;

const BODY = [
  "<h2>Crew</h2>",
  `<p>Text.</p><img src="${A}" alt="Director coordinating a shoot" width="1280" height="720" loading="eager" decoding="async" style="max-width:100%;height:auto">`,
  `<p>More.</p><img src="https://elsewhere.test/photo.jpg" alt="Their own photo">`,
  `<img src="${B}" alt="">`,
  `<p>Again.</p><img src="${A}" alt="Director coordinating a shoot">`,
].join("");

describe("storedPictures", () => {
  it("finds RepGet's pictures, in order, each address once", () => {
    expect(storedPictures(BODY, PREFIX)).toEqual([
      { src: A, alt: "Director coordinating a shoot" },
      { src: B, alt: "" },
    ]);
  });

  it("ignores pictures elsewhere, and the bare prefix", () => {
    expect(storedPictures(`<img src="https://elsewhere.test/a.jpg"><img src="${PREFIX}">`, PREFIX)).toEqual([]);
    expect(storedPictures("<p>No pictures.</p>", PREFIX)).toEqual([]);
  });
});

describe("pointAtCopies", () => {
  const copies = {
    [A]: { id: "41", url: "https://site.test/wp-content/uploads/2026/10/director-coordinating-a-shoot.jpg" },
    [B]: { id: "42", url: "https://site.test/wp-content/uploads/2026/10/crew-2.png" },
  };

  it("points every copy's picture at it, with WordPress's attachment class", () => {
    const html = pointAtCopies(BODY, copies, { wordpress: true });
    expect(html).not.toContain(PREFIX);
    expect(html).toContain('src="https://site.test/wp-content/uploads/2026/10/director-coordinating-a-shoot.jpg"');
    expect(html.match(/class="wp-image-41"/g)).toHaveLength(2);
    expect(html).toContain('class="wp-image-42"');
    // Everything else about the picture is kept.
    expect(html).toContain('width="1280" height="720" loading="eager" decoding="async" style="max-width:100%;height:auto"');
    // Another site's picture is left alone.
    expect(html).toContain('<img src="https://elsewhere.test/photo.jpg" alt="Their own photo">');
  });

  it("keeps a picture's own classes and replaces an old attachment class", () => {
    const html = pointAtCopies(`<img class="hero wp-image-7" src="${A}" srcset="${A} 2x" sizes="100vw">`, copies, { wordpress: true });
    expect(html).toBe('<img class="hero wp-image-41" src="https://site.test/wp-content/uploads/2026/10/director-coordinating-a-shoot.jpg">');
  });

  it("adds no class for other CMSs", () => {
    const html = pointAtCopies(`<img src="${A}">`, { [A]: { id: "https://ghost.test/a.jpg", url: "https://ghost.test/a.jpg" } }, { wordpress: false });
    expect(html).toBe('<img src="https://ghost.test/a.jpg">');
  });

  it("returns the very same text when nothing has a copy", () => {
    expect(pointAtCopies(BODY, {}, { wordpress: true })).toBe(BODY);
    expect(pointAtCopies(BODY, { "https://other.test/x.jpg": { id: "1", url: "https://site.test/x.jpg" } }, { wordpress: true })).toBe(BODY);
  });
});

describe("readPictureCopies", () => {
  it("keeps only well-formed copies", () => {
    expect(
      readPictureCopies({
        [A]: { id: "41", url: "https://site.test/a.jpg" },
        [B]: { id: 42, url: "https://site.test/b.jpg" },
        x: { id: "1", url: "javascript:alert(1)" },
        y: null,
      }),
    ).toEqual({ [A]: { id: "41", url: "https://site.test/a.jpg" } });
    expect(readPictureCopies(null)).toEqual({});
    expect(readPictureCopies(["a"])).toEqual({});
  });
});
