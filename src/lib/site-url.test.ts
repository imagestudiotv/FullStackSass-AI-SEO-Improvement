import { createRequire } from "node:module";

import { afterEach, describe, expect, it, vi } from "vitest";

import { legacyHostRedirects, legacyRedirect, siteUrl } from "@/lib/site-url";

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

/**
 * The next.config rule that moves every PAGE on the old address to the brand
 * domain while /api keeps answering there (client launch review, 2026-10-03).
 *
 * The source pattern is compiled with Next's own matcher - the same
 * path-to-regexp build and options next.config redirects use - so these
 * cases test what Next will actually do, not a re-implementation of it.
 */
const { pathToRegexp } = createRequire(import.meta.url)(
  "next/dist/compiled/path-to-regexp",
) as { pathToRegexp: (path: string, keys: unknown[], options: object) => RegExp };

describe("legacyHostRedirects", () => {
  it("redirects the old host, permanently, to the same path on the brand domain", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.repget.com");
    expect(legacyHostRedirects()).toEqual([
      {
        source: "/:path((?!api(?:/|$)).*)",
        // A has-value is a regular expression: the dots must be literal.
        has: [{ type: "host", value: "full-stack-sass-ai-seo-improvement\\.vercel\\.app" }],
        destination: "https://www.repget.com/:path",
        permanent: true,
      },
    ]);
  });

  it("moves every page but leaves /api to the webhooks and older plugins", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.repget.com");
    const [rule] = legacyHostRedirects();
    const matches = pathToRegexp(rule.source, [], { strict: true, sensitive: false, delimiter: "/" });

    // Pages a browser opens, including the plugin's connect page and update file.
    for (const page of ["/", "/pricing", "/sign-in", "/connect/wordpress", "/repget-connector.json", "/apical"]) {
      expect(matches.test(page), page).toBe(true);
    }
    // Machines: Stripe, PayPal, Inngest, OAuth callbacks, the plugin API.
    for (const api of ["/api", "/api/", "/api/stripe/webhook", "/api/paypal/webhook", "/api/inngest", "/api/auth/callback/google", "/api/plugin/articles"]) {
      expect(matches.test(api), api).toBe(false);
    }
  });

  it("never redirects to itself, even if the app's address were still the old one", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", `https://${OLD}`);
    expect(legacyHostRedirects()).toEqual([]);
  });

  it("uses the www fallback when no address is configured", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    expect(legacyHostRedirects()[0].destination).toBe("https://www.repget.com/:path");
  });
});
