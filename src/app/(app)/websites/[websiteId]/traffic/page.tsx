import { requireWebsite } from "@/lib/tenant";
import {
  getDecayedPages,
  getTrafficChart,
} from "@/lib/articles/refresh-actions";
import { RefreshPanel } from "../refresh-panel";
import { requirePlan } from "@/lib/billing/require-plan";

export const metadata = { title: "Losing traffic" };

export const dynamic = "force-dynamic";

export default async function WebsiteTrafficPage({
  params,
}: PageProps<"/websites/[websiteId]/traffic">) {
  const { websiteId } = await params;
  const { orgId, site } = await requireWebsite(websiteId);

  // Paywall. See lib/billing/require-plan.ts.
  await requirePlan(orgId);
  const [pages, series] = await Promise.all([
    getDecayedPages(site.id),
    getTrafficChart(site.id),
  ]);

  return <RefreshPanel websiteId={site.id} pages={pages} series={series} />;
}
