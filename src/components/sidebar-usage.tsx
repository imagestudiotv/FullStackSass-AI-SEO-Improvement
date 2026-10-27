import { Coins, Gift, PenLine } from "lucide-react";
import Link from "next/link";

import { creditOverview } from "@/lib/credits/overview";
import { format, plural } from "@/lib/i18n/format";
import { checkLimit } from "@/lib/usage";
import { UNLIMITED } from "@/lib/usage-shared";
import type { Messages } from "@/lib/i18n/messages";

/**
 * What the plan allows, at the bottom of the sidebar.
 *
 * The brief asks for an articles-per-month figure linking to the content plan
 * and a credits figure. Both are the numbers a customer checks most often -
 * "how much have I got left" - and both used to require opening Billing to
 * find. Credits are spent across RepGet now, not only on backlinks (client,
 * 2026-10-26), so the figure says "credits" and opens the Credits page, with
 * the day's daily credits beside it once they have been given.
 *
 * Server component: it reads the org's subscription and ledger, and neither
 * belongs in a client bundle.
 */
export async function SidebarUsage({
  organizationId,
  websiteId,
  showCredits = true,
  t,
  tc,
}: {
  organizationId: string;
  /**
   * False while the selected website is one shared with this person.
   *
   * `organizationId` is the reader's OWN workspace, and the credit figure is
   * its balance. Beside an owned site that is the right number. Beside a site
   * someone else owns it is not: credits there are spent from the owner's
   * ledger, so showing the reader's own balance says they have credits to
   * use on a site where they have none. Skipping it also skips the monthly
   * grant (creditOverview -> ensureMonthlyCredits): it settles the reader's
   * own grant, which is pointless work on a render that does not show the
   * balance (the next page that does will grant it - the grant is lazy and
   * keyed, see its comment).
   */
  showCredits?: boolean;
  /**
   * Passed in rather than resolved here: this takes an organisation id, and
   * the language preference belongs to the person, not the workspace.
   */
  t: Messages["app"]["nav"];
  /** The two credit phrases, from the Credits page's words. */
  tc: Pick<Messages["app"]["credits"], "creditsCount" | "sidebarDaily">;
  /**
   * The website currently selected.
   *
   * Articles are allowed per website now, so there is no single figure for an
   * account with several sites — the sidebar reports the one the customer is
   * looking at. Credits stay account-wide: they are bought by the person and
   * spent on whichever site they choose.
   */
  websiteId: string | null;
}) {
  const [articles, credits] = await Promise.all([
    /*
      Per website, and resolved from the website's own subscription
      (checkLimit -> resolvePlan), so on a shared site this is the owner's
      allowance for that one site - the figure an editor writes against -
      and nothing about the owner's other sites.
    */
    websiteId
      ? checkLimit(websiteId, "articles").catch(() => null)
      : Promise.resolve(null),
    showCredits
      ? creditOverview(organizationId).catch(() => null)
      : Promise.resolve(null),
  ]);

  const articleLabel =
    articles === null
      ? null
      : articles.limit === UNLIMITED
        ? t.articlesUnlimited
        : format(
            // A new account's free articles (lib/billing/free-articles.ts), named as such.
            articles.freeArticles ? t.freeArticlesLeft : t.articlesLeft,
            { left: Math.max(articles.limit - articles.used, 0), limit: articles.limit },
          );
  const creditLabel = credits ? plural(tc.creditsCount, credits.available) : null;
  // Today's daily credits (lib/credits/daily.ts), given by this very render on the first page of the day.
  const dailyToday = credits && credits.daily.today > 0 ? format(tc.sidebarDaily, { count: credits.daily.today }) : null;

  return (
    <div className="mt-4 space-y-1 border-t px-3 pt-3">
      {/*
        To the referral card on Settings, where the link to copy is. It
        pointed at Billing, which has no referral link (client, 2026-10-01).
      */}
      <Link
        href="/settings#referral"
        className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent/60"
      >
        <Gift className="size-4 shrink-0 text-primary" aria-hidden="true" />
        {t.referralProgram}
      </Link>

      {/*
        Both figures on one line, divided.

        They were stacked as two rows, which spent two lines of a sidebar on
        two short numbers that answer the same question — what is left. Side
        by side they read as one allowance strip, and the divider only appears
        when there is something on each side of it.

        Each half still links where it did: articles to the content plan,
        credits to the Credits page. min-w-0 with truncate on both, so a long
        figure shortens its own half instead of pushing the other out of the
        sidebar.
      */}
      {articleLabel || creditLabel ? (
        <div className="flex items-center px-3 py-1.5 text-xs text-muted-foreground">
          {articleLabel ? (
            <Link
              href={websiteId ? `/websites/${websiteId}/content` : "/websites"}
              title={articleLabel}
              className="flex min-w-0 items-center gap-1.5 rounded-md transition-colors hover:text-accent-foreground"
            >
              <PenLine className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{articleLabel}</span>
            </Link>
          ) : null}

          {articleLabel && creditLabel ? (
            <span
              className="mx-2 h-3 w-px shrink-0 bg-border"
              role="presentation"
            />
          ) : null}

          {creditLabel ? (
            <Link
              href="/credits"
              title={dailyToday ? `${creditLabel} (${dailyToday})` : creditLabel}
              // Never shortened: "47 cre…" hides the one word that says what the number is. The article half gives way instead.
              className="flex shrink-0 items-center gap-1.5 rounded-md transition-colors hover:text-accent-foreground"
            >
              <Coins className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="whitespace-nowrap">{creditLabel}</span>
            </Link>
          ) : null}
        </div>
      ) : null}

      {/* Today's daily credits: the reason to come back tomorrow too. */}
      {dailyToday ? (
        <Link
          href="/credits"
          className="flex items-center gap-1.5 rounded-md px-3 pb-1.5 text-xs font-medium text-primary transition-colors hover:text-primary/80"
        >
          <Gift className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{dailyToday}</span>
        </Link>
      ) : null}
    </div>
  );
}
