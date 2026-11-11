/**
 * The business a customer story is about (client, 2026-11-11): the blog
 * editor's optional "Business" section, shown on the homepage's Customer
 * stories and in Earn Credits' "Discover businesses" (lib/blog/engagement.ts).
 *
 * No server imports: the editor (a client component) reads the limits and
 * the website check too. The server applies them on every save
 * (lib/blog/post-fields.ts).
 */

/** As the editor sends it: every field a string, empty for none. */
export type BlogBusiness = {
  /** One of the blog's pictures, chosen like the featured image; empty for none (an initial tile instead). */
  logoUrl: string;
  name: string;
  /** A short label, e.g. "Photography & Film". */
  category: string;
  /** http(s) only. */
  websiteUrl: string;
  /** One short line, shown under the name; the post's description when empty. */
  tagline: string;
};

export const EMPTY_BUSINESS: BlogBusiness = { logoUrl: "", name: "", category: "", websiteUrl: "", tagline: "" };

export const BUSINESS_LIMITS = { name: 80, category: 60, tagline: 140, websiteUrl: 300 } as const;

/**
 * A business's website as stored: an http or https address of a public host
 * (a dot in it, no user name or password). A bare "example.com" is read as
 * https://example.com. Null when it is not one.
 */
export function businessWebsite(raw: string): string | null {
  const value = raw.trim();
  if (!value || /\s/.test(value)) return null;
  // Any other scheme (javascript:, data:, ftp:, mailto:...) is refused, not "fixed" with https://.
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(value);
  if (hasScheme && !/^https?:\/\//i.test(value)) return null;
  let url: URL;
  try {
    url = new URL(hasScheme ? value : `https://${value}`);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  if (!host.includes(".") || host.endsWith(".") || host === "localhost") return null;
  const out = url.toString();
  return out.length > BUSINESS_LIMITS.websiteUrl ? null : out;
}

/** A business's name as a tile shows it when there is no logo: its first letter or digit. */
export function businessInitial(name: string): string {
  const match = name.trim().match(/[\p{L}\p{N}]/u);
  return match ? match[0].toLocaleUpperCase() : "•";
}
