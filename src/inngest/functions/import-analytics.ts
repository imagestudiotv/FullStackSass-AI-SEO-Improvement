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
  async ({ event, step, logger }) => {
    const { websiteId, organizationId } = event.data as {
      websiteId: string;
      organizationId: string;
    };

    const range = dateRange();

    /**
     * Structured logs, one per step, so the Inngest timeline explains itself.
     *
     * Both steps below can return zero rows for several unrelated reasons —
     * nothing connected, permission revoked, or genuinely no traffic — and
     * every one of them ends as a successful run with an empty dashboard.
     * These lines record which of the three it was, keyed by `websiteId`.
     *
     * Access tokens are never logged; only the property identifiers.
     */
    logger.info(
      {
        step: "start",
        websiteId,
        organizationId,
        startDate: range.startDate,
        endDate: range.endDate,
      },
      "Analytics import started",
    );

    const searchConsole = await step.run("import-search-console", async () => {
      const connection = await getConnection(websiteId);
      if (!connection?.meta.searchConsoleSite) {
        /*
          Zero rows, run succeeds, dashboard stays empty. Warned because the
          customer's view of this is "the numbers never showed up", and the
          answer — no Search Console property is selected — exists nowhere
          else in the run.
        */
        logger.warn(
          { step: "import-search-console", websiteId, imported: 0 },
          "No Search Console property connected - skipping the import",
        );
        return { imported: 0, skipped: "not_configured" as const };
      }

      const startedAt = Date.now();
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
          /*
            Permission removed on Google's side; retrying cannot fix it. The
            swallow is deliberate, but it means the import silently stops
            producing data for a site that was working yesterday — the one
            case here that needs a human to go and re-grant access.
          */
          logger.error(
            {
              step: "import-search-console",
              websiteId,
              property: connection.meta.searchConsoleSite,
              kind: error.kind,
              reason: error.message,
              durationMs: Date.now() - startedAt,
            },
            "Search Console access is forbidden - import skipped, access must be re-granted",
          );
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

      logger.info(
        {
          step: "import-search-console",
          websiteId,
          property: connection.meta.searchConsoleSite,
          rowsUpserted: rows.length,
          startDate: range.startDate,
          endDate: range.endDate,
          durationMs: Date.now() - startedAt,
        },
        "Search Console rows imported",
      );

      /*
        Connected, permitted, and still nothing came back. Usually a brand new
        property with no history, but it looks identical to a broken import
        from the dashboard, so it gets its own line.
      */
      if (rows.length === 0) {
        logger.warn(
          {
            step: "import-search-console",
            websiteId,
            property: connection.meta.searchConsoleSite,
            startDate: range.startDate,
            endDate: range.endDate,
          },
          "Search Console returned no rows for this window",
        );
      }

      return { imported: rows.length, skipped: null };
    });

    const analytics = await step.run("import-analytics", async () => {
      const connection = await getConnection(websiteId);
      if (!connection?.meta.analyticsProperty) {
        // Same silent-empty path as Search Console above, and worth the same
        // explicit record: connected to one Google product is not both.
        logger.warn(
          { step: "import-analytics", websiteId, imported: 0 },
          "No Analytics property connected - skipping the import",
        );
        return { imported: 0, skipped: "not_configured" as const };
      }

      const startedAt = Date.now();
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
          logger.error(
            {
              step: "import-analytics",
              websiteId,
              property: connection.meta.analyticsProperty,
              kind: error.kind,
              reason: error.message,
              durationMs: Date.now() - startedAt,
            },
            "Analytics access is forbidden - import skipped, access must be re-granted",
          );
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

      logger.info(
        {
          step: "import-analytics",
          websiteId,
          property: connection.meta.analyticsProperty,
          rowsUpserted: rows.length,
          startDate: range.startDate,
          endDate: range.endDate,
          durationMs: Date.now() - startedAt,
        },
        "Analytics rows imported",
      );

      if (rows.length === 0) {
        logger.warn(
          {
            step: "import-analytics",
            websiteId,
            property: connection.meta.analyticsProperty,
            startDate: range.startDate,
            endDate: range.endDate,
          },
          "Analytics returned no rows for this window",
        );
      }

      return { imported: rows.length, skipped: null };
    });

    await step.run("mark-imported", async () => {
      await db
        .update(integrations)
        .set({ verifiedAt: new Date(), updatedAt: new Date() })
        .where(eq(integrations.websiteId, websiteId));

      logger.info(
        { step: "mark-imported", websiteId },
        "Integration marked as verified",
      );
    });

    /**
     * The one line that answers "why is the dashboard still empty".
     *
     * The two `skipped` values are carried through rather than collapsed into
     * the row counts: zero rows because nothing is connected, zero because
     * access was revoked, and zero because there was no traffic are three
     * different problems with the same number.
     */
    logger.info(
      {
        step: "done",
        websiteId,
        searchConsoleRows: searchConsole.imported,
        searchConsoleSkipped: searchConsole.skipped,
        analyticsRows: analytics.imported,
        analyticsSkipped: analytics.skipped,
        startDate: range.startDate,
        endDate: range.endDate,
      },
      "Analytics import complete",
    );

    void PRICING;
    return {
      websiteId,
      searchConsoleRows: searchConsole.imported,
      analyticsRows: analytics.imported,
      range,
    };
  },
);
