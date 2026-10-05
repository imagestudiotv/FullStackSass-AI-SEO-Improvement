import { NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch as unstable_doesProxyMatch } from "next/experimental/testing/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { config, proxy } from "./proxy";

afterEach(() => vi.unstubAllEnvs());

describe("nonce CSP proxy", () => {
  it("covers auth and private routes while leaving marketing and APIs alone", () => {
    for (const url of ["/sign-in", "/sign-up", "/dashboard", "/admin/network/123", "/websites/abc/articles/def", "/onboarding", "/invite/token", "/connect/wordpress"]) {
      expect(unstable_doesProxyMatch({ config, nextConfig: {}, url })).toBe(true);
    }
    for (const url of ["/", "/pricing", "/blog/x", "/es", "/api/auth/sign-in/email", "/_next/static/app.js"]) {
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
    expect(first.headers.get(name)).toBe(first.headers.get("x-middleware-request-content-security-policy"));
    expect(first.headers.get(name)).toContain(`'nonce-${nonce}'`);
    expect(first.headers.get(name)).not.toContain("unsafe-inline' https://*.crisp.chat; style");
    expect(first.headers.get("cache-control")).toBe("private, no-store");
  });
});
