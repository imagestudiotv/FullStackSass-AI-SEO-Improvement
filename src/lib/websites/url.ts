import { isInternalHostname, normalizeHostname } from "@/lib/net/ip";

/**
 * URL normalisation for website records.
 *
 * Users type "example.com", "https://Example.com/", "www.example.com/#about".
 * All four are the same site, and storing them verbatim would let one
 * organization add the same website several times and pay a per-site limit for
 * each. Normalising on the way in makes the duplicate check meaningful.
 */

export class InvalidUrlError extends Error {
  readonly status = 400;
  constructor(message = "Enter a valid website address") {
    super(message);
    this.name = "InvalidUrlError";
  }
}

export type NormalizedUrl = {
  /** Canonical absolute URL, no trailing slash: "https://example.com". */
  url: string;
  /** Host without "www.", lowercased: "example.com". Used for de-duplication. */
  domain: string;
};

/**
 * Hosts that are never a customer's own website. Someone pasting a Google or
 * Facebook URL has misunderstood the field, and letting it through produces a
 * crawl of a site we have no business crawling.
 */
const BLOCKED_HOSTS = new Set([
  "google.com",
  "facebook.com",
  "instagram.com",
  "twitter.com",
  "x.com",
  "linkedin.com",
  "youtube.com",
  "tiktok.com",
  "amazon.com",
  "wikipedia.org",
]);

/**
 * Rejects hosts that are not a public website by NAME or by IP literal.
 *
 * The rules live in lib/net/ip.ts and are shared with the fetch guard. This
 * used to be its own text check, and it compared "localhost." (the
 * fully-qualified spelling, trailing dot) against "localhost", found no match,
 * saw a dot and let it through - and it had no IPv6 handling beyond "::1", so
 * "[::ffff:7f00:1]" (IPv4-mapped loopback) passed as well.
 *
 * A NAME CHECK IS NOT ENOUGH ON ITS OWN: a public-looking name can resolve to
 * a private address. The resolved addresses are checked at connect time by
 * lib/net/safe-fetch.ts, which every request to a user's URL goes through.
 * This stays as the early, cheap rejection with a clear message.
 */
function isPrivateHost(host: string): boolean {
  return isInternalHostname(host);
}

export function normalizeWebsiteUrl(input: string): NormalizedUrl {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new InvalidUrlError();
  }

  // Users rarely type a scheme; assume https rather than rejecting them.
  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    throw new InvalidUrlError();
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new InvalidUrlError();
  }

  // Normalised: lowercase, no IPv6 brackets, no trailing dot ("example.com."
  // is example.com - and "localhost." is localhost).
  const host = normalizeHostname(parsed.hostname);
  if (isPrivateHost(host)) {
    throw new InvalidUrlError("That address is not a public website");
  }

  const domain = host.startsWith("www.") ? host.slice(4) : host;

  // A label-less or dotless domain ("example.", ".com") is not resolvable.
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain)) {
    throw new InvalidUrlError();
  }

  if (BLOCKED_HOSTS.has(domain)) {
    throw new InvalidUrlError("Enter your own website, not a social profile");
  }

  /**
   * Path is kept (some businesses live at example.com/shop) but query strings
   * and fragments are dropped: they are navigation state, never site identity.
   */
  let path = parsed.pathname.replace(/\/+$/, "");

  /**
   * Admin and account paths are dropped down to the site root.
   *
   * Someone pasting the address out of their browser hands us whatever page
   * they happened to be on, and for a WordPress owner that is very often
   * /wp-admin/. Analysing it reads a LOGIN SCREEN: the business came out named
   * "Log In ‹ Image Studio", and the platform came out undetected, because a
   * login page carries none of the theme assets the fingerprint looks for.
   *
   * Prefix matched rather than exact, since these carry sub-paths
   * (/wp-admin/options-general.php). A real business page is never behind one
   * of them, so there is nothing to lose by going to the root instead.
   */
  const ADMIN_PREFIXES = [
    "/wp-admin",
    "/wp-login.php",
    "/admin",
    "/administrator",
    "/login",
    "/signin",
    "/sign-in",
    "/account",
    "/dashboard",
    "/user/login",
  ];
  const lowerPath = path.toLowerCase();
  if (ADMIN_PREFIXES.some((prefix) => lowerPath.startsWith(prefix))) {
    path = "";
  }
  const port = parsed.port ? `:${parsed.port}` : "";

  // Built from `domain`, not `host`: keeping "www." in the URL while the
  // dedup key has it stripped would store two spellings of one site.
  return {
    url: `${parsed.protocol}//${domain}${port}${path}`,
    domain,
  };
}

/**
 * True when a URL is a public http(s) address we are willing to fetch.
 *
 * Used to re-check every redirect hop during crawling: normalizeWebsiteUrl
 * guards the address the user typed, but a site can redirect anywhere, and an
 * open redirect would otherwise reach exactly the private addresses that guard
 * exists to block.
 */
export function isPublicWebsiteUrl(candidate: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  if (parsed.username || parsed.password) return false;
  return !isPrivateHost(parsed.hostname);
}
