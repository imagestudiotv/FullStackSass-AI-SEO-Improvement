"use client";

import { CheckCircle2, ChevronDown, Clock, ExternalLink, ListChecks, Search, Wrench } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/states";
import { Notice } from "@/components/workspace/notice";
import { WorkspaceSection } from "@/components/workspace/section";
import type { Locale } from "@/lib/i18n/config";
import { format, formatNumber } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";

import {
  FIRST_PAGE_TYPES,
  GROUPED_TYPES,
  QUERY_MAX,
  SEVERITY_FILTERS,
  countText,
  effortText,
  filterSearch,
  findingTotals,
  issueText,
  matchFinding,
  pagesAffected,
  pathOf,
  rowDetail,
  type Finding,
  type FindingMatch,
  type HealthIssueRow,
  type HealthText,
  type SeverityFilter,
} from "./health-model";
import { PreviousResultPill, SeverityBadge, severityLabel } from "./health-sections";

/** Affected pages listed before "Show all N pages". The rest are one press away, never dropped. */
const ROWS_SHOWN = 10;

/**
 * The findings, most serious first, with a severity filter and a search -
 * both client-side over what the page loaded, both kept in the URL
 * (?severity=&q=) so a filtered view can be shared or reloaded. Changing
 * them writes the URL with history.replaceState, which Next.js follows
 * without asking the server for anything: filtering never re-reads, let
 * alone re-runs, the check.
 */
export function FindingsSection({
  findings,
  totalRows,
  loadedRows,
  pagesRead,
  isPrevious,
  initialSeverity,
  initialQuery,
  locale,
  t,
}: {
  findings: Finding[];
  /** Every issue row the audit stored. */
  totalRows: number;
  /** The rows sent to the page (capped on the server). */
  loadedRows: number;
  pagesRead: number | null;
  /** A newer check is queued, running or failed: these are the previous result's findings. */
  isPrevious: boolean;
  initialSeverity: SeverityFilter;
  initialQuery: string;
  locale: Locale;
  t: HealthText;
}) {
  const [severity, setSeverity] = useState<SeverityFilter>(initialSeverity);
  const [query, setQuery] = useState(initialQuery);
  /** Per finding type: opened or closed by the reader. Unset follows the search. */
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [allRows, setAllRows] = useState<Record<string, boolean>>({});
  const searchRef = useRef<HTMLInputElement>(null);

  function apply(nextSeverity: SeverityFilter, nextQuery: string) {
    setSeverity(nextSeverity);
    setQuery(nextQuery);
    try {
      const { pathname, search, hash } = window.location;
      // null state, as the Next.js docs show: Next copies its own history state in
      // and syncs useSearchParams; passing its state back would skip that sync.
      window.history.replaceState(null, "", `${pathname}${filterSearch(search, nextSeverity, nextQuery)}${hash}`);
    } catch {
      // The filter still applies on screen; only the shareable URL is lost.
    }
  }

  const describe = (row: HealthIssueRow) => rowDetail(row.type, row.detail, t, locale) ?? "";
  const counts = findingTotals(findings);
  const filtered = severity !== "all" || query.trim() !== "";
  const visible = findings
    .map((finding) => {
      const text = issueText(finding.type, t);
      return { finding, text, match: matchFinding(finding, text, query, describe) };
    })
    .filter(({ finding, match }) => (severity === "all" || finding.severity === severity) && match.matches);

  const filterLabel = (value: SeverityFilter) => (value === "all" ? t.filterAll : severityLabel(value, t));
  const filterCount = (value: SeverityFilter) => (value === "all" ? findings.length : counts[value]);

  return (
    <WorkspaceSection
      id="findings"
      icon={ListChecks}
      title={t.findingsTitle}
      description={t.findingsDescription}
      actions={
        <>
          {isPrevious ? <PreviousResultPill t={t} /> : null}
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums">
            {countText(t.findingsCount, findings.length, locale)}
          </span>
        </>
      }
    >
      {findings.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title={t.noFindingsTitle}
          description={pagesRead ? countText(t.noFindingsBody, pagesRead, locale) : undefined}
        />
      ) : (
        <div className="space-y-4">
          {loadedRows < totalRows ? (
            <Notice tone="info">
              {format(t.rowsCapped, { total: formatNumber(totalRows, locale), shown: formatNumber(loadedRows, locale) })}
            </Notice>
          ) : null}

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div
              role="group"
              aria-label={t.filterLabel}
              className="flex max-w-full overflow-x-auto rounded-lg border p-0.5 text-sm sm:w-fit"
            >
              {SEVERITY_FILTERS.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={severity === value}
                  onClick={() => apply(value, query)}
                  className={cn(
                    "shrink-0 rounded-md px-3 py-1 whitespace-nowrap outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none",
                    severity === value ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {filterLabel(value)}{" "}
                  <span className="text-xs tabular-nums">({formatNumber(filterCount(value), locale)})</span>
                </button>
              ))}
            </div>
            <div className="relative w-full lg:max-w-xs">
              <label htmlFor="health-findings-search" className="sr-only">
                {t.searchLabel}
              </label>
              <Search
                className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="health-findings-search"
                ref={searchRef}
                type="search"
                value={query}
                maxLength={QUERY_MAX}
                placeholder={t.searchPlaceholder}
                onChange={(event) => apply(severity, event.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          <div className="flex min-h-7 flex-wrap items-center gap-x-2 gap-y-1">
            <p aria-live="polite" className="text-sm text-muted-foreground">
              {filtered
                ? format(t.showingFiltered, {
                    shown: formatNumber(visible.length, locale),
                    total: formatNumber(findings.length, locale),
                  })
                : ""}
            </p>
            {filtered ? (
              <Button
                variant="link"
                size="sm"
                className="h-7 px-0"
                onClick={() => {
                  apply("all", "");
                  // This button disappears with the filters; keep focus where the reader was working.
                  searchRef.current?.focus();
                }}
              >
                {t.clearFilters}
              </Button>
            ) : null}
          </div>

          {visible.length === 0 ? (
            <div className="rounded-lg border border-dashed px-6 py-8 text-center">
              <p className="text-sm font-medium">{t.noMatchTitle}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t.noMatchBody}</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {visible.map(({ finding, text, match }) => {
                // Opened by the reader, or - while a search found this finding by one of its pages - opened for them.
                const isOpen = open[finding.type] ?? match.rows !== null;
                return (
                  <FindingItem
                    key={finding.type}
                    finding={finding}
                    text={text}
                    match={match}
                    open={isOpen}
                    onToggle={() => setOpen((prev) => ({ ...prev, [finding.type]: !isOpen }))}
                    showAll={allRows[finding.type] === true}
                    onShowAll={(next) => setAllRows((prev) => ({ ...prev, [finding.type]: next }))}
                    describe={describe}
                    locale={locale}
                    t={t}
                  />
                );
              })}
            </ul>
          )}
        </div>
      )}
    </WorkspaceSection>
  );
}

function safeHref(url: string): string | null {
  return /^https?:\/\//i.test(url) ? url : null;
}

function FindingItem({
  finding,
  text,
  match,
  open,
  onToggle,
  showAll,
  onShowAll,
  describe,
  locale,
  t,
}: {
  finding: Finding;
  text: { label: string; about: string; fix: string | null };
  match: FindingMatch;
  open: boolean;
  onToggle: () => void;
  showAll: boolean;
  onShowAll: (next: boolean) => void;
  describe: (row: HealthIssueRow) => string;
  locale: Locale;
  t: HealthText;
}) {
  // An id must not contain spaces; an unknown stored type could.
  const panelId = `finding-${finding.type.replace(/[^\w-]/g, "-")}`;
  const effort = effortText(finding.type, t);
  const rows = match.rows ?? finding.rows;
  const listed = showAll ? rows : rows.slice(0, ROWS_SHOWN);
  const pages = pagesAffected(finding);

  return (
    <li className="min-w-0 rounded-lg border">
      <h3 className="text-sm">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          onClick={onToggle}
          className="flex w-full items-start gap-3 rounded-lg p-4 text-left outline-none transition-colors hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none"
        >
          <span className="min-w-0 flex-1 space-y-1">
            <span className="flex flex-wrap items-center gap-2">
              <SeverityBadge severity={finding.severity} t={t} />
              <span className="font-medium text-foreground">{text.label}</span>
            </span>
            {text.about ? <span className="block font-normal text-muted-foreground">{text.about}</span> : null}
          </span>
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums">
            {countText(t.pagesCount, pages, locale)}
          </span>
          <ChevronDown
            className={cn(
              "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none",
              open && "rotate-180",
            )}
            aria-hidden="true"
          />
        </button>
      </h3>

      {open ? (
        <div id={panelId} className="space-y-4 border-t px-4 py-4">
          {text.fix ? (
            <div className="rounded-lg bg-muted/30 p-3">
              <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t.howToFix}</h4>
              <p className="mt-1 max-w-3xl text-sm">{text.fix}</p>
              {effort.effort || effort.needsDeveloper ? (
                <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {effort.effort ? (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3.5" aria-hidden="true" />
                      {effort.effort}
                    </span>
                  ) : null}
                  {effort.needsDeveloper ? (
                    <span className="inline-flex items-center gap-1">
                      <Wrench className="size-3.5" aria-hidden="true" />
                      {t.needsDeveloper}
                    </span>
                  ) : null}
                </p>
              ) : null}
            </div>
          ) : null}

          <div>
            <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {format(t.affectedPages, { count: formatNumber(pages, locale) })}
            </h4>
            <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
              {GROUPED_TYPES.has(finding.type) ? <p>{t.groupNote}</p> : null}
              {FIRST_PAGE_TYPES.has(finding.type) ? <p>{t.firstPageNote}</p> : null}
              {match.rows !== null ? (
                <p>
                  {format(t.matchingPages, {
                    shown: formatNumber(match.rows.length, locale),
                    total: formatNumber(finding.rows.length, locale),
                  })}
                </p>
              ) : null}
              {finding.rows.length < finding.count ? (
                <p>
                  {format(t.notLoaded, {
                    shown: formatNumber(finding.rows.length, locale),
                    total: formatNumber(finding.count, locale),
                  })}
                </p>
              ) : null}
            </div>
            <ul className="mt-2 divide-y">
              {listed.map((row) => {
                const href = row.url ? safeHref(row.url) : null;
                const detail = describe(row);
                return (
                  <li key={row.id} className="min-w-0 py-2">
                    {row.url ? (
                      href ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={row.url}
                          className="rounded-sm font-mono text-xs break-all text-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                        >
                          {pathOf(row.url, t.homepage)}
                          <ExternalLink className="ml-1 inline size-3 align-[-2px] text-muted-foreground" aria-hidden="true" />
                          <span className="sr-only"> {t.opensInNewTab}</span>
                        </a>
                      ) : (
                        <span className="font-mono text-xs break-all">{row.url}</span>
                      )
                    ) : (
                      <span className="text-xs text-muted-foreground">{t.noUrl}</span>
                    )}
                    {detail ? <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p> : null}
                  </li>
                );
              })}
            </ul>
            {rows.length > ROWS_SHOWN ? (
              <Button variant="outline" size="sm" className="mt-2" onClick={() => onShowAll(!showAll)}>
                {showAll ? t.showFewerPages : format(t.showAllPages, { count: formatNumber(rows.length, locale) })}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </li>
  );
}
