import { load } from "cheerio";

import { labsMarket } from "@/lib/providers/dataforseo-markets";

/**
 * Article formats and what each asks of the writer: the pure half of
 * lib/articles/format.ts (which holds the model calls and explains why), so
 * the writing prompts (generate.ts briefContext) can read it without pulling
 * in the calls.
 */

export const ARTICLE_FORMATS = ["examples", "how_to", "comparison", "review", "explainer", "local_service", "guide"] as const;
export type ArticleFormat = (typeof ARTICLE_FORMATS)[number];

export type FormatPlan = {
  format: ArticleFormat;
  /** For "examples": how many ready-to-use items the article must contain. */
  minItems: number | null;
  /** "serp": decided from the ranking pages; "keyword": from the keyword's words alone. */
  basis: "serp" | "keyword";
  /** How many results the decision read. */
  results: number;
};

export type SerpResult = { url: string; title?: string; description?: string };

/** Ready-to-use examples, at least: the floor the 2026-11-27 review asked for. */
export const MIN_EXAMPLES = 15;
const MAX_EXAMPLES = 40;

/**
 * The Google market to read for a website's keyword, or null when DataForSEO
 * has none in its language: results in another language would describe
 * another audience's expectations.
 */
export function formatSearchMarket(country: string | null, language: string | null): { location: string; language: string } | null {
  if (!country || !language) return null;
  const market = labsMarket(country, language);
  return market.language.toLowerCase() === language.trim().toLowerCase() ? { location: market.location, language: market.language } : null;
}

/** The search results as the classifier reads them: the first ten, titles and snippets only. */
export function serpDigest(results: SerpResult[]): { title: string; snippet: string; host: string }[] {
  return results.slice(0, 10).map((result) => {
    let host = "";
    try {
      host = new URL(result.url).hostname.replace(/^www\./, "");
    } catch {
      host = "";
    }
    return { title: (result.title ?? "").slice(0, 200), snippet: (result.description ?? "").slice(0, 300), host };
  });
}

export function parseFormatPlan(text: string, results: number): FormatPlan {
  const parsed = JSON.parse(text) as { format?: unknown; minItems?: unknown };
  const format = ARTICLE_FORMATS.find((value) => value === parsed.format) ?? "guide";
  const asked = typeof parsed.minItems === "number" && Number.isFinite(parsed.minItems) ? Math.round(parsed.minItems) : 0;
  return {
    format,
    minItems: format === "examples" ? Math.min(Math.max(asked, MIN_EXAMPLES), MAX_EXAMPLES) : null,
    basis: results > 0 ? "serp" : "keyword",
    results,
  };
}

/**
 * What the format asks of the outline and the body, or null for a plain
 * guide (the prompts' own rules already describe one).
 */
export function formatInstruction(plan: FormatPlan | null | undefined): string | null {
  if (!plan || plan.format === "guide") return null;
  const lead = `Article format, from the pages that rank for this search: ${plan.format.replace("_", " ")}. It takes precedence over the general structure rules (how many sections, how often to use lists). Open by answering the search directly: the first paragraph already gives the reader what they came for, with no background first.`;
  switch (plan.format) {
    case "examples":
      return `${lead} The reader wants ready-to-use examples, not advice about writing them. Write at least ${plan.minItems ?? MIN_EXAMPLES} complete examples in full, each one ready to copy and use as it is (never a description of what an example could say), grouped under H2/H3 headings by occasion, tone, recipient or length, each example its own <li> or <p>. Make them varied, natural and specific to the search, written natively in the article's language; they are original writing, not facts, and need no source. Put the examples first: tips on adapting or writing your own come after them, in one short section at most. In the outline, give each examples section a point saying how many examples it holds and in what style.`;
    case "how_to":
      return `${lead} Give the steps as a numbered list (<ol>), in the order they are done, each starting with what to do. Say before the steps what is needed. Keep explanations short and next to the step they belong to; troubleshooting and tips come after the steps.`;
    case "comparison":
      return `${lead} Name the options being chosen between early, then compare them on the criteria that decide the choice, and end with which option suits which reader. Keep to the brief's rules on tables, products and claims: compare only what the brief and its evidence support.`;
    case "review":
      return `${lead} Give the verdict in the opening, then what is good and what is not (as two lists), who it suits and who should look elsewhere. Describe only what the brief and its evidence support; never invent test results, prices or ratings.`;
    case "explainer":
      return `${lead} Define the term in the first two sentences, plainly. Then how it works or why it matters, a concrete example, and common confusions. No how-to or sales sections unless the search asks for them.`;
    case "local_service":
      return `${lead} The reader is looking for a provider. Say what the service involves and what it is worth checking when choosing one locally (the factors, not invented prices), what to ask, and end with a clear next step to contact the business.`;
    default:
      return lead;
  }
}

/** The article as plain text for a check: headings and list items marked, tags gone. */
export function articleText(html: string): string {
  const $ = load(html, null, false);
  // replaceWith reads a string as HTML: the words go back escaped, and .text() below decodes them.
  const words = (el: Parameters<typeof $>[0]) => $(el).text().trim().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  $("h2").each((_, el) => { $(el).replaceWith(`\n## ${words(el)}\n`); });
  $("h3").each((_, el) => { $(el).replaceWith(`\n### ${words(el)}\n`); });
  $("li").each((_, el) => { $(el).replaceWith(`\n- ${words(el)}`); });
  $("p, tr, blockquote").each((_, el) => { $(el).replaceWith(`\n${words(el)}\n`); });
  return $.root().text().replace(/\n{3,}/g, "\n\n").trim().slice(0, 60000);
}

/** Only an article written for a specific format is checked; a plain guide has nothing to deliver. */
export function needsFormatCheck(plan: FormatPlan | null | undefined, html: string): plan is FormatPlan {
  return Boolean(plan && plan.format !== "guide" && html.length <= 65000);
}

export type FormatReview = { delivers: boolean; items: number | null; problems: string[] };

export function parseFormatReview(text: string, plan: FormatPlan): FormatReview {
  const parsed = JSON.parse(text) as { delivers?: unknown; items?: unknown; problems?: unknown };
  const items = plan.format === "examples" && typeof parsed.items === "number" ? Math.max(0, Math.round(parsed.items)) : null;
  const problems = Array.isArray(parsed.problems)
    ? parsed.problems.filter((item): item is string => typeof item === "string" && item.trim() !== "").map((item) => item.trim().slice(0, 300)).slice(0, 5)
    : [];
  const short = plan.format === "examples" && items !== null && items < (plan.minItems ?? MIN_EXAMPLES);
  if (short) problems.push(`Only ${items} complete, ready-to-use examples; at least ${plan.minItems ?? MIN_EXAMPLES} are needed.`);
  return { delivers: parsed.delivers === true && !short, items, problems };
}


/**
 * Whether the saved text delivers its format, from the check, the single
 * correction and the check of that correction (outside review of
 * 2026-11-28: a correction that was never re-checked still shipped as
 * "Ready"). Held means the article waits for a person (the existing
 * research review hold), never that it is rewritten again.
 *
 * - No first verdict (no format, a plain guide, or the check unavailable):
 *   nothing is known, so nothing is held - the article is written as before.
 * - The first check passed: nothing to hold.
 * - The first check failed: held unless the corrected text was checked and
 *   passed. A correction that could not finish, or a re-check that could not
 *   run, leaves the last known verdict - a miss - standing.
 */
export function formatOutcome(
  first: FormatReview | null,
  corrected: boolean,
  recheck: FormatReview | null,
): { held: boolean; problems: string[] } {
  if (!first || first.delivers) return { held: false, problems: [] };
  if (corrected && recheck?.delivers) return { held: false, problems: [] };
  const problems = corrected && recheck ? recheck.problems : first.problems;
  return { held: true, problems: problems.length ? problems : ["The format check did not pass."] };
}

/** The hold's reason, as a warning the article's review panel shows (English, like the evidence checks' own). */
export function formatHoldWarning(plan: FormatPlan, problems: string[]): string {
  return `The article does not deliver its format (${plan.format.replace("_", " ")}) after one automatic correction: ${problems.join(" ")} Review before publishing.`;
}
