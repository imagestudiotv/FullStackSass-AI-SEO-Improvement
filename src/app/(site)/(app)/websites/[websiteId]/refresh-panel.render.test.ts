import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { TrafficReport } from "@/lib/articles/decay";
import { LOCALES } from "@/lib/i18n/config";
import { CONTENT_COPY } from "@/lib/i18n/content-improvements";
import { getMessages } from "@/lib/i18n/messages";

/**
 * Losing traffic must never give the all-clear when it has nothing to judge:
 * without Search Console (or before its first import) the page asks to
 * connect it, in every language.
 */

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode; [key: string]: unknown }) =>
    createElement("a", { href, ...rest }, children),
}));
vi.mock("@/lib/articles/refresh-actions", () => ({ refreshArticle: vi.fn() }));
vi.mock("@/components/traffic-chart", () => ({ TrafficChart: () => null }));

import { RefreshPanel } from "./refresh-panel";

const empty = (over: Partial<TrafficReport> = {}): TrafficReport => ({
  losingClicks: [],
  losingVisibility: [],
  watch: [],
  windowEnd: null,
  ...over,
});

function render(report: TrafficReport, searchConsoleConnected: boolean, locale: (typeof LOCALES)[number] = "en") {
  return renderToStaticMarkup(
    createElement(RefreshPanel, {
      websiteId: "w1",
      report,
      series: [],
      locale,
      t: getMessages(locale).app.common,
      searchConsoleConnected,
    }),
  );
}

describe("RefreshPanel without Search Console data", () => {
  it.each(LOCALES)("asks to connect Search Console when it is not connected (%s)", (locale) => {
    const html = render(empty({ dataStatus: "ready", windowEnd: "2026-11-20" }), false, locale);
    const copy = CONTENT_COPY[locale];
    expect(html).toContain(copy.connectGscTitle.replace(/'/g, "&#x27;"));
    expect(html).toContain('href="/websites/w1/google"');
    expect(html).not.toContain(getMessages(locale).app.common.nothingLosing.replace(/'/g, "&#x27;"));
  });

  it("asks to connect when connected but nothing has been imported yet", () => {
    const html = render(empty({ dataStatus: "none" }), true);
    expect(html).toContain(CONTENT_COPY.en.connectGscTitle);
    expect(html).not.toContain("Nothing is losing traffic");
  });

  it("still gives the all-clear when real, complete data shows no decline", () => {
    const html = render(empty({ dataStatus: "ready", windowEnd: "2026-11-20" }), true);
    expect(html).toContain("Nothing is losing traffic");
    expect(html).not.toContain(CONTENT_COPY.en.connectGscTitle);
  });
});
