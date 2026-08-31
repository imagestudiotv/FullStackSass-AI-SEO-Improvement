import { eq, sql as raw } from "drizzle-orm";

import { inngest } from "@/inngest/client";
import { getConnection } from "@/lib/analytics/connection";
import {
  fetchAnalyticsReport,
  fetchSearchAnalytics,
  GoogleApiError,
} from "@/lib/analytics/google-api";
import { db } from "@/lib/db";
import { gaMetrics, gscMetrics, integrations } from "@/lib/db/schema";
import { PRICING, track } from "@/lib/usage";

/**
 * Imports Search Console and Analytics data.
 *
 * Search Console and GA are separate steps so one failing does not discard the
 * other's results — a customer may have connected only one of them, and a GA
 * permission error should not lose a completed Search Console import.
 */

/**
 * Days imported per run.
 *
 * Search Console revises the last two to three days as data settles, so a
 * window shorter than that would store numbers that are still changing.
 * Re-importing is safe: rows upsert on (website, date, page, query).
 */
const IMPORT_DAYS = 30;

/** Google reports up to three days behind, so today is always empty. */
const LAG_DAYS = 3;

function dateRange(): { startDate: string; endDate: string } {
  const end = new Date();
  end.setDate(end.getDate() - LAG_DAYS);
  const start = new Date(end);
  start.setDate(start.getDate() - IMPORT_DAYS);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

export const importAnalytics = inngest.createFunction(
  {
    id: "import-analytics",
    retries: 2,
    triggers: [{ event: "website/analytics.import.requested" }],
    // One import per website: concurrent runs would fight over the same rows.
    concurrency: { key: "event.data.websiteId", limit: 1 },
  },
  async ({ event, step }) => {
    const { websiteId, organizationId } = event.data as {
      websiteId: string;
      organizationId: string;
    };

    const range = dateRange();

    const searchConsole = await step.run("import-search-console", async () => {
      const connection = await getConnection(websiteId);
      if (!connection?.meta.searchConsoleSite) {
        return { imported: 0, skipped: "not_configured" as const };
      }

      let rows;
      try {
        rows = await fetchSearchAnalytics(
          connection.accessToken,
          connection.meta.searchConsoleSite,
          range.startDate,
          range.endDate,
        );
      } catch (error) {
        if (error instanceof GoogleApiError && error.kind === "forbidden") {
          // Permission removed on Google's side; retrying cannot fix it.
          return { imported: 0, skipped: "forbidden" as const };
        }
        throw error;
      }

      // Chunked: a busy site returns thousands of rows and one statement with
      // that many parameters exceeds Postgres' limit.
      const CHUNK = 500;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const batch = rows.slice(i, i + CHUNK).map((row) => ({
          websiteId,
          date: row.date,
          pageUrl: row.pageUrl,
          query: row.query,
          clicks: row.clicks,
          impressions: row.impressions,
          ctr: row.ctr,
          position: row.position,
        }));
        if (batch.length === 0) continue;

        await db
          .insert(gscMetrics)
          .values(batch)
          .onConflictDoUpdate({
            target: [
              gscMetrics.websiteId,
              gscMetrics.date,
              gscMetrics.pageUrl,
              gscMetrics.query,
            ],
            set: {
              clicks: raw`excluded.clicks`,
              impressions: raw`excluded.impressions`,
              ctr: raw`excluded.ctr`,
              position: raw`excluded.position`,
            },
          });
      }

      await track(organizationId, {
        kind: "seo_api",
        websiteId,
        provider: "google_search_console",
        quantity: 1,
        // Google's APIs are free at this volume; recorded for completeness.
        costUsd: 0,
        metadata: { purpose: "gsc_import", rows: rows.length },
      });

      return { imported: rows.length, skipped: null };
    });

    const analytics = await step.run("import-analytics", async () => {
      const connection = await getConnection(websiteId);
      if (!connection?.meta.analyticsProperty) {
        return { imported: 0, skipped: "not_configured" as const };
      }

      let rows;
      try {
        rows = await fetchAnalyticsReport(
          connection.accessToken,
          connection.meta.analyticsProperty,
          range.startDate,
          range.endDate,
        );
      } catch (error) {
        if (error instanceof GoogleApiError && error.kind === "forbidden") {
          return { imported: 0, skipped: "forbidden" as const };
        }
        throw error;
      }

      const CHUNK = 500;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const batch = rows.slice(i, i + CHUNK).map((row) => ({
          websiteId,
          date: row.date,
          pageUrl: row.pageUrl,
          sessions: row.sessions,
          users: row.users,
          engagementRate: row.engagementRate,
          conversions: row.conversions,
        }));
        if (batch.length === 0) continue;

        await db
          .insert(gaMetrics)
          .values(batch)
          .onConflictDoUpdate({
            target: [gaMetrics.websiteId, gaMetrics.date, gaMetrics.pageUrl],
            set: {
              sessions: raw`excluded.sessions`,
              users: raw`excluded.users`,
              engagementRate: raw`excluded.engagement_rate`,
              conversions: raw`excluded.conversions`,
            },
          });
      }

      return { imported: rows.length, skipped: null };
    });

    await step.run("mark-imported", async () => {
      await db
        .update(integrations)
        .set({ verifiedAt: new Date(), updatedAt: new Date() })
        .where(eq(integrations.websiteId, websiteId));
    });

    void PRICING;
    return {
      websiteId,
      searchConsoleRows: searchConsole.imported,
      analyticsRows: analytics.imported,
      range,
    };
  },
);
