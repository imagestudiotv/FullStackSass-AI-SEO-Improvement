"use server";

import { and, desc, eq, gte, sql as raw } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { inngest } from "@/inngest/client";
import { signState } from "@/app/api/integrations/google/callback/route";
import {
  disconnect,
  getConnection,
  GOOGLE_KIND,
  saveTokens,
  type GoogleMeta,
} from "@/lib/analytics/connection";
import {
  listAnalyticsProperties,
  listSearchConsoleSites,
  GoogleApiError,
} from "@/lib/analytics/google-api";
import { authorizeUrl, isGoogleConfigured } from "@/lib/analytics/google-oauth";
import { db } from "@/lib/db";
import { gaMetrics, gscMetrics, integrations } from "@/lib/db/schema";
import { requireWebsite } from "@/lib/tenant";
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
): Promise<ActionResult<{ url: string }>> {
  const { site } = await requireWebsite(websiteId);

  if (!isGoogleConfigured()) {
    return { ok: false, error: "Google integration is not configured yet." };
  }

  return { ok: true, data: { url: authorizeUrl(signState(site.id)) } };
}

export async function disconnectGoogle(
  websiteId: string,
): Promise<ActionResult<null>> {
  const { site } = await requireWebsite(websiteId);
  await disconnect(site.id);
  revalidatePath(`/websites/${site.id}`);
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
  const { site } = await requireWebsite(websiteId);

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

  revalidatePath(`/websites/${site.id}`);
  return { ok: true, data: null };
}

export async function startImport(
  websiteId: string,
): Promise<ActionResult<null>> {
  const { site, orgId } = await requireWebsite(websiteId);

  const connection = await getAnalyticsConnection(site.id);
  if (!connection.connected) {
    return { ok: false, error: "Connect Google first" };
  }
  if (!connection.searchConsoleSite && !connection.analyticsProperty) {
    return { ok: false, error: "Choose a property to import from first" };
  }

  await inngest.send({
    name: "website/analytics.import.requested",
    data: { websiteId: site.id, organizationId: orgId },
  });

  revalidatePath(`/websites/${site.id}`);
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
};

/** Aggregated performance for the last `days` days. */
export async function getPerformance(
  websiteId: string,
  days = 28,
): Promise<PerformanceSummary> {
  const { site } = await requireWebsite(websiteId);

  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceDate = since.toISOString().slice(0, 10);

  const [totals] = await db
    .select({
      clicks: raw<number>`coalesce(sum(${gscMetrics.clicks}), 0)::int`,
      impressions: raw<number>`coalesce(sum(${gscMetrics.impressions}), 0)::int`,
      /**
       * Weighted by impressions, not a plain average: a query seen 10,000
       * times at position 8 describes the site far better than one seen twice
       * at position 1, and averaging them equally would flatter the numbers.
       */
      position: raw<number | null>`
        case when sum(${gscMetrics.impressions}) > 0
        then sum(${gscMetrics.position} * ${gscMetrics.impressions}) / sum(${gscMetrics.impressions})
        else null end`,
    })
    .from(gscMetrics)
    .where(and(eq(gscMetrics.websiteId, site.id), gte(gscMetrics.date, sinceDate)));

  const [gaTotals] = await db
    .select({
      sessions: raw<number>`coalesce(sum(${gaMetrics.sessions}), 0)::int`,
      users: raw<number>`coalesce(sum(${gaMetrics.users}), 0)::int`,
    })
    .from(gaMetrics)
    .where(and(eq(gaMetrics.websiteId, site.id), gte(gaMetrics.date, sinceDate)));

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
        gte(gscMetrics.date, sinceDate),
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
        gte(gscMetrics.date, sinceDate),
        raw`${gscMetrics.pageUrl} is not null`,
      ),
    )
    .groupBy(gscMetrics.pageUrl)
    .orderBy(desc(raw`sum(${gscMetrics.clicks})`))
    .limit(10);

  return {
    clicks: totals?.clicks ?? 0,
    impressions: totals?.impressions ?? 0,
    averagePosition: totals?.position ?? null,
    sessions: gaTotals?.sessions ?? 0,
    users: gaTotals?.users ?? 0,
    topQueries: topQueries
      .filter((row): row is { query: string; clicks: number; impressions: number } =>
        row.query !== null,
      )
      .map((row) => ({ query: row.query, clicks: row.clicks, impressions: row.impressions })),
    topPages: topPages
      .filter((row): row is { pageUrl: string; clicks: number } => row.pageUrl !== null)
      .map((row) => ({ pageUrl: row.pageUrl, clicks: row.clicks })),
    hasData: (totals?.impressions ?? 0) > 0 || (gaTotals?.sessions ?? 0) > 0,
  };
}

export { saveTokens };
