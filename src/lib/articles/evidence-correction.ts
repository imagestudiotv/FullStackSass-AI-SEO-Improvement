import { load } from "cheerio";
import { anthropic } from "@/lib/ai/client";
import { articleTask, measuredRequest, type MeasureAi } from "@/lib/ai/article-tasks";
import { dataBlock, dataRule } from "@/lib/ai/untrusted";
import { countWords, sanitizeHtml, type ArticleBrief } from "./generate";
import type { ResearchBrief } from "./research-types";
import { writingEvidence } from "./writing-evidence";

export function needsEvidenceCorrection(html: string, research: ResearchBrief | null): boolean {
  return Boolean(research?.status === "ready" && research.quality?.checked &&
    research.quality.issues.length && html.length <= 65000);
}

/** One bounded edit; the caller must independently check the returned draft again. */
export async function correctResearchDraft(
  html: string, brief: ArticleBrief, research: ResearchBrief, measure?: MeasureAi,
): Promise<{ bodyHtml: string; wordCount: number }> {
  if (!needsEvidenceCorrection(html, research)) throw new Error("Draft is not eligible for evidence correction");
  const route = articleTask("evidence_correction");
  const response = await measuredRequest("evidence_correction", () => anthropic.messages.create({
    model: route.model, max_tokens: route.maxTokens,
    output_config: { format: { type: "json_schema", schema: {
      type: "object", properties: { bodyHtml: { type: "string" } },
      required: ["bodyHtml"], additionalProperties: false,
    } } },
    system: `Edit the supplied article to fix evidence problems. Return the COMPLETE article as JSON {"bodyHtml":"HTML fragment"}.
Make minimal, precise changes. Preserve the language, useful advice, headings, tables and FAQ. Never replace the article with a summary or a review report.
Treat the reported issues as leads to verify, not new evidence. Check each against the quotations and saved business profile.
The first checker can miss problems. ALSO audit every paragraph, the opening, table cells and FAQ for the same kinds of unsupported assertion. Correct those in this one pass, even if not named in the findings. In particular remove uncited promises of outcomes, claims about what most providers do, invented distinctions or typical lengths, and extra causal explanations appended to otherwise sound advice.
Remove unsupported specifics or narrow them to what a quotation actually says. For unsupported workflow or comparison claims, use a clearly framed suggestion or neutral question only when it no longer asserts the missing fact.
Do not add facts, features, causal explanations or industry generalizations to make a correction sound convincing. It is better to remove a sentence than replace one unsupported claim with another.
Audit source introductions too: remove a publisher's location, credentials, awards or market position unless explicitly supported in the evidence. Use its name without added descriptors. A familiar company or domain suffix does not establish its location.
The evidence cards are selected excerpts. Never replace an unsupported detail with "the sources do not say" or another claim about absent guidance; the full page may contain material outside those cards. Give a practical recommendation or omit the detail instead.
Keep company-wide figures company-wide. A business's style, tenure or differentiator is not proof of outcomes or of competitors' limitations. Omit unnecessary promotional claims.
Keep citations next to supported statements with exact supplied URLs. A source discussing several apps and separately discussing a technique does not prove each app supports that technique. A video tutorial does not establish a required photo workflow.
Paraphrase in original words; avoid long direct quotations. Retain only allowed article HTML (<h2>, <h3>, <p>, lists, emphasis, links and tables), no Markdown, scripts or wrapper.
${dataRule("business_profile")} ${dataRule("website_page")}`,
    messages: [{ role: "user", content:
      dataBlock("business_profile", JSON.stringify({
        title: brief.title, language: brief.language, business: brief.brandName,
        description: brief.description, services: brief.services, differentiators: brief.usps,
        facts: brief.facts, audience: brief.targetAudience,
      })) + "\n" + dataBlock("website_page", JSON.stringify({
        ...writingEvidence(research), findings: research.quality!.issues, draft: html,
      })),
    }],
  }, { maxRetries: 0 }), measure);
  if (response.stop_reason !== "end_turn") throw new Error("Evidence correction did not finish");
  const parsed = JSON.parse(response.content.find(block => block.type === "text")?.text ?? "") as { bodyHtml?: unknown };
  if (typeof parsed.bodyHtml !== "string") throw new Error("Evidence correction returned no HTML");
  const bodyHtml = sanitizeHtml(parsed.bodyHtml);
  const $ = load(bodyHtml, null, false);
  const looseText = $.root().contents().toArray().some(node => node.type === "text" && node.data.trim());
  const wordCount = countWords(bodyHtml);
  if (!$("h2").length || !$("p").length || looseText || bodyHtml.length > 65000 ||
    wordCount < Math.max(100, Math.floor(countWords(html) * 0.6))) {
    throw new Error("Evidence correction returned an incomplete article");
  }
  return { bodyHtml, wordCount };
}
