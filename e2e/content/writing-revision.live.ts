import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, it, vi } from "vitest";
import { generateBody, generateOutline, type ArticleBrief } from "@/lib/articles/generate";
import { checkResearchEvidence } from "@/lib/articles/research";
import { researchBriefSchema, type ResearchBrief } from "@/lib/articles/research-types";
import { articleTask, estimatedAiCost, type AiMeasurement } from "@/lib/ai/article-tasks";
import { PRICING } from "@/lib/usage";
import { customerPilotSchema } from "./pilot-input";

// This experiment uses already saved sources; it cannot read or write customer data.
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get() { throw new Error("Writing replay must not use a database"); } }) }));
const files = (process.env.REPGET_CONTENT_REVISION_REPORTS ?? "").split(",").filter(Boolean);
if (!files.length || files.length > 2 || files.some(file => !/^customer-[a-z0-9-]+\.json$/.test(file))) {
  throw new Error("Specify one or two original customer reports in REPGET_CONTENT_REVISION_REPORTS.");
}
const root = realpathSync("test-results/content-pilot");
const version = articleTask("body").promptVersion.split("-").at(-1);

for (const filename of files) {
  it(`compares revised writing with the saved researched draft: ${filename}`, async () => {
    const input = realpathSync(path.join(root, filename));
    if (path.dirname(input) !== root) throw new Error("Report must be inside the private pilot directory.");
    const output = path.join(root, filename.replace(/\.json$/, `-writing-${version}.json`));
    if (existsSync(output)) throw new Error("Revision report exists; preserve it before another paid run.");
    const original = JSON.parse(readFileSync(input, "utf8"));
    const snapshot = customerPilotSchema.parse({
      version: 1, caseId: original.caseId, ...original.customerSnapshot, brief: original.brief,
    });
    const research = researchBriefSchema.parse(original.research);
    const brief = { ...snapshot.brief, research };
    const records: (AiMeasurement & { variant: string; estimatedCostUsd?: number })[] = [];
    const report = { ...original, originalRecords: original.records, records,
      revision: { writing: articleTask("body").promptVersion, checker: articleTask("evidence_check").promptVersion },
      assistantReview: undefined, evidenceReplay: undefined,
      previousEvidence: { "B-research": original["B-research-evidence"] },
    };
    let variant = "D-revised";
    let cost = 0;
    const guard = () => {
      if (cost >= 1 || records.length >= 4 || records.some(r => r.estimatedCostUsd === undefined)) {
        throw new Error("Writing replay budget or unknown-cost limit reached.");
      }
    };
    const meter = async (m: AiMeasurement) => {
      const estimatedCostUsd = estimatedAiCost(m, PRICING.llm);
      records.push({ ...m, variant, estimatedCostUsd });
      cost += estimatedCostUsd ?? 0;
    };
    try {
      guard();
      const outline = await generateOutline(brief, meter);
      guard();
      report[variant] = { outline, ...await generateBody(brief, outline, meter) };
      expect(report[variant].wordCount).toBeGreaterThan(300);
      // The same checker version reviews both; old QA verdicts are excluded.
      for (const name of ["B-research", "D-revised"]) {
        variant = name;
        guard();
        report[`${name}-evidence`] = await checkResearchEvidence(report[name].bodyHtml, brief, research, meter);
        expect(report[`${name}-evidence`].checked).toBe(true);
      }
    } catch (error) {
      report.failure = error instanceof Error ? error.message : "Writing replay failed";
      throw error;
    } finally {
      const previous = original.comparison.find((row: { variant: string }) => row.variant === "B-research");
      report.comparison = ["B-research", "D-revised"].map(name => {
        const calls = records.filter(r => r.variant === name);
        const writing = name === "B-research"
          ? original.records.filter((r: AiMeasurement & { variant: string }) => r.variant === name && r.task !== "evidence_check")
          : calls.filter(r => r.task !== "evidence_check");
        return {
          variant: name,
          label: name === "B-research" ? "Before · Original researched draft" : "After · Evidence-scoped writing",
          estimatedGenerationCostUsd: name === "B-research" ? previous.estimatedGenerationCostUsd
            : writing.reduce((sum: number, r: { estimatedCostUsd?: number }) => sum + (r.estimatedCostUsd ?? 0), 0),
          // Preparation was reused for free today; retain its original cost in
          // BOTH per-article estimates to avoid claiming artificial savings.
          estimatedPreparationCostUsd: previous.estimatedPreparationCostUsd,
          estimatedEvidenceCheckCostUsd: calls.find(r => r.task === "evidence_check")?.estimatedCostUsd,
          modelTimeMs: [...writing, ...calls.filter(r => r.task === "evidence_check")]
            .reduce((sum: number, r: AiMeasurement) => sum + r.durationMs, 0),
          status: report[`${name}-evidence`]?.checked ? "awaiting-human-review" : "incomplete",
        };
      });
      report.revisionCostUsd = cost;
      report.estimatedKnownCostUsd = original.estimatedKnownCostUsd + cost;
      report.unknownCostRequests = original.unknownCostRequests + records.filter(r => r.estimatedCostUsd === undefined).length;
      report.finishedAt = new Date().toISOString();
      writeFileSync(output, JSON.stringify(report, null, 2), { flag: "wx", mode: 0o600 });
    }
  });
}

it("accepts ordinary advice and unused evidence but rejects a false product citation", async () => {
  const output = path.join(root, `customer-writing-checker-probe-${version}.json`);
  if (existsSync(output)) throw new Error("Probe report exists; preserve it before another paid run.");
  const records: AiMeasurement[] = [];
  const result: Record<string, unknown> = { records };
  const brief = { language: "English", brandName: "Example Studio",
    description: "Based in Porto and Dakar.", usps: ["Film and photography share creative direction."],
    facts: [], services: ["Photography", "Film"], socialLinks: [], backlink: null,
  } as unknown as ArticleBrief;
  const quote = "Color grading adjusts the visual appearance of an image.";
  const research: ResearchBrief = {
    version: 1, status: "ready", mode: "pilot", checkedAt: new Date().toISOString(),
    question: "How to plan a photographic project", intent: "informational", businessAngle: "", subquestions: [],
    sources: [{ id: "S1", url: "https://example.org/colour", title: "Grading", excerpt: quote, retrievedAt: new Date().toISOString() }],
    claims: [{ text: quote, quote, sourceId: "S1" },
      { text: "An unused claim does not need to be included.", quote: "An unused claim does not need to be included.", sourceId: "S1" }],
    warnings: [],
  };
  const supported = `<p>Example Studio is based in Porto and Dakar. Its film and photography share creative direction.</p>
    <p>Ask who owns the footage and request a proposed delivery schedule. I recommend agreeing on the intended look before shooting.</p>
    <p>Color grading adjusts an image's appearance. <a href="https://example.org/colour">Grading guide</a></p>`;
  try {
    result.supported = await checkResearchEvidence(supported, brief, research, async m => { records.push(m); });
    expect((result.supported as { issues: string[] }).issues).toEqual([]);
    result.invented = await checkResearchEvidence(supported +
      '<p>Capture One includes automated skin-tone matching. <a href="https://example.org/colour">Feature source</a></p>',
    brief, research, async m => { records.push(m); });
    expect((result.invented as { issues: string[] }).issues.some(issue => /Capture One|skin.tone/i.test(issue))).toBe(true);
  } finally {
    result.estimatedKnownCostUsd = records.reduce((sum, m) => sum + (estimatedAiCost(m, PRICING.llm) ?? 0), 0);
    result.unknownCostRequests = records.filter(m => estimatedAiCost(m, PRICING.llm) === undefined).length;
    writeFileSync(output, JSON.stringify(result, null, 2), { flag: "wx", mode: 0o600 });
  }
});
