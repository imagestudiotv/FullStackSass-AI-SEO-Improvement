import { requireWebsite } from "@/lib/tenant";
import { listArticles } from "@/lib/articles/actions";
import { listCalendar, listKeywords } from "@/lib/keywords/actions";
import { ResearchTabs } from "../research-tabs";
import { requirePlan } from "@/lib/billing/require-plan";

export const metadata = { title: "Planned articles" };

export const dynamic = "force-dynamic";

export default async function WebsiteContentPage({
  params,
}: PageProps<"/websites/[websiteId]/content">) {
  const { websiteId } = await params;
  const { orgId, site } = await requireWebsite(websiteId);

  // Paywall. See lib/billing/require-plan.ts.
  await requirePlan(orgId);
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
      researching={site.status === "researching"}
    />
  );
}
