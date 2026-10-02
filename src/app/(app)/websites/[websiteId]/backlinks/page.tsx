import { ArrowRight, Coins, Info, Lock, RefreshCw } from "lucide-react";
import Link from "next/link";

import { AuthorityBadge, RankPill } from "@/components/reports/authority-badge";
import { IssueBanner } from "@/components/reports/issue-banner";
import { formatValue } from "@/lib/reporting/format";
import { LifecycleBadge } from "@/components/reports/links-view";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { getPartnerNetwork } from "@/lib/backlinks/network-settings";
import { requirePlan } from "@/lib/billing/require-plan";
import { format, formatDate, plural } from "@/lib/i18n/format";
import { getAppMessages } from "@/lib/i18n/app-locale";
import {
  backlinkIssues,
  backlinkMetrics,
  listLinks,
  parseListQuery,
  resolveWindow,
  workspaceCredits,
  type LinkRow,
} from "@/lib/reporting/backlinks";
import { requireWebsitePage } from "@/lib/tenant";
import { PartnerNetworkCard } from "../partner-network-card";

export const metadata = { title: "Backlinks Overview" };
export const dynamic = "force-dynamic";

/**
 * Backlinks Overview for one website: authority, the portfolio of links it
 * has received, the workspace's credits, the Partner Network settings, and
 * the latest links in each direction. Every figure comes from the shared
 * reporting layer (lib/reporting/backlinks.ts), so it agrees with the
 * Earned Backlinks and Hosted links pages and with the dashboard.
 */
export default async function BacklinksOverviewPage({
  params,
}: PageProps<"/websites/[websiteId]/backlinks">) {
  const { websiteId } = await params;
  const ctx = await requireWebsitePage(websiteId);
  // Paywall on the OWNER's plan: see lib/billing/require-plan.ts.
  await requirePlan(ctx.ownerOrgId);
  const subject = { websiteId: ctx.site.id, orgId: ctx.ownerOrgId };
  const window = resolveWindow("30d");
  const owner = ctx.access === "owner";
  const [metrics, issues, network, credits, received, given, { t, locale }] = await Promise.all([
    backlinkMetrics({ ...subject, domain: ctx.site.domain }, window),
    backlinkIssues(subject),
    getPartnerNetwork(ctx.site.id),
    owner ? workspaceCredits(ctx.ownerOrgId) : Promise.resolve(null),
    listLinks("received", subject, { ...parseListQuery({}), pageSize: 5 }),
    listLinks("given", subject, { ...parseListQuery({}), pageSize: 5 }),
    getAppMessages(ctx.userId),
  ]);
  const r = t.app.reports;
  const base = `/websites/${ctx.site.id}/backlinks`;
  const currency = metrics.policy && metrics.policy.backlinkRates.length > 0 ? metrics.policy.currency : null;
  const short = (d: Date | null) => (d ? formatDate(d, locale, { day: "numeric", month: "short" }) : r.dateUnknown);

  const banner =
    issues.hostedArticlesMissingLink > 0
      ? {
          title: plural(r.issueHosted, issues.hostedArticlesMissingLink, { count: issues.hostedArticlesMissingLink }),
          help: r.issueHostedHelp,
          href: `${base}/hosted?issue=not_found`,
        }
      : issues.hostedNofollow > 0
        ? {
            // The host's to fix, so it comes before what partners owe this site.
            title: plural(r.issueNofollowHosted, issues.hostedNofollow, { count: issues.hostedNofollow }),
            help: r.issueNofollowHostedHelp,
            href: `${base}/hosted?issue=nofollow`,
          }
        : issues.receivedNotFound > 0
          ? {
              title: plural(r.issueReceived, issues.receivedNotFound, { count: issues.receivedNotFound }),
              help: r.issueReceivedHelp,
              href: `${base}/links?issue=not_found`,
            }
          : issues.receivedNofollow > 0
            ? {
                title: plural(r.issueNofollowReceived, issues.receivedNofollow, { count: issues.receivedNofollow }),
                help: r.issueNofollowReceivedHelp,
                href: `${base}/links?issue=nofollow`,
              }
            : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{r.overviewTitle}</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">{r.overviewIntro}</p>
        </div>
        <AuthorityBadge reading={metrics.own} t={r} locale={locale} className="shrink-0" />
      </div>

      {banner ? (
        <IssueBanner
          storageKey={`${ctx.site.id}:overview:${issues.fingerprint}`}
          title={banner.title}
          help={banner.help}
          href={banner.href}
          actionLabel={r.reviewResolve}
          dismissLabel={r.dismiss}
        />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {/* Portfolio */}
        <section aria-labelledby="portfolio-title" className="min-w-0 rounded-xl border bg-card p-5">
          <h2 id="portfolio-title" className="text-sm font-medium text-muted-foreground">{r.portfolioTitle}</h2>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="flex items-baseline gap-2">
                <span className="text-4xl font-semibold tabular-nums">{metrics.received.verified}</span>
                <Link href={`${base}/links?tab=verified`} className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">
                  {plural(r.verifiedBacklinks, metrics.received.verified)}
                </Link>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {plural(r.referringDomains, metrics.received.referringDomains, { count: metrics.received.referringDomains })}
              </p>
            </div>
            <dl className="flex gap-6 text-right">
              <div>
                <dd className="text-xl font-semibold tabular-nums">
                  {metrics.strongest?.value !== null && metrics.strongest?.value !== undefined ? metrics.strongest.value : "-"}
                </dd>
                <dt className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground" title={r.strongestHelp}>{r.strongestLink}</dt>
              </div>
              <div>
                <dd className="text-xl font-semibold tabular-nums">+{metrics.received.firstVerifiedInWindow}</dd>
                <dt className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground" title={r.newInWindowHelp}>{r.last30Days}</dt>
              </div>
            </dl>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{r.estimatedValue}</span>
            {currency && metrics.portfolioValue !== null ? (
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">{formatValue(metrics.portfolioValue, { kind: "currency", currency }, locale)}</span>
            ) : (
              <span className="text-muted-foreground">{r.estimateNotConfigured}</span>
            )}
            <details className="text-xs text-muted-foreground">
              <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Info className="size-3" aria-hidden="true" />
                {r.howEstimated}
              </summary>
              <p className="mt-1 max-w-md">
                {metrics.policy
                  ? format(r.estimateMethod, {
                      version: metrics.policy.version,
                      currency: metrics.policy.currency,
                      date: formatDate(metrics.policy.effectiveFrom, locale, { day: "numeric", month: "short", year: "numeric" }),
                      sources: metrics.policy.sources,
                    })
                  : r.estimateNotConfiguredHelp}
                {metrics.unvaluedLinks > 0 ? ` ${plural(r.unvaluedLinks, metrics.unvaluedLinks, { count: metrics.unvaluedLinks })}` : ""}
              </p>
            </details>
          </div>

          <div className="relative mt-4 overflow-x-auto">
            <table className="w-full min-w-[26rem] text-sm">
              <caption className="sr-only">{r.mostRecentLinks}</caption>
              <thead>
                <tr className="border-b font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th scope="col" className="py-2 text-left font-normal">{r.mostRecentLinks}</th>
                  <th scope="col" className="py-2 text-left font-normal">{r.colAuthority}</th>
                  <th scope="col" className="py-2 text-left font-normal">{r.colValue}</th>
                  <th scope="col" className="py-2 text-right font-normal" title={r.verifiedDateHelp}>{r.colVerified}</th>
                </tr>
              </thead>
              <tbody>
                {metrics.latest.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-sm text-muted-foreground">{r.noVerifiedYet}</td>
                  </tr>
                ) : (
                  metrics.latest.map((link) => (
                    <tr key={link.id} className="border-b last:border-b-0">
                      <td className="max-w-48 truncate py-2.5">{link.counterpartDomain ?? r.unknownWebsite}</td>
                      <td className="py-2.5"><RankPill reading={link.authority} t={r} /></td>
                      <td className="py-2.5 font-medium tabular-nums">
                        {link.value !== null && currency ? formatValue(link.value, { kind: "currency", currency }, locale) : <span className="text-muted-foreground">-</span>}
                      </td>
                      <td className="py-2.5 text-right text-xs tabular-nums text-muted-foreground">{short(link.eventAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              {format(r.pipeline, {
                publication: metrics.received.awaitingPublication,
                verification: metrics.received.awaitingVerification,
              })}
            </span>
            <Link href={`${base}/links`} className="inline-flex items-center gap-1 font-medium text-foreground underline-offset-4 hover:underline">
              {r.seeAllBacklinks} <ArrowRight className="size-3" aria-hidden="true" />
            </Link>
          </div>
        </section>

        {/* Credits */}
        <section aria-labelledby="credits-title" className="min-w-0 rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 id="credits-title" className="flex items-center gap-2 text-sm font-medium">
              <span className="flex size-7 items-center justify-center rounded-md bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300">
                <Coins className="size-4" aria-hidden="true" />
              </span>
              {r.creditsCardTitle}
            </h2>
            {owner ? (
              <Link href={`${base}/credits`} className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                {r.creditActivity} →
              </Link>
            ) : null}
          </div>
          {credits ? (
            <>
              <p className="mt-3 text-4xl font-semibold tabular-nums">{credits.available}</p>
              <p className="text-xs text-muted-foreground">
                {format(r.creditsAvailableLine, { reserved: credits.reserved, balance: credits.balance })}
              </p>
              {issues.hostedArticlesMissingLink > 0 && ctx.access !== "viewer" ? (
                <Link
                  href={`${base}/hosted?issue=not_found`}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-800 hover:bg-sky-100 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300"
                >
                  <RefreshCw className="size-3" aria-hidden="true" />
                  {plural(r.recoverFromArticles, issues.hostedArticlesMissingLink, { count: issues.hostedArticlesMissingLink })}
                </Link>
              ) : null}
              <div className="my-4 border-t" />
              <Button asChild className="w-full sm:w-auto">
                <Link href="/billing#addons">{r.buyCredits}</Link>
              </Button>
              <p className="mt-3 text-xs text-muted-foreground">{r.creditsHowItWorks}</p>
              <p className="mt-2 text-xs text-muted-foreground">{r.creditsScopeNote}</p>
            </>
          ) : (
            <p className="mt-3 flex items-start gap-2 text-sm text-muted-foreground">
              <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {r.creditsOwnerOnly}
            </p>
          )}
        </section>
      </div>

      <PartnerNetworkCard
        websiteId={ctx.site.id}
        network={network}
        /* The workspace's credits: shared by its websites, not per website. */
        credits={credits ? { available: credits.available, reserved: credits.reserved } : null}
        canEdit={ctx.access !== "viewer"}
        t={t.app.partnerNetwork}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <RecentLinks
          title={r.receivedSectionTitle}
          flow={r.receivedFlow}
          rows={received.rows}
          href={`${base}/links`}
          seeAll={plural(r.seeAllCount, received.tabCounts.all, { count: received.tabCounts.all })}
          empty={r.emptyReceived}
          t={r}
          locale={locale}
        />
        <RecentLinks
          title={r.givenSectionTitle}
          flow={r.givenFlow}
          rows={given.rows}
          href={`${base}/hosted`}
          seeAll={plural(r.seeAllCount, given.tabCounts.all, { count: given.tabCounts.all })}
          empty={r.emptyGiven}
          direction="given"
          t={r}
          locale={locale}
        />
      </div>
    </div>
  );
}

function RecentLinks({
  title,
  flow,
  rows,
  href,
  seeAll,
  empty,
  direction = "received",
  t,
  locale,
}: {
  title: string;
  flow: string;
  rows: LinkRow[];
  href: string;
  seeAll: string;
  empty: string;
  direction?: "received" | "given";
  t: Awaited<ReturnType<typeof getAppMessages>>["t"]["app"]["reports"];
  locale: Awaited<ReturnType<typeof getAppMessages>>["locale"];
}) {
  return (
    <section className="min-w-0 rounded-xl border bg-card p-5" aria-label={title}>
      <h2 className="font-medium">{title}</h2>
      <p className="text-xs text-muted-foreground">{flow}</p>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-3 divide-y">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{row.counterpartDomain ?? t.unknownWebsite}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {row.eventAt ? formatDate(row.eventAt, locale, { day: "numeric", month: "short", year: "numeric" }) : t.dateUnknown}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap justify-end gap-1">
                <LifecycleBadge lifecycle={row.lifecycle} t={t} direction={direction} />
                {row.nofollow ? <StatusBadge status="missing" tone="warning" label={t.nofollowBadge} animate={false} /> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      <Link href={href} className="mt-3 inline-flex items-center gap-1 text-xs font-medium underline-offset-4 hover:underline">
        {seeAll} <ArrowRight className="size-3" aria-hidden="true" />
      </Link>
    </section>
  );
}
