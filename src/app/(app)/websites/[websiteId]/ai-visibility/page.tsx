import { requireWebsite } from "@/lib/tenant";
import { getGeoOverview } from "@/lib/geo/actions";
import { GeoPanel } from "../geo-panel";

export const metadata = { title: "AI visibility" };

export const dynamic = "force-dynamic";

export default async function WebsiteAiVisibilityPage({
  params,
}: PageProps<"/websites/[websiteId]/ai-visibility">) {
  const { websiteId } = await params;
  const { site } = await requireWebsite(websiteId);
  const overview = await getGeoOverview(site.id);

  return <GeoPanel websiteId={site.id} overview={overview} />;
}
