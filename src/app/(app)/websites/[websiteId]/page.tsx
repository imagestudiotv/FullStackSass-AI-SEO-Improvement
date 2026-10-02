import { requireWebsitePage } from "@/lib/tenant";
import { getAppMessages } from "@/lib/i18n/app-locale";
import { getLatestAudit } from "@/lib/audit/actions";
import { AuditPanel } from "./audit-panel";
import { requireWebsitePlan } from "@/lib/billing/require-plan";

export const metadata = { title: "Website health" };

export const dynamic = "force-dynamic";

/**
 * Website health, and the landing section for a website.
 *
 * The layout has already resolved and authorised the site, so this loads only
 * the audit — not the seven other panels that used to share this page.
 */
export default async function WebsiteHealthPage({
  params,
}: PageProps<"/websites/[websiteId]">) {
  const { websiteId } = await params;
  const ctx = await requireWebsitePage(websiteId);
  const { site, userId } = ctx;
  const { t } = await getAppMessages(userId);
  // Paywall. See lib/billing/require-plan.ts. An owner gets requirePlan on
  // the workspace that pays for this site, exactly as before. A guest is
  // judged on this website alone and, if its owner's plan has lapsed, is
  // sent to the dashboard to be told so - never into the owner's checkout.
  await requireWebsitePlan(ctx);
  const auditData = await getLatestAudit(site.id);

  return (
    <AuditPanel
      websiteId={site.id}
      domain={site.domain}
      audit={auditData.audit}
      crawl={auditData.crawl}
      t={t.app.common}
    />
  );
}
