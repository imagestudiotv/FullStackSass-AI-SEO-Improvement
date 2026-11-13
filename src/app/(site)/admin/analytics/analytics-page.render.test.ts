import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { SiteTraffic, SiteTrafficResult } from "@/lib/admin/site-traffic";

/**
 * The admin Site analytics page in each state, by what the owner reads:
 * the setup steps and what this deployment is missing, each kind of Google
 * refusal with its fix, no visits yet, and the report itself.
 */

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode; [key: string]: unknown }) =>
    createElement("a", { href, ...Object.fromEntries(Object.entries(rest).filter(([key]) => key !== "scroll")) }, children),
}));

import { change, duration } from "./figures";
import { TrafficRangePicker, TrafficView } from "./traffic-sections";

const render = (result: SiteTrafficResult) => renderToStaticMarkup(createElement(TrafficView, { result }));
/** Visible text, tags stripped and spaces collapsed, so assertions read like the page. */
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&gt;/g, ">").replace(/\s+/g, " ");

const EMAIL = "reader@repget-test.iam.gserviceaccount.com";
const DAYS = Array.from({ length: 7 }, (_, i) => `2026-10-0${i + 1}`);

function traffic(over: Partial<SiteTraffic> = {}): SiteTraffic {
  return {
    range: "7d",
    days: 7,
    propertyId: "123456789",
    timeZone: "Europe/Rome",
    window: { start: DAYS[0], end: DAYS[6] },
    current: { users: 1234, newUsers: 900, activeUsers: 1100, sessions: 1800, views: 5200, engagementRate: 0.543, engagementSeconds: 83 },
    previous: { users: 1000, newUsers: 1000, activeUsers: 900, sessions: 1800, views: 4000, engagementRate: 0.5, engagementSeconds: 0 },
    today: { users: 12, newUsers: 10, activeUsers: 12, sessions: 15, views: 40, engagementRate: 0.6, engagementSeconds: 50 },
    realtimeUsers: 3,
    daily: DAYS.map((day, i) => ({ day, users: 100 + i, sessions: 150 + i, views: 400 + i })),
    pages: [
      { path: "/", views: 2600, users: 800 },
      { path: "/pricing", views: 520, users: 300 },
    ],
    channels: [{ name: "Organic Search", sessions: 900, users: 700, engagementRate: 0.61 }],
    sources: [{ source: "google", medium: "organic", sessions: 880, users: 690 }],
    countries: [{ name: "Italy", users: 617 }],
    devices: [{ name: "desktop", users: 800 }],
    thresholded: false,
    ...over,
  };
}

describe("figures", () => {
  it("words the change against the previous period", () => {
    expect(change(1234, 1000)).toEqual({ kind: "up", text: "+23%" });
    expect(change(900, 1000)).toEqual({ kind: "down", text: "−10%" });
    expect(change(1800, 1800)).toEqual({ kind: "flat", text: "No change" });
    expect(change(5, 0)).toEqual({ kind: "new", text: "None in the previous period" });
    expect(change(0, 0)).toEqual({ kind: "none", text: "None in either period" });
    expect(change(250, 2)).toEqual({ kind: "up", text: "+12,400%" });
    expect(change(0.543, 0.5, { points: true })).toEqual({ kind: "up", text: "+4.3 pts" });
    expect(change(0.4, 0.5, { points: true })).toEqual({ kind: "down", text: "−10.0 pts" });
  });

  it("formats engagement time as Google Analytics does", () => {
    expect(duration(0)).toBe("0s");
    expect(duration(45.4)).toBe("45s");
    expect(duration(83)).toBe("1m 23s");
    expect(duration(65)).toBe("1m 05s");
    expect(duration(3725)).toBe("1h 02m");
  });
});

describe("setup", () => {
  it("lists the steps and what this deployment is missing", () => {
    const page = text(render({ status: "setup", setup: { state: "missing", missing: ["GA4_PROPERTY_ID", "GA4_SERVICE_ACCOUNT_KEY"], propertyId: null, clientEmail: null } }));
    expect(page).toContain("Connect Google Analytics");
    expect(page).toContain("Turn on the Google Analytics Data API");
    expect(page).toContain("Create a service account and a JSON key");
    expect(page).toContain("GA4_PROPERTY_ID Not set");
    expect(page).toContain("GA4_SERVICE_ACCOUNT_KEY Not set");
    expect(page).toContain("it ends in .iam.gserviceaccount.com");
  });

  it("names the service account to grant, and why a value is unusable", () => {
    const page = text(
      render({
        status: "setup",
        setup: { state: "invalid", variable: "GA4_PROPERTY_ID", reason: "This is a Measurement ID (G-...)", propertyId: null, clientEmail: EMAIL },
      }),
    );
    expect(page).toContain(`service account's address ( ${EMAIL} ), choose the Viewer role`);
    expect(page).toContain("GA4_PROPERTY_ID Not usable This is a Measurement ID (G-...)");
    expect(page).toContain(`GA4_SERVICE_ACCOUNT_KEY Set Service account ${EMAIL}`);
  });
});

describe("errors", () => {
  const error = (kind: Extract<SiteTrafficResult, { status: "error" }>["kind"], over: { enableUrl?: string | null; message?: string } = {}) =>
    render({ status: "error", kind, message: over.message ?? "Google's words", enableUrl: over.enableUrl ?? null, propertyId: "123456789", clientEmail: EMAIL });

  it.each([
    ["auth", "Google refused the service account key"],
    ["api_disabled", "The Google Analytics Data API is turned off"],
    ["no_access", "The service account cannot read property 123456789"],
    ["not_found", "Property 123456789 was not found"],
    ["rate_limited", "Google's request limit for this property was reached"],
    ["invalid_request", "Google rejected the report request"],
    ["unavailable", "Google Analytics did not answer"],
  ] as const)("%s says what is wrong and shows Google's message", (kind, title) => {
    const html = error(kind);
    expect(html).toContain('role="alert"');
    expect(text(html)).toContain(title);
    expect(text(html)).toContain("Google said: Google's words");
  });

  it("tells the owner which address to add as a Viewer", () => {
    expect(text(error("no_access"))).toContain(`add ${EMAIL} with the Viewer role`);
  });

  it("links to Google's own enable page, or the API's library page", () => {
    const own = "https://console.developers.google.com/apis/api/analyticsdata.googleapis.com/overview?project=42";
    expect(error("api_disabled", { enableUrl: own })).toContain(`href="${own}"`);
    expect(error("api_disabled")).toContain('href="https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com"');
  });

  it("escapes what Google says", () => {
    const html = error("unavailable", { message: "<img src=x onerror=alert(1)>" });
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });
});

describe("report", () => {
  it("shows the period's figures with their change, today apart, and the lists", () => {
    const page = text(render({ status: "ok", traffic: traffic() }));
    expect(page).toContain("Active users 3");
    expect(page).toContain("Users today 12");
    expect(page).toContain("Views today 40");
    expect(page).toContain("Last 7 days");
    expect(page).toContain("1 Oct – 7 Oct 2026, Europe/Rome time");
    expect(page).toContain("Users 1,234 +23% vs previous 7 days");
    expect(page).toContain("New users 900 −10% vs previous 7 days");
    expect(page).toContain("Sessions 1,800 No change vs previous 7 days");
    expect(page).toContain("Engagement rate 54.3% +4.3 pts vs previous 7 days");
    expect(page).toContain("Avg. engagement time 1m 23s None in the previous period");
    // Lists: name, figure, share of the period's total.
    expect(page).toContain("/ 2,600 50% 800");
    expect(page).toContain("/pricing 520 10% 300");
    expect(page).toContain("Organic Search 900 50% 61.0%");
    expect(page).toContain("google / organic 880 49%");
    expect(page).toContain("Italy 617 50%");
    expect(page).toContain("Desktop 800 65%");
    expect(page).toContain("Property 123456789");
    expect(page).not.toContain("withheld");
  });

  it("says when the realtime count failed instead of showing zero, and notes thresholding", () => {
    const page = text(render({ status: "ok", traffic: traffic({ realtimeUsers: null, thresholded: true }) }));
    expect(page).toContain("Active users Unavailable");
    expect(page).toContain("Google withheld some rows");
  });

  it("explains an empty period instead of drawing empty charts", () => {
    const zero = { users: 0, newUsers: 0, activeUsers: 0, sessions: 0, views: 0, engagementRate: 0, engagementSeconds: 0 };
    const html = render({ status: "ok", traffic: traffic({ current: zero, previous: zero, realtimeUsers: 2, pages: [], channels: [] }) });
    expect(text(html)).toContain("No visits recorded in the last 7 days");
    expect(text(html)).toContain("Active users 2");
    expect(html).not.toContain("<svg");
  });

  it("offers the three ranges, marking the current one", () => {
    const html = renderToStaticMarkup(createElement(TrafficRangePicker, { range: "7d" }));
    expect(html).toContain('href="/admin/analytics?range=7d" aria-current="true"');
    expect(html).toContain('href="/admin/analytics"');
    expect(html).toContain('href="/admin/analytics?range=90d"');
  });
});
