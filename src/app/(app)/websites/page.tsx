import { requireSession } from "@/lib/auth-guard";
import { getAppMessages } from "@/lib/i18n/app-locale";
import { requirePlan } from "@/lib/billing/require-plan";
import { requireOrg } from "@/lib/tenant";
import { listWebsites } from "@/lib/websites/actions";
import { WebsitesClient } from "./websites-client";

export const metadata = { title: "Websites" };

// Status changes as crawls run; never serve a cached list.
export const dynamic = "force-dynamic";

export default async function WebsitesPage() {
  const session = await requireSession();
  const { orgId } = await requireOrg();
  // Paywall. See lib/billing/require-plan.ts.
  await requirePlan(orgId);

  /**
   * No limit to report. Each website is billed on its own subscription, so
   * there is no plan-level cap on how many a workspace may add — a new site
   * simply cannot generate anything until it has a plan.
   */
  const sites = await listWebsites();
  const { t } = await getAppMessages(session.user.id);

  return <WebsitesClient websites={sites} t={t.app.websites} />;
}
