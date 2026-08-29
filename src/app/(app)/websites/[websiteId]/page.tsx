import { notFound } from "next/navigation";

import { requireSession } from "@/lib/auth-guard";
import { requireWebsite, WebsiteNotFoundError } from "@/lib/tenant";
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
    />
  );
}
