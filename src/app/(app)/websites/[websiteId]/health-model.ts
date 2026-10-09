import { explainCrawlError } from "@/lib/audit/explain";
import { fixFor } from "@/lib/audit/fixes";
import type { AuditSummary } from "@/lib/audit/rules";
import type { Locale } from "@/lib/i18n/config";
import { format, formatDate, formatNumber } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages";
import { FREE_ARTICLES_ONLY } from "@/lib/plans/features";

/**
 * Website health: everything the report derives from the stored audit, kept
 * apart from the components so each rule can be tested on its own.
 *
 * Nothing here computes a new metric. The score, the severities and the issue
 * definitions are the audit job's own (lib/audit/rules.ts); this file only
 * groups the stored rows, says which run the customer is looking at, and puts
 * the stored English into the reader's language.
 */

export type HealthText = Messages["app"]["health"];
export type WorkspaceText = Messages["app"]["workspace"];

/** Pages one check reads at most: MAX_PAGES in inngest/functions/audit-website.ts. */
export const PAGES_PER_CHECK = 25;

/**
 * A "one|many" message whose {count} is written with the reader's
 * separators (1,234 / 1.234 / 1 234). plural() inserts the bare number, which
 * printed "2000 pages" beside a "2,000" elsewhere on the same report.
 */
export function countText(
  template: string,
  count: number,
  locale: Locale,
  values: Record<string, string | number> = {},
): string {
  const [one = "", many = ""] = template.split("|");
  return format(count === 1 ? one : many, { ...values, count: formatNumber(count, locale) });
}

/* ------------------------------------------------------------------------- */
/* Stored shapes (read by health-data.ts on the server)                       */
/* ------------------------------------------------------------------------- */

export type HealthIssueRow = {
  id: string;
  type: string;
  severity: string;
  url: string | null;
  detail: string | null;
};

/** Exact rows per type and severity, counted in SQL, whatever was loaded. */
export type HealthTypeCount = { type: string; severity: string; count: number };

export type HealthAudit = {
  id: string;
  score: number | null;
  /** Null, or one of several historical shapes - every field is read optionally. */
  summary: AuditSummary | null;
  createdAt: Date;
  /** The rows sent to the page: most serious first, capped (see health-data.ts). */
  rows: HealthIssueRow[];
  typeCounts: HealthTypeCount[];
  /** Every row the audit stored, loaded or not. */
  totalRows: number;
};

export type HealthCrawl = {
  status: string;
  pagesCrawled: number;
  pagesFound: number;
  error: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
};

/* ------------------------------------------------------------------------- */
/* Which run the page is showing                                              */
/* ------------------------------------------------------------------------- */

/** A request still waiting after this long is called out (and no longer polled). */
export const QUEUED_STALE_MS = 15 * 60 * 1000;
/** A crawl reads at most 25 pages; one still "running" after this long has most likely died. */
export const RUNNING_STALE_MS = 30 * 60 * 1000;

export type FailureKind =
  | "timeout"
  | "notHtml"
  | "tooLarge"
  | "invalidUrl"
  | "refused"
  | "unreachable"
  | "notEntitled"
  | "generic";

export type HealthRun =
  | { phase: "idle" }
  | { phase: "queued"; requestedAt: Date; stale: boolean }
  | {
      phase: "running";
      startedAt: Date | null;
      /** Fetch attempts so far, failures included (the crawler's own count). */
      pagesCrawled: number;
      /** Distinct addresses discovered so far; NOT capped at the page limit. */
      pagesFound: number;
      stale: boolean;
    }
  | { phase: "failed"; startedAt: Date | null; failure: FailureKind };

/**
 * The classification lives in lib/audit/explain.ts (shared with support
 * tooling); this maps its answer onto a key the dictionary can translate.
 */
const FAILURE_BY_SUMMARY: Record<string, FailureKind> = {
  "Your website took too long to respond.": "timeout",
  "That address did not return a web page.": "notHtml",
  "Your home page is too large for us to analyse.": "tooLarge",
  "That website address could not be read.": "invalidUrl",
  "Your website refused the request.": "refused",
  "We could not reach your website.": "unreachable",
};

export function failureKind(error: string | null | undefined): FailureKind {
  // The job's own refusal to spend for a lapsed subscription (lib/billing/entitled.ts).
  if (error && /subscription is not active/i.test(error)) return "notEntitled";
  return FAILURE_BY_SUMMARY[explainCrawlError(error).summary] ?? "generic";
}

/**
 * Where the latest run stands, from the stored state only.
 *
 * - queued: startAudit reserved a slot and queued the job, and the job has not
 *   yet created its crawl row. Nothing else records a request (startAudit
 *   writes no crawl row), so the open reservation is the only honest signal.
 * - running: the job's crawl row says so.
 * - failed: the crawl row says so AND no audit was saved by that run - a run
 *   that saved its audit and then failed to notify is not a failed check.
 */
export function deriveRun({
  crawl,
  requestedAt,
  auditCreatedAt,
  now = new Date(),
}: {
  crawl: HealthCrawl | null;
  requestedAt: Date | null;
  auditCreatedAt: Date | null;
  now?: Date;
}): HealthRun {
  const crawlStarted = crawl?.startedAt?.getTime() ?? null;
  if (requestedAt && (crawlStarted === null || requestedAt.getTime() > crawlStarted)) {
    return {
      phase: "queued",
      requestedAt,
      stale: now.getTime() - requestedAt.getTime() > QUEUED_STALE_MS,
    };
  }
  if (!crawl) return { phase: "idle" };
  if (crawl.status === "running" || crawl.status === "queued") {
    return {
      phase: "running",
      startedAt: crawl.startedAt,
      pagesCrawled: crawl.pagesCrawled,
      pagesFound: crawl.pagesFound,
      stale: crawlStarted !== null && now.getTime() - crawlStarted > RUNNING_STALE_MS,
    };
  }
  if (crawl.status === "failed") {
    const savedByThisRun =
      auditCreatedAt !== null && crawlStarted !== null && auditCreatedAt.getTime() >= crawlStarted;
    if (!savedByThisRun) {
      return { phase: "failed", startedAt: crawl.startedAt, failure: failureKind(crawl.error) };
    }
  }
  return { phase: "idle" };
}

/** Polling follows a run only while it can still move. */
export function isFollowing(run: HealthRun): boolean {
  return (run.phase === "queued" || run.phase === "running") && !run.stale;
}

/**
 * The addresses the crawl discovered, when the stored crawl row belongs to
 * the audit on screen. The row is replaced at the start of every run, so it
 * describes an older audit only if that audit was saved by the same run.
 */
export function discoveredFor(audit: HealthAudit | null, crawl: HealthCrawl | null): number | null {
  if (!audit || !crawl || crawl.status !== "completed") return null;
  const created = audit.createdAt.getTime();
  if (crawl.startedAt && crawl.startedAt.getTime() > created) return null;
  if (crawl.finishedAt && crawl.finishedAt.getTime() < created) return null;
  return crawl.pagesFound;
}

/* ------------------------------------------------------------------------- */
/* Findings                                                                   */
/* ------------------------------------------------------------------------- */

export type Severity = "critical" | "warning" | "info";

const RANK: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };

/** The job writes only these three; anything else is filed with the least serious. */
export function normaliseSeverity(value: string): Severity {
  return value === "critical" || value === "warning" ? value : "info";
}

export type Finding = {
  type: string;
  severity: Severity;
  /** Exact stored rows of this type. */
  count: number;
  /** The loaded rows of this type, in the server's order. */
  rows: HealthIssueRow[];
};

/**
 * One finding per issue type, most serious first, then the most widespread.
 *
 * The count comes from the SQL count, not from the rows on the page, so a
 * capped list can never shrink a finding.
 */
export function groupFindings(rows: HealthIssueRow[], typeCounts: HealthTypeCount[]): Finding[] {
  const byType = new Map<string, Finding>();
  for (const entry of typeCounts) {
    const severity = normaliseSeverity(entry.severity);
    const existing = byType.get(entry.type);
    if (existing) {
      existing.count += entry.count;
      if (RANK[severity] < RANK[existing.severity]) existing.severity = severity;
    } else {
      byType.set(entry.type, { type: entry.type, severity, count: entry.count, rows: [] });
    }
  }
  for (const row of rows) {
    let finding = byType.get(row.type);
    if (!finding) {
      finding = { type: row.type, severity: normaliseSeverity(row.severity), count: 0, rows: [] };
      byType.set(row.type, finding);
    }
    finding.rows.push(row);
  }
  for (const finding of byType.values()) {
    finding.count = Math.max(finding.count, finding.rows.length);
  }
  return [...byType.values()].sort(
    (a, b) => RANK[a.severity] - RANK[b.severity] || b.count - a.count || a.type.localeCompare(b.type),
  );
}

export type SeverityTotals = Record<Severity, number>;

/** Stored rows per severity: the same counting the score uses. */
export function severityTotals(typeCounts: HealthTypeCount[]): SeverityTotals {
  const totals: SeverityTotals = { critical: 0, warning: 0, info: 0 };
  for (const entry of typeCounts) totals[normaliseSeverity(entry.severity)] += entry.count;
  return totals;
}

/** Findings (issue types) per severity. */
export function findingTotals(findings: Finding[]): SeverityTotals {
  const totals: SeverityTotals = { critical: 0, warning: 0, info: 0 };
  for (const finding of findings) totals[finding.severity] += 1;
  return totals;
}

/** Pages the crawl tried and could not open: one unreachable_page row each. */
export function failedPages(typeCounts: HealthTypeCount[]): number {
  return typeCounts.filter((entry) => entry.type === "unreachable_page").reduce((sum, entry) => sum + entry.count, 0);
}

/* ------------------------------------------------------------------------- */
/* Filters (URL: ?severity=critical|warning|info&q=...)                        */
/* ------------------------------------------------------------------------- */

export type SeverityFilter = "all" | Severity;
export const SEVERITY_FILTERS: SeverityFilter[] = ["all", "critical", "warning", "info"];
export const QUERY_MAX = 100;

function first(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value;
}

export function parseSeverityFilter(value: unknown): SeverityFilter {
  const v = first(value);
  return SEVERITY_FILTERS.includes(v as SeverityFilter) ? (v as SeverityFilter) : "all";
}

export function parseQuery(value: unknown): string {
  const v = first(value);
  return typeof v === "string" ? v.trim().slice(0, QUERY_MAX) : "";
}

/** The page URL's query string for a filter, keeping any other parameter. */
export function filterSearch(current: string, severity: SeverityFilter, query: string): string {
  const params = new URLSearchParams(current);
  if (severity === "all") params.delete("severity");
  else params.set("severity", severity);
  const q = query.trim().slice(0, QUERY_MAX);
  if (q) params.set("q", q);
  else params.delete("q");
  const search = params.toString();
  return search ? `?${search}` : "";
}

/**
 * Case- and accent-insensitive, so "systeme" finds "Système". toLowerCase,
 * not toLocaleLowerCase: the filter also runs in the server render, and a
 * runtime-locale fold (Turkish dotless i) could differ from the browser's.
 */
export function fold(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export type FindingMatch = {
  matches: boolean;
  /** Null: every row is shown. Otherwise only the rows the query found. */
  rows: HealthIssueRow[] | null;
};

/**
 * Whether a finding answers the search, and which of its pages do.
 *
 * A search for "pricing" should open the findings on /pricing and show that
 * page, not every page of every finding that happens to include it.
 */
export function matchFinding(
  finding: Finding,
  text: { label: string; about: string },
  query: string,
  rowText: (row: HealthIssueRow) => string,
): FindingMatch {
  const q = fold(query.trim());
  if (!q) return { matches: true, rows: null };
  if ([text.label, text.about, finding.type].some((value) => fold(value).includes(q))) {
    return { matches: true, rows: null };
  }
  const rows = finding.rows.filter((row) => fold(`${row.url ?? ""} ${rowText(row)}`).includes(q));
  return rows.length > 0 ? { matches: true, rows } : { matches: false, rows: [] };
}

/* ------------------------------------------------------------------------- */
/* Words                                                                      */
/* ------------------------------------------------------------------------- */

export function issueText(type: string, t: HealthText): { label: string; about: string; fix: string | null } {
  const known = (t.issues as Partial<Record<string, { label: string; about: string; fix: string }>>)[type];
  if (known) return known;
  // A type this page does not know yet: its name made readable, and no advice invented.
  const words = type.replace(/[_-]+/g, " ").trim();
  return { label: words.charAt(0).toUpperCase() + words.slice(1), about: "", fix: null };
}

/** Effort and developer hints from the shared fix table (lib/audit/fixes.ts). */
export function effortText(type: string, t: HealthText): { effort: string | null; needsDeveloper: boolean } {
  const fix = fixFor(type);
  if (!fix) return { effort: null, needsDeveloper: false };
  const effort = fix.effort === "minutes" ? t.effortMinutes : fix.effort === "an hour" ? t.effortHour : t.effortLonger;
  return { effort, needsDeveloper: fix.needsDeveloper === true };
}

/** Types whose stored detail is the same sentence on every page: the finding's text says it all. */
const FIXED_DETAIL = new Set([
  "noindex",
  "missing_title",
  "missing_meta_description",
  "missing_h1",
  "missing_canonical",
  "missing_lang",
]);

/**
 * One row's own detail in the reader's language.
 *
 * The job stores English sentences with the values baked in
 * (lib/audit/rules.ts). The values are read back out of the known sentences;
 * a sentence this does not recognise is shown as stored rather than guessed
 * at, and a sentence that is the same on every page returns null.
 */
export function rowDetail(type: string, detail: string | null, t: HealthText, locale: Locale): string | null {
  if (!detail) return null;
  if (FIXED_DETAIL.has(type)) return null;
  const d = t.detail;
  const n = (value: string) => formatNumber(Number(value), locale);
  let m: RegExpExecArray | null;
  switch (type) {
    case "title_too_long":
      if ((m = /^Title is (\d+) characters and will be cut off after about (\d+)\./.exec(detail)))
        return format(d.titleLong, { chars: n(m[1]), max: n(m[2]) });
      break;
    case "title_too_short":
      if ((m = /^Title is only (\d+) characters/.exec(detail))) return format(d.titleShort, { chars: n(m[1]) });
      break;
    case "meta_description_too_long":
      if ((m = /^Description is (\d+) characters and will be truncated after about (\d+)\./.exec(detail)))
        return format(d.descriptionLong, { chars: n(m[1]), max: n(m[2]) });
      break;
    case "meta_description_too_short":
      if ((m = /^Description is only (\d+) characters/.exec(detail)))
        return format(d.descriptionShort, { chars: n(m[1]) });
      break;
    case "multiple_h1":
      if ((m = /^(\d+) H1 headings\./.exec(detail))) return format(d.multipleH1, { count: n(m[1]) });
      break;
    case "thin_content":
      if ((m = /^Only (\d+) words\./.exec(detail))) return format(d.thinContent, { words: n(m[1]) });
      break;
    case "images_missing_alt":
      if ((m = /^(\d+) of (\d+) images have no alt text/.exec(detail)))
        return format(d.imagesAlt, { missing: n(m[1]), total: n(m[2]) });
      break;
    case "large_page":
      if ((m = /^The HTML alone is (\d+) KB/.exec(detail))) return format(d.largePage, { kb: n(m[1]) });
      break;
    case "broken_page":
      if ((m = /^The page returned HTTP (\d+)\./.exec(detail))) return format(d.httpStatus, { status: m[1] });
      break;
    case "duplicate_title":
      if ((m = /^(\d+) pages share the title "([\s\S]*)"\. They will compete/.exec(detail)))
        return format(d.duplicateTitle, { count: n(m[1]), title: m[2] });
      break;
    case "duplicate_meta_description":
      if ((m = /^(\d+) pages share the same meta description\./.exec(detail)))
        return format(d.duplicateDescription, { count: n(m[1]) });
      break;
    case "no_internal_links":
      if ((m = /^(\d+) page\(s\) link to nothing else on the site\./.exec(detail)))
        return countText(d.noInternalLinks, Number(m[1]), locale);
      break;
    case "unreachable_page":
      return unreachableReason(detail, d) ?? detail;
  }
  return detail;
}

/** Why a page could not be opened, from "Could not be fetched (<kind>: <message>)." */
function unreachableReason(detail: string, d: HealthText["detail"]): string | null {
  const m = /^Could not be fetched \(([\s\S]*)\)\.$/.exec(detail);
  if (!m) return null;
  const reason = m[1];
  if (reason === "unknown error") return d.unreachUnknown;
  if (reason.startsWith("timeout:")) return d.unreachTimeout;
  if (reason.startsWith("not_html:")) return d.unreachNotHtml;
  if (reason.startsWith("http_error:")) {
    if (/blocks automated visitors/.test(reason)) return d.unreachBlocked;
    if (/asks for a password/.test(reason)) return d.unreachPassword;
    const status = /returned (\d{3})/.exec(reason);
    if (status) return format(d.unreachStatus, { status: status[1] });
    return null;
  }
  if (reason.startsWith("unreachable:")) {
    if (/Too many redirects/.test(reason)) return d.unreachRedirects;
    if (/redirected somewhere/.test(reason)) return d.unreachRedirectAway;
    return d.unreachConnect;
  }
  return null;
}

/** Findings whose rows are one group of pages each, listed by their first page. */
export const GROUPED_TYPES = new Set(["duplicate_title", "duplicate_meta_description"]);
/** Findings stored as one row that names the first page only. */
export const FIRST_PAGE_TYPES = new Set(["no_internal_links"]);

/**
 * Pages a finding affects. One row per page for most types; for the
 * site-wide ones a row is a GROUP whose stored detail carries its page count
 * ("3 pages share the title …"), so those counts are added up instead - and
 * when they cannot all be read, the row count is shown rather than a guess.
 */
export function pagesAffected(finding: Finding): number {
  if (!GROUPED_TYPES.has(finding.type) && !FIRST_PAGE_TYPES.has(finding.type)) return finding.count;
  if (finding.rows.length < finding.count) return finding.count;
  let sum = 0;
  for (const row of finding.rows) {
    const m = /^(\d+) (?:pages share|page\(s\) link)/.exec(row.detail ?? "");
    if (!m) return finding.count;
    sum += Number(m[1]);
  }
  return sum;
}

export type ScoreBand = "good" | "fair" | "poor";

/** The thresholds the report has always coloured the score by (80 and 50). */
export function scoreBand(score: number): ScoreBand {
  if (score >= 80) return "good";
  if (score >= 50) return "fair";
  return "poor";
}

const CROSS_CHECK_KEYS: Record<string, keyof HealthText["crossChecks"]> = {
  "Duplicate page titles": "duplicateTitles",
  "Duplicate descriptions": "duplicateDescriptions",
  "Internal linking": "internalLinking",
};

/**
 * Checks that could not run on this crawl (rules.ts: CROSS_PAGE_CHECKS, all
 * needing two pages). Stored on new audits; for older ones the same rule is
 * applied to the stored page count. A crawl that read no page at all is
 * reported as unreadable instead, so this list stays empty for it.
 */
export function notAssessed(summary: AuditSummary | null, t: HealthText): string[] {
  if (!summary || typeof summary.pagesCrawled !== "number" || summary.pagesCrawled === 0) return [];
  const labels: string[] = Array.isArray(summary.notAssessed)
    ? summary.notAssessed
    : summary.pagesCrawled < 2
      ? Object.keys(CROSS_CHECK_KEYS)
      : [];
  return labels.map((label) => {
    const key = CROSS_CHECK_KEYS[label];
    return key ? t.crossChecks[key] : label;
  });
}

/** Localised error for a refused startAudit (lib/audit/actions.ts) or entitlement check. */
export function localiseStartError(error: string, t: HealthText, tw: WorkspaceText): string {
  switch (error) {
    case "You have view-only access to this website.":
      return tw.viewOnly;
    case "Wait until the site has been analysed first":
      return t.siteNotReady;
    case "Choose a plan for this website first":
      return t.errNoPlan;
    case "This website's subscription is not active. Update billing to continue.":
      return t.errPlanInactive;
    case FREE_ARTICLES_ONLY:
      return tw.freeArticlesOnly;
    case "You have run this many times in the last hour. Please try again shortly.":
      return t.errQuota;
  }
  return error;
}

/**
 * A stored time in the reader's language, in UTC and labelled so.
 *
 * Rendered by a client component that is also rendered on the server: a time
 * zone left to the runtime would differ between the two, so it is fixed, as
 * the rest of the app does for stored times.
 */
export function formatWhen(value: Date | string, locale: Locale): string {
  return formatDate(value, locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
}

/** The path of an affected page; the host is the site's own and is shown once above. */
export function pathOf(url: string, homeLabel: string): string {
  try {
    const { pathname, search } = new URL(url);
    return pathname === "/" ? `/ (${homeLabel})` : `${pathname}${search}`;
  } catch {
    return url;
  }
}

/**
 * The quote request: a pre-filled email, exactly as before - nothing is sent
 * or recorded by us, and the customer's own mail app sends it (or does not).
 * The body now carries the list the copy has always promised.
 */
export function quoteMailto({
  email,
  domain,
  checkedAt,
  findings,
  totals,
  locale,
  t,
}: {
  email: string;
  domain: string;
  checkedAt: string;
  findings: { label: string; count: number }[];
  totals: SeverityTotals;
  locale: Locale;
  t: HealthText;
}): string {
  const total = totals.critical + totals.warning + totals.info;
  const body = [
    t.mailGreeting,
    "",
    format(t.mailAsk, { domain }),
    format(t.mailCheckedOn, { date: checkedAt }),
    "",
    countText(t.mailCounts, total, locale, { critical: formatNumber(totals.critical, locale) }),
    "",
    t.mailListTitle,
    ...findings.map((finding) =>
      format(t.mailLine, { label: finding.label, pages: countText(t.pagesCount, finding.count, locale) }),
    ),
    "",
    t.mailThanks,
  ].join("\n");
  const subject = format(t.mailSubject, { domain });
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
