import { describe, expect, it } from "vitest";

import { contentSecurityPolicy, cspHeaderName, cspReportUri, securityHeaders } from "./security-headers";

/**
 * Security headers (client's launch review, 2026-10-03). The site sent none.
 * The CSP ships report-only; these pin what it allows and where it reports.
 */

const DSN = "https://abc123publickey@o4501.ingest.de.sentry.io/4507";

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
  const prod = securityHeaders({ production: true, sentryDsn: DSN });

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

  it("defaults to report-only until the deployment opts in", () => {
    expect(header(prod, "Content-Security-Policy-Report-Only")).toBeTruthy();
    expect(header(prod, "Content-Security-Policy")).toBeUndefined();
  });

  it("enforces when explicitly configured and rejects a typo", () => {
    const enforced = securityHeaders({ production: true, cspMode: "enforce" });
    expect(header(enforced, "Content-Security-Policy")).toBeTruthy();
    expect(header(enforced, "Content-Security-Policy-Report-Only")).toBeUndefined();
    expect(() => cspHeaderName("enfore")).toThrow();
  });

  it("leaves the CSP out in development, where the dev server needs eval", () => {
    const dev = securityHeaders({ production: false, sentryDsn: DSN });
    expect(header(dev, "Content-Security-Policy-Report-Only")).toBeUndefined();
    // Everything else still applies in development.
    expect(header(dev, "X-Frame-Options")).toBe("SAMEORIGIN");
  });
});

describe("contentSecurityPolicy", () => {
  const csp = directives(contentSecurityPolicy(DSN));

  it("allows scripts from this site, Crisp and Google Analytics, and styles from this site and Crisp", () => {
    expect(csp["script-src"]).toEqual(["'self'", "'unsafe-inline'", "https://*.crisp.chat", "https://*.googletagmanager.com"]);
    expect(csp["style-src"]).toEqual(["'self'", "'unsafe-inline'", "https://*.crisp.chat"]);
  });

  it("never allows eval or arbitrary script hosts", () => {
    expect(csp["script-src"]).not.toContain("'unsafe-eval'");
    expect(csp["script-src"]).not.toContain("https:");
    expect(csp["script-src"]).not.toContain("*");
  });

  it("lets the chat talk to Crisp, Google Analytics send its hits, and errors reach Sentry", () => {
    expect(csp["connect-src"]).toEqual([
      "'self'",
      "https://*.crisp.chat",
      "wss://*.relay.crisp.chat",
      "https://*.google-analytics.com",
      "https://*.analytics.google.com",
      "https://*.googletagmanager.com",
      "https://o4501.ingest.de.sentry.io",
    ]);
  });

  /*
    Google Analytics loads only after a visitor accepts the cookie banner
    (lib/google-analytics.ts): gtag.js from *.googletagmanager.com, hits to
    the hosts Google lists for GA4. On the nonce pages the nonced bundle
    inserts the script, which 'strict-dynamic' allows. Nothing broader -
    no doubleclick or ads hosts: advertising features are off.
  */
  it("covers Google Analytics on both policies, and no advertising host", () => {
    const strict = directives(contentSecurityPolicy(DSN, "a".repeat(32)));
    for (const policy of [csp, strict]) {
      expect(policy["script-src"]).toContain("https://*.googletagmanager.com");
      expect(policy["connect-src"]).toEqual(expect.arrayContaining(["https://*.google-analytics.com", "https://*.analytics.google.com"]));
    }
    expect(contentSecurityPolicy(DSN)).not.toMatch(/doubleclick|googleadservices|googlesyndication/);
  });

  /*
    Vercel Web Analytics loads /_vercel/insights/script.js and posts to
    /_vercel/insights/*, both on our own origin. 'self' must stay in both
    lists for that, and on the nonce pages the script is inserted by the
    nonced bundle, which only 'strict-dynamic' allows. Its development host
    must never reach the production policy.
  */
  it("covers Vercel Web Analytics with 'self' alone, on both policies", () => {
    const strict = directives(contentSecurityPolicy(DSN, "a".repeat(32)));
    for (const policy of [csp, strict]) {
      expect(policy["script-src"]).toContain("'self'");
      expect(policy["connect-src"]).toContain("'self'");
    }
    expect(strict["script-src"]).toContain("'strict-dynamic'");
    expect(contentSecurityPolicy(DSN)).not.toContain("vercel");
    expect(contentSecurityPolicy(DSN, "a".repeat(32))).not.toContain("vercel");
  });

  it("frames only the chat and YouTube's privacy-enhanced player host", () => {
    expect(csp["frame-src"]).toEqual(["'self'", "https://*.crisp.chat", "https://www.youtube-nocookie.com"]);
    // Not the cookie-setting host, and no script or connect exception for YouTube.
    expect(contentSecurityPolicy(DSN)).not.toContain("https://www.youtube.com");
    expect(csp["script-src"].join(" ")).not.toContain("youtube");
    expect(csp["connect-src"].join(" ")).not.toContain("youtube");
  });

  it("allows images from any HTTPS site, as audits and articles need", () => {
    expect(csp["img-src"]).toEqual(["'self'", "data:", "blob:", "https:"]);
  });

  it("refuses framing by other sites, plugins, and foreign forms or base URLs", () => {
    expect(csp["frame-ancestors"]).toEqual(["'self'"]);
    expect(csp["object-src"]).toEqual(["'none'"]);
    expect(csp["form-action"]).toEqual(["'self'"]);
    expect(csp["base-uri"]).toEqual(["'none'"]);
  });

  it("uses nonces without unsafe inline scripts on dynamic routes", () => {
    const strict = directives(contentSecurityPolicy(DSN, "a".repeat(32)));
    expect(strict["script-src"]).toContain(`'nonce-${"a".repeat(32)}'`);
    expect(strict["script-src"]).toContain("'strict-dynamic'");
    expect(strict["script-src"]).not.toContain("'unsafe-inline'");
    expect(strict["script-src-attr"]).toEqual(["'none'"]);
    expect(() => contentSecurityPolicy(DSN, "bad'; script-src *")).toThrow();
  });

  it("reports violations to the Sentry project in the DSN", () => {
    expect(csp["report-uri"]).toEqual([
      "https://o4501.ingest.de.sentry.io/api/4507/security/?sentry_key=abc123publickey",
    ]);
  });

  it("works without Sentry: no reporting endpoint, no Sentry origin", () => {
    const bare = directives(contentSecurityPolicy(undefined));
    expect(bare["report-uri"]).toBeUndefined();
    expect(bare["connect-src"]).toEqual([
      "'self'",
      "https://*.crisp.chat",
      "wss://*.relay.crisp.chat",
      "https://*.google-analytics.com",
      "https://*.analytics.google.com",
      "https://*.googletagmanager.com",
    ]);
  });
});

describe("cspReportUri", () => {
  it("ignores a malformed DSN instead of throwing into next.config", () => {
    expect(cspReportUri("not a url")).toBeNull();
    expect(cspReportUri("https://o1.ingest.sentry.io/")).toBeNull(); // no key, no project
    expect(cspReportUri("")).toBeNull();
  });
});
