import { normalizeHostname } from "@/lib/net/ip";

/**
 * Does this URL belong to this website?
 *
 * WHY THIS IS NOT A STRING TEST. requestBacklink used to ask
 * `targetUrl.includes(site.domain)`, which answers a different question: it
 * says the domain appears SOMEWHERE in the URL text. Every one of these
 * passed that check for a site whose domain is "example.com":
 *
 *   https://evil.com/?ref=example.com      - in the query
 *   https://evil.com/example.com/page      - in the path
 *   https://example.com.attacker.net/      - a deceptive suffix
 *   https://example.com@evil.com/          - credentials, host is evil.com
 *   https://notexample.com/                - a longer label ending the same
 *
 * The backlink network points real links at whatever URL is stored, so a
 * request that passes this check is a request other customers' sites will be
 * asked to host. Accepting an unrelated URL turns the network into a tool for
 * pointing links anywhere, paid for with someone else's credits.
 *
 * So the HOSTNAME is parsed out and compared as a hostname, never as text.
 *
 * SEPARATE FROM THE SSRF GUARD, DELIBERATELY. lib/net/safe-fetch.ts decides
 * whether an address is safe for our servers to CONNECT to (private ranges,
 * redirects, DNS rebinding). This decides whether a URL is the customer's own
 * property. A URL can be perfectly safe to fetch and still not belong to the
 * requester, and it can belong to them and be unsafe to fetch. Keeping the two
 * apart means neither check silently does half of the other's job.
 */

/**
 * Subdomains are accepted.
 *
 * INFERRED FROM EXISTING BEHAVIOUR, not chosen freshly. normalizeWebsiteUrl in
 * lib/websites/url.ts stores `domain` with any leading "www." stripped, so a
 * customer who signs up as "www.example.com" is recorded as "example.com". A
 * strict equality test would then reject that same customer's own
 * "www.example.com/page" — the commonest URL they could possibly paste.
 *
 * Once www must be accepted, other subdomains follow: a customer whose blog is
 * on "blog.example.com" or whose shop is on "shop.example.com" owns those just
 * as much, and the old `includes` check accepted them too. Narrowing to the
 * bare domain here would be a behaviour REGRESSION for real customers, while
 * the vulnerability being closed is unrelated URLs — so subdomains stay
 * allowed and the deceptive-suffix case is what gets shut.
 *
 * The distinction that matters, and that string matching could not make:
 *
 *   example.com            owned  (exact)
 *   www.example.com        owned  (subdomain)
 *   blog.example.com       owned  (subdomain)
 *   example.com.evil.net   NOT    (example.com is a LABEL PREFIX, not a suffix)
 *   notexample.com         NOT    (shares a suffix, not a label boundary)
 *
 * The rule is a label boundary: the host must equal the domain, or end with
 * "." + the domain. "example.com.evil.net" ends with ".evil.net", never with
 * ".example.com", so it fails — which is the whole point.
 */
export function hostnameBelongsTo(hostname: string, domain: string): boolean {
  const host = normalizeHostname(hostname);
  // The stored domain is already normalised, but it arrives from a database row
  // rather than from this function's own caller, so it is not assumed to be.
  const owned = normalizeHostname(domain).replace(/^www\./, "");

  if (!host || !owned) return false;
  if (host === owned) return true;
  return host.endsWith(`.${owned}`);
}

export type TargetUrlCheck =
  | { ok: true; url: string }
  | { ok: false; reason: "unparseable" | "not_http" | "has_credentials" | "foreign_host" };

/**
 * Validates that a target URL is a page on the given website.
 *
 * Returns the URL re-serialised from the parse, so what gets stored is the
 * canonical form of what was checked rather than the raw input — a caller
 * cannot accidentally persist a string that differs from the one validated.
 *
 * WHAT EACH REFUSAL IS FOR:
 *
 *  - `has_credentials`: "https://example.com@evil.com/" has hostname
 *    "evil.com", and a human reading it sees "example.com" first. URL parsing
 *    gets this right where string matching does not, but the shape exists only
 *    to deceive, so it is refused outright rather than parsed and allowed.
 *
 *  - `not_http`: a backlink is an href on a web page. "javascript:" and
 *    "data:" URLs have no host to own and no business in this field.
 *
 * PORTS are ignored for ownership. "example.com:8443" is still the customer's
 * site; a port is how you reach a host, not which host it is.
 *
 * INTERNATIONALIZED DOMAINS are handled by the URL parser, which converts a
 * unicode hostname to its punycode ("münchen.de" -> "xn--mnchen-3ya.de")
 * before we ever see it. Both sides of the comparison therefore end up in the
 * same encoding without this function special-casing anything: the stored
 * domain went through the same parser in normalizeWebsiteUrl. Comparing raw
 * unicode against punycode is exactly the mismatch that would reject a real
 * customer's own address.
 */
export function checkTargetUrl(input: string, domain: string): TargetUrlCheck {
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    return { ok: false, reason: "unparseable" };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, reason: "not_http" };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, reason: "has_credentials" };
  }
  if (!hostnameBelongsTo(parsed.hostname, domain)) {
    return { ok: false, reason: "foreign_host" };
  }

  return { ok: true, url: parsed.toString() };
}
