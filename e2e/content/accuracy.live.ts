import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "@/test/db";
import { generateOutline, generateBody, type ArticleBrief } from "@/lib/articles/generate";
import { planResearchSearch, rankResearchSources, collectResearchSources, synthesizeResearch, checkResearchEvidence } from "@/lib/articles/research";
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

// Exercise localized retrieval and writing through the same correction path.
// Synthetic copies keep customer-specific instructions out of new languages.
cases.push({ id: "photo-color-it", brief: { ...cases[1].brief,
  title: "Correzione colore e color grading nella fotografia: le differenze",
  targetKeyword: "correzione colore color grading fotografia differenze",
  language: "Italian", country: "Italy", brandName: "Studio Fotografico Esempio",
  description: "Studio fotografico fittizio utilizzato esclusivamente per prove.",
  targetAudience: "Piccole imprese che commissionano fotografie", services: ["Fotografia commerciale"],
  facts: [], usps: [], customInstructions: null, articleInstructions: null,
  targetWordCount: 700, authorPerspective: false, comparisonTable: false,
} });
cases.push({ id: "domain-verification-es", brief: { ...cases[5].brief,
  title: "Cómo verificar una propiedad de dominio en Google Search Console",
  targetKeyword: "verificar propiedad dominio Google Search Console",
  language: "Spanish", country: "Spain", brandName: "Estudio Web Ejemplo",
  description: "Estudio web ficticio utilizado exclusivamente para pruebas.",
  targetAudience: "Propietarios de pequeñas empresas", services: ["Configuración de sitios web"],
} });
cases.push({ id: "domain-checklist", brief: { ...cases[5].brief,
  comparisonTable: true,
} });

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
  const guard = () => { if (cost >= 1.25 || records.length >= 10) throw new Error("Per-article spending/call limit reached"); };
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
    note: "Fresh automatic generation and at most two independently checked corrections. No manual edits. Private local evaluation; no customer quota, publication or database writes.",
  };
  try {
    guard();
    // Match the job's existing original-query fallback when planning fails.
    // Preserve the failed request and cost; the article still has to satisfy
    // every source-coverage and final-quality assertion below.
    const plan = await planResearchSearch(sample.brief, meter).catch(error => {
      report.searchPlanningFailure = error instanceof Error ? error.message : "Search planning failed";
      return {};
    });
    report.searchPlan = plan;
    const retrieval: unknown[] = []; report.retrieval = retrieval;
    const sources = await collectResearchSources(sample.brief, async amount => {
      if (amount === undefined) unknownCosts++;
      else { cost += amount; searchCost += amount; }
    }, result => retrieval.push(result), { ...plan,
      rank: async candidates => { guard(); return rankResearchSources(sample.brief, candidates, meter); },
      search: async (...args) => {
      guard();
      const { articleSearch } = await import("@/lib/providers/dataforseo");
      const result = await articleSearch(...args).catch(error => {
        ((report.searchErrors ??= []) as unknown[]).push({ query: args[0],
          message: error instanceof Error ? error.message : "Search failed" });
        throw error;
      });
      ((report.searches ??= []) as unknown[]).push({ query: args[0], cached: result.cached, items: result.items });
      return result;
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
      if (needsEvidenceCorrection(final.bodyHtml, { ...research, quality })) {
        const remainingIssues = quality.issues;
        guard(); const followUp = await correctResearchDraft(final.bodyHtml, brief, { ...research, quality }, meter);
        final = { ...final, ...followUp }; report.final = final;
        report.correction = { attempted: true, applied: true, initialIssues: initial.issues,
          followUp: { applied: true, issues: remainingIssues } };
        guard(); quality = await checkResearchEvidence(final.bodyHtml, brief, research, meter);
      }
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
