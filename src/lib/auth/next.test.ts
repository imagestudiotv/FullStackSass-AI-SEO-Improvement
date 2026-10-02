import { describe, expect, it } from "vitest";

import { authSwitchHref, CALLBACK_URL, safeNext } from "./next";

/**
 * The open-redirect guard on ?next=, and the sign-in/sign-up switch link that
 * now carries it - the link that lost an invitation in production by being a
 * bare "/sign-up".
 */

describe("safeNext", () => {
  it("keeps a path on this origin", () => {
    expect(safeNext("/invite/abc123")).toBe("/invite/abc123");
    expect(safeNext("/dashboard?site=1")).toBe("/dashboard?site=1");
  });

  it("falls back to the dashboard for nothing at all", () => {
    expect(CALLBACK_URL).toBe("/dashboard");
    expect(safeNext(null)).toBe(CALLBACK_URL);
    expect(safeNext("")).toBe(CALLBACK_URL);
  });

  it.each([
    ["protocol-relative", "//evil.com"],
    ["backslash", "/\\evil.com"],
    ["absolute https", "https://evil.com/invite/x"],
    ["javascript:", "javascript:alert(1)"],
    ["relative without a slash", "evil.com"],
    ["tab that browsers strip", "/\t/evil.com"],
    ["newline that browsers strip", "/\n/evil.com"],
    ["carriage return", "/\r/evil.com"],
  ])("rejects a %s target", (_label, value) => {
    expect(safeNext(value)).toBe(CALLBACK_URL);
  });
});

describe("authSwitchHref", () => {
  it("keeps a safe next and the email", () => {
    const href = authSwitchHref("/sign-up", "/invite/abc123", "Ed@Example.com");
    const url = new URL(href, "https://app.example");

    expect(url.pathname).toBe("/sign-up");
    expect(url.searchParams.get("next")).toBe("/invite/abc123");
    expect(url.searchParams.get("email")).toBe("Ed@Example.com");
  });

  it("encodes the values rather than pasting them in", () => {
    const href = authSwitchHref("/sign-in", "/invite/a?x=1&y=2", "a+b@example.com");
    const url = new URL(href, "https://app.example");

    expect(url.searchParams.get("next")).toBe("/invite/a?x=1&y=2");
    expect(url.searchParams.get("email")).toBe("a+b@example.com");
  });

  it("returns the bare page when there is nothing to carry", () => {
    expect(authSwitchHref("/sign-in", null, "")).toBe("/sign-in");
    expect(authSwitchHref("/sign-up", null, "   ")).toBe("/sign-up");
  });

  it("leaves out the default destination", () => {
    expect(authSwitchHref("/sign-up", CALLBACK_URL, "")).toBe("/sign-up");
  });

  it.each([
    ["//evil.com"],
    ["/\\evil.com"],
    ["https://evil.com"],
    ["http://evil.com/invite/x"],
    ["/\t/evil.com"],
  ])("drops an unsafe next (%s) instead of repeating it", (value) => {
    const href = authSwitchHref("/sign-up", value, "ed@example.com");
    const url = new URL(href, "https://app.example");

    expect(url.searchParams.has("next")).toBe(false);
    expect(url.searchParams.get("email")).toBe("ed@example.com");
    expect(href).not.toContain("evil");
  });

  it("returns the bare page when next is unsafe and there is no email", () => {
    expect(authSwitchHref("/sign-in", "//evil.com", "")).toBe("/sign-in");
  });
});
