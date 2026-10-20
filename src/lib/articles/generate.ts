import { anthropic, isAiConfigured } from "@/lib/ai/client";
import { articleTask, measuredRequest, type MeasureAi } from "@/lib/ai/article-tasks";
import type { ResearchBrief } from "./research-types";
import { dataBlock, dataRule } from "@/lib/ai/untrusted";
import { sanitizeHtml } from "@/lib/articles/sanitize";
import { styleHint } from "@/lib/websites/article-options";
import { isSupportedLanguage } from "@/lib/websites/languages";
import { RESEARCH_BODY_SYSTEM, RESEARCH_OUTLINE_SYSTEM, writingEvidence } from "./writing-evidence";
import { load } from "cheerio";

/**
 * Article generation.
 *
 * This output IS the product: it is what the customer pays for and what gets
 * published under their name. Runs on Sonnet rather than Haiku — at roughly
 * $0.08 per article that is under 3% of revenue on every plan, so trading
 * article quality for model cost would be a bad trade.
 *
 * Generated in two passes (outline, then body) rather than one. A single
 * "write me an article" call drifts off the brief and repeats itself around the
 * 1,000-word mark; committing to a structure first keeps the sections distinct
 * and on topic.
 */

export type ArticleBrief = {
  research?: ResearchBrief | null;
  title: string;
  targetKeyword: string;
  intent: string | null;
  /** Related terms from the keyword cluster, worked in naturally. */
  relatedKeywords: string[];
  brandName: string | null;
  industry: string | null;
  country: string | null;
  language: string | null;
  description: string | null;
  targetAudience: string | null;
  services: string[];
  /** Free-text steer from the user on this specific article. */
  customInstructions: string | null;
  /** A standing rule for every article on this website. */
  articleInstructions: string | null;
  /** Brand voice, when the site has one configured. */
  tone: string | null;
  avoid: string | null;
  /** Preferred wording, e.g. "we say treatment, not procedure". */
  vocabulary: string | null;
  /** What makes this business different from its competitors. */
  usps: string[];
  /**
   * Verified facts the owner supplied — founding year, staff, opening hours.
   *
   * The prompt forbids inventing facts, which leaves articles vague about the
   * business itself. These are the only specifics the model is allowed to
   * state, because a human confirmed them.
   */
  facts: string[];
  /** Social profiles to mention where it reads naturally. */
  socialLinks: { platform: string; url: string }[];
  /**
   * A backlink this article must include, when one has been matched. The link
   * has to read as a natural citation, not an obvious paid placement — an
   * article that visibly exists to carry a link helps nobody's rankings.
   */
  backlink: { url: string; anchor: string | null } | null;

  /* --- Article settings, chosen on the settings screen --------------- */

  /**
   * Editorial register: "expert", "conversational", "friendly",
   * "journalistic". See lib/websites/article-options.ts, which is the single
   * list the form renders and this prompt reads — so a style cannot appear
   * in the dropdown that the writer has never heard of.
   */
  articleStyle: string | null;
  /**
   * Words to aim for, or null to let the model choose per article type.
   *
   * Null is meaningfully different from a number here: a fixed length across
   * a how-to, a comparison and a news piece makes two of the three the wrong
   * size, which is why "Adaptive" is the default rather than a round figure.
   */
  targetWordCount: number | null;
  /**
   * The most automatic internal links to add after writing (0 for none).
   * Deliberately NOT given to the writer - see briefContext.
   */
  internalLinkTarget: number | null;
  /** Adds a contents list built from the headings. */
  tableOfContents: boolean;
  /** Writes in the first person, as somebody with a view. */
  authorPerspective: boolean;
  /** References comparable products and tools where relevant. */
  mentionSimilarProducts: boolean;
  /** Comparison tables of the options the article is about. */
  comparisonTable: boolean;
  /**
   * How many, 1-3, when comparisonTable is on - chosen per article in code
   * (lib/articles/article-shape.ts tableCount). Absent means one, as before.
   */
  tableCount?: number;
  /**
   * A "Frequently asked questions" section at the end (client, 2026-10-13).
   * Absent means none, as before.
   */
  faqSection?: boolean;

  /**
   * Image settings, carried on the brief so the image call has them.
   *
   * They do not appear in briefContext - the writer has no use for them -
   * but the image step runs from the same brief, and threading them here
   * avoids a second query for a row already loaded.
   */
  imageStyle: string | null;
  imageBrief: string | null;
  imageInstructions: string | null;
};

export type ArticleOutline = {
  /** H2 sections; subheadings become the section's H3s (none for a one-idea section). */
  sections: { heading: string; subheadings: string[]; points: string[] }[];
  metaDescription: string;
  /** The FAQ's questions, in the reader's words; empty when the brief asks for no FAQ. */
  faq: string[];
};

export type GeneratedArticle = {
  bodyHtml: string;
  metaDescription: string;
  slug: string;
  wordCount: number;
};

const OUTLINE_SCHEMA = {
  type: "object",
  properties: {
    metaDescription: {
      type: "string",
      description:
        "Search result description, 140-158 characters, includes the target keyword, reads as a sentence not a summary.",
    },
    sections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          heading: {
            type: "string",
            description: "H2 heading. Specific, not a generic label.",
          },
          subheadings: {
            type: "array",
            items: { type: "string" },
            description:
              "0-4 H3 sub-headings for the distinct parts of this section (steps, options, criteria), each specific. Empty when the section is one idea.",
          },
          points: {
            type: "array",
            items: { type: "string" },
            description: "2-4 points this section must cover.",
          },
        },
        required: ["heading", "subheadings", "points"],
        additionalProperties: false,
      },
    },
    faq: {
      type: "array",
      items: { type: "string" },
      description:
        "When the brief asks for an FAQ: 4-6 questions a reader still has after the sections, in the reader's own words. Otherwise empty.",
    },
  },
  required: ["metaDescription", "sections", "faq"],
  additionalProperties: false,
} as const;

/**
 * True for a language we support, or a value shaped like a language name:
 * letters only (with spaces, hyphens, apostrophes or brackets), up to three
 * words and 30 characters - "Swedish", "Brazilian Portuguese", "Norwegian
 * Bokmål". A sentence, a link or a list of demands is not.
 */
export function isLanguageName(value: string | null): value is string {
  if (!value) return false;
  if (isSupportedLanguage(value)) return true;
  return /^\p{L}[\p{L}' ()-]{0,29}$/u.test(value) && value.trim().split(/\s+/).length <= 3;
}

/** The business profile lines, as one data block - or nothing when the profile is empty. */
function profileBlock(brief: ArticleBrief): string | null {
  const lines = [
    brief.brandName ? `Published by: ${brief.brandName}` : null,
    brief.industry ? `Industry: ${brief.industry}` : null,
    brief.description ? `About the business: ${brief.description}` : null,
    brief.services.length ? `Services offered: ${brief.services.join(", ")}` : null,
    brief.targetAudience ? `Audience: ${brief.targetAudience}` : null,
    brief.country ? `Market: ${brief.country}` : null,
    brief.language && !isLanguageName(brief.language) ? `Language: ${brief.language}` : null,
  ].filter(Boolean);
  return lines.length ? dataBlock("business_profile", lines.join("\n")) : null;
}

const TABLE_SHAPE = `Structure: <table><thead><tr><th>Attribute</th><th>Option A</th><th>Option B</th></tr></thead><tbody>...</tbody></table>, with 5-8 rows, one per attribute (for example purpose, cost factors, time needed, best fit, main risk). Every cell is a short plain-text phrase: no links, lists or headings inside cells. Compare only what is common knowledge or follows from the article; no prices, statistics or claims you cannot support.`;

/**
 * The comparison tables: none, one (the reference's "at a Glance" table), or
 * two or three - the count chosen per article in code (client, 2026-10-13:
 * "some time one some time 2, 3 maximum"; lib/articles/article-shape.ts).
 */
export function tablesInstruction(brief: ArticleBrief): string {
  if (!brief.comparisonTable) return `Do not use tables.`;
  const count = Math.max(1, Math.min(3, Math.trunc(brief.tableCount ?? 1)));
  if (brief.research?.status === "ready") {
    return `Include exactly ${count} comparison table(s), each in a different relevant section, not at the start or end. Use <table><thead><tr><th>...</th></tr></thead><tbody><tr><td>...</td></tr></tbody></table>. Only compare factual attributes established by the supplied quotations. When evidence about the alternatives is missing, use a comparison checklist with the same neutral question for both options, or explicitly hypothetical examples of two ways to do the requested task. Do not introduce a supplier or product comparison unrelated to the title just to fill a table. Do not invent capabilities, availability, costs, outcomes or risks to fill cells. Each table needs a specific H2 or H3 and 5-8 concise rows. No links, lists or headings inside cells.`;
  }
  if (count === 1) {
    return `Include exactly ONE comparison table, the way a good guide does ("Videography vs Cinematography at a Glance"). Compare the two or three options, approaches or types this topic is really about - what the reader is choosing between. Give it its own <h2> or <h3> heading in the form "<Option A> vs <Option B> at a Glance" and place it where that comparison is discussed, not at the very start or the very end. ${TABLE_SHAPE} If the topic has no natural "A vs B", compare the alternatives the reader is weighing (for example doing it themselves vs hiring a professional).`;
  }
  const word = count === 2 ? "TWO" : "THREE";
  return `Include exactly ${word} comparison tables, the way a good guide does ("Videography vs Cinematography at a Glance"). Each compares something DIFFERENT the article discusses - the options, approaches, types or choices the reader is weighing - never the same comparison twice. Give each its own <h2> or <h3> heading in the form "<Option A> vs <Option B> at a Glance", and place each where its comparison is discussed: spread through the article, never two tables in a row, not at the very start or the very end. ${TABLE_SHAPE} Where the topic has fewer natural comparisons, compare the alternatives the reader is weighing (for example doing it themselves vs hiring a professional, or a basic vs a complete approach).`;
}

export function briefContext(brief: ArticleBrief): string {
  return [
    /**
     * Language leads, as an instruction rather than a fact.
     *
     * It was previously eleventh in a list of sixteen context lines, phrased
     * as "Language: Spanish". A model mostly infers the right language from
     * the title and keyword anyway — but "mostly" is not good enough for the
     * one property a customer would notice instantly and could not fix
     * themselves. Stating it first, as a directive, removes the guess.
     */
    /*
      A directive only for something shaped like a language name. The value
      can come straight from the crawled homepage, so anything else - which
      could be a sentence of instructions - goes in the profile block
      instead (profileBlock), as material.
    */
    isLanguageName(brief.language)
      ? `Write everything in ${brief.language}. The headings, the body, and the meta description must all be in ${brief.language}, not translated from English but written natively.`
      : null,
    `Title: ${brief.title}`,
    `Target keyword: ${brief.targetKeyword}`,
    brief.intent ? `Search intent: ${brief.intent}` : null,
    brief.relatedKeywords.length
      ? `${brief.research?.status === "ready" ? "Optional related terms, only when relevant and supported" : "Related terms to cover"}: ${brief.relatedKeywords.join(", ")}`
      : null,
    /*
      Who the business is, as material rather than instructions (lib/ai/
      untrusted.ts): these were first filled from its crawled homepage, so a
      page that said "ignore your rules" could have left that in the
      description. The customer's own instructions stay outside, below -
      those ARE instructions.
    */
    profileBlock(brief),
    brief.research?.status === "ready"
      ? dataBlock("website_page", JSON.stringify(writingEvidence(brief.research)))
      : null,
    /*
      The chosen register, expanded into the instruction it stands for. The
      dropdown stores "expert"; the model needs to be told what that means,
      and the wording lives beside the option so the label and the behaviour
      cannot drift apart.
    */
    brief.articleStyle ? `Register: ${styleHint(brief.articleStyle)}` : null,
    brief.targetWordCount
      ? `Length: aim for about ${brief.targetWordCount} words.`
      : `Length: choose what suits this article type rather than padding to a target.`,
    /*
      No request for internal links. It used to ask for "about N internal
      links to other pages on this site" without naming a single page, so the
      writer invented them: "#" placeholders and paths the site never had.
      Internal links are now added after writing, only to pages verified to
      exist (lib/articles/internal-links.ts); internalLinkTarget is how many.
    */
    /*
      No contents-list instruction either: the contents list is built from
      the real headings after writing (lib/articles/toc.ts), so it can only
      ever link to sections that exist. Asked to write one, the model linked
      to ids that were never there.
    */
    /*
      Stated in both directions rather than only when on. "Write in the
      first person" and silence are not opposites to a model — left unsaid
      it picks whichever the topic suggests, so the customer who turned this
      OFF would still get a personal voice half the time.
    */
    brief.authorPerspective
      ? `Write with a point of view - first person, willing to recommend.`
      : `Stay impersonal. No first person, no personal anecdotes.`,
    brief.mentionSimilarProducts
      ? brief.research?.status === "ready"
        ? `Mention products or tools only where the supplied evidence cards support the exact description you will give. Do not introduce alternatives from memory, assume comparable capabilities, or add a software comparison just to name more products. Omit this option when the evidence does not support it.`
        : `Where it genuinely helps the reader, mention well-known similar products, tools or alternatives by name, in general terms. Do not state features, prices, ratings or claims about them that are not common knowledge, do not invent products, and skip this entirely when nothing relevant exists.`
      : null,
    /*
      Stated both ways, like the perspective above: left unsaid, a model
      writes a table on some topics and not others.
    */
    tablesInstruction(brief),
    /* Both ways too, for the same reason. */
    brief.faqSection
      ? `End the article with a frequently asked questions section: an <h2> heading meaning "Frequently asked questions", written in the article's language, then each question from the structure as an <h3> ending in a question mark, answered in one or two short <p> paragraphs. Answer each directly in its first sentence; do not repeat at length what a section already explains; no links and no lists in the answers.`
      : `Do not add a frequently asked questions section.`,
    brief.tone ? `Brand tone: ${brief.tone}` : null,
    brief.avoid ? `Avoid: ${brief.avoid}` : null,
    brief.vocabulary ? `Preferred wording: ${brief.vocabulary}` : null,
    brief.usps.length
      ? `What makes this business different: ${brief.usps.join("; ")}`
      : null,
    brief.facts.length
      ? `Verified facts about the business (these are confirmed and may be stated directly): ${brief.facts.join("; ")}`
      : null,
    brief.socialLinks.length
      ? `Social profiles, to mention once where it reads naturally: ${brief.socialLinks
          .map((link) => `${link.platform} ${link.url}`)
          .join(", ")}`
      : null,
    /**
     * The site-wide rule first, then the per-article one. Order matters: a
     * later line in the prompt wins a conflict, and "make this piece a
     * comparison" should be able to override a standing preference without
     * the customer editing their settings.
     */
    brief.articleInstructions
      ? `Standing instructions for every article on this website: ${brief.articleInstructions}`
      : null,
    brief.customInstructions
      ? `Specific instructions for this article: ${brief.customInstructions}`
      : null,
    brief.backlink
      ? `Include exactly one link to ${brief.backlink.url}${
          brief.backlink.anchor
            ? ` using wording close to "${brief.backlink.anchor}"`
            : ""
        }. Place it where a writer would naturally cite an outside source, in the body of a relevant section. Do not add a "resources" list for it, do not mention it twice, and do not describe the linked business beyond what the sentence needs.`
      : null,
  ]
    .filter(Boolean)
    .join("\n");
}

const OUTLINE_SYSTEM = `You plan the structure of an SEO article before it is written.

Rules:
- 5-8 sections that each answer something different. Overlapping sections
  produce a repetitive article.
- Give a section 2-4 sub-headings when it has distinct parts a reader scans
  for (steps, options, criteria, mistakes); leave a one-idea section without.
  Mix both: sub-headings everywhere read like a manual, none anywhere like a
  wall of text.
- If the brief asks for comparison tables, plan each one: add a point
  "Comparison table: <A> vs <B>" to the section that will hold it, each table
  in a different section and none in the first or last.
- If the brief asks for a frequently asked questions section, list 4-6
  questions a reader still has after the sections - real questions in the
  reader's words, not the headings rephrased. Otherwise leave the list empty.
- Order them the way a reader needs them, not alphabetically or by keyword.
- Cover the target keyword's actual question first, not background context.
- Where search intent is transactional or commercial, include a practical
  section (costs, how to choose, what to ask) rather than only theory.
- Do NOT invent statistics, prices, dates, studies or quotes. If a point needs
  a specific figure the business has not supplied, phrase it so the writer
  describes the factors instead of stating a number. Verified facts given in
  the brief and claims backed by the supplied research quotations are the
  exceptions and may be used. Plan around the research question and relevant
  subquestions. Do not treat an unrelated source or a paid backlink as evidence.
- Respect research warnings and source scope: a platform's own help page
  supports that platform's workflow, not a universal rule. Narrow sections
  to the supported platform or method when the sources cannot answer generally.
- The meta description must read as a sentence, not a list of keywords.
- ${dataRule("business_profile")}
- ${dataRule("website_page")}`;

const BODY_SYSTEM = `You write the final SEO article body as HTML.

Output rules:
- HTML fragment only: <h2>, <h3>, <p>, <ul>, <ol>, <li>, <strong>, <em>, <a>.
- <table>, <thead>, <tbody>, <tr>, <th>, <td> only for the comparison tables
  the brief asks for.
- NO <html>, <head>, <body>, <h1>, style attributes, classes or scripts. The
  title is rendered separately, so a second H1 would compete with it.
- 1,200-2,000 words, not counting a frequently asked questions section, unless
  instructed otherwise.

Structure rules:
- Follow the structure given: each "## " is an <h2>, each "### " under it an
  <h3> of that section, written as headings a reader would scan for.
- Vary the shape the way a good guide does: short paragraphs, a bulleted or
  numbered list where the reader benefits from scanning (steps, criteria,
  options) - roughly one list every two or three sections, not one in every
  section - and never a heading followed by one long block of text.

Link rules:
- Do NOT link to pages of the business's own website. Those links are added
  afterwards, only to pages checked to exist. Never guess one of its URLs.
- Only link to an address given in the brief (a required link, a social
  profile, or a research source) or to a "#id" of a heading in this article.
- Cite research sources next to the claims they support using their exact
  supplied URLs. Use only relevant evidence, paraphrase rather than copy,
  and never cite a source for something its excerpt does not establish.
- Never write a link without a real destination: no href="#", no empty or
  placeholder addresses. If there is nothing real to link to, write plain
  text.

Writing rules:
- Use the target keyword in the first paragraph, then only where it reads
  naturally. Keyword stuffing is penalised by search engines and by readers.
- Short paragraphs, two to four sentences. Plain words over jargon.
- Write for someone deciding what to do, not for a search engine.
- NEVER invent statistics, prices, dates, studies, quotes or customer names.
  Describe the factors that determine a price rather than stating one.
- Exceptions are the owner-confirmed facts and the claims supported by
  research quotations in the brief. Preserve qualifiers, dates and context.
  Research sources do not establish facts about this business unless stated.
- Preserve platform, method, country and time qualifications. Never turn
  Wix/Squarespace-specific setup advice into a universal Google requirement,
  or confuse ownership verification with crawling or indexing. If research
  warns of missing coverage, explain the limitation instead of filling it
  with unsupported steps. Match every citation to the scope of its source.
- No filler openings ("In today's fast-paced world"), no restating the title,
  no concluding summary that repeats the article back.
- Do not claim the business offers something not listed in its services.
- ${dataRule("business_profile")}
- ${dataRule("website_page")}`;

export async function generateOutline(
  brief: ArticleBrief,
  measure?: MeasureAi,
): Promise<ArticleOutline> {
  if (!isAiConfigured()) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const route = articleTask("outline", brief.research?.status === "ready");
  const response = await measuredRequest("outline", () => anthropic.messages.create({
    model: route.model,
    /**
     * Generous because a truncated response is unrecoverable: structured
     * output stops mid-JSON and JSON.parse throws on content that was
     * otherwise fine. 2000 was not enough for a 6-section outline.
     *
     * The same room as the body (16,000), not 6,000: Sonnet 5 thinks before
     * it answers whenever `thinking` is left out, and the thinking counts
     * against max_tokens. An outline is about 1,500 tokens, but on a
     * puzzling brief the thinking alone used up the rest and the outline was
     * cut off - "Outline was truncated before it finished" on Image Studio's
     * "image studios santa monica", 2026-10-16. The thinking stays: it is how
     * every outline so far was planned.
     */
    max_tokens: route.maxTokens,
    system: brief.research?.status === "ready"
      ? `${RESEARCH_OUTLINE_SYSTEM}\n${dataRule("business_profile")}\n${dataRule("website_page")}`
      : OUTLINE_SYSTEM,
    output_config: { format: { type: "json_schema", schema: OUTLINE_SCHEMA } },
    messages: [{ role: "user", content: briefContext(brief) }],
  }, { maxRetries: 0 }), measure, route.model);

  if (response.stop_reason === "refusal") {
    throw new Error("The model declined to plan this article");
  }
  // Reported plainly: the JSON is cut mid-structure, so a parse failure here
  // would otherwise surface as an unhelpful syntax error.
  if (response.stop_reason === "max_tokens") {
    throw new Error("Outline was truncated before it finished");
  }

  const block = response.content.find((item) => item.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("No outline returned");
  }

  return parseOutline(block.text, { faq: Boolean(brief.faqSection) });
}

/** Strings only, trimmed, no empties. */
const textList = (value: unknown, max: number): string[] =>
  Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, max)
    : [];

/**
 * The outline model's JSON, checked. Sub-headings and FAQ questions are
 * optional extras: a section without them is still a section, and an FAQ is
 * kept only when the brief asked for one.
 */
export function parseOutline(text: string, options: { faq: boolean }): ArticleOutline {
  let parsed: { sections?: unknown; metaDescription?: unknown; faq?: unknown };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Outline was not valid JSON");
  }

  const sections = Array.isArray(parsed.sections)
    ? parsed.sections
        .filter(
          (section): section is { heading: string; subheadings?: unknown; points?: unknown } =>
            typeof section === "object" &&
            section !== null &&
            typeof (section as { heading?: unknown }).heading === "string" &&
            Boolean((section as { heading: string }).heading.trim()),
        )
        .map((section) => ({
          heading: section.heading.trim(),
          subheadings: textList(section.subheadings, 4),
          points: textList(section.points, 8),
        }))
    : [];

  if (sections.length === 0) {
    throw new Error("Outline contained no sections");
  }

  return {
    sections,
    metaDescription:
      typeof parsed.metaDescription === "string"
        ? parsed.metaDescription.trim().slice(0, 200)
        : "",
    faq: options.faq ? textList(parsed.faq, 6) : [],
  };
}

/** The outline as the body writer reads it: "## " sections, "### " parts, points, then the FAQ. */
export function structureFor(outline: ArticleOutline): string {
  const sections = outline.sections.map((section) =>
    [
      `## ${section.heading}`,
      ...section.subheadings.map((sub) => `### ${sub}`),
      ...section.points.map((point) => `- ${point}`),
    ].join("\n"),
  );
  if (outline.faq.length > 0) {
    sections.push(["## Frequently asked questions (in the article's language)", ...outline.faq.map((q) => `- ${q}`)].join("\n"));
  }
  return sections.join("\n\n");
}

/** URL-safe slug from the title. */
export function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .normalize("NFKD")
      // Strip accents so "café" becomes "cafe" rather than losing the word.
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80)
      .replace(/-+$/, "") || "article"
  );
}

/**
 * A slug someone typed into an editor, tidied rather than rejected. A slug
 * is the article's address on the customer's site, and someone typing
 * "Wedding Films Italy!" means wedding-films-italy - refusing the input
 * would teach them a rule they should not need to know.
 *
 * Empty gives null: the CMS derives one from the title instead.
 */
export function normaliseSlug(input: string): string | null {
  const slug = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return slug || null;
}

/**
 * Counts words in rendered text, not markup.
 *
 * Counting the raw HTML would inflate the total with tag names and attributes,
 * and word count is shown to the customer as a quality signal.
 */
export function countWords(html: string): number {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text ? text.split(" ").length : 0;
}

/**
 * Re-exported so existing callers keep one import site while the
 * implementation lives in its own module. See sanitize.ts for why.
 */
export { sanitizeHtml };

export async function generateBody(
  brief: ArticleBrief,
  outline: ArticleOutline,
  measure?: MeasureAi,
): Promise<GeneratedArticle> {
  if (!isAiConfigured()) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const structure = structureFor(outline);

  const route = articleTask("body", brief.research?.status === "ready");
  const response = await measuredRequest("body", () => anthropic.messages.create({
    model: route.model,
    /*
      Room for 2,000 words with sub-headings, up to three tables and an FAQ:
      truncation is unrecoverable (it is refused below), and the unused
      allowance costs nothing.
    */
    max_tokens: route.maxTokens,
    system: brief.research?.status === "ready"
      ? `${RESEARCH_BODY_SYSTEM}\n${dataRule("business_profile")}\n${dataRule("website_page")}`
      : BODY_SYSTEM,
    ...(brief.research?.status === "ready" ? {
      output_config: { format: { type: "json_schema" as const, schema: {
        type: "object", properties: { bodyHtml: {
          type: "string", description: "The complete HTML article fragment with real <h2>, <p>, <a> and table tags. Never Markdown.",
        } }, required: ["bodyHtml"], additionalProperties: false,
      } } },
    } : {}),
    messages: [
      {
        role: "user",
        content: `${briefContext(brief)}\n\nFollow this structure:\n\n${structure}`,
      },
    ],
  }, { maxRetries: 0 }), measure, route.model);

  if (response.stop_reason === "refusal") {
    throw new Error("The model declined to write this article");
  }
  // A truncated body ends mid-sentence; saving it would publish a broken
  // article under the customer's name.
  if (response.stop_reason === "max_tokens") {
    throw new Error("Article was truncated before it finished");
  }

  const block = response.content.find((item) => item.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("No article body returned");
  }

  let body = block.text;
  if (brief.research?.status === "ready") {
    try {
      const parsed = JSON.parse(body) as { bodyHtml?: unknown };
      if (typeof parsed.bodyHtml !== "string") throw new Error("Missing HTML");
      body = parsed.bodyHtml;
    } catch {
      throw new Error("The researched article did not return a valid HTML response");
    }
  }
  const bodyHtml = sanitizeHtml(body);
  if (!bodyHtml) {
    throw new Error("Generated article was empty");
  }
  if (brief.research?.status === "ready") {
    const $ = load(bodyHtml, null, false);
    const looseText = $.root().contents().toArray().some(node => node.type === "text" && node.data.trim());
    if (!$("h2").length || !$("p").length || looseText) {
      throw new Error("The researched article must contain HTML headings and paragraphs, not Markdown or plain text");
    }
  }

  return {
    bodyHtml,
    metaDescription: outline.metaDescription,
    slug: slugify(brief.title),
    wordCount: countWords(bodyHtml),
  };
}
