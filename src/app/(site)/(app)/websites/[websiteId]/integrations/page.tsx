import { requireWebsitePage } from "@/lib/tenant";
import { getAppMessages } from "@/lib/i18n/app-locale";
import { getIntegrationKeys } from "@/lib/plugin/actions";
import { reportedWordPressAdmin } from "@/lib/plugin/keys";
import { pluginConnectionContext } from "@/lib/plugin/connection";
import {
  listAvailableProviders,
  listIntegrations,
} from "@/lib/publishing/actions";
import { PublishingPanel } from "../publishing-panel";
import { requireWebsitePlan } from "@/lib/billing/require-plan";

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
  const ctx = await requireWebsitePage(websiteId);
  const { site, userId, access } = ctx;
  const { t, locale } = await getAppMessages(userId);

  // Paywall. See lib/billing/require-plan.ts. An owner gets requirePlan on
  // the workspace that pays for this site, exactly as before. A guest is
  // judged on this website alone and, if its owner's plan has lapsed, is
  // sent to the dashboard to be told so - never into the owner's checkout.
  await requireWebsitePlan(ctx);

  const [providers, integrations, pluginKeys, pluginContext, wordpressAdmin] = await Promise.all([
    listAvailableProviders(),
    listIntegrations(site.id),
    getIntegrationKeys(site.id),
    // Read-only: which workspace the WordPress card connects, and the same
    // domain in this person's other workspaces. Rendering never creates a key.
    pluginConnectionContext(site.id, userId),
    // Where the plugin said its WordPress admin is (a subdirectory install).
    reportedWordPressAdmin(site.id),
  ]);

  return (
    <div className="space-y-6">
      <PublishingPanel
        websiteId={site.id}
        providers={providers}
        integrations={integrations}
        pluginKeys={pluginKeys}
        canEdit={access !== "viewer"}
        pluginContext={pluginContext}
        locale={locale}
        /* For the links into the customer's own WordPress admin. */
        siteUrl={site.url}
        wordpressAdmin={wordpressAdmin}
        t={t.app.publishing}
        tKeys={t.app.keys}
        tCommon={t.app.common}
        tStatus={t.app.status}
      />
    </div>
  );
}
