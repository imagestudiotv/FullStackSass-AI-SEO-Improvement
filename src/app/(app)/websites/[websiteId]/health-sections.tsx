/*
  eslint-disable @next/next/no-img-element --
  The preview image is on the CUSTOMER's domain, which is not knowable ahead
  of time. next/image needs every remote host in remotePatterns, so
  optimising it would mean a wildcard - which turns our optimiser into an
  open image proxy. Same reasoning as the public audit.
*/
"use client";

import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  Gauge,
  Globe,
  ImageOff,
  Lightbulb,
  Loader2,
  OctagonAlert,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Notice } from "@/components/workspace/notice";
import { WorkspaceSection, WorkspaceSubsection } from "@/components/workspace/section";
import type { AuditContext } from "@/lib/audit/rules";
import type { Locale } from "@/lib/i18n/config";
import { format, formatNumber } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";

import {
  PAGES_PER_CHECK,
  countText,
  formatWhen,
  scoreBand,
  type HealthRun,
  type HealthText,
  type ScoreBand,
  type Severity,
  type SeverityTotals,
} from "./health-model";

/* ------------------------------------------------------------------------- */
/* Shared marks                                                               */
/* ------------------------------------------------------------------------- */

/** The StatusBadge tones (components/ui/status-badge.tsx), so severity reads like every other status. */
const TONE = {
  critical: "border-red-200 bg-red-50 text-red-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  neutral: "border-transparent bg-muted text-muted-foreground",
  positive: "border-emerald-200 bg-emerald-50 text-emerald-700",
} as const;

const SEVERITY_META: Record<Severity, { icon: LucideIcon; tone: keyof typeof TONE; bar: string; iconClass: string }> = {
  critical: { icon: OctagonAlert, tone: "critical", bar: "bg-red-500", iconClass: "text-red-600" },
  warning: { icon: AlertTriangle, tone: "warning", bar: "bg-amber-500", iconClass: "text-amber-600" },
  info: { icon: Lightbulb, tone: "neutral", bar: "bg-muted-foreground/40", iconClass: "text-muted-foreground" },
};

export function severityLabel(severity: Severity, t: HealthText): string {
  return severity === "critical" ? t.critical : severity === "warning" ? t.warnings : t.suggestions;
}

/**
 * One finding's severity as an icon AND a word - never colour alone. In the
 * singular ("Warning"), where the filters and totals use the plural.
 */
export function SeverityBadge({ severity, t }: { severity: Severity; t: HealthText }) {
  const meta = SEVERITY_META[severity];
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        TONE[meta.tone],
      )}
    >
      <Icon className="size-3" aria-hidden="true" />
      {t.badge[severity]}
    </span>
  );
}

/** Marks a section of a report that a newer check is replacing or failed to replace. */
export function PreviousResultPill({ t }: { t: HealthText }) {
  return (
    <span className="rounded-full border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
      {t.previousResult}
    </span>
  );
}

/* ------------------------------------------------------------------------- */
/* Where the latest run stands                                                */
/* ------------------------------------------------------------------------- */

function InlineSpinner() {
  return <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />;
}

/**
 * Queued, running (with the crawler's own counts - no percentage, because
 * the number of pages a crawl will read is not known until it ends), failed,
 * or just finished. The notice has no live role: its counts change every few
 * seconds, and AuditPanel announces only changes of phase.
 */
export function RunStatus({
  run,
  previousAt,
  finishedAt,
  canEdit,
  onRefresh,
  locale,
  t,
}: {
  run: HealthRun;
  /** The date of the audit on screen, when there is one. */
  previousAt: string | null;
  /** Set when a run followed on this page has just produced a new report. */
  finishedAt: string | null;
  /** False for a viewer, who can refresh the view but not start a check. */
  canEdit: boolean;
  onRefresh: () => void;
  locale: Locale;
  t: HealthText;
}) {
  /*
    A run that stopped moving is no longer polled, so the reader gets a way
    to look again. Under the text rather than in the notice's side slot: a
    long label there ("Status aktualisieren") squeezed the explanation into
    a sliver on a phone.
  */
  const stalled = (
    <div className="mt-3 space-y-2">
      {canEdit ? <p>{t.staleRetry}</p> : null}
      <Button variant="outline" size="sm" onClick={onRefresh}>
        {t.refreshStatus}
      </Button>
    </div>
  );

  if (run.phase === "queued") {
    return (
      <Notice
        tone={run.stale ? "warning" : "info"}
        title={
          <span className="inline-flex items-center gap-2">
            {run.stale ? null : <InlineSpinner />}
            {t.queuedTitle}
          </span>
        }
      >
        <p>{run.stale ? t.queuedStale : t.queuedBody}</p>
        <p className="mt-1 text-xs text-muted-foreground">{format(t.requestedAt, { date: formatWhen(run.requestedAt, locale) })}</p>
        {previousAt ? <p className="mt-2">{format(t.previousNotice, { date: previousAt })}</p> : null}
        {run.stale ? stalled : null}
      </Notice>
    );
  }

  if (run.phase === "running") {
    return (
      <Notice
        tone={run.stale ? "warning" : "info"}
        title={
          <span className="inline-flex items-center gap-2">
            {run.stale ? null : <InlineSpinner />}
            {t.runningTitle}
          </span>
        }
      >
        <p>{run.stale ? t.runningStale : t.runningBody}</p>
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium tabular-nums">
          <li>{countText(t.progressChecked, run.pagesCrawled, locale)}</li>
          <li>{countText(t.progressFound, run.pagesFound, locale)}</li>
        </ul>
        <p className="mt-1 text-xs text-muted-foreground">
          {format(t.progressLimit, { max: PAGES_PER_CHECK })}
          {run.startedAt ? <> · {format(t.startedAt, { date: formatWhen(run.startedAt, locale) })}</> : null}
        </p>
        {previousAt ? <p className="mt-2">{format(t.previousNotice, { date: previousAt })}</p> : null}
        {run.stale ? stalled : null}
      </Notice>
    );
  }

  if (run.phase === "failed") {
    const failure = run.failure;
    // A viewer cannot start a check, so is never told to try again.
    const message =
      !canEdit && (failure === "timeout" || failure === "generic") ? t.failureViewer[failure] : t.failure[failure];
    return (
      <Notice tone="danger" title={t.failedTitle}>
        <p>{message}</p>
        {run.startedAt ? (
          <p className="mt-1 text-xs text-muted-foreground">{format(t.startedAt, { date: formatWhen(run.startedAt, locale) })}</p>
        ) : null}
        {previousAt ? <p className="mt-2">{format(t.failedPrevious, { date: previousAt })}</p> : null}
      </Notice>
    );
  }

  if (finishedAt) {
    return (
      <Notice tone="success" title={t.finishedTitle}>
        {format(t.finishedBody, { date: finishedAt })}
      </Notice>
    );
  }
  return null;
}

/* ------------------------------------------------------------------------- */
/* Score, severity and coverage                                               */
/* ------------------------------------------------------------------------- */

const BAND: Record<ScoreBand, { text: string; ring: string; tone: keyof typeof TONE; icon: LucideIcon }> = {
  good: { text: "text-emerald-700", ring: "stroke-emerald-500", tone: "positive", icon: CheckCircle2 },
  fair: { text: "text-amber-700", ring: "stroke-amber-500", tone: "warning", icon: AlertTriangle },
  poor: { text: "text-red-700", ring: "stroke-red-500", tone: "critical", icon: OctagonAlert },
};

function ScoreDisplay({ score, unreadable, t }: { score: number | null; unreadable: boolean; t: HealthText }) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;

  if (unreadable || score === null) {
    return (
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex size-28 items-center justify-center rounded-full border-[7px] border-muted" aria-hidden="true">
          <span className="text-2xl font-semibold text-muted-foreground">-</span>
        </div>
        <p className="text-sm font-medium">{unreadable ? t.notScored : t.noScore}</p>
      </div>
    );
  }

  const band = scoreBand(score);
  const meta = BAND[band];
  const Icon = meta.icon;
  const bandLabel = band === "good" ? t.bandGood : band === "fair" ? t.bandFair : t.bandPoor;
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <div className="relative flex size-28 items-center justify-center" role="img" aria-label={format(t.scoreAria, { score })}>
        <svg className="absolute inset-0 size-28 -rotate-90" viewBox="0 0 80 80" aria-hidden="true">
          <circle cx="40" cy="40" r={radius} className="fill-none stroke-muted" strokeWidth="7" />
          <circle
            cx="40"
            cy="40"
            r={radius}
            className={cn("fill-none", meta.ring)}
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={`${(Math.max(0, Math.min(100, score)) / 100) * circumference} ${circumference}`}
          />
        </svg>
        <div aria-hidden="true">
          <div className={cn("text-3xl font-semibold tabular-nums", meta.text)}>{score}</div>
          <div className="text-xs text-muted-foreground">{t.outOf}</div>
        </div>
      </div>
      <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium", TONE[meta.tone])}>
        <Icon className="size-3" aria-hidden="true" />
        {bandLabel}
      </span>
    </div>
  );
}

function Fact({ term, value }: { term: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{term}</dt>
      <dd className="mt-0.5 text-sm font-semibold tabular-nums wrap-break-word">{value}</dd>
    </div>
  );
}

function SeverityBreakdown({
  totals,
  findings,
  locale,
  t,
}: {
  totals: SeverityTotals;
  findings: SeverityTotals;
  locale: Locale;
  t: HealthText;
}) {
  const order: Severity[] = ["critical", "warning", "info"];
  const total = totals.critical + totals.warning + totals.info;
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">{t.severityTitle}</h3>
      {total > 0 ? (
        /*
          Proportional, with a small floor so one critical problem among many
          suggestions stays visible. Flex shares the width, so the floor can
          never push the bar past 100% (it used to clip the last segment).
        */
        <div
          role="img"
          aria-label={format(t.severityAria, {
            critical: formatNumber(totals.critical, locale),
            warning: formatNumber(totals.warning, locale),
            info: formatNumber(totals.info, locale),
          })}
          className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-muted"
        >
          {order
            .filter((severity) => totals[severity] > 0)
            .map((severity) => (
              <span
                key={severity}
                className={cn("min-w-1.5 basis-0 rounded-full", SEVERITY_META[severity].bar)}
                style={{ flexGrow: totals[severity] }}
              />
            ))}
        </div>
      ) : null}
      <ul className="grid gap-3 sm:grid-cols-3">
        {order.map((severity) => {
          const meta = SEVERITY_META[severity];
          const Icon = meta.icon;
          return (
            <li key={severity} className="min-w-0 rounded-lg border p-3">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Icon className={cn("size-3.5 shrink-0", meta.iconClass)} aria-hidden="true" />
                {severityLabel(severity, t)}
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{formatNumber(totals[severity], locale)}</p>
              <p className="text-xs text-muted-foreground">{countText(t.inFindings, findings[severity], locale)}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function OverviewSection({
  domain,
  score,
  checkedAt,
  isPrevious,
  pagesRead,
  pagesFailed,
  discovered,
  totals,
  findingTotals,
  notAssessed,
  locale,
  t,
}: {
  domain: string;
  score: number | null;
  checkedAt: string;
  isPrevious: boolean;
  /** summary.pagesCrawled; null when the audit did not record it. */
  pagesRead: number | null;
  pagesFailed: number;
  /** Addresses the crawl found, when the stored crawl row belongs to this audit. */
  discovered: number | null;
  totals: SeverityTotals;
  findingTotals: SeverityTotals;
  notAssessed: string[];
  locale: Locale;
  t: HealthText;
}) {
  const unreadable = pagesRead === 0;
  const attempted = (pagesRead ?? 0) + pagesFailed;
  return (
    <WorkspaceSection
      id="health-score"
      icon={Gauge}
      title={t.scoreTitle}
      description={t.scoreDescription}
      actions={isPrevious ? <PreviousResultPill t={t} /> : null}
    >
      <div className="space-y-5">
        <div className="grid gap-6 md:grid-cols-[auto_minmax(0,1fr)] md:items-start">
          <ScoreDisplay score={score} unreadable={unreadable} t={t} />
          <div className="min-w-0 space-y-5">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 lg:grid-cols-4">
              <Fact term={t.lastChecked} value={checkedAt} />
              <Fact term={t.pagesRead} value={pagesRead === null ? t.notRecorded : formatNumber(pagesRead, locale)} />
              <Fact term={t.pagesFailed} value={formatNumber(pagesFailed, locale)} />
              {discovered !== null ? <Fact term={t.addressesFound} value={formatNumber(discovered, locale)} /> : null}
            </dl>
            <SeverityBreakdown totals={totals} findings={findingTotals} locale={locale} t={t} />
          </div>
        </div>

        {unreadable ? (
          <Notice tone="danger" title={t.zeroPagesTitle}>
            {t.zeroPagesBody}
          </Notice>
        ) : null}
        {!unreadable && score === null ? <Notice tone="info">{t.noScoreBody}</Notice> : null}
        {notAssessed.length > 0 ? (
          <Notice tone="info" title={t.notAssessedTitle}>
            {format(t.notAssessedBody, { checks: notAssessed.join(", ") })}
          </Notice>
        ) : null}

        <p className="max-w-3xl text-xs leading-5 text-muted-foreground">{t.notAuthority}</p>

        <WorkspaceSubsection title={t.coverageTitle}>
          <ul className="max-w-3xl list-disc space-y-1 pl-5 text-sm text-muted-foreground marker:text-muted-foreground/60">
            <li>{format(t.coverageLimit, { max: PAGES_PER_CHECK })}</li>
            <li>{format(t.coverageSameSite, { domain })}</li>
            <li>{t.coverageQuery}</li>
            <li>{t.coverageSkipped}</li>
            <li>{t.coverageRefused}</li>
          </ul>
          {discovered !== null && pagesRead !== null && discovered > attempted ? (
            <p className="max-w-3xl text-sm">
              {format(t.coverageBeyond, {
                found: formatNumber(discovered, locale),
                read: formatNumber(pagesRead, locale),
              })}
            </p>
          ) : null}
        </WorkspaceSubsection>
      </div>
    </WorkspaceSection>
  );
}

/* ------------------------------------------------------------------------- */
/* The site as the crawl read it                                              */
/* ------------------------------------------------------------------------- */

function Detail({ term, value, note, muted }: { term: string; value: ReactNode; note?: string; muted?: boolean }) {
  return (
    <div className="min-w-0 rounded-lg border bg-muted/20 p-4">
      <dt className="text-xs text-muted-foreground">{term}</dt>
      <dd className={cn("mt-1 text-base font-semibold wrap-break-word", muted && "text-muted-foreground")}>{value}</dd>
      {note ? <dd className="mt-1 text-xs leading-5 text-muted-foreground">{note}</dd> : null}
    </div>
  );
}

/** The site's own og:image, with an honest fallback when it does not load. */
function PreviewDetail({ src, t }: { src: string | null; t: HealthText }) {
  const [broken, setBroken] = useState(false);
  if (!src) return <Detail term={t.previewImage} value={t.previewMissing} note={t.previewMissingNote} muted />;
  return (
    <div className="min-w-0 rounded-lg border bg-muted/20 p-4">
      <dt className="text-xs text-muted-foreground">{t.previewImage}</dt>
      <dd className="mt-2">
        {broken ? (
          <span className="flex aspect-video w-full flex-col items-center justify-center gap-1 rounded-md border border-dashed px-3 text-center text-xs text-muted-foreground">
            <ImageOff className="size-4" aria-hidden="true" />
            {t.previewBroken}
          </span>
        ) : (
          <img
            src={src}
            alt=""
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            className="aspect-video w-full rounded-md border bg-background object-cover"
            onError={() => setBroken(true)}
            // An image that failed before hydration never fires onError here.
            ref={(element) => {
              if (element && element.complete && element.naturalWidth === 0) setBroken(true);
            }}
          />
        )}
      </dd>
      <dd className="mt-1 text-xs leading-5 text-muted-foreground">{t.previewNote}</dd>
    </div>
  );
}

export function SiteDetailsSection({
  context,
  pagesRead,
  t,
}: {
  /** Absent on audits written before the context was collected. */
  context: AuditContext | undefined;
  pagesRead: number | null;
  t: HealthText;
}) {
  const hosts = context?.linkedHosts ?? [];
  return (
    <WorkspaceSection id="site-details" icon={Globe} title={t.siteTitle} description={t.siteDescription}>
      {!context ? (
        <Notice tone="info">{t.siteLegacy}</Notice>
      ) : pagesRead === 0 ? (
        <Notice tone="warning">{t.siteUnavailable}</Notice>
      ) : (
        <div className="space-y-5">
          <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Detail term={t.siteName} value={context.siteName ?? t.siteNameMissing} muted={!context.siteName} />
            <Detail
              term={t.language}
              value={context.language ? context.language.toUpperCase() : t.languageMissing}
              note={context.language ? t.languageNote : t.languageMissingNote}
              muted={!context.language}
            />
            <Detail
              term={t.platform}
              value={context.platform ?? t.platformUnknown}
              note={context.platform ? t.platformNote : t.platformUnknownNote}
              muted={!context.platform}
            />
            <PreviewDetail src={context.previewImage} t={t} />
          </dl>
          <WorkspaceSubsection title={t.linkedTitle} description={t.linkedHelp}>
            {hosts.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {hosts.map((host) => (
                  <li key={host} className="max-w-full rounded-full border px-3 py-1 font-mono text-xs break-all text-muted-foreground">
                    {host}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">{t.linkedEmpty}</p>
            )}
          </WorkspaceSubsection>
        </div>
      )}
    </WorkspaceSection>
  );
}

/* ------------------------------------------------------------------------- */
/* AI crawlers in robots.txt                                                  */
/* ------------------------------------------------------------------------- */

export function AiAccessSection({
  context,
  pagesRead,
  websiteId,
  locale,
  t,
}: {
  context: AuditContext | undefined;
  /** summary.pagesCrawled; 0 when the check could not read a single page. */
  pagesRead: number | null;
  websiteId: string;
  locale: Locale;
  t: HealthText;
}) {
  const crawlers = context?.crawlers ?? [];
  const blocked = crawlers.filter((crawler) => !crawler.allowed).length;
  const total = formatNumber(crawlers.length, locale);
  return (
    <WorkspaceSection id="ai-access" icon={Bot} title={t.aiTitle} description={t.aiDescription}>
      {crawlers.length === 0 ? (
        <Notice tone="info">{t.aiLegacy}</Notice>
      ) : (
        <div className="space-y-4">
          {/*
            The job reads robots.txt separately and stores an unreadable file
            as "nothing blocked" (lib/audit/ai-crawlers.ts). When not even the
            home page could be read, that all-clear is most likely the failed
            read, so it is not left to stand as a healthy result.
          */}
          {pagesRead === 0 ? <Notice tone="warning">{t.aiUnreadable}</Notice> : null}
          <p className="text-sm font-medium">
            {blocked > 0 ? countText(t.aiSomeBlocked, blocked, locale, { total }) : format(t.aiNoneBlocked, { total })}
          </p>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {crawlers.map((crawler) => (
              <li key={crawler.agent} className="flex min-w-0 items-center gap-3 rounded-lg border p-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{crawler.owner}</span>
                  <span className="block text-xs text-muted-foreground">
                    <span className="font-mono">{crawler.agent}</span>
                    {crawler.explicit ? <> · {t.aiNamed}</> : null}
                  </span>
                </span>
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
                    crawler.allowed ? TONE.positive : TONE.critical,
                  )}
                >
                  {crawler.allowed ? <Check className="size-3" aria-hidden="true" /> : <X className="size-3" aria-hidden="true" />}
                  {crawler.allowed ? t.aiAllowed : t.aiBlocked}
                </span>
              </li>
            ))}
          </ul>
          {blocked > 0 ? <Notice tone="warning">{t.aiBlockedHelp}</Notice> : null}
          <p className="max-w-3xl text-xs leading-5 text-muted-foreground">
            {t.aiCaveat} {t.aiNoGuarantee}
          </p>
          <Link
            href={`/websites/${websiteId}/ai-visibility`}
            className="inline-flex items-center gap-1 rounded-sm text-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {t.aiVisibilityLink}
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
      )}
    </WorkspaceSection>
  );
}
