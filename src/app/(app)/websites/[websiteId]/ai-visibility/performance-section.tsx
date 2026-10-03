"use client";

import { ArrowDown, ArrowUp, Gauge, Minus } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { WorkspaceSection, WorkspaceSubsection } from "@/components/workspace/section";
import type { GeoOverview } from "@/lib/geo/shared";
import type { Locale } from "@/lib/i18n/config";
import { format, formatNumber, plural } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages";

import { formatTime, formatWhen } from "./format-when";
import { scoreBand, staleCount, type NextStep } from "./visibility-state";

type GeoText = Messages["app"]["geo"];

const BAND = {
  good: { status: "completed", tone: "positive" },
  fair: { status: "missing", tone: "warning" },
  low: { status: "failed", tone: "critical" },
} as const;

/**
 * How the website is doing, from the existing definitions only
 * (lib/geo/score.ts via getGeoOverview): the position-weighted score and its
 * change against the previous check, how many checked questions name the
 * business, the average position when named, and when the last check ran.
 *
 * Nothing is shown before something has been measured: with no checked
 * question there is no score at all, never a zero, because "not asked" and
 * "asked and not named" mean opposite things.
 */
export function PerformanceSection({
  overview,
  latestRunStartedAt,
  previousRunAt,
  step,
  blockedReason,
  runButton,
  onAddQuestions,
  onShowNotNamed,
  locale,
  t,
  namedInsteadTitle,
}: {
  overview: GeoOverview;
  latestRunStartedAt: Date | null;
  previousRunAt: Date | null;
  step: NextStep;
  blockedReason: string | null;
  /** The page's Check now control, offered again where it is the next step. */
  runButton: ReactNode;
  onAddQuestions: () => void;
  onShowNotNamed: () => void;
  locale: Locale;
  t: GeoText;
  /** app.common.namedInstead, the heading the dashboard uses for the same list. */
  namedInsteadTitle: string;
}) {
  const tracked = overview.prompts.length;
  const checked = overview.total > 0;
  const stale = staleCount(overview.prompts, latestRunStartedAt);
  const inLatest = overview.prompts.filter((p) => p.latest).length - stale;

  return (
    <WorkspaceSection
      id="performance"
      icon={Gauge}
      title={t.performanceTitle}
      description={
        <>
          {t.performanceHelp}{" "}
          <a
            href="#method"
            className="rounded-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {t.howMeasured}
          </a>
        </>
      }
    >
      <div className="space-y-5">
        {checked ? (
          <>
            <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <ScoreTile overview={overview} previousRunAt={previousRunAt} locale={locale} t={t} />
              <Tile label={t.questionsNamingYou}>
                <dd className="mt-1 text-3xl font-semibold tabular-nums">
                  {format(t.namedOfChecked, {
                    mentions: formatNumber(overview.mentions, locale),
                    total: formatNumber(overview.total, locale),
                  })}
                </dd>
                <dd className="mt-2 text-xs text-muted-foreground">{t.namedOfCheckedHelp}</dd>
              </Tile>
              <Tile label={t.averagePosition}>
                {overview.averagePosition !== null ? (
                  <>
                    <dd className="mt-1 text-3xl font-semibold tabular-nums">
                      {format(t.positionValue, { position: formatNumber(overview.averagePosition, locale) })}
                    </dd>
                    <dd className="mt-2 text-xs text-muted-foreground">{t.whereYouAppear}</dd>
                  </>
                ) : (
                  <dd className="mt-2 text-base font-medium">{t.notYetNamed}</dd>
                )}
              </Tile>
              <Tile label={t.lastChecked}>
                {overview.lastCheckedAt ? (
                  <>
                    <dd className="mt-1 text-xl font-semibold tabular-nums">{formatWhen(overview.lastCheckedAt, locale)}</dd>
                    <dd className="text-xs text-muted-foreground tabular-nums">{formatTime(overview.lastCheckedAt, locale)}</dd>
                    {latestRunStartedAt ? (
                      <dd className="mt-2 text-xs text-muted-foreground">
                        {format(t.answeredInLatestCheck, {
                          count: formatNumber(inLatest, locale),
                          total: formatNumber(tracked, locale),
                        })}
                      </dd>
                    ) : null}
                  </>
                ) : (
                  <dd className="mt-2 text-base font-medium">{t.notCheckedYetTitle}</dd>
                )}
              </Tile>
            </dl>
            <p className="text-xs leading-5 text-muted-foreground">
              {format(t.basisNote, {
                checked: formatNumber(overview.total, locale),
                tracked: formatNumber(tracked, locale),
              })}
              {stale > 0 ? <> {plural(t.earlierAnswersNote, stale)}</> : null}
            </p>
          </>
        ) : (
          <div className="rounded-lg border border-dashed px-6 py-8 text-center">
            <p className="text-sm font-medium">{t.notCheckedYetTitle}</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{t.notCheckedYetBody}</p>
          </div>
        )}

        <div className={checked ? "grid items-start gap-4 lg:grid-cols-2" : undefined}>
          {checked ? (
            <WorkspaceSubsection title={namedInsteadTitle} description={t.competitorsHelp}>
              {overview.topCompetitors.length > 0 ? (
                <ol className="divide-y rounded-lg border">
                  {overview.topCompetitors.map((c) => (
                    <li key={c.name} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                      <span className="min-w-0 break-words font-medium">{c.name}</span>
                      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums">
                        {format(t.competitorCount, {
                          count: formatNumber(c.count, locale),
                          total: formatNumber(overview.total, locale),
                        })}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground">{t.noCompetitors}</p>
              )}
            </WorkspaceSubsection>
          ) : null}
          <NextStepPanel
            step={step}
            blockedReason={blockedReason}
            runButton={runButton}
            onAddQuestions={onAddQuestions}
            onShowNotNamed={onShowNotNamed}
            t={t}
          />
        </div>
      </div>
    </WorkspaceSection>
  );
}

function Tile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-lg border bg-muted/20 p-4">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      {children}
    </div>
  );
}

function ScoreTile({
  overview,
  previousRunAt,
  locale,
  t,
}: {
  overview: GeoOverview;
  previousRunAt: Date | null;
  locale: Locale;
  t: GeoText;
}) {
  const band = BAND[scoreBand(overview.score)];
  const bandLabel = { good: t.scoreGood, fair: t.scoreFair, low: t.scoreLow }[scoreBand(overview.score)];
  const change = overview.previousScore === null ? null : overview.score - overview.previousScore;

  return (
    <Tile label={t.visibilityScore}>
      <dd className="mt-1 flex flex-wrap items-baseline gap-x-2">
        <span className="text-3xl font-semibold tabular-nums">{formatNumber(overview.score, locale)}</span>
        <span className="text-sm text-muted-foreground">{t.scoreOutOf}</span>
      </dd>
      <dd className="mt-2">
        <StatusBadge status={band.status} tone={band.tone} label={bandLabel} />
      </dd>
      <dd className="mt-2 text-xs">
        {change === null ? (
          <span className="text-muted-foreground">{t.firstCheck}</span>
        ) : change > 0 ? (
          <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
            <ArrowUp className="size-3.5 shrink-0" aria-hidden="true" />
            {format(t.scoreUp, { change: formatNumber(change, locale) })}
          </span>
        ) : change < 0 ? (
          <span className="inline-flex items-center gap-1 text-red-700 dark:text-red-400">
            <ArrowDown className="size-3.5 shrink-0" aria-hidden="true" />
            {format(t.scoreDown, { change: formatNumber(-change, locale) })}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Minus className="size-3.5 shrink-0" aria-hidden="true" />
            {t.scoreSame}
          </span>
        )}
      </dd>
      {change !== null && previousRunAt ? (
        <dd className="mt-0.5 text-xs text-muted-foreground">
          {format(t.previousCheckOn, { date: formatWhen(previousRunAt, locale) })}
        </dd>
      ) : null}
    </Tile>
  );
}

function NextStepPanel({
  step,
  blockedReason,
  runButton,
  onAddQuestions,
  onShowNotNamed,
  t,
}: {
  step: NextStep;
  blockedReason: string | null;
  runButton: ReactNode;
  onAddQuestions: () => void;
  onShowNotNamed: () => void;
  t: GeoText;
}) {
  let text = "";
  let action: ReactNode = null;
  switch (step.kind) {
    case "viewer":
      text = t.nextViewer;
      break;
    case "waiting":
      text = t.nextWaiting;
      break;
    case "addQuestions":
      text = t.nextAddQuestions;
      action = (
        <Button variant="outline" onClick={onAddQuestions}>
          {t.nextAddQuestionsAction}
        </Button>
      );
      break;
    case "blocked":
      text = blockedReason ?? "";
      break;
    case "firstCheck":
      text = t.nextFirstCheck;
      action = runButton;
      break;
    case "unchecked":
      text = plural(t.nextUnchecked, step.count);
      action = runButton;
      break;
    case "stale":
      text = plural(t.nextStale, step.count);
      action = runButton;
      break;
    case "notNamed":
      text = plural(t.nextNotNamed, step.count);
      action = (
        <Button variant="outline" onClick={onShowNotNamed}>
          {t.nextNotNamedAction}
        </Button>
      );
      break;
    case "upToDate":
      text = t.nextUpToDate;
      break;
  }

  return (
    <div className="rounded-lg border bg-muted/20 p-4">
      <p className="text-xs font-semibold tracking-wide text-primary uppercase">{t.nextStep}</p>
      <p className="mt-1 text-sm">{text}</p>
      {action ? <div className="mt-3 flex flex-wrap gap-2">{action}</div> : null}
    </div>
  );
}
