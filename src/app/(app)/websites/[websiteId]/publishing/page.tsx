import { requireWebsite } from "@/lib/tenant";
import {
  listAvailableProviders,
  listIntegrations,
} from "@/lib/publishing/actions";
import { getIntegrationKeys } from "@/lib/plugin/actions";
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
    <PublishingPanel
      websiteId={site.id}
      providers={providers}
      integrations={integrations}
      pluginKeys={pluginKeys}
    />
  );
}
