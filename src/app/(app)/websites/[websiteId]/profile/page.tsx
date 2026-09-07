import { requireWebsite } from "@/lib/tenant";
import { getBrandVoice } from "@/lib/brand/actions";
import { WebsiteDetailClient } from "../website-detail-client";

export const metadata = { title: "Website profile" };

export const dynamic = "force-dynamic";

export default async function WebsiteProfilePage({
  params,
}: PageProps<"/websites/[websiteId]/profile">) {
  const { websiteId } = await params;
  const { site } = await requireWebsite(websiteId);
  const voice = await getBrandVoice(site.id);

  return (
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
  );
}
