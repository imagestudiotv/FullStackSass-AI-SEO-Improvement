import "server-only";

import type Anthropic from "@anthropic-ai/sdk";
import * as cheerio from "cheerio";
import { and, asc, desc, eq, lte } from "drizzle-orm";

import { anthropic, MODELS } from "@/lib/ai/client";
import { keywordReport } from "@/lib/blog/keywords";
import { blogPath } from "@/lib/blog/locale";
import { blogSiteHosts, type BlogPostInput } from "@/lib/blog/post-fields";
import { blogSlug, TEAM_AUTHOR, type BlogFaq } from "@/lib/blog/shared";
import { db } from "@/lib/db";
import { blogCategories, blogPosts } from "@/lib/db/schema";
import type { Executor } from "@/lib/db/types";
import { siteUrl } from "@/lib/site-url";
import { TOOLS } from "@/lib/tools/registry";

import { checkLinks, pagePath, type LinkRules, type RemovedLink } from "./links";
import type { AutopilotClaim } from "./run";

/**
 * The blog autopilot's writer: one English article for RepGet's own blog, in
 * the blog's house style, with every field the editor has filled in (client,
 * 2026-10-16: "following exact style of writing we have, and options we use").
 *
 * The style is learnt from the blog itself: the two most recent long English
 * posts go to the model as examples, with the rules measured from the
 * published posts (very short paragraphs, 10-13 H2s with H3s, 3-5 tables in
 * the editor's own table markup, "Where RepGet fits" then "The bottom line",
 * about 3,500 words, a short answer and 6-8 FAQs).
 *
 * Written in several calls, each its own background step, so none runs into
 * the function time limit: a plan (every field, the sections, two picture
 * ideas, the FAQ questions), then the body in parts of at most four sections,
 * each part reading what came before it. The instructions and examples are
 * the same for every call and cached, so only the first call pays for them.
 *
 * Claude Opus 5.5 (MODELS.BLOG). Its thinking is always on; `effort` sets how
 * much. Answers come back as JSON in a fixed shape (output_config.format).
 */

/** Room for the model's thinking and the longest part. */
const MAX_TOKENS = 32_000;
/** The body is written in parts of at most this many sections. */
const SECTIONS_PER_PART = 4;
/** The body's length, as the blog's posts run. */
export const TARGET_WORDS = 3_400;
/** Long posts only are style examples. */
const EXAMPLE_MIN_WORDS = 2_000;
/** Published at $ per million tokens for Claude Opus 5.5; a 5-minute cache write is 1.25x input. */
const PRICE_PER_MTOK = { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 };

export type WriterContext = {
  /** "17 October 2026". */
  today: string;
  /** "https://www.repget.com". */
  origin: string;
  categories: { name: string; blurb: string }[];
  /** RepGet's own pages the article may link to. */
  pages: { url: string; title: string; about: string }[];
  /** Published English posts: links, and topics already covered. */
  posts: { url: string; title: string; keyword: string | null }[];
  examples: { title: string; shortAnswer: string; bodyHtml: string; faqs: BlogFaq[] }[];
};

export type PlannedSection = { heading: string; covers: string; subheadings: string[]; table: string; links: string[] };

/** A diagram for step 3 (pictures), kept with the run until then. */
export type PictureIdea = { afterSection: number; heading: string; idea: string; labels: string[]; alt: string };

export type ArticlePlan = {
  title: string;
  slug: string;
  seoTitle: string;
  description: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  category: string;
  shortAnswer: string;
  reader: string;
  opening: string;
  sections: PlannedSection[];
  pictures: PictureIdea[];
  faqQuestions: string[];
};

export type CallUsage = { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number; costUsd: number };

export type WrittenPart = { html: string; faqs: BlogFaq[]; usage: CallUsage };

/** Counts words in the text, not the markup. */
export function countWords(html: string): number {
  const text = html.replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/gi, " ").replace(/\s+/g, " ").trim();
  return text ? text.split(" ").length : 0;
}

const oneLine = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();
const strings = (value: unknown) => (Array.isArray(value) ? value.map(oneLine).filter(Boolean) : []);

/* ------------------------------------------------------------------ */
/* What the writer is given                                            */
/* ------------------------------------------------------------------ */

/**
 * The blog as it stood when the topic was taken (`asOf`): every step of one
 * run reads the same posts, so the cached instructions stay the same.
 */
export async function loadWriterContext(asOf: Date, executor: Executor = db): Promise<WriterContext> {
  const origin = siteUrl();
  const categories = await executor
    .select({ name: blogCategories.name, blurb: blogCategories.blurb })
    .from(blogCategories)
    .orderBy(asc(blogCategories.sortOrder), asc(blogCategories.name));
  const published = await executor
    .select({
      slug: blogPosts.slug,
      title: blogPosts.title,
      primaryKeyword: blogPosts.primaryKeyword,
      shortAnswer: blogPosts.shortAnswer,
      bodyHtml: blogPosts.bodyHtml,
      faqs: blogPosts.faqs,
    })
    .from(blogPosts)
    .where(and(eq(blogPosts.status, "published"), eq(blogPosts.locale, "en"), lte(blogPosts.publishedAt, asOf)))
    .orderBy(desc(blogPosts.publishedAt), asc(blogPosts.slug));

  const pages = [
    {
      url: `${origin}/audit`,
      title: "Free website audit",
      about: "Crawls a website and gives a 0-100 SEO score with the technical and content issues worth fixing. Free; no account or credit card.",
    },
    { url: `${origin}/tools`, title: "Free SEO tools", about: "All of RepGet's free checks in one place." },
    ...TOOLS.filter((tool) => tool.href !== "/audit").map((tool) => ({ url: `${origin}${tool.href}`, title: `${tool.title} (free tool)`, about: tool.blurb })),
  ];

  return {
    today: new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(asOf),
    origin,
    categories,
    pages,
    posts: published.map((post) => ({ url: `${origin}${blogPath("en", post.slug)}`, title: post.title, keyword: post.primaryKeyword })),
    examples: published
      .filter((post) => countWords(post.bodyHtml) >= EXAMPLE_MIN_WORDS)
      .slice(0, 2)
      .map((post) => ({ title: post.title, shortAnswer: post.shortAnswer ?? "", bodyHtml: post.bodyHtml, faqs: post.faqs })),
  };
}

/** The paths the article may link to on RepGet's own site. */
export function internalPaths(context: WriterContext): Set<string> {
  return new Set([...context.pages, ...context.posts].map((page) => pagePath(new URL(page.url).pathname)));
}

/** The instructions every call shares: who writes, the house style, what is true about RepGet, and the examples. */
export function writerInstructions(context: WriterContext): string {
  const tools = TOOLS.filter((tool) => tool.href !== "/audit").map((tool) => tool.title).join(", ");
  return [
    "You write articles for RepGet's own blog. RepGet is an AI SEO platform for small businesses. The blog's readers run a small business or look after its website; they are not SEO specialists. They come to understand a problem and leave knowing what to do on their own site.",
    "",
    `Today is ${context.today}. Each article is saved as a draft that RepGet's team reads before publishing, but write it as if it will be published as it is.`,
    "",
    "<house_style>",
    "The posts in <example_post> are published articles from this blog. Match them: their voice, rhythm, structure and formatting.",
    "",
    "Voice",
    '- Plain, calm, practical and honest. Talk to the reader as "you". Short sentences. Contractions (doesn\'t, it\'s, you\'ll).',
    "- Very short paragraphs: one to three sentences, often one. The examples have over 300 paragraphs each.",
    "- American spelling (optimize, prioritize, organization).",
    "- No dashes as punctuation: no em dashes, en dashes or spaced hyphens. Use a full stop, comma, colon or brackets.",
    '- No hype or filler ("unlock", "supercharge", "game-changer", "in today\'s digital landscape", "delve", "elevate", "seamless", "leverage").',
    "- Balanced: say when something is not a problem, when the answer depends on the situation, and what nobody can guarantee.",
    "",
    "Structure of the body",
    '- The opening has no heading. Start with a concrete, recognizable situation in a few very short paragraphs, name the real question, then lead into the article (for example "Here\'s how to ..."). Use the primary keyword naturally in the first 100 words.',
    "- 10 to 13 H2 sections, most with H3 subsections (15 to 28 H3s in all). A heading says what the section gives the reader.",
    '- Include a worked example (clearly illustrative: "imagine", "for example", "these URLs are illustrative"), a practical plan or checklist with a set time (a 20-minute check, a 30-day plan), and common mistakes where the topic has them.',
    "- 3 to 5 tables, where a comparison or checklist reads better as a table.",
    '- The second-to-last H2 is "Where RepGet fits" (it may go on, as in "Where RepGet fits into local SEO"): how RepGet can help with this topic, using only <repget_facts>, honest about what it does not do, with a link to the free website audit.',
    '- The last H2 is "The bottom line": the article\'s argument in a few short paragraphs, then an H3 call to action (such as "Find out what your website needs first") with one or two sentences that link to the free website audit and end "No account or credit card required."',
    `- About ${TARGET_WORDS.toLocaleString("en-US")} words in the body (3,200 to 3,700).`,
    "",
    "HTML (the blog's editor reads exactly this)",
    "- Paragraphs <p>. Headings <h2> and <h3>. <strong> for a key phrase now and then; <em> rarely; <code> for a path or a file name.",
    "- Lists: <ul><li><p>Item.</p></li></ul> (or <ol>). Every list item wraps its text in <p>.",
    "- Tables: <table><tbody><tr><th><p>Column</p></th>...</tr><tr><td><p>Cell</p></td>...</tr></tbody></table>. Every cell wraps its text in <p>. No <thead> or caption. An illustrative table can be followed by <p><em>These figures are illustrative.</em></p>.",
    '- Links: <a href="full address">words</a>, nothing else on the tag.',
    "- Never <h1>, <img>, <figure>, <div>, <span>, <br>, class or style attributes, or scripts. Pictures are added afterwards.",
    "</house_style>",
    "",
    "<accuracy>",
    "- Describe how Google, Bing and AI assistants work only as they document it themselves. Do not guess at what they have not said; when something changed recently, say what is documented and leave out the rest.",
    "- No statistics, percentages, studies, quotes, case studies or customer stories unless they come from the official documentation you link to. Examples are illustrative and say so.",
    "- No promises about rankings, traffic, AI-assistant mentions or results, from RepGet or anyone.",
    "</accuracy>",
    "",
    "<links>",
    "- Link to 3 to 6 of the pages in <repget_pages> and <blog_posts> where they genuinely help the reader, with the full address exactly as listed.",
    "- Link to official documentation (Google Search Central, Search Console Help, Google Business Profile Help, Bing Webmaster Guidelines, schema.org, MDN, web.dev, W3C, llmstxt.org, OpenAI's crawler documentation) where a claim rests on it: 1 to 4 links, only at addresses you are certain exist.",
    "- Every other link is removed before the article is saved, and so is any link whose page does not load. Never link to other blogs, SEO tools, agencies or competitors, and never name a competitor.",
    "</links>",
    "",
    "<repget_facts>",
    "Say nothing about RepGet beyond this:",
    "- RepGet is an AI SEO platform for small businesses. It brings website auditing, keyword research, content planning, article writing, publishing to the business's website, and search performance reporting from Google Search Console into one workflow.",
    `- Its free website audit (${context.origin}/audit) crawls the site, gives a 0-100 SEO score, and lists technical and content issues worth investigating. No account or credit card required.`,
    `- Its free SEO tools (${context.origin}/tools) each run one real check: ${tools}.`,
    "- Articles RepGet writes can stay as drafts for the business to review before they are published.",
    "- RepGet does not replace a Google Business Profile, Search Console or a person's judgment, and it does not guarantee rankings, Google Maps positions, traffic or mentions in AI answers.",
    "- Never invent RepGet features, prices, numbers, customers, integrations or results. Never name the data providers or AI models RepGet uses.",
    "</repget_facts>",
    "",
    "<categories>",
    ...context.categories.map((category) => `- ${category.name}${category.blurb ? `: ${category.blurb}` : ""}`),
    "</categories>",
    "",
    "<repget_pages>",
    ...context.pages.map((page) => `- ${page.url} - ${page.title}: ${page.about}`),
    "</repget_pages>",
    "",
    "<blog_posts>",
    ...context.posts.map((post) => `- ${post.url} - ${post.title}${post.keyword ? ` (targets "${post.keyword}")` : ""}`),
    "</blog_posts>",
    "",
    ...context.examples.flatMap((example, index) => [
      `<example_post number="${index + 1}">`,
      `<title>${example.title}</title>`,
      `<short_answer>${example.shortAnswer}</short_answer>`,
      `<body_html>${example.bodyHtml}</body_html>`,
      `<faqs_json>${JSON.stringify(example.faqs.map((faq) => ({ question: faq.question, answer: faq.answer })))}</faqs_json>`,
      "</example_post>",
      "",
    ]),
  ].join("\n");
}

/** The topic, as the administrator wrote it. Tags in it are neutralised so it cannot end its own block. */
function topicBlock(claim: Pick<AutopilotClaim, "topic" | "keyword" | "notes">): string {
  const lines = [`Topic: ${claim.topic}`];
  if (claim.keyword) lines.push(`Search phrase to target: ${claim.keyword}`);
  if (claim.notes) lines.push(`Notes from RepGet's team:\n${claim.notes}`);
  return `<topic>\n${lines.join("\n").replace(/<\/?\s*topic/gi, (match) => match.replace("<", "&lt;"))}\n</topic>`;
}

/* ------------------------------------------------------------------ */
/* The model                                                           */
/* ------------------------------------------------------------------ */

function priced(usage: Anthropic.Usage): CallUsage {
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  const costUsd =
    (usage.input_tokens * PRICE_PER_MTOK.input +
      usage.output_tokens * PRICE_PER_MTOK.output +
      cacheRead * PRICE_PER_MTOK.cacheRead +
      cacheWrite * PRICE_PER_MTOK.cacheWrite) /
    1_000_000;
  return { inputTokens: usage.input_tokens, outputTokens: usage.output_tokens, cacheReadTokens: cacheRead, cacheWriteTokens: cacheWrite, costUsd };
}

export function addUsage(usages: CallUsage[]): CallUsage & { calls: number } {
  const sum = (key: keyof CallUsage) => usages.reduce((total, usage) => total + usage[key], 0);
  return {
    calls: usages.length,
    inputTokens: sum("inputTokens"),
    outputTokens: sum("outputTokens"),
    cacheReadTokens: sum("cacheReadTokens"),
    cacheWriteTokens: sum("cacheWriteTokens"),
    costUsd: Math.round(sum("costUsd") * 10_000) / 10_000,
  };
}

/** One call: the shared instructions (cached), this call's request, and the JSON shape of the answer. */
async function ask(context: WriterContext, request: string, schema: Record<string, unknown>): Promise<{ value: Record<string, unknown>; usage: CallUsage }> {
  const message = await anthropic.messages
    .stream({
      model: MODELS.BLOG,
      max_tokens: MAX_TOKENS,
      system: [{ type: "text", text: writerInstructions(context), cache_control: { type: "ephemeral" } }],
      output_config: { effort: "high", format: { type: "json_schema", schema } },
      messages: [{ role: "user", content: request }],
    })
    .finalMessage();

  if (message.stop_reason === "refusal") throw new Error("The AI declined to write about this topic. Reword the topic, then try again.");
  if (message.stop_reason === "max_tokens") throw new Error("The AI ran out of room while writing. Try again.");
  const text = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("The AI's answer was not in the expected form. Try again.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("The AI's answer was not in the expected form. Try again.");
  return { value: value as Record<string, unknown>, usage: priced(message.usage) };
}

/* ------------------------------------------------------------------ */
/* 1. The plan                                                         */
/* ------------------------------------------------------------------ */

const STRING = { type: "string" } as const;
const STRINGS = { type: "array", items: { type: "string" } } as const;

function planSchema(categories: string[]): Record<string, unknown> {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      title: STRING,
      slug: STRING,
      seoTitle: STRING,
      description: STRING,
      primaryKeyword: STRING,
      secondaryKeywords: STRINGS,
      category: { type: "string", enum: categories },
      shortAnswer: STRING,
      reader: STRING,
      opening: STRING,
      sections: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: { heading: STRING, covers: STRING, subheadings: STRINGS, table: STRING, links: STRINGS },
          required: ["heading", "covers", "subheadings", "table", "links"],
        },
      },
      pictures: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: { afterSection: { type: "integer" }, idea: STRING, labels: STRINGS, alt: STRING },
          required: ["afterSection", "idea", "labels", "alt"],
        },
      },
      faqQuestions: STRINGS,
    },
    required: [
      "title",
      "slug",
      "seoTitle",
      "description",
      "primaryKeyword",
      "secondaryKeywords",
      "category",
      "shortAnswer",
      "reader",
      "opening",
      "sections",
      "pictures",
      "faqQuestions",
    ],
  };
}

const PLAN_REQUEST = [
  "Plan an article for RepGet's blog on the topic in <topic>. The plan is the brief the article is then written from, part by part, so make every field specific to this topic.",
  "",
  '- title: the headline, 50 to 70 characters, with the primary keyword at or near the start. The examples\' pattern works well: "<Primary keyword>: <what the reader gets>".',
  "- slug: the address, 2 to 5 lowercase words joined by hyphens, usually the primary keyword.",
  "- seoTitle: the title in search results, 45 to 60 characters, starting with or containing the primary keyword.",
  "- description: the meta description, 130 to 158 characters, containing the primary keyword and saying what the reader will learn.",
  "- primaryKeyword: the phrase a small-business owner would type into Google for this topic. Use the search phrase in <topic> when there is one. Not a phrase one of the <blog_posts> already targets.",
  "- secondaryKeywords: 3 to 6 related phrases people search with; none repeats the primary keyword.",
  "- category: the best fit from <categories>.",
  "- shortAnswer: plain text (no HTML), 330 to 430 characters: the direct answer to the article's main question in two to four sentences, as in the examples.",
  "- reader: in a sentence, who this is for and what they can do after reading.",
  "- opening: in a sentence or two, the concrete situation the article opens with.",
  '- sections: 10 to 13, in reading order. For each: heading (its H2), covers (what it says, specifically, in a sentence or two), subheadings (its H3s, 0 to 4), table (what its table compares and its columns, or empty), links (the full addresses it links to, from <repget_pages>, <blog_posts> or official documentation; may be empty). Include a worked example and a practical plan or checklist. The second-to-last is "Where RepGet fits" and the last is "The bottom line".',
  "- pictures: exactly 2 diagrams that make a point of the article easier to grasp at a glance (a flow, a decision tree, a checklist, a simple comparison). For each: afterSection (the number, from 1, of the section it illustrates, not one of the last two), idea (what it shows and how it is laid out, for an illustrator), labels (the 3 to 8 short texts that appear in it, a few words each), alt (alt text under 125 characters).",
  "- faqQuestions: 6 to 8 questions people search about this topic that the article answers, worded as they would type them, not repeating the section headings.",
  "",
  "If one of the <blog_posts> already covers this topic's main question, choose an angle that adds something new and link to that post instead of repeating it.",
].join("\n");

/** Reads the plan, refusing one that cannot be written from; what is only off-target becomes a warning. */
export function readPlan(value: Record<string, unknown>, context: WriterContext): { plan: ArticlePlan; warnings: string[] } {
  const warnings: string[] = [];
  const title = oneLine(value.title);
  if (title.length < 20 || title.length > 120) throw new Error("The plan's title is missing or too long. Try again.");
  const primaryKeyword = oneLine(value.primaryKeyword);
  const slug = blogSlug(oneLine(value.slug) || primaryKeyword || title).slice(0, 80).replace(/-+$/, "");
  if (!slug) throw new Error("The plan has no address for the article. Try again.");
  const category = oneLine(value.category);
  if (!context.categories.some((known) => known.name === category)) throw new Error(`The plan chose an unknown category ("${category}"). Try again.`);

  const sections: PlannedSection[] = (Array.isArray(value.sections) ? value.sections : [])
    .map((raw) => {
      const section = (raw ?? {}) as Record<string, unknown>;
      return {
        heading: oneLine(section.heading),
        covers: oneLine(section.covers),
        subheadings: strings(section.subheadings),
        table: oneLine(section.table),
        links: strings(section.links),
      };
    })
    .filter((section) => section.heading);
  if (sections.length < 6 || sections.length > 16) throw new Error(`The plan has ${sections.length} sections, not 10 to 13. Try again.`);

  const pictures: PictureIdea[] = (Array.isArray(value.pictures) ? value.pictures : [])
    .map((raw) => {
      const picture = (raw ?? {}) as Record<string, unknown>;
      const afterSection = Math.trunc(Number(picture.afterSection));
      return { afterSection, heading: sections[afterSection - 1]?.heading ?? "", idea: oneLine(picture.idea), labels: strings(picture.labels), alt: oneLine(picture.alt).slice(0, 200) };
    })
    .filter((picture) => picture.heading && picture.idea)
    .slice(0, 2);

  const description = oneLine(value.description);
  if (!description) throw new Error("The plan has no description. Try again.");
  const faqQuestions = strings(value.faqQuestions).slice(0, 10);
  if (faqQuestions.length < 4) throw new Error("The plan has too few FAQ questions. Try again.");

  const plan: ArticlePlan = {
    title,
    slug,
    seoTitle: oneLine(value.seoTitle),
    description,
    primaryKeyword,
    secondaryKeywords: strings(value.secondaryKeywords).slice(0, 8),
    category,
    shortAnswer: oneLine(value.shortAnswer),
    reader: oneLine(value.reader),
    opening: oneLine(value.opening),
    sections,
    pictures,
    faqQuestions,
  };

  if (plan.seoTitle.length > 60) warnings.push(`The search title is ${plan.seoTitle.length} characters; search results show about 60.`);
  if (plan.description.length < 120 || plan.description.length > 158) warnings.push(`The description is ${plan.description.length} characters; 120 to 158 shows best in search results.`);
  if (!plan.shortAnswer) warnings.push("The short answer is empty.");
  if (pictures.length < 2) warnings.push(`The plan has ${pictures.length} of its 2 picture ideas.`);
  const last = sections.at(-1)?.heading.toLowerCase() ?? "";
  if (!last.startsWith("the bottom line")) warnings.push('The last section is not "The bottom line".');
  if (!sections.some((section) => section.heading.toLowerCase().startsWith("where repget fits"))) warnings.push('There is no "Where RepGet fits" section.');
  const taken = context.posts.find((post) => post.keyword && primaryKeyword && post.keyword.toLowerCase() === primaryKeyword.toLowerCase());
  if (taken) warnings.push(`"${taken.title}" already targets the keyword "${primaryKeyword}".`);
  return { plan, warnings };
}

export async function planArticle(
  claim: Pick<AutopilotClaim, "topic" | "keyword" | "notes">,
  context: WriterContext,
): Promise<{ plan: ArticlePlan; warnings: string[]; usage: CallUsage }> {
  if (context.categories.length === 0) throw new Error("The blog has no categories. Add one in Admin > Blog > Categories, then try again.");
  const { value, usage } = await ask(context, `${topicBlock(claim)}\n\n${PLAN_REQUEST}`, planSchema(context.categories.map((category) => category.name)));
  return { ...readPlan(value, context), usage };
}

/* ------------------------------------------------------------------ */
/* 2. The body, part by part                                           */
/* ------------------------------------------------------------------ */

/** The sections each part writes: as even as possible, at most SECTIONS_PER_PART each. */
export function bodyParts(sections: number): { from: number; to: number }[] {
  const count = Math.max(1, Math.ceil(sections / SECTIONS_PER_PART));
  const parts: { from: number; to: number }[] = [];
  let from = 0;
  for (let index = 0; index < count; index += 1) {
    const size = Math.ceil((sections - from) / (count - index));
    parts.push({ from, to: from + size });
    from += size;
  }
  return parts;
}

const PART_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: { bodyHtml: STRING },
  required: ["bodyHtml"],
};

const LAST_PART_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    bodyHtml: STRING,
    faqs: {
      type: "array",
      items: { type: "object", additionalProperties: false, properties: { question: STRING, answer: STRING }, required: ["question", "answer"] },
    },
  },
  required: ["bodyHtml", "faqs"],
};

function partRequest(plan: ArticlePlan, index: number): string {
  const parts = bodyParts(plan.sections.length);
  const { from, to } = parts[index];
  const first = index === 0;
  const last = index === parts.length - 1;
  const words = Math.round((TARGET_WORDS * (to - from)) / plan.sections.length / 50) * 50;
  const headings = plan.sections.slice(from, to).map((section, offset) => `${from + offset + 1}. ${section.heading}`);
  return [
    `Write part ${index + 1} of ${parts.length} of the article's body, following the plan in <plan_json>.`,
    "",
    first
      ? "Begin with the opening: no heading, the situation the plan describes, in a few very short paragraphs, leading into the article. Then write these sections:"
      : "These sections:",
    ...headings,
    "",
    "Use each H2 heading exactly as the plan gives it, with its H3 subheadings (an H3's wording may change where it reads better), its table if it has one, and its links.",
    first ? "" : "What is already written is in <written_so_far>. Continue from it in the same voice, without repeating its points or examples, and without restating the opening.",
    last
      ? 'This is the last part: it ends with "The bottom line" and its H3 call to action. Then answer the plan\'s faqQuestions in faqs, in the same order: each answer is one <p> of two or three sentences (about 200 to 300 characters) that answers the question directly. A question may be reworded slightly to read naturally.'
      : `Stop at the end of section ${to}; the next part continues from there.`,
    `About ${words.toLocaleString("en-US")} words for this part. Return the HTML in bodyHtml.`,
  ]
    .filter((line, position, all) => line !== "" || all[position - 1] !== "")
    .join("\n");
}

/** Strips what the article must not contain (pictures come in step 3; the page prints the title). */
function tidyPart(html: string): string {
  const $ = cheerio.load(html, null, false);
  $("h1, img, figure, picture, script, style").remove();
  return $.html().trim();
}

export async function writePart(
  claim: Pick<AutopilotClaim, "topic" | "keyword" | "notes">,
  context: WriterContext,
  plan: ArticlePlan,
  index: number,
  written: string[],
): Promise<WrittenPart> {
  const parts = bodyParts(plan.sections.length);
  if (index < 0 || index >= parts.length) throw new Error(`There is no part ${index + 1}`);
  const last = index === parts.length - 1;
  const request = [
    topicBlock(claim),
    `<plan_json>\n${JSON.stringify(plan)}\n</plan_json>`,
    written.length ? `<written_so_far>\n${written.join("\n")}\n</written_so_far>` : "",
    partRequest(plan, index),
  ]
    .filter(Boolean)
    .join("\n\n");
  const { value, usage } = await ask(context, request, last ? LAST_PART_SCHEMA : PART_SCHEMA);

  const html = tidyPart(String(value.bodyHtml ?? ""));
  const expected = parts[index].to - parts[index].from;
  const h2 = (html.match(/<h2[\s>]/gi) ?? []).length;
  if (h2 !== expected) throw new Error(`Part ${index + 1} has ${h2} of its ${expected} sections. Try again.`);

  const faqs: BlogFaq[] = [];
  if (last) {
    for (const raw of Array.isArray(value.faqs) ? value.faqs : []) {
      const faq = (raw ?? {}) as Record<string, unknown>;
      const question = oneLine(faq.question);
      const answer = String(faq.answer ?? "").trim();
      if (!question || !answer) continue;
      // An answer is HTML, as the editor stores it.
      faqs.push({ question, answer: answer.startsWith("<") ? answer : `<p>${answer.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>` });
    }
    if (faqs.length < 4) throw new Error("The FAQ answers are missing. Try again.");
  }
  return { html, faqs, usage };
}

/* ------------------------------------------------------------------ */
/* 3. The draft                                                        */
/* ------------------------------------------------------------------ */

export type DraftReport = {
  words: number;
  sections: number;
  subheadings: number;
  tables: number;
  links: { internal: number; external: number; removed: RemovedLink[] };
  /** Where the primary keyword is missing (the editor's keyword check). */
  keywordMissing: string[];
  warnings: string[];
  pictures: PictureIdea[];
};

/**
 * Joins the parts, checks every link, and fills in the post's fields. What
 * falls short of the house style is reported, not refused: the draft is read
 * by a person before it is published.
 */
export async function finishDraft(
  context: WriterContext,
  plan: ArticlePlan,
  parts: Pick<WrittenPart, "html" | "faqs">[],
  planWarnings: string[] = [],
  pageAnswers?: LinkRules["pageAnswers"],
): Promise<{ draft: BlogPostInput; report: DraftReport }> {
  const faqs = parts.at(-1)?.faqs ?? [];
  const checked = await checkLinks([parts.map((part) => part.html).join("\n"), ...faqs.map((faq) => faq.answer)], {
    siteOrigin: context.origin,
    siteHosts: blogSiteHosts(),
    internalPaths: internalPaths(context),
    pageAnswers,
  });
  const [bodyHtml, ...answers] = checked.html;
  const checkedFaqs = faqs.map((faq, index) => ({ question: faq.question, answer: answers[index] }));

  const draft: BlogPostInput = {
    title: plan.title,
    slug: plan.slug,
    description: plan.description,
    seoTitle: plan.seoTitle,
    primaryKeyword: plan.primaryKeyword,
    secondaryKeywords: plan.secondaryKeywords,
    // The blog's posts carry their title as the breadcrumb's last step.
    breadcrumbLabel: plan.title.length <= 100 ? plan.title : "",
    category: plan.category,
    author: TEAM_AUTHOR,
    shortAnswer: plan.shortAnswer,
    bodyHtml,
    faqs: checkedFaqs,
    sources: [],
    locale: "en",
  };

  const words = countWords(bodyHtml);
  const count = (pattern: RegExp) => (bodyHtml.match(pattern) ?? []).length;
  const warnings = [...planWarnings];
  if (words < 2_800) warnings.push(`The article is ${words.toLocaleString("en-US")} words; the blog's posts run 3,200 to 3,700.`);
  const tables = count(/<table[\s>]/gi);
  if (tables < 3) warnings.push(`The article has ${tables} table${tables === 1 ? "" : "s"}; the blog's posts have 3 to 5.`);
  const dashes = (bodyHtml.replace(/<[^>]+>/g, " ").match(/[–—]| - /g) ?? []).length;
  if (dashes > 0) warnings.push(`The article uses ${dashes} dash${dashes === 1 ? "" : "es"} as punctuation; the blog's posts use none.`);
  if (checked.removed.length > 0) warnings.push(`${checked.removed.length} link${checked.removed.length === 1 ? " was" : "s were"} removed (see the links).`);
  if (checkedFaqs.length < 6) warnings.push(`The article has ${checkedFaqs.length} FAQs; the blog's posts have 6 to 8.`);

  const keywords = keywordReport({ ...draft, shortAnswer: draft.shortAnswer, faqs: checkedFaqs });
  return {
    draft,
    report: {
      words,
      sections: count(/<h2[\s>]/gi),
      subheadings: count(/<h3[\s>]/gi),
      tables,
      links: { ...checked.kept, removed: checked.removed },
      keywordMissing: keywords.primary.filter((place) => !place.found).map((place) => place.label),
      warnings,
      pictures: plan.pictures,
    },
  };
}
