import { Coins } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";

import { Button } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-header";
import { Notice } from "@/components/workspace/notice";
import { requireSession } from "@/lib/auth-guard";
import { MAX_PLACEMENT_CREDITS, MIN_PLACEMENT_CREDITS } from "@/lib/backlinks/managed";
import { creditAddons } from "@/lib/credits/addons";
import { creditHistory, creditOverview, type CreditHistoryRow } from "@/lib/credits/overview";
import { CREDIT_ACTIONS, isCreditAction, TRIAL_CREDIT_DAYS } from "@/lib/credits/prices";
import { getAppMessages } from "@/lib/i18n/app-locale";
import { format, formatDate, plural } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages";
import { REFERRAL_REWARD_CREDITS } from "@/lib/referrals/shared";
import { requireOrg } from "@/lib/tenant";
import { cn } from "@/lib/utils";
import { hasOnlySharedWork } from "@/lib/websites/accessible";

const messagesFor = cache((userId: string) => getAppMessages(userId));

export async function generateMetadata(): Promise<Metadata> {
  const session = await requireSession();
  const { t } = await messagesFor(session.user.id);
  return { title: t.app.credits.title };
}

// The balance moves with every spend, purchase and verified link.
export const dynamic = "force-dynamic";

/**
 * The workspace's credits (client, 2026-10-26: one credit balance "spent for
 * almost everything on the website"): what can be spent now, today's free
 * credits, what each action and service costs, where credits come from, and
 * every movement. The workspace is the reader's own; a website shared with them
 * spends its owner's credits, so someone who owns no website is told so.
 */
export default async function CreditsPage({ searchParams }: PageProps<"/credits">) {
  const session = await requireSession();
  const { orgId } = await requireOrg();
  const { t, locale } = await messagesFor(session.user.id);
  const c = t.app.credits;

  if (await hasOnlySharedWork()) {
    return (
      <PageShell>
        <PageHeader title={c.title} />
        <Notice>{c.guestOnly}</Notice>
      </PageShell>
    );
  }

  const params = await searchParams;
  const requested = Number.parseInt(typeof params.page === "string" ? params.page : "1", 10);
  // In turn, not together: the overview grants this month's plan credits, and the history must include them.
  const overview = await creditOverview(orgId);
  const [history, services] = await Promise.all([
    creditHistory(orgId, { page: Number.isFinite(requested) ? requested : 1, pageSize: 25 }),
    creditAddons(),
  ]);
  const { daily, settings } = overview;
  const credits = (count: number) => plural(c.creditsCount, count);
  /*
    A trial's daily credits come on its first days only (lib/credits/daily.ts),
    so say until when - or that they have ended - rather than the paid plan's
    "each day".
  */
  const trialEnds = daily.trialEndsAt ? formatDate(daily.trialEndsAt, locale, { day: "numeric", month: "long" }) : null;
  const dailyHelp = !trialEnds
    ? daily.eligible
      ? c.dailyHelp
      : format(c.dailyPlan, { count: settings.dailyFree })
    : daily.eligible
      ? format(c.dailyTrialHelp, { count: daily.perDay, days: TRIAL_CREDIT_DAYS, date: trialEnds })
      : format(c.dailyTrialOver, { count: settings.dailyFree });

  return (
    <PageShell>
      <PageHeader
        title={c.title}
        description={c.intro}
        actions={
          <Button asChild>
            <Link href="/billing#addons">
              <Coins aria-hidden="true" />
              {c.buy}
            </Link>
          </Button>
        }
      />

      <section aria-labelledby="credit-summary" className="rounded-xl border bg-card p-5">
        <h2 id="credit-summary" className="sr-only">
          {c.summary}
        </h2>
        <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Figure label={c.available} value={overview.available} help={c.availableHelp} strong />
          {settings.dailyFree > 0 || trialEnds ? (
            <Figure
              label={c.daily}
              value={daily.eligible ? format(c.dailyValue, { count: daily.today }) : "-"}
              help={dailyHelp}
            />
          ) : null}
          <Figure label={c.reserved} value={overview.reserved} help={c.reservedHelp} />
          <Figure label={c.balance} value={overview.balance} />
        </dl>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="credit-prices" className="rounded-xl border bg-card">
          <div className="border-b px-5 py-4">
            <h2 id="credit-prices" className="font-semibold">
              {c.pricesTitle}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{c.pricesIntro}</p>
          </div>
          <ul className="divide-y">
            <PriceRow
              name={c.backlink}
              help={c.backlinkNote}
              price={format(c.backlinkPrice, { min: MIN_PLACEMENT_CREDITS, max: MAX_PLACEMENT_CREDITS })}
            />
            {CREDIT_ACTIONS.map((action) => (
              <PriceRow
                key={action}
                name={c.actions[action]}
                help={c.actionHelp[action]}
                price={settings.prices[action] > 0 ? credits(settings.prices[action]) : c.free}
              />
            ))}
            {/* Services, by their catalogue names (as on Billing). */}
            {services.map((service) => (
              <PriceRow
                key={service.id}
                name={service.name}
                help={service.kind === "quote" ? c.quoteHelp : c.serviceHelp}
                price={
                  service.kind === "quote"
                    ? format(c.servicePriceFrom, { price: credits(service.creditPrice) })
                    : credits(service.creditPrice)
                }
              />
            ))}
          </ul>
        </section>

        <section aria-labelledby="credit-sources" className="rounded-xl border bg-card">
          <div className="border-b px-5 py-4">
            <h2 id="credit-sources" className="font-semibold">
              {c.sourcesTitle}
            </h2>
          </div>
          <ul className="list-disc space-y-2 py-4 pl-10 pr-5 text-sm">
            <li>{c.sourcePlan}</li>
            <li>
              <Link href="/billing#addons" className="font-medium underline-offset-4 hover:underline">
                {c.sourcePacks}
              </Link>
            </li>
            {settings.dailyFree > 0 ? <li>{format(c.sourceDaily, { count: settings.dailyFree })}</li> : null}
            {settings.trialDailyFree > 0 ? (
              <li>{format(c.sourceTrial, { count: settings.trialDailyFree, days: TRIAL_CREDIT_DAYS })}</li>
            ) : null}
            <li>
              <Link href="/settings#referral" className="font-medium underline-offset-4 hover:underline">
                {format(c.sourceReferral, { count: REFERRAL_REWARD_CREDITS })}
              </Link>
            </li>
          </ul>
        </section>
      </div>

      <section aria-labelledby="credit-history" className="space-y-3">
        <h2 id="credit-history" className="font-semibold">
          {c.historyTitle}
        </h2>
        <div className="relative overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[40rem] text-sm">
            <caption className="sr-only">{c.historyTitle}</caption>
            <thead className="border-b bg-muted/30 text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-medium">{c.colDate}</th>
                <th scope="col" className="px-3 py-2 text-left font-medium">{c.colEntry}</th>
                <th scope="col" className="px-3 py-2 text-left font-medium">{c.colWebsite}</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">{c.colCredits}</th>
              </tr>
            </thead>
            <tbody>
              {history.rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-10 text-center text-muted-foreground">
                    {c.empty}
                  </td>
                </tr>
              ) : null}
              {history.rows.map((row) => {
                const entry = describe(row, t);
                return (
                  <tr key={row.id} className="border-b last:border-b-0">
                    <td className="px-3 py-2.5 tabular-nums text-muted-foreground">
                      {formatDate(row.at, locale, { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-medium">{entry.label}</div>
                      {entry.detail ? <div className="text-xs text-muted-foreground">{entry.detail}</div> : null}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{row.websiteDomain ?? t.app.reports.workspaceWide}</td>
                    <td
                      className={cn(
                        "px-3 py-2.5 text-right font-medium tabular-nums",
                        row.amount > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-foreground",
                      )}
                    >
                      {row.amount > 0 ? `+${row.amount}` : row.amount}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {history.pageCount > 1 ? (
          <nav aria-label={t.app.reports.paginationLabel} className="flex items-center justify-between text-sm">
            <span className="tabular-nums text-muted-foreground">
              {format(t.app.reports.pageOf, { page: history.page, pages: history.pageCount })}
            </span>
            <div className="flex gap-2">
              {history.page > 1 ? (
                <Button asChild size="sm" variant="outline">
                  <Link href={`/credits?page=${history.page - 1}`} rel="prev">
                    {t.app.reports.prev}
                  </Link>
                </Button>
              ) : (
                <Button size="sm" variant="outline" disabled>
                  {t.app.reports.prev}
                </Button>
              )}
              {history.page < history.pageCount ? (
                <Button asChild size="sm" variant="outline">
                  <Link href={`/credits?page=${history.page + 1}`} rel="next">
                    {t.app.reports.next}
                  </Link>
                </Button>
              ) : (
                <Button size="sm" variant="outline" disabled>
                  {t.app.reports.next}
                </Button>
              )}
            </div>
          </nav>
        ) : null}
      </section>
    </PageShell>
  );
}

function Figure({ label, value, help, strong }: { label: string; value: number | string; help?: string; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={cn("mt-1 font-semibold tabular-nums", strong ? "text-3xl text-primary" : "text-2xl")}>{value}</dd>
      {help ? <dd className="mt-1 text-xs text-muted-foreground">{help}</dd> : null}
    </div>
  );
}

function PriceRow({ name, help, price }: { name: string; help: string; price: string }) {
  return (
    <li className="flex items-start justify-between gap-4 px-5 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{name}</p>
        <p className="text-xs text-muted-foreground">{help}</p>
      </div>
      <p className="shrink-0 text-sm font-semibold tabular-nums">{price}</p>
    </li>
  );
}

/** What a history row says, in the reader's language; the stored note (English) only where nothing else explains it. */
function describe(row: CreditHistoryRow, t: Messages): { label: string; detail: string | null } {
  const c = t.app.credits;
  const r = t.app.reports;
  if (row.type === "spend" || row.type === "spend_refund") {
    const action =
      row.action && isCreditAction(row.action) ? c.actions[row.action] : (row.addonName ?? row.action ?? "");
    if (row.type === "spend_refund") return { label: format(c.ledgerSpendRefund, { action }), detail: null };
    if (row.addonName) return { label: format(c.ledgerAddon, { name: row.addonName }), detail: null };
    return { label: format(c.ledgerSpend, { action }), detail: null };
  }
  if (row.type === "daily_grant") return { label: c.ledgerDaily, detail: null };
  const label =
    row.type === "plan_grant" ? r.ledgerPlanGrant
    : row.type === "link_given" ? r.ledgerLinkGiven
    : row.type === "link_received" ? r.ledgerLinkReceived
    : row.type === "refund" ? r.ledgerRefund
    : row.type === "purchase" ? r.ledgerPurchase
    // A negative referral entry takes a reward back after a refund (lib/referrals/core.ts).
    : row.type === "referral" ? (row.amount < 0 ? r.ledgerReferralReversed : r.ledgerReferral)
    : row.note?.includes("no longer live") ? r.ledgerReversal
    : r.ledgerAdjustment;
  return { label, detail: row.note };
}
