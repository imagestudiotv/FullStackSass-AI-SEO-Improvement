import { Coins, Gift } from "lucide-react";
import Link from "next/link";

import { CreditsMenu } from "@/components/credits-menu";
import { DailyClaim } from "@/components/daily-claim";
import { creditOverviewForRequest } from "@/lib/credits/overview-request";
import type { Locale } from "@/lib/i18n/config";
import { DAILY_CLAIM_COPY } from "@/lib/i18n/daily-claim";
import { format, plural } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages";

/**
 * The bottom of the sidebar (client design, 2026-11-02): "Earn Credits" (it
 * replaces "Referral program" and opens its own page, /earn-credits), the
 * daily check-in when there is one to do or to look back on, then the balance
 * and today's daily credits, to the Credits page.
 *
 * Server component: it reads the workspace's ledger, which does not belong
 * in a client bundle.
 */
export async function SidebarUsage({
  organizationId,
  showCredits = true,
  locale,
  t,
  tc,
}: {
  organizationId: string;
  /**
   * False while the selected website is one shared with this person, or when
   * they own nothing. `organizationId` is the reader's OWN workspace: beside a
   * site someone else owns, its balance says they have credits to use where
   * they have none (spending there is charged to the owner). Skipping it also
   * skips the monthly grant check, pointless on a render that shows nothing.
   */
  showCredits?: boolean;
  locale: Locale;
  /** Passed in: the language belongs to the person, not the workspace. */
  t: Messages["app"]["nav"];
  /** The two credit phrases, from the Credits page's words. */
  tc: Pick<Messages["app"]["credits"], "creditsCount" | "sidebarDaily">;
}) {
  const credits = showCredits ? await creditOverviewForRequest(organizationId).catch(() => null) : null;
  const creditLabel = credits ? plural(tc.creditsCount, credits.available) : null;
  // Today's daily credits (lib/credits/daily.ts), once the customer has checked in.
  const dailyToday = credits && credits.daily.today > 0 ? format(tc.sidebarDaily, { count: credits.daily.today }) : null;

  return (
    <div className="space-y-1 border-t px-3 py-3">
      <Link
        href="/earn-credits"
        className="flex items-center gap-3 rounded-md bg-primary/10 px-3 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/15"
      >
        <Gift className="size-4 shrink-0 text-primary" aria-hidden="true" />
        {t.earnCredits}
      </Link>
      {credits ? <DailyClaim status={credits.daily} copy={DAILY_CLAIM_COPY[locale]} locale={locale} variant="row" /> : null}
      {creditLabel ? (
        <Link
          href="/credits"
          title={dailyToday ? `${creditLabel} (${dailyToday})` : creditLabel}
          className="flex items-center gap-2 rounded-md px-3 py-1 text-xs text-muted-foreground transition-colors hover:text-accent-foreground"
        >
          <Coins className="size-3.5 shrink-0" aria-hidden="true" />
          {/* Never shortened: "47 cre…" hides the one word that says what the number is. */}
          <span className="whitespace-nowrap">{creditLabel}</span>
          {dailyToday ? <span className="ml-auto font-semibold whitespace-nowrap text-primary">{dailyToday}</span> : null}
        </Link>
      ) : null}
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
