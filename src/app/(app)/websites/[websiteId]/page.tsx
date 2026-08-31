import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-header";
import { requireSession } from "@/lib/auth-guard";
import { requireWebsite, WebsiteNotFoundError } from "@/lib/tenant";
import {
  getAnalyticsConnection,
  getPerformance,
} from "@/lib/analytics/actions";
import { listArticles } from "@/lib/articles/actions";
import { getBrandVoice } from "@/lib/brand/actions";
import { getLatestAudit } from "@/lib/audit/actions";
import {
  getNetworkStatus,
  listGiven,
  listRequests,
} from "@/lib/backlinks/actions";
import { listCalendar, listKeywords } from "@/lib/keywords/actions";
import { getIntegration } from "@/lib/publishing/actions";
import { AnalyticsPanel } from "./analytics-panel";
import { AuditPanel } from "./audit-panel";
import { BacklinksPanel } from "./backlinks-panel";
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
   * failing loudly. After resolving one, check that the panels rendered below
   * still cover every feature the branch is supposed to have.
   */
  const [
    keywordRows,
    calendarRows,
    articleRows,
    auditData,
    integration,
    connection,
    performance,
    network,
    requests,
    given,
    voice,
  ] = await Promise.all([
    listKeywords(site.id),
    listCalendar(site.id),
    listArticles(site.id),
    getLatestAudit(site.id),
    getIntegration(site.id),
    getAnalyticsConnection(site.id),
    getPerformance(site.id),
    getNetworkStatus(site.id),
    listRequests(site.id),
    listGiven(site.id),
    getBrandVoice(site.id),
  ]);

  const analysed = site.status === "ready";

  return (
    /**
     * One shell, one header, then the panels in order of what the customer
     * cares about first: what is wrong, what is working, then the plumbing.
     * Each panel previously repeated its own centred container, so the page
     * was a stack of disconnected cards rather than one page.
     */
    <PageShell>
      <div className="space-y-3">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/websites">
            <ArrowLeft className="size-4" />
            All websites
          </Link>
        </Button>

        <PageHeader
          title={site.brandName || site.domain}
          actions={
            !analysed ? (
              <Badge variant="secondary">Still setting up</Badge>
            ) : null
          }
        />

        <a
          href={site.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
        >
          {site.domain}
          <ExternalLink className="size-3" aria-hidden="true" />
        </a>
      </div>

      <AuditPanel
        websiteId={site.id}
        audit={auditData.audit}
        crawl={auditData.crawl}
      />

      <ResearchTabs
        websiteId={site.id}
        keywords={keywordRows}
        calendar={calendarRows}
        articles={articleRows}
        researching={site.status === "researching"}
      />

      <AnalyticsPanel
        websiteId={site.id}
        connection={connection}
        performance={performance}
      />

      <BacklinksPanel
        websiteId={site.id}
        status={network}
        requests={requests}
        given={given}
      />

      <WordPressPanel websiteId={site.id} integration={integration} />

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
        voice={voice}
      />
    </PageShell>
  );
}
