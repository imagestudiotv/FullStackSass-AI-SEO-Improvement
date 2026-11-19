import { BacklinksSubnav } from "@/components/reports/backlinks-subnav";
import { getAppMessages } from "@/lib/i18n/app-locale";
import { requireWebsitePage } from "@/lib/tenant";
import { FreePlanNotice } from "@/components/free-plan/free-plan-notice";
import { isFreePlanWebsite } from "@/lib/plans/free-plan-server";

/** Backlinks sections of one website: Overview, Earned Backlinks, Hosted links, Credit activity. */
export default async function BacklinksLayout({
  children,
  params,
}: LayoutProps<"/websites/[websiteId]/backlinks">) {
  const { websiteId } = await params;
  const { site, userId, access } = await requireWebsitePage(websiteId);
  const { t, locale } = await getAppMessages(userId);
  // The Free plan hosts partner links but places none: Backlinks need an upgrade (lib/plans/free-plan.ts).
  const free = access === "owner" && (await isFreePlanWebsite(site.id));
  const r = t.app.reports;
  return (
    <div className="space-y-6">
      <BacklinksSubnav
        websiteId={site.id}
        labels={{ nav: r.subnavLabel, overview: r.navOverview, earned: r.navEarned, hosted: r.navHosted, credits: r.navCredits }}
      />
      {free ? <FreePlanNotice locale={locale} reason="lockedBacklinks" websiteId={site.id} source="backlinks" /> : null}
      {children}
    </div>
  );
}
