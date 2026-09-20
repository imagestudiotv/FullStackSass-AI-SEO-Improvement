import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { competitors } from "@/lib/db/schema";
import { requireWebsite } from "@/lib/tenant";
import { getBrandVoice } from "@/lib/brand/actions";
import { WebsiteDetailClient } from "../website-detail-client";
import { CompetitorsCard } from "./competitors-card";

export const metadata = { title: "Website profile" };

export const dynamic = "force-dynamic";

export default async function WebsiteProfilePage({
  params,
}: PageProps<"/websites/[websiteId]/profile">) {
  const { websiteId } = await params;
  const { site } = await requireWebsite(websiteId);
  const [voice, rivals] = await Promise.all([
    getBrandVoice(site.id),
    db
      .select({ domain: competitors.domain, source: competitors.source })
      .from(competitors)
      .where(eq(competitors.websiteId, site.id)),
  ]);

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
        voice={voice}
      />

      {/*
        Competitors, which had no dashboard control at all until now — they
        were only editable inside the signup step that has moved here.
      */}
      <CompetitorsCard websiteId={site.id} competitors={rivals} />
    </div>
  );
}
