import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, it, vi } from "vitest";
import { checkResearchEvidence } from "@/lib/articles/research";
import { researchBriefSchema } from "@/lib/articles/research-types";
import { articleTask, estimatedAiCost, type AiMeasurement } from "@/lib/ai/article-tasks";
import { PRICING } from "@/lib/usage";
import { customerPilotSchema } from "./pilot-input";
import { countWords, sanitizeHtml } from "@/lib/articles/generate";

vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get() { throw new Error("Editorial replay must not use a database"); } }) }));
const files = (process.env.REPGET_CONTENT_EDITORIAL_REPORTS ?? "").split(",").filter(Boolean);
if (!files.length || files.length > 2 || files.some(file => !/^customer-[a-z0-9-]+\.json$/.test(file))) {
  throw new Error("Specify one or two private reports containing editorialDraft in REPGET_CONTENT_EDITORIAL_REPORTS.");
}
const root = realpathSync("test-results/content-pilot");
for (const filename of files) {
  it(`checks the corrected sample separately from the generated draft: ${filename}`, async () => {
    const input = realpathSync(path.join(root, filename));
    if (path.dirname(input) !== root) throw new Error("Report must be inside the private pilot directory.");
    const version = articleTask("evidence_check").promptVersion.split("-").at(-1);
    const output = input.replace(/\.json$/, `-checked-${version}.json`);
    if (existsSync(output)) throw new Error("Editorial check exists; preserve it before another paid run.");
    const report = JSON.parse(readFileSync(input, "utf8"));
    const snapshot = customerPilotSchema.parse({
      version: 1, caseId: report.caseId, ...report.customerSnapshot, brief: report.brief,
    });
    const research = researchBriefSchema.parse(report.research);
    const html: unknown = report.editorialDraft?.bodyHtml;
    if (typeof html !== "string" || html.length > 65000) {
      throw new Error("Provide an HTML editorial draft within the review limit.");
    }
    const bodyHtml = sanitizeHtml(html);
    if (countWords(bodyHtml) < 300 || !/<h2[ >]/i.test(bodyHtml) || !/<p[ >]/i.test(bodyHtml)) {
      throw new Error("The corrected sample needs HTML headings, paragraphs and at least 300 words.");
    }
    report.editorialDraft.bodyHtml = bodyHtml;
    report.editorialDraft.wordCount = countWords(bodyHtml);
    const records: AiMeasurement[] = [];
    try {
      report.editorialDraft.evidence = await checkResearchEvidence(bodyHtml, snapshot.brief, research, async m => { records.push(m); });
      expect(report.editorialDraft.evidence.checked).toBe(true);
      expect(report.editorialDraft.evidence.issues).toEqual([]);
    } finally {
      report.editorialDraft.reviewRecords = records;
      report.editorialDraft.checkedAt = new Date().toISOString();
      report.editorialDraft.extraReviewCostUsd = records.reduce((sum, m) => sum + (estimatedAiCost(m, PRICING.llm) ?? 0), 0);
      report.estimatedKnownCostUsd += report.editorialDraft.extraReviewCostUsd;
      report.unknownCostRequests += records.filter(m => estimatedAiCost(m, PRICING.llm) === undefined).length;
      writeFileSync(output, JSON.stringify(report, null, 2), { flag: "wx", mode: 0o600 });
    }
  });
}
