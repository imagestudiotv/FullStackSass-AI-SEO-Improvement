import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { iconData, isLight } from "./site-icon-data";

/**
 * The suggestion's icon, read by our server (lib/websites/site-icon-data.ts):
 * a PNG data URL the browser shows at once (Daniel 2026-11-18: an empty gap
 * while a slow icon loaded), and whether it is a white logo that needs a
 * dark tile.
 */

/** A 120x120 icon: a filled square in `colour` on transparency. */
const logo = (colour: { r: number; g: number; b: number }) =>
  sharp({ create: { width: 120, height: 120, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: { create: { width: 80, height: 80, channels: 4, background: { ...colour, alpha: 1 } } }, left: 20, top: 20 }])
    .png()
    .toBuffer();

const serving = (body: Buffer | string, status = 200) =>
  vi.fn(async () => new Response(new Uint8Array(typeof body === "string" ? Buffer.from(body) : body), { status })) as never;

describe("iconData", () => {
  it("turns the icon into a 64px PNG data URL and marks a white logo light", async () => {
    const white = await iconData("https://imagestudio.com/icon.png", serving(await logo({ r: 255, g: 255, b: 255 })));
    expect(white?.tone).toBe("light");
    expect(white?.dataUrl).toMatch(/^data:image\/png;base64,/);
    const png = Buffer.from(white!.dataUrl.split(",")[1], "base64");
    expect(await sharp(png).metadata()).toMatchObject({ width: 64, height: 64, format: "png" });
  });

  it("leaves a coloured or dark logo unmarked", async () => {
    expect((await iconData("https://stripe.com/icon.png", serving(await logo({ r: 99, g: 91, b: 255 }))))?.tone).toBeNull();
    expect((await iconData("https://acme.com/icon.png", serving(await logo({ r: 20, g: 20, b: 20 }))))?.tone).toBeNull();
  });

  it("gives up, for the site's own address to be used, on an error, a failed fetch or a format it cannot read", async () => {
    expect(await iconData("https://acme.com/icon.png", serving(await logo({ r: 0, g: 0, b: 0 }), 404))).toBeNull();
    expect(await iconData("https://acme.com/favicon.ico", serving("not an image"))).toBeNull();
    expect(await iconData("https://acme.com/icon.png", vi.fn(async () => Promise.reject(new Error("Timed out"))) as never)).toBeNull();
  });
});

describe("isLight", () => {
  it("averages the visible pixels only", () => {
    const px = (...rgba: number[][]) => Buffer.from(rgba.flat());
    expect(isLight(px([255, 255, 255, 255], [0, 0, 0, 0]))).toBe(true);
    expect(isLight(px([255, 255, 255, 255], [0, 0, 0, 255]))).toBe(false);
    expect(isLight(px([0, 0, 0, 0]))).toBe(false);
  });
});
