import { requireSession } from "@/lib/auth-guard";
import { requireOrg } from "@/lib/tenant";
import { checkLimit } from "@/lib/usage";
import { listWebsites } from "@/lib/websites/actions";
import { WebsitesClient } from "./websites-client";

export const metadata = { title: "Websites" };

// Status changes as crawls run; never serve a cached list.
export const dynamic = "force-dynamic";

export default async function WebsitesPage() {
  await requireSession();
  const { orgId } = await requireOrg();

  const [sites, limit] = await Promise.all([
    listWebsites(),
    checkLimit(orgId, "websites"),
  ]);

  return <WebsitesClient websites={sites} limit={limit} />;
}
