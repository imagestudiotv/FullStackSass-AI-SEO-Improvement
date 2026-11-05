import "server-only";

import { load } from "cheerio";

import { MODELS } from "@/lib/ai/client";
import { dataBlock, dataRule } from "@/lib/ai/untrusted";
import { collectResearchSources } from "@/lib/articles/research";
import { researchPageContent } from "@/lib/articles/research-page";
import { assertPublicHttpUrl, safeFetch } from "@/lib/net/safe-fetch";
import { isDataForSeoConfigured } from "@/lib/providers/dataforseo";

import type { ComparisonBrief, ComparisonEntity } from "./comparison-brief";
import { askClaude, SpentError, type CallUsage } from "./model";

/**
 * Comparison articles in the blog autopilot (client, 2026-11-05). The same run
 * as any article - queue, plan, parts, pictures, translations, costs, retries,
 * schedule (inngest/functions/blog-autopilot.ts) - with three things added:
 *
 *  1. RESEARCH FIRST. Each thing compared gets its own sources before anything
 *     is paid to a model: the page the administrator named, then the search
 *     customer articles use (lib/articles/research.ts). Fewer than two things
 *     with any source means there is nothing to compare, and the run fails
 *     honestly, saying which, instead of writing from memory.
 *  2. A FACT SHEET. The plan picks the facts, each with a quotation from a
 *     source. A quotation that is not really in the page is thrown out, here,
 *     in code. The body is written from what survives, never from the pages or
 *     from what the model remembers. What could not be confirmed is listed, and
 *     the article says so rather than guessing.
 *  3. CHECKS AFTER. Code looks for the structure, for prices and percentages
 *     that are not in the facts and for claims of having tested anything, and a
 *     model call compares the draft with the facts. All of it goes on the run as
 *     things to check: a person reads every draft before it is published.
 *
 * The sources are kept with the run, for administrators (provenance): the
 * article's body has no links to them (lib/blog/autopilot/links.ts), and its
 * public "Sources" stay empty.
 */

/** Sources kept per thing compared, and how much of each goes to the model. */
const SOURCES_PER_ENTITY = 3;
const EXCERPT_CHARS = 6_000;
const MIN_READABLE_CHARS = 250;
/** The search's market: the blog's English readers, as the topic suggestions use. */
const MARKET = { country: "United States", language: "English" };

export type ComparisonSource = {
  id: string;
  entity: string;
  url: string;
  title: string;
  retrievedAt: string;
  excerpt: string;
};

export type ComparisonResearch = {
  checkedAt: string;
  entities: { name: string; status: "researched" | "missing"; notes: string[] }[];
  sources: ComparisonSource[];
  costUsd: number;
};

type FoundPage = { url: string; title: string; retrievedAt: string; excerpt: string };

/** The ways research reaches the outside; replaced in tests. */
export type ResearchDeps = {
  readPage?: (url: string, topic: string) => Promise<FoundPage | null>;
  search?: (entity: ComparisonEntity, topic: string, onCost: (cost: number | undefined) => Promise<void>) => Promise<FoundPage[]>;
  canSearch?: () => boolean;
};

/** One page the administrator named, through the SSRF-safe layer, as customer research reads a page. */
async function readPage(url: string, topic: string): Promise<FoundPage | null> {
  const response = await safeFetch(assertPublicHttpUrl(url).href, {
    timeoutMs: 20_000,
    maxBytes: 4_000_000,
    headers: { accept: "text/html", "accept-encoding": "gzip, br", "user-agent": "RepGetResearch/1.0" },
  });
  if (!response.ok || !response.headers.get("content-type")?.includes("text/html")) {
    await response.arrayBuffer().catch(() => undefined);
    return null;
  }
  const $ = load(await response.text());
  const title = $("title").first().text().trim().slice(0, 250) || url;
  const { excerpt } = researchPageContent($, title, topic);
  return excerpt.length < MIN_READABLE_CHARS ? null : { url: response.url || url, title, retrievedAt: new Date().toISOString(), excerpt };
}

function hostOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** The search and page reader customer articles use, for one thing compared. */
async function search(entity: ComparisonEntity, topic: string, onCost: (cost: number | undefined) => Promise<void>): Promise<FoundPage[]> {
  // It reads only these fields of the brief (lib/articles/research.ts); the rest describes a customer's business.
  const brief = { title: `${entity.name}: ${topic}`, targetKeyword: `${entity.name} features pricing`, ...MARKET } as Parameters<typeof collectResearchSources>[0];
  return collectResearchSources(brief, onCost, undefined, {
    primaryQuery: `"${entity.name}" features pricing`,
    primaryDomain: hostOf(entity.url),
    supportingQuery: `"${entity.name}" ${topic}`,
  });
}

/** A page that does not name the thing cannot be a source about it. */
const mentions = (text: string, name: string) => text.toLowerCase().includes(name.toLowerCase());

/** Finds sources for each thing compared. Never throws for a source it cannot read: it notes why. */
export async function researchComparison(topic: string, brief: ComparisonBrief, deps: ResearchDeps = {}): Promise<ComparisonResearch> {
  const read = deps.readPage ?? readPage;
  const find = deps.search ?? search;
  const searchable = (deps.canSearch ?? isDataForSeoConfigured)();
  let costUsd = 0;
  const onCost = async (cost: number | undefined) => {
    costUsd += cost ?? 0;
  };
  const sources: ComparisonSource[] = [];
  const entities: ComparisonResearch["entities"] = [];

  for (const entity of brief.entities) {
    const notes: string[] = [];
    const found: FoundPage[] = [];
    if (entity.url) {
      try {
        const page = await read(entity.url, topic);
        if (page) found.push(page);
        else notes.push(`The page given for it could not be read: ${entity.url}`);
      } catch {
        notes.push(`The page given for it could not be read: ${entity.url}`);
      }
    }
    if (!searchable) {
      notes.push("The search is not set up on this server, so only the page given for it was read.");
    } else {
      try {
        found.push(...(await find(entity, topic, onCost)));
      } catch (error) {
        notes.push(`The search failed: ${error instanceof Error ? error.message : "no answer"}`);
      }
    }
    const urls = new Set<string>();
    const usable = found.filter((page) => {
      if (urls.has(page.url) || sources.some((source) => source.url === page.url && source.entity === entity.name)) return false;
      urls.add(page.url);
      return mentions(`${page.title} ${page.excerpt}`, entity.name);
    });
    if (found.length > usable.length) notes.push(`${found.length - usable.length} page(s) found did not name it and were not used.`);
    for (const page of usable.slice(0, SOURCES_PER_ENTITY)) {
      sources.push({ id: `S${sources.length + 1}`, entity: entity.name, url: page.url, title: page.title, retrievedAt: page.retrievedAt, excerpt: page.excerpt.slice(0, EXCERPT_CHARS) });
    }
    const status = usable.length > 0 ? "researched" : "missing";
    entities.push({ name: entity.name, status, notes });
  }
  return { checkedAt: new Date().toISOString(), entities, sources, costUsd };
}

/** Why the article cannot be written from this research, or null when it can. */
export function researchShortfall(research: ComparisonResearch): string | null {
  const researched = research.entities.filter((entity) => entity.status === "researched");
  if (researched.length >= 2) return null;
  const missing = research.entities.filter((entity) => entity.status === "missing").map((entity) => entity.name);
  const why = research.entities.flatMap((entity) => entity.notes.slice(0, 1)).slice(0, 2).join(" ");
  return `No sources could be found for ${missing.join(", ")}, so nothing was written and nothing was invented. Give each an address it can be read at, then try again.${why ? ` ${why}` : ""}`;
}

/** What is kept with the run for administrators: where everything came from, without the pages' text. */
export function researchProvenance(research: ComparisonResearch) {
  return {
    checkedAt: research.checkedAt,
    entities: research.entities,
    sources: research.sources.map(({ id, entity, url, title, retrievedAt }) => ({ id, entity, url, title, retrievedAt })),
  };
}

/* ------------------------------------------------------------------ */
/* What the writer is told                                             */
/* ------------------------------------------------------------------ */

/** Added to the writer's instructions for a comparison. These win over the house style where they differ. */
export function comparisonRules(): string {
  return [
    "<comparison_rules>",
    "This article is an explicit comparison of the things named in <topic>. These rules win over anything above.",
    "- You may name the things being compared, and only those. Name no other competitor or product of that kind.",
    "- Every statement of fact about one of them (a feature, price, plan, limit, integration, policy, date) must come from the plan's comparison.facts. What you remember does not count, however sure you are.",
    "- Never say or imply that you, RepGet or anyone tested, tried, used, measured or reviewed them. No test results, ratings, scores, rankings, winners by number or personal experience.",
    "- Where the facts say nothing about one of them on a point, write that it could not be confirmed from the public sources checked (\"Not confirmed in the sources we checked\"), in the table too. Never guess, and never leave it looking like a real difference.",
    "- A price is quoted only as its source states it, and says it may have changed and to check the current price.",
    "- Do not put RepGet forward as the winner. \"Where RepGet fits\" stays honest and uses only <repget_facts>.",
    "- Do not link to any of them. Name the source in words where it helps.",
    `- ${dataRule("website_page")}`,
    "</comparison_rules>",
  ].join("\n");
}

/** The comparison's lines in the topic block. */
export function comparisonTopicLines(brief: ComparisonBrief): string[] {
  return [
    "Article type: comparison",
    `Compare: ${brief.entities.map((entity) => entity.name).join("; ")}`,
    ...(brief.criteria.length ? [`Compare them on: ${brief.criteria.join("; ")}`] : []),
    ...(brief.brief ? [`Brief from RepGet's team:\n${brief.brief}`] : []),
  ];
}

/** The research, as material: the plan reads it, and the body only reads the facts the plan took from it. */
export function researchBlock(research: ComparisonResearch): string {
  const missing = research.entities.filter((entity) => entity.status === "missing").map((entity) => entity.name);
  return [
    dataBlock("website_page", JSON.stringify(research.sources.map(({ id, entity, url, title, retrievedAt, excerpt }) => ({ id, about: entity, url, title, retrievedAt, excerpt })))),
    missing.length ? `No sources could be found for: ${missing.join(", ")}. Say nothing specific about them: list them in unverified, and say in the article that they could not be confirmed.` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export const COMPARISON_PLAN_REQUEST = [
  "",
  "This is a comparison article, so the plan also has:",
  "- criteria: 4 to 8 things the comparison is made on, those in <topic> first, each one a reader can act on (price, what it covers, who it suits...).",
  "- facts: everything the article will state about the things compared, taken only from the sources in <website_page>. For each: entity (exactly as named in <topic>), claim (the fact, in your words, stating what product and plan it is about), sourceId (the source's id), quote (the source's exact words that support it, copied character for character, 20 to 300 characters). No fact without a quotation. Facts about every thing compared, on every criterion the sources cover.",
  "- unverified: what the article's readers would expect but the sources do not settle (\"Moz: current price\"). The article says these could not be confirmed.",
  "",
  'The sections must include, in this order after the opening sections: "How we compared" (the criteria, and that it rests on public sources, with the date they were read), an at-a-glance table with one column per thing compared and one row per criterion, the key differences, the trade-offs of each (its H2 contains the word "trade-offs"), and who should choose which (its H2 starts "Which", with a recommendation for each kind of reader, never one winner for everybody). Then "Where RepGet fits" and "The bottom line".',
  "No worked example or plan with a set time is required here. Illustrative examples must not contain facts about the things compared.",
].join("\n");

const STRING = { type: "string" } as const;

export const COMPARISON_PLAN_PROPERTIES = {
  criteria: { type: "array", items: STRING },
  facts: {
    type: "array",
    items: {
      type: "object",
      additionalProperties: false,
      properties: { entity: STRING, claim: STRING, sourceId: STRING, quote: STRING },
      required: ["entity", "claim", "sourceId", "quote"],
    },
  },
  unverified: { type: "array", items: STRING },
} as const;

/* ------------------------------------------------------------------ */
/* The plan's facts                                                    */
/* ------------------------------------------------------------------ */

export type ComparisonFact = { entity: string; claim: string; sourceId: string; quote: string };

/** Goes into the plan, so every part of the body is written from it. */
export type PlannedComparison = { entities: string[]; criteria: string[]; facts: ComparisonFact[]; unverified: string[] };

const folded = (text: string) => text.normalize("NFKC").replace(/\p{Cf}/gu, "").replace(/\s+/g, " ").trim().toLowerCase();
const oneLine = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();

/**
 * The plan's facts, checked: only a quotation really in the page it names, about
 * a thing being compared, is kept. Fewer than two things with a fact left means
 * the sources do not support a comparison, and the plan is refused.
 */
export function readComparisonPlan(value: Record<string, unknown>, brief: ComparisonBrief, research: ComparisonResearch): { comparison: PlannedComparison; warnings: string[] } {
  const entities = brief.entities.map((entity) => entity.name);
  const named = new Map(entities.map((name) => [folded(name), name]));
  const pages = new Map(research.sources.map((source) => [source.id, folded(source.excerpt)]));
  const raw = Array.isArray(value.facts) ? value.facts : [];
  const facts: ComparisonFact[] = [];
  for (const item of raw) {
    const fact = (item ?? {}) as Record<string, unknown>;
    const entity = named.get(folded(oneLine(fact.entity)));
    const claim = oneLine(fact.claim);
    const sourceId = oneLine(fact.sourceId);
    const quote = oneLine(fact.quote);
    if (!entity || !claim || quote.length < 15) continue;
    if (!pages.get(sourceId)?.includes(folded(quote))) continue;
    facts.push({ entity, claim, sourceId, quote });
  }
  const withFacts = entities.filter((name) => facts.some((fact) => fact.entity === name));
  if (withFacts.length < 2) {
    throw new Error(`The sources do not support this comparison: only ${withFacts.length} of the ${entities.length} things have a fact their source really says. Nothing was invented. Give better addresses, then try again.`);
  }

  const without = entities.filter((name) => !withFacts.includes(name));
  const unverified = [
    ...without.map((name) => `${name}: nothing could be confirmed from the sources`),
    ...(Array.isArray(value.unverified) ? value.unverified.map(oneLine).filter(Boolean) : []),
  ];
  const warnings: string[] = [];
  if (facts.length < raw.length) warnings.push(`${raw.length - facts.length} of the plan's ${raw.length} facts were thrown out: their quotation is not in the source they name, or they are not about what is being compared.`);
  if (without.length > 0) warnings.push(`Nothing could be confirmed about ${without.join(", ")}; the article should say so. Check it does.`);
  for (const entity of research.entities) for (const note of entity.notes) warnings.push(`Research on ${entity.name}: ${note}`);

  const criteria = (Array.isArray(value.criteria) ? value.criteria.map(oneLine).filter(Boolean) : brief.criteria).slice(0, 10);
  return { comparison: { entities, criteria: criteria.length ? criteria : brief.criteria, facts, unverified }, warnings };
}

/* ------------------------------------------------------------------ */
/* The draft's checks                                                  */
/* ------------------------------------------------------------------ */

const FIGURES = /(?:[$€£]\s?\d[\d.,]*)|(?:\d[\d.,]*\s?(?:%|percent\b|usd\b|eur\b|gbp\b))/gi;
const EXPERIENCE = /\b(?:we|i)\s+(?:tested|tried|used|ran|measured|reviewed|benchmarked)\b|\bin\s+our\s+(?:test|tests|testing|experience|review)\b|\bhands-on\b|\bour\s+(?:test|tests|testing|benchmark|verdict|score|rating)\b/i;

/** What a comparison must have, and what it must not claim: reported on the run, for the person who reads the draft. */
export function comparisonChecks(html: string, faqAnswers: string[], comparison: PlannedComparison): string[] {
  const warnings: string[] = [];
  const $ = load(html, null, false);
  const everything = `${$.root().text()} ${faqAnswers.map((answer) => load(answer, null, false).root().text()).join(" ")}`;
  const lower = everything.toLowerCase();

  const absent = comparison.entities.filter((name) => !lower.includes(name.toLowerCase()));
  if (absent.length > 0) warnings.push(`The article never names ${absent.join(", ")}.`);

  const atAGlance = $("table")
    .toArray()
    .some((table) => {
      const header = $(table).find("tr").first().text().toLowerCase();
      return comparison.entities.filter((name) => header.includes(name.toLowerCase())).length >= Math.min(2, comparison.entities.length);
    });
  if (!atAGlance) warnings.push("No table has the things compared as its columns.");

  const headings = $("h2, h3").toArray().map((el) => $(el).text());
  if (!headings.some((heading) => /trade.?off/i.test(heading))) warnings.push("There is no section on the trade-offs.");
  if (!headings.some((heading) => /^(?:which|who\b)/i.test(heading.trim()) || /choos|recommend/i.test(heading))) warnings.push("There is no section saying who should choose which.");

  const known = folded(comparison.facts.map((fact) => `${fact.quote} ${fact.claim}`).join(" "));
  const figures = [...new Set(everything.match(FIGURES) ?? [])].filter((figure) => !known.includes(folded(figure)));
  if (figures.length > 0) warnings.push(`These figures are not in the research's facts, so check each one: ${figures.slice(0, 8).join(", ")}.`);
  const experience = EXPERIENCE.exec(everything);
  if (experience) warnings.push(`The article seems to claim experience nobody had: "${experience[0]}".`);
  if (comparison.unverified.length > 0) warnings.push(`Could not be confirmed from the sources: ${comparison.unverified.slice(0, 8).join("; ")}.`);
  return warnings;
}

const EVIDENCE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: { issues: { type: "array", items: STRING } },
  required: ["issues"],
};

/**
 * A second reading: is everything the draft says about the things compared in
 * the fact sheet? Returns what is not, for the run's list; it changes nothing.
 */
export async function checkComparisonEvidence(html: string, faqAnswers: string[], comparison: PlannedComparison): Promise<{ issues: string[]; usage: CallUsage }> {
  const $ = load(html, null, false);
  $("img, figure, picture").remove();
  const { value, usage } = await askClaude({
    system: [
      "You check a draft comparison article against its fact sheet. You do not rewrite it.",
      'Return JSON: {"issues": ["..."]}, one specific issue each, quoting the draft\'s words, in English. An empty list only when there are none.',
      "An issue is: a feature, price, plan, limit, date or policy of something compared that is not in the facts or goes beyond them; a claim that anyone tested or used it; a statement that one is better with no fact behind it; or a point the unverified list says could not be confirmed, stated as if it were.",
      "Not an issue: general advice, questions to ask, clearly illustrative examples, statements about RepGet, or saying something could not be confirmed.",
      dataRule("website_page"),
    ].join("\n"),
    request: `${dataBlock("site_data", JSON.stringify({ entities: comparison.entities, facts: comparison.facts, unverified: comparison.unverified }))}\n${dataBlock("website_page", JSON.stringify({ body: $.html(), faqAnswers }))}`,
    schema: EVIDENCE_SCHEMA,
    effort: "medium",
    model: MODELS.BLOG,
  });
  const issues = Array.isArray(value.issues) ? value.issues.map(oneLine).filter(Boolean).slice(0, 20) : null;
  if (!issues) throw new SpentError("The evidence check's answer was not in the expected form.", usage);
  return { issues, usage };
}
