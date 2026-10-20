import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { DashboardOverview } from "@/lib/dashboard/overview";
import { getMessages } from "@/lib/i18n/messages";
import { CONTENT_COPY } from "@/lib/i18n/content-improvements";
import { TodaysArticleCard } from "./overview-cards";

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
