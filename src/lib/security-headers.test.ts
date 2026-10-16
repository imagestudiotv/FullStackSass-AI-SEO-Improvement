import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { THEME_SCRIPT } from "./theme";
import {
  ALL_INTEGRATIONS,
  contentSecurityPolicy,
  cspHeaderName,
  cspIntegrations,
  cspMode,
  cspReportUri,
  hasTagManager,
  securityHeaders,
  THEME_SCRIPT_HASH,
  type CspIntegrations,
} from "./security-headers";

/**
 * Security headers (client's launch review, 2026-10-03; enforced CSP from the
 * security review, 2026-10-12). These pin what the CSP allows, that it is
 * enforced unless explicitly rolled back, and where it reports.
 */

const DSN = "https://abc123publickey@o4501.ingest.de.sentry.io/4507";
const ALL = ALL_INTEGRATIONS(DSN);
const NONE: CspIntegrations = { crisp: false, googleTag: false, ads: false };
const NONCE = "a".repeat(32);

const header = (list: { key: string; value: string }[], key: string) =>
  list.find((h) => h.key === key)?.value;

/** "name v1 v2; name2 v3" -> { name: ["v1","v2"], name2: ["v3"] } */
function directives(csp: string): Record<string, string[]> {
  return Object.fromEntries(
    csp.split("; ").map((part) => {
      const [name, ...values] = part.split(" ");
      return [name, values];
    }),
  );
}

describe("securityHeaders", () => {
  const prod = securityHeaders({ production: true, integrations: ALL });

  it("sends the standard headers", () => {
    expect(header(prod, "X-Content-Type-Options")).toBe("nosniff");
    expect(header(prod, "Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(header(prod, "X-Frame-Options")).toBe("SAMEORIGIN");
    expect(header(prod, "Permissions-Policy")).toContain("camera=()");
    expect(header(prod, "Permissions-Policy")).toContain("microphone=()");
  });

  it("sets HSTS without the hard-to-undo includeSubDomains or preload", () => {
    expect(header(prod, "Strict-Transport-Security")).toBe("max-age=63072000");
  });

  it("enforces the CSP by default", () => {
    expect(header(prod, "Content-Security-Policy")).toBeTruthy();
    expect(header(prod, "Content-Security-Policy-Report-Only")).toBeUndefined();
    for (const mode of [undefined, "", " ", "enforce"]) {
      expect(cspMode(mode)).toBe("enforce");
      expect(cspHeaderName(mode)).toBe("Content-Security-Policy");
    }
  });

  it("reports only when explicitly rolled back, and a typo is an error rather than a downgrade", () => {
    const rolledBack = securityHeaders({ production: true, integrations: ALL, cspMode: "report-only" });
    expect(header(rolledBack, "Content-Security-Policy-Report-Only")).toBeTruthy();
    expect(header(rolledBack, "Content-Security-Policy")).toBeUndefined();
    for (const typo of ["enfore", "report_only", "off", "false", "Enforce"]) {
      expect(() => cspHeaderName(typo)).toThrow(/CSP_MODE/);
      expect(() => securityHeaders({ production: true, integrations: ALL, cspMode: typo })).toThrow();
    }
  });

  it("leaves the CSP out in development, where the dev server needs eval", () => {
    const dev = securityHeaders({ production: false, integrations: ALL });
    expect(header(dev, "Content-Security-Policy")).toBeUndefined();
    expect(header(dev, "Content-Security-Policy-Report-Only")).toBeUndefined();
    // Everything else still applies in development.
    expect(header(dev, "X-Frame-Options")).toBe("SAMEORIGIN");
  });
});

describe("cspIntegrations", () => {
  it("allows only what the deployment configures", () => {
    expect(cspIntegrations({})).toEqual({ sentryDsn: undefined, crisp: false, googleTag: false, ads: false });
    expect(
      cspIntegrations({
        NEXT_PUBLIC_SENTRY_DSN: DSN,
        NEXT_PUBLIC_CRISP_WEBSITE_ID: "11111111-2222-3333-4444-555555555555",
        NEXT_PUBLIC_GA4_MEASUREMENT_ID: "G-ABC123XYZ",
      }),
    ).toEqual({ sentryDsn: DSN, crisp: true, googleTag: true, ads: false });
    // A Tag Manager container loads Google's tag too, and the Ads tags.
    expect(cspIntegrations({ NEXT_PUBLIC_GTM_ID: "GTM-AB12CD3" })).toMatchObject({ googleTag: true, ads: true });
    // Not real ids: nothing loads them, so nothing is allowed.
    expect(cspIntegrations({ NEXT_PUBLIC_GA4_MEASUREMENT_ID: "UA-1234", NEXT_PUBLIC_GTM_ID: "nope", NEXT_PUBLIC_CRISP_WEBSITE_ID: " " })).toMatchObject({
      crisp: false,
      googleTag: false,
      ads: false,
    });
  });

  it("lists no third party for a deployment without integrations", () => {
    const bare = contentSecurityPolicy(NONE);
    expect(bare).not.toMatch(/crisp|google|doubleclick|sentry/);
    expect(directives(bare)["script-src"]).toEqual(["'self'", "'unsafe-inline'"]);
    expect(directives(bare)["connect-src"]).toEqual(["'self'"]);
    // The walkthrough video is part of the homepage, not an integration.
    expect(directives(bare)["frame-src"]).toEqual(["'self'", "https://www.youtube-nocookie.com"]);
  });
});

describe("contentSecurityPolicy", () => {
  const csp = directives(contentSecurityPolicy(ALL));

  it("allows scripts from this site, Crisp's client and Google's tag host - exact hosts only", () => {
    expect(csp["script-src"]).toEqual([
      "'self'",
      "'unsafe-inline'",
      "https://client.crisp.chat",
      "https://www.googletagmanager.com",
      "https://www.googleadservices.com",
      "https://googleads.g.doubleclick.net",
      "https://www.google.com",
      "https://tagassistant.google.com",
    ]);
    expect(csp["style-src"]).toEqual(["'self'", "'unsafe-inline'", "https://client.crisp.chat"]);
  });

  it("never allows eval, a wildcard script host or any HTTPS script", () => {
    for (const policy of [csp, directives(contentSecurityPolicy(ALL, NONCE))]) {
      expect(policy["script-src"]).not.toContain("'unsafe-eval'");
      expect(policy["script-src"]).not.toContain("https:");
      expect(policy["script-src"].join(" ")).not.toContain("*");
      expect(policy["style-src"].join(" ")).not.toContain("*");
      expect(policy["frame-src"].join(" ")).not.toContain("*");
    }
  });

  it("lets the chat talk to Crisp, Google's tag send its hits, and errors reach Sentry", () => {
    expect(directives(contentSecurityPolicy({ ...ALL, ads: false }))["connect-src"]).toEqual([
      "'self'",
      "https://client.crisp.chat",
      "https://storage.crisp.chat",
      "https://client.relay.crisp.chat",
      "wss://client.relay.crisp.chat",
      "wss://client.relay.rescue.crisp.chat",
      "https://*.google-analytics.com",
      "https://*.analytics.google.com",
      "https://www.googletagmanager.com",
      "https://o4501.ingest.de.sentry.io",
    ]);
  });

  it("covers the chat's fonts, sounds and workers", () => {
    expect(csp["font-src"]).toEqual(["'self'", "data:", "https://client.crisp.chat"]);
    expect(csp["media-src"]).toEqual(["'self'", "https://client.crisp.chat"]);
    expect(csp["worker-src"]).toEqual(["'self'", "blob:"]);
  });

  /*
    Google Analytics loads only after a visitor accepts the cookie banner
    (lib/google-analytics.ts): gtag.js from www.googletagmanager.com, hits to
    the hosts Google lists for GA4. On the nonce pages the nonced bundle
    inserts the script, which 'strict-dynamic' allows. No ads host unless
    the deployment has a Tag Manager container (next test).
  */
  it("covers Google Analytics on both policies, and no advertising host", () => {
    const ga = { ...ALL, ads: false };
    for (const policy of [directives(contentSecurityPolicy(ga)), directives(contentSecurityPolicy(ga, NONCE))]) {
      expect(policy["script-src"]).toContain("https://www.googletagmanager.com");
      expect(policy["connect-src"]).toEqual(expect.arrayContaining(["https://*.google-analytics.com", "https://*.analytics.google.com"]));
    }
    expect(contentSecurityPolicy(ga)).not.toMatch(/doubleclick|googleadservices|googlesyndication|tagassistant/);
  });

  it("adds Google Ads' hosts only for a deployment with a Tag Manager container", () => {
    expect(hasTagManager("GTM-AB12CD3")).toBe(true);
    expect(hasTagManager(undefined)).toBe(false);
    expect(hasTagManager("G-ABC123XYZ")).toBe(false);
    for (const policy of [csp, directives(contentSecurityPolicy(ALL, NONCE))]) {
      expect(policy["script-src"]).toEqual(expect.arrayContaining(["https://www.googleadservices.com", "https://googleads.g.doubleclick.net"]));
      expect(policy["connect-src"]).toEqual(
        expect.arrayContaining(["https://www.google.com", "https://*.g.doubleclick.net", "https://ad.doubleclick.net", "https://pagead2.googlesyndication.com"]),
      );
      expect(policy["connect-src"]).not.toContain("https://*.doubleclick.net");
      expect(policy["frame-src"]).toEqual(expect.arrayContaining(["https://td.doubleclick.net", "https://www.googletagmanager.com"]));
    }
  });

  /*
    Vercel Web Analytics loads /_vercel/insights/script.js and posts to
    /_vercel/insights/*, both on our own origin. 'self' must stay in both
    lists for that, and on the nonce pages the script is inserted by the
    nonced bundle, which only 'strict-dynamic' allows. Its development host
    must never reach the production policy.
  */
  it("covers Vercel Web Analytics with 'self' alone, on both policies", () => {
    const strict = directives(contentSecurityPolicy(ALL, NONCE));
    for (const policy of [csp, strict]) {
      expect(policy["script-src"]).toContain("'self'");
      expect(policy["connect-src"]).toContain("'self'");
    }
    expect(strict["script-src"]).toContain("'strict-dynamic'");
    expect(contentSecurityPolicy(ALL)).not.toContain("vercel");
    expect(contentSecurityPolicy(ALL, NONCE)).not.toContain("vercel");
  });

  it("frames only YouTube's privacy-enhanced player host (and Ads frames with a container)", () => {
    expect(directives(contentSecurityPolicy({ ...ALL, ads: false }))["frame-src"]).toEqual(["'self'", "https://www.youtube-nocookie.com"]);
    // Not the cookie-setting host, and no script or connect exception for YouTube.
    expect(contentSecurityPolicy(ALL)).not.toContain("https://www.youtube.com");
    expect(csp["script-src"].join(" ")).not.toContain("youtube");
    expect(csp["connect-src"].join(" ")).not.toContain("youtube");
    // The chat no longer needs a frame.
    expect(csp["frame-src"].join(" ")).not.toContain("crisp");
  });

  it("allows images from any HTTPS site, as audits and articles need", () => {
    expect(csp["img-src"]).toEqual(["'self'", "data:", "blob:", "https:"]);
  });

  it("refuses framing by other sites, plugins, and foreign forms or base URLs", () => {
    expect(csp["frame-ancestors"]).toEqual(["'self'"]);
    expect(csp["object-src"]).toEqual(["'none'"]);
    expect(csp["form-action"]).toEqual(["'self'"]);
    expect(csp["base-uri"]).toEqual(["'none'"]);
    expect(csp["default-src"]).toEqual(["'self'"]);
  });

  it("uses nonces without unsafe inline scripts on dynamic routes", () => {
    const strict = directives(contentSecurityPolicy(ALL, NONCE));
    expect(strict["script-src"]).toContain(`'nonce-${NONCE}'`);
    expect(strict["script-src"]).toContain("'strict-dynamic'");
    expect(strict["script-src"]).not.toContain("'unsafe-inline'");
    expect(strict["script-src-attr"]).toEqual(["'none'"]);
    expect(() => contentSecurityPolicy(ALL, "bad'; script-src *")).toThrow();
    expect(() => contentSecurityPolicy(ALL, "")).toThrow();
  });

  it("keeps 'unsafe-inline' for scripts on the baseline (cached public pages) - that policy is not strict", () => {
    expect(csp["script-src"]).toContain("'unsafe-inline'");
    expect(csp["script-src-attr"]).toEqual(["'none'"]);
  });

  it("allows the night mode script by its hash on the nonce pages, and only there", () => {
    // Recomputed from the script itself: changing one without the other fails here.
    const hash = `'sha256-${createHash("sha256").update(THEME_SCRIPT, "utf8").digest("base64")}'`;
    expect(THEME_SCRIPT_HASH).toBe(hash);
    expect(directives(contentSecurityPolicy(ALL, NONCE))["script-src"]).toContain(hash);
    expect(directives(contentSecurityPolicy(NONE, NONCE))["script-src"]).toContain(hash);
    // A hash on the cached pages' policy would switch their 'unsafe-inline' off.
    expect(csp["script-src"]).not.toContain(hash);
  });

  it("reports violations to the Sentry project in the DSN", () => {
    expect(csp["report-uri"]).toEqual([
      "https://o4501.ingest.de.sentry.io/api/4507/security/?sentry_key=abc123publickey",
    ]);
  });

  it("works without Sentry: no reporting endpoint, no Sentry origin", () => {
    const bare = directives(contentSecurityPolicy({ ...ALL, sentryDsn: undefined }));
    expect(bare["report-uri"]).toBeUndefined();
    expect(bare["connect-src"].join(" ")).not.toContain("sentry");
  });
});

describe("cspReportUri", () => {
  it("ignores a malformed DSN instead of throwing into next.config", () => {
    expect(cspReportUri("not a url")).toBeNull();
    expect(cspReportUri("https://o1.ingest.sentry.io/")).toBeNull(); // no key, no project
    expect(cspReportUri("")).toBeNull();
  });
});
