import { generateKeyPairSync } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The admin Site analytics data: admins only, the periods it asks Google
 * for, and how the answers become the page's figures - including the days
 * Google sends no row for, and the property's own time zone.
 */

const state = vi.hoisted(() => ({ session: null as unknown }));
vi.mock("@/lib/auth-guard", () => ({ getSession: async () => state.session }));

import { clearGa4TokenCache, type Ga4Report } from "@/lib/admin/ga4";
import { NotAdminError } from "@/lib/admin/guard";
import { buildSiteTraffic, dayInZone, getSiteTraffic, parseTrafficRange, trafficRequests } from "@/lib/admin/site-traffic";

const ADMIN = "owner@traffic.test";
const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});
const EMAIL = "reader@repget-test.iam.gserviceaccount.com";

const report = (rows: Ga4Report["rows"], timeZone: string | null = "Europe/Rome", thresholded = false): Ga4Report => ({
  rows,
  timeZone,
  thresholded,
});
const row = (dimensions: Record<string, string>, metrics: Record<string, number>) => ({ dimensions, metrics });

describe("parseTrafficRange", () => {
  it("accepts the three ranges and falls back to 30 days", () => {
    expect(parseTrafficRange("7d")).toBe("7d");
    expect(parseTrafficRange(["90d", "7d"])).toBe("90d");
    expect(parseTrafficRange(undefined)).toBe("30d");
    expect(parseTrafficRange("constructor")).toBe("30d");
    expect(parseTrafficRange("365d")).toBe("30d");
  });
});

describe("trafficRequests", () => {
  it("compares complete days ending yesterday with the same number before, and asks for today apart", () => {
    const [totals, daily, ...lists] = trafficRequests(30);
    expect(totals.dateRanges).toEqual([
      { startDate: "30daysAgo", endDate: "yesterday", name: "current" },
      { startDate: "60daysAgo", endDate: "31daysAgo", name: "previous" },
      { startDate: "today", endDate: "today", name: "today" },
    ]);
    expect(totals.dimensions).toBeUndefined();
    expect(daily).toMatchObject({ dimensions: ["date"], orderBy: { dimension: "date" } });
    // Every list covers the period only, never today's partial day.
    for (const request of [daily, ...lists]) {
      expect(request.dateRanges).toEqual([{ startDate: "30daysAgo", endDate: "yesterday" }]);
    }
    expect(lists.map((r) => r.dimensions)).toEqual([
      ["pagePath"],
      ["sessionDefaultChannelGroup"],
      ["sessionSource", "sessionMedium"],
      ["country"],
      ["deviceCategory"],
    ]);
  });
});

describe("dayInZone", () => {
  it("reads the calendar day in the property's zone, and UTC for an unknown zone", () => {
    const instant = new Date("2026-10-08T02:30:00Z");
    expect(dayInZone(instant, "Europe/Rome")).toBe("2026-10-08");
    expect(dayInZone(instant, "America/Los_Angeles")).toBe("2026-10-07");
    expect(dayInZone(instant, "Not/AZone")).toBe("2026-10-08");
  });
});

describe("buildSiteTraffic", () => {
  const reports = (timeZone: string | null = "Europe/Rome"): Ga4Report[] => [
    report(
      [
        row({ dateRange: "current" }, { totalUsers: 120, newUsers: 90, activeUsers: 100, sessions: 150, screenPageViews: 400, engagementRate: 0.55, userEngagementDuration: 6000 }),
        row({ dateRange: "today" }, { totalUsers: 4, newUsers: 3, activeUsers: 4, sessions: 5, screenPageViews: 9, engagementRate: 0.6, userEngagementDuration: 80 }),
        // No "previous" row: the property had no visits then.
      ],
      timeZone,
    ),
    report([row({ date: "20261001" }, { totalUsers: 10, sessions: 12, screenPageViews: 30 }), row({ date: "20261006" }, { totalUsers: 5, sessions: 6, screenPageViews: 11 }), row({ date: "garbage" }, { totalUsers: 99 })], timeZone),
    report([row({ pagePath: "/" }, { screenPageViews: 200, totalUsers: 80 }), row({ pagePath: "" }, { screenPageViews: 1, totalUsers: 1 })], timeZone),
    report([row({ sessionDefaultChannelGroup: "Organic Search" }, { sessions: 90, totalUsers: 70, engagementRate: 0.6 })], timeZone),
    report([row({ sessionSource: "google", sessionMedium: "organic" }, { sessions: 88, totalUsers: 69 })], timeZone),
    report([row({ country: "Italy" }, { totalUsers: 60 })], timeZone),
    report([row({ deviceCategory: "desktop" }, { totalUsers: 70 })], timeZone, true),
  ];

  it("totals each period, zero-fills the days Google skipped, and ends the period yesterday in the property's zone", () => {
    const traffic = buildSiteTraffic({
      range: "7d",
      propertyId: "123456789",
      reports: reports(),
      realtimeUsers: 3,
      // 23:30 UTC on the 6th is already the 7th in Rome.
      now: new Date("2026-10-06T23:30:00Z"),
    });

    expect(traffic.timeZone).toBe("Europe/Rome");
    expect(traffic.window).toEqual({ start: "2026-09-30", end: "2026-10-06" });
    expect(traffic.daily.map((d) => d.day)).toEqual(["2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06"]);
    expect(traffic.daily.map((d) => d.users)).toEqual([0, 10, 0, 0, 0, 0, 5]);
    expect(traffic.daily[1]).toEqual({ day: "2026-10-01", users: 10, sessions: 12, views: 30 });

    expect(traffic.current).toEqual({ users: 120, newUsers: 90, activeUsers: 100, sessions: 150, views: 400, engagementRate: 0.55, engagementSeconds: 60 });
    expect(traffic.previous).toEqual({ users: 0, newUsers: 0, activeUsers: 0, sessions: 0, views: 0, engagementRate: 0, engagementSeconds: 0 });
    expect(traffic.today.views).toBe(9);
    expect(traffic.realtimeUsers).toBe(3);

    expect(traffic.pages).toEqual([
      { path: "/", views: 200, users: 80 },
      { path: "(not set)", views: 1, users: 1 },
    ]);
    expect(traffic.channels[0]).toEqual({ name: "Organic Search", sessions: 90, users: 70, engagementRate: 0.6 });
    expect(traffic.sources[0]).toEqual({ source: "google", medium: "organic", sessions: 88, users: 69 });
    expect(traffic.countries).toEqual([{ name: "Italy", users: 60 }]);
    expect(traffic.devices).toEqual([{ name: "desktop", users: 70 }]);
    expect(traffic.thresholded).toBe(true);
  });

  it("falls back to UTC when Google names no zone", () => {
    const traffic = buildSiteTraffic({ range: "7d", propertyId: "1", reports: reports(null), realtimeUsers: null, now: new Date("2026-10-06T23:30:00Z") });
    expect(traffic.timeZone).toBe("UTC");
    expect(traffic.window.end).toBe("2026-10-05");
  });
});

describe("getSiteTraffic", () => {
  let handler: (url: string, init: RequestInit) => Response;
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

  beforeEach(() => {
    clearGa4TokenCache();
    vi.stubEnv("ADMIN_EMAILS", ADMIN);
    vi.stubEnv("GA4_PROPERTY_ID", "123456789");
    vi.stubEnv("GA4_SERVICE_ACCOUNT_KEY", JSON.stringify({ type: "service_account", client_email: EMAIL, private_key: privateKey }));
    state.session = { user: { id: "u1", email: ADMIN, emailVerified: true }, session: { id: "s" } };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL, init: RequestInit = {}) => handler(String(input), init)),
    );
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  /** Google answering every report with nothing but headers, and realtime with `active`. */
  const google = (active: number | "fail") => (url: string, init: RequestInit) => {
    if (url.includes("oauth2")) return json({ access_token: "t", expires_in: 3600 });
    if (url.endsWith(":runRealtimeReport")) {
      return active === "fail"
        ? json({ error: { message: "backend error" } }, 500)
        : json({ metricHeaders: [{ name: "activeUsers" }], rows: [{ metricValues: [{ value: String(active) }] }] });
    }
    const { requests } = JSON.parse(String(init.body)) as { requests: { metrics: { name: string }[] }[] };
    return json({
      reports: requests.map((r) => ({ metricHeaders: r.metrics, rows: [], metadata: { timeZone: "Europe/Rome" } })),
    });
  };

  it("refuses anyone who is not a verified administrator", async () => {
    handler = google(1);
    state.session = { user: { id: "u2", email: "someone@else.test", emailVerified: true }, session: { id: "s" } };
    await expect(getSiteTraffic("30d")).rejects.toBeInstanceOf(NotAdminError);
    state.session = { user: { id: "u1", email: ADMIN, emailVerified: false }, session: { id: "s" } };
    await expect(getSiteTraffic("30d")).rejects.toBeInstanceOf(NotAdminError);
  });

  it("returns the setup state, without calling Google, until both variables are set", async () => {
    handler = () => {
      throw new Error("Google must not be called");
    };
    vi.stubEnv("GA4_SERVICE_ACCOUNT_KEY", "");
    const result = await getSiteTraffic("30d");
    expect(result).toEqual({
      status: "setup",
      setup: { state: "missing", missing: ["GA4_SERVICE_ACCOUNT_KEY"], propertyId: "123456789", clientEmail: null },
    });
  });

  it("returns the figures, with the realtime count", async () => {
    handler = google(4);
    const result = await getSiteTraffic("7d");
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.traffic.realtimeUsers).toBe(4);
    expect(result.traffic.daily).toHaveLength(7);
    expect(result.traffic.propertyId).toBe("123456789");
  });

  it("still shows the report when only the realtime count fails", async () => {
    handler = google("fail");
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await getSiteTraffic("30d");
    expect(result.status).toBe("ok");
    expect(result.status === "ok" && result.traffic.realtimeUsers).toBeNull();
    error.mockRestore();
  });

  it("says what Google refused, naming the property and the service account", async () => {
    handler = (url) =>
      url.includes("oauth2")
        ? json({ access_token: "t", expires_in: 3600 })
        : json({ error: { code: 403, message: "User does not have sufficient permissions for this property." } }, 403);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await getSiteTraffic("30d");
    error.mockRestore();
    expect(result).toEqual({
      status: "error",
      kind: "no_access",
      message: "User does not have sufficient permissions for this property.",
      enableUrl: null,
      propertyId: "123456789",
      clientEmail: EMAIL,
    });
  });
});
