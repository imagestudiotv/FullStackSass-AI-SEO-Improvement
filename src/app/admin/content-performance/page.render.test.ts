import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { mkdirSync, writeFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CONTENT_COPY } from "@/lib/i18n/content-improvements";
import { ResearchStatus } from "@/components/articles/research-status";
const state = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("@/lib/admin/content-performance", () => ({
  getContentPerformance: state.load, CONTENT_TASKS: { body: "Article writing" },
}));
import ContentPerformancePage from "./page";

const sample = () => ({
  since: new Date("2026-09-20"), until: new Date("2026-10-20"),
  rollout: { mode: "pilot", websiteIds: ["site"], allWebsites: false },
  selectedSites: [{ id: "site", domain: "example.test" }],
  routes: [{ task: "body", label: "Article writing", model: "writer-example", promptVersion: "article-body-v4" }],
  usage: [{ task: "body", model: "writer-example", promptVersion: "article-body-v4", requests: 3,
    knownCostUsd: 0.3, unknownCosts: 1, averageDurationMs: 2000, measuredDurations: 2, failedRequests: 1 }],
  recent: [{ id: "article", title: "How to compare production companies", domain: "example.test",
    status: "draft", researchStatus: "ready", checked: true, issues: 1, held: true }],
});
afterEach(() => vi.clearAllMocks());

describe("content rollout UI", () => {
  it("labels a partial cost subtotal, latency coverage and review holds explicitly", async () => {
    state.load.mockResolvedValue(sample());
    const html = renderToStaticMarkup(await ContentPerformancePage());
    expect(html).toContain("$0.3000");
    expect(html).toContain("subtotal is incomplete");
    expect(html).toContain("2 of 3 measured");
    expect(html).toContain("Review required");
    expect(html).toContain("example.test");
    expect(html).toContain('href="/admin/articles/article"');
    if (process.env.REPGET_RENDER_CONTENT_PREVIEW === "1") {
      mkdirSync("test-results/content-rollout", { recursive: true });
      const banner = renderToStaticMarkup(createElement(ResearchStatus, { mode: "pilot", locale: "en" }));
      writeFileSync("test-results/content-rollout/preview.html", `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><title>Content rollout preview · synthetic data</title></head><body class="bg-background text-foreground"><main class="mx-auto max-w-7xl p-6"><p class="mb-4 text-sm">Local preview · synthetic examples</p>${banner}${html}</main></body></html>`);
    }
  });
  it("does not show unmeasured activity as zero-cost work", async () => {
    state.load.mockResolvedValue({ ...sample(), usage: [], recent: [], rollout: { mode: "off", websiteIds: [], allWebsites: false } });
    const html = renderToStaticMarkup(await ContentPerformancePage());
    expect(html).toContain("No data");
    expect(html).toContain("Older unmetered work is not counted as free");
    expect(html).not.toContain("$0.0000");
    expect(html).toContain("Research is not enabled");
  });
  it("explains the pilot's publication hold in every supported language", () => {
    for (const locale of Object.keys(CONTENT_COPY) as (keyof typeof CONTENT_COPY)[]) {
      const html = renderToStaticMarkup(createElement(ResearchStatus, { mode: "pilot", locale }));
      expect(html).toContain(CONTENT_COPY[locale].pilotHelp);
      expect(html).not.toContain("ARTICLE_RESEARCH");
    }
    expect(renderToStaticMarkup(createElement(ResearchStatus, { mode: "off", locale: "en" }))).toBe("");
  });
});
