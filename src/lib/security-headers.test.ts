import { describe, expect, it } from "vitest";

import { contentSecurityPolicy, cspReportUri, securityHeaders } from "./security-headers";

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

  it("ships the CSP as REPORT-ONLY, never enforcing", () => {
    expect(header(prod, "Content-Security-Policy-Report-Only")).toBeTruthy();
    expect(header(prod, "Content-Security-Policy")).toBeUndefined();
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

  it("allows scripts and styles from this site and Crisp only", () => {
    expect(csp["script-src"]).toEqual(["'self'", "'unsafe-inline'", "https://*.crisp.chat"]);
    expect(csp["style-src"]).toEqual(["'self'", "'unsafe-inline'", "https://*.crisp.chat"]);
  });

  it("never allows eval or arbitrary script hosts", () => {
    expect(csp["script-src"]).not.toContain("'unsafe-eval'");
    expect(csp["script-src"]).not.toContain("https:");
    expect(csp["script-src"]).not.toContain("*");
  });

  it("lets the chat talk to Crisp and errors reach Sentry", () => {
    expect(csp["connect-src"]).toEqual([
      "'self'",
      "https://*.crisp.chat",
      "wss://*.relay.crisp.chat",
      "https://o4501.ingest.de.sentry.io",
    ]);
  });

  it("allows images from any HTTPS site, as audits and articles need", () => {
    expect(csp["img-src"]).toEqual(["'self'", "data:", "blob:", "https:"]);
  });

  it("refuses framing by other sites, plugins, and foreign forms or base URLs", () => {
    expect(csp["frame-ancestors"]).toEqual(["'self'"]);
    expect(csp["object-src"]).toEqual(["'none'"]);
    expect(csp["form-action"]).toEqual(["'self'"]);
    expect(csp["base-uri"]).toEqual(["'self'"]);
  });

  it("reports violations to the Sentry project in the DSN", () => {
    expect(csp["report-uri"]).toEqual([
      "https://o4501.ingest.de.sentry.io/api/4507/security/?sentry_key=abc123publickey",
    ]);
  });

  it("works without Sentry: no reporting endpoint, no Sentry origin", () => {
    const bare = directives(contentSecurityPolicy(undefined));
    expect(bare["report-uri"]).toBeUndefined();
    expect(bare["connect-src"]).toEqual(["'self'", "https://*.crisp.chat", "wss://*.relay.crisp.chat"]);
  });
});

describe("cspReportUri", () => {
  it("ignores a malformed DSN instead of throwing into next.config", () => {
    expect(cspReportUri("not a url")).toBeNull();
    expect(cspReportUri("https://o1.ingest.sentry.io/")).toBeNull(); // no key, no project
    expect(cspReportUri("")).toBeNull();
  });
});
