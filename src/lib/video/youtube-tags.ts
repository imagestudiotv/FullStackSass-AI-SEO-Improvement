/**
 * A YouTube Short's tags (Daniel, 2026-11-24: "one more field for tags, comma
 * separated"). Kept with the idea in video_ideas.overrides.youtubeTags (no
 * migration), as the comma-separated text YouTube Studio takes.
 *
 * YouTube's limit (Data API, videos resource, snippet.tags[], read
 * 2026-11-24): 500 characters in all; the commas between tags count, and a
 * tag with a space counts as if in quotation marks, the marks included
 * ("Foo Baz" is nine characters).
 *
 * Manual publishing only: bundle.social's YouTube data has no tags field
 * (its platform parameters page, read 2026-11-24).
 *
 * No server imports: the publishing window uses it too.
 */

export const YOUTUBE_TAGS_MAX = 500;
export const YOUTUBE_TAGS_KEY = "youtubeTags";

/** Comma (or line) separated text to its tags: trimmed, no # or quotes, no repeats (letters' case aside). */
export function parseTags(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of text.split(/[,;\n\r]+/)) {
    const tag = part
      .replace(/[<>"]/g, "")
      .replace(/^[\s#]+/, "")
      .replace(/\s+/g, " ")
      .trim();
    const key = tag.toLocaleLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  return out;
}

/** How many of YouTube's 500 characters the tags take. */
export function tagsLength(tags: readonly string[]): number {
  return tags.reduce((sum, tag) => sum + [...tag].length + (/\s/.test(tag) ? 2 : 0), 0) + Math.max(0, tags.length - 1);
}

/** The tags cleaned and kept, whole and in order, while they fit YouTube's limit. */
export function cleanTags(text: string): string {
  const kept: string[] = [];
  for (const tag of parseTags(text)) {
    if (tagsLength([...kept, tag]) > YOUTUBE_TAGS_MAX) continue;
    kept.push(tag);
  }
  return kept.join(", ");
}

/** The idea's own words as tags to start from: its post text's hashtags ("SmallBusiness" reads "Small Business"). No AI call. */
export function suggestedTags(caption: string): string {
  const tags = (caption.match(/#[\p{L}\p{N}_]+/gu) ?? []).map((tag) =>
    tag
      .slice(1)
      .replace(/_/g, " ")
      .replace(/(\p{Ll})(\p{Lu})/gu, "$1 $2"),
  );
  return cleanTags(tags.join(","));
}

/** The tags kept with an idea: null when none were saved (then the suggestion is offered). */
export function readTags(overrides: unknown): string | null {
  const value = (overrides as Record<string, unknown> | null)?.[YOUTUBE_TAGS_KEY];
  return typeof value === "string" ? value : null;
}
