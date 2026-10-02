import { requireWebsitePage } from "@/lib/tenant";
import { getAppMessages } from "@/lib/i18n/app-locale";
import {
  getTrafficChanges,
  getTrafficChart,
} from "@/lib/articles/refresh-actions";
import { RefreshPanel } from "../refresh-panel";
import { requireWebsitePlan } from "@/lib/billing/require-plan";

export const metadata = { title: "Losing traffic" };

export const dynamic = "force-dynamic";

export default async function WebsiteTrafficPage({
  params,
}: PageProps<"/websites/[websiteId]/traffic">) {
  const { websiteId } = await params;
  const ctx = await requireWebsitePage(websiteId);
  const { site, userId } = ctx;
  const { locale, t } = await getAppMessages(userId);

  // Paywall. See lib/billing/require-plan.ts. An owner gets requirePlan on
  // the workspace that pays for this site, exactly as before. A guest is
  // judged on this website alone and, if its owner's plan has lapsed, is
  // sent to the dashboard to be told so - never into the owner's checkout.
  await requireWebsitePlan(ctx);
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
