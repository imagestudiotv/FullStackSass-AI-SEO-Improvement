import { requireSession } from "@/lib/auth-guard";
import { getAppMessages } from "@/lib/i18n/app-locale";
import { requirePlan } from "@/lib/billing/require-plan";
import { requireOrg } from "@/lib/tenant";
import { listWebsites } from "@/lib/websites/actions";
import { listAccessibleWebsites } from "@/lib/websites/accessible";
import { WebsitesClient, type SharedWebsite } from "./websites-client";

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
  const [sites, accessible, { t }] = await Promise.all([
    listWebsites(),
    listAccessibleWebsites(),
    getAppMessages(session.user.id),
  ]);

  /*
    Websites other people shared with this person (website_members), listed
    apart from their own. Without them a guest-only account saw "No websites
    yet" here while it could open a site from the switcher.

    Mapped to what a card shows and nothing more. The list already carries no
    organization ids; the role is the only addition, and it is the access the
    tenant guard will grant on /websites/<id>, which checks again regardless.
  */
  const shared: SharedWebsite[] = accessible.flatMap((site) =>
    site.access === "owner"
      ? []
      : [
          {
            id: site.id,
            domain: site.domain,
            brandName: site.brandName,
            industry: site.industry,
            status: site.status,
            access: site.access,
          },
        ],
  );

  return <WebsitesClient
      websites={sites}
      shared={shared}
      t={t.app.websites}
      tStatus={t.app.status}
      roleLabels={{
        editor: t.app.dash.roleEditor,
        viewer: t.app.dash.roleViewer,
      }}
    />;
}
