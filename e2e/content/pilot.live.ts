import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { createTestDb, type TestDb } from "@/test/db";
import { generateOutline, generateBody, type ArticleBrief } from "@/lib/articles/generate";
import { planResearchSearch, collectResearchSources, synthesizeResearch, checkResearchEvidence } from "@/lib/articles/research";
import { estimatedAiCost, type AiMeasurement } from "@/lib/ai/article-tasks";
import { MODELS } from "@/lib/ai/client";
import { PRICING } from "@/lib/usage";
import { loadCustomerPilot } from "./pilot-input";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }) }));
let test: TestDb;
beforeAll(async () => { test = await createTestDb(); state.db = test.db; });
afterAll(async () => { await test.client.close(); vi.unstubAllEnvs(); });

const customer = process.env.REPGET_CONTENT_PILOT_INPUT
  ? loadCustomerPilot(process.env.REPGET_CONTENT_PILOT_INPUT) : null;
const caseId = customer?.caseId ?? (process.env.REPGET_CONTENT_PILOT_CASE || "search-console-en");
if (!customer && !["search-console-en", "coffee-es"].includes(caseId)) throw new Error("Unknown content pilot case");
const sourcesOnly = process.env.REPGET_CONTENT_PILOT_STAGE === "sources";
const filename = sourcesOnly ? `${caseId}-sources.json` : caseId === "search-console-en" ? "report.json" : `${caseId}.json`;
if (customer && existsSync(`test-results/content-pilot/${filename}`)) {
  throw new Error("Customer pilot report already exists. Use a new case name to preserve the original comparison.");
}

it(`compares private content pilot drafts: ${caseId}`, async () => {
  const brief: ArticleBrief = customer?.brief ?? {
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
  let searchCost = 0;
  let unknownSearchCosts = 0;
  let variant = "research";
  let cost = 0;
  const guard = () => { if (cost > 1.5 || records.length >= 10) throw new Error("Pilot spending/call limit reached"); };
  const meter = async (m: AiMeasurement) => {
    const estimatedCostUsd = estimatedAiCost(m, PRICING.llm);
    records.push({ ...m, variant, estimatedCostUsd });
    if (estimatedCostUsd !== undefined) cost += estimatedCostUsd;
  };
  const report: Record<string, unknown> = { startedAt: new Date().toISOString(), caseId, topic: brief.title, records,
    brief, customerSnapshot: customer ? { websiteId: customer.websiteId, calendarItemId: customer.calendarItemId, capturedAt: customer.capturedAt } : null,
    note: customer
      ? "A read-only business-profile snapshot. Private local drafts only; no customer database writes, quota use or publishing. Both variants receive the same evidence check. Baseline audit cost is evaluation overhead, not its normal generation cost. Human review and editing time remain pending."
      : "One synthetic brief; automated checks are not a human quality benchmark. No articles are saved or published." };
  mkdirSync("test-results/content-pilot", { recursive: true });
  try {
    guard();
    const searchPlan = await planResearchSearch(brief, meter);
    report.searchPlan = searchPlan;
    const searches: unknown[] = [];
    report.searches = searches;
    const retrieval: { url: string; outcome: string }[] = [];
    report.retrieval = retrieval;
    const sources = await collectResearchSources(brief, async c => {
      if (c === undefined) unknownSearchCosts++;
      else { searchCost += c; cost += c; }
    }, result => retrieval.push(result), { ...searchPlan, search: async (...args) => {
      guard();
      const { articleSearch } = await import("@/lib/providers/dataforseo");
      const result = await articleSearch(...args);
      searches.push({ query: args[0], cached: result.cached, items: result.items });
      return result;
    } });
    report.sources = sources;
    expect(sources.length).toBeGreaterThanOrEqual(2);
    if (caseId === "search-console-en") {
      expect(sources.some(s => new URL(s.url).hostname === "support.google.com")).toBe(true);
    }
    if (sourcesOnly) return;
    guard();
    const research = await synthesizeResearch(brief, sources, "pilot", meter);
    report.research = research;
    expect(research.status).toBe("ready");
    for (const name of customer ? ["A-baseline", "B-research"] : ["A-baseline", "B-research", "C-cheaper-outline"]) {
      variant = name;
      if (name === "C-cheaper-outline") vi.stubEnv("ARTICLE_MODEL_OUTLINE", MODELS.EXTRACTION);
      const input = name === "A-baseline" ? brief : { ...brief, research };
      guard();
      const outline = await generateOutline(input, meter);
      guard();
      const article = await generateBody(input, outline, meter);
      report[name] = { outline, ...article };
      if (customer || name !== "A-baseline") {
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
    report.unknownCostRequests = unknownSearchCosts + records.filter(r => r.estimatedCostUsd === undefined).length;
    report.finishedAt = new Date().toISOString();
    const preparation = searchCost + records.filter(r => r.variant === "research").reduce((sum, r) => sum + (r.estimatedCostUsd ?? 0), 0);
    report.comparison = ["A-baseline", "B-research", ...(!customer ? ["C-cheaper-outline"] : [])].map(name => {
      const calls = records.filter(r => r.variant === name);
      const writing = calls.filter(r => r.task !== "evidence_check");
      return {
        variant: name, estimatedGenerationCostUsd: writing.reduce((sum, r) => sum + (r.estimatedCostUsd ?? 0), 0),
        estimatedEvidenceCheckCostUsd: calls.filter(r => r.task === "evidence_check").reduce((sum, r) => sum + (r.estimatedCostUsd ?? 0), 0),
        estimatedPreparationCostUsd: name === "A-baseline" ? 0 : preparation,
        modelTimeMs: calls.reduce((sum, r) => sum + r.durationMs, 0),
        status: report[`${name}-evidence`] ? "awaiting-human-review" : report[name] ? "draft-created" : "incomplete",
      };
    });
    writeFileSync(`test-results/content-pilot/${filename}`, JSON.stringify(report, null, 2));
  }
});
