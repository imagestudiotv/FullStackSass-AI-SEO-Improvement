import { notFound } from "next/navigation";

import { requireSession } from "@/lib/auth-guard";
import { requireWebsite, WebsiteNotFoundError } from "@/lib/tenant";
import {
  getAnalyticsConnection,
  getPerformance,
} from "@/lib/analytics/actions";
import { listArticles } from "@/lib/articles/actions";
import { getLatestAudit } from "@/lib/audit/actions";
import { listCalendar, listKeywords } from "@/lib/keywords/actions";
import { getIntegration } from "@/lib/publishing/actions";
import { AnalyticsPanel } from "./analytics-panel";
import { AuditPanel } from "./audit-panel";
import { ResearchTabs } from "./research-tabs";
import { WebsiteDetailClient } from "./website-detail-client";
import { WordPressPanel } from "./wordpress-panel";

export const metadata = { title: "Website" };

export const dynamic = "force-dynamic";

export default async function WebsiteDetailPage({
  params,
}: PageProps<"/websites/[websiteId]">) {
  await requireSession();
  const { websiteId } = await params;

  // try/catch wraps ONLY the fetch: JSX returned inside a try is not covered
  // by it (React renders later), and the linter rightly rejects that shape.
  let site;
  try {
    ({ site } = await requireWebsite(websiteId));
  } catch (error) {
    // Another tenant's id is indistinguishable from a missing one, by design.
    if (error instanceof WebsiteNotFoundError) {
      notFound();
    }
    throw error;
  }

  /**
   * Every panel's data is loaded together. Each feature branch appends its own
   * entry here, so a merge conflict in this block must KEEP BOTH SIDES —
   * choosing one silently deletes a working feature from the page rather than
   * failing loudly.
   */
  const [
    keywordRows,
    calendarRows,
    articleRows,
    auditData,
    integration,
    connection,
    performance,
  ] = await Promise.all([
    listKeywords(site.id),
    listCalendar(site.id),
    listArticles(site.id),
    getLatestAudit(site.id),
    getIntegration(site.id),
    getAnalyticsConnection(site.id),
    getPerformance(site.id),
  ]);

  return (
    <>
      <WebsiteDetailClient
        website={{
          id: site.id,
          url: site.url,
          domain: site.domain,
          brandName: site.brandName,
          industry: site.industry,
          country: site.country,
          language: site.language,
          description: site.description,
          targetAudience: site.targetAudience,
          status: site.status,
        }}
      />
      <div className="mx-auto mt-6 max-w-3xl">
        <AuditPanel
          websiteId={site.id}
          audit={auditData.audit}
          crawl={auditData.crawl}
        />
      </div>
      <div className="mx-auto mt-6 max-w-3xl">
        <AnalyticsPanel
          websiteId={site.id}
          connection={connection}
          performance={performance}
        />
      </div>
      <div className="mx-auto mt-6 max-w-3xl">
        <WordPressPanel websiteId={site.id} integration={integration} />
      </div>
      <div className="mx-auto mt-6 max-w-3xl">
        <ResearchTabs
          websiteId={site.id}
          keywords={keywordRows}
          calendar={calendarRows}
          articles={articleRows}
          researching={site.status === "researching"}
        />
      </div>
    </>
  );
}
