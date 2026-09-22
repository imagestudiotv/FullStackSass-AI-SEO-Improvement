import { requireWebsite } from "@/lib/tenant";
import { getAppMessages } from "@/lib/i18n/app-locale";
import {
  getAnalyticsConnection,
  getPerformance,
} from "@/lib/analytics/actions";
import { getIntegrationKeys } from "@/lib/plugin/actions";
import {
  listAvailableProviders,
  listIntegrations,
} from "@/lib/publishing/actions";
import { AnalyticsPanel } from "../analytics-panel";
import { PublishingPanel } from "../publishing-panel";
import { requirePlan } from "@/lib/billing/require-plan";

export const metadata = { title: "Google results" };

export const dynamic = "force-dynamic";

export default async function WebsiteGooglePage({
  params,
}: PageProps<"/websites/[websiteId]/google">) {
  const { websiteId } = await params;
  const { orgId, site, userId } = await requireWebsite(websiteId);
  const { locale, t } = await getAppMessages(userId);

  // Paywall. See lib/billing/require-plan.ts.
  await requirePlan(orgId);
  const [connection, performance, providers, integrations, pluginKeys] =
    await Promise.all([
      getAnalyticsConnection(site.id),
      getPerformance(site.id),
      listAvailableProviders(),
      listIntegrations(site.id),
      getIntegrationKeys(site.id),
    ]);

  return (
    <div className="space-y-6">
      {/*
        PUBLISHING FIRST, analytics second.

        The client moved this panel here - "this has to be in the integration
        tab" - and it leads because it is the connection somebody comes to
        this tab to make. Without a publishing destination the articles this
        product writes have nowhere to go, so it is the one that blocks the
        rest of the product; Google is how you measure what happened after.

        It was on Article Settings, which is about how articles are WRITTEN.
        Where they are sent is a different question and belongs with the
        other integrations.
      */}
      <PublishingPanel
        websiteId={site.id}
        providers={providers}
        integrations={integrations}
        pluginKeys={pluginKeys}
        t={t.app.publishing}
      />

      <AnalyticsPanel
        websiteId={site.id}
        connection={connection}
        performance={performance}
        t={t.app.analytics}
        locale={locale}
      />
    </div>
  );
}
