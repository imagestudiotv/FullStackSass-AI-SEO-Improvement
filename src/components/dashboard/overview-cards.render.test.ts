import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { DashboardOverview } from "@/lib/dashboard/overview";
import { getMessages } from "@/lib/i18n/messages";
import { CONTENT_COPY } from "@/lib/i18n/content-improvements";
import { AuthorityCard, TodaysArticleCard } from "./overview-cards";

vi.stubGlobal("React", React);

describe("today's research review notice", () => {
  it.each(["en", "es", "fr", "it", "de"] as const)("explains the hold in %s instead of inviting publication", locale => {
    const overview = {
      websiteId: "site",
      todaysArticle: { ok: true, data: {
        id: "article", title: "A draft to check", state: "awaiting_research_review",
        imageUrl: null, publishedUrl: null, targetKeyword: null,
        volume: null, difficulty: null, intent: null, plannedFor: null,
      } },
    } as DashboardOverview;
    const t = getMessages(locale).app.reports;
    const html = renderToStaticMarkup(React.createElement(TodaysArticleCard, { overview, t, locale }));
    expect(html).toContain(CONTENT_COPY[locale].held);
    expect(html).toContain(CONTENT_COPY[locale].reviewHelp);
    expect(html).not.toContain(t.stDraftHelp);
    expect(html).toContain("/websites/site/articles/article");
  });
});

describe("the Home Backlinks card", () => {
  const t = getMessages("en").app.reports;
  const card = (active: number[]) => {
    const overview = {
      websiteId: "site",
      ownerView: true,
      credits: { available: 0 },
      backlinks: { ok: true, data: { own: null, received: { verified: active.some((n) => n > 0) ? 1 : 0 } } },
      history: { ok: true, data: { undated: 0, points: active.map((n, i) => ({ day: `2026-11-${String(i + 1).padStart(2, "0")}`, active: n })) } },
    } as unknown as DashboardOverview;
    return renderToStaticMarkup(React.createElement(AuthorityCard, { overview, t, locale: "en" }));
  };

  it("explains a month without links instead of drawing a flat line of zeros (outside review, 2026-11-27)", () => {
    const html = card(Array(30).fill(0));
    expect(html).toContain(t.noBacklinksYet.replace(/'/g, "&#x27;"));
    expect(html).toContain("href=\"/websites/site/backlinks\"");
    expect(html).not.toContain(t.chartActiveLinks);
  });

  it("still charts the links once there is one", () => {
    const html = card([0, 0, 1, 1]);
    expect(html).not.toContain(t.noBacklinksYet.replace(/'/g, "&#x27;"));
  });
});
