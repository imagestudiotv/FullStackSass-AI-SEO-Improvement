import { requireWebsite } from "@/lib/tenant";
import {
  getAnalyticsConnection,
  getPerformance,
} from "@/lib/analytics/actions";
import { AnalyticsPanel } from "../analytics-panel";

export const metadata = { title: "Google results" };

export const dynamic = "force-dynamic";

export default async function WebsiteGooglePage({
  params,
}: PageProps<"/websites/[websiteId]/google">) {
  const { websiteId } = await params;
  const { site } = await requireWebsite(websiteId);

  const [connection, performance] = await Promise.all([
    getAnalyticsConnection(site.id),
    getPerformance(site.id),
  ]);

  return (
    <AnalyticsPanel
      websiteId={site.id}
      connection={connection}
      performance={performance}
    />
  );
}
