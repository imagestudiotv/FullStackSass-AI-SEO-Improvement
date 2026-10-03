import { asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { cache } from "react";

import { PageHeader } from "@/components/ui/page-header";
import { requireWebsitePlan } from "@/lib/billing/require-plan";
import { db } from "@/lib/db";
import { competitors } from "@/lib/db/schema";
import { getAppMessages } from "@/lib/i18n/app-locale";
import { format } from "@/lib/i18n/format";
import { requireOrg, requireWebsitePage } from "@/lib/tenant";

import { BusinessSettings } from "./business-settings";
import { dashboardLanguageName, languageOptions, marketAliases, marketSuggestions } from "./options";

export const dynamic = "force-dynamic";

/**
 * At most this many competitors are loaded. Analysis adds up to five per run
 * and nothing caps manual adds, so the query needs a bound; one extra row is
 * read to know whether more exist.
 */
const COMPETITOR_LIMIT = 200;

/** One read of the reader's language per request, shared by the title and the page. */
const messagesFor = cache((userId: string) => getAppMessages(userId));

export async function generateMetadata(): Promise<Metadata> {
  const { userId } = await requireOrg();
  const { t } = await messagesFor(userId);
  return { title: t.app.profile.pageTitle };
}

export default async function BusinessSettingsPage({ params }: PageProps<"/websites/[websiteId]/profile">) {
  const { websiteId } = await params;
  const ctx = await requireWebsitePage(websiteId);
  const { site, userId, access } = ctx;
  const { t, locale } = await messagesFor(userId);
  // Paywall. See lib/billing/require-plan.ts. An owner gets requirePlan on
  // the workspace that pays for this site, exactly as before. A guest is
  // judged on this website alone and, if its owner's plan has lapsed, is
  // sent to the dashboard to be told so - never into the owner's checkout.
  await requireWebsitePlan(ctx);
  /*
    Brand voice is not read here - its form lives under Article Settings, and
    fetching it for a page that does not render it is a query per visit for
    nothing. Competitors in the order they were added: suggestions from the
    first analysis, then the customer's own.
  */
  const rows = await db
    .select({ domain: competitors.domain, source: competitors.source })
    .from(competitors)
    .where(eq(competitors.websiteId, site.id))
    .orderBy(asc(competitors.createdAt), asc(competitors.domain))
    .limit(COMPETITOR_LIMIT + 1);

  const tp = t.app.profile;

  return (
    <>
      <PageHeader title={tp.pageTitle} description={format(tp.pageDescription, { domain: site.domain })} />
      <BusinessSettings
        website={{
          id: site.id,
          domain: site.domain,
          brandName: site.brandName,
          industry: site.industry,
          country: site.country,
          language: site.language,
          description: site.description,
          targetAudience: site.targetAudience,
          status: site.status,
        }}
        competitors={rows.slice(0, COMPETITOR_LIMIT)}
        competitorsTruncated={rows.length > COMPETITOR_LIMIT}
        competitorLimit={COMPETITOR_LIMIT}
        // Presentation only: every action still checks requireEditor itself.
        canEdit={access !== "viewer"}
        isOwner={access === "owner"}
        languageOptions={languageOptions(locale)}
        marketSuggestions={marketSuggestions(locale)}
        marketAliases={access === "viewer" ? {} : marketAliases()}
        dashboardLanguage={dashboardLanguageName(locale)}
        t={tp}
        tw={t.app.workspace}
      />
    </>
  );
}
