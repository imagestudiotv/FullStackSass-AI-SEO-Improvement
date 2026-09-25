"use server";

import { and, desc, eq, gte, lte, sql as raw } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { queueJob } from "@/inngest/send";
import {
  signState,
  type ConnectOrigin,
} from "@/app/api/integrations/google/callback/route";
import {
  disconnect,
  getConnection,
  GOOGLE_KIND,
  type GoogleMeta,
} from "@/lib/analytics/connection";
import {
  listAnalyticsProperties,
  listSearchConsoleSites,
  GoogleApiError,
} from "@/lib/analytics/google-api";
import { authorizeUrl, isGoogleConfigured } from "@/lib/analytics/google-oauth";
import { db } from "@/lib/db";
import {
  gscMetrics,
  integrations,
  siteDailyMetrics,
} from "@/lib/db/schema";
import { requireWebsite } from "@/lib/tenant";
import { requireEditor } from "@/lib/websites/require-editor";
import type { ActionResult } from "@/lib/websites/actions";

/**
 * Analytics connection and reporting.
 *
 * Reads go through requireWebsite() like every other tenant query. Tokens are
 * never returned to the client in any form.
 */

export type AnalyticsConnection = {
  connected: boolean;
  status: string;
  searchConsoleSite: string | null;
  analyticsProperty: string | null;
  lastImportedAt: Date | null;
};

export async function getAnalyticsConnection(
  websiteId: string,
): Promise<AnalyticsConnection> {
  const { site } = await requireWebsite(websiteId);

  const [row] = await db
    .select()
    .from(integrations)
    .where(
      and(eq(integrations.websiteId, site.id), eq(integrations.kind, GOOGLE_KIND)),
    )
    .limit(1);

  if (!row) {
    return {
      connected: false,
      status: "disconnected",
      searchConsoleSite: null,
      analyticsProperty: null,
      lastImportedAt: null,
    };
  }

  const meta = (row.meta as GoogleMeta | null) ?? {};
  return {
    connected: row.status === "connected",
    status: row.status,
    searchConsoleSite: meta.searchConsoleSite ?? null,
    analyticsProperty: meta.analyticsProperty ?? null,
    lastImportedAt: row.verifiedAt,
  };
}

/** Produces the Google consent URL for this website. */
export async function startGoogleConnect(
  websiteId: string,
  origin: ConnectOrigin = "app",
): Promise<ActionResult<{ url: string }>> {
  const guard = await requireEditor(websiteId);
  if (!guard.ok) return { ok: false, error: guard.error };
  const { site } = guard.context;

  if (!isGoogleConfigured()) {
    return { ok: false, error: "Google integration is not configured yet." };
  }

  // Anything but the one other known value means the app page.
  const from: ConnectOrigin = origin === "onboarding" ? "onboarding" : "app";
  return { ok: true, data: { url: authorizeUrl(signState(site.id, from)) } };
}

export async function disconnectGoogle(
  websiteId: string,
): Promise<ActionResult<null>> {
  const guard = await requireEditor(websiteId);
  if (!guard.ok) return { ok: false, error: guard.error };
  const { site } = guard.context;
  await disconnect(site.id);
  revalidatePath(`/websites/${site.id}/google`);
  return { ok: true, data: null };
}

export type AvailableProperties = {
  searchConsole: { siteUrl: string; permissionLevel: string }[];
  analytics: { name: string; displayName: string }[];
};

/** Lists what the connected Google account can actually read. */
export async function listProperties(
  websiteId: string,
): Promise<ActionResult<AvailableProperties>> {
  const { site } = await requireWebsite(websiteId);

  const connection = await getConnection(site.id);
  if (!connection) {
    return { ok: false, error: "Reconnect your Google account" };
  }

  try {
    // Independent calls; one failing should not hide the other's results.
    const [searchConsole, analytics] = await Promise.all([
      listSearchConsoleSites(connection.accessToken).catch(() => []),
      listAnalyticsProperties(connection.accessToken).catch(() => []),
    ]);
    return { ok: true, data: { searchConsole, analytics } };
  } catch (error) {
    if (error instanceof GoogleApiError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}

export async function selectProperties(
  websiteId: string,
  input: { searchConsoleSite?: string | null; analyticsProperty?: string | null },
): Promise<ActionResult<null>> {
  /*
    requireEditor: this WRITES which property the site imports from, so a
    view-only collaborator could silently repoint the owner's reporting at
    another property. Its siblings in this file already guard this way; this
    one was reading with requireWebsite and then writing.
  */
  const guard = await requireEditor(websiteId);
  if (!guard.ok) return { ok: false, error: guard.error };
  const { site } = guard.context;

  const connection = await getConnection(site.id);
  if (!connection) return { ok: false, error: "Reconnect your Google account" };

  await db
    .update(integrations)
    .set({
      meta: {
        ...connection.meta,
        searchConsoleSite: input.searchConsoleSite ?? null,
        analyticsProperty: input.analyticsProperty ?? null,
      },
      updatedAt: new Date(),
    })
    .where(eq(integrations.id, connection.integrationId));

  revalidatePath(`/websites/${site.id}/google`);
  return { ok: true, data: null };
}

export async function startImport(
  websiteId: string,
): Promise<ActionResult<null>> {
  const guard = await requireEditor(websiteId);
  if (!guard.ok) return { ok: false, error: guard.error };
  const { site, orgId } = guard.context;

  const connection = await getAnalyticsConnection(site.id);
  if (!connection.connected) {
    return { ok: false, error: "Connect Google first" };
  }
  if (!connection.searchConsoleSite && !connection.analyticsProperty) {
    return { ok: false, error: "Choose a property to import from first" };
  }

  await queueJob({
    name: "website/analytics.import.requested",
    data: { websiteId: site.id, organizationId: orgId },
  });

  revalidatePath(`/websites/${site.id}/google`);
  return { ok: true, data: null };
}

export type PerformanceSummary = {
  clicks: number;
  impressions: number;
  averagePosition: number | null;
  sessions: number;
  users: number;
  topQueries: { query: string; clicks: number; impressions: number }[];
  topPages: { pageUrl: string; clicks: number }[];
  hasData: boolean;
  /**
   * The same figures for the period immediately before this one, so the page
   * can show movement rather than a bare total.
   *
   * Null when that earlier window holds no rows at all — a site whose first
   * import only covers the current period has nothing to compare against, and
   * treating absent history as zero would report every number as a gain.
   */
  /**
   * The same figures for the window before. Each source is null when that
   * window is not fully imported - a comparison against a half-empty window
   * is how every site came to show growth of several hundred percent.
   */
  previous: {
    clicks: number | null;
    impressions: number | null;
    averagePosition: number | null;
    sessions: number | null;
    users: number | null;
  } | null;
};

/** Aggregated performance for the last `days` days. */
/** An ISO date shifted by whole days. */
function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Site-wide totals for an inclusive date window, from site_daily_metrics.
 *
 * gscDays / gaDays count the days that source actually reported, which is how
 * a caller tells "a quiet month" from "a month we never imported".
 */
async function windowTotals(websiteId: string, from: string, to: string) {
  const d = siteDailyMetrics;
  const [row] = await db
    .select({
      clicks: raw<number>`coalesce(sum(${d.gscClicks}), 0)::int`,
      impressions: raw<number>`coalesce(sum(${d.gscImpressions}), 0)::int`,
      // Each day's position is already Google's impression-weighted average,
      // so days are weighted by impressions too - a quiet day must not count
      // as much as a busy one.
      position: raw<number | null>`
        case when sum(${d.gscImpressions}) > 0
        then (sum(${d.gscPosition} * ${d.gscImpressions}) / sum(${d.gscImpressions}))::float
        else null end`,
      gscDays: raw<number>`count(${d.gscClicks})::int`,
      sessions: raw<number>`coalesce(sum(${d.gaSessions}), 0)::int`,
      // Summed per day, so a person visiting on two days counts twice. Not
      // shown anywhere; unique users over a window needs its own GA query.
      users: raw<number>`coalesce(sum(${d.gaUsers}), 0)::int`,
      gaDays: raw<number>`count(${d.gaSessions})::int`,
    })
    .from(d)
    .where(and(eq(d.websiteId, websiteId), gte(d.date, from), lte(d.date, to)));
  return row;
}

export async function getPerformance(
  websiteId: string,
  days = 28,
): Promise<PerformanceSummary> {
  const { site } = await requireWebsite(websiteId);

  /*
    Both windows end on the newest day Google has reported, not on today.
    Google runs about three days behind, so a window ending today held three
    empty days and compared 25 days of data against 28.
  */
  const [latest] = await db
    .select({ date: raw<string | null>`max(${siteDailyMetrics.date})::text` })
    .from(siteDailyMetrics)
    .where(eq(siteDailyMetrics.websiteId, site.id));
  const end = latest?.date ?? new Date().toISOString().slice(0, 10);
  const currentStart = shiftDate(end, -(days - 1));
  const previousEnd = shiftDate(currentStart, -1);
  const previousStart = shiftDate(previousEnd, -(days - 1));

  const [current, before] = await Promise.all([
    windowTotals(site.id, currentStart, end),
    windowTotals(site.id, previousStart, previousEnd),
  ]);

  const topQueries = await db
    .select({
      query: gscMetrics.query,
      clicks: raw<number>`sum(${gscMetrics.clicks})::int`,
      impressions: raw<number>`sum(${gscMetrics.impressions})::int`,
    })
    .from(gscMetrics)
    .where(
      and(
        eq(gscMetrics.websiteId, site.id),
        gte(gscMetrics.date, currentStart),
        lte(gscMetrics.date, end),
        raw`${gscMetrics.query} is not null`,
      ),
    )
    .groupBy(gscMetrics.query)
    .orderBy(desc(raw`sum(${gscMetrics.clicks})`))
    .limit(10);

  const topPages = await db
    .select({
      pageUrl: gscMetrics.pageUrl,
      clicks: raw<number>`sum(${gscMetrics.clicks})::int`,
    })
    .from(gscMetrics)
    .where(
      and(
        eq(gscMetrics.websiteId, site.id),
        gte(gscMetrics.date, currentStart),
        lte(gscMetrics.date, end),
        raw`${gscMetrics.pageUrl} is not null`,
      ),
    )
    .groupBy(gscMetrics.pageUrl)
    .orderBy(desc(raw`sum(${gscMetrics.clicks})`))
    .limit(10);

  // A comparison only when the earlier window is complete for that source.
  const gscComparable = (before?.gscDays ?? 0) >= days;
  const gaComparable = (before?.gaDays ?? 0) >= days;

  return {
    clicks: current?.clicks ?? 0,
    impressions: current?.impressions ?? 0,
    averagePosition: current?.position ?? null,
    sessions: current?.sessions ?? 0,
    users: current?.users ?? 0,
    previous:
      gscComparable || gaComparable
        ? {
            clicks: gscComparable ? (before?.clicks ?? 0) : null,
            impressions: gscComparable ? (before?.impressions ?? 0) : null,
            averagePosition: gscComparable ? (before?.position ?? null) : null,
            sessions: gaComparable ? (before?.sessions ?? 0) : null,
            users: gaComparable ? (before?.users ?? 0) : null,
          }
        : null,
    topQueries: topQueries
      .filter((row): row is { query: string; clicks: number; impressions: number } =>
        row.query !== null,
      )
      .map((row) => ({ query: row.query, clicks: row.clicks, impressions: row.impressions })),
    topPages: topPages
      .filter((row): row is { pageUrl: string; clicks: number } => row.pageUrl !== null)
      .map((row) => ({ pageUrl: row.pageUrl, clicks: row.clicks })),
    hasData: (current?.impressions ?? 0) > 0 || (current?.sessions ?? 0) > 0,
  };
}

/*
  saveTokens is deliberately NOT re-exported.

  Every export of a "use server" module is a callable RPC endpoint with its own
  action id, so re-exporting an unguarded helper publishes it to the internet.
  saveTokens takes a websiteId and writes Google OAuth tokens for it with no
  session check and no tenant guard — as an action, any caller could point a
  customer's analytics at their own Google account, or wipe the connection.

  The OAuth callback route imports it straight from @/lib/analytics/connection,
  which is server-only and unreachable from a browser. Nothing else needs it.
*/
