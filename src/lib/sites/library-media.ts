import "server-only";

import * as cheerio from "cheerio";
import { and, asc, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import { siteImages } from "@/lib/db/schema";
import type { PictureCopies } from "@/lib/publishing/picture-copies";

/**
 * The website's own photographs in an article ("Use photos from my website",
 * lib/sites/pictures.ts) are already in its WordPress media library: the
 * article points at them where they are. What is sent says which attachment
 * each one is, so nothing is uploaded a second time:
 *  - the cover: the attachment id - the plugin (1.9.0+) and a direct
 *    connection set the featured image from it;
 *  - pictures in the text: WordPress's class for the attachment
 *    (wp-image-<id>), so WordPress adds the responsive sizes it made of it -
 *    without it a phone loads the full-size photograph.
 * The ids are the ones the site inventory read (lib/sites/inventory.ts). A
 * stale one is harmless in the text (WordPress adds sizes only when the
 * attachment holds that very file); for the cover it is checked on the site
 * before use.
 */

/** Of `urls`, the ones in the website's media library: address -> attachment id. */
export async function libraryMediaIds(websiteId: string, urls: string[]): Promise<Map<string, number>> {
  const wanted = [...new Set(urls.map((url) => url.trim()).filter(Boolean))];
  const found = new Map<string, number>();
  if (wanted.length === 0) return found;
  const rows = await db
    .select({ url: siteImages.url, remoteId: siteImages.remoteId })
    .from(siteImages)
    .where(and(eq(siteImages.websiteId, websiteId), inArray(siteImages.url, wanted)))
    .orderBy(asc(siteImages.remoteId));
  for (const row of rows) if (!found.has(row.url)) found.set(row.url, row.remoteId);
  return found;
}

/** Every picture address in `html`, in order, each once. */
export function pictureAddresses(html: string): string[] {
  if (!html.includes("<img")) return [];
  const $ = cheerio.load(html, null, false);
  const seen = new Set<string>();
  for (const image of $("img[src]").toArray()) {
    const src = ($(image).attr("src") ?? "").trim();
    if (src) seen.add(src);
  }
  return [...seen];
}

/**
 * The website's own photographs in `html` as "copies" of themselves - same
 * address, their attachment id - for pointAtCopies() to give each its
 * WordPress class.
 */
export function ownCopies(html: string, ids: Map<string, number>): PictureCopies {
  const copies: PictureCopies = {};
  for (const src of pictureAddresses(html)) {
    const id = ids.get(src);
    if (id) copies[src] = { id: String(id), url: src };
  }
  return copies;
}

/** Two addresses of one picture: the same but for http/https and letter case. */
export function sameAddress(a: string, b: string): boolean {
  const bare = (url: string) => url.trim().replace(/^https?:/i, "").toLowerCase();
  return a.trim() !== "" && bare(a) === bare(b);
}
