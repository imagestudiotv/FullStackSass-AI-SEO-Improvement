import { readFileSync, writeFileSync } from "node:fs";
import { expect, it, vi } from "vitest";
import { checkResearchEvidence } from "@/lib/articles/research";
import { articleTask, estimatedAiCost, type AiMeasurement } from "@/lib/ai/article-tasks";
import type { ArticleBrief } from "@/lib/articles/generate";
import type { ResearchBrief } from "@/lib/articles/research-types";
import { PRICING } from "@/lib/usage";
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get() { throw new Error("Review comparison must not use a database"); } }) }));

it("checks the saved synthetic drafts for source-scope errors using the stronger review route", async () => {
  const report = JSON.parse(readFileSync("test-results/content-pilot/report.json", "utf8"));
  const records: AiMeasurement[] = [];
  const results: Record<string, unknown> = { model: articleTask("evidence_check").model, records };
  const brief = { language: "English", facts: [], services: ["Website setup"], socialLinks: [], backlink: null } as unknown as ArticleBrief;
  for (const name of ["B-research", "C-cheaper-outline"]) {
    const result = await checkResearchEvidence(report[name].bodyHtml, brief, report.research as ResearchBrief, async m => { records.push(m); });
    results[name] = result;
    expect(result.checked).toBe(true);
  }
  const probe: ResearchBrief = {
    version: 1, status: "ready", mode: "pilot", checkedAt: new Date().toISOString(),
    question: "Website verification", intent: "informational", businessAngle: "", subquestions: [], claims: [], warnings: [],
    sources: [{ id: "S1", title: "Builder A: HTML-tag verification", url: "https://builder-a.example/verification",
      retrievedAt: new Date().toISOString(),
      excerpt: "In Builder A's HTML-tag integration, the homepage must be publicly readable so the tag can be fetched. This guide does not describe DNS-based verification." }],
  };
  const probeResult = await checkResearchEvidence(
    '<p>Every website must remove all password protection before any ownership verification method, including DNS verification, can work. <a href="https://builder-a.example/verification">Source</a></p>',
    brief, probe, async m => { records.push(m); },
  );
  results.scopeRegression = probeResult;
  expect(probeResult.checked).toBe(true);
  expect(probeResult.issues.length).toBeGreaterThan(0);
  results.estimatedCostUsd = records.reduce((sum, record) => sum + (estimatedAiCost(record, PRICING.llm) ?? 0), 0);
  writeFileSync("test-results/content-pilot/review-comparison.json", JSON.stringify(results, null, 2));
});
