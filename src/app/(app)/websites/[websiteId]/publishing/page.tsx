import { requireWebsite } from "@/lib/tenant";
import {
  listAvailableProviders,
  listIntegrations,
} from "@/lib/publishing/actions";
import { getIntegrationKeys } from "@/lib/plugin/actions";
import { AutoPublishToggle } from "../auto-publish-toggle";
import { PublishingPanel } from "../publishing-panel";

export const metadata = { title: "Publishing" };

export const dynamic = "force-dynamic";

export default async function WebsitePublishingPage({
  params,
}: PageProps<"/websites/[websiteId]/publishing">) {
  const { websiteId } = await params;
  const { site } = await requireWebsite(websiteId);

  const [providers, integrations, pluginKeys] = await Promise.all([
    listAvailableProviders(),
    listIntegrations(site.id),
    getIntegrationKeys(site.id),
  ]);

  return (
    <div className="space-y-6">
      {/*
        The setting above the connections, because it decides what happens to
        every article and the connections are how it happens.
      */}
      <AutoPublishToggle
        websiteId={site.id}
        enabled={site.autoPublish}
        hasIntegration={integrations.some((i) => i.status === "connected")}
      />

      <PublishingPanel
        websiteId={site.id}
        providers={providers}
        integrations={integrations}
        pluginKeys={pluginKeys}
      />
    </div>
  );
}
