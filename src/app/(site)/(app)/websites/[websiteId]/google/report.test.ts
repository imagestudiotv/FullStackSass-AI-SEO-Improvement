import { randomUUID } from "node:crypto";

import { beforeAll, describe, expect, it, vi } from "vitest";

import { organization } from "@/lib/db/auth-tables";
import { gscMetrics, gscPageMetrics, siteDailyMetrics, websites } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";

/**
 * The Google page's figures (google/report.ts) on a disposable database:
 * the same totals and comparison rules as getPerformance, absent sources
 * reported as absent rather than zero, gaps in the daily series left as
 * gaps, and top tables in a stable order.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }) }));
vi.mock("@/lib/tenant", () => ({ requireWebsite: vi.fn(async (id: string) => ({ site: { id } })) }));
// getPerformance's module, loaded for the parity check only: none of its other dependencies is exercised.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/inngest/send", () => ({ queueJob: vi.fn() }));
vi.mock("@/lib/auth-guard", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/analytics/oauth-state", () => ({ createOAuthState: vi.fn() }));
vi.mock("@/lib/analytics/connection", () => ({ disconnect: vi.fn(), getConnection: vi.fn(), GOOGLE_KIND: "google_analytics" }));
vi.mock("@/lib/analytics/google-api", () => ({
  listAnalyticsProperties: vi.fn(),
  listSearchConsoleSites: vi.fn(),
  GoogleApiError: class extends Error {},
}));
vi.mock("@/lib/analytics/google-oauth", () => ({ authorizeUrl: vi.fn(), isGoogleConfigured: vi.fn() }));
vi.mock("@/lib/websites/require-editor", () => ({ requireEditor: vi.fn() }));

import { getPerformance } from "@/lib/analytics/actions";

import { loadGoogleReport, shiftDate } from "./report";
import { sourceState } from "./report-state";

let test: TestDb;
beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

const LAST = "2026-09-30";
const day = (offset: number) => shiftDate(LAST, -offset);

async function site() {
  const orgId = `org_${randomUUID().slice(0, 8)}`;
  await test.db.insert(organization).values({ id: orgId, name: "W", slug: orgId, createdAt: new Date() });
  const domain = `site-${randomUUID().slice(0, 6)}.test`;
  const [row] = await test.db.insert(websites).values({ organizationId: orgId, url: `https://${domain}`, domain, status: "ready" }).returning();
  return row.id;
}

type Daily = { gsc?: [clicks: number, impressions: number, position: number]; ga?: number };
async function days(websiteId: string, rows: Record<number, Daily>) {
  await test.db.insert(siteDailyMetrics).values(
    Object.entries(rows).map(([offset, r]) => ({
      websiteId,
      date: day(Number(offset)),
      gscClicks: r.gsc?.[0] ?? null,
      gscImpressions: r.gsc?.[1] ?? null,
      gscPosition: r.gsc?.[2] ?? null,
      gaSessions: r.ga ?? null,
      gaUsers: r.ga ?? null,
    })),
  );
}

/** offsets from..to inclusive, both sources, with figures that vary by day. */
function span(from: number, to: number, both = true): Record<number, Daily> {
  const out: Record<number, Daily> = {};
  for (let i = from; i <= to; i++) {
    out[i] = { gsc: [10 + (i % 7), 200 + i * 3, 4 + (i % 5) / 2], ...(both ? { ga: 50 + (i % 11) } : {}) };
  }
  return out;
}

describe("loadGoogleReport", () => {
  it("gives the same totals, position and comparison as getPerformance for 28 days", async () => {
    const id = await site();
    await days(id, span(0, 55));
    await test.db.insert(gscMetrics).values([
      { websiteId: id, date: day(1), pageUrl: "https://x.test/a", query: "wedding photographer", clicks: 30, impressions: 400, position: 3 },
      { websiteId: id, date: day(2), pageUrl: "https://x.test/b", query: "photo booth hire", clicks: 12, impressions: 100, position: 6 },
      { websiteId: id, date: day(40), pageUrl: "https://x.test/a", query: "old period only", clicks: 99, impressions: 999, position: 1 },
    ]);

    const [report, perf] = await Promise.all([loadGoogleReport(id, 28), getPerformance(id)]);

    expect(report.search.current.clicks).toBe(perf.clicks);
    expect(report.search.current.impressions).toBe(perf.impressions);
    expect(report.search.current.position).toBeCloseTo(perf.averagePosition!, 10);
    expect(report.analytics.sessions).toBe(perf.sessions);
    expect(report.hasData).toBe(perf.hasData);
    expect(report.search.previous?.clicks).toBe(perf.previous?.clicks);
    expect(report.search.previous?.impressions).toBe(perf.previous?.impressions);
    expect(report.search.previous?.position).toBeCloseTo(perf.previous!.averagePosition!, 10);
    expect(report.analytics.previousSessions).toBe(perf.previous?.sessions);
    expect(report.search.topQueries.map(({ query, clicks, impressions }) => ({ query, clicks, impressions }))).toEqual(perf.topQueries);
    expect(report.window).toEqual({ start: day(27), end: LAST, previousStart: day(55), previousEnd: day(28) });
    expect(report.search.current.ctr).toBeCloseTo(perf.clicks / perf.impressions, 10);
  });

  it("reports a source that never reported as absent - no days, no date, null days - never as zero", async () => {
    const id = await site();
    await days(id, span(0, 27, false)); // Search Console only
    const report = await loadGoogleReport(id, 28);

    expect(report.search.daysReported).toBe(28);
    expect(report.analytics).toMatchObject({ daysReported: 0, through: null, previousSessions: null });
    expect(report.analytics.series.every((p) => p.sessions === null)).toBe(true);
    // What the page then says about Analytics, depending on whether a property is chosen.
    expect(sourceState({ selected: false, through: report.analytics.through, daysReported: 0 }).state).toBe("notSelected");
    expect(sourceState({ selected: true, through: report.analytics.through, daysReported: 0 }).state).toBe("awaitingData");
  });

  it("keeps real zeros: a source that reported zero is ready, with zero totals and a known date", async () => {
    const id = await site();
    await days(id, { 0: { gsc: [0, 0, 0], ga: 0 }, 1: { gsc: [0, 0, 0], ga: 0 } });
    const report = await loadGoogleReport(id, 7);
    expect(report.search).toMatchObject({ daysReported: 2, through: LAST, current: { clicks: 0, impressions: 0, ctr: null, position: null } });
    expect(report.analytics).toMatchObject({ daysReported: 2, sessions: 0, through: LAST });
    expect(sourceState({ selected: true, through: LAST, daysReported: 2 }).state).toBe("ready");
    expect(report.analytics.series.slice(-2).map((p) => p.sessions)).toEqual([0, 0]);
  });

  it("leaves days that were not reported as null in the daily series, one point per day of the period", async () => {
    const id = await site();
    await days(id, { 0: { gsc: [5, 50, 3], ga: 9 }, 3: { gsc: [7, 70, 2] }, 6: { ga: 4 } });
    const report = await loadGoogleReport(id, 7);
    expect(report.search.series).toHaveLength(7);
    // Oldest first: offsets 6..0. Search Console reported offsets 3 and 0.
    expect(report.search.series.map((p) => p.clicks)).toEqual([null, null, null, 7, null, null, 5]);
    expect(report.search.series[0].day).toBe(day(6));
    expect(report.analytics.series.map((p) => p.sessions)).toEqual([4, null, null, null, null, null, 9]);
    expect(report.search.daysReported).toBe(2);
    expect(report.analytics.daysReported).toBe(2);
  });

  it("compares each source only when its whole previous period was reported", async () => {
    const id = await site();
    // Search Console for 14 full days; Analytics missing one day of the previous week.
    const rows = span(0, 13);
    delete rows[10].ga;
    await days(id, rows);
    const report = await loadGoogleReport(id, 7);
    expect(report.search.previous).not.toBeNull();
    expect(report.analytics.previousSessions).toBeNull();
    // And with no earlier rows at all, nothing is compared.
    const fresh = await site();
    await days(fresh, span(0, 6));
    const first = await loadGoogleReport(fresh, 7);
    expect(first.search.previous).toBeNull();
    expect(first.analytics.previousSessions).toBeNull();
  });

  it("ends the period on the newest stored day, and says when each source last reported", async () => {
    const id = await site();
    // Analytics is current; Search Console stopped 10 days earlier.
    await days(id, { 0: { ga: 3 }, 10: { gsc: [1, 10, 5] } });
    const report = await loadGoogleReport(id, 7);
    expect(report.window.end).toBe(LAST);
    expect(report.search).toMatchObject({ through: day(10), daysReported: 0 });
    expect(sourceState({ selected: true, through: report.search.through, daysReported: 0 }).state).toBe("noDataInPeriod");
    const longer = await loadGoogleReport(id, 28);
    expect(longer.search.daysReported).toBe(1);
  });

  it("orders top searches by clicks, then impressions, then name, with counts only", async () => {
    const id = await site();
    await days(id, span(0, 6));
    const queries = ["zeta", "alpha", "mid", "beta"];
    await test.db.insert(gscMetrics).values([
      ...queries.map((query) => ({ websiteId: id, date: day(1), pageUrl: "https://x.test/", query, clicks: 0, impressions: 10, position: 8 })),
      { websiteId: id, date: day(1), pageUrl: "https://x.test/", query: "seen more", clicks: 0, impressions: 50, position: 9 },
      { websiteId: id, date: day(1), pageUrl: "https://x.test/a", query: "top", clicks: 4, impressions: 100, position: 2 },
      { websiteId: id, date: day(2), pageUrl: "https://x.test/a", query: "top", clicks: 6, impressions: 300, position: 6 },
      // Google's anonymised rows carry no query and are left out.
      { websiteId: id, date: day(1), pageUrl: "https://x.test/a", query: null, clicks: 50, impressions: 500, position: 1 },
    ]);
    const report = await loadGoogleReport(id, 7);
    expect(report.search.topQueries.map((q) => q.query)).toEqual(["top", "seen more", "alpha", "beta", "mid", "zeta"]);
    // No CTR or position: the rows are split by page, so a search that showed two
    // pages counts twice at two positions and would not match Search Console.
    expect(report.search.topQueries[0]).toEqual({ query: "top", clicks: 10, impressions: 400 });
  });

  it("lists top pages from the page report, bounded to ten", async () => {
    const id = await site();
    await days(id, span(0, 6));
    await test.db.insert(gscPageMetrics).values(
      Array.from({ length: 12 }, (_, i) => ({ websiteId: id, date: day(1), pageUrl: `https://x.test/p${i}`, clicks: i, impressions: 100, position: 5 })),
    );
    const report = await loadGoogleReport(id, 7);
    expect(report.search.topPages).toHaveLength(10);
    expect(report.search.topPages[0]).toMatchObject({ pageUrl: "https://x.test/p11", clicks: 11, impressions: 100, position: 5 });
    expect(report.search.topPages[0].ctr).toBeCloseTo(0.11, 10);
  });

  it("refuses a period length the page never asks for", async () => {
    const id = await site();
    await expect(loadGoogleReport(id, Number.NaN)).rejects.toThrow(RangeError);
    await expect(loadGoogleReport(id, 0)).rejects.toThrow(RangeError);
  });
});
