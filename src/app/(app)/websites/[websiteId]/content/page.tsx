import { requireWebsitePage } from "@/lib/tenant";
import { getAppMessages } from "@/lib/i18n/app-locale";
import { listArticles } from "@/lib/articles/actions";
import { listCalendar, listKeywords } from "@/lib/keywords/actions";
import { researchInFlight } from "@/lib/keywords/research-state";
import { ResearchTabs } from "../research-tabs";
import { requirePlan } from "@/lib/billing/require-plan";

export const metadata = { title: "Planned articles" };

export const dynamic = "force-dynamic";

export default async function WebsiteContentPage({
  params,
}: PageProps<"/websites/[websiteId]/content">) {
  const { websiteId } = await params;
  const { ownerOrgId, site, userId } = await requireWebsitePage(websiteId);
  const { t } = await getAppMessages(userId);

  // Paywall. See lib/billing/require-plan.ts.
  // The OWNER's plan pays for this website, not the caller's own
  // workspace: a guest invited to a paid site must not be bounced to a
  // plan screen for a workspace that is not paying for it. See tenant.ts.
  await requirePlan(ownerOrgId);
  const [keywords, calendar, articles] = await Promise.all([
    listKeywords(site.id),
    listCalendar(site.id),
    listArticles(site.id),
  ]);

  return (
    <ResearchTabs
      websiteId={site.id}
      keywords={keywords}
      calendar={calendar}
      articles={articles}
      researching={researchInFlight(site)}
      t={t.app.research}
      tCalendar={t.app.calendar}
      tCommon={t.app.common}
      tStatus={t.app.status}
    />
  );
}
