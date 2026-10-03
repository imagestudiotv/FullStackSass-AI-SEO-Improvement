import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { AuditContext, AuditSummary } from "@/lib/audit/rules";
import type { Locale } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";

/**
 * The Website health page's first render in each state a customer can find
 * it in: never checked, waiting, running over an older report, failed,
 * finished, unreadable, legacy, and as a viewer. Rendered to static markup,
 * so what happens after a press is covered by the model and data tests.
 */

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode; [key: string]: unknown }) =>
    createElement("a", { href, ...rest }, children),
}));
vi.mock("@/lib/audit/actions", () => ({ startAudit: vi.fn() }));

import { AuditPanel, type AuditPanelProps } from "./audit-panel";
import type { HealthAudit, HealthIssueRow, HealthRun } from "./health-model";

const NOW = new Date("2026-10-03T12:00:00Z");

const context: AuditContext = {
  siteName: "Acme Studio",
  language: "en",
  platform: "WordPress",
  crawlers: [
    { agent: "GPTBot", owner: "ChatGPT", allowed: true, explicit: false },
    { agent: "ClaudeBot", owner: "Claude", allowed: false, explicit: true },
  ],
  linkedHosts: ["instagram.com"],
  previewImage: "https://acme.com/og.png",
};

const summary = (over: Partial<AuditSummary> = {}): AuditSummary => ({
  score: 62,
  pagesCrawled: 12,
  counts: { critical: 1, warning: 12, info: 0 },
  topIssues: [],
  context,
  notAssessed: [],
  ...over,
});

let n = 0;
const row = (type: string, severity: string, url: string | null, detail: string | null = null): HealthIssueRow => ({
  id: `r${(n += 1)}`,
  type,
  severity,
  url,
  detail,
});

function audit(over: Partial<HealthAudit> = {}): HealthAudit {
  const rows = over.rows ?? [
    row("unreachable_page", "critical", "https://acme.com/old", "Could not be fetched (http_error: The site returned 404)."),
    ...Array.from({ length: 12 }, (_, i) => row("thin_content", "warning", `https://acme.com/p${i}`, `Only ${100 + i} words. Pages this short rarely rank for competitive terms.`)),
  ];
  return {
    id: "a1",
    score: 62,
    summary: summary(),
    createdAt: new Date("2026-10-01T09:30:00Z"),
    rows,
    typeCounts: [
      { type: "unreachable_page", severity: "critical", count: 1 },
      { type: "thin_content", severity: "warning", count: 12 },
    ],
    totalRows: 13,
    ...over,
  };
}

function render(props: Partial<AuditPanelProps> = {}, locale: Locale = "en") {
  const t = getMessages(locale).app;
  return renderToStaticMarkup(
    createElement(AuditPanel, {
      websiteId: "w1",
      domain: "acme.com",
      audit: audit(),
      run: { phase: "idle" } as HealthRun,
      discovered: 140,
      canEdit: true,
      blockedReason: null,
      supportEmail: "help@repget.com",
      initialSeverity: "all",
      initialQuery: "",
      locale,
      t: t.health,
      tw: t.workspace,
      ...props,
    }),
  );
}

const en = getMessages("en").app.health;
const tw = getMessages("en").app.workspace;
/** Static markup escapes quotes and apostrophes; compare against the escaped form. */
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;").replace(/</g, "&lt;");
/** The visible text only, without markup. */
const textOf = (html: string) => html.replace(/<[^>]+>/g, " ");

describe("never checked", () => {
  it("an editor gets one h1, the explanation and the button that starts a check", () => {
    const html = render({ audit: null, discovered: null });
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain(en.emptyTitle);
    expect(html).toContain(en.checkNow);
    expect(html).not.toContain(esc(tw.viewOnly));
  });

  it("a viewer is told it is read-only and is offered no button the server would refuse", () => {
    const html = render({ audit: null, discovered: null, canEdit: false });
    expect(html).toContain(esc(tw.viewOnly));
    expect(html).toContain(en.emptyViewer);
    expect(html).not.toContain(en.checkNow);
  });

  it("a site still being analysed: the reason in words, the button disabled", () => {
    const html = render({ audit: null, discovered: null, blockedReason: en.siteNotReady });
    expect(html).toContain(en.unavailableTitle);
    expect(html).toContain(en.siteNotReady);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-describedby="health-blocked-reason"/);
  });
});

describe("a check in progress", () => {
  it("waiting to start, with no report yet: says so, and offers no second press", () => {
    const html = render({ audit: null, discovered: null, run: { phase: "queued", requestedAt: new Date(NOW.getTime() - 60_000), stale: false } });
    expect(html).toContain(en.queuedTitle);
    expect(html).toContain(en.firstRunTitle);
    expect(html).not.toContain(en.checkNow);
  });

  it("running over an older report: real counts, no percentage, the old report kept and labelled", () => {
    const html = render({
      discovered: null,
      run: { phase: "running", startedAt: new Date("2026-10-03T11:58:00Z"), pagesCrawled: 7, pagesFound: 140, stale: false },
    });
    expect(html).toContain("7 pages checked so far");
    expect(html).toContain("140 addresses found on your site");
    expect(textOf(html)).not.toMatch(/\d+\s*%/);
    expect(html).not.toContain('role="progressbar"');
    expect(html).toContain(en.previousResult);
    expect(html).toContain("The report below is your previous result, from 1 Oct 2026, 09:30 UTC.");
    expect(html).toContain(en.issues.thin_content.label);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>.*?Checking…<\/button>/);
  });

  it("a run that stopped moving can be refreshed or started again", () => {
    const html = render({
      run: { phase: "running", startedAt: new Date("2026-10-03T09:00:00Z"), pagesCrawled: 3, pagesFound: 9, stale: true },
    });
    expect(html).toContain(en.runningStale);
    expect(html).toContain(en.staleRetry);
    expect(html).toContain(en.refreshStatus);
    expect(html).toContain(en.checkAgain);
  });

  it("a first run that stopped moving is not 'on its way': the editor can start one again", () => {
    const html = render({
      audit: null,
      discovered: null,
      run: { phase: "running", startedAt: new Date("2026-10-03T05:00:00Z"), pagesCrawled: 2, pagesFound: 4, stale: true },
    });
    expect(html).not.toContain(en.firstRunTitle);
    expect(html).toContain(en.emptyTitle);
    expect(html).toMatch(/<button(?![^>]*disabled="")[^>]*>.*?Check my website<\/button>/);
  });

  it("a viewer of a stalled run can refresh the view but is not told to start a check", () => {
    for (const run of [
      { phase: "running", startedAt: new Date("2026-10-03T09:00:00Z"), pagesCrawled: 3, pagesFound: 9, stale: true },
      { phase: "queued", requestedAt: new Date("2026-10-03T09:00:00Z"), stale: true },
    ] as HealthRun[]) {
      const html = render({ run, canEdit: false });
      expect(html).toContain(en.refreshStatus);
      expect(html).not.toContain(en.staleRetry);
      expect(html).not.toContain(en.checkAgain);
    }
  });

  it("the old report's findings are labelled as the previous result too", () => {
    const html = render({
      run: { phase: "running", startedAt: new Date("2026-10-03T11:58:00Z"), pagesCrawled: 7, pagesFound: 140, stale: false },
    });
    // Once on the score, once on the findings.
    expect(html.split(`>${en.previousResult}<`).length - 1).toBe(2);
    expect(render().split(`>${en.previousResult}<`).length - 1).toBe(0);
  });

  it("live counts use the reader's number format", () => {
    const html = render(
      { run: { phase: "running", startedAt: new Date("2026-10-03T11:58:00Z"), pagesCrawled: 7, pagesFound: 1400, stale: false } },
      "de",
    );
    expect(html).toContain("1.400 Adressen auf Ihrer Website gefunden");
  });
});

describe("a failed check", () => {
  it("is visible even when an older report exists, which stays labelled as the previous result", () => {
    const html = render({ run: { phase: "failed", startedAt: new Date("2026-10-03T10:00:00Z"), failure: "refused" } });
    expect(html).toContain(en.failedTitle);
    expect(html).toContain(en.failure.refused);
    expect(html).toContain("The report below is still your previous result, from 1 Oct 2026, 09:30 UTC.");
    expect(html).toContain(en.previousResult);
  });
});

describe("the report", () => {
  it("score with its band in words, scope, and not presented as Domain Authority", () => {
    const html = render();
    expect(html).toContain('aria-label="Health score 62 out of 100"');
    expect(html).toContain(en.bandFair);
    expect(html).toContain(en.notAuthority);
    expect(html).toContain("1 Oct 2026, 09:30 UTC");
    // 140 found, 12 read + 1 failed: the limit is disclosed with the real numbers.
    expect(html).toContain("This check found 140 addresses on your site and read 12 pages.");
  });

  it("severity is a word and an icon on every finding, most serious first", () => {
    const html = render();
    const critical = html.indexOf(en.issues.unreachable_page.label);
    const warning = html.indexOf(en.issues.thin_content.label);
    expect(critical).toBeGreaterThan(-1);
    expect(warning).toBeGreaterThan(critical);
    expect(html).toContain(">Critical<");
    expect(html).toContain(">Warnings<");
    // A single finding's badge is singular; the totals and filters stay plural.
    expect(html).toContain(`>${en.badge.warning}<`);
  });

  it("a large finding's page count is written with separators", () => {
    const rows = Array.from({ length: 3 }, (_, i) => row("missing_lang", "info", `https://acme.com/l${i}`));
    const html = render({
      audit: audit({ rows, typeCounts: [{ type: "missing_lang", severity: "info", count: 2600 }], totalRows: 2600 }),
    });
    expect(html).toContain("2,600 pages");
    expect(html).not.toContain("2600 pages");
  });

  it("findings start closed; a search that matches a page opens that finding and lists only that page", () => {
    const closed = render();
    expect(closed).not.toContain("/p3");
    const searched = render({ initialQuery: "/p3" });
    expect(searched).toContain("/p3");
    expect(searched).not.toContain("/p4<");
    expect(searched).toContain("Pages matching your search: 1 of 12.");
    expect(searched).toContain("Showing 1 of 2 findings.");
    expect(searched).toContain('value="/p3"');
  });

  it("a severity filter from the URL is applied and marked", () => {
    const html = render({ initialSeverity: "critical" });
    expect(html).toContain(en.issues.unreachable_page.label);
    expect(html).not.toContain(en.issues.thin_content.label);
    expect(html).toMatch(/aria-pressed="true"[^>]*>Critical/);
  });

  it("the fix request opens a pre-filled email, and says nothing is sent or charged", () => {
    const html = render();
    expect(html).toContain('href="mailto:help@repget.com?subject=Fix%20request%20for%20acme.com');
    expect(html).toContain(encodeURIComponent("- Not much text: 12 pages"));
    expect(html).toContain(en.fixHow);
  });

  it("without a real support address there is no button to a placeholder mailbox", () => {
    const html = render({ supportEmail: null });
    expect(html).not.toContain("mailto:");
    expect(html).toContain(en.fixUnavailable);
  });

  it("a viewer reads the whole report but gets no Check again", () => {
    const html = render({ canEdit: false });
    expect(html).toContain(esc(tw.viewOnly));
    expect(html).toContain(en.issues.thin_content.label);
    expect(html).not.toContain(en.checkAgain);
  });

  it("robots.txt access is reported with its limits, never as a promise of citations", () => {
    const html = render();
    expect(html).toContain("1 of 2 crawlers is blocked from your whole site.");
    expect(html).toContain(en.aiNamed);
    expect(html).toContain(en.aiNoGuarantee);
    expect(html).toContain('href="/websites/w1/ai-visibility"');
  });

  it("no problems: says so for the pages read, and offers no quote", () => {
    const html = render({ audit: audit({ rows: [], typeCounts: [], totalRows: 0, score: 100 }) });
    expect(html).toContain(en.noFindingsTitle);
    expect(html).toContain("We found nothing to fix on the 12 pages we read.");
    expect(html).not.toContain(en.fixTitle);
  });

  it("a capped list says so with the real total", () => {
    const html = render({ audit: audit({ totalRows: 2600 }) });
    expect(html).toContain("This check recorded 2,600 problems. The first 13 are listed below");
  });
});

describe("partial and older data", () => {
  it("no page read: no score shown as if it described the site", () => {
    const html = render({
      audit: audit({
        score: 75,
        summary: summary({ pagesCrawled: 0, context: { ...context, siteName: null, language: null, platform: null } }),
        rows: [row("unreachable_page", "critical", "https://acme.com/", "Could not be fetched (timeout: Timed out after 15000ms).")],
        typeCounts: [{ type: "unreachable_page", severity: "critical", count: 1 }],
        totalRows: 1,
      }),
      discovered: 1,
    });
    expect(html).toContain(en.notScored);
    expect(html).toContain(en.zeroPagesTitle);
    expect(html).not.toContain("Health score 75");
    expect(html).toContain(en.siteUnavailable);
    // robots.txt was most likely unreadable too: its "not blocked" is not left to read as healthy.
    expect(html).toContain(esc(en.aiUnreadable));
    expect(render()).not.toContain(esc(en.aiUnreadable));
  });

  it("an audit from before site details were collected shows no invented values", () => {
    const legacy = { score: 70, pagesCrawled: 5, counts: { critical: 0, warning: 13, info: 0 }, topIssues: [] } as unknown as AuditSummary;
    const html = render({ audit: audit({ summary: legacy }) });
    expect(html).toContain(en.siteLegacy);
    expect(html).toContain(en.aiLegacy);
    expect(html).not.toContain(en.platformUnknown);
    expect(html).not.toContain(en.languageMissing);
  });

  it("a one-page crawl names the checks that could not run", () => {
    const html = render({ audit: audit({ summary: summary({ pagesCrawled: 1, notAssessed: ["Duplicate page titles", "Duplicate descriptions", "Internal linking"] }) }) });
    expect(html).toContain(en.notAssessedTitle);
    expect(html).toContain("duplicate page titles, duplicate descriptions, internal linking");
  });

  it("no summary at all: counts come from the stored rows, never a false all-clear", () => {
    const html = render({ audit: audit({ summary: null, score: null }) });
    expect(html).toContain(en.noScoreBody);
    expect(html).toContain(en.pagesRead);
    expect(html).toContain(en.notRecorded);
    expect(html).not.toContain(en.noFindingsTitle);
  });
});

describe("other languages", () => {
  it("German: labels, details and dates in German, no English left in the findings", () => {
    const de = getMessages("de").app.health;
    const html = render({ initialQuery: "/p0" }, "de");
    expect(html).toContain(de.title);
    expect(html).toContain(de.issues.thin_content.label);
    expect(html).toContain("Nur 100 Wörter auf dieser Seite.");
    expect(html).not.toContain("Only 100 words");
    expect(html).toContain("1. Okt. 2026");
  });
});
