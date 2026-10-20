import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, it, vi } from "vitest";
import { generateOutline, generateBody } from "@/lib/articles/generate";
import { checkResearchEvidence } from "@/lib/articles/research";
import { estimatedAiCost, type AiMeasurement } from "@/lib/ai/article-tasks";
import { PRICING } from "@/lib/usage";

vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get() { throw new Error("Baseline comparison cannot access customer data"); } }) }));
const run = process.env.REPGET_BASELINE_RUN;
const inputs = (process.env.REPGET_BASELINE_REPORTS ?? "").split(",").filter(Boolean);
if (run && (!/^[a-z0-9-]{1,60}$/.test(run) || !inputs.length || inputs.length > 3 ||
  inputs.some(input => !/^[a-z0-9-]+\/[a-z0-9-]+\.json$/.test(input)))) throw new Error("Specify a new run and up to three private accuracy reports");

for (const input of run ? inputs : ["disabled"]) {
  (run ? it : it.skip)(`compares legacy writing with saved researched result: ${input}`, async () => {
    const root = realpathSync("test-results/content-accuracy");
    const filename = realpathSync(path.join(root, input));
    if (!filename.startsWith(root + path.sep)) throw new Error("Report escaped private results directory");
    const saved = JSON.parse(readFileSync(filename, "utf8"));
    if (!saved.final || saved.failure || saved.finalCheck?.checked !== true) throw new Error("Requires a completed accuracy run");
    const folder = path.join(root, run!); mkdirSync(folder, { recursive: true });
    const output = path.join(folder, path.basename(input));
    if (existsSync(output)) throw new Error("Preserve the previous comparison");
    const records: (AiMeasurement & { estimatedCostUsd?: number })[] = [];
    let cost = 0;
    const meter = async (m: AiMeasurement) => {
      const estimate = estimatedAiCost(m, PRICING.llm);
      records.push({ ...m, estimatedCostUsd: estimate }); cost += estimate ?? 0;
    };
    const guard = () => {
      if (cost >= 1.25 || records.length >= 3 || records.some(r => r.estimatedCostUsd === undefined)) throw new Error("Comparison spending/usage limit reached");
    };
    const report: Record<string, unknown> = { input, startedAt: new Date().toISOString(), records,
      note: "Same business brief and saved evidence for both checks. Baseline writing does not receive the research. Baseline audit is evaluation overhead, not its normal writing cost. Small observational comparison, not proof of savings, human editing time or factual correctness." };
    try {
      const started = Date.now();
      guard(); const outline = await generateOutline(saved.brief, meter);
      guard(); const article = await generateBody(saved.brief, outline, meter);
      report.baselineGenerationMs = Date.now() - started;
      report.baseline = { outline, ...article };
      guard(); report.baselineCheck = await checkResearchEvidence(article.bodyHtml, saved.brief, saved.research, meter);
      report.researched = { initialCheck: saved.initialCheck, finalCheck: saved.finalCheck,
        correction: saved.correction, wordCount: saved.final.wordCount,
        estimatedKnownCostUsd: saved.estimatedKnownCostUsd,
        elapsedMs: Date.parse(saved.finishedAt) - Date.parse(saved.startedAt),
        unknownCostRequests: saved.unknownCostRequests };
      expect(article.wordCount).toBeGreaterThan(300);
    } catch (error) {
      report.failure = error instanceof Error ? error.message : "Comparison failed"; throw error;
    } finally {
      Object.assign(report, { finishedAt: new Date().toISOString(), estimatedKnownCostUsd: cost,
        baselineWritingCostUsd: records.filter(r => r.task !== "evidence_check").reduce((s, r) => s + (r.estimatedCostUsd ?? 0), 0),
        baselineAuditCostUsd: records.filter(r => r.task === "evidence_check").reduce((s, r) => s + (r.estimatedCostUsd ?? 0), 0),
        unknownCostRequests: records.filter(r => r.estimatedCostUsd === undefined).length });
      writeFileSync(output, JSON.stringify(report, null, 2), { flag: "wx" });
    }
  });
}
