import { requireWebsite } from "@/lib/tenant";
import { getAppMessages } from "@/lib/i18n/app-locale";
import { getGeoOverview } from "@/lib/geo/actions";
import { GeoPanel } from "../geo-panel";
import { requirePlan } from "@/lib/billing/require-plan";

export const metadata = { title: "AI visibility" };

export const dynamic = "force-dynamic";

export default async function WebsiteAiVisibilityPage({
  params,
}: PageProps<"/websites/[websiteId]/ai-visibility">) {
  const { websiteId } = await params;
  const { orgId, site, userId } = await requireWebsite(websiteId);
  // Paywall. See lib/billing/require-plan.ts.
  await requirePlan(orgId);
  const overview = await getGeoOverview(site.id);
  const { t } = await getAppMessages(userId);

  return (
    <GeoPanel
      websiteId={site.id}
      overview={overview}
      t={t.app.geo}
      tCommon={t.app.common}
    />
  );
}
