import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { expect, it, vi } from "vitest";
import { checkResearchEvidence } from "@/lib/articles/research";
import { articleTask, estimatedAiCost, type AiMeasurement } from "@/lib/ai/article-tasks";
import type { ResearchBrief } from "@/lib/articles/research-types";
import type { ArticleBrief } from "@/lib/articles/generate";
import { PRICING } from "@/lib/usage";
import { customerPilotSchema } from "./pilot-input";

vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get() { throw new Error("Evidence replay must not use a database"); } }) }));
const filenames = (process.env.REPGET_CONTENT_REVIEW_REPORTS ?? "").split(",").filter(Boolean);
if (filenames.length > 2 || filenames.some(file => !/^customer-[a-z0-9-]+\.json$/.test(file))) {
  throw new Error("Specify one or two original customer reports in REPGET_CONTENT_REVIEW_REPORTS.");
}

for (const filename of filenames) {
  it(`rechecks saved customer drafts without regenerating them: ${filename}`, async () => {
    const source = `test-results/content-pilot/${filename}`;
    const revision = articleTask("evidence_check").promptVersion.split("-").at(-1);
    const output = source.replace(/\.json$/, `-reviewed-${revision}.json`);
    if (existsSync(output)) throw new Error("Reviewed report already exists; preserve it before another paid run.");
    const report = JSON.parse(readFileSync(source, "utf8"));
    const snapshot = customerPilotSchema.parse({
      version: 1, caseId: report.caseId, ...report.customerSnapshot, brief: report.brief,
    });
    const records: (AiMeasurement & { variant: string; estimatedCostUsd?: number })[] = [];
    const previousEvidence: Record<string, unknown> = {};
    let cost = 0;
    try {
      for (const name of ["A-baseline", "B-research"]) {
        if (cost > 0.5 || records.length >= 2) throw new Error("Evidence replay budget reached.");
        previousEvidence[name] = report[`${name}-evidence`];
        const evidence = await checkResearchEvidence(report[name].bodyHtml, snapshot.brief,
          report.research as ResearchBrief, async m => {
            const estimatedCostUsd = estimatedAiCost(m, PRICING.llm);
            records.push({ ...m, variant: name, estimatedCostUsd });
            cost += estimatedCostUsd ?? 0;
          });
        report[`${name}-evidence`] = evidence;
        expect(evidence.checked).toBe(true);
      }
    } catch (error) {
      report.reviewFailure = error instanceof Error ? error.message : "Evidence replay failed";
      throw error;
    } finally {
      report.previousEvidence = previousEvidence;
      report.evidenceReplay = { promptVersion: articleTask("evidence_check").promptVersion,
        checkedAt: new Date().toISOString(), estimatedKnownCostUsd: cost, records };
      report.estimatedKnownCostUsd += cost;
      report.unknownCostRequests += records.filter(r => r.estimatedCostUsd === undefined).length;
      // Preserve original generation measurements; show the current check's cost.
      // Total spend above also retains the superseded checks as evaluation overhead.
      for (const row of report.comparison) {
        const measurement = records.find(record => record.variant === row.variant);
        if (!measurement) continue;
        const original = report.records.find((record: AiMeasurement & { variant: string }) =>
          record.variant === row.variant && record.task === "evidence_check");
        row.modelTimeMs += measurement.durationMs - (original?.durationMs ?? 0);
        row.estimatedEvidenceCheckCostUsd = measurement.estimatedCostUsd;
      }
      writeFileSync(output, JSON.stringify(report, null, 2), { flag: "wx", mode: 0o600 });
    }
  });
}

it.skipIf(!filenames.length)("accepts supplied business locations but still detects an invented award", async () => {
  const records: AiMeasurement[] = [];
  const result: Record<string, unknown> = { records };
  const brief = { language: "English", brandName: "Example Studio",
    description: "Based in Porto and Dakar.", usps: ["Film and photography are directed together."],
    facts: ["Founded in 2012."], services: ["Photography", "Film"], socialLinks: [], backlink: null,
  } as unknown as ArticleBrief;
  const research: ResearchBrief = {
    version: 1, status: "ready", mode: "pilot", checkedAt: new Date().toISOString(),
    question: "About the business", intent: "informational", businessAngle: "", subquestions: [],
    sources: [], claims: [], warnings: [],
  };
  const text = "<p>Example Studio is based in Porto and Dakar. Its film and photography share creative direction.</p>";
  try {
    const supported = await checkResearchEvidence(text, brief, research, async m => { records.push(m); });
    result.supported = supported;
    expect(supported.issues).toEqual([]);
    const invented = await checkResearchEvidence(text + "<p>It won the World Photography Award in 2025.</p>",
      brief, research, async m => { records.push(m); });
    result.invented = invented;
    expect(invented.issues.some(issue => /award/i.test(issue))).toBe(true);
  } finally {
    result.estimatedKnownCostUsd = records.reduce((sum, m) => sum + (estimatedAiCost(m, PRICING.llm) ?? 0), 0);
    const revision = articleTask("evidence_check").promptVersion.split("-").at(-1);
    writeFileSync(`test-results/content-pilot/customer-review-context-probe-${revision}.json`, JSON.stringify(result, null, 2));
  }
});
