/**
 * The customer's site as a bare origin (http or https, a host, an optional
 * port), where Preview sends the article's own-site links ("/services"), or
 * null to leave those links as they are.
 *
 * resolveSiteLinks (article-preview.tsx) writes this value into an href
 * attribute without escaping, so only a host of letters, digits, dots and
 * hyphens can pass (an international name arrives as punycode): nothing that
 * would need escaping reaches the attribute, whatever wrote websites.url.
 * Any other scheme, an IPv6 literal or an unreadable address gives null.
 */
export function previewSiteOrigin(siteUrl: string): string | null {
  let origin: string;
  try {
    origin = new URL(siteUrl).origin;
  } catch {
    return null;
  }
  return /^https?:\/\/[a-z0-9.-]+(:\d+)?$/i.test(origin) ? origin : null;
}
