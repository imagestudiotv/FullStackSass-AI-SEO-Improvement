import { requireWebsitePage } from "@/lib/tenant";
import { getAppMessages } from "@/lib/i18n/app-locale";
import {
  getTrafficChanges,
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
  const { orgId, site, userId } = await requireWebsitePage(websiteId);
  const { locale, t } = await getAppMessages(userId);

  // Paywall. See lib/billing/require-plan.ts.
  await requirePlan(orgId);
  const [report, series] = await Promise.all([
    getTrafficChanges(site.id),
    getTrafficChart(site.id),
  ]);

  return (
    <RefreshPanel
      websiteId={site.id}
      report={report}
      series={series}
      locale={locale}
      t={t.app.common}
    />
  );
}
