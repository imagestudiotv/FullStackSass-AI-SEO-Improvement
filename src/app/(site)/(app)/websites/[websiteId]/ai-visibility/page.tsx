import type { Metadata } from "next";

import { isAiConfigured } from "@/lib/ai/client";
import { isEntitledToSpend } from "@/lib/billing/entitled";
import { requireWebsitePlan } from "@/lib/billing/require-plan";
import { getGeoOverview } from "@/lib/geo/actions";
import { maxPromptsFor } from "@/lib/geo/allowance";
import { getAppMessages } from "@/lib/i18n/app-locale";
import { requireWebsitePage } from "@/lib/tenant";

import { GeoPanel } from "../geo-panel";
import { loadVisibilityDetails } from "./details";
import { localiseGeoError, parseFilter } from "./visibility-state";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/websites/[websiteId]/ai-visibility">): Promise<Metadata> {
  const { websiteId } = await params;
  // requireWebsite is request-cached, so this is the page's own guard, not a second one.
  const { userId } = await requireWebsitePage(websiteId);
  const { t } = await getAppMessages(userId);
  return { title: t.app.geo.aiVisibility };
}

export default async function WebsiteAiVisibilityPage({
  params,
  searchParams,
}: PageProps<"/websites/[websiteId]/ai-visibility">) {
  const { websiteId } = await params;
  const ctx = await requireWebsitePage(websiteId);
  const { site, userId, access } = ctx;
  // Paywall. See lib/billing/require-plan.ts. An owner gets requirePlan on
  // the workspace that pays for this site, exactly as before. A guest is
  // judged on this website alone and, if its owner's plan has lapsed, is
  // sent to the dashboard to be told so - never into the owner's checkout.
  await requireWebsitePlan(ctx);

  const canEdit = access !== "viewer";

  /*
    Everything here only READS. The extra reads are bounded (details.ts) and
    run side by side; none of them starts a check or a suggestion.

    Entitlement is asked per WEBSITE, as the actions ask it: an owner can open
    an unpaid second site because the workspace gate passed, and Check now /
    Suggest would then be refused - so the page says why up front instead.
  */
  const [overview, details, allowance, entitlement, { t, locale }, query] = await Promise.all([
    getGeoOverview(site.id),
    loadVisibilityDetails(site.id),
    maxPromptsFor(site.id),
    canEdit ? isEntitledToSpend(site.id) : Promise.resolve(null),
    getAppMessages(userId),
    searchParams,
  ]);

  const blockedReason = !canEdit
    ? null
    : !isAiConfigured()
      ? t.app.geo.errAiUnavailable
      : entitlement && !entitlement.ok
        ? localiseGeoError(entitlement.error, t.app.geo, t.app.workspace)
        : null;

  return (
    <GeoPanel
      websiteId={site.id}
      overview={overview}
      details={details}
      allowance={allowance}
      canEdit={canEdit}
      blockedReason={blockedReason}
      initialFilter={parseFilter(query.show)}
      locale={locale}
      t={t.app.geo}
      tCommon={t.app.common}
      tw={t.app.workspace}
    />
  );
}
