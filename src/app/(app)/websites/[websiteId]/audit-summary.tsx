"use client";

/*
  eslint-disable @next/next/no-img-element --
  The image is on the CUSTOMER's domain, which is not knowable ahead of time.
  next/image needs every remote host in remotePatterns, so optimising it would
  mean a wildcard - which turns our optimiser into an open image proxy.
*/
import {
  Check,
  ChevronDown,
  Globe,
  Languages,
  Layers,
  RotateCw,
} from "lucide-react";
import { useState } from "react";

import type { AuditContext, AuditSummary } from "@/lib/audit/rules";

/**
 * The site beside what the check found, as three expandable rows.
 *
 * The same block the public audit opens with, which is what the client asked
 * for - but the COPY is rewritten, because the two readers are in opposite
 * positions.
 *
 * The public version sells: "Your 3 free assets", "N more you get when you
 * join", "your profile and first backlink are set up when you join". Every
 * line of that is addressed to somebody who has not paid. Shown to a customer
 * who already has an account, a plan and a backlink, it would read as an
 * upsell for things they are already paying for - the single most annoying
 * thing a product can do.
 *
 * So the structure is identical and the words are not: the same browser
 * frame, the same three rows, each summarising what this check actually
 * found on their site.
 */

function Row({
  index,
  label,
  summary,
  open,
  onToggle,
  children,
}: {
  index: number;
  label: string;
  /** One line visible while collapsed - the answer, not a restatement. */
  summary: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <li className="overflow-hidden rounded-xl border">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-muted/40"
      >
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
          <Check className="size-3.5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">
            {index}. {label}
          </span>
          <span className="mt-0.5 block truncate text-sm text-muted-foreground">
            {summary}
          </span>
        </span>
        <ChevronDown
          className={`size-4 shrink-0 text-muted-foreground transition-transform ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>

      {open ? <div className="border-t px-4 py-4">{children}</div> : null}
    </li>
  );
}

export function AuditSummaryPanel({
  domain,
  summary,
  context,
  topFindings,
  totalFindings,
}: {
  domain: string;
  summary: AuditSummary;
  /** Absent on audits written before the context was collected. */
  context?: AuditContext;
  /** The first few grouped findings, in the order worth doing them. */
  topFindings: { type: string; detail: string; pageCount: number }[];
  /** Every finding, so the row can say how many are below. */
  totalFindings: number;
}) {
  /**
   * Nothing open to begin with. The full report sits below this block, so an
   * expanded row on arrival would push it down the page to repeat something
   * already visible.
   */
  const [open, setOpen] = useState<number | null>(null);

  const crawlers = context?.crawlers ?? [];
  const blocked = crawlers.filter((crawler) => !crawler.allowed);
  const allowed = crawlers.length - blocked.length;
  const totalIssues =
    summary.counts.critical + summary.counts.warning + summary.counts.info;

  function toggle(index: number) {
    setOpen((current) => (current === index ? null : index));
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
      {/* The browser frame, showing the site the findings came from. */}
      <div className="overflow-hidden rounded-2xl border bg-card shadow-[0_24px_60px_-30px_rgba(0,0,0,0.25)]">
        <div className="flex items-center gap-3 border-b bg-muted/40 px-4 py-3">
          <span className="flex gap-1.5" aria-hidden="true">
            <span className="size-2.5 rounded-full bg-red-400" />
            <span className="size-2.5 rounded-full bg-amber-400" />
            <span className="size-2.5 rounded-full bg-emerald-400" />
          </span>
          <span className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-background px-3 py-1.5 text-xs text-muted-foreground">
            <Globe className="size-3 shrink-0" aria-hidden="true" />
            <span className="truncate">{domain}</span>
          </span>
          <RotateCw
            className="size-3.5 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
        </div>

        <div className="relative aspect-[4/3] bg-gradient-to-br from-primary/10 via-muted/40 to-blue-500/10">
          {context?.previewImage ? (
            <img
              src={context.previewImage}
              alt=""
              className="size-full object-cover object-top"
            />
          ) : (
            /*
              No picture rather than a guessed one. The crawl reads og:image
              and nothing else - /favicon.ico is a convention, not a
              guarantee, and a broken frame looks worse than an empty one.
            */
            <div className="flex size-full flex-col items-center justify-center gap-2 px-6 text-center">
              <Globe
                className="size-7 text-muted-foreground/40"
                aria-hidden="true"
              />
              <p className="text-sm text-muted-foreground">{domain}</p>
            </div>
          )}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
          Your latest check
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight">
          Here is what we found.
        </h2>
        <p className="mt-2 text-muted-foreground">
          Open any of them to see the detail.
        </p>

        <ul className="mt-7 space-y-3">
          <Row
            index={1}
            label="Site check"
            summary={`${summary.pagesCrawled} ${
              summary.pagesCrawled === 1 ? "page" : "pages"
            } read${context?.platform ? ` · ${context.platform}` : ""}`}
            open={open === 0}
            onToggle={() => toggle(0)}
          >
            {/*
              Two columns, not three. This panel is half the page width with
              the browser frame beside it, and three columns of label, value
              and note wrapped into an unreadable stack.
            */}
            <dl className="grid gap-4 sm:grid-cols-2">
              {[
                {
                  icon: Globe,
                  term: "Pages read",
                  value: String(summary.pagesCrawled),
                  note: "Every check reads up to 25.",
                },
                {
                  icon: Layers,
                  term: "Platform",
                  value: context?.platform ?? "Custom",
                  note: context?.platform
                    ? "Detected from the markup."
                    : "No common platform recognised.",
                },
                {
                  icon: Languages,
                  term: "Language",
                  value: context?.language?.toUpperCase() ?? "Not set",
                  note: context?.language
                    ? "What the page declares."
                    : "No lang attribute - engines have to guess.",
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.term}>
                    <dt className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      <Icon className="size-3.5" aria-hidden="true" />
                      {item.term}
                    </dt>
                    <dd className="mt-1.5 font-semibold">{item.value}</dd>
                    <dd className="text-xs text-muted-foreground">
                      {item.note}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </Row>

          <Row
            index={2}
            label="What to fix"
            summary={
              totalIssues === 0
                ? "Nothing wrong on the pages we read"
                : `${totalIssues} ${
                    totalIssues === 1 ? "thing" : "things"
                  } to fix · scored ${summary.score} of 100`
            }
            open={open === 1}
            onToggle={() => toggle(1)}
          >
            {totalIssues === 0 ? (
              <p className="text-sm text-muted-foreground">
                We found nothing wrong on the pages we read, which is rarer
                than it sounds.
              </p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  In the order worth doing them. The full list is below, each
                  with what to change.
                </p>
                <ul className="mt-3 space-y-2">
                  {topFindings.map((finding, position) => (
                    <li
                      key={finding.type}
                      className="flex items-start gap-2.5 text-sm"
                    >
                      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[0.7rem] font-semibold tabular-nums">
                        {position + 1}
                      </span>
                      <span className="min-w-0">
                        {finding.detail}
                        <span className="text-muted-foreground">
                          {" "}
                          · {finding.pageCount}{" "}
                          {finding.pageCount === 1 ? "page" : "pages"}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
                {/*
                  "N more below", not "N more you get when you join". The
                  public version gates the rest behind signing up; this
                  reader has already signed up and the rest is on the same
                  screen.
                */}
                {totalFindings > topFindings.length ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    {totalFindings - topFindings.length} more below.
                  </p>
                ) : null}
              </>
            )}
          </Row>

          <Row
            index={3}
            label="AI assistant access"
            summary={
              crawlers.length === 0
                ? "Not checked yet"
                : blocked.length === 0
                  ? `Every AI assistant can read you · ${allowed}/${crawlers.length}`
                  : `${blocked.length} AI ${
                      blocked.length === 1 ? "assistant is" : "assistants are"
                    } blocked`
            }
            open={open === 2}
            onToggle={() => toggle(2)}
          >
            {crawlers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                This check ran before we started reading robots.txt. Run it
                again and we will tell you which AI assistants can reach your
                pages.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                {blocked.length === 0
                  ? "Your robots.txt lets every major AI crawler through, so you can be cited in their answers."
                  : `Your robots.txt blocks ${blocked.length} of them. They cannot cite a site they are not allowed to read.`}
              </p>
            )}

            {context && context.linkedHosts.length > 0 ? (
              <div className="mt-4">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Sites you already link out to
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {context.linkedHosts.map((host) => (
                    <span
                      key={host}
                      className="rounded-full border px-2.5 py-1 font-mono text-xs text-muted-foreground"
                    >
                      {host}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </Row>
        </ul>
      </div>
    </div>
  );
}
