import { BacklinksSubnav } from "@/components/reports/backlinks-subnav";
import { getAppMessages } from "@/lib/i18n/app-locale";
import { requireWebsitePage } from "@/lib/tenant";

/** Backlinks sections of one website: Overview, Earned Backlinks, Hosted links, Credit activity. */
export default async function BacklinksLayout({
  children,
  params,
}: LayoutProps<"/websites/[websiteId]/backlinks">) {
  const { websiteId } = await params;
  const { site, userId } = await requireWebsitePage(websiteId);
  const { t } = await getAppMessages(userId);
  const r = t.app.reports;
  return (
    <div className="space-y-6">
      <BacklinksSubnav
        websiteId={site.id}
        labels={{ nav: r.subnavLabel, overview: r.navOverview, earned: r.navEarned, hosted: r.navHosted, credits: r.navCredits }}
      />
      {children}
    </div>
  );
}
