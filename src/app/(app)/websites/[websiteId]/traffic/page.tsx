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
  const { ownerOrgId, site, userId } = await requireWebsitePage(websiteId);
  const { locale, t } = await getAppMessages(userId);

  // Paywall. See lib/billing/require-plan.ts.
  // The OWNER's plan pays for this website, not the caller's own
  // workspace: a guest invited to a paid site must not be bounced to a
  // plan screen for a workspace that is not paying for it. See tenant.ts.
  await requirePlan(ownerOrgId);
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
