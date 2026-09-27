"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { AuthorityBadge } from "@/components/reports/authority-badge";
import { LineChart } from "@/components/reports/line-chart";
import { formatValue } from "@/lib/reporting/format";
import type { Achievements, MetricKey } from "@/lib/dashboard/overview";
import { format, formatDate, formatNumber } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/config";
import type { Messages } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

type Text = Messages["app"]["reports"];

/**
 * Achievements: what the work has produced in the selected period.
 *
 * One range for everything on this card (the headline, the metric cards, the
 * chart and the details). The chart shows ONE series at a time in its own
 * unit - never money and counts on one axis. The metric and the Chart /
 * Details choice live in the URL, so they survive a refresh and can be shared.
 */
export function AchievementsSection({
  data,
  websiteId,
  initialMetric,
  initialView,
  t,
  locale,
}: {
  data: Achievements;
  websiteId: string;
  initialMetric: MetricKey;
  initialView: "chart" | "details";
  t: Text;
  locale: Locale;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [metric, setMetric] = useState<MetricKey>(initialMetric);
  const [view, setView] = useState<"chart" | "details">(initialView);

  const sync = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) next.set(k, v);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };
  const rangeHref = (range: string) => {
    const next = new URLSearchParams(params.toString());
    next.set("range", range);
    return `${pathname}?${next.toString()}`;
  };

  const currency = data.policy?.currency ?? null;
  const money = (value: number | null) => (value === null || !currency ? null : formatValue(value, { kind: "currency", currency }, locale));
  const count = (value: number | null) => (value === null ? null : formatNumber(value, locale));
  const through = (iso: string | null) => (iso ? formatDate(`${iso}T00:00:00Z`, locale, { day: "numeric", month: "short", timeZone: "UTC" }) : null);

  const cards: Array<{ key: MetricKey | null; label: string; value: string | null; help: string; empty: string; dot: string }> = [
    {
      key: "value",
      label: t.trafficValue,
      value: money(data.trafficValue),
      help: t.trafficValueHelp,
      empty: data.trafficValueReason === "search_console_not_connected" ? t.notConnected : data.trafficValueReason === "currency_mismatch" ? t.currencyMismatch : t.notConfiguredShort,
      dot: "bg-emerald-500",
    },
    { key: "backlinks", label: t.backlinkValue, value: money(data.backlinkValue), help: t.backlinkValueHelp, empty: t.notConfiguredShort, dot: "bg-blue-500" },
    { key: "articles", label: t.articlesPublished, value: count(data.articlesPublished), help: t.articlesPublishedHelp, empty: "-", dot: "bg-orange-500" },
    { key: "impressions", label: t.articleImpressions, value: count(data.impressions), help: t.articleImpressionsHelp, empty: t.notConnected, dot: "bg-amber-500" },
    { key: "clicks", label: t.articleClicks, value: count(data.clicks), help: t.articleClicksHelp, empty: t.notConnected, dot: "bg-violet-500" },
    { key: "sessions", label: t.articleSessions, value: count(data.sessions), help: t.articleSessionsHelp, empty: t.notConnected, dot: "bg-fuchsia-500" },
  ];

  const series = data.series[metric];
  const unit = metric === "value" ? (currency ? ({ kind: "currency", currency } as const) : null) : ({ kind: "count" } as const);
  const seriesLabel: Record<MetricKey, string> = {
    value: t.trafficValue,
    backlinks: t.chartActiveLinks,
    articles: t.articlesPublished,
    impressions: t.articleImpressions,
    clicks: t.articleClicks,
    sessions: t.articleSessions,
  };
  const unitLabel: Record<MetricKey, string> = {
    value: currency ?? "",
    backlinks: t.unitLinks,
    articles: t.unitArticles,
    impressions: t.unitImpressions,
    clicks: t.unitClicks,
    sessions: t.unitSessions,
  };
  const chartable = unit !== null && series.some((p) => p.value !== null);

  return (
    <section aria-labelledby="achievements-title" className="rounded-xl border bg-card p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">{t.achievements}</p>
          <h2 id="achievements-title" className="text-xl font-semibold">
            {data.totalValue !== null && currency
              ? format(t.valueHeadline, { value: formatValue(data.totalValue, { kind: "currency", currency }, locale) })
              : t.valueHeadlineUnconfigured}
          </h2>
          <p className="text-sm text-muted-foreground">{t.achievementsIntro}</p>
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <span className="text-muted-foreground">{format(t.lastNDays, { days: data.window.days })}</span>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
              {format(t.plusArticles, { n: data.articlesPublished })}
            </span>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
              {format(t.plusBacklinks, { n: data.backlinksReceived })}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <nav aria-label={t.rangeLabel}>
            <ul className="flex rounded-lg border p-0.5 text-sm">
              {(["7d", "30d", "90d", "365d"] as const).map((range) => (
                <li key={range}>
                  <Link
                    href={rangeHref(range)}
                    scroll={false}
                    aria-current={data.window.range === range ? "page" : undefined}
                    className={cn("block rounded-md px-2.5 py-1", data.window.range === range ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground")}
                  >
                    {range === "365d" ? t.range12m : format(t.rangeDays, { days: Number.parseInt(range, 10) })}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div role="group" aria-label={t.viewLabel} className="flex rounded-lg border p-0.5 text-sm">
            {(["chart", "details"] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => {
                  setView(v);
                  sync({ view: v });
                }}
                className={cn("rounded-md px-3 py-1", view === v ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground")}
              >
                {v === "chart" ? t.chart : t.details}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Metric cards: each selects its series. */}
      <div role="group" aria-label={t.metricLabel} className="mt-5 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        {cards.map((card) => (
          <button
            key={card.label}
            type="button"
            aria-pressed={metric === card.key}
            onClick={() => {
              if (!card.key) return;
              setMetric(card.key);
              sync({ metric: card.key });
            }}
            className={cn(
              "rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              metric === card.key ? "border-transparent bg-muted" : "hover:bg-muted/50",
            )}
          >
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={cn("size-2 rounded-full", card.dot)} aria-hidden="true" />
              {card.label}
            </span>
            <span className="mt-1 block text-lg font-semibold tabular-nums">{card.value ?? <span className="text-sm font-normal text-muted-foreground">{card.empty}</span>}</span>
            <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">{card.help}</span>
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <AuthorityBadge reading={data.authority} t={t} locale={locale} compact />
        <div className="rounded-lg border px-3 py-2 text-sm">
          <span className="font-medium">{t.websiteHealth}</span>{" "}
          <span className="tabular-nums">{data.healthScore !== null ? `${data.healthScore}/100` : "-"}</span>
          <p className="text-xs text-muted-foreground">{t.websiteHealthHelp}</p>
        </div>
      </div>

      {view === "chart" ? (
        <div className="mt-5">
          {chartable ? (
            <LineChart
              points={series}
              label={seriesLabel[metric]}
              unit={unit!}
              unitLabel={unitLabel[metric]}
              locale={locale}
              noDataLabel={t.noData}
              dayLabel={t.colDate}
              valueLabel={seriesLabel[metric]}
              instructions={t.chartInstructions}
            />
          ) : (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              {metric === "value" && !currency ? t.valueHeadlineUnconfigured : t.noSeries}
            </p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            {metric === "impressions" || metric === "clicks" || metric === "value"
              ? data.searchConsoleThrough
                ? format(t.searchConsoleThrough, { date: through(data.searchConsoleThrough)! })
                : t.connectSearchConsole
              : metric === "sessions"
                ? data.analyticsThrough
                  ? format(t.analyticsThrough, { date: through(data.analyticsThrough)! })
                  : t.connectAnalytics
                : t.utcDays}
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          <div className="relative overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[44rem] text-sm">
              <caption className="px-3 py-2 text-left text-xs text-muted-foreground">{t.breakdownCaption}</caption>
              <thead className="border-y bg-muted/30 text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left font-medium">{t.colArticle}</th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">{t.colFirstPublished}</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">{t.colClicks}</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">{t.colImpressions}</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">{t.colSessions}</th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">{t.colKeywordCpc}</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">{t.colValue}</th>
                </tr>
              </thead>
              <tbody>
                {data.breakdown.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">{t.noPublishedArticles}</td>
                  </tr>
                ) : (
                  data.breakdown.map((row) => (
                    <tr key={row.articleId} className="border-b last:border-b-0">
                      <td className="max-w-64 truncate px-3 py-2">
                        <Link href={`/websites/${websiteId}/articles/${row.articleId}`} className="hover:underline">{row.title}</Link>
                      </td>
                      <td className="px-3 py-2 tabular-nums text-muted-foreground">
                        {row.firstPublished ? formatDate(row.firstPublished, locale, { day: "numeric", month: "short", year: "numeric" }) : "-"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{data.searchConsoleThrough ? formatNumber(row.clicks, locale) : "-"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{data.searchConsoleThrough ? formatNumber(row.impressions, locale) : "-"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{row.sessions === null ? "-" : formatNumber(row.sessions, locale)}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {row.keyword ? `${row.keyword}${row.cpc !== null ? ` · ${formatValue(row.cpc, { kind: "currency", currency: "USD" }, locale)}` : ""}` : "-"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{money(row.value) ?? "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <details className="rounded-lg border p-3 text-sm" open>
            <summary className="cursor-pointer font-medium">{t.methodologyTitle}</summary>
            <div className="mt-2 space-y-2 text-xs text-muted-foreground">
              {data.policy ? (
                <>
                  <p>
                    {format(t.methodologyPolicy, {
                      version: data.policy.version,
                      currency: data.policy.currency,
                      date: formatDate(data.policy.effectiveFrom, locale, { day: "numeric", month: "short", year: "numeric" }),
                    })}
                  </p>
                  <p>
                    {data.policy.clickValueMode === "keyword_cpc"
                      ? t.methodologyCpc
                      : data.policy.clickValueMode === "fixed"
                        ? format(t.methodologyFixed, { rate: formatValue(data.policy.fixedClickRate ?? 0, { kind: "currency", currency: data.policy.currency }, locale) })
                        : t.methodologyNoTraffic}
                  </p>
                  <p>
                    {data.policy.backlinkRates.length > 0
                      ? format(t.methodologyBacklinks, {
                          bands: data.policy.backlinkRates
                            .map((r) => `${r.minRank === null ? t.unknownRank : `≥ ${r.minRank}`}: ${formatValue(r.value, { kind: "currency", currency: data.policy!.currency }, locale)}`)
                            .join(" · "),
                        })
                      : t.methodologyNoBacklinks}
                  </p>
                  <p>{format(t.methodologySources, { sources: data.policy.sources })}</p>
                </>
              ) : (
                <p>{t.estimateNotConfiguredHelp}</p>
              )}
              <p>{t.methodologyExcluded}</p>
              <p>{t.methodologyNotSavings}</p>
            </div>
          </details>
        </div>
      )}
    </section>
  );
}
