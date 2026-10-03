import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { AnalyticsConnection } from "@/lib/analytics/actions";
import { LOCALES, type Locale } from "@/lib/i18n/config";
import { format } from "@/lib/i18n/format";
import { getMessages } from "@/lib/i18n/messages";

/**
 * The Google page's first render in each state, by what a person can see
 * and do: connected or not, owner/editor or viewer, each source chosen,
 * imported, silent or absent. Clicks, the OAuth redirect and the dialog are
 * left to the browser check; the server actions are stubs that must not run.
 */

const nav = vi.hoisted(() => ({ search: "" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(nav.search),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode; [key: string]: unknown }) =>
    // `scroll` is Link's own option, not an attribute of the anchor.
    createElement("a", { href, ...Object.fromEntries(Object.entries(rest).filter(([key]) => key !== "scroll")) }, children),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const actions = vi.hoisted(() => ({
  disconnectGoogle: vi.fn(),
  listProperties: vi.fn(),
  selectProperties: vi.fn(),
  startGoogleConnect: vi.fn(),
  startImport: vi.fn(),
}));
vi.mock("@/lib/analytics/actions", () => actions);

import { AnalyticsPanel, translateServerError } from "../analytics-panel";
import { GoogleRangeNav } from "./range-nav";
import type { GoogleReport } from "./report";
import { GoogleReportSections, TopTable } from "./report-sections";
import { googleNumbers } from "./report-state";

const en = getMessages("en").app;
const t = en.analytics;

const connection = (over: Partial<AnalyticsConnection> = {}): AnalyticsConnection => ({
  connected: true,
  status: "connected",
  searchConsoleSite: "sc-domain:example.com",
  analyticsProperty: "properties/123456789",
  lastImportedAt: null,
  ...over,
});

function panel(props: { connection: AnalyticsConnection; canEdit: boolean; report?: ReactNode }) {
  return renderToStaticMarkup(
    createElement(AnalyticsPanel, {
      websiteId: "w1",
      freshness: { search: "30 Sept 2026", analytics: null },
      hasData: true,
      t,
      tWorkspace: en.workspace,
      ...props,
    }),
  );
}

const DAYS = Array.from({ length: 7 }, (_, i) => `2026-09-${String(24 + i).padStart(2, "0")}`);

function report(over: { search?: Partial<GoogleReport["search"]>; analytics?: Partial<GoogleReport["analytics"]> } = {}): GoogleReport {
  return {
    days: 7,
    window: { start: DAYS[0], end: DAYS[6], previousStart: "2026-09-17", previousEnd: "2026-09-23" },
    hasData: true,
    search: {
      through: DAYS[6],
      daysReported: 7,
      current: { clicks: 1234, impressions: 56789, ctr: 1234 / 56789, position: 7.25 },
      previous: { clicks: 1000, impressions: 60000, ctr: 1000 / 60000, position: 8.5 },
      series: DAYS.map((day, i) => ({ day, clicks: 100 + i, impressions: 5000 + i })),
      topQueries: [{ query: "wedding photographer amsterdam", clicks: 40, impressions: 900 }],
      topPages: [{ pageUrl: "https://example.com/blog/post", clicks: 70, impressions: 1500, ctr: 70 / 1500, position: 4.1 }],
      ...over.search,
    },
    analytics: {
      through: DAYS[6],
      daysReported: 7,
      sessions: 4321,
      previousSessions: null,
      series: DAYS.map((day) => ({ day, sessions: 600 })),
      ...over.analytics,
    },
  };
}

function sections(r: GoogleReport, props: { connection?: AnalyticsConnection; canEdit?: boolean; locale?: Locale } = {}) {
  const locale = props.locale ?? "en";
  return renderToStaticMarkup(
    createElement(GoogleReportSections, {
      report: r,
      connection: props.connection ?? connection(),
      canEdit: props.canEdit ?? true,
      locale,
      t: getMessages(locale).app.analytics,
    }),
  );
}

describe("not connected", () => {
  it("explains both products and the steps, and offers Connect to an owner or editor", () => {
    const html = panel({ connection: connection({ connected: false, status: "disconnected", searchConsoleSite: null, analyticsProperty: null }), canEdit: true });
    expect(html).toContain(t.connectTitle);
    expect(html).toContain(t.searchConsolePurpose);
    expect(html).toContain(t.analyticsPurpose);
    expect(html).toContain(t.setupStep3);
    expect(html).toContain(`>${t.connectGoogle}</button>`);
    expect(html).not.toContain(t.viewerCannotConnect);
  });

  it("says an expired connection needs reconnecting, and the button says so", () => {
    const html = panel({ connection: connection({ connected: false, status: "expired" }), canEdit: true });
    expect(html).toContain(t.expiredTitle);
    expect(html).toContain(t.expired);
    expect(html).toContain(`>${t.reconnectGoogle}</button>`);
  });

  it("gives a viewer the explanation without a Connect button", () => {
    const html = panel({ connection: connection({ connected: false, status: "disconnected" }), canEdit: false });
    expect(html).toContain(t.viewerCannotConnect);
    expect(html).not.toContain(`>${t.connectGoogle}</button>`);
    expect(html).not.toContain("<button");
  });
});

describe("connected", () => {
  it("shows a viewer the chosen properties and freshness as text, with no controls and no property list", () => {
    const html = panel({ connection: connection(), canEdit: false });
    expect(html).toContain("sc-domain:example.com");
    expect(html).toContain("Property 123456789");
    expect(html).toContain("Figures up to 30 Sept 2026");
    expect(html).toContain(t.noFiguresYet);
    expect(html).not.toContain(t.importNow);
    expect(html).not.toContain(t.manageConnection);
    expect(html).not.toContain(t.disconnect);
    expect(html).not.toContain("<select");
    expect(actions.listProperties).not.toHaveBeenCalled();
  });

  it("gives an editor Import now and a folded Manage connection that keeps the saved choice visible while loading", () => {
    const html = panel({ connection: connection(), canEdit: true });
    expect(html).toContain(t.importNow);
    expect(html).toMatch(/aria-expanded="false"[^>]*>.*Manage connection/);
    expect(html).toMatch(/<div id="[^"]+" hidden=""/);
    expect(html).toContain(t.loadingProperties);
    // The saved property is an option, so the select is never blank while Google answers.
    expect(html).toMatch(/<option value="sc-domain:example.com" selected="">sc-domain:example.com<\/option>/);
    expect(html).toContain(t.noAnalyticsProperty);
    // Nothing changed yet, so nothing to save - and the page says why.
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Save and import<\/button>/);
    expect(html).toContain(t.noSelectionChange);
    expect(html).toContain(t.reconnectGoogle);
    expect(html).toContain(t.disconnect);
  });

  it("opens the choice straight away when no property is chosen, with no Import now", () => {
    const html = panel({ connection: connection({ searchConsoleSite: null, analyticsProperty: null }), canEdit: true });
    expect(html).toContain(t.setupNeededTitle);
    expect(html).not.toMatch(/<div id="[^"]+" hidden=""/);
    expect(html).not.toContain(t.importNow);
    expect(html).toContain(t.notChosen);
  });

  it("tells a viewer when nothing is chosen yet, without offering a choice", () => {
    const html = panel({ connection: connection({ searchConsoleSite: null, analyticsProperty: null }), canEdit: false });
    expect(html).toContain(t.viewerSetupPending);
    expect(html).not.toContain(t.setupNeededTitle);
  });

  it("renders the report it is given below the connection", () => {
    const html = panel({ connection: connection(), canEdit: true, report: createElement("p", null, "REPORT") });
    expect(html.indexOf(t.connectionTitle)).toBeLessThan(html.indexOf("REPORT"));
  });
});

describe("report sections", () => {
  it("keeps Search Console and Analytics apart, with correctly named figures", () => {
    const html = sections(report());
    expect(html).toContain(t.searchTitle);
    expect(html).toContain(t.analyticsTitle);
    for (const label of [t.clicks, t.impressions, t.ctr, t.averagePosition, t.sessions]) expect(html).toContain(label);
    expect(html).toContain("1,234");
    expect(html).toContain("56,789");
    expect(html).toContain("2.2%");
    expect(html).toContain("7.3");
    expect(html).toContain("4,321");
    expect(html).toContain(t.sessionsHint);
  });

  it("shows change only where the previous period is complete, in words as well as colour", () => {
    const html = sections(report());
    expect(html).toContain("Changes compare with the previous 7 days.");
    expect(html).toContain("+234 (+23%)");
    // Visible words, not only the colour: for position a rising number is the bad news.
    expect(html).toContain(`<span>${t.better}</span>`);
    expect(html).toContain(`<span>${t.worse}</span>`); // impressions fell
    expect(html).not.toMatch(/class="sr-only">\((better|worse)\)/);
    expect(html).toContain("No comparison: not every one of the previous 7 days has figures from Google.");
  });

  it("says a source is not chosen instead of printing zero for it", () => {
    const r = report({ analytics: { through: null, daysReported: 0, sessions: 0, series: DAYS.map((day) => ({ day, sessions: null })) } });
    const html = sections(r, { connection: connection({ analyticsProperty: null }) });
    expect(html).toContain("No Google Analytics property chosen");
    expect(html).toContain('href="#google-connection"');
    expect(html).not.toContain(t.sessionsHint);
    const viewer = sections(r, { connection: connection({ analyticsProperty: null }), canEdit: false });
    expect(viewer).toContain(t.notSelectedViewer);
    expect(viewer).not.toContain('href="#google-connection"');
  });

  it("tells chosen-but-not-imported and silent-in-this-period apart", () => {
    const awaiting = sections(report({ search: { through: null, daysReported: 0 } }));
    expect(awaiting).toContain("No Google Search Console figures yet");
    const silent = sections(report({ search: { through: "2026-08-01", daysReported: 0 } }));
    expect(silent).toContain("No Google Search Console figures in this period");
    expect(silent).toContain("1 Aug 2026");
    // 90 days reaches back to 1 Aug, so a longer period is real advice.
    expect(silent).toContain("Choose a longer period");
    // Beyond every period on offer, the page does not suggest one.
    const old = sections(report({ search: { through: "2026-01-15", daysReported: 0 } }));
    expect(old).toContain("The latest figures are from 15 Jan 2026.");
    expect(old).not.toContain("Choose a longer period");
  });

  it("shows real zeros as zeros, and a rate with no impressions as not available", () => {
    const html = sections(report({ search: { current: { clicks: 0, impressions: 0, ctr: null, position: null }, previous: null } }));
    expect(html).toContain(t.zeroSearch);
    expect(html).toContain(t.notAvailable);
    expect(html).toMatch(/>0<\/dd>/);
  });

  it("says how much of the period a source reported", () => {
    const html = sections(report({ search: { daysReported: 5 } }));
    expect(html).toContain("Reported on 5 of 7 days");
  });

  it("lists top searches with the privacy caveat and links top pages out safely", () => {
    const html = sections(report());
    expect(html).toContain("wedding photographer amsterdam");
    expect(html).toContain(t.topSearchesNote);
    // Only the active tab's table is rendered; the pages tab is a tab trigger.
    expect(html).toContain(t.topPages);
    const rows = sections(report({ search: { topQueries: [] } }));
    expect(rows).toContain(t.noSearches);
  });

  it("shows only clicks and impressions for searches: their rows are split by page, so a CTR or position would not match Search Console", () => {
    const html = sections(report());
    const table = html.slice(html.indexOf(t.topSearchesCaption), html.indexOf("</table>", html.indexOf(t.topSearchesCaption)));
    expect(table).toContain("wedding photographer amsterdam");
    expect(table).toContain(`>${t.clicks}</th>`);
    expect(table).toContain(`>${t.impressions}</th>`);
    expect(table).not.toContain(`>${t.ctrShort}</th>`);
    expect(table).not.toContain(`>${t.positionShort}</th>`);
    expect(table.match(/<td/g)).toHaveLength(3);
  });

  it("keeps CTR and position for pages, with words for a screen reader where a rate cannot be worked out", () => {
    const pages = (rows: GoogleReport["search"]["topPages"]) =>
      renderToStaticMarkup(
        createElement(TopTable<GoogleReport["search"]["topPages"][number]>, {
          caption: t.topPagesCaption,
          firstHeader: t.page,
          rows,
          rowKey: (row) => row.pageUrl,
          first: (row) => row.pageUrl,
          empty: t.noPages,
          rates: true,
          n: googleNumbers("en"),
          t,
        }),
      );
    const html = pages([{ pageUrl: "https://example.com/blog/post", clicks: 70, impressions: 1500, ctr: 70 / 1500, position: 4.1 }]);
    expect(html).toContain(`>${t.ctrShort}</th>`);
    expect(html).toContain(`>${t.positionShort}</th>`);
    expect(html).toContain("4.7%");
    expect(html).toContain("4.1");
    const unknown = pages([{ pageUrl: "https://example.com/never", clicks: 0, impressions: 0, ctr: null, position: null }]);
    expect(unknown.match(new RegExp(`<span class="sr-only">${t.notAvailable}</span>`, "g"))).toHaveLength(2);
  });

  it("does not claim an import state when no figures are stored, in every language", () => {
    // Google sends no row for a day without activity, so "nothing stored" can
    // be "imported, all zero" as well as "not imported yet": the copy must say neither.
    for (const locale of LOCALES) {
      const lt = getMessages(locale).app.analytics;
      const awaiting = sections(report({ search: { through: null, daysReported: 0 } }), { locale });
      expect(awaiting).toContain(lt.awaitingBody);
      const uncompared = sections(report({ search: { previous: null } }), { locale });
      expect(uncompared).toContain(format(lt.noComparison, { days: 7 }));
      for (const text of [lt.awaitingBody, lt.noComparison, lt.noFiguresYet, lt.dailyDescription]) {
        expect(text, `${locale}: ${text}`).not.toMatch(/import/i);
      }
    }
  });

  it("reads in the reader's language", () => {
    const html = sections(report(), { locale: "de" });
    const de = getMessages("de").app.analytics;
    expect(html).toContain(de.clicks);
    expect(html).toContain("56.789");
    expect(html).toContain("2,2");
  });
});

describe("period links", () => {
  it("marks the current period and keeps every period in the URL", () => {
    const html = renderToStaticMarkup(
      createElement(GoogleRangeNav, { websiteId: "w1", range: "7d", dates: { start: "24 Sept 2026", end: "30 Sept 2026" }, t }),
    );
    expect(html).toContain('href="/websites/w1/google?range=7d" aria-current="page"');
    expect(html).toContain('href="/websites/w1/google"');
    expect(html).toContain('href="/websites/w1/google?range=90d"');
    expect(html).toContain("24 Sept 2026 – 30 Sept 2026");
  });
});

describe("translateServerError", () => {
  it("puts the actions' English refusals into the reader's language and passes anything else through", () => {
    const es = getMessages("es").app;
    expect(translateServerError("Connect Google first", es.analytics, es.workspace)).toBe(es.analytics.errorConnectFirst);
    expect(translateServerError("You have view-only access to this website.", es.analytics, es.workspace)).toBe(es.workspace.viewOnly);
    expect(translateServerError("Something new", es.analytics, es.workspace)).toBe("Something new");
  });
});
