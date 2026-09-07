import { requireWebsite } from "@/lib/tenant";
import {
  getDecayedPages,
  getTrafficChart,
} from "@/lib/articles/refresh-actions";
import { RefreshPanel } from "../refresh-panel";

export const metadata = { title: "Losing traffic" };

export const dynamic = "force-dynamic";

export default async function WebsiteTrafficPage({
  params,
}: PageProps<"/websites/[websiteId]/traffic">) {
  const { websiteId } = await params;
  const { site } = await requireWebsite(websiteId);

  const [pages, series] = await Promise.all([
    getDecayedPages(site.id),
    getTrafficChart(site.id),
  ]);

  return <RefreshPanel websiteId={site.id} pages={pages} series={series} />;
}
