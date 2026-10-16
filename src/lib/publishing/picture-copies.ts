import * as cheerio from "cheerio";

/**
 * RepGet's own pictures inside an article (kept by lib/images/storage.ts),
 * and the article pointing at the copies a customer's CMS made of them.
 *
 * Client, 2026-10-16: "the rest of generated images should be stored on
 * clients websites like the featured image is doing, and not on ours server".
 * The header picture always went into the customer's media library; the
 * pictures inside the text went out still loading from RepGet. The WordPress
 * plugin (1.8.0) now copies them itself. A direct connection uploads them in
 * the publish job (inngest/functions/publish-article.ts) and sends the text
 * pointing at the uploads.
 */

export type StoredPicture = { src: string; alt: string };

/** RepGet's address of a picture -> the CMS's copy of it. */
export type PictureCopies = Record<string, { id: string; url: string }>;

/** RepGet's pictures in `html` - addresses under `prefix` - in order, each address once. */
export function storedPictures(html: string, prefix: string): StoredPicture[] {
  const $ = cheerio.load(html, null, false);
  const seen = new Set<string>();
  const found: StoredPicture[] = [];
  for (const image of $("img[src]").toArray()) {
    const src = ($(image).attr("src") ?? "").trim();
    if (!src.startsWith(prefix) || src.length === prefix.length || seen.has(src)) continue;
    seen.add(src);
    found.push({ src, alt: ($(image).attr("alt") ?? "").trim() });
  }
  return found;
}

/**
 * `html` with every picture that has a copy pointing at the copy. For
 * WordPress, also the attachment's own class (wp-image-<id>): it is how
 * WordPress recognises its attachment in a post and adds the responsive
 * sizes it made of it when the post is shown. Unchanged when nothing matches.
 */
export function pointAtCopies(html: string, copies: PictureCopies, options: { wordpress: boolean }): string {
  if (Object.keys(copies).length === 0) return html;
  const $ = cheerio.load(html, null, false);
  let changed = false;
  for (const image of $("img[src]").toArray()) {
    const copy = copies[($(image).attr("src") ?? "").trim()];
    if (!copy) continue;
    $(image).attr("src", copy.url).removeAttr("srcset").removeAttr("sizes");
    if (options.wordpress && /^\d+$/.test(copy.id)) {
      const classes = ($(image).attr("class") ?? "").split(/\s+/).filter((name) => name && !/^wp-image-\d+$/.test(name));
      $(image).attr("class", [...classes, `wp-image-${copy.id}`].join(" "));
    }
    changed = true;
  }
  return changed ? $.html().trim() : html;
}

/** The copies kept with an earlier send, or {} for anything that is not that shape. */
export function readPictureCopies(value: unknown): PictureCopies {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const copies: PictureCopies = {};
  for (const [src, copy] of Object.entries(value as Record<string, unknown>)) {
    if (!copy || typeof copy !== "object") continue;
    const { id, url } = copy as { id?: unknown; url?: unknown };
    if (typeof id === "string" && typeof url === "string" && /^https?:\/\//.test(url)) copies[src] = { id, url };
  }
  return copies;
}
