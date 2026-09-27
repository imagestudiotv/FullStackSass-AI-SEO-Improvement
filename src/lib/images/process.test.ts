import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";

import { COVER_MIN_RATIO, ImageProcessingError, openAiSize, toArticleImage } from "./process";

/**
 * Real bytes in, real bytes out: fixtures are drawn with sharp, and every
 * assertion reads the DECODED output. No provider is called.
 */

async function solid(width: number, height: number, rgb: [number, number, number], format: "png" | "jpeg" | "webp" = "png") {
  const image = sharp({ create: { width, height, channels: 3, background: { r: rgb[0], g: rgb[1], b: rgb[2] } } });
  return image[format]().toBuffer();
}

/** A source with a red band along the top and a blue one along the bottom. */
async function banded(width: number, height: number, band = Math.round(height / 6)) {
  const middle = await solid(width, height, [0, 200, 0]);
  return sharp(middle)
    .composite([
      { input: await solid(width, band, [255, 0, 0]), top: 0, left: 0 },
      { input: await solid(width, band, [0, 0, 255]), top: height - band, left: 0 },
    ])
    .png()
    .toBuffer();
}

async function pixel(data: Buffer, x: number, y: number) {
  const { data: raw, info } = await sharp(data).raw().toBuffer({ resolveWithObject: true });
  const i = (y * info.width + x) * info.channels;
  return [raw[i], raw[i + 1], raw[i + 2]];
}

const close = (a: number[], b: number[], tolerance = 40) => a.every((v, i) => Math.abs(v - b[i]) <= tolerance);

describe("every generated image becomes a real 1280 x 720 JPEG", () => {
  it.each([
    ["OpenAI gpt-image landscape", 1536, 1024, "png"],
    ["dall-e-3 landscape", 1792, 1024, "png"],
    ["Replicate 16:9 WebP", 1344, 768, "webp"],
    ["a square", 1024, 1024, "png"],
    ["a portrait", 768, 1344, "jpeg"],
  ] as const)("%s (%ix%i %s)", async (_label, width, height, format) => {
    const out = await toArticleImage(await solid(width, height, [10, 120, 200], format));
    const meta = await sharp(out.data).metadata();
    expect([meta.width, meta.height, meta.format]).toEqual([1280, 720, "jpeg"]);
    expect(out).toMatchObject({ contentType: "image/jpeg", width: 1280, height: 720 });
  });

  it("crops a wide image from the centre - scaled, not stretched, trimming only the edges", async () => {
    // 1536 x 1024 scales to 1280 x 853; the crop trims ~66 px from the top and the bottom.
    const thin = await toArticleImage(await banded(1536, 1024, 60)); // 60 px -> 50 px: inside the trim
    expect(close(await pixel(thin.data, 640, 360), [0, 200, 0])).toBe(true);
    expect(close(await pixel(thin.data, 640, 2), [0, 200, 0])).toBe(true);
    expect(close(await pixel(thin.data, 640, 717), [0, 200, 0])).toBe(true);

    const thick = await toArticleImage(await banded(1536, 1024, 171)); // 171 px -> 142 px: 76 px survive
    expect(close(await pixel(thick.data, 640, 2), [255, 0, 0])).toBe(true);
    expect(close(await pixel(thick.data, 640, 80), [0, 200, 0])).toBe(true);
    expect(close(await pixel(thick.data, 640, 717), [0, 0, 255])).toBe(true);
  });

  it("fits a square whole, centred on a blurred fill of itself, instead of cropping it to a strip", async () => {
    const out = await toArticleImage(await banded(1024, 1024));
    // The whole square is 720 x 720 in the middle: its red top band is still there...
    expect(close(await pixel(out.data, 640, 30), [255, 0, 0], 60)).toBe(true);
    // ...and its blue bottom band.
    expect(close(await pixel(out.data, 640, 700), [0, 0, 255], 60)).toBe(true);
    // Either side is the darkened fill, not black bars and not the image stretched.
    const side = await pixel(out.data, 100, 360);
    expect(side.some((v) => v > 20)).toBe(true);
    expect(close(side, await pixel(out.data, 640, 360), 10)).toBe(false);
  });

  it("applies EXIF orientation before deciding how to crop", async () => {
    // Stored 1024 x 1536 with orientation 6: displayed 1536 x 1024, a landscape.
    const rotated = await sharp(await banded(1024, 1536)).withMetadata({ orientation: 6 }).jpeg().toBuffer();
    const out = await toArticleImage(rotated);
    expect(await sharp(out.data).metadata()).toMatchObject({ width: 1280, height: 720 });
  });

  it("puts a transparent image on white, not black", async () => {
    const transparent = await sharp({
      create: { width: 1536, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .png()
      .toBuffer();
    const out = await toArticleImage(transparent);
    expect(close(await pixel(out.data, 640, 360), [255, 255, 255], 5)).toBe(true);
  });

  it("is deterministic", async () => {
    const source = await banded(1536, 1024);
    expect((await toArticleImage(source)).data.equals((await toArticleImage(source)).data)).toBe(true);
  });
});

describe("what is refused", () => {
  it("anything that is not an image", async () => {
    await expect(toArticleImage(Buffer.from("<html>not an image</html>"))).rejects.toBeInstanceOf(ImageProcessingError);
  });

  it("formats a provider would not send (SVG, GIF)", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><rect width="1600" height="900"/></svg>');
    await expect(toArticleImage(svg)).rejects.toThrow(/Unsupported image format: svg/);
    const gif = await sharp({ create: { width: 1600, height: 900, channels: 3, background: "#000" } }).gif().toBuffer();
    await expect(toArticleImage(gif)).rejects.toThrow(/Unsupported image format: gif/);
  });

  it("a small file that declares an enormous canvas", async () => {
    // 8000 x 8000 = 64 megapixels, over the 40-megapixel decode limit.
    const huge = await sharp({ create: { width: 8000, height: 8000, channels: 3, background: "#123" } }).png().toBuffer();
    await expect(toArticleImage(huge)).rejects.toBeInstanceOf(ImageProcessingError);
  });
});

describe("provider sizes", () => {
  it("asks each OpenAI model only for a size it supports", () => {
    expect(openAiSize("gpt-image-2")).toBe("1536x1024");
    expect(openAiSize("gpt-image-1")).toBe("1536x1024");
    expect(openAiSize("dall-e-3")).toBe("1792x1024");
    expect(openAiSize("dall-e-2")).toBe("1024x1024");
    expect(openAiSize("some-future-model")).toBe("1024x1024");
    expect(1536 / 1024).toBeGreaterThanOrEqual(COVER_MIN_RATIO);
  });
});

describe("generateArticleImage returns the processed image, for either provider", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("OpenAI: requests 1536x1024, returns a verified 1280x720 JPEG", async () => {
    vi.stubEnv("IMAGE_PROVIDER", "openai");
    vi.stubEnv("OPENAI_API_KEY", "test-key-not-real");
    vi.stubEnv("OPENAI_IMAGE_MODEL", "gpt-image-2");
    const png = await solid(1536, 1024, [200, 100, 50]);
    const requests: { size: string; prompt: string }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        requests.push(JSON.parse(String(init.body)));
        return new Response(JSON.stringify({ data: [{ b64_json: png.toString("base64") }], usage: { output_tokens: 1000 } }));
      }),
    );
    const { generateArticleImage } = await import("./generate");

    const image = await generateArticleImage("Wedding films in Tuscany", "photography", null, { alt: "A couple at sunset" });

    expect(requests[0].size).toBe("1536x1024");
    expect(requests[0].prompt).toMatch(/landscape composition/i);
    expect(image).toMatchObject({ contentType: "image/jpeg", width: 1280, height: 720, alt: "A couple at sunset" });
    expect(await sharp(image.data).metadata()).toMatchObject({ width: 1280, height: 720, format: "jpeg" });
  });
});
