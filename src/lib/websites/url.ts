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
  // AWS/GCP/Azure link-local metadata endpoint, by address.
  if (host === "169.254.169.254") return true;

  /**
   * Metadata and internal services by NAME rather than by address.
   *
   * The IP check above missed these entirely: "metadata.google.internal"
   * contains a dot, is not an IP, and so was treated as an ordinary public
   * website. On GCP that name resolves to 169.254.169.254 and returns service
   * account tokens, and the free audit tool fetches whatever URL an anonymous
   * visitor types.
   *
   * Blocked by suffix rather than by listing hostnames, because the same
   * shape recurs across providers and private networks — .internal, .local
   * (mDNS), .home.arpa, and the reserved .test/.example/.invalid — and a list
   * of exact names is one new provider away from being wrong again.
   */
  const INTERNAL_SUFFIXES = [
    ".internal",
    ".local",
    ".localdomain",
    ".home.arpa",
    ".intranet",
    ".private",
    ".corp",
    ".lan",
    ".test",
    ".invalid",
  ];
  if (INTERNAL_SUFFIXES.some((suffix) => host.endsWith(suffix))) return true;

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
  return !isPrivateHost(parsed.hostname.toLowerCase());
}
