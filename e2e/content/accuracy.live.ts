import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "@/test/db";
import { generateOutline, generateBody, type ArticleBrief } from "@/lib/articles/generate";
import { planResearchSearch, collectResearchSources, synthesizeResearch, checkResearchEvidence } from "@/lib/articles/research";
import { correctResearchDraft, needsEvidenceCorrection } from "@/lib/articles/evidence-correction";
import { estimatedAiCost, type AiMeasurement } from "@/lib/ai/article-tasks";
import { PRICING } from "@/lib/usage";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }) }));
let test: TestDb;
beforeAll(async () => {
  test = await createTestDb(); state.db = test.db;
  const candidate = process.env.REPGET_ACCURACY_CANDIDATE;
  if (candidate && !["sonnet55", "review55"].includes(candidate)) throw new Error("Unknown model candidate");
  if (candidate === "sonnet55" || candidate === "review55") {
    for (const task of ["OUTLINE", "BODY", "EVIDENCE_CORRECTION"]) vi.stubEnv(`ARTICLE_MODEL_${task}`, "claude-sonnet-5-5");
  }
  if (candidate === "review55") {
    vi.stubEnv("ARTICLE_MODEL_RESEARCH", "claude-sonnet-5-5");
    vi.stubEnv("ARTICLE_MODEL_EVIDENCE_CHECK", "claude-opus-5-5");
  }
});
afterAll(async () => { await test.client.close(); vi.unstubAllEnvs(); });

// Explicit file opt-in in addition to the live config: ordinary pilot runs do
// not accidentally spend on this batch. Never write drafts to a real database.
const run = process.env.REPGET_ACCURACY_RUN;
if (run && !/^[a-z0-9-]{1,60}$/.test(run)) throw new Error("Invalid accuracy run name");
const profile: ArticleBrief = run
  ? JSON.parse(readFileSync("test-results/content-pilot/customer-inputs/customer-commercial-20261020.json", "utf8")).brief
  : {} as ArticleBrief;
const cases = [
  { id: "brand-brief", brief: { ...profile,
    title: "How to Write a Commercial Video Production Brief",
    targetKeyword: "commercial video production brief", relatedKeywords: [], intent: "informational" } },
  { id: "photo-color", brief: { ...profile,
    title: "Color Correction vs Color Grading in Photography",
    targetKeyword: "color correction vs color grading photography", relatedKeywords: [], intent: "informational" } },
  { id: "wedding-audio", brief: { ...profile,
    title: "Wedding Video Audio: Questions to Ask Your Videographer",
    targetKeyword: "wedding video audio recording", relatedKeywords: [], intent: "informational" } },
  { id: "product-photo-brief", brief: { ...profile,
    title: "How to Prepare a Product Photography Brief",
    targetKeyword: "product photography brief", relatedKeywords: [], intent: "informational" } },
  { id: "coffee-storage", brief: { ...profile,
    title: "How to Store Whole Coffee Beans at Home",
    targetKeyword: "how to store whole coffee beans", relatedKeywords: [], intent: "informational",
    brandName: "Example Coffee Roasters", industry: "Coffee", country: "United States",
    description: "A synthetic coffee retailer used exclusively for testing.",
    targetAudience: "Home coffee drinkers", services: ["Whole bean coffee"], usps: [], facts: [],
    customInstructions: null, articleInstructions: null, tone: "Clear and practical",
    avoid: null, vocabulary: null, articleStyle: "expert", authorPerspective: false,
    comparisonTable: false, tableOfContents: false, targetWordCount: 700 } },
  { id: "domain-verification", brief: { ...profile,
    title: "How to Verify a Domain Property in Google Search Console",
    targetKeyword: "Google Search Console verify domain property", relatedKeywords: [], intent: "informational",
    brandName: "Example Web Studio", industry: "Website services", country: "United States",
    description: "A synthetic website setup business used exclusively for testing.",
    targetAudience: "Small business owners", services: ["Website setup"], usps: [], facts: [],
    customInstructions: null, articleInstructions: null, tone: "Clear and practical",
    avoid: null, vocabulary: null, articleStyle: "expert", authorPerspective: false,
    comparisonTable: false, tableOfContents: false, targetWordCount: 700 } },
];

const requested = process.env.REPGET_ACCURACY_CASES?.split(",").filter(Boolean);
if (requested?.some(id => !cases.some(sample => sample.id === id))) throw new Error("Unknown accuracy case");
for (const sample of cases) {
const runCase = run && (!requested || requested.includes(sample.id)) ? it.concurrent : it.skip;
runCase(`fresh automatic accuracy: ${sample.id}`, async () => {
  const folder = `test-results/content-accuracy/${run}`;
  mkdirSync(folder, { recursive: true });
  const output = `${folder}/${sample.id}.json`;
  if (existsSync(output)) throw new Error("Preserve prior results: choose a new accuracy run name");
  const records: (AiMeasurement & { estimatedCostUsd?: number })[] = [];
  let cost = 0, unknownCosts = 0, searchCost = 0;
  const guard = () => { if (cost >= 1.25 || records.length >= 8) throw new Error("Per-article spending/call limit reached"); };
  const meter = async (measurement: AiMeasurement) => {
    const estimate = estimatedAiCost(measurement, PRICING.llm);
    records.push({ ...measurement, estimatedCostUsd: estimate });
    if (estimate === undefined) unknownCosts++;
    else cost += estimate;
    writeFileSync(`${folder}/${sample.id}.progress.json`, JSON.stringify({
      at: new Date().toISOString(), completedTasks: records.map(record => record.task),
      estimatedKnownCostUsd: cost, unknownCosts,
    }, null, 2));
  };
  const report: Record<string, unknown> = {
    startedAt: new Date().toISOString(), brief: sample.brief, records,
    candidate: process.env.REPGET_ACCURACY_CANDIDATE ?? "default",
    note: "Fresh automatic generation and at most one correction. No manual edits. Private local evaluation; no customer quota, publication or database writes.",
  };
  try {
    guard();
    const plan = await planResearchSearch(sample.brief, meter);
    report.searchPlan = plan;
    const retrieval: unknown[] = []; report.retrieval = retrieval;
    const sources = await collectResearchSources(sample.brief, async amount => {
      if (amount === undefined) unknownCosts++;
      else { cost += amount; searchCost += amount; }
    }, result => retrieval.push(result), { ...plan, search: async (...args) => {
      guard();
      const { articleSearch } = await import("@/lib/providers/dataforseo");
      return articleSearch(...args);
    } });
    report.sources = sources;
    guard();
    const research = await synthesizeResearch(sample.brief, sources, "pilot", meter);
    report.research = research;
    expect(research.status).toBe("ready");
    const brief = { ...sample.brief, research };
    guard(); const outline = await generateOutline(brief, meter);
    report.outline = outline;
    guard(); const original = await generateBody(brief, outline, meter);
    report.original = original;
    guard(); const initial = await checkResearchEvidence(original.bodyHtml, brief, research, meter);
    report.initialCheck = initial;
    let final = original, quality = initial;
    const checked = { ...research, quality: initial };
    if (needsEvidenceCorrection(original.bodyHtml, checked)) {
      guard(); const correction = await correctResearchDraft(original.bodyHtml, brief, checked, meter);
      final = { ...original, ...correction };
      report.correction = { attempted: true, applied: true, initialIssues: initial.issues };
      report.final = final; // Save the revision even if the next call fails.
      guard(); quality = await checkResearchEvidence(final.bodyHtml, brief, research, meter);
    }
    report.final = final;
    report.finalCheck = quality;
    expect(final.wordCount).toBeGreaterThan(300);
    expect(quality.checked).toBe(true);
    expect(quality.issues).toEqual([]);
  } catch (error) {
    report.failure = error instanceof Error ? error.message : "Accuracy run failed";
    throw error;
  } finally {
    Object.assign(report, { finishedAt: new Date().toISOString(), estimatedKnownCostUsd: cost,
      searchCostUsd: searchCost, unknownCostRequests: unknownCosts });
    writeFileSync(output, JSON.stringify(report, null, 2), { flag: "wx" });
    const progress = `${folder}/${sample.id}.progress.json`;
    if (existsSync(progress)) unlinkSync(progress);
  }
});
}
