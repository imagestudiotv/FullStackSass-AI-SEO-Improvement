import { DailyClaim } from "@/components/daily-claim";
import { creditOverviewForRequest } from "@/lib/credits/overview-request";
import type { Locale } from "@/lib/i18n/config";
import { DAILY_CLAIM_COPY } from "@/lib/i18n/daily-claim";
import { requireOrg } from "@/lib/tenant";

/**
 * The dashboard's daily check-in banner (client design, 2026-11-05). It stays
 * once today's is claimed, saying so from what the ledger holds, as the design
 * does. On a plan without daily credits there is nothing to say and it is not
 * shown. The reader's own workspace, as the claim is; the page shows it only
 * beside a site they own.
 */
export async function DailyClaimBanner({ locale }: { locale: Locale }) {
  const { orgId } = await requireOrg();
  const credits = await creditOverviewForRequest(orgId).catch(() => null);
  if (!credits?.daily.eligible || credits.daily.perDay <= 0) return null;
  return <DailyClaim status={credits.daily} copy={DAILY_CLAIM_COPY[locale]} locale={locale} variant="banner" />;
}
