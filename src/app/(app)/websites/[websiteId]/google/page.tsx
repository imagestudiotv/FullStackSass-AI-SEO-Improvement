import { PageHeader } from "@/components/ui/page-header";
import { Notice } from "@/components/workspace/notice";
import { getAnalyticsConnection } from "@/lib/analytics/actions";
import { requireWebsitePlan } from "@/lib/billing/require-plan";
import { getAppMessages } from "@/lib/i18n/app-locale";
import { formatDate } from "@/lib/i18n/format";
import { requireWebsitePage } from "@/lib/tenant";

import { AnalyticsPanel } from "../analytics-panel";
import { googleRangeDays, parseGoogleRange } from "./range";
import { GoogleRangeNav } from "./range-nav";
import { loadGoogleReport } from "./report";
import { GoogleReportSections } from "./report-sections";

export const metadata = { title: "Google Search & Analytics" };

export const dynamic = "force-dynamic";

/**
 * Google Analytics 4 and Search Console: connect them, then read what they
 * say about the site.
 *
 * The publishing panel used to sit above this one. It had been moved here at
 * the client's request, when this was the only "integrations" screen — but the
 * result was that setup step 2 (connect your CMS) and step 3 (connect Search
 * Console) both landed on this page, one above the other, and neither step
 * took you anywhere that looked like what it had asked for.
 *
 * Publishing now has its own page at /integrations. This one keeps a single
 * job, and the sidebar links straight to it so connecting Google is not
 * something you can only reach from a setup step you have already ticked off.
 *
 * Layout: the connection (status, chosen properties, how fresh the figures
 * are, and the management controls folded away) first and compact, then
 * Search Console and Analytics as separate sections. The period (?range=)
 * drives every figure, chart and table, and is read here on the server.
 * Nothing on this page asks Google for anything until someone presses a
 * button: the report reads stored rows only.
 */
export default async function WebsiteGooglePage({
  params,
  searchParams,
}: PageProps<"/websites/[websiteId]/google">) {
  const { websiteId } = await params;
  const ctx = await requireWebsitePage(websiteId);
  const { site, userId, access } = ctx;
  const { locale, t } = await getAppMessages(userId);

  // Paywall. See lib/billing/require-plan.ts. An owner gets requirePlan on
  // the workspace that pays for this site, exactly as before. A guest is
  // judged on this website alone and, if its owner's plan has lapsed, is
  // sent to the dashboard to be told so - never into the owner's checkout.
  await requireWebsitePlan(ctx);

  const range = parseGoogleRange((await searchParams).range);
  const a = t.app.analytics;
  // Presentation only: every write action still runs requireEditor itself.
  const canEdit = access !== "viewer";

  const connection = await getAnalyticsConnection(site.id);
  // Not connected: nothing to report, so nothing is queried.
  const report = connection.connected ? await loadGoogleReport(site.id, googleRangeDays(range)) : null;

  const day = (iso: string) =>
    formatDate(`${iso}T00:00:00Z`, locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

  // Before any property is chosen and with nothing imported, the page is the setup step alone.
  const showReport =
    report !== null &&
    (Boolean(connection.searchConsoleSite) ||
      Boolean(connection.analyticsProperty) ||
      report.search.daysReported > 0 ||
      report.analytics.daysReported > 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={a.pageTitle}
        description={a.pageDescription}
        actions={
          showReport && report ? (
            <GoogleRangeNav
              websiteId={site.id}
              range={range}
              dates={{ start: day(report.window.start), end: day(report.window.end) }}
              t={a}
            />
          ) : null
        }
      />

      {/* Not connected, the connect section says in place who can connect. */}
      {!canEdit && connection.connected ? <Notice>{t.app.workspace.viewOnly}</Notice> : null}

      <AnalyticsPanel
        websiteId={site.id}
        connection={connection}
        canEdit={canEdit}
        freshness={{
          search: report?.search.through ? day(report.search.through) : null,
          analytics: report?.analytics.through ? day(report.analytics.through) : null,
        }}
        hasData={report?.hasData ?? false}
        report={
          showReport && report ? (
            <GoogleReportSections report={report} connection={connection} canEdit={canEdit} locale={locale} t={a} />
          ) : null
        }
        t={a}
        tWorkspace={t.app.workspace}
      />
    </div>
  );
}
