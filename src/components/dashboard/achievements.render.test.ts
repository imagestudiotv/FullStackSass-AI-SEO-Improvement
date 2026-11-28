import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { Achievements, MetricKey } from "@/lib/dashboard/overview";
import { LOCALES } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";

vi.stubGlobal("React", React);
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: () => undefined }),
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(),
}));

import { AchievementsSection } from "./achievements";

/**
 * Dashboard -> Backlinks drew a month of zeros as an empty graph (outside
 * review, 2026-11-27). With no verified link in the period it says why and
 * links to the backlinks page instead.
 */

const days = (value: number | null) =>
  Array.from({ length: 30 }, (_, i) => ({ day: `2026-11-${String(i + 1).padStart(2, "0")}`, value: value === null ? null : i === 29 ? value : 0 }));

function data(backlinks: number | null): Achievements {
  const series = { value: days(null), articles: days(0), backlinks: days(backlinks), impressions: days(null), clicks: days(null), sessions: days(null) } as Record<MetricKey, ReturnType<typeof days>>;
  return {
    window: { range: "30d", from: new Date("2026-11-01"), to: new Date("2026-12-01"), days: 30 },
    policy: null,
    articlesPublished: 0,
    backlinksReceived: 0,
    impressions: null,
    clicks: null,
    sessions: null,
    trafficValue: null,
    trafficValueReason: null,
    backlinkValue: null,
    totalValue: null,
    authority: null,
    healthScore: null,
    searchConsoleThrough: null,
    analyticsThrough: null,
    unknownPublicationDates: 0,
    series,
    breakdownTotal: 0,
    breakdown: [],
  } as unknown as Achievements;
}

const render = (backlinks: number | null, locale: (typeof LOCALES)[number] = "en") =>
  renderToStaticMarkup(
    React.createElement(AchievementsSection, { data: data(backlinks), websiteId: "site-1", initialMetric: "backlinks", initialView: "chart", t: getMessages(locale).app.reports, locale }),
  );

describe("the Backlinks chart on the dashboard", () => {
  it.each(LOCALES)("explains an empty month and links to Backlinks instead of a flat line (%s)", (locale) => {
    const t = getMessages(locale).app.reports;
    expect(t.noBacklinksYet).toBeTruthy();
    const html = render(0, locale);
    expect(html).toContain(t.noBacklinksYet.replace(/'/g, "&#x27;"));
    expect(html).toContain('href="/websites/site-1/backlinks"');
    expect(html).not.toContain(`aria-label="${t.chartActiveLinks}.`);
  });

  it("draws the chart once there is a link", () => {
    const html = render(3);
    const t = getMessages("en").app.reports;
    expect(html).not.toContain(t.noBacklinksYet.replace(/'/g, "&#x27;"));
    expect(html).toContain(`aria-label="${t.chartActiveLinks}.`);
  });
});
