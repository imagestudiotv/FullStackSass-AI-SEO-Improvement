import "server-only";

import sharp from "sharp";

import { safeFetch } from "@/lib/net/safe-fetch";

/**
 * A suggested site's icon, fetched by our server and handed to the browser as
 * a small PNG data URL, with whether it is drawn in white.
 *
 * Daniel, 2026-11-18, on the homepage field: no logo next to the suggestion.
 * Loaded straight from the site, an icon can take seconds to come (on the
 * live site imagestudio.com's CDN took over 2.5 s cold, explee.com's had not
 * come within five), and the row showed an empty gap meanwhile. Fetched
 * here - safeFetch's public-address, size and time limits - the icon arrives
 * with the suggestion, and its pixels can be read: a white logo on
 * transparency, invisible on the white row, is drawn on a dark tile.
 *
 * Too slow, or a format sharp cannot read (.ico): null, and the caller keeps
 * the site's own address, which the browser loads behind the letter tile.
 */

const MAX_BYTES = 512 * 1024;
const TIMEOUT_MS = 1500;
const SIZE = 64;
/** Mean luminance (0-1) of the visible pixels above which the icon reads as white. */
const LIGHT_LUMINANCE = 0.8;

export type IconData = { dataUrl: string; tone: "light" | null };

export async function iconData(url: string, fetcher: typeof safeFetch = safeFetch): Promise<IconData | null> {
  try {
    const response = await fetcher(url, { maxBytes: MAX_BYTES, timeoutMs: TIMEOUT_MS, headers: { accept: "image/*" } });
    if (!response.ok) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    const resized = sharp(bytes, { limitInputPixels: 4096 * 4096 }).resize(SIZE, SIZE, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    });
    const [png, raw] = await Promise.all([
      resized.clone().png().toBuffer(),
      resized.clone().ensureAlpha().raw().toBuffer(),
    ]);
    return { dataUrl: `data:image/png;base64,${png.toString("base64")}`, tone: isLight(raw) ? "light" : null };
  } catch {
    return null;
  }
}

/** RGBA pixels: whether those that show (mostly opaque) are, on average, near white. */
export function isLight(rgba: Buffer): boolean {
  let sum = 0;
  let count = 0;
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    if (rgba[i + 3] < 128) continue;
    sum += (0.2126 * rgba[i] + 0.7152 * rgba[i + 1] + 0.0722 * rgba[i + 2]) / 255;
    count++;
  }
  return count > 0 && sum / count > LIGHT_LUMINANCE;
}
