"use client";

import {
  Eye,
  ExternalLink,
  Loader2,
  RefreshCw,
  TrendingDown,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { Messages } from "@/lib/i18n/messages";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { refreshArticle } from "@/lib/articles/refresh-actions";
import type {
  PageChange,
  TrafficPoint,
  TrafficReport,
} from "@/lib/articles/decay";
import { format, formatDate, formatNumber } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/config";
import { TrafficChart } from "@/components/traffic-chart";

/**
 * Pages losing traffic.
 *
 * Decline is slow enough to read as noise, so it usually goes unnoticed until
 * the traffic is gone. This shows the real before-and-after numbers from Search
 * Console - never an estimate - and offers the one action that fixes it.
 *
 * Three lists, most serious first: pages losing clicks, pages losing
 * visibility (ranking or appearances, which move before clicks do and are the
 * only signal for pages with few clicks), and smaller click drops to watch.
 * See lib/articles/decay.ts for the thresholds.
 *
 * A page we did not write can still be shown: it is still the customer's page.
 * It simply has no rewrite button, because there is no article of ours to
 * regenerate.
 */
export function RefreshPanel({
  websiteId,
  report,
  series,
  locale,
  t,
}: {
  websiteId: string;
  report: TrafficReport;
  /** Daily clicks across both windows. Empty when Search Console is unlinked. */
  series: TrafficPoint[];
  locale: Locale;
  /** Shared words used on several screens. */
  t: Messages["app"]["common"];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [working, setWorking] = useState<string | null>(null);

  function handleRefresh(articleId: string) {
    setWorking(articleId);
    startTransition(async () => {
      const result = await refreshArticle(websiteId, articleId);
      setWorking(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Rewriting - the new version replaces the old one");
      router.refresh();
    });
  }

  const n = (value: number) => formatNumber(value, locale);
  const pct = (fraction: number) => Math.round(Math.abs(fraction) * 100);
  const rank = (value: number) => value.toFixed(1);

  /** "12 → 4 clicks · down 67%" */
  function clicksText(page: PageChange) {
    const parts = [
      format(t.clicksChange, {
        before: n(page.clicksBefore),
        after: n(page.clicksAfter),
      }),
    ];
    if (page.clickDrop !== null && page.clickDrop !== 0) {
      parts.push(
        format(page.clickDrop > 0 ? t.percentDown : t.percentUp, {
          pct: pct(page.clickDrop),
        }),
      );
    }
    return parts.join(" · ");
  }

  /** "shown 242 → 40 times · down 83%" */
  function shownText(page: PageChange) {
    const parts = [
      format(t.shownChange, {
        before: n(page.impressionsBefore),
        after: n(page.impressionsAfter),
      }),
    ];
    if (page.impressionDrop !== null && page.impressionDrop !== 0) {
      parts.push(
        format(page.impressionDrop > 0 ? t.percentDown : t.percentUp, {
          pct: pct(page.impressionDrop),
        }),
      );
    }
    return parts.join(" · ");
  }

  /** "ranking 11.7 → 17.9", or nothing when either side is unknown. */
  function rankingText(page: PageChange) {
    if (page.positionBefore === null || page.positionAfter === null)
      return null;
    return format(t.rankingChange, {
      before: rank(page.positionBefore),
      after: rank(page.positionAfter),
    });
  }

  /** Worse means a higher position number: 11.7 → 17.9 slipped. */
  const rankingSlipped = (page: PageChange) =>
    page.positionBefore !== null &&
    page.positionAfter !== null &&
    page.positionAfter > page.positionBefore;

  function renderRow(
    page: PageChange,
    lines: { text: string | null; bad: boolean }[],
  ) {
    return (
      <li
        key={page.pageUrl}
        className="flex flex-wrap items-center justify-between gap-3 p-3"
      >
        <div className="min-w-0 flex-1">
          <a
            href={page.pageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex max-w-full items-center gap-1 text-sm font-medium hover:underline"
          >
            <span className="truncate">
              {page.articleTitle ?? pathOf(page.pageUrl)}
            </span>
            <ExternalLink className="size-3 shrink-0" aria-hidden="true" />
          </a>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {lines
              .filter((line) => line.text)
              .map((line, index) => (
                <span key={index}>
                  {index > 0 ? <span className="mx-1">·</span> : null}
                  <span
                    className={
                      line.bad ? "text-red-600 dark:text-red-400" : undefined
                    }
                  >
                    {line.text}
                  </span>
                </span>
              ))}
          </p>
        </div>

        {page.articleId ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleRefresh(page.articleId as string)}
            disabled={pending}
          >
            {working === page.articleId ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            {t.rewrite}
          </Button>
        ) : (
          // Not one of ours, so there is nothing to regenerate.
          <span className="text-xs text-muted-foreground">
            {t.notWrittenHere}
          </span>
        )}
      </li>
    );
  }

  function renderSection(
    Icon: LucideIcon,
    title: string,
    help: string,
    children: React.ReactNode,
  ) {
    return (
      <section className="space-y-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Icon className="size-4" aria-hidden="true" />
            {title}
          </h3>
          <p className="text-xs text-muted-foreground">{help}</p>
        </div>
        <ul className="divide-y rounded-xl border">{children}</ul>
      </section>
    );
  }

  const { losingClicks, losingVisibility, watch } = report;
  const nothing =
    losingClicks.length === 0 &&
    losingVisibility.length === 0 &&
    watch.length === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingDown className="size-4" aria-hidden="true" />
          {t.losingTraffic}
        </CardTitle>
        <CardDescription>{t.losingTrafficIntro}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/*
          The chart first. It answers "is my traffic falling, and when did it
          turn" - which the per-page lists below cannot show, because two
          totals have no shape.
        */}
        {series.length > 1 ? <TrafficChart series={series} /> : null}

        {report.windowEnd ? (
          <p className="text-xs text-muted-foreground">
            {format(t.windowNote, {
              date: formatDate(`${report.windowEnd}T00:00:00Z`, locale, {
                day: "numeric",
                month: "long",
                timeZone: "UTC",
              }),
            })}
          </p>
        ) : null}

        {nothing ? (
          <EmptyState
            icon={TrendingDown}
            title={t.nothingLosing}
            description={t.nothingLosingHelp}
          />
        ) : (
          <>
            {losingClicks.length > 0 ? (
              renderSection(
                TrendingDown,
                t.losingClicksTitle,
                t.losingClicksHelp,
                <>
                  {losingClicks.map((page) =>
                    renderRow(page, [
                      { text: clicksText(page), bad: true },
                      { text: rankingText(page), bad: rankingSlipped(page) },
                    ]),
                  )}
                </>,
              )
            ) : (
              // Said, not left blank: the lists below are not the same claim.
              <p className="text-sm text-muted-foreground">{t.noClickLosses}</p>
            )}

            {losingVisibility.length > 0
              ? renderSection(
                  Eye,
                  t.losingVisibilityTitle,
                  t.losingVisibilityHelp,
                  <>
                    {losingVisibility.map((page) =>
                      renderRow(page, [
                        { text: rankingText(page), bad: rankingSlipped(page) },
                        {
                          text: shownText(page),
                          bad: (page.impressionDrop ?? 0) > 0,
                        },
                        {
                          text:
                            page.clicksBefore + page.clicksAfter > 0
                              ? clicksText(page)
                              : null,
                          bad: (page.clickDrop ?? 0) > 0,
                        },
                      ]),
                    )}
                  </>,
                )
              : null}

            {watch.length > 0
              ? renderSection(
                  TrendingDown,
                  t.watchTitle,
                  t.watchHelp,
                  <>
                    {watch.map((page) =>
                      renderRow(page, [
                        { text: clicksText(page), bad: true },
                        { text: rankingText(page), bad: rankingSlipped(page) },
                      ]),
                    )}
                  </>,
                )
              : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** "/wedding/" for a full URL; the URL itself if it cannot be parsed. */
function pathOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}
