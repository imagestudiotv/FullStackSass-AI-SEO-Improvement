import { ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, ExternalLink, Search } from "lucide-react";
import type { ReactNode } from "react";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Notice } from "@/components/workspace/notice";
import { WorkspaceSection, WorkspaceSubsection } from "@/components/workspace/section";
import type { AnalyticsConnection } from "@/lib/analytics/actions";
import type { Locale } from "@/lib/i18n/config";
import { format, formatDate } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

import { GoogleDailyChart } from "./daily-chart";
import { longerRangeReaches } from "./range";
import type { GoogleReport, TopCounts, TopRow } from "./report";
import {
  countChange,
  ctrChange,
  displayPageUrl,
  googleNumbers,
  positionChange,
  sourceState,
  type Change,
  type GoogleNumbers,
  type SourceState,
} from "./report-state";

type T = Messages["app"]["analytics"];

/**
 * The report half of the Google page: Search Console and Analytics as two
 * separate sections, never mixed - clicks, impressions, CTR and position are
 * Google Search figures for the whole website; sessions are visits from every
 * source. Each section says plainly when its source is not chosen, not yet
 * imported, or silent for the period, instead of printing a zero.
 *
 * A server component: numbers and dates are formatted once, on the server,
 * so nothing can differ at hydration. The chart and the tabs are the only
 * client islands.
 */
export function GoogleReportSections({
  report,
  connection,
  canEdit,
  locale,
  t,
}: {
  report: GoogleReport;
  connection: AnalyticsConnection;
  canEdit: boolean;
  locale: Locale;
  t: T;
}) {
  const n = googleNumbers(locale);
  const day = (iso: string) => formatDate(`${iso}T00:00:00Z`, locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

  return (
    <>
      <SearchSection report={report} selected={Boolean(connection.searchConsoleSite)} canEdit={canEdit} locale={locale} n={n} day={day} t={t} />
      <AnalyticsSection report={report} selected={Boolean(connection.analyticsProperty)} canEdit={canEdit} locale={locale} n={n} day={day} t={t} />
    </>
  );
}

type SectionProps = {
  report: GoogleReport;
  selected: boolean;
  canEdit: boolean;
  locale: Locale;
  n: GoogleNumbers;
  day: (iso: string) => string;
  t: T;
};

function SearchSection({ report, selected, canEdit, locale, n, day, t }: SectionProps) {
  const { search, days } = report;
  const status = sourceState({ selected, through: search.through, daysReported: search.daysReported });
  const cur = search.current;
  const prev = search.previous;

  return (
    <WorkspaceSection id="google-search" icon={Search} title={t.searchTitle} description={t.searchDescription}>
      {status.state !== "ready" ? (
        <SourcePlaceholder
          state={status.state}
          source={t.searchConsoleName}
          through={search.through}
          period={{ end: report.window.end, days }}
          canEdit={canEdit}
          day={day}
          t={t}
        />
      ) : (
        <div className="space-y-6">
          <div className="space-y-3">
            {status.stale ? <Notice tone="warning">{format(t.staleSource, { source: t.searchConsoleName })}</Notice> : null}
            <ComparisonLine comparable={prev !== null} days={days} t={t} />
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricTile
                label={t.clicks}
                value={n.count(cur.clicks)}
                hint={t.clicksHint}
                change={<ChangeText change={countChange(cur.clicks, prev?.clicks ?? null)} kind="count" n={n} t={t} />}
                t={t}
              />
              <MetricTile
                label={t.impressions}
                value={n.count(cur.impressions)}
                hint={t.impressionsHint}
                change={<ChangeText change={countChange(cur.impressions, prev?.impressions ?? null)} kind="count" n={n} t={t} />}
                t={t}
              />
              <MetricTile
                label={t.ctr}
                value={n.ctr(cur.ctr)}
                hint={t.ctrHint}
                change={<ChangeText change={ctrChange(cur.ctr, prev?.ctr ?? null)} kind="points" n={n} t={t} />}
                t={t}
              />
              <MetricTile
                label={t.averagePosition}
                value={n.position(cur.position)}
                hint={t.positionHint}
                change={<ChangeText change={positionChange(cur.position, prev?.position ?? null)} kind="decimal" n={n} t={t} />}
                t={t}
              />
            </dl>
            <Freshness through={search.through} reported={search.daysReported} days={days} day={day} t={t} />
            {cur.impressions === 0 ? <p className="text-xs text-muted-foreground">{t.zeroSearch}</p> : null}
          </div>

          <WorkspaceSubsection title={t.dailyTitle} description={t.dailyDescription}>
            <GoogleDailyChart
              locale={locale}
              series={[
                {
                  key: "clicks",
                  name: t.clicks,
                  label: t.chartClicks,
                  unitLabel: t.unitClicks,
                  points: search.series.map((p) => ({ day: p.day, value: p.clicks })),
                },
                {
                  key: "impressions",
                  name: t.impressions,
                  label: t.chartImpressions,
                  unitLabel: t.unitImpressions,
                  points: search.series.map((p) => ({ day: p.day, value: p.impressions })),
                },
              ]}
              labels={{ choose: t.chartMetric, noData: t.notReported, day: t.day, instructions: t.chartInstructions, empty: t.chartEmpty }}
            />
          </WorkspaceSubsection>

          <WorkspaceSubsection title={t.topTitle}>
            <Tabs defaultValue="searches">
              <TabsList className="max-w-full overflow-x-auto">
                <TabsTrigger value="searches" className="px-3">
                  {t.topSearches}
                </TabsTrigger>
                <TabsTrigger value="pages" className="px-3">
                  {t.topPages}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="searches" className="mt-2 space-y-3">
                <p className="text-xs leading-5 text-muted-foreground">{t.topSearchesNote}</p>
                <TopTable
                  caption={t.topSearchesCaption}
                  firstHeader={t.searchTerm}
                  rows={search.topQueries}
                  rowKey={(row) => row.query}
                  first={(row) => <span className="break-words">{row.query}</span>}
                  empty={t.noSearches}
                  n={n}
                  t={t}
                />
              </TabsContent>
              <TabsContent value="pages" className="mt-2 space-y-3">
                <p className="text-xs leading-5 text-muted-foreground">{t.topPagesNote}</p>
                <TopTable
                  caption={t.topPagesCaption}
                  firstHeader={t.page}
                  rows={search.topPages}
                  rowKey={(row) => row.pageUrl}
                  first={(row) => <PageLink url={row.pageUrl} t={t} />}
                  empty={t.noPages}
                  rates
                  n={n}
                  t={t}
                />
              </TabsContent>
            </Tabs>
          </WorkspaceSubsection>
        </div>
      )}
    </WorkspaceSection>
  );
}

function AnalyticsSection({ report, selected, canEdit, locale, n, day, t }: SectionProps) {
  const { analytics, days } = report;
  const status = sourceState({ selected, through: analytics.through, daysReported: analytics.daysReported });

  return (
    <WorkspaceSection id="google-analytics" icon={BarChart3} title={t.analyticsTitle} description={t.analyticsDescription}>
      {status.state !== "ready" ? (
        <SourcePlaceholder
          state={status.state}
          source={t.analyticsName}
          through={analytics.through}
          period={{ end: report.window.end, days }}
          canEdit={canEdit}
          day={day}
          t={t}
        />
      ) : (
        <div className="space-y-5">
          {status.stale ? <Notice tone="warning">{format(t.staleSource, { source: t.analyticsName })}</Notice> : null}
          <div className="grid gap-6 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
            <div className="min-w-0 space-y-3">
              <ComparisonLine comparable={analytics.previousSessions !== null} days={days} t={t} />
              <dl>
                <MetricTile
                  label={t.sessions}
                  value={n.count(analytics.sessions)}
                  hint={t.sessionsHint}
                  change={<ChangeText change={countChange(analytics.sessions, analytics.previousSessions)} kind="count" n={n} t={t} />}
                  t={t}
                />
              </dl>
              <Freshness through={analytics.through} reported={analytics.daysReported} days={days} day={day} t={t} />
              {analytics.sessions === 0 ? <p className="text-xs text-muted-foreground">{t.zeroSessions}</p> : null}
            </div>
            <div className="min-w-0 space-y-3">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-foreground">{t.dailyTitle}</h3>
                <p className="text-sm text-muted-foreground">{t.dailyDescription}</p>
              </div>
              <GoogleDailyChart
                locale={locale}
                series={[
                  {
                    key: "sessions",
                    name: t.sessions,
                    label: t.chartSessions,
                    unitLabel: t.unitSessions,
                    points: analytics.series.map((p) => ({ day: p.day, value: p.sessions })),
                  },
                ]}
                labels={{ choose: t.chartMetric, noData: t.notReported, day: t.day, instructions: t.chartInstructions, empty: t.chartEmpty }}
              />
            </div>
          </div>
        </div>
      )}
    </WorkspaceSection>
  );
}

/* ------------------------------------------------------------------------ */

function MetricTile({ label, value, hint, change, t }: { label: string; value: string | null; hint: string; change: ReactNode; t: T }) {
  return (
    <div className="min-w-0 rounded-lg border bg-muted/20 p-4">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold break-words tabular-nums text-foreground">
        {value ?? <NotAvailable t={t} />}
      </dd>
      {change ? <dd className="mt-1">{change}</dd> : null}
      <dd className="mt-2 text-xs leading-5 text-muted-foreground">{hint}</dd>
    </div>
  );
}

/** Movement in words, arrow and colour - never colour alone. Nothing without a comparable period. */
function ChangeText({ change, kind, n, t }: { change: Change | null; kind: "count" | "decimal" | "points"; n: GoogleNumbers; t: T }) {
  if (!change) return null;
  const Icon = change.direction === "flat" ? ArrowRight : change.direction === "up" ? ArrowUpRight : ArrowDownRight;
  const text =
    change.direction === "flat"
      ? t.noChange
      : kind === "count"
        ? `${n.signedCount(change.delta)}${change.percent !== null ? ` (${n.signedPercent(change.percent)})` : ""}`
        : kind === "points"
          ? format(t.pointsChange, { value: n.signedDecimal(change.delta) })
          : n.signedDecimal(change.delta);
  return (
    <span
      className={cn(
        "inline-flex flex-wrap items-center gap-1 text-xs font-medium",
        change.improved === null
          ? "text-muted-foreground"
          : change.improved
            ? "text-emerald-700 dark:text-emerald-400"
            : "text-red-700 dark:text-red-400",
      )}
    >
      <Icon className="size-3 shrink-0" aria-hidden="true" />
      <span className="tabular-nums">{text}</span>
      {/*
        Said in words as well: the arrow gives the direction of the number,
        and for position a rising number is bad news, so colour alone would
        be the only clue to which way is good.
      */}
      {change.improved !== null ? (
        <>
          <span aria-hidden="true">·</span>
          <span>{change.improved ? t.better : t.worse}</span>
        </>
      ) : null}
    </span>
  );
}

/** A figure that cannot be worked out (a rate without impressions): a dash on screen, words for a screen reader. */
function NotAvailable({ t }: { t: T }) {
  return (
    <>
      <span aria-hidden="true">-</span>
      <span className="sr-only">{t.notAvailable}</span>
    </>
  );
}

function ComparisonLine({ comparable, days, t }: { comparable: boolean; days: number; t: T }) {
  return <p className="text-xs text-muted-foreground">{format(comparable ? t.comparedWith : t.noComparison, { days })}</p>;
}

function Freshness({ through, reported, days, day, t }: { through: string | null; reported: number; days: number; day: (iso: string) => string; t: T }) {
  return (
    <p className="text-xs text-muted-foreground">
      {through ? format(t.dataThrough, { date: day(through) }) : null}
      {reported < days ? <> · {format(t.daysReported, { reported, days })}</> : null}
    </p>
  );
}

function SourcePlaceholder({
  state,
  source,
  through,
  period,
  canEdit,
  day,
  t,
}: {
  state: Exclude<SourceState, "ready">;
  source: string;
  through: string | null;
  /** The period on screen: its last day and its length. */
  period: { end: string; days: number };
  canEdit: boolean;
  day: (iso: string) => string;
  t: T;
}) {
  // "Choose a longer period" only when one of the periods on offer would actually reach those figures.
  const latest = through
    ? format(longerRangeReaches(through, period.end, period.days) ? t.latestFrom : t.latestOnly, { date: day(through) })
    : null;
  const title =
    state === "notSelected"
      ? format(t.notSelectedTitle, { source })
      : state === "awaitingData"
        ? format(t.awaitingTitle, { source })
        : format(t.noneInPeriodTitle, { source });
  const body =
    state === "notSelected"
      ? canEdit
        ? t.notSelectedEditor
        : t.notSelectedViewer
      : state === "awaitingData"
        ? t.awaitingBody
        : (latest ?? t.awaitingBody);
  return (
    <div className="rounded-lg border border-dashed px-6 py-8 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{body}</p>
      {state === "notSelected" && canEdit ? (
        <a
          href="#google-connection"
          className="mt-3 inline-block rounded-sm text-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {t.chooseProperty}
        </a>
      ) : null}
    </div>
  );
}

function PageLink({ url, t }: { url: string; t: T }) {
  const text = displayPageUrl(url);
  // Only real web addresses become links; anything else is shown as text.
  if (!/^https?:\/\//i.test(url)) return <span className="break-all">{text}</span>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex max-w-full items-start gap-1 rounded-sm text-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className="break-all">{text}</span>
      <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="sr-only">{t.opensInNewTab}</span>
    </a>
  );
}

/**
 * One top table. CTR and position are opt-in (`rates`): only the Pages table
 * has them. The searches come from by-page-and-query rows, where a search that
 * showed two of the site's pages counts twice at two positions, so a rate
 * worked out from them would not match Search Console's per-query figures.
 * Exported for the render test, which cannot open the Pages tab.
 */
export function TopTable<R extends TopCounts & Partial<Pick<TopRow, "ctr" | "position">>>({
  caption,
  firstHeader,
  rows,
  rowKey,
  first,
  empty,
  rates = false,
  n,
  t,
}: {
  caption: string;
  firstHeader: string;
  rows: R[];
  rowKey: (row: R) => string;
  first: (row: R) => ReactNode;
  empty: string;
  /** Adds the CTR and Avg. position columns. */
  rates?: boolean;
  n: GoogleNumbers;
  t: T;
}) {
  if (rows.length === 0) {
    return <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{empty}</p>;
  }
  const number = "px-3 text-right tabular-nums";
  return (
    <div className="overflow-hidden rounded-lg border">
      <Table minWidth={rates ? "38rem" : "28rem"}>
        <caption className="sr-only">{caption}</caption>
        <TableHeader className="bg-muted/30">
          <TableRow className="hover:bg-transparent">
            <TableHead scope="col" className="px-3 text-xs text-muted-foreground">
              {firstHeader}
            </TableHead>
            <TableHead scope="col" className="px-3 text-right text-xs text-muted-foreground">
              {t.clicks}
            </TableHead>
            <TableHead scope="col" className="px-3 text-right text-xs text-muted-foreground">
              {t.impressions}
            </TableHead>
            {rates ? (
              <>
                <TableHead scope="col" className="px-3 text-right text-xs text-muted-foreground">
                  {t.ctrShort}
                </TableHead>
                <TableHead scope="col" className="px-3 text-right text-xs text-muted-foreground">
                  {t.positionShort}
                </TableHead>
              </>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={rowKey(row)}>
              <TableCell className="min-w-56 px-3 whitespace-normal">{first(row)}</TableCell>
              <TableCell className={number}>{n.count(row.clicks)}</TableCell>
              <TableCell className={number}>{n.count(row.impressions)}</TableCell>
              {rates ? (
                <>
                  <TableCell className={number}>{n.ctr(row.ctr ?? null) ?? <NotAvailable t={t} />}</TableCell>
                  <TableCell className={number}>{n.position(row.position ?? null) ?? <NotAvailable t={t} />}</TableCell>
                </>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
