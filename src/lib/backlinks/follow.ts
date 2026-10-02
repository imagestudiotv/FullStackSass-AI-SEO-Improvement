/**
 * Whether a network backlink passes SEO value, and the one URL comparison
 * that delivery and verification share.
 *
 * A link marked nofollow, sponsored or ugc is a hint to search engines not to
 * count it, so a placement carrying one is worth little to the website it
 * points at (client, 2026-10-01: "if the articles insert nofollow backlinks
 * there is no value for SEO"). RepGet sends placements followed
 * (lib/articles/delivery.ts) and the verifier flags any it finds otherwise on
 * the live page (lib/backlinks/nofollow.ts).
 */

/** rel tokens that ask search engines not to count a link. */
const UNFOLLOWED_TOKENS = new Set(["nofollow", "sponsored", "ugc"]);

/**
 * Normalises a URL for comparison.
 *
 * A host may render the link with or without a trailing slash, with http
 * instead of https, or with "www." - all of which still point at the customer's
 * page. Comparing raw strings would report a live link as removed and refund a
 * credit that was legitimately earned.
 */
export function comparableLinkUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    const path = parsed.pathname.replace(/\/+$/, "");
    return `${host}${path}`.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

function tokens(rel: string): string[] {
  return rel.toLowerCase().split(/\s+/).filter(Boolean);
}

/**
 * True when a link with this rel is not counted. Null rel means the link was
 * not seen, which is unknown - never reported as nofollow.
 */
export function isUnfollowed(rel: string | null | undefined): boolean {
  return rel ? tokens(rel).some((token) => UNFOLLOWED_TOKENS.has(token)) : false;
}

/** The rel with every "do not count" token removed; "" when nothing is left. */
export function followedRel(rel: string): string {
  return tokens(rel)
    .filter((token) => !UNFOLLOWED_TOKENS.has(token))
    .join(" ");
}
