import { describe, expect, it } from "vitest";

import { checkTargetUrl, hostnameBelongsTo } from "./ownership";

/**
 * Issue 15: backlink target ownership.
 *
 * The check was `targetUrl.includes(site.domain)`. Each "rejects" case below is
 * a URL that passed it — an unrelated address the backlink network would then
 * have pointed other customers' links at.
 */

const DOMAIN = "example.com";

describe("hostnameBelongsTo", () => {
  it("accepts the domain itself", () => {
    expect(hostnameBelongsTo("example.com", DOMAIN)).toBe(true);
  });

  it("accepts www and other subdomains", () => {
    // normalizeWebsiteUrl stores the domain with "www." stripped, so the
    // customer's own www address must match or signup breaks its own links.
    expect(hostnameBelongsTo("www.example.com", DOMAIN)).toBe(true);
    expect(hostnameBelongsTo("blog.example.com", DOMAIN)).toBe(true);
    expect(hostnameBelongsTo("shop.eu.example.com", DOMAIN)).toBe(true);
  });

  it("accepts a stored domain that still carries www.", () => {
    expect(hostnameBelongsTo("example.com", "www.example.com")).toBe(true);
  });

  it("is case and trailing-dot insensitive", () => {
    expect(hostnameBelongsTo("WWW.Example.COM", DOMAIN)).toBe(true);
    // "example.com." is the fully-qualified spelling of the same host.
    expect(hostnameBelongsTo("example.com.", DOMAIN)).toBe(true);
  });

  it("rejects a deceptive suffix", () => {
    // The old check passed this: "example.com" appears in the text, but the
    // real host is attacker.net.
    expect(hostnameBelongsTo("example.com.attacker.net", DOMAIN)).toBe(false);
  });

  it("rejects a longer label that merely ends the same way", () => {
    expect(hostnameBelongsTo("notexample.com", DOMAIN)).toBe(false);
    expect(hostnameBelongsTo("myexample.com", DOMAIN)).toBe(false);
  });

  it("rejects an unrelated host", () => {
    expect(hostnameBelongsTo("evil.com", DOMAIN)).toBe(false);
  });

  it("rejects empty input rather than matching everything", () => {
    expect(hostnameBelongsTo("", DOMAIN)).toBe(false);
    expect(hostnameBelongsTo("example.com", "")).toBe(false);
  });
});

describe("checkTargetUrl", () => {
  it("accepts a real page on the site", () => {
    const result = checkTargetUrl("https://example.com/blog/post", DOMAIN);
    expect(result).toEqual({ ok: true, url: "https://example.com/blog/post" });
  });

  it("keeps the query string, which can be the whole address", () => {
    // Default WordPress permalinks are "?p=42". normalizeWebsiteUrl drops the
    // query, which is why the target is deliberately not put through it.
    const result = checkTargetUrl("https://example.com/?p=42", DOMAIN);
    expect(result.ok).toBe(true);
    expect(result.ok && result.url).toBe("https://example.com/?p=42");
  });

  it("keeps an admin-looking path instead of rewriting it to the root", () => {
    // normalizeWebsiteUrl sends /account/* to the site root. A pricing page
    // under /account is a legitimate link target.
    const result = checkTargetUrl("https://example.com/account/pricing", DOMAIN);
    expect(result.ok && result.url).toBe("https://example.com/account/pricing");
  });

  it("accepts a port", () => {
    expect(checkTargetUrl("https://example.com:8443/x", DOMAIN).ok).toBe(true);
  });

  /* The bypasses the audit named. Every one passed `includes()`. */

  it("rejects the domain appearing in the query", () => {
    const result = checkTargetUrl("https://evil.com/?ref=example.com", DOMAIN);
    expect(result).toEqual({ ok: false, reason: "foreign_host" });
  });

  it("rejects the domain appearing in the path", () => {
    const result = checkTargetUrl("https://evil.com/example.com/page", DOMAIN);
    expect(result).toEqual({ ok: false, reason: "foreign_host" });
  });

  it("rejects the domain appearing in the fragment", () => {
    expect(checkTargetUrl("https://evil.com/#example.com", DOMAIN).ok).toBe(false);
  });

  it("rejects credentials that make an unrelated host look like ours", () => {
    // A human reads "example.com" first; the host is evil.com.
    const result = checkTargetUrl("https://example.com@evil.com/", DOMAIN);
    expect(result).toEqual({ ok: false, reason: "has_credentials" });
  });

  it("rejects a deceptive hostname suffix", () => {
    const result = checkTargetUrl("https://example.com.attacker.net/x", DOMAIN);
    expect(result).toEqual({ ok: false, reason: "foreign_host" });
  });

  it("rejects non-http schemes", () => {
    expect(checkTargetUrl("javascript:alert(1)//example.com", DOMAIN)).toEqual({
      ok: false,
      reason: "not_http",
    });
    expect(checkTargetUrl("data:text/html,example.com", DOMAIN)).toEqual({
      ok: false,
      reason: "not_http",
    });
  });

  it("rejects unparseable input", () => {
    expect(checkTargetUrl("not a url", DOMAIN)).toEqual({
      ok: false,
      reason: "unparseable",
    });
  });

  describe("internationalized domains", () => {
    /**
     * The URL parser converts a unicode hostname to punycode before we compare,
     * so a stored punycode domain matches a typed unicode one. Comparing the
     * two encodings directly is what would reject a real customer's address.
     */
    it("matches unicode input against a punycode domain", () => {
      const result = checkTargetUrl("https://münchen.de/page", "xn--mnchen-3ya.de");
      expect(result.ok).toBe(true);
    });

    it("matches punycode input against a punycode domain", () => {
      expect(checkTargetUrl("https://xn--mnchen-3ya.de/", "xn--mnchen-3ya.de").ok).toBe(true);
    });

    it("still rejects a different IDN", () => {
      expect(checkTargetUrl("https://köln.de/", "xn--mnchen-3ya.de").ok).toBe(false);
    });
  });
});
