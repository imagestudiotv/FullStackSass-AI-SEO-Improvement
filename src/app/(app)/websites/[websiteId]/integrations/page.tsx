import { requireWebsitePage } from "@/lib/tenant";
import { getAppMessages } from "@/lib/i18n/app-locale";
import { getIntegrationKeys } from "@/lib/plugin/actions";
import {
  listAvailableProviders,
  listIntegrations,
} from "@/lib/publishing/actions";
import { PublishingPanel } from "../publishing-panel";
import { requirePlan } from "@/lib/billing/require-plan";

export const metadata = { title: "Integrations" };

export const dynamic = "force-dynamic";

/**
 * Where articles get published: WordPress, Ghost, Shopify, a webhook.
 *
 * Split out of /google, which had grown two unrelated jobs — the CMS
 * connection and the Google Analytics/Search Console connection — on one
 * page. Setup step 2 ("Connect your site") and step 3 ("Connect Google Search
 * Console") both landed there, so whichever step a customer pressed they were
 * shown the same screen and had to work out which half was theirs.
 *
 * One connection per page, and the route name says which: /integrations is
 * where articles go out, /google is where results come back.
 */
export default async function WebsiteIntegrationsPage({
  params,
}: PageProps<"/websites/[websiteId]/integrations">) {
  const { websiteId } = await params;
  const { orgId, site, userId } = await requireWebsitePage(websiteId);
  const { t } = await getAppMessages(userId);

  // Paywall. See lib/billing/require-plan.ts.
  await requirePlan(orgId);

  const [providers, integrations, pluginKeys] = await Promise.all([
    listAvailableProviders(),
    listIntegrations(site.id),
    getIntegrationKeys(site.id),
  ]);

  return (
    <div className="space-y-6">
      <PublishingPanel
        websiteId={site.id}
        providers={providers}
        integrations={integrations}
        pluginKeys={pluginKeys}
        /* For the links into the customer's own WordPress admin. */
        siteUrl={site.url}
        t={t.app.publishing}
        tKeys={t.app.keys}
        tCommon={t.app.common}
        tStatus={t.app.status}
      />
    </div>
  );
}
