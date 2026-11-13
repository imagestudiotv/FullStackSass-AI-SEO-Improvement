import { describe, expect, it } from "vitest";

import { resolveSiteLinks } from "./article-preview";
import { previewSiteOrigin } from "./site-origin";

/**
 * Where Preview sends the article's own-site links (page.tsx): the stored
 * website address reduced to a bare origin, and only one that is safe to
 * write into an href attribute unescaped (resolveSiteLinks).
 */

describe("the site origin Preview links to", () => {
  it("is the scheme, host and port of the stored address, http or https", () => {
    expect(previewSiteOrigin("https://example.com")).toBe("https://example.com");
    expect(previewSiteOrigin("https://Example.com/blog/")).toBe("https://example.com");
    expect(previewSiteOrigin("http://shop.example")).toBe("http://shop.example");
    expect(previewSiteOrigin("https://my-site.example.co.uk:8443/path?x=1#y")).toBe("https://my-site.example.co.uk:8443");
    // An international name arrives as punycode.
    expect(previewSiteOrigin("https://bücher.example")).toBe("https://xn--bcher-kva.example");
  });

  it("is null for another scheme or an unreadable address, so path links stay as they are", () => {
    expect(previewSiteOrigin("ftp://example.com")).toBeNull();
    expect(previewSiteOrigin("javascript:alert(1)")).toBeNull();
    expect(previewSiteOrigin("example.com")).toBeNull();
    expect(previewSiteOrigin("")).toBeNull();
    expect(previewSiteOrigin("http://[::1]:3000")).toBeNull();
  });

  it("never lets a host that would need escaping reach the link Preview writes", () => {
    // URL keeps these characters in the origin; the old /^https?:\/\/[^/]+$/ check let them through.
    for (const url of ['https://a"b.com', "https://a`b.com", "https://a{b}.com", "https://a$b.com"]) {
      expect(new URL(url).origin).not.toBe("null");
      const origin = previewSiteOrigin(url);
      expect(origin).toBeNull();
      expect(resolveSiteLinks('<a href="/services">x</a>', origin)).toBe('<a href="/services">x</a>');
    }
  });
});
