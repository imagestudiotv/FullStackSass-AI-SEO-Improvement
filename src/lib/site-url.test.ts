import { afterEach, describe, expect, it, vi } from "vitest";

import { legacyRedirect, siteUrl } from "@/lib/site-url";

/**
 * The pre-repget.com address keeps answering (plugin 1.7.0 and the payment
 * webhooks call it), but a person sent there is moved to the brand domain,
 * where their sign-in lives (client, 2026-10-01).
 */

afterEach(() => {
  vi.unstubAllEnvs();
});

const OLD = "full-stack-sass-ai-seo-improvement.vercel.app";
const PAGE = "/connect/wordpress?request=abc_123-XYZ";

describe("legacyRedirect", () => {
  it("sends a browser on the old Vercel address to the same page on the canonical one", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.repget.com/");
    expect(legacyRedirect(OLD, PAGE)).toBe(`https://www.repget.com${PAGE}`);
    expect(legacyRedirect(`${OLD.toUpperCase()}:443`, PAGE)).toBe(`https://www.repget.com${PAGE}`);
  });

  it("leaves every other host alone - the brand domain, previews, staging, local", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.repget.com");
    for (const host of ["www.repget.com", "repget.com", "full-stack-sass-ai-seo-improvement-git-feat-x.vercel.app", "localhost:3000", `${OLD}.evil.test`, "", null, undefined]) {
      expect(legacyRedirect(host, PAGE)).toBeNull();
    }
  });

  it("never redirects to itself, even if the app's address were still the old one", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", `https://${OLD}`);
    expect(legacyRedirect(OLD, PAGE)).toBeNull();
  });

  it("falls back to www.repget.com when no address is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    expect(siteUrl()).toBe("https://www.repget.com");
    expect(legacyRedirect(OLD, PAGE)).toBe(`https://www.repget.com${PAGE}`);
  });
});
