import { load } from "cheerio";

import { anthropic } from "@/lib/ai/client";
import { articleTask, measuredRequest, type MeasureAi } from "@/lib/ai/article-tasks";
import { dataBlock, dataRule } from "@/lib/ai/untrusted";
import { cleanDashesHtml, dashRuleFor, NO_DASH_RULE } from "./dashes";
import { countWords, sanitizeHtml, type ArticleBrief } from "./generate";
import {
  ARTICLE_FORMATS,
  articleText,
  formatInstruction,
  parseFormatPlan,
  parseFormatReview,
  serpDigest,
  type FormatPlan,
  type FormatReview,
  type SerpResult,
} from "./format-plan";

export * from "./format-plan";

/**
 * The article's FORMAT, read from what Google already ranks for its keyword.
 *
 * Intent says why someone searches; the format says what they expect to find.
 * "Birthday wishes for a son-in-law, in your own words" is informational, and
 * every page that ranks for it is a collection of wishes. RepGet wrote advice
 * on how to write one, with no wishes in it (review of 2026-11-27) - right
 * intent, wrong format, useless to the reader.
 *
 * So before the outline the top results' titles and snippets are classified
 * (Haiku), and the format's concrete requirements go into the outline and
 * body prompts (formatInstruction, via briefContext). After writing, a Haiku
 * check asks whether the article delivers it; if not, ONE correction pass
 * (Sonnet) - never a loop. Each call is a separately memoized, metered paid
 * step in generate-article.ts.
 */

const CLASSIFY_SCHEMA = {
  type: "object",
  properties: {
    format: { type: "string", enum: [...ARTICLE_FORMATS] },
    minItems: {
      type: "integer",
      description: "For examples: how many items the ranking pages offer (a title saying '50 wishes' means 50). Otherwise 0.",
    },
  },
  required: ["format", "minItems"],
  additionalProperties: false,
} as const;

const CLASSIFY_SYSTEM = `You decide which kind of article best satisfies a search, from the pages Google ranks for it.

Formats:
- examples: the reader wants ready-to-use items to take as they are: wishes, greetings, toasts, messages, captions, quotes, names, ideas, templates, sample texts, lists of examples.
- how_to: step-by-step instructions to do something.
- comparison: "best X" lists, rankings, "X vs Y", alternatives: the reader is choosing between options.
- review: a verdict on one product, service, place or provider.
- explainer: what something is, what it means, why or how it works.
- local_service: the reader wants a provider in a place; the results are businesses, directories and maps.
- guide: a broad guide, or no single format dominates.

Judge by what the ranking pages ARE (their titles and snippets), then by the search's own words. When there are no results, judge by the words alone. A search asking for examples "in your own words" still wants the examples.
${dataRule("website_page")} ${dataRule("site_data")}`;

export async function classifyArticleFormat(
  brief: Pick<ArticleBrief, "title" | "targetKeyword" | "language">,
  results: SerpResult[],
  measure?: MeasureAi,
): Promise<FormatPlan> {
  const digest = serpDigest(results);
  const route = articleTask("format_classify");
  const response = await measuredRequest("format_classify", () => anthropic.messages.create({
    model: route.model,
    max_tokens: route.maxTokens,
    system: CLASSIFY_SYSTEM,
    output_config: { format: { type: "json_schema", schema: CLASSIFY_SCHEMA } },
    messages: [{
      role: "user",
      content: [
        dataBlock("site_data", JSON.stringify({ search: brief.targetKeyword, plannedTitle: brief.title, language: brief.language })),
        dataBlock("website_page", JSON.stringify(digest.length ? digest : "No search results available.")),
      ].join("\n"),
    }],
  }, { maxRetries: 0 }), measure, route.model);
  if (response.stop_reason !== "end_turn") throw new Error("Format classification did not finish");
  const block = response.content.find((item) => item.type === "text");
  if (!block || block.type !== "text") throw new Error("No format returned");
  return parseFormatPlan(block.text, digest.length);
}

const CHECK_SCHEMA = {
  type: "object",
  properties: {
    delivers: { type: "boolean" },
    items: { type: "integer", description: "For examples: how many complete, ready-to-use examples are written out in full. Otherwise 0." },
    problems: { type: "array", items: { type: "string" }, description: "What is missing or wrong for this format; at most 5, empty when it delivers." },
  },
  required: ["delivers", "items", "problems"],
  additionalProperties: false,
} as const;

/** Does the written article deliver its format? Haiku; reads the text, not the markup. */
export async function checkArticleFormat(html: string, brief: Pick<ArticleBrief, "title" | "targetKeyword" | "language">, plan: FormatPlan, measure?: MeasureAi): Promise<FormatReview> {
  const route = articleTask("format_check");
  const response = await measuredRequest("format_check", () => anthropic.messages.create({
    model: route.model,
    max_tokens: route.maxTokens,
    system: `You check whether an article gives the person searching what they came for, in the format required. Count strictly: an example counts only when it is written out in full, ready to use; advice about what an example could contain does not count. Answer in JSON. ${dataRule("website_page")} ${dataRule("site_data")}`,
    output_config: { format: { type: "json_schema", schema: CHECK_SCHEMA } },
    messages: [{
      role: "user",
      content: [
        dataBlock("site_data", JSON.stringify({ search: brief.targetKeyword, title: brief.title, language: brief.language, requiredFormat: formatInstruction(plan) })),
        dataBlock("website_page", articleText(html)),
      ].join("\n"),
    }],
  }, { maxRetries: 0 }), measure, route.model);
  if (response.stop_reason !== "end_turn") throw new Error("Format check did not finish");
  const block = response.content.find((item) => item.type === "text");
  if (!block || block.type !== "text") throw new Error("No format check returned");
  return parseFormatReview(block.text, plan);
}

/**
 * One bounded rewrite toward the format. The caller runs it at most once, in
 * its own memoized step; the result is checked for completeness here and, for
 * a researched article, by the evidence checks that follow it.
 */
export async function correctArticleFormat(
  html: string,
  brief: ArticleBrief,
  plan: FormatPlan,
  review: FormatReview,
  measure?: MeasureAi,
): Promise<{ bodyHtml: string; wordCount: number }> {
  const researched = brief.research?.status === "ready";
  const route = articleTask("format_correction", researched);
  const response = await measuredRequest("format_correction", () => anthropic.messages.create({
    model: route.model,
    max_tokens: route.maxTokens,
    output_config: { format: { type: "json_schema", schema: {
      type: "object", properties: { bodyHtml: { type: "string" } }, required: ["bodyHtml"], additionalProperties: false,
    } } },
    system: `Revise the supplied article so it delivers what the person searching wants, in the required format. Return the COMPLETE article as JSON {"bodyHtml":"HTML fragment"}.
Fix the listed problems: add what the format needs and move it where the format puts it; shorten or cut advice that pushes the main content down. Keep the language, the parts that already serve the reader, the tables and the FAQ.
Do not invent facts, statistics, prices, dates, studies, quotes, customers or claims about the business. Examples, wishes and templates are original writing and may be added freely; factual statements may not.
Keep every existing link exactly as it is and add no new links: none to other websites and no web addresses in the text.
Retain only allowed article HTML (<h2>, <h3>, <p>, <ul>, <ol>, <li>, <strong>, <em>, <a> and tables), no <h1>, Markdown, scripts or wrapper.
${[NO_DASH_RULE, dashRuleFor(brief.language)].filter(Boolean).join("\n")}
${dataRule("business_profile")} ${dataRule("website_page")}`,
    messages: [{
      role: "user",
      content: [
        `Required format: ${formatInstruction(plan) ?? plan.format}`,
        dataBlock("business_profile", JSON.stringify({
          title: brief.title, keyword: brief.targetKeyword, language: brief.language, business: brief.brandName,
          description: brief.description, services: brief.services, audience: brief.targetAudience,
        })),
        dataBlock("website_page", JSON.stringify({ problems: review.problems, draft: html })),
      ].join("\n"),
    }],
  }, { maxRetries: 0 }), measure, route.model);
  if (response.stop_reason !== "end_turn") throw new Error("Format correction did not finish");
  const parsed = JSON.parse(response.content.find((block) => block.type === "text")?.text ?? "") as { bodyHtml?: unknown };
  if (typeof parsed.bodyHtml !== "string") throw new Error("Format correction returned no HTML");
  const bodyHtml = cleanDashesHtml(sanitizeHtml(parsed.bodyHtml), { language: brief.language });
  const $ = load(bodyHtml, null, false);
  const looseText = $.root().contents().toArray().some((node) => node.type === "text" && node.data.trim());
  const wordCount = countWords(bodyHtml);
  if (!$("h2").length || !$("p").length || looseText || bodyHtml.length > 80000 ||
    wordCount < Math.max(100, Math.floor(countWords(html) * 0.6))) {
    throw new Error("Format correction returned an incomplete article");
  }
  return { bodyHtml, wordCount };
}
