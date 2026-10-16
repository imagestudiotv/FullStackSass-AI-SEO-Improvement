import { describe, expect, it } from "vitest";

import { IMAGE_NAME_MAX, imageExtension, imageFileName } from "@/lib/publishing/image-names";

/**
 * The same examples as the WordPress plugin's repget_image_name() check
 * (wordpress-plugin/tests/real-wordpress-images.php): a picture gets the same
 * name whichever way the article travels.
 */
describe("imageFileName", () => {
  it("names a picture after what it shows", () => {
    expect(imageFileName("Director coordinating a music video shoot", "slug")).toBe("director-coordinating-a-music-video-shoot");
  });

  it("drops accents and spells the letters NFKD leaves whole", () => {
    expect(imageFileName("Sposi all'alba sul Lago di Como, è magia", "x")).toBe("sposi-all-alba-sul-lago-di-como-e-magia");
    expect(imageFileName("Straße & Œuvre: Ærø", "x")).toBe("strasse-oeuvre-aero");
    expect(imageFileName("Fotógrafo en la ceremonia, niño", "x")).toBe("fotografo-en-la-ceremonia-nino");
  });

  it("cuts a long name between words, within the limit", () => {
    const name = imageFileName(
      "Director coordinating a music video shoot on a busy city street at golden hour",
      "x",
    );
    expect(name).toBe("director-coordinating-a-music-video-shoot-on-a-busy-city");
    expect(name.length).toBeLessThanOrEqual(IMAGE_NAME_MAX);
  });

  it("cuts one very long word at the limit", () => {
    expect(imageFileName("a".repeat(80), "x")).toBe("a".repeat(IMAGE_NAME_MAX));
  });

  it("falls back to the article when the text says nothing", () => {
    expect(imageFileName("", "building-a-music-video-crew-2")).toBe("building-a-music-video-crew-2");
    expect(imageFileName(null, "Building a Music Video Crew")).toBe("building-a-music-video-crew");
    expect(imageFileName("  ...  ", "crew-1")).toBe("crew-1");
    expect(imageFileName("2026", "crew-1")).toBe("crew-1");
  });

  it("is never empty", () => {
    expect(imageFileName("", "")).toBe("image");
    expect(imageFileName("日本語", "日本語")).toBe("image");
  });
});

describe("imageExtension", () => {
  it("maps picture types to extensions", () => {
    expect(imageExtension("image/jpeg")).toBe("jpg");
    expect(imageExtension("image/JPG")).toBe("jpg");
    expect(imageExtension("image/webp")).toBe("webp");
    expect(imageExtension("image/gif")).toBe("gif");
    expect(imageExtension("image/png")).toBe("png");
    expect(imageExtension("application/octet-stream")).toBe("png");
  });
});
