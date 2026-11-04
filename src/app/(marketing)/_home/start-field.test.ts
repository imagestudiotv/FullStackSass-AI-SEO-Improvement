import { describe, expect, it } from "vitest";

import { safeNext } from "@/lib/auth/next";
import { cleanEmail, cleanWebsite, signUpWithEmail, signUpWithWebsite, websiteStep } from "./start-field";

describe("the homepage's start fields", () => {
  it.each(["acme.com", "www.acme.com", "https://acme.com/shop", "  acme.com  ", "http://acme.co.uk"])("takes %s as a website", (value) => {
    expect(cleanWebsite(value)).toBe(value.trim());
  });

  it.each(["", "   ", "acme", "acme .com", "ftp://acme.com", "javascript:alert(1)", "not a website"])("refuses %j as a website", (value) => {
    expect(cleanWebsite(value)).toBeNull();
  });

  it("takes an email, trimmed, and refuses what is not one", () => {
    expect(cleanEmail(" me@acme.com ")).toBe("me@acme.com");
    expect(cleanEmail("me@acme")).toBeNull();
    expect(cleanEmail("acme.com")).toBeNull();
  });

  it("carries a website through sign-up to the website step", () => {
    const target = new URL(signUpWithWebsite("/sign-up", "/onboarding/website", "https://acme.com/a?b=1"), "https://x.test");
    expect(target.pathname).toBe("/sign-up");
    const next = target.searchParams.get("next");
    expect(next).toBe(websiteStep("/onboarding/website", "https://acme.com/a?b=1"));
    // The sign-up page keeps it, and the website step reads the address back intact.
    expect(safeNext(next)).toBe(next);
    expect(new URL(next!, "https://x.test").searchParams.get("domain")).toBe("https://acme.com/a?b=1");
  });

  it("carries an email to sign-up", () => {
    expect(signUpWithEmail("/sign-up", "me+x@acme.com")).toBe("/sign-up?email=me%2Bx%40acme.com");
  });
});
