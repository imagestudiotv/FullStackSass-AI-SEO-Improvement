import {
  ArrowRight,
  CalendarCheck,
  ChevronDown,
  Clapperboard,
  Coins,
  Gift,
  HeartPulse,
  Link2,
  type LucideIcon,
  Plus,
  Puzzle,
  Share2,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { cache, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-header";
import { Notice } from "@/components/workspace/notice";
import { requireSession } from "@/lib/auth-guard";
import { MAX_PLACEMENT_CREDITS, MIN_PLACEMENT_CREDITS } from "@/lib/backlinks/managed";
import { creditAddons } from "@/lib/credits/addons";
import {
  CREDIT_KINDS,
  creditHistory,
  creditKindOf,
  creditOverview,
  creditToday,
  type CreditHistoryRow,
  type CreditKind,
} from "@/lib/credits/overview";
import { CREDIT_ACTIONS, isCreditAction, TRIAL_CREDIT_DAYS, type CreditAction } from "@/lib/credits/prices";
import { getAppMessages } from "@/lib/i18n/app-locale";
import type { Locale } from "@/lib/i18n/config";
import { EARN_COPY } from "@/lib/i18n/earn";
import { format, formatDate, formatNumber, plural } from "@/lib/i18n/format";
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

/** Where Buy credits goes, here as in the sidebar's credits menu: the credit packs on Billing. */
const BUY_HREF = "/billing#addons";

/**
 * The actions shown before "See all" (client design, 2026-11-02), the ones
 * customers use most. Everything else - backlinks, services, an action added
 * later - is behind the toggle.
 */
const FEATURED_ACTIONS: readonly CreditAction[] = ["social_post", "video_post", "chat_message", "audit_rerun"];

const ACTION_ICONS: Record<CreditAction, LucideIcon> = {
  audit_rerun: HeartPulse,
  social_post: Share2,
  video_post: Clapperboard,
  chat_message: Sparkles,
};

/**
 * The workspace's credits (client, 2026-10-26: one credit balance "spent for
 * almost everything on the website"; laid out from the client's design of
 * 2026-11-02): what can be spent now and what came in and went out today,
 * what the most-used actions cost (and everything else behind "See all"),
 * the ways to get more, and every movement, filtered by earned or spent. The
 * workspace is the reader's own; a website shared with them spends its
 * owner's credits, so someone who owns no website is told so.
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
  const kind = creditKindOf(params.kind);
  // In turn, not together: the overview grants this month's plan credits and today's daily credits, and the history and today's figures must include them.
  const overview = await creditOverview(orgId);
  const [history, today, services] = await Promise.all([
    creditHistory(orgId, { page: Number.isFinite(requested) ? requested : 1, pageSize: 25, kind }),
    creditToday(orgId),
    creditAddons(),
  ]);
  const { daily, settings } = overview;
  const credits = (count: number) => plural(c.creditsCount, count);
  const number = (value: number) => formatNumber(value, locale);
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

  const actionRow = (action: CreditAction) => (
    <PriceRow
      key={action}
      icon={ACTION_ICONS[action]}
      name={c.actions[action]}
      help={c.actionHelp[action]}
      price={settings.prices[action] > 0 ? credits(settings.prices[action]) : c.free}
    />
  );
  const otherActions = CREDIT_ACTIONS.filter((action) => !FEATURED_ACTIONS.includes(action));

  const kindLabel: Record<CreditKind, string> = { all: c.filterAll, earned: c.filterEarned, spent: c.filterSpent };
  const empty = kind === "earned" ? c.emptyEarned : kind === "spent" ? c.emptySpent : c.empty;

  return (
    <PageShell>
      <PageHeader
        title={c.title}
        description={c.intro}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/earn-credits">
                <Gift aria-hidden="true" />
                {t.app.nav.earnCredits}
              </Link>
            </Button>
            <Button asChild>
              <Link href={BUY_HREF}>
                <Plus aria-hidden="true" />
                {c.buy}
              </Link>
            </Button>
          </>
        }
      />

      {/* The balance: what can be spent now, what backlinks hold, and today's movements. */}
      <section aria-labelledby="credit-summary" className="relative overflow-hidden rounded-2xl border bg-card p-5 sm:p-7">
        <div className="pointer-events-none absolute -top-36 -right-28 size-72 rounded-full border border-primary/15" aria-hidden="true" />
        <div className="pointer-events-none absolute -top-24 -right-16 size-48 rounded-full border border-primary/10" aria-hidden="true" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <h2 id="credit-summary" className="text-xs font-bold tracking-[0.13em] text-primary uppercase">
              {c.availableBalance}
            </h2>
            <p className="mt-3 flex flex-wrap items-baseline gap-x-2 tabular-nums">
              <span className="text-5xl font-semibold tracking-tight sm:text-6xl">{number(overview.available)}</span>
              <span className="text-base text-muted-foreground">{plural(c.creditsUnit, overview.available)}</span>
            </p>
            <p className="mt-2 text-sm text-muted-foreground">{c.availableHelp}</p>
            <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <div className="flex gap-1.5">
                <dt className="text-muted-foreground">{c.reserved}</dt>
                <dd className="font-medium tabular-nums">{number(overview.reserved)}</dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="text-muted-foreground">{c.balance}</dt>
                <dd className="font-medium tabular-nums">{number(overview.balance)}</dd>
              </div>
            </dl>
            <p className="mt-1 text-xs text-muted-foreground">{c.reservedHelp}</p>
          </div>
          <div className="w-full shrink-0 md:w-64">
            <dl className="grid grid-cols-2 gap-3 md:grid-cols-1">
              <TodayFigure
                label={c.earnedToday}
                value={today.earned > 0 ? `+${number(today.earned)}` : number(0)}
                positive={today.earned > 0}
              />
              <TodayFigure label={c.usedToday} value={number(today.used)} />
            </dl>
            <p className="mt-2 text-xs text-muted-foreground">{c.todayNote}</p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <section aria-labelledby="credit-prices" className="flex flex-col overflow-hidden rounded-2xl border bg-card">
          <div className="px-5 pt-5 sm:px-6 sm:pt-6">
            <PanelTitle id="credit-prices" icon={Sparkles} title={c.pricesTitle} />
            <p className="mt-1 text-sm text-muted-foreground">{c.pricesIntro}</p>
          </div>
          <ul className="mt-2 divide-y px-5 pb-2 sm:px-6">{FEATURED_ACTIONS.map(actionRow)}</ul>
          {/* A disclosure, so the full list needs no script and says whether it is open. */}
          <details className="group mt-auto border-t">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-5 py-3.5 text-sm font-semibold text-primary transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:px-6 [&::-webkit-details-marker]:hidden">
              <span className="group-open:hidden">{c.pricesAll}</span>
              <span className="hidden group-open:inline">{c.pricesFewer}</span>
              <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary>
            <ul className="divide-y border-t px-5 sm:px-6">
              <PriceRow
                icon={Link2}
                name={c.backlink}
                help={c.backlinkNote}
                price={format(c.backlinkPrice, { min: MIN_PLACEMENT_CREDITS, max: MAX_PLACEMENT_CREDITS })}
              />
              {otherActions.map(actionRow)}
              {/* Services, by their catalogue names (as on Billing). */}
              {services.map((service) => (
                <PriceRow
                  key={service.id}
                  icon={Puzzle}
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
          </details>
        </section>

        <section aria-labelledby="credit-sources" className="rounded-2xl border bg-card p-5 sm:p-6">
          <PanelTitle id="credit-sources" icon={Gift} title={c.sourcesTitle} />
          <p className="mt-1 text-sm text-muted-foreground">{c.sourcesIntro}</p>
          <ul className="mt-4 space-y-2.5">
            {settings.dailyFree > 0 || trialEnds ? (
              <SourceItem
                icon={Sun}
                title={c.daily}
                help={dailyHelp}
                end={
                  daily.eligible ? (
                    <span className="text-sm font-semibold whitespace-nowrap text-emerald-700 tabular-nums dark:text-emerald-400">
                      {format(c.dailyValue, { count: daily.today })}
                    </span>
                  ) : null
                }
              />
            ) : null}
            <SourceItem
              icon={Users}
              title={c.sourceReferralTitle}
              help={format(c.sourceReferral, { count: REFERRAL_REWARD_CREDITS })}
              end={<SourceLink href="/earn-credits" label={c.sourceExplore} context={c.sourceReferralTitle} />}
            />
            <SourceItem
              icon={Coins}
              title={c.sourceTopUpTitle}
              help={c.sourcePacks}
              end={<SourceLink href={BUY_HREF} label={c.sourceTopUp} context={c.buy} />}
            />
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">{c.sourcePlan}</p>
        </section>
      </div>

      {/* The sidebar's "View history" links to this id. */}
      <section aria-labelledby="credit-history" className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h2 id="credit-history" className="scroll-mt-20 text-lg font-semibold tracking-tight">
              {c.historyTitle}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{c.historyIntro}</p>
          </div>
          {/* Links, not buttons: the filter is in the URL (?kind=) and read on the server, like the page. */}
          <nav aria-label={c.filterLabel} className="flex shrink-0 gap-1 rounded-lg bg-muted p-1">
            {CREDIT_KINDS.map((option) => (
              <Link
                key={option}
                href={historyHref(option, 1)}
                scroll={false}
                aria-current={option === kind ? "true" : undefined}
                className={cn(
                  "flex-1 rounded-md px-3 py-1.5 text-center text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:flex-none",
                  option === kind && "bg-background text-foreground shadow-sm",
                )}
              >
                {kindLabel[option]}
              </Link>
            ))}
          </nav>
        </div>
        {kind === "spent" ? <p className="text-xs text-muted-foreground">{c.spentNote}</p> : null}

        {/* On a phone the date and website go under the entry, so the table never scrolls sideways. */}
        <div className="overflow-hidden rounded-xl border bg-card">
          <table className="w-full text-sm">
            <caption className="sr-only">{`${c.historyTitle}: ${kindLabel[kind]}`}</caption>
            <thead className="border-b bg-muted/30 text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="hidden px-3 py-2 text-left font-medium sm:table-cell">{c.colDate}</th>
                <th scope="col" className="px-3 py-2 text-left font-medium">{c.colEntry}</th>
                <th scope="col" className="hidden px-3 py-2 text-left font-medium sm:table-cell">{c.colWebsite}</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">{c.colCredits}</th>
              </tr>
            </thead>
            <tbody>
              {history.rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-10 text-center text-muted-foreground">
                    {empty}
                  </td>
                </tr>
              ) : null}
              {history.rows.map((row) => {
                const entry = describe(row, t, locale);
                const Icon = iconFor(row);
                // UTC, the day "today" is counted in above.
                const date = formatDate(row.at, locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
                const website = row.websiteDomain ?? t.app.reports.workspaceWide;
                return (
                  <tr key={row.id} className="border-b last:border-b-0">
                    <td className="hidden px-3 py-2.5 whitespace-nowrap text-muted-foreground tabular-nums sm:table-cell">{date}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex min-w-0 items-start gap-3">
                        <span
                          className={cn(
                            "mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg",
                            row.amount > 0
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                              : "bg-muted text-muted-foreground",
                          )}
                          aria-hidden="true"
                        >
                          <Icon className="size-4" />
                        </span>
                        <div className="min-w-0 break-words">
                          <div className="font-medium">{entry.label}</div>
                          {entry.detail ? <div className="text-xs text-muted-foreground">{entry.detail}</div> : null}
                          <div className="text-xs text-muted-foreground sm:hidden">
                            {date} · {website}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-3 py-2.5 break-all text-muted-foreground sm:table-cell">{website}</td>
                    <td
                      className={cn(
                        "px-3 py-2.5 text-right font-medium whitespace-nowrap tabular-nums",
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
          <nav aria-label={t.app.reports.paginationLabel} className="flex items-center justify-between gap-3 text-sm">
            <span className="tabular-nums text-muted-foreground">
              {format(t.app.reports.pageOf, { page: history.page, pages: history.pageCount })}
            </span>
            <div className="flex gap-2">
              {history.page > 1 ? (
                <Button asChild size="sm" variant="outline">
                  <Link href={`${historyHref(kind, history.page - 1)}#credit-history`} rel="prev">
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
                  <Link href={`${historyHref(kind, history.page + 1)}#credit-history`} rel="next">
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

/** This page with a filter and a history page; the defaults (all, page 1) are left out of the URL. */
function historyHref(kind: CreditKind, page: number): string {
  const query = new URLSearchParams();
  if (kind !== "all") query.set("kind", kind);
  if (page > 1) query.set("page", String(page));
  const search = query.toString();
  return search ? `/credits?${search}` : "/credits";
}

function TodayFigure({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-xl border bg-background px-4 py-3 md:flex-row md:items-center md:justify-between">
      <dt className="text-xs text-muted-foreground md:text-sm">{label}</dt>
      <dd
        className={cn(
          "text-lg font-semibold tabular-nums",
          positive && "text-emerald-700 dark:text-emerald-400",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function PanelTitle({ id, icon: Icon, title }: { id: string; icon: LucideIcon; title: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary" aria-hidden="true">
        <Icon className="size-4" />
      </span>
      <h2 id={id} className="font-semibold tracking-tight">
        {title}
      </h2>
    </div>
  );
}

function PriceRow({ icon: Icon, name, help, price }: { icon: LucideIcon; name: string; help: string; price: string }) {
  return (
    <li className="flex items-start justify-between gap-4 py-3">
      <div className="flex min-w-0 items-start gap-3">
        <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm font-medium">{name}</p>
          <p className="text-xs text-muted-foreground">{help}</p>
        </div>
      </div>
      <p className="shrink-0 text-sm font-semibold tabular-nums">{price}</p>
    </li>
  );
}

function SourceItem({ icon: Icon, title, help, end }: { icon: LucideIcon; title: string; help: string; end: ReactNode }) {
  return (
    <li className="flex items-center gap-3 rounded-xl border px-3 py-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground" aria-hidden="true">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{help}</p>
      </div>
      {end ? <div className="shrink-0">{end}</div> : null}
    </li>
  );
}

/** A short link ("Explore", "Top up"); `context` completes its name for a screen reader. */
function SourceLink({ href, label, context }: { href: string; label: string; context: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-sm font-semibold whitespace-nowrap text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      {label}
      <span className="sr-only">: {context}</span>
      <ArrowRight className="size-3.5" aria-hidden="true" />
    </Link>
  );
}

/** The picture beside a history row: what was bought for a spend, otherwise where the credits came from. */
function iconFor(row: CreditHistoryRow): LucideIcon {
  if (row.type === "spend" || row.type === "spend_refund") {
    return row.action && isCreditAction(row.action) ? ACTION_ICONS[row.action] : Puzzle;
  }
  switch (row.type) {
    case "daily_grant":
      return Sun;
    case "plan_grant":
      return CalendarCheck;
    case "purchase":
      return Coins;
    case "referral":
      return Users;
    case "reward":
      return Gift;
    case "link_given":
    case "link_received":
    case "refund":
      return Link2;
    default:
      return SlidersHorizontal;
  }
}

/** What a history row says, in the reader's language; the stored note (English) only where nothing else explains it. */
function describe(row: CreditHistoryRow, t: Messages, locale: Locale): { label: string; detail: string | null } {
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
  // An approved Earn Credits claim (lib/earn/admin.ts); its note names the way, in English.
  if (row.type === "reward") return { label: EARN_COPY[locale].ledgerReward, detail: null };
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
