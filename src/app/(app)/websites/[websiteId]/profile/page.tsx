import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { competitors } from "@/lib/db/schema";
import { requireWebsitePage } from "@/lib/tenant";
import { getAppMessages } from "@/lib/i18n/app-locale";
import { WebsiteDetailClient } from "../website-detail-client";
import { CompetitorsCard } from "./competitors-card";
import { requireWebsitePlan } from "@/lib/billing/require-plan";

export const metadata = { title: "Website profile" };

export const dynamic = "force-dynamic";

export default async function WebsiteProfilePage({
  params,
}: PageProps<"/websites/[websiteId]/profile">) {
  const { websiteId } = await params;
  const ctx = await requireWebsitePage(websiteId);
  const { site, userId } = ctx;
  const { t } = await getAppMessages(userId);
  // Paywall. See lib/billing/require-plan.ts. An owner gets requirePlan on
  // the workspace that pays for this site, exactly as before. A guest is
  // judged on this website alone and, if its owner's plan has lapsed, is
  // sent to the dashboard to be told so - never into the owner's checkout.
  await requireWebsitePlan(ctx);
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
        tCommon={t.app.common}
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
