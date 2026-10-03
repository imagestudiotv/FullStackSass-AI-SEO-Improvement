import { describe, expect, it } from "vitest";

import { explainCrawlError } from "@/lib/audit/explain";
import { ISSUE_LABELS } from "@/lib/audit/rules";
import { LOCALES } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";

import {
  QUEUED_STALE_MS,
  RUNNING_STALE_MS,
  countText,
  deriveRun,
  discoveredFor,
  failedPages,
  failureKind,
  filterSearch,
  findingTotals,
  fold,
  groupFindings,
  isFollowing,
  issueText,
  localiseStartError,
  matchFinding,
  notAssessed,
  pagesAffected,
  parseQuery,
  parseSeverityFilter,
  pathOf,
  quoteMailto,
  rowDetail,
  scoreBand,
  severityTotals,
  type HealthAudit,
  type HealthCrawl,
  type HealthIssueRow,
} from "./health-model";

/**
 * Website health, by behaviour: which run the page says it is showing, how
 * stored rows become findings (with exact counts even when the list is
 * capped), what the URL filter accepts, and how the audit's stored English
 * is put into the reader's language without inventing anything.
 */

const en = getMessages("en").app.health;
const de = getMessages("de").app.health;
const tw = getMessages("en").app.workspace;

const NOW = new Date("2026-10-03T12:00:00Z");
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000);

const crawl = (over: Partial<HealthCrawl>): HealthCrawl => ({
  status: "completed",
  pagesCrawled: 0,
  pagesFound: 0,
  error: null,
  startedAt: minutesAgo(10),
  finishedAt: minutesAgo(8),
  ...over,
});

let rowId = 0;
const row = (type: string, severity: string, url: string | null, detail: string | null = null): HealthIssueRow => ({
  id: `r${(rowId += 1)}`,
  type,
  severity,
  url,
  detail,
});

describe("which run the page is showing", () => {
  it("never checked: idle, nothing to follow", () => {
    const run = deriveRun({ crawl: null, requestedAt: null, auditCreatedAt: null, now: NOW });
    expect(run).toEqual({ phase: "idle" });
    expect(isFollowing(run)).toBe(false);
  });

  it("a request newer than the crawl row is waiting to start, and is followed", () => {
    const run = deriveRun({ crawl: crawl({}), requestedAt: minutesAgo(1), auditCreatedAt: minutesAgo(8), now: NOW });
    expect(run).toMatchObject({ phase: "queued", stale: false });
    expect(isFollowing(run)).toBe(true);
  });

  it("a request with no crawl row at all is waiting too (startAudit writes no crawl row)", () => {
    expect(deriveRun({ crawl: null, requestedAt: minutesAgo(2), auditCreatedAt: null, now: NOW }).phase).toBe("queued");
  });

  it("once the job has created its crawl row, the open reservation no longer means 'waiting'", () => {
    const run = deriveRun({
      crawl: crawl({ status: "running", startedAt: minutesAgo(1), finishedAt: null, pagesCrawled: 7, pagesFound: 140 }),
      requestedAt: minutesAgo(2),
      auditCreatedAt: null,
      now: NOW,
    });
    expect(run).toEqual({ phase: "running", startedAt: minutesAgo(1), pagesCrawled: 7, pagesFound: 140, stale: false });
  });

  it("a request or a crawl that stopped moving is called out and no longer polled", () => {
    const queued = deriveRun({ crawl: null, requestedAt: new Date(NOW.getTime() - QUEUED_STALE_MS - 1), auditCreatedAt: null, now: NOW });
    expect(queued).toMatchObject({ phase: "queued", stale: true });
    expect(isFollowing(queued)).toBe(false);
    const running = deriveRun({
      crawl: crawl({ status: "running", startedAt: new Date(NOW.getTime() - RUNNING_STALE_MS - 1), finishedAt: null }),
      requestedAt: null,
      auditCreatedAt: null,
      now: NOW,
    });
    expect(running).toMatchObject({ phase: "running", stale: true });
    expect(isFollowing(running)).toBe(false);
  });

  it("a failed run is shown as failed - also when an older report exists", () => {
    const failed = crawl({ status: "failed", startedAt: minutesAgo(30), error: "Timed out after 15000ms" });
    expect(deriveRun({ crawl: failed, requestedAt: null, auditCreatedAt: null, now: NOW })).toEqual({
      phase: "failed",
      startedAt: minutesAgo(30),
      failure: "timeout",
    });
    expect(deriveRun({ crawl: failed, requestedAt: null, auditCreatedAt: minutesAgo(600), now: NOW }).phase).toBe("failed");
  });

  it("a run that saved its audit and then failed (e.g. notifying) is not a failed check", () => {
    const failed = crawl({ status: "failed", startedAt: minutesAgo(30) });
    expect(deriveRun({ crawl: failed, requestedAt: null, auditCreatedAt: minutesAgo(20), now: NOW })).toEqual({ phase: "idle" });
  });

  it("a completed crawl is the report on screen", () => {
    expect(deriveRun({ crawl: crawl({}), requestedAt: null, auditCreatedAt: minutesAgo(8), now: NOW })).toEqual({ phase: "idle" });
  });
});

describe("why a whole check failed", () => {
  it("follows lib/audit/explain.ts for every stored error it recognises", () => {
    expect(failureKind("Timed out after 15000ms")).toBe("timeout");
    expect(failureKind("That address is not a web page")).toBe("notHtml");
    expect(failureKind("too large")).toBe("tooLarge");
    expect(failureKind("Invalid start URL")).toBe("invalidUrl");
    expect(failureKind("The site returned 503")).toBe("refused");
    expect(failureKind("getaddrinfo ENOTFOUND x")).toBe("unreachable");
    expect(failureKind("Website 123 not found")).toBe("generic");
    expect(failureKind(null)).toBe("generic");
  });

  it("names the job's own refusal to spend for a lapsed subscription", () => {
    expect(failureKind("This website's subscription is not active, so nothing further was spent.")).toBe("notEntitled");
  });

  it("every summary explain.ts can return maps to a translated kind (catches a reworded explain.ts)", () => {
    const samples = ["timeout", "not_html", "too large", "invalid url", "http_error", "ENOTFOUND"];
    for (const sample of samples) {
      expect(explainCrawlError(sample).summary).not.toBe(explainCrawlError("zzz").summary);
      expect(failureKind(sample)).not.toBe("generic");
    }
  });
});

describe("coverage numbers belong to the audit on screen", () => {
  const audit = { createdAt: minutesAgo(8) } as HealthAudit;
  it("uses the crawl's discovered count only when that crawl saved this audit", () => {
    expect(discoveredFor(audit, crawl({ pagesFound: 140, startedAt: minutesAgo(10), finishedAt: minutesAgo(8) }))).toBe(140);
    // A newer crawl (running, failed, or completed after a later audit) says nothing about this one.
    expect(discoveredFor(audit, crawl({ status: "running", pagesFound: 12 }))).toBeNull();
    expect(discoveredFor(audit, crawl({ pagesFound: 9, startedAt: minutesAgo(5), finishedAt: minutesAgo(4) }))).toBeNull();
    expect(discoveredFor(null, crawl({}))).toBeNull();
  });
});

describe("findings", () => {
  it("groups by type with the exact SQL count, most serious first, then most widespread", () => {
    const rows = [
      row("missing_lang", "info", "https://a.example/1"),
      row("thin_content", "warning", "https://a.example/1"),
      row("thin_content", "warning", "https://a.example/2"),
      row("unreachable_page", "critical", "https://a.example/x"),
    ];
    const counts = [
      { type: "missing_lang", severity: "info", count: 9 },
      { type: "thin_content", severity: "warning", count: 2 },
      { type: "unreachable_page", severity: "critical", count: 1 },
    ];
    const findings = groupFindings(rows, counts);
    expect(findings.map((f) => [f.type, f.count, f.rows.length])).toEqual([
      ["unreachable_page", 1, 1],
      ["thin_content", 2, 2],
      // Only one row was loaded, but the finding still says 9.
      ["missing_lang", 9, 1],
    ]);
    expect(severityTotals(counts)).toEqual({ critical: 1, warning: 2, info: 9 });
    expect(findingTotals(findings)).toEqual({ critical: 1, warning: 1, info: 1 });
    expect(failedPages(counts)).toBe(1);
  });

  it("files an unknown severity with the least serious and keeps an unknown type", () => {
    const findings = groupFindings([row("legacy_rule", "odd", null)], [{ type: "legacy_rule", severity: "odd", count: 1 }]);
    expect(findings[0]).toMatchObject({ type: "legacy_rule", severity: "info", count: 1 });
    expect(issueText("legacy_rule", en)).toEqual({ label: "Legacy rule", about: "", fix: null });
  });

  it("counts the PAGES of site-wide findings from their stored groups", () => {
    const [dup] = groupFindings(
      [
        row("duplicate_title", "warning", "https://a.example/a", '3 pages share the title "home". They will compete with each other.'),
        row("duplicate_title", "warning", "https://a.example/b", '2 pages share the title "about". They will compete with each other.'),
      ],
      [{ type: "duplicate_title", severity: "warning", count: 2 }],
    );
    expect(pagesAffected(dup)).toBe(5);
    const [orphans] = groupFindings(
      [row("no_internal_links", "info", "https://a.example/z", "4 page(s) link to nothing else on the site.")],
      [{ type: "no_internal_links", severity: "info", count: 1 }],
    );
    expect(pagesAffected(orphans)).toBe(4);
    // Unreadable detail: the row count, not a guess.
    const [odd] = groupFindings([row("duplicate_title", "warning", null, "garbled")], [{ type: "duplicate_title", severity: "warning", count: 1 }]);
    expect(pagesAffected(odd)).toBe(1);
  });
});

describe("filters in the URL", () => {
  it("accepts only the known severities and a bounded search", () => {
    expect(parseSeverityFilter("critical")).toBe("critical");
    expect(parseSeverityFilter(["warning", "info"])).toBe("warning");
    expect(parseSeverityFilter("everything")).toBe("all");
    expect(parseSeverityFilter(undefined)).toBe("all");
    expect(parseQuery("  /pricing  ")).toBe("/pricing");
    expect(parseQuery("x".repeat(500))).toHaveLength(100);
    expect(parseQuery(42)).toBe("");
  });

  it("writes only what is set and keeps other parameters", () => {
    expect(filterSearch("", "all", "")).toBe("");
    expect(filterSearch("", "critical", "pricing")).toBe("?severity=critical&q=pricing");
    expect(filterSearch("?severity=info&utm=x", "all", "")).toBe("?utm=x");
  });

  it("search finds a finding by its words, or by one of its pages - and then lists only those pages", () => {
    const [finding] = groupFindings(
      [row("thin_content", "warning", "https://a.example/pricing", "Only 120 words."), row("thin_content", "warning", "https://a.example/team", "Only 80 words.")],
      [{ type: "thin_content", severity: "warning", count: 2 }],
    );
    const text = issueText("thin_content", en);
    const describe = (r: HealthIssueRow) => rowDetail(r.type, r.detail, en, "en") ?? "";
    expect(matchFinding(finding, text, "", describe)).toEqual({ matches: true, rows: null });
    expect(matchFinding(finding, text, "MUCH TEXT", describe)).toEqual({ matches: true, rows: null });
    const byPage = matchFinding(finding, text, "pricing", describe);
    expect(byPage.matches).toBe(true);
    expect(byPage.rows?.map((r) => r.url)).toEqual(["https://a.example/pricing"]);
    expect(matchFinding(finding, text, "checkout", describe).matches).toBe(false);
    expect(fold("Système")).toBe("systeme");
  });
});

describe("stored English, read back in the reader's language", () => {
  it("rebuilds each page's own detail from the stored sentence", () => {
    expect(rowDetail("title_too_long", "Title is 72 characters and will be cut off after about 60.", en, "en")).toBe(
      "The title is 72 characters; search results cut it off after about 60.",
    );
    expect(rowDetail("thin_content", "Only 1200 words. Pages this short rarely rank for competitive terms.", de, "de")).toBe(
      "Nur 1.200 Wörter auf dieser Seite.",
    );
    expect(rowDetail("images_missing_alt", "3 of 10 images have no alt text, which hurts accessibility and image search.", de, "de")).toBe(
      "3 von 10 Bildern haben keine Beschreibung (Alt-Text).",
    );
    expect(rowDetail("duplicate_title", '2 pages share the title "home | acme". They will compete with each other.', de, "de")).toBe(
      "2 Seiten teilen sich den Titel „home | acme“.",
    );
    expect(rowDetail("no_internal_links", "1 page(s) link to nothing else on the site.", en, "en")).toBe(
      "1 page links to no other page on your site.",
    );
  });

  it("explains why a page could not be opened, without the technical wording", () => {
    const fetched = (reason: string) => `Could not be fetched (${reason}).`;
    expect(rowDetail("unreachable_page", fetched("timeout: Timed out after 15000ms"), en, "en")).toBe(en.detail.unreachTimeout);
    expect(
      rowDetail("unreachable_page", fetched("http_error: This site blocks automated visitors, so we cannot read it. Your site is fine - the block is a security setting on it."), en, "en"),
    ).toBe(en.detail.unreachBlocked);
    expect(rowDetail("unreachable_page", fetched("http_error: The site returned 404"), de, "de")).toBe("Sie hat mit Fehler 404 geantwortet.");
    expect(rowDetail("unreachable_page", fetched("unreachable: Too many redirects"), en, "en")).toBe(en.detail.unreachRedirects);
    expect(rowDetail("unreachable_page", fetched("unreachable: getaddrinfo ENOTFOUND"), en, "en")).toBe(en.detail.unreachConnect);
    expect(rowDetail("unreachable_page", "Could not be fetched (unknown error).", en, "en")).toBe(en.detail.unreachUnknown);
  });

  it("a sentence it does not recognise is shown as stored; a sentence that is the same on every page is not repeated", () => {
    expect(rowDetail("title_too_long", "Something the job used to say.", en, "en")).toBe("Something the job used to say.");
    expect(rowDetail("legacy_rule", "Raw detail", en, "en")).toBe("Raw detail");
    expect(rowDetail("missing_title", "No title tag. This is the headline shown in search results.", en, "en")).toBeNull();
    expect(rowDetail("thin_content", null, en, "en")).toBeNull();
  });

  it("every issue type the audit can store has words in every language", () => {
    for (const locale of LOCALES) {
      const t = getMessages(locale).app.health;
      for (const type of Object.keys(ISSUE_LABELS)) {
        const text = issueText(type, t);
        expect(text.label, `${locale}:${type}`).not.toBe("");
        expect(text.about, `${locale}:${type}`).not.toBe("");
        expect(text.fix, `${locale}:${type}`).toBeTruthy();
      }
    }
  });

  it("the old misleading wording is gone: a missing canonical is not 'duplicate addresses'", () => {
    expect(issueText("missing_canonical", en).label).not.toMatch(/duplicate/i);
    expect(issueText("no_internal_links", en).fix).not.toMatch(/links to this page/i);
  });
});

describe("counts in sentences", () => {
  it("picks the singular or plural form and writes the number with the locale's separators", () => {
    expect(countText(en.pagesCount, 1, "en")).toBe("1 page");
    expect(countText(en.pagesCount, 2600, "en")).toBe("2,600 pages");
    expect(countText(de.pagesCount, 2600, "de")).toBe("2.600 Seiten");
    expect(countText(en.aiSomeBlocked, 2, "en", { total: 5 })).toBe("2 of 5 crawlers are blocked from your whole site.");
  });
});

describe("score and skipped checks", () => {
  it("bands use the report's own thresholds", () => {
    expect([scoreBand(100), scoreBand(80), scoreBand(79), scoreBand(50), scoreBand(49), scoreBand(0)]).toEqual([
      "good",
      "good",
      "fair",
      "fair",
      "poor",
      "poor",
    ]);
  });

  it("names the checks a narrow crawl skipped - stored ones, or the same rule for older audits", () => {
    const base = { score: 96, counts: { critical: 0, warning: 0, info: 0 }, topIssues: [] };
    expect(notAssessed({ ...base, pagesCrawled: 1, notAssessed: ["Duplicate page titles", "Internal linking"] }, en)).toEqual([
      "duplicate page titles",
      "internal linking",
    ]);
    const legacy = { ...base, pagesCrawled: 1 } as unknown as Parameters<typeof notAssessed>[0];
    expect(notAssessed(legacy, de)).toEqual(["doppelte Seitentitel", "doppelte Beschreibungen", "interne Verlinkung"]);
    expect(notAssessed({ ...base, pagesCrawled: 12, notAssessed: [] }, en)).toEqual([]);
    // Nothing read at all is reported as unreadable instead.
    expect(notAssessed({ ...base, pagesCrawled: 0, notAssessed: ["Internal linking"] }, en)).toEqual([]);
    expect(notAssessed(null, en)).toEqual([]);
  });
});

describe("refusals and the quote email", () => {
  it("translates startAudit's and the entitlement check's refusals", () => {
    expect(localiseStartError("You have view-only access to this website.", en, tw)).toBe(tw.viewOnly);
    expect(localiseStartError("Wait until the site has been analysed first", de, tw)).toBe(de.siteNotReady);
    expect(localiseStartError("Choose a plan for this website first", de, tw)).toBe(de.errNoPlan);
    expect(localiseStartError("This website's subscription is not active. Update billing to continue.", de, tw)).toBe(de.errPlanInactive);
    expect(localiseStartError("You have run this many times in the last hour. Please try again shortly.", de, tw)).toBe(de.errQuota);
    expect(localiseStartError("Something new", de, tw)).toBe("Something new");
  });

  it("the email carries the list it promises, and nothing is sent by us", () => {
    const href = quoteMailto({
      email: "help@repget.com",
      domain: "acme.com",
      checkedAt: "3 Oct 2026, 12:00 UTC",
      findings: [
        { label: "Page could not be opened", count: 2 },
        { label: "Not much text", count: 1 },
      ],
      totals: { critical: 2, warning: 1, info: 0 },
      locale: "en",
      t: en,
    });
    expect(href.startsWith("mailto:help@repget.com?subject=Fix%20request%20for%20acme.com&body=")).toBe(true);
    const body = decodeURIComponent(href.split("&body=")[1]);
    expect(body).toContain("Please quote for fixing the problems found on acme.com.");
    expect(body).toContain("3 problems found, 2 critical.");
    expect(body).toContain("- Page could not be opened: 2 pages");
    expect(body).toContain("- Not much text: 1 page");
  });

  it("the email writes large counts the reader's way", () => {
    const href = quoteMailto({
      email: "help@repget.com",
      domain: "acme.com",
      checkedAt: "3. Okt. 2026, 12:00 UTC",
      findings: [{ label: "Wenig Text", count: 1200 }],
      totals: { critical: 1000, warning: 200, info: 0 },
      locale: "de",
      t: de,
    });
    const body = decodeURIComponent(href.split("&body=")[1]);
    expect(body).toContain("1.200");
    expect(body).toContain("1.000");
    expect(body).not.toMatch(/\b1200\b/);
  });

  it("paths drop the site's own host and name the home page", () => {
    expect(pathOf("https://acme.com/", "home page")).toBe("/ (home page)");
    expect(pathOf("https://acme.com/pricing?x=1", "home page")).toBe("/pricing?x=1");
    expect(pathOf("not a url", "home page")).toBe("not a url");
  });
});
