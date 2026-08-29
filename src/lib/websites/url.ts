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
 * Rejects hosts that resolve inside our own network.
 *
 * Without this the crawler is an SSRF primitive: a user could add
 * "http://localhost:3000/api/..." or a cloud metadata address and have our
 * server fetch it with our credentials and network position. Checked here
 * because this is the only place a user-supplied host enters the system.
 */
function isPrivateHost(host: string): boolean {
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host === "[::1]" || host === "::1") return true;
  // Anything without a dot cannot be a public domain (e.g. "intranet").
  if (!host.includes(".")) return true;
  // AWS/GCP/Azure link-local metadata endpoint.
  if (host === "169.254.169.254") return true;

  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (ipv4) {
    const [a, b] = ipv4.slice(1).map(Number);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 169 && b === 254) return true;
    // A bare public IP is still not a website someone owns a domain for.
    return false;
  }
  return false;
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

  const host = parsed.hostname.toLowerCase();
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
  const path = parsed.pathname.replace(/\/+$/, "");
  const port = parsed.port ? `:${parsed.port}` : "";

  // Built from `domain`, not `host`: keeping "www." in the URL while the
  // dedup key has it stripped would store two spellings of one site.
  return {
    url: `${parsed.protocol}//${domain}${port}${path}`,
    domain,
  };
}
