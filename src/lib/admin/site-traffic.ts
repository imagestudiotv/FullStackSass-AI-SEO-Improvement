import "server-only";

import {
  Ga4Error,
  readGa4Setup,
  runGa4Realtime,
  runGa4Reports,
  type Ga4ErrorKind,
  type Ga4Report,
  type Ga4ReportRequest,
  type Ga4Setup,
} from "@/lib/admin/ga4";
import { requireAdmin } from "@/lib/admin/guard";

/**
 * Visits to RepGet's own website, from its Google Analytics 4 property, for
 * the admin Site analytics page. See lib/admin/ga4.ts for the connection.
 *
 * Periods follow Google Analytics' own reports so the figures match what the
 * owner sees there: "Last 30 days" is the 30 COMPLETE days ending yesterday,
 * in the property's time zone, compared with the 30 days before them. Today
 * is incomplete and is shown on its own, beside the realtime count.
 */

export const TRAFFIC_RANGES = { "7d": 7, "30d": 30, "90d": 90 } as const;
export type TrafficRange = keyof typeof TRAFFIC_RANGES;
export const DEFAULT_TRAFFIC_RANGE: TrafficRange = "30d";

export function parseTrafficRange(value: string | string[] | undefined): TrafficRange {
  const raw = Array.isArray(value) ? value[0] : value;
  // Own keys only: `in` would also accept "constructor" from the prototype.
  return raw && Object.hasOwn(TRAFFIC_RANGES, raw) ? (raw as TrafficRange) : DEFAULT_TRAFFIC_RANGE;
}

export type TrafficTotals = {
  users: number;
  newUsers: number;
  activeUsers: number;
  sessions: number;
  views: number;
  /** 0..1: the share of sessions that were engaged (GA's definition). */
  engagementRate: number;
  /** Average engagement time per active user, in seconds (GA's headline figure). */
  engagementSeconds: number;
};

export type TrafficDay = { day: string; users: number; sessions: number; views: number };

export type SiteTraffic = {
  range: TrafficRange;
  days: number;
  propertyId: string;
  timeZone: string;
  /** First and last day of the period (YYYY-MM-DD), inclusive. */
  window: { start: string; end: string };
  current: TrafficTotals;
  previous: TrafficTotals;
  /** Today so far, in the property's time zone. */
  today: TrafficTotals;
  /** Active in about the last 30 minutes. Null when only that query failed. */
  realtimeUsers: number | null;
  /** One row per day of the period, oldest first, zero-filled. */
  daily: TrafficDay[];
  pages: { path: string; views: number; users: number }[];
  channels: { name: string; sessions: number; users: number; engagementRate: number }[];
  sources: { source: string; medium: string; sessions: number; users: number }[];
  countries: { name: string; users: number }[];
  devices: { name: string; users: number }[];
  /** Google withheld some rows (thresholding). */
  thresholded: boolean;
};

/** Whatever the page should show: the figures, how to set up, or what failed. */
export type SiteTrafficResult =
  | { status: "ok"; traffic: SiteTraffic }
  | { status: "setup"; setup: Exclude<Ga4Setup, { state: "ready" }> }
  | {
      status: "error";
      kind: Ga4ErrorKind;
      message: string;
      enableUrl: string | null;
      propertyId: string;
      clientEmail: string;
    };

const TOP_ROWS = 10;

const TOTAL_METRICS = [
  "totalUsers",
  "newUsers",
  "activeUsers",
  "sessions",
  "screenPageViews",
  "engagementRate",
  "userEngagementDuration",
] as const;

/** The reports behind the page, in the order buildSiteTraffic reads them. */
export function trafficRequests(days: number): Ga4ReportRequest[] {
  const current = { startDate: `${days}daysAgo`, endDate: "yesterday", name: "current" };
  const period = [{ startDate: current.startDate, endDate: current.endDate }];
  return [
    {
      dateRanges: [
        current,
        { startDate: `${days * 2}daysAgo`, endDate: `${days + 1}daysAgo`, name: "previous" },
        { startDate: "today", endDate: "today", name: "today" },
      ],
      metrics: [...TOTAL_METRICS],
    },
    {
      dateRanges: period,
      dimensions: ["date"],
      metrics: ["totalUsers", "sessions", "screenPageViews"],
      orderBy: { dimension: "date" },
      limit: days + 5,
    },
    {
      dateRanges: period,
      dimensions: ["pagePath"],
      metrics: ["screenPageViews", "totalUsers"],
      orderBy: { metric: "screenPageViews" },
      limit: TOP_ROWS,
    },
    {
      dateRanges: period,
      dimensions: ["sessionDefaultChannelGroup"],
      metrics: ["sessions", "totalUsers", "engagementRate"],
      orderBy: { metric: "sessions" },
      limit: TOP_ROWS,
    },
    {
      dateRanges: period,
      dimensions: ["sessionSource", "sessionMedium"],
      metrics: ["sessions", "totalUsers"],
      orderBy: { metric: "sessions" },
      limit: TOP_ROWS,
    },
    {
      dateRanges: period,
      dimensions: ["country"],
      metrics: ["totalUsers"],
      orderBy: { metric: "totalUsers" },
      limit: TOP_ROWS,
    },
    {
      dateRanges: period,
      dimensions: ["deviceCategory"],
      metrics: ["totalUsers"],
      orderBy: { metric: "totalUsers" },
      limit: 5,
    },
  ];
}

const EMPTY: TrafficTotals = {
  users: 0,
  newUsers: 0,
  activeUsers: 0,
  sessions: 0,
  views: 0,
  engagementRate: 0,
  engagementSeconds: 0,
};

function totalsFor(report: Ga4Report, name: string): TrafficTotals {
  // A range with no visits at all has no row.
  const row = report.rows.find((r) => r.dimensions.dateRange === name);
  if (!row) return EMPTY;
  const m = row.metrics;
  const activeUsers = m.activeUsers ?? 0;
  return {
    users: m.totalUsers ?? 0,
    newUsers: m.newUsers ?? 0,
    activeUsers,
    sessions: m.sessions ?? 0,
    views: m.screenPageViews ?? 0,
    engagementRate: m.engagementRate ?? 0,
    engagementSeconds: activeUsers > 0 ? (m.userEngagementDuration ?? 0) / activeUsers : 0,
  };
}

/** YYYY-MM-DD for an instant, in an IANA zone (UTC when the zone is unknown). */
export function dayInZone(instant: Date, timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(instant);
    const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
    return `${get("year")}-${get("month")}-${get("day")}`;
  } catch {
    return instant.toISOString().slice(0, 10);
  }
}

function addDays(day: string, delta: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

/** GA's "20261007" as "2026-10-07"; anything else as null. */
function gaDate(value: string): string | null {
  return /^\d{8}$/.test(value) ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}` : null;
}

/**
 * Shapes the reports from trafficRequests (same order) into the page's
 * figures. `now` and the zone decide which days the period covers, so the
 * chart has a point for every day even when Google sent no row for it.
 */
export function buildSiteTraffic(input: {
  range: TrafficRange;
  propertyId: string;
  reports: Ga4Report[];
  realtimeUsers: number | null;
  now: Date;
}): SiteTraffic {
  const days = TRAFFIC_RANGES[input.range];
  const [totals, daily, pages, channels, sources, countries, devices] = input.reports;
  const timeZone = input.reports.find((report) => report.timeZone)?.timeZone ?? "UTC";

  const end = addDays(dayInZone(input.now, timeZone), -1);
  const start = addDays(end, -(days - 1));

  const byDay = new Map<string, TrafficDay>();
  for (const row of daily.rows) {
    const day = gaDate(row.dimensions.date ?? "");
    if (!day) continue;
    byDay.set(day, {
      day,
      users: row.metrics.totalUsers ?? 0,
      sessions: row.metrics.sessions ?? 0,
      views: row.metrics.screenPageViews ?? 0,
    });
  }

  return {
    range: input.range,
    days,
    propertyId: input.propertyId,
    timeZone,
    window: { start, end },
    current: totalsFor(totals, "current"),
    previous: totalsFor(totals, "previous"),
    today: totalsFor(totals, "today"),
    realtimeUsers: input.realtimeUsers,
    daily: Array.from({ length: days }, (_, i) => {
      const day = addDays(start, i);
      return byDay.get(day) ?? { day, users: 0, sessions: 0, views: 0 };
    }),
    pages: pages.rows.map((row) => ({
      path: row.dimensions.pagePath || "(not set)",
      views: row.metrics.screenPageViews ?? 0,
      users: row.metrics.totalUsers ?? 0,
    })),
    channels: channels.rows.map((row) => ({
      name: row.dimensions.sessionDefaultChannelGroup || "(not set)",
      sessions: row.metrics.sessions ?? 0,
      users: row.metrics.totalUsers ?? 0,
      engagementRate: row.metrics.engagementRate ?? 0,
    })),
    sources: sources.rows.map((row) => ({
      source: row.dimensions.sessionSource || "(not set)",
      medium: row.dimensions.sessionMedium || "(not set)",
      sessions: row.metrics.sessions ?? 0,
      users: row.metrics.totalUsers ?? 0,
    })),
    countries: countries.rows.map((row) => ({
      name: row.dimensions.country || "(not set)",
      users: row.metrics.totalUsers ?? 0,
    })),
    devices: devices.rows.map((row) => ({
      name: row.dimensions.deviceCategory || "(not set)",
      users: row.metrics.totalUsers ?? 0,
    })),
    thresholded: input.reports.some((report) => report.thresholded),
  };
}

/**
 * The admin page's data. Admins only - checked here as well as in the
 * layout, because a layout guard alone is not an authorization boundary.
 */
export async function getSiteTraffic(range: TrafficRange): Promise<SiteTrafficResult> {
  await requireAdmin();

  const setup = readGa4Setup();
  if (setup.state !== "ready") return { status: "setup", setup };
  const { config } = setup;

  try {
    const [reports, realtime] = await Promise.all([
      runGa4Reports(config, trafficRequests(TRAFFIC_RANGES[range])),
      // The realtime count is a nice-to-have: its failure must not hide the rest.
      runGa4Realtime(config, ["activeUsers"]).then(
        (report) => report.rows[0]?.metrics.activeUsers ?? 0,
        (error: unknown) => {
          console.error("[admin/analytics] realtime report failed", error);
          return null;
        },
      ),
    ]);
    return {
      status: "ok",
      traffic: buildSiteTraffic({ range, propertyId: config.propertyId, reports, realtimeUsers: realtime, now: new Date() }),
    };
  } catch (error) {
    console.error("[admin/analytics] Google Analytics report failed", error);
    const known = error instanceof Ga4Error ? error : null;
    return {
      status: "error",
      kind: known?.kind ?? "unavailable",
      message: known?.message ?? "Unexpected error while reading Google Analytics.",
      enableUrl: known?.enableUrl ?? null,
      propertyId: config.propertyId,
      clientEmail: config.clientEmail,
    };
  }
}
