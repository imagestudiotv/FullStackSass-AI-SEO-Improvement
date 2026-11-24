import { ArrowRight, Gift } from "lucide-react";
import Link from "next/link";

import { CreditsMenu } from "@/components/credits-menu";
import { DailyClaim } from "@/components/daily-claim";
import { creditOverviewForRequest } from "@/lib/credits/overview-request";
import type { Locale } from "@/lib/i18n/config";
import { DAILY_CLAIM_COPY } from "@/lib/i18n/daily-claim";
import type { Messages } from "@/lib/i18n/messages";

/**
 * The bottom of the sidebar (client design, 2026-11-24): "Earn Credits" is the
 * one solid orange button, and the daily check-in is the quiet row under it,
 * when there is one to do or to look back on.
 *
 * The balance is not repeated here: it is in the pill beside the logo (and in
 * the top bar on a phone), with today's daily credits in its menu.
 *
 * Server component: it reads the workspace's ledger, which does not belong
 * in a client bundle.
 */
export async function SidebarUsage({
  organizationId,
  showCredits = true,
  locale,
  t,
}: {
  organizationId: string;
  /**
   * False while the selected website is one shared with this person, or when
   * they own nothing. `organizationId` is the reader's OWN workspace: beside a
   * site someone else owns, a check-in says they have credits to use where
   * they have none (spending there is charged to the owner). Skipping it also
   * skips the monthly grant check, pointless on a render that shows nothing.
   */
  showCredits?: boolean;
  locale: Locale;
  /** Passed in: the language belongs to the person, not the workspace. */
  t: Messages["app"]["nav"];
}) {
  const credits = showCredits ? await creditOverviewForRequest(organizationId).catch(() => null) : null;

  return (
    <div className="border-t px-3 py-3">
      <Link
        href="/earn-credits"
        className="flex min-h-12 items-center gap-3 rounded-xl bg-primary px-3.5 font-bold tracking-tight text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        <Gift className="size-5 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1">{t.earnCredits}</span>
        <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
      </Link>
      {credits ? <DailyClaim status={credits.daily} copy={DAILY_CLAIM_COPY[locale]} locale={locale} variant="row" /> : null}
    </div>
  );
}

/**
 * The check-in on a phone, beside the balance in the top bar, where the
 * sidebar's is inside the closed menu. Only while one is open.
 */
export async function PhoneDailyClaim({ organizationId, locale }: { organizationId: string; locale: Locale }) {
  const credits = await creditOverviewForRequest(organizationId).catch(() => null);
  if (!credits) return null;
  return <DailyClaim status={credits.daily} copy={DAILY_CLAIM_COPY[locale]} locale={locale} variant="chip" />;
}

/**
 * The balance pill beside the logo, opening the credits menu. Rendered only
 * where the layout shows credits (see SidebarUsage's showCredits).
 */
export async function SidebarCredits({
  organizationId,
  t,
  tc,
}: {
  organizationId: string;
  t: Messages["app"]["nav"];
  tc: Pick<Messages["app"]["credits"], "creditsCount" | "sidebarDaily">;
}) {
  const credits = await creditOverviewForRequest(organizationId).catch(() => null);
  if (!credits) return null;
  return (
    <CreditsMenu
      available={credits.available}
      today={credits.daily.today}
      t={{
        yourCredits: t.yourCredits,
        buyCredits: t.buyCredits,
        viewHistory: t.viewHistory,
        creditsNeverExpire: t.creditsNeverExpire,
        creditsCount: tc.creditsCount,
        sidebarDaily: tc.sidebarDaily,
      }}
    />
  );
}
