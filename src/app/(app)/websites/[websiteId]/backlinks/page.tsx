import { requireWebsite } from "@/lib/tenant";
import {
  getNetworkStatus,
  listGiven,
  listRequests,
} from "@/lib/backlinks/actions";
import { BacklinksPanel } from "../backlinks-panel";

export const metadata = { title: "Links from other websites" };

export const dynamic = "force-dynamic";

export default async function WebsiteBacklinksPage({
  params,
}: PageProps<"/websites/[websiteId]/backlinks">) {
  const { websiteId } = await params;
  const { site } = await requireWebsite(websiteId);

  const [status, requests, given] = await Promise.all([
    getNetworkStatus(site.id),
    listRequests(site.id),
    listGiven(site.id),
  ]);

  return (
    <BacklinksPanel
      websiteId={site.id}
      status={status}
      requests={requests}
      given={given}
    />
  );
}
