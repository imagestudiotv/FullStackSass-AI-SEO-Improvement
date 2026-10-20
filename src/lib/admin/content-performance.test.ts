import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "@/test/db";
import { seedWebsite } from "@/test/fixtures";
import { articles, usageEvents } from "@/lib/db/schema";
const state = vi.hoisted(() => ({ db: null as unknown, guard: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }) }));
vi.mock("./guard", () => ({ requireAdmin: state.guard }));
import { getContentPerformance } from "./content-performance";

let test: TestDb;
beforeAll(async () => { test = await createTestDb(); state.db = test.db; });
afterAll(async () => { await test.client.close(); });
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
const now = new Date("2026-10-20T12:00:00Z");

describe("content performance", () => {
  it("requires administrator access before accessing any data", async () => {
    state.guard.mockRejectedValueOnce(new Error("Not found"));
    await expect(getContentPerformance(now)).rejects.toThrow("Not found");
  });
  it("separates unknown costs, task versions, latency coverage and unrelated usage", async () => {
    const f = await seedWebsite(test);
    const base = { organizationId: f.orgId, websiteId: f.websiteId, kind: "llm", model: "writer", createdAt: now };
    const meta = { purpose: "article_body", task: "body", promptVersion: "article-body-v4" };
    await test.db.insert(usageEvents).values([
      { ...base, costUsd: "0.100000", metadata: { ...meta, durationMs: 1000, outcome: "end_turn" } },
      { ...base, costUsd: null, metadata: { ...meta, durationMs: 3000, outcome: "request_failed_usage_unknown" } },
      { ...base, costUsd: "0.200000", metadata: { ...meta, durationMs: "invalid" } },
      { ...base, costUsd: "0.050000", metadata: { ...meta, promptVersion: "article-body-v3", durationMs: 2000 } },
      { ...base, kind: "seo_api", model: null, provider: "dataforseo", metadata: { purpose: "article_research_search" } },
      { ...base, costUsd: "999", metadata: { purpose: "blog_body" } },
      { ...base, costUsd: "999", metadata: meta, createdAt: new Date("2026-09-01") },
      { ...base, costUsd: "999", metadata: meta, createdAt: new Date("2026-10-21") },
    ]);
    vi.stubEnv("ARTICLE_RESEARCH_MODE", "pilot");
    vi.stubEnv("ARTICLE_RESEARCH_WEBSITE_IDS", f.websiteId);
    const report = await getContentPerformance(now);
    expect(report.usage).toHaveLength(3);
    expect(report.usage.find(row => row.promptVersion === "article-body-v4")).toEqual({
      task: "body", model: "writer", promptVersion: "article-body-v4",
      requests: 3, knownCostUsd: 0.3, unknownCosts: 1, averageDurationMs: 2000, measuredDurations: 2, failedRequests: 1,
    });
    expect(report.usage.find(row => row.task === "research_search")).toMatchObject({ knownCostUsd: null, unknownCosts: 1, averageDurationMs: null });
    expect(report.selectedSites.map(site => site.id)).toEqual([f.websiteId]);
    expect(report.rollout.mode).toBe("pilot");
  });
  it("reports saved-version review holds without exposing the source excerpts", async () => {
    const f = await seedWebsite(test);
    const [article] = await test.db.insert(articles).values({
      websiteId: f.websiteId, title: "Review sample", status: "draft", updatedAt: now,
      researchReviewRequired: true, researchApprovedHash: "outdated",
      research: { version: 1, mode: "pilot", status: "ready", question: "Question", intent: "informational",
        businessAngle: "", subquestions: [], sources: [], claims: [], warnings: [], checkedAt: now.toISOString(),
        quality: { checked: true, issues: ["Needs review"] } },
    }).returning();
    const report = await getContentPerformance(now);
    expect(report.recent.find(row => row.id === article.id)).toMatchObject({ held: true, researchStatus: "ready", issues: 1, checked: true });
    expect(report.recent[0]).not.toHaveProperty("research");
  });
});
