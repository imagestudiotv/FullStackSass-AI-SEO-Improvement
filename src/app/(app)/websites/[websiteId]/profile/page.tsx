import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { competitors } from "@/lib/db/schema";
import { requireWebsite } from "@/lib/tenant";
import { getAppMessages } from "@/lib/i18n/app-locale";
import { WebsiteDetailClient } from "../website-detail-client";
import { CompetitorsCard } from "./competitors-card";
import { requirePlan } from "@/lib/billing/require-plan";

export const metadata = { title: "Website profile" };

export const dynamic = "force-dynamic";

export default async function WebsiteProfilePage({
  params,
}: PageProps<"/websites/[websiteId]/profile">) {
  const { websiteId } = await params;
  const { orgId, site, userId } = await requireWebsite(websiteId);
  const { t } = await getAppMessages(userId);
  // Paywall. See lib/billing/require-plan.ts.
  await requirePlan(orgId);
  /*
    Brand voice is no longer read here — the form moved to Article Settings,
    and fetching it for a page that does not render it is a query per visit
    for nothing.
  */
  const rivals = await db
    .select({ domain: competitors.domain, source: competitors.source })
    .from(competitors)
    .where(eq(competitors.websiteId, site.id));

  return (
    <div className="space-y-4">
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
        t={t.app.profile}
      />

      {/*
        Competitors, which had no dashboard control at all until now — they
        were only editable inside the signup step that has moved here.
      */}
      <CompetitorsCard
        websiteId={site.id}
        competitors={rivals}
        t={t.app.common}
      />
    </div>
  );
}
