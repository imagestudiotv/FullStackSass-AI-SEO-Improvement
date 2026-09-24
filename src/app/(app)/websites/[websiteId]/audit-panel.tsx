/*
  eslint-disable @next/next/no-img-element --
  The image is on the CUSTOMER's domain, which is not knowable ahead of time.
  next/image needs every remote host in remotePatterns, so optimising it would
  mean a wildcard - which turns our optimiser into an open image proxy. Same
  reasoning as the public audit, which carries the same disable.
*/
"use client";

import {
  AlertTriangle,
  Bot,
  Check,
  ExternalLink,
  Globe,
  Info,
  Languages,
  Layers,
  Link2,
  Loader2,
  RefreshCw,
  Stethoscope,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { Messages } from "@/lib/i18n/messages";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  startAudit,
  type AuditView,
  type CrawlProgress,
} from "@/lib/audit/actions";
import { explainCrawlError } from "@/lib/audit/explain";
import { ISSUE_LABELS } from "@/lib/audit/rules";
import { countNeedingDeveloper, fixFor } from "@/lib/audit/fixes";
import { AuditSummaryPanel } from "./audit-summary";
import { FixRequest } from "./fix-request";

/**
 * Website health, following the public audit's design.
 *
 * The in-app panel and the public audit at /audit were the same report drawn
 * two different ways: the public one has a score ring, a proportional
 * severity bar and findings grouped by type, while a paying customer got a
 * bare number in the corner of a card and one row per affected page. The
 * client asked for the two to match, and the public one is the better design.
 *
 * The context tiles, the AI-crawler card and the linked-hosts list were
 * missing here at first because the in-app audit did not STORE any of it -
 * the crawl read the language, the platform fingerprints and the outbound
 * hosts and then threw them away. The job now keeps them (see
 * audit-website.ts, collect-context), so the same blocks render.
 *
 * Every one of them is guarded on the context being present: audits written
 * before that change have none, and the report must still render for them
 * rather than throwing on a missing key. The next check fills them in.
 */

type AuditPanelProps = {
  websiteId: string;
  /** Used to fill in the quote request. */
  domain: string;
  audit: AuditView | null;
  crawl: CrawlProgress;
  /** Shared words used on several screens. */
  t: Messages["app"]["common"];
};

/** Pages listed under one grouped finding before it says "and N more". */
const URLS_PER_ISSUE = 3;

/** Findings shown before the "show all" control appears. */
const VISIBLE_FINDINGS = 8;

function scoreTone(score: number): string {
  if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

/** Ring colour follows the same thresholds as the number. */
function ringTone(score: number): string {
  if (score >= 80) return "stroke-emerald-500";
  if (score >= 50) return "stroke-amber-500";
  return "stroke-red-500";
}

/**
 * The score as a ring, matching the public audit.
 *
 * A number alone gives no sense of scale - 62 reads as a mark out of nothing
 * until it is drawn against the 100 it is out of.
 */
function ScoreRing({ score }: { score: number }) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const filled = (score / 100) * circumference;

  return (
    <div className="relative flex size-24 shrink-0 items-center justify-center">
      <svg className="absolute size-24 -rotate-90" viewBox="0 0 80 80">
        <circle
          cx="40"
          cy="40"
          r={radius}
          className="fill-none stroke-muted"
          strokeWidth="7"
        />
        <circle
          cx="40"
          cy="40"
          r={radius}
          className={`fill-none ${ringTone(score)}`}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
        />
      </svg>
      <div className="text-center">
        <div
          className={`text-2xl font-semibold tabular-nums ${scoreTone(score)}`}
        >
          {score}
        </div>
        <div className="text-[10px] text-muted-foreground">of 100</div>
      </div>
    </div>
  );
}

/**
 * The severity mix as one bar.
 *
 * Widths are proportional, so the bar answers "what kind of problems are
 * these" before any label is read. Every segment keeps a minimum width, or a
 * single critical finding among ninety suggestions would be a sliver too thin
 * to see - hiding the most important number on the screen.
 */
function SeverityBar({
  counts,
  t,
}: {
  counts: { critical: number; warning: number; info: number };
  t: Messages["app"]["common"];
}) {
  const total = counts.critical + counts.warning + counts.info;

  const segments = [
    { key: "critical", n: counts.critical, className: "bg-destructive" },
    { key: "warning", n: counts.warning, className: "bg-amber-500" },
    { key: "info", n: counts.info, className: "bg-blue-500" },
  ].filter((segment) => segment.n > 0);

  if (total === 0) {
    return (
      <p className="mt-4 text-sm text-emerald-600 dark:text-emerald-400">
        {t.nothingNeedsAttention}
      </p>
    );
  }

  return (
    <div className="mt-4">
      <div
        className="flex h-2.5 gap-0.5 overflow-hidden rounded-full"
        role="img"
        aria-label={`${counts.critical} ${t.critical}, ${counts.warning} ${t.warning}, ${counts.info} ${t.suggestion}`}
      >
        {segments.map((segment) => (
          <span
            key={segment.key}
            className={`${segment.className} rounded-full`}
            style={{
              // 8% floor, so one finding among many is still a visible mark.
              width: `${Math.max(8, (segment.n / total) * 100)}%`,
            }}
          />
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
        {[
          { n: counts.critical, label: t.critical, dot: "bg-destructive" },
          { n: counts.warning, label: t.warning, dot: "bg-amber-500" },
          { n: counts.info, label: t.suggestion, dot: "bg-blue-500" },
        ].map((item) => (
          <span key={item.label} className="flex items-center gap-1.5">
            <span
              className={`size-2 rounded-full ${item.n > 0 ? item.dot : "bg-muted"}`}
              aria-hidden="true"
            />
            <span className="font-semibold tabular-nums">{item.n}</span>
            <span className="text-muted-foreground">{item.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** One finding, with every page it affects. */
type GroupedIssue = {
  type: string;
  severity: string;
  detail: string;
  urls: string[];
  pageCount: number;
};

/**
 * Groups per-page issues by type.
 *
 * The panel used to render one row per issue ROW, so a missing meta
 * description on forty pages was forty near-identical entries and the list
 * became unreadable at exactly the moment it mattered most. Grouped, it is
 * one finding that says "40 pages" - which is also how the public audit
 * reads, and how someone would actually work through the list.
 *
 * Severity order is preserved by sorting after grouping: critical findings
 * must lead whatever order the rows arrived in.
 */
function groupIssues(issues: AuditView["issues"]): GroupedIssue[] {
  const groups = new Map<string, GroupedIssue>();

  for (const issue of issues) {
    const existing = groups.get(issue.type);
    if (existing) {
      existing.pageCount += 1;
      if (issue.url && existing.urls.length < URLS_PER_ISSUE) {
        existing.urls.push(issue.url);
      }
      continue;
    }
    groups.set(issue.type, {
      type: issue.type,
      severity: issue.severity,
      detail: issue.detail ?? "",
      urls: issue.url ? [issue.url] : [],
      pageCount: 1,
    });
  }

  const rank: Record<string, number> = { critical: 0, warning: 1, info: 2 };
  return [...groups.values()].sort(
    (a, b) =>
      (rank[a.severity] ?? 3) - (rank[b.severity] ?? 3) ||
      b.pageCount - a.pageCount,
  );
}

/**
 * The path part of a URL, for listing affected pages.
 *
 * The host is already in the header, and repeating it on every row pushes the
 * part that differs off the end. Falls back to the raw string when it will not
 * parse, since a URL we cannot read is still worth showing.
 */
function pathOf(url: string): string {
  try {
    const { pathname, search } = new URL(url);
    return pathname === "/" ? "/ (homepage)" : `${pathname}${search}`;
  } catch {
    return url;
  }
}

export function AuditPanel({
  websiteId,
  domain,
  audit,
  crawl,
  t,
}: AuditPanelProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showAll, setShowAll] = useState(false);

  const running = crawl?.status === "running";

  /**
   * The crawl writes progress from a background job, so the page cannot know
   * it advanced. Polling stops as soon as the crawl is no longer running.
   */
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(timer);
  }, [running, router]);

  const grouped = useMemo(
    () => (audit ? groupIssues(audit.issues) : []),
    [audit],
  );

  function handleAudit() {
    startTransition(async () => {
      const result = await startAudit(websiteId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(t.checkingWebsite);
      router.refresh();
    });
  }

  /* ------------------------------------------------------------------ */
  /* Running                                                             */
  /* ------------------------------------------------------------------ */
  if (running) {
    /*
      A real bar, not a spinner. The crawl reports pages found and pages
      read, so the wait can show its own progress - and a customer watching
      a site being checked wants to know it is moving, not merely busy.
      Guarded against a zero denominator, which is the state for the first
      second or two before any page is discovered.
    */
    const percent =
      crawl.pagesFound > 0
        ? Math.min(100, Math.round((crawl.pagesCrawled / crawl.pagesFound) * 100))
        : 0;

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            {t.checkingWebsite}
          </CardTitle>
          <CardDescription>
            {crawl.pagesCrawled} of {crawl.pagesFound} pages checked so far.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/*
            A plain bar rather than a Progress component - there is no such
            component in this project, and one div with a width is not worth
            adding a dependency for.
          */}
          <div
            className="h-2 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t.checkingWebsite}
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500"
              style={{ width: `${percent}%` }}
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  /* ------------------------------------------------------------------ */
  /* Never run                                                           */
  /* ------------------------------------------------------------------ */
  if (!audit) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Stethoscope className="size-4" aria-hidden="true" />
            {t.websiteHealth}
          </CardTitle>
          <CardDescription>{t.auditIntro}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleAudit} disabled={pending}>
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : null}
            Check my website
          </Button>
          {crawl?.status === "failed" && crawl.error ? (
            <p className="mt-3 text-sm text-destructive">
              {explainCrawlError(crawl.error).summary}{" "}
              {explainCrawlError(crawl.error).action}
            </p>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  /* ------------------------------------------------------------------ */
  /* Results                                                             */
  /* ------------------------------------------------------------------ */
  const counts = audit.summary?.counts ?? { critical: 0, warning: 0, info: 0 };
  const visible = showAll ? grouped : grouped.slice(0, VISIBLE_FINDINGS);
  /** Absent on audits written before the context was collected. */
  const context = audit.summary?.context;
  const blockedCrawlers = context?.crawlers.filter((c) => !c.allowed) ?? [];

  return (
    <div className="space-y-6">
      {/*
        The site beside what the check found - the block the public audit
        opens with, in its own component because its copy differs. See
        audit-summary.tsx: the public version is written for somebody who has
        not paid, and every "you get this when you join" line would be an
        upsell for something this reader already has.
      */}
      {audit.summary ? (
        <AuditSummaryPanel
          domain={domain}
          summary={audit.summary}
          context={context}
          /*
            The first three grouped findings, already ordered critical-first
            by groupIssues - so "in the order worth doing them" is true
            rather than a claim about an arbitrary list.
          */
          topFindings={grouped.slice(0, 3).map((issue) => ({
            type: issue.type,
            detail: issue.detail,
            pageCount: issue.pageCount,
          }))}
          totalFindings={grouped.length}
        />
      ) : null}

      {/*
        Header: who we looked at, and the score.

        NOT flex-wrap. A long domain pushed the score onto its own line and
        left a hole in the card; the ring keeps a fixed column and the name
        truncates instead. Same reasoning as the public audit's header.
      */}
      <Card>
        <CardContent className="flex items-center gap-6 py-6">
          {/*
            The site's own og:image, read during the crawl that produced
            these findings - the same picture the public audit shows.

            Hidden below sm, where it would take a third of the card from the
            score it sits beside. Rendered only when the crawl actually found
            one: a broken frame looks worse than no frame, which is also why
            nothing is guessed at (/favicon.ico is a convention, not a
            guarantee).
          */}
          {context?.previewImage ? (
            <div className="hidden size-20 shrink-0 overflow-hidden rounded-xl border sm:block">
              <img
                src={context.previewImage}
                alt=""
                className="size-full object-cover"
              />
            </div>
          ) : null}

          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
              {/*
                "AI SEO audit", matching the public report. This said
                "Website health" - the name of the PAGE rather than of the
                thing on it, which left the card's eyebrow repeating the
                heading above it and named the report differently from the
                one the same customer may have already seen at /audit.
              */}
              AI SEO audit
            </p>
            <h2 className="mt-2 truncate text-2xl font-semibold tracking-tight">
              {/*
                The site's own name when the crawl read one, falling back to
                the domain. "Image Studio" is what the customer calls their
                business; imagestudio.com is what we call it.
              */}
              {context?.siteName ?? domain}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {/*
                The domain stays on this line. The heading may now show the
                site's own NAME, and "Image Studio" alone does not say which
                address was checked - which matters on an account holding
                several sites.
              */}
              {domain} · {audit.summary?.pagesCrawled ?? 0}{" "}
              {(audit.summary?.pagesCrawled ?? 0) === 1 ? "page" : "pages"} read
              {" · "}
              {new Date(audit.createdAt).toLocaleDateString()}
            </p>

            <SeverityBar counts={counts} t={t} />
          </div>

          <ScoreRing score={audit.score ?? 0} />
        </CardContent>
      </Card>

      {/*
        Context tiles. Every value read from the site, or honestly absent.

        Rendered only once an audit carries context - an older audit shows
        the score and findings without them rather than three tiles reading
        "Not set", which would look like findings about the site rather than
        gaps in our own record.
      */}
      {context ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: Languages,
              label: "Language",
              value: context.language?.toUpperCase() ?? "Not set",
              note: context.language
                ? "What the page declares."
                : "No lang attribute - search engines have to guess.",
            },
            {
              icon: Layers,
              label: "Platform",
              value: context.platform ?? "Custom",
              note: context.platform
                ? "What your site is built on."
                : "We could not recognise a common platform.",
            },
            {
              icon: Globe,
              label: "Pages read",
              value: String(audit.summary?.pagesCrawled ?? 0),
              note: "Every check reads up to 25 pages.",
            },
          ].map((tile) => (
            <Card key={tile.label}>
              <CardContent className="py-5">
                <p className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  <tile.icon className="size-3.5" aria-hidden="true" />
                  {tile.label}
                </p>
                <p className="mt-2 text-lg font-semibold">{tile.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {tile.note}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {/*
        AI crawler access.

        Worth its own block rather than a finding in the list: it is a yes/no
        fact rather than a judgement, it is invisible from the customer's own
        site, and being blocked here is completely fixable once seen.
      */}
      {context && context.crawlers.length > 0 ? (
        <Card
          className={blockedCrawlers.length > 0 ? "border-destructive/40" : undefined}
        >
          <CardContent className="py-6">
            <div className="flex items-start gap-5">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-medium">
                  <Bot className="size-4 text-primary" aria-hidden="true" />
                  Can AI assistants read your site?
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {blockedCrawlers.length === 0
                    ? "Your robots.txt lets every major AI crawler through."
                    : `Your robots.txt blocks ${blockedCrawlers.length} of them. They cannot cite a site they are not allowed to read.`}
                </p>
              </div>

              {/*
                The allowed fraction as a dial. A yes/no list answers "which
                ones" but not "how bad is this", and the count is what a
                customer takes away. Green when everything is through, amber
                otherwise - the same scale the score ring uses, so the two
                cannot disagree about what good looks like.
              */}
              <div className="relative shrink-0">
                <svg viewBox="0 0 72 72" className="size-16" aria-hidden="true">
                  <circle
                    cx="36"
                    cy="36"
                    r="30"
                    className="fill-none stroke-muted"
                    strokeWidth="6"
                  />
                  <circle
                    cx="36"
                    cy="36"
                    r="30"
                    className={`fill-none ${
                      blockedCrawlers.length === 0
                        ? "stroke-emerald-500"
                        : "stroke-amber-500"
                    }`}
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={`${
                      ((context.crawlers.length - blockedCrawlers.length) /
                        context.crawlers.length) *
                      (2 * Math.PI * 30)
                    } ${2 * Math.PI * 30}`}
                    transform="rotate(-90 36 36)"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold tabular-nums">
                  {context.crawlers.length - blockedCrawlers.length}/
                  {context.crawlers.length}
                </span>
              </div>
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {context.crawlers.map((crawler) => (
                <div
                  key={crawler.agent}
                  className="flex items-center gap-2 rounded-lg border px-3 py-2"
                >
                  {crawler.allowed ? (
                    <Check
                      className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                      aria-hidden="true"
                    />
                  ) : (
                    <X
                      className="size-4 shrink-0 text-destructive"
                      aria-hidden="true"
                    />
                  )}
                  <span className="truncate text-sm">{crawler.owner}</span>
                  <span className="ml-auto shrink-0 font-mono text-[11px] text-muted-foreground">
                    {crawler.agent}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Findings, each with how to fix it. */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-xl font-semibold tracking-tight">
            Issues we <span className="text-primary">found</span>
          </h3>
          <Button
            variant="outline"
            size="sm"
            onClick={handleAudit}
            disabled={pending}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="size-4" aria-hidden="true" />
            )}
            Check again
          </Button>
        </div>

        {grouped.length === 0 ? (
          <Card className="mt-4">
            <CardContent className="py-6 text-sm text-muted-foreground">
              {t.nothingNeedsAttention}
            </CardContent>
          </Card>
        ) : (
          <ul className="mt-4 space-y-3">
            {visible.map((issue) => {
              const fix = fixFor(issue.type);
              return (
                <li key={issue.type}>
                  <Card>
                    <CardContent className="flex gap-3 py-4">
                      {issue.severity === "critical" ? (
                        <AlertTriangle
                          className="mt-0.5 size-4 shrink-0 text-destructive"
                          aria-hidden="true"
                        />
                      ) : (
                        <Info
                          className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                      )}

                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                          {ISSUE_LABELS[issue.type] ?? issue.type}
                          {/*
                            Named once here rather than repeating the whole
                            finding per page - the reason for grouping.
                          */}
                          {issue.pageCount > 1 ? (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                              {issue.pageCount} pages
                            </span>
                          ) : null}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {issue.detail}
                        </p>

                        {issue.urls.length > 0 ? (
                          <ul className="mt-1.5 space-y-0.5">
                            {issue.urls.map((url) => (
                              <li key={url}>
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex max-w-full items-center gap-1 truncate font-mono text-xs text-muted-foreground hover:underline"
                                >
                                  {pathOf(url)}
                                  <ExternalLink
                                    className="size-3 shrink-0"
                                    aria-hidden="true"
                                  />
                                </a>
                              </li>
                            ))}
                            {issue.pageCount > issue.urls.length ? (
                              <li className="text-xs text-muted-foreground">
                                and {issue.pageCount - issue.urls.length} more
                              </li>
                            ) : null}
                          </ul>
                        ) : null}

                        {/*
                          How to fix it. The audit named problems without
                          saying what to do about them, which turns a list of
                          faults into anxiety rather than a to-do list.
                        */}
                        {fix ? (
                          <p className="mt-2 border-l-2 border-primary/30 pl-2.5 text-sm">
                            {fix.fix}
                            <span className="ml-1 text-xs text-muted-foreground">
                              ({fix.effort}
                              {fix.needsDeveloper
                                ? ", may need your developer"
                                : ""}
                              )
                            </span>
                          </p>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}

        {grouped.length > VISIBLE_FINDINGS ? (
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? "Show fewer" : `Show all ${grouped.length} findings`}
          </Button>
        ) : null}
      </div>

      {/*
        Sites you link out to. Free, already crawled, and the thing a customer
        most often did not realise: a link they forgot they were giving away.
      */}
      {context && context.linkedHosts.length > 0 ? (
        <Card>
          <CardContent className="py-6">
            <p className="flex items-center gap-2 font-medium">
              <Link2 className="size-4 text-primary" aria-hidden="true" />
              Sites you link out to
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Read from your own pages. Useful for spotting links you did not
              mean to give away.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {context.linkedHosts.map((host) => (
                <span
                  key={host}
                  className="rounded-full border px-3 py-1 font-mono text-xs text-muted-foreground"
                >
                  {host}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/*
        Offered after the findings, not before: someone should read what is
        wrong before being asked whether they want it fixed for them.
      */}
      <FixRequest
        domain={domain}
        issueCount={audit.issues.length}
        criticalCount={
          audit.issues.filter((issue) => issue.severity === "critical").length
        }
        developerCount={countNeedingDeveloper(
          audit.issues.map((issue) => issue.type),
        )}
        t={t}
      />
    </div>
  );
}
