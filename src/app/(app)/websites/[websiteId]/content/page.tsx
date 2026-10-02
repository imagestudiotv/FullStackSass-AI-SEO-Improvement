import { requireWebsitePage } from "@/lib/tenant";
import { getAppMessages } from "@/lib/i18n/app-locale";
import { listArticles } from "@/lib/articles/actions";
import { listCalendar, listKeywords } from "@/lib/keywords/actions";
import { researchInFlight } from "@/lib/keywords/research-state";
import { ResearchTabs } from "../research-tabs";
import { requireWebsitePlan } from "@/lib/billing/require-plan";

export const metadata = { title: "Planned articles" };

export const dynamic = "force-dynamic";

export default async function WebsiteContentPage({
  params,
}: PageProps<"/websites/[websiteId]/content">) {
  const { websiteId } = await params;
  const ctx = await requireWebsitePage(websiteId);
  const { site, userId } = ctx;
  const { t } = await getAppMessages(userId);

  // Paywall. See lib/billing/require-plan.ts. An owner gets requirePlan on
  // the workspace that pays for this site, exactly as before. A guest is
  // judged on this website alone and, if its owner's plan has lapsed, is
  // sent to the dashboard to be told so - never into the owner's checkout.
  await requireWebsitePlan(ctx);
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
