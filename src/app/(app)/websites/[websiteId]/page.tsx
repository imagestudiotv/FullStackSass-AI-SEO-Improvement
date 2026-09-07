import { requireWebsite } from "@/lib/tenant";
import { getLatestAudit } from "@/lib/audit/actions";
import { AuditPanel } from "./audit-panel";

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
  const { site } = await requireWebsite(websiteId);
  const auditData = await getLatestAudit(site.id);

  return (
    <AuditPanel
      websiteId={site.id}
      domain={site.domain}
      audit={auditData.audit}
      crawl={auditData.crawl}
    />
  );
}
