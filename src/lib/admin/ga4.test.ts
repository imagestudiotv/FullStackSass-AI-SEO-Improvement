import { createVerify, generateKeyPairSync } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearGa4TokenCache,
  dataApiError,
  Ga4Error,
  parseReport,
  readGa4Setup,
  runGa4Realtime,
  runGa4Reports,
  signedAssertion,
  type Ga4Config,
} from "@/lib/admin/ga4";

/**
 * The GA4 reader behind the admin Site analytics page: what it accepts as
 * configuration, the token it signs, what it sends Google, and how Google's
 * refusals are told apart so the page can say what to fix.
 *
 * Keys are generated per run - a PEM in the repository would trip
 * check:secrets, and would be a real key in the history forever.
 */

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});

const EMAIL = "repget-analytics@repget-test.iam.gserviceaccount.com";
const keyFile = (over: Record<string, unknown> = {}) =>
  JSON.stringify({ type: "service_account", project_id: "repget-test", client_email: EMAIL, private_key: privateKey, ...over }, null, 2);

const config: Ga4Config = { propertyId: "123456789", clientEmail: EMAIL, privateKey };

describe("readGa4Setup", () => {
  it("reports both variables missing when neither is set", () => {
    expect(readGa4Setup({})).toEqual({
      state: "missing",
      missing: ["GA4_PROPERTY_ID", "GA4_SERVICE_ACCOUNT_KEY"],
      propertyId: null,
      clientEmail: null,
    });
  });

  it("is ready with the property number and the downloaded JSON file", () => {
    const setup = readGa4Setup({ GA4_PROPERTY_ID: " 123456789 ", GA4_SERVICE_ACCOUNT_KEY: keyFile() });
    expect(setup).toEqual({ state: "ready", config });
  });

  it("accepts properties/<n>, a base64 key, and line breaks escaped twice", () => {
    const escaped = keyFile({ private_key: privateKey.replace(/\n/g, "\\n") });
    expect(escaped).toContain("\\\\n");
    const setup = readGa4Setup({
      GA4_PROPERTY_ID: "properties/987654321",
      GA4_SERVICE_ACCOUNT_KEY: Buffer.from(escaped).toString("base64"),
    });
    expect(setup.state).toBe("ready");
    if (setup.state === "ready") {
      expect(setup.config.propertyId).toBe("987654321");
      expect(setup.config.privateKey).toBe(privateKey);
    }
  });

  it("says a G- Measurement ID is the wrong number", () => {
    const setup = readGa4Setup({ GA4_PROPERTY_ID: "G-ABC123XYZ", GA4_SERVICE_ACCOUNT_KEY: keyFile() });
    expect(setup).toMatchObject({ state: "invalid", variable: "GA4_PROPERTY_ID", clientEmail: EMAIL });
    expect(setup.state === "invalid" && setup.reason).toMatch(/Measurement ID/);
  });

  it.each([
    ["not JSON", "hello", /Not a JSON key/],
    ["an OAuth client file", JSON.stringify({ type: "authorized_user", client_id: "x" }), /service account/],
    ["no private key", keyFile({ private_key: undefined }), /no private_key/],
    // The real key's frame around a body cut short (a literal PEM header here would trip check:secrets).
    ["a damaged key", keyFile({ private_key: privateKey.replace(/\n[A-Za-z0-9+/=\n]+\n(?=-)/, "\nAAAA\n") }), /damaged/],
  ])("explains a key that is %s", (_label, value, reason) => {
    const setup = readGa4Setup({ GA4_PROPERTY_ID: "123456789", GA4_SERVICE_ACCOUNT_KEY: value });
    expect(setup).toMatchObject({ state: "invalid", variable: "GA4_SERVICE_ACCOUNT_KEY", propertyId: "123456789" });
    expect(setup.state === "invalid" && setup.reason).toMatch(reason);
  });

  it("never puts the private key in what it reports", () => {
    for (const env of [
      { GA4_SERVICE_ACCOUNT_KEY: keyFile() },
      { GA4_PROPERTY_ID: "nope", GA4_SERVICE_ACCOUNT_KEY: keyFile() },
    ]) {
      const setup = readGa4Setup(env);
      expect(setup.state).not.toBe("ready");
      expect(JSON.stringify(setup)).not.toContain("PRIVATE KEY");
    }
  });
});

describe("signedAssertion", () => {
  it("is an RS256 JWT for the read-only scope, valid for an hour, signed by the key", () => {
    const jwt = signedAssertion(config, 1_700_000_000);
    const [header, claims, signature] = jwt.split(".");
    expect(JSON.parse(Buffer.from(header, "base64url").toString())).toEqual({ alg: "RS256", typ: "JWT" });
    expect(JSON.parse(Buffer.from(claims, "base64url").toString())).toEqual({
      iss: EMAIL,
      scope: "https://www.googleapis.com/auth/analytics.readonly",
      aud: "https://oauth2.googleapis.com/token",
      iat: 1_700_000_000,
      exp: 1_700_003_600,
    });
    const valid = createVerify("RSA-SHA256").update(`${header}.${claims}`).verify(publicKey, Buffer.from(signature, "base64url"));
    expect(valid).toBe(true);
  });
});

describe("dataApiError", () => {
  it("recognises a disabled API and keeps Google's console link", () => {
    const error = dataApiError(403, {
      error: {
        status: "PERMISSION_DENIED",
        message: "Google Analytics Data API has not been used in project 42 before or it is disabled.",
        details: [
          {
            reason: "SERVICE_DISABLED",
            metadata: { activationUrl: "https://console.developers.google.com/apis/api/analyticsdata.googleapis.com/overview?project=42" },
          },
        ],
      },
    });
    expect(error.kind).toBe("api_disabled");
    expect(error.enableUrl).toBe("https://console.developers.google.com/apis/api/analyticsdata.googleapis.com/overview?project=42");
  });

  it("finds the link in the message when the details have none, and offers no other host", () => {
    const fromMessage = dataApiError(403, {
      error: {
        message:
          "Google Analytics Data API has not been used in project 42 before or it is disabled. Enable it by visiting https://console.developers.google.com/apis/api/analyticsdata.googleapis.com/overview?project=42 then retry.",
      },
    });
    expect(fromMessage.enableUrl).toBe("https://console.developers.google.com/apis/api/analyticsdata.googleapis.com/overview?project=42");

    const elsewhere = dataApiError(403, {
      error: { message: "API is disabled", details: [{ reason: "SERVICE_DISABLED", metadata: { activationUrl: "https://evil.example/enable" } }] },
    });
    expect(elsewhere.kind).toBe("api_disabled");
    expect(elsewhere.enableUrl).toBeUndefined();
  });

  it.each([
    [401, "auth"],
    [403, "no_access"],
    [404, "not_found"],
    [429, "rate_limited"],
    [400, "invalid_request"],
    [500, "unavailable"],
    [503, "unavailable"],
  ] as const)("maps HTTP %i to %s", (status, kind) => {
    expect(dataApiError(status, { error: { message: "x" } }).kind).toBe(kind);
    expect(dataApiError(status, null).message).toBe(`HTTP ${status}`);
  });
});

describe("parseReport", () => {
  it("reads values by header name, not by position", () => {
    const report = parseReport({
      dimensionHeaders: [{ name: "country" }, { name: "dateRange" }],
      metricHeaders: [{ name: "sessions" }, { name: "totalUsers" }],
      rows: [{ dimensionValues: [{ value: "Italy" }, { value: "current" }], metricValues: [{ value: "12" }, { value: "not-a-number" }] }],
      metadata: { timeZone: "Europe/Rome", subjectToThresholding: true },
    });
    expect(report).toEqual({
      rows: [{ dimensions: { country: "Italy", dateRange: "current" }, metrics: { sessions: 12, totalUsers: 0 } }],
      timeZone: "Europe/Rome",
      thresholded: true,
    });
    expect(parseReport({})).toEqual({ rows: [], timeZone: null, thresholded: false });
  });
});

describe("runGa4Reports / runGa4Realtime", () => {
  type Call = { url: string; init: RequestInit };
  let calls: Call[];
  let handler: (url: string, init: RequestInit) => Response;

  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const tokenOk = (token = "token-1") => json({ access_token: token, expires_in: 3600, token_type: "Bearer" });
  const emptyReport = { dimensionHeaders: [], metricHeaders: [{ name: "sessions" }], rows: [{ metricValues: [{ value: "1" }] }] };

  beforeEach(() => {
    clearGa4TokenCache();
    calls = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL, init: RequestInit = {}) => {
        const url = String(input);
        calls.push({ url, init });
        return handler(url, init);
      }),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const request = (n: number) => ({
    dateRanges: [{ startDate: "30daysAgo", endDate: "yesterday" }],
    dimensions: ["pagePath"],
    metrics: ["screenPageViews"],
    orderBy: { metric: "screenPageViews" },
    limit: n,
  });

  it("trades a signed assertion for a token, then batches five reports per call in order", async () => {
    handler = (url, init) => {
      if (url === "https://oauth2.googleapis.com/token") return tokenOk();
      const body = JSON.parse(String(init.body)) as { requests: { limit: string }[] };
      return json({
        reports: body.requests.map((r) => ({
          dimensionHeaders: [{ name: "pagePath" }],
          metricHeaders: [{ name: "screenPageViews" }],
          rows: [{ dimensionValues: [{ value: `/limit-${r.limit}` }], metricValues: [{ value: r.limit }] }],
        })),
      });
    };

    const reports = await runGa4Reports(config, Array.from({ length: 7 }, (_, i) => request(i + 1)));

    // In request order, across both batches.
    expect(reports.map((r) => r.rows[0].dimensions.pagePath)).toEqual(["/limit-1", "/limit-2", "/limit-3", "/limit-4", "/limit-5", "/limit-6", "/limit-7"]);

    const token = calls.filter((c) => c.url.includes("oauth2"));
    // Both batches start together, and share one token request.
    expect(token).toHaveLength(1);
    const form = new URLSearchParams(String(token[0].init.body));
    expect(form.get("grant_type")).toBe("urn:ietf:params:oauth:grant-type:jwt-bearer");
    expect(form.get("assertion")?.split(".")).toHaveLength(3);

    const batches = calls.filter((c) => c.url.includes("analyticsdata"));
    expect(batches.map((c) => c.url)).toEqual([
      "https://analyticsdata.googleapis.com/v1beta/properties/123456789:batchRunReports",
      "https://analyticsdata.googleapis.com/v1beta/properties/123456789:batchRunReports",
    ]);
    expect(new Headers(batches[0].init.headers).get("authorization")).toBe("Bearer token-1");
    const first = JSON.parse(String(batches[0].init.body)) as { requests: unknown[] };
    expect(first.requests).toHaveLength(5);
    expect(first.requests[0]).toEqual({
      dateRanges: [{ startDate: "30daysAgo", endDate: "yesterday" }],
      dimensions: [{ name: "pagePath" }],
      metrics: [{ name: "screenPageViews" }],
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
      limit: "1",
    });
    expect((JSON.parse(String(batches[1].init.body)) as { requests: unknown[] }).requests).toHaveLength(2);
  });

  it("reuses the token, and on a 401 fetches a new one and retries once", async () => {
    let tokenCount = 0;
    let rejectNext = false;
    handler = (url, init) => {
      if (url.includes("oauth2")) return tokenOk(`token-${++tokenCount}`);
      if (rejectNext && new Headers(init.headers).get("authorization") === "Bearer token-1") {
        return json({ error: { code: 401, message: "Request had invalid authentication credentials." } }, 401);
      }
      return json({ reports: [emptyReport] });
    };

    await runGa4Reports(config, [request(1)]);
    await runGa4Reports(config, [request(1)]);
    expect(tokenCount).toBe(1);

    rejectNext = true;
    const [report] = await runGa4Reports(config, [request(1)]);
    expect(report.rows[0].metrics.sessions).toBe(1);
    expect(tokenCount).toBe(2);
  });

  it("reports a refused key as auth, with Google's reason", async () => {
    handler = () => json({ error: "invalid_grant", error_description: "Invalid JWT Signature." }, 400);
    const error = await runGa4Reports(config, [request(1)]).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Ga4Error);
    expect(error).toMatchObject({ kind: "auth", message: expect.stringContaining("Invalid JWT Signature.") });
  });

  it("passes a property permission error through as no_access", async () => {
    handler = (url) =>
      url.includes("oauth2")
        ? tokenOk()
        : json({ error: { code: 403, status: "PERMISSION_DENIED", message: "User does not have sufficient permissions for this property." } }, 403);
    await expect(runGa4Reports(config, [request(1)])).rejects.toMatchObject({ kind: "no_access" });
  });

  it("refuses an answer with a different number of reports", async () => {
    handler = (url) => (url.includes("oauth2") ? tokenOk() : json({ reports: [emptyReport] }));
    await expect(runGa4Reports(config, [request(1), request(2)])).rejects.toMatchObject({ kind: "unavailable" });
  });

  it("asks the realtime endpoint for the metrics given", async () => {
    handler = (url) =>
      url.includes("oauth2")
        ? tokenOk()
        : json({ metricHeaders: [{ name: "activeUsers" }], rows: [{ metricValues: [{ value: "7" }] }] });
    const report = await runGa4Realtime(config, ["activeUsers"]);
    expect(report.rows[0].metrics.activeUsers).toBe(7);
    const call = calls.find((c) => c.url.includes("analyticsdata"))!;
    expect(call.url).toBe("https://analyticsdata.googleapis.com/v1beta/properties/123456789:runRealtimeReport");
    expect(JSON.parse(String(call.init.body))).toEqual({ metrics: [{ name: "activeUsers" }] });
  });
});
