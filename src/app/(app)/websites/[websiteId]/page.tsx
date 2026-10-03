import type { Metadata } from "next";

import { isEntitledToSpend } from "@/lib/billing/entitled";
import { requireWebsitePlan } from "@/lib/billing/require-plan";
import { SUPPORT_EMAIL, hasRealSupportEmail } from "@/lib/config/site";
import { getAppMessages } from "@/lib/i18n/app-locale";
import { requireWebsitePage } from "@/lib/tenant";

import { AuditPanel } from "./audit-panel";
import { loadHealthData } from "./health-data";
import {
  deriveRun,
  discoveredFor,
  localiseStartError,
  parseQuery,
  parseSeverityFilter,
} from "./health-model";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/websites/[websiteId]">): Promise<Metadata> {
  const { websiteId } = await params;
  // requireWebsite is request-cached, so this is the page's own guard, not a second one.
  const { userId } = await requireWebsitePage(websiteId);
  const { t } = await getAppMessages(userId);
  return { title: t.app.health.title };
}

/**
 * Website health, and the landing section for a website.
 *
 * The layout has already resolved and authorised the site. This page only
 * READS: the latest audit and its findings, the crawl row and whether a
 * requested check is still waiting (health-data.ts), plus - for an owner or
 * editor - whether the site may start a check, so a refusal is explained up
 * front instead of after a press. Nothing here starts a check or spends.
 */
export default async function WebsiteHealthPage({
  params,
  searchParams,
}: PageProps<"/websites/[websiteId]">) {
  const { websiteId } = await params;
  const ctx = await requireWebsitePage(websiteId);
  const { site, userId, access } = ctx;
  // Paywall. See lib/billing/require-plan.ts. An owner gets requirePlan on
  // the workspace that pays for this site, exactly as before. A guest is
  // judged on this website alone and, if its owner's plan has lapsed, is
  // sent to the dashboard to be told so - never into the owner's checkout.
  await requireWebsitePlan(ctx);

  const canEdit = access !== "viewer";
  // startAudit refuses a site still being onboarded; say so instead of offering the button.
  const siteNotReady = site.status === "pending" || site.status === "crawling";

  const [data, entitlement, { t, locale }, query] = await Promise.all([
    loadHealthData(site.id),
    // Asked per WEBSITE, as startAudit asks it: an owner can open an unpaid
    // second site because the workspace gate passed, and a check would then
    // be refused.
    canEdit && !siteNotReady ? isEntitledToSpend(site.id) : Promise.resolve(null),
    getAppMessages(userId),
    searchParams,
  ]);

  const health = t.app.health;
  const blockedReason = !canEdit
    ? null
    : siteNotReady
      ? health.siteNotReady
      : entitlement && !entitlement.ok
        ? localiseStartError(entitlement.error, health, t.app.workspace)
        : null;

  return (
    <AuditPanel
      websiteId={site.id}
      domain={site.domain}
      audit={data.audit}
      run={deriveRun({
        crawl: data.crawl,
        requestedAt: data.requestedAt,
        auditCreatedAt: data.audit?.createdAt ?? null,
      })}
      discovered={discoveredFor(data.audit, data.crawl)}
      canEdit={canEdit}
      blockedReason={blockedReason}
      supportEmail={hasRealSupportEmail() ? SUPPORT_EMAIL : null}
      initialSeverity={parseSeverityFilter(query.severity)}
      initialQuery={parseQuery(query.q)}
      locale={locale}
      t={health}
      tw={t.app.workspace}
    />
  );
}
