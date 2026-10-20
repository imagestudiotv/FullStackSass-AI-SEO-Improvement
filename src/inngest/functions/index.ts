/**
 * Barrel of every Inngest function.
 *
 * serve() reads this list. A function that is not in `functions` silently never
 * runs — no error, no warning — so register it here and nowhere else.
 *
 * test-retry is deliberately NOT registered. It is a demo function proving
 * step memoisation, and registering it exposes a live endpoint that anyone
 * able to send events could trigger in production. The file is kept because
 * it documents the memoisation guarantee the paid jobs depend on.
 */
import { activateExchange } from "./activate-exchange";
import { analyzeWebsite } from "./analyze-website";
import { auditWebsite } from "./audit-website";
import { blogAutopilotRun, blogAutopilotSchedule } from "./blog-autopilot";
import { checkGeo } from "./check-geo";
import { collectAuthority } from "./collect-authority";
import { generateArticle } from "./generate-article";
import { importAnalytics, importAnalyticsDaily } from "./import-analytics";
import { indexArticles } from "./index-articles";
import { partnerCommissionsSweep, partnerProviderEvent, partnerTiersDaily } from "./partner-commissions";
import { partnerWelcome } from "./partner-onboarding";
import { partnerPayoutsMonthly, partnerPayoutsSweep, partnerSettlementExecute } from "./partner-payouts";
import { partnerReconciliation } from "./partner-reconciliation";
import { billingMaintenance, deliverOutbox } from "./maintenance";
import { publishArticleJob } from "./publish-article";
import { renewalReplan } from "./renewal-replan";
import { researchKeywords } from "./research-keywords";
import { scheduledArticles } from "./scheduled-articles";
import { refreshSiteInventories } from "./site-inventory";
import { translateLiveArticles } from "./article-translations";
import { verifyBacklinks } from "./verify-backlinks";

export const functions = [
  activateExchange,
  analyzeWebsite,
  auditWebsite,
  researchKeywords,
  renewalReplan,
  generateArticle,
  verifyBacklinks,
  checkGeo,
  publishArticleJob,
  scheduledArticles,
  importAnalytics,
  importAnalyticsDaily,
  deliverOutbox,
  billingMaintenance,
  collectAuthority,
  indexArticles,
  blogAutopilotRun,
  blogAutopilotSchedule,
  refreshSiteInventories,
  translateLiveArticles,
  partnerWelcome,
  partnerProviderEvent,
  partnerCommissionsSweep,
  partnerTiersDaily,
  partnerReconciliation,
  partnerPayoutsMonthly,
  partnerSettlementExecute,
  partnerPayoutsSweep,
];
