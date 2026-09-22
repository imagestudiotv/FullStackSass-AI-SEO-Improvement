import { requireWebsite } from "@/lib/tenant";
import { getAppMessages } from "@/lib/i18n/app-locale";
import {
  getNetworkStatus,
  listGiven,
  listRequests,
} from "@/lib/backlinks/actions";
import { BacklinksPanel } from "../backlinks-panel";
import { requirePlan } from "@/lib/billing/require-plan";

export const metadata = { title: "Links from other websites" };

export const dynamic = "force-dynamic";

export default async function WebsiteBacklinksPage({
  params,
}: PageProps<"/websites/[websiteId]/backlinks">) {
  const { websiteId } = await params;
  const { orgId, site, userId } = await requireWebsite(websiteId);

  // Paywall. See lib/billing/require-plan.ts.
  await requirePlan(orgId);
  const [status, requests, given] = await Promise.all([
    getNetworkStatus(site.id),
    listRequests(site.id),
    listGiven(site.id),
  ]);
  const { t } = await getAppMessages(userId);

  return (
    <BacklinksPanel
      websiteId={site.id}
      status={status}
      requests={requests}
      given={given}
      t={t.app.backlinks}
      tCommon={t.app.common}
    />
  );
}
