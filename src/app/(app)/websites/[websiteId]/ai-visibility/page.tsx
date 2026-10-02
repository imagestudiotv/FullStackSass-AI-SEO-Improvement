import { requireWebsitePage } from "@/lib/tenant";
import { getAppMessages } from "@/lib/i18n/app-locale";
import { getGeoOverview } from "@/lib/geo/actions";
import { GeoPanel } from "../geo-panel";
import { requireWebsitePlan } from "@/lib/billing/require-plan";

export const metadata = { title: "AI visibility" };

export const dynamic = "force-dynamic";

export default async function WebsiteAiVisibilityPage({
  params,
}: PageProps<"/websites/[websiteId]/ai-visibility">) {
  const { websiteId } = await params;
  const ctx = await requireWebsitePage(websiteId);
  const { site, userId } = ctx;
  // Paywall. See lib/billing/require-plan.ts. An owner gets requirePlan on
  // the workspace that pays for this site, exactly as before. A guest is
  // judged on this website alone and, if its owner's plan has lapsed, is
  // sent to the dashboard to be told so - never into the owner's checkout.
  await requireWebsitePlan(ctx);
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
