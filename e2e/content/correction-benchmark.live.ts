import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { correctResearchDraft } from "@/lib/articles/evidence-correction";
import { checkResearchEvidence } from "@/lib/articles/research";
import { estimatedAiCost, type AiMeasurement } from "@/lib/ai/article-tasks";
import { PRICING } from "@/lib/usage";

vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get() { throw new Error("Correction benchmark cannot access customer data"); } }) }));
afterEach(() => vi.unstubAllEnvs());
const run = process.env.REPGET_CORRECTION_BENCHMARK;
const inputs = (process.env.REPGET_CORRECTION_REPORTS ?? "").split(",").filter(Boolean);
if (run && (!/^[a-z0-9-]{1,60}$/.test(run) || !inputs.length || inputs.length > 3 ||
  inputs.some(input => !/^[a-z0-9-]+\/[a-z0-9-]+\.json$/.test(input)))) throw new Error("Specify a new run and up to three private report paths");
for (const input of run ? inputs : ["disabled"]) {
  (run ? it : it.skip)(`compares bounded corrections on identical evidence: ${input}`, async () => {
    const root = realpathSync("test-results/content-accuracy");
    const filename = realpathSync(path.join(root, input));
    if (!filename.startsWith(root + path.sep)) throw new Error("Report escaped the private results directory");
    const saved = JSON.parse(readFileSync(filename, "utf8"));
    const folder = path.join(root, run!); mkdirSync(folder, { recursive: true });
    const output = path.join(folder, path.basename(input));
    if (existsSync(output)) throw new Error("Preserve the previous benchmark");
    const records: (AiMeasurement & { estimatedCostUsd?: number })[] = [];
    const report: Record<string, unknown> = { input, startedAt: new Date().toISOString(), records,
      note: "Correction comparison using the same original draft and saved sources. Not a fresh article; no publication or customer writes." };
    let cost = 0;
    const meter = async (m: AiMeasurement) => {
      const value = estimatedAiCost(m, PRICING.llm); records.push({ ...m, estimatedCostUsd: value });
      cost += value ?? 0;
    };
    try {
      for (const model of ["claude-sonnet-5-5", "claude-opus-5-5"]) {
        if (cost >= 1 || records.some(r => r.estimatedCostUsd === undefined)) throw new Error("Benchmark budget or usage uncertainty limit reached");
        vi.stubEnv("ARTICLE_MODEL_EVIDENCE_CORRECTION", model);
        const revised = await correctResearchDraft(saved.original.bodyHtml, saved.brief,
          { ...saved.research, quality: saved.initialCheck }, meter);
        const checked = await checkResearchEvidence(revised.bodyHtml, saved.brief, saved.research, meter);
        report[model] = { ...revised, checked };
      }
      expect((report["claude-opus-5-5"] as { checked: { issues: string[] } }).checked.issues).toEqual([]);
    } finally {
      Object.assign(report, { finishedAt: new Date().toISOString(), estimatedKnownCostUsd: cost });
      writeFileSync(output, JSON.stringify(report, null, 2), { flag: "wx" });
    }
  });
}
