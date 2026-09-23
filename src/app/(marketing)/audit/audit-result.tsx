/*
  eslint-disable @next/next/no-img-element --
  The image is on the CUSTOMER's domain, which is not knowable ahead of time.
  next/image needs every remote host in remotePatterns, so optimising it would
  mean a wildcard — which turns our optimiser into an open image proxy.
*/
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Check,
  FileText,
  Globe,
  Info,
  Languages,
  Layers,
  Link2,
  ListChecks,
  Lock,
  X,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { fixFor } from "@/lib/audit/fixes";
import { ISSUE_LABELS } from "@/lib/audit/rules";
import type { PublicAuditResult } from "@/lib/audit/public-audit";
import { AuditSteps } from "./audit-steps";

/**
 * The audit result, following the reference design.
 *
 * The reference shows a great deal we cannot honestly produce for an anonymous
 * visitor, and the difference is worth stating because it shaped every section
 * below:
 *
 *  - "$15K/mo market visibility" and "14,220 monthly searches" are estimates
 *    presented as findings. We would be inventing a revenue figure for a
 *    business we know nothing about, on the page where they decide whether to
 *    trust us.
 *  - A Search Console traffic chart needs the customer's own Google account.
 *    We have not asked for it yet, and the reference's chart is one tester's
 *    account shown to everybody.
 *  - "Your competitors" with logos needs a keyword index we cannot query for a
 *    site that has no search footprint.
 *
 * So this shows the same shape — a scored header, context tiles, findings with
 * fixes, a gate — built only from what the crawl actually read. The one thing
 * added beyond the reference is the AI crawler check, which is both a real
 * differentiator and a yes/no fact rather than an estimate.
 */

/**
 * The path part of a URL, for listing affected pages.
 *
 * The host is already in the header and repeating it on every row pushes the
 * part that differs off the end. Falls back to the raw string if it will not
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
        <div className={`text-2xl font-semibold tabular-nums ${scoreTone(score)}`}>
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
 * Widths are proportional to the counts, so the bar answers "what kind of
 * problems are these" before any label is read. Every segment keeps a minimum
 * width so a single critical finding among ninety suggestions is still
 * visible — a sliver too thin to see would hide the most important number on
 * the page.
 */
function SeverityBar({
  counts,
}: {
  counts: { critical: number; warning: number; info: number };
}) {
  const total = counts.critical + counts.warning + counts.info;

  const segments = [
    { key: "critical", n: counts.critical, className: "bg-destructive", label: "critical" },
    { key: "warning", n: counts.warning, className: "bg-amber-500", label: "warnings" },
    { key: "info", n: counts.info, className: "bg-blue-500", label: "suggestions" },
  ].filter((segment) => segment.n > 0);

  return (
    <div className="mt-4">
      {total === 0 ? (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">
          Nothing wrong on the pages we read.
        </p>
      ) : (
        <>
          <div
            className="flex h-2.5 gap-0.5 overflow-hidden rounded-full"
            role="img"
            aria-label={segments
              .map((segment) => `${segment.n} ${segment.label}`)
              .join(", ")}
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
              { n: counts.critical, label: "critical", dot: "bg-destructive" },
              { n: counts.warning, label: "warnings", dot: "bg-amber-500" },
              { n: counts.info, label: "suggestions", dot: "bg-blue-500" },
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
        </>
      )}
    </div>
  );
}

export function AuditResult({ result }: { result: PublicAuditResult }) {
  const blockedCrawlers = result.crawlers.filter((c) => !c.allowed);

  return (
    <div className="space-y-6">
      {/*
        The three assets, kept after the check finishes.

        The loading screen showed them being built and then vanished, so the
        work it described disappeared the moment it produced anything. These
        are the same rows, still expandable, now holding what each one found.
      */}
      <AuditSteps result={result} />

      {/* Header: who we looked at, and the score. */}
      <Card>
        {/*
          Not flex-wrap: a long site name (a news homepage title runs to 60
          characters) pushed the score onto its own line and left a hole in the
          card. The ring keeps a fixed column and the name truncates instead.
        */}
        <CardContent className="flex items-center gap-6 py-6">
          {/*
            The site's own og:image, read during the crawl that produced these
            findings. Hidden below sm, where it would take a third of the card
            from the score it sits beside.
          */}
          {result.previewImage ? (
            <div className="hidden size-20 shrink-0 overflow-hidden rounded-xl border sm:block">
              <img
                src={result.previewImage}
                alt=""
                className="size-full object-cover"
              />
            </div>
          ) : null}

          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
              AI SEO audit
            </p>
            <h2 className="mt-2 truncate text-2xl font-semibold tracking-tight">
              {result.siteName ?? result.domain}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {result.domain} · {result.pagesChecked}{" "}
              {result.pagesChecked === 1 ? "page" : "pages"} read
            </p>

            {/*
              A stacked bar rather than three loose badges.

              The proportions are the point: "12 warnings" means little on its
              own, while a bar that is mostly amber says at a glance where the
              work is. A zero count contributes no segment and shows no alarm
              colour — a red "0 critical" reads as a problem.
            */}
            <SeverityBar counts={result.counts} />
          </div>

          <ScoreRing score={result.score} />
        </CardContent>
      </Card>

      {/* Context tiles. Every value read from the site, or honestly absent. */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            icon: Languages,
            label: "Language",
            value: result.language?.toUpperCase() ?? "Not set",
            note: result.language
              ? "What the page declares."
              : "No lang attribute - search engines have to guess.",
          },
          {
            icon: Layers,
            label: "Platform",
            value: result.platform ?? "Custom",
            note: result.platform
              ? "What your site is built on."
              : "We could not recognise a common platform.",
          },
          {
            icon: Globe,
            label: "Pages read",
            value: String(result.pagesChecked),
            note: "Free checks read up to five pages.",
          },
        ].map((tile) => (
          <Card key={tile.label}>
            <CardContent className="py-5">
              <p className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                <tile.icon className="size-3.5" aria-hidden="true" />
                {tile.label}
              </p>
              <p className="mt-2 text-lg font-semibold">{tile.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{tile.note}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/*
        AI crawler access. Not in our previous audit and worth its own block:
        it is a yes/no fact rather than an estimate, and being blocked here is
        both invisible from the customer's own site and completely fixable.
      */}
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
              The allowed fraction as a dial.

              A yes/no list answers "which ones" but not "how bad is this",
              and the count is the thing a visitor takes away. Green when
              everything is through, amber otherwise — the same scale the score
              ring uses, so the two do not disagree about what good looks like.
            */}
            <div className="relative shrink-0">
              <svg viewBox="0 0 72 72" className="size-16" aria-hidden="true">
                <circle
                  cx="36"
                  cy="36"
                  r="30"
                  fill="none"
                  stroke="currentColor"
                  className="text-muted"
                  strokeWidth="8"
                />
                <circle
                  cx="36"
                  cy="36"
                  r="30"
                  fill="none"
                  stroke="currentColor"
                  className={
                    blockedCrawlers.length === 0
                      ? "text-emerald-500"
                      : "text-amber-500"
                  }
                  strokeWidth="8"
                  strokeLinecap="round"
                  /* 188.5 is the circumference at r=30. */
                  strokeDasharray="188.5"
                  strokeDashoffset={
                    188.5 *
                    (1 -
                      (result.crawlers.length - blockedCrawlers.length) /
                        Math.max(result.crawlers.length, 1))
                  }
                  transform="rotate(-90 36 36)"
                />
              </svg>
              <span className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-sm font-semibold tabular-nums">
                  {result.crawlers.length - blockedCrawlers.length}/
                  {result.crawlers.length}
                </span>
              </span>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {result.crawlers.map((crawler) => (
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
                <span className="text-sm">{crawler.owner}</span>
                <span className="ml-auto font-mono text-[11px] text-muted-foreground">
                  {crawler.agent}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Findings, each with how to fix it. */}
      <div>
        <h3 className="text-xl font-semibold tracking-tight">
          Issues we <span className="text-primary">found</span>
        </h3>

        {result.issues.length === 0 ? (
          <Card className="mt-4">
            <CardContent className="py-6 text-sm text-muted-foreground">
              We found nothing wrong on the pages we read. Sign up and we will
              check your whole site, then start finding the searches your
              customers use.
            </CardContent>
          </Card>
        ) : (
          <ul className="mt-4 space-y-3">
            {result.issues.map((issue, index) => {
              const fix = fixFor(issue.type);
              return (
                <li key={`${issue.type}-${index}`}>
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
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                          {ISSUE_LABELS[issue.type] ?? issue.type}
                          {/*
                            Named once here rather than repeating the whole
                            finding per page.
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
                              <li
                                key={url}
                                className="truncate font-mono text-xs text-muted-foreground"
                              >
                                {pathOf(url)}
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
                          The fix, not just the fault. A list of problems with
                          no remedy is an anxiety rather than a to-do list.
                        */}
                        {fix ? (
                          <p className="mt-2 border-l-2 border-primary/30 pl-2.5 text-sm">
                            {fix.fix}
                            <span className="ml-1 text-xs text-muted-foreground">
                              ({fix.effort}
                              {fix.needsDeveloper ? ", may need your developer" : ""}
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
      </div>

      {/* Sites they link out to. Labelled for what it is, not "competitors". */}
      {result.linkedHosts.length > 0 ? (
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
              {result.linkedHosts.map((host) => (
                <span
                  key={host}
                  className="rounded-full border bg-card px-3 py-1.5 font-mono text-xs"
                >
                  {host}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/*
        The gate. States a real number from the real crawl — never an invented
        "47 issues found" — so the visitor can trust it.
      */}
      {result.hiddenIssues > 0 ? (
        <Card className="border-primary/40">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 py-6">
            <div className="flex items-start gap-3">
              <Lock
                className="mt-0.5 size-5 shrink-0 text-primary"
                aria-hidden="true"
              />
              <div>
                <p className="font-medium">
                  {result.hiddenIssues} more{" "}
                  {result.hiddenIssues === 1 ? "thing" : "things"} to fix
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Sign up free to see the full list, and we will start writing
                  the pages that fix them.
                </p>
              </div>
            </div>
            <Button asChild className="h-11 rounded-full px-6">
              <Link href="/sign-up">
                See the full report
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {/*
        The join block.

        A bare "sign up" button after a page of findings asks the visitor to
        take it on faith that signing up does something about them. This names
        what happens next, in the order it happens, and every line is a real
        feature rather than a promise — the fixes come from the findings above,
        the articles from the content planner, the links from the exchange.

        Kept to three so it reads as a next step rather than a pricing table;
        the plans are one click away for anyone who wants them.
      */}
      <Card className="border-primary/30 bg-primary/[0.03]">
        <CardContent className="py-8">
          <div className="text-center">
            <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
              What happens when you join
            </p>
            <h3 className="mt-3 text-2xl font-semibold tracking-tight text-balance">
              We fix what we found, then keep going
            </h3>
          </div>

          <div className="mt-7 grid gap-5 sm:grid-cols-3">
            {[
              {
                icon: ListChecks,
                title: "Every finding, in order",
                body: `All ${
                  result.counts.critical +
                  result.counts.warning +
                  result.counts.info +
                  result.hiddenIssues
                } of them, with what to change and how long it takes.`,
              },
              {
                icon: FileText,
                title: "Articles written for you",
                body: "Researched from what your customers search for, published to your own site.",
              },
              {
                icon: Link2,
                title: "Real backlinks, earned",
                body: "Host one article for a related business and earn a link back to yours.",
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="text-center sm:text-left">
                  <span className="inline-flex size-10 items-center justify-center rounded-xl bg-primary/10">
                    <Icon
                      className="size-5 text-primary"
                      aria-hidden="true"
                    />
                  </span>
                  <p className="mt-3 font-semibold">{item.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.body}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button asChild className="h-12 rounded-full px-7 text-base font-semibold">
              <Link href="/sign-up">
                Get Started
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button
              variant="outline"
              asChild
              className="h-12 rounded-full px-7 text-base"
            >
              <Link href="/pricing">See pricing</Link>
            </Button>
          </div>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            Plans start at EUR 1 for the first month.
          </p>
        </CardContent>
      </Card>

      {result.cached ? (
        <p className="text-center text-xs text-muted-foreground">
          Showing a check from the last 24 hours.
        </p>
      ) : null}
    </div>
  );
}
