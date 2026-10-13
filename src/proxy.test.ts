import { NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch as unstable_doesProxyMatch } from "next/experimental/testing/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { config, effectiveCspMode, proxy } from "./proxy";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("nonce CSP proxy", () => {
  it("covers auth, private and dynamic content pages while leaving cached marketing pages and APIs alone", () => {
    for (const url of [
      "/sign-in",
      "/sign-up",
      "/dashboard",
      "/admin/network/123",
      "/websites/abc/articles/def",
      "/onboarding",
      "/invite/token",
      "/connect/wordpress",
      "/blog",
      "/blog/x",
      "/blog/category/guides",
      "/es/blog",
      "/de/blog/x",
      "/audit",
      "/tools/robots-checker",
      "/tools/meta-tag-checker",
    ]) {
      expect(unstable_doesProxyMatch({ config, nextConfig: {}, url })).toBe(true);
    }
    // Prerendered (no per-request nonce possible) or not pages at all.
    for (const url of ["/", "/pricing", "/es", "/about", "/tools", "/tools/snippet-preview", "/api/auth/sign-in/email", "/_next/static/app.js"]) {
      expect(unstable_doesProxyMatch({ config, nextConfig: {}, url })).toBe(false);
    }
  });

  it.each(["enforce", "report-only"])("sends the same fresh nonce to rendering and %s policy", (mode) => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CSP_MODE", mode);
    const request = new NextRequest("https://repget.test/sign-in", { headers: { "x-nonce": "attacker", "Content-Security-Policy": "script-src *" } });
    const first = proxy(request);
    const second = proxy(request);
    const nonce = first.headers.get("x-middleware-request-x-nonce");
    expect(nonce).toMatch(/^[A-Za-z0-9+/]{32}$/);
    expect(nonce).not.toBe(second.headers.get("x-middleware-request-x-nonce"));
    const name = mode === "enforce" ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only";
    const other = mode === "enforce" ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy";
    expect(first.headers.get(name)).toBe(first.headers.get("x-middleware-request-content-security-policy"));
    expect(first.headers.get(name)).toContain(`'nonce-${nonce}'`);
    expect(first.headers.get(name)).not.toContain("'unsafe-inline' https");
    expect(first.headers.get(name)).not.toContain("attacker");
    expect(first.headers.get(other)).toBeNull();
    expect(first.headers.get("cache-control")).toBe("private, no-store");
  });

  it("enforces when CSP_MODE is unset", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CSP_MODE", undefined as unknown as string);
    const response = proxy(new NextRequest("https://repget.test/dashboard"));
    expect(response.headers.get("Content-Security-Policy")).toContain("'strict-dynamic'");
    expect(response.headers.get("Content-Security-Policy-Report-Only")).toBeNull();
  });

  it("allows only the integrations the build has", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_CRISP_WEBSITE_ID", "");
    vi.stubEnv("NEXT_PUBLIC_GA4_MEASUREMENT_ID", "");
    vi.stubEnv("NEXT_PUBLIC_GTM_ID", "");
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "");
    const bare = proxy(new NextRequest("https://repget.test/dashboard")).headers.get("Content-Security-Policy");
    expect(bare).not.toMatch(/crisp|google|sentry/);
    vi.stubEnv("NEXT_PUBLIC_CRISP_WEBSITE_ID", "11111111-2222-3333-4444-555555555555");
    expect(proxy(new NextRequest("https://repget.test/dashboard")).headers.get("Content-Security-Policy")).toContain("https://client.crisp.chat");
  });
});

describe("build and runtime CSP mode", () => {
  it("follows the build's mode, so cached pages (fixed at build) and dynamic pages agree", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(effectiveCspMode("enforce", undefined)).toBe("enforce");
    expect(effectiveCspMode("enforce", "enforce")).toBe("enforce");
    expect(effectiveCspMode("report-only", "report-only")).toBe("report-only");
    expect(error).not.toHaveBeenCalled();
    // Changed at runtime without a rebuild: the build wins, and it is said once.
    expect(effectiveCspMode("enforce", "report-only")).toBe("enforce");
    expect(effectiveCspMode("enforce", "report-only")).toBe("enforce");
    expect(error).toHaveBeenCalledTimes(1);
    expect(String(error.mock.calls[0][0])).toMatch(/build used "enforce"/);
  });

  it("outside a build reads CSP_MODE, and a typo is an error", () => {
    expect(effectiveCspMode(undefined, undefined)).toBe("enforce");
    expect(effectiveCspMode(undefined, "report-only")).toBe("report-only");
    expect(() => effectiveCspMode(undefined, "enforced")).toThrow(/CSP_MODE/);
  });
});
