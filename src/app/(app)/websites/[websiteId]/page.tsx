import { notFound } from "next/navigation";

import { requireSession } from "@/lib/auth-guard";
import { requireWebsite, WebsiteNotFoundError } from "@/lib/tenant";
import { listArticles } from "@/lib/articles/actions";
import {
  getNetworkStatus,
  listGiven,
  listRequests,
} from "@/lib/backlinks/actions";
import { BacklinksPanel } from "./backlinks-panel";
import { listCalendar, listKeywords } from "@/lib/keywords/actions";
import { ResearchTabs } from "./research-tabs";
import { WebsiteDetailClient } from "./website-detail-client";

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

  const [keywordRows, calendarRows, articleRows, network, requests, given] =
    await Promise.all([
      listKeywords(site.id),
      listCalendar(site.id),
      listArticles(site.id),
      getNetworkStatus(site.id),
      listRequests(site.id),
      listGiven(site.id),
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
      <BacklinksPanel
        websiteId={site.id}
        status={network}
        requests={requests}
        given={given}
      />
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
