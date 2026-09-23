import { requireWebsite } from "@/lib/tenant";
import { getAppMessages } from "@/lib/i18n/app-locale";
import {
  getAnalyticsConnection,
  getPerformance,
} from "@/lib/analytics/actions";
import { AnalyticsPanel } from "../analytics-panel";
import { requirePlan } from "@/lib/billing/require-plan";

export const metadata = { title: "Google Connect" };

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
 */
export default async function WebsiteGooglePage({
  params,
}: PageProps<"/websites/[websiteId]/google">) {
  const { websiteId } = await params;
  const { orgId, site, userId } = await requireWebsite(websiteId);
  const { locale, t } = await getAppMessages(userId);

  // Paywall. See lib/billing/require-plan.ts.
  await requirePlan(orgId);

  const [connection, performance] = await Promise.all([
    getAnalyticsConnection(site.id),
    getPerformance(site.id),
  ]);

  return (
    <div className="space-y-6">
      <AnalyticsPanel
        websiteId={site.id}
        connection={connection}
        performance={performance}
        t={t.app.analytics}
        locale={locale}
        tCommon={t.app.common}
      />
    </div>
  );
}
