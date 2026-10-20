import { mkdirSync, writeFileSync } from "node:fs";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "@/test/db";
import { generateOutline, generateBody, type ArticleBrief } from "@/lib/articles/generate";
import { collectResearchSources, synthesizeResearch, checkResearchEvidence } from "@/lib/articles/research";
import { estimatedAiCost, type AiMeasurement } from "@/lib/ai/article-tasks";
import { MODELS } from "@/lib/ai/client";
import { PRICING } from "@/lib/usage";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }) }));
let test: TestDb;
beforeAll(async () => { test = await createTestDb(); state.db = test.db; });
afterAll(async () => { await test.client.close(); vi.unstubAllEnvs(); });

const caseId = process.env.REPGET_CONTENT_PILOT_CASE || "search-console-en";
if (!["search-console-en", "coffee-es"].includes(caseId)) throw new Error("Unknown content pilot case");

it(`compares baseline, researched writing, and a cheaper outline: ${caseId}`, async () => {
  const brief: ArticleBrief = {
    title: "How a small business can verify its website in Google Search Console",
    targetKeyword: "verify website Google Search Console", intent: "informational",
    relatedKeywords: [], brandName: "Example Web Studio", industry: "Website services",
    country: "United States", language: "English", description: "A synthetic business used only for testing.",
    targetAudience: "Small business owners", services: ["Website setup"], customInstructions: null,
    articleInstructions: null, tone: "Clear and practical", avoid: null, vocabulary: null,
    usps: [], facts: [], socialLinks: [], backlink: null, articleStyle: "expert", targetWordCount: 700,
    internalLinkTarget: 0, tableOfContents: false, authorPerspective: false,
    mentionSimilarProducts: false, comparisonTable: false, imageStyle: null, imageBrief: null, imageInstructions: null,
  };
  if (caseId === "coffee-es") Object.assign(brief, {
    title: "Cómo conservar el café en grano en casa",
    targetKeyword: "cómo conservar café en grano",
    brandName: "Café Ejemplo", industry: "Café de especialidad",
    country: "Spain", language: "Spanish",
    description: "Negocio ficticio utilizado exclusivamente para pruebas.",
    targetAudience: "Personas que preparan café en casa",
    services: ["Venta de café en grano"], tone: "Claro y práctico",
  });
  const records: (AiMeasurement & { variant: string; estimatedCostUsd?: number })[] = [];
  let searchCost: number | undefined;
  let variant = "research";
  let cost = 0;
  const guard = () => { if (cost > 1.5 || records.length >= 10) throw new Error("Pilot spending/call limit reached"); };
  const meter = async (m: AiMeasurement) => {
    const estimatedCostUsd = estimatedAiCost(m, PRICING.llm);
    records.push({ ...m, variant, estimatedCostUsd });
    if (estimatedCostUsd !== undefined) cost += estimatedCostUsd;
  };
  const report: Record<string, unknown> = { startedAt: new Date().toISOString(), caseId, topic: brief.title, records,
    note: "One synthetic brief; automated checks are not a human quality benchmark. No articles are saved or published." };
  mkdirSync("test-results/content-pilot", { recursive: true });
  try {
    guard();
    const retrieval: { url: string; outcome: string }[] = [];
    report.retrieval = retrieval;
    const sources = await collectResearchSources(brief, async c => { searchCost = c; cost += c ?? 0; }, result => retrieval.push(result));
    report.sources = sources;
    guard();
    const research = await synthesizeResearch(brief, sources, "pilot", meter);
    report.research = research;
    expect(research.status).toBe("ready");
    for (const name of ["A-baseline", "B-research", "C-cheaper-outline"]) {
      variant = name;
      if (name === "C-cheaper-outline") vi.stubEnv("ARTICLE_MODEL_OUTLINE", MODELS.EXTRACTION);
      const input = name === "A-baseline" ? brief : { ...brief, research };
      guard();
      const outline = await generateOutline(input, meter);
      guard();
      const article = await generateBody(input, outline, meter);
      report[name] = { outline, ...article };
      if (name !== "A-baseline") {
        guard();
        const evidence = await checkResearchEvidence(article.bodyHtml, input, research, meter);
        report[`${name}-evidence`] = evidence;
      }
      expect(article.wordCount).toBeGreaterThan(300);
    }
  } catch (error) {
    report.failure = error instanceof Error ? error.message : "Pilot failed";
    throw error;
  } finally {
    report.searchCostUsd = searchCost;
    report.estimatedKnownCostUsd = cost;
    report.unknownCostRequests = records.filter(r => r.estimatedCostUsd === undefined).length;
    const filename = caseId === "search-console-en" ? "report.json" : `${caseId}.json`;
    writeFileSync(`test-results/content-pilot/${filename}`, JSON.stringify(report, null, 2));
  }
});
