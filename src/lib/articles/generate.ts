import { anthropic, isAiConfigured, MODELS } from "@/lib/ai/client";
import { sanitizeHtml } from "@/lib/articles/sanitize";
import { styleHint } from "@/lib/websites/article-options";

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
  /** One comparison table of the options the article is about. */
  comparisonTable: boolean;

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
  sections: { heading: string; points: string[] }[];
  metaDescription: string;
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
          points: {
            type: "array",
            items: { type: "string" },
            description: "2-4 points this section must cover.",
          },
        },
        required: ["heading", "points"],
        additionalProperties: false,
      },
    },
  },
  required: ["metaDescription", "sections"],
  additionalProperties: false,
} as const;

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
    brief.language
      ? `Write everything in ${brief.language}. The headings, the body, and the meta description must all be in ${brief.language}, not translated from English but written natively.`
      : null,
    `Title: ${brief.title}`,
    `Target keyword: ${brief.targetKeyword}`,
    brief.intent ? `Search intent: ${brief.intent}` : null,
    brief.relatedKeywords.length
      ? `Related terms to cover: ${brief.relatedKeywords.join(", ")}`
      : null,
    brief.brandName ? `Published by: ${brief.brandName}` : null,
    brief.industry ? `Industry: ${brief.industry}` : null,
    brief.description ? `About the business: ${brief.description}` : null,
    brief.services.length ? `Services offered: ${brief.services.join(", ")}` : null,
    brief.targetAudience ? `Audience: ${brief.targetAudience}` : null,
    brief.country ? `Market: ${brief.country}` : null,
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
      ? `Where it genuinely helps the reader, mention well-known similar products, tools or alternatives by name, in general terms. Do not state features, prices, ratings or claims about them that are not common knowledge, do not invent products, and skip this entirely when nothing relevant exists.`
      : null,
    /*
      Stated both ways, like the perspective above: left unsaid, a model
      writes a table on some topics and not others.
    */
    brief.comparisonTable
      ? `Include exactly ONE comparison table, the way a good guide does ("Videography vs Cinematography at a Glance"). Compare the two or three options, approaches or types this topic is really about - what the reader is choosing between. Give it its own <h2> or <h3> heading in the form "<Option A> vs <Option B> at a Glance" and place it where that comparison is discussed, not at the very start or the very end. Structure: <table><thead><tr><th>Attribute</th><th>Option A</th><th>Option B</th></tr></thead><tbody>...</tbody></table>, with 5-8 rows, one per attribute (for example purpose, cost factors, time needed, best fit, main risk). Every cell is a short plain-text phrase: no links, lists or headings inside cells. Compare only what is common knowledge or follows from the article; no prices, statistics or claims you cannot support. If the topic has no natural "A vs B", compare the alternatives the reader is weighing (for example doing it themselves vs hiring a professional).`
      : `Do not use tables.`,
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
- 4-7 sections that each answer something different. Overlapping sections
  produce a repetitive article.
- Order them the way a reader needs them, not alphabetically or by keyword.
- Cover the target keyword's actual question first, not background context.
- Where search intent is transactional or commercial, include a practical
  section (costs, how to choose, what to ask) rather than only theory.
- Do NOT invent statistics, prices, dates, studies or quotes. If a point needs
  a specific figure the business has not supplied, phrase it so the writer
  describes the factors instead of stating a number. Verified facts given in
  the brief are the exception and may be used.
- The meta description must read as a sentence, not a list of keywords.`;

const BODY_SYSTEM = `You write the final SEO article body as HTML.

Output rules:
- HTML fragment only: <h2>, <h3>, <p>, <ul>, <ol>, <li>, <strong>, <em>, <a>.
- <table>, <thead>, <tbody>, <tr>, <th>, <td> only for a comparison table the
  brief asks for.
- NO <html>, <head>, <body>, <h1>, style attributes, classes or scripts. The
  title is rendered separately, so a second H1 would compete with it.
- 900-1,400 words unless instructed otherwise.

Link rules:
- Do NOT link to pages of the business's own website. Those links are added
  afterwards, only to pages checked to exist. Never guess one of its URLs.
- Only link to an address given in the brief (a required link, a social
  profile) or to a "#id" of a heading in this article.
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
- The ONLY exception is the verified facts listed in the brief. Those were
  supplied by the business owner, so you may state them directly. Everything
  not listed there is still off limits.
- No filler openings ("In today's fast-paced world"), no restating the title,
  no concluding summary that repeats the article back.
- Do not claim the business offers something not listed in its services.`;

export async function generateOutline(
  brief: ArticleBrief,
): Promise<ArticleOutline> {
  if (!isAiConfigured()) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const response = await anthropic.messages.create({
    model: MODELS.GENERATION,
    /**
     * Generous because a truncated response is unrecoverable: structured
     * output stops mid-JSON and JSON.parse throws on content that was
     * otherwise fine. 2000 was not enough for a 6-section outline.
     */
    max_tokens: 6000,
    system: OUTLINE_SYSTEM,
    output_config: { format: { type: "json_schema", schema: OUTLINE_SCHEMA } },
    messages: [{ role: "user", content: briefContext(brief) }],
  });

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

  let parsed: {
    sections?: unknown;
    metaDescription?: unknown;
  };
  try {
    parsed = JSON.parse(block.text);
  } catch {
    throw new Error("Outline was not valid JSON");
  }

  const sections = Array.isArray(parsed.sections)
    ? parsed.sections
        .filter(
          (section): section is { heading: string; points: string[] } =>
            typeof section === "object" &&
            section !== null &&
            typeof (section as { heading?: unknown }).heading === "string",
        )
        .map((section) => ({
          heading: section.heading.trim(),
          points: Array.isArray(section.points)
            ? section.points.filter(
                (point): point is string => typeof point === "string",
              )
            : [],
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
  };
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
): Promise<GeneratedArticle> {
  if (!isAiConfigured()) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const structure = outline.sections
    .map(
      (section) =>
        `## ${section.heading}\n${section.points.map((point) => `- ${point}`).join("\n")}`,
    )
    .join("\n\n");

  const response = await anthropic.messages.create({
    model: MODELS.GENERATION,
    max_tokens: 8000,
    system: BODY_SYSTEM,
    messages: [
      {
        role: "user",
        content: `${briefContext(brief)}\n\nFollow this structure:\n\n${structure}`,
      },
    ],
  });

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

  const bodyHtml = sanitizeHtml(block.text);
  if (!bodyHtml) {
    throw new Error("Generated article was empty");
  }

  return {
    bodyHtml,
    metaDescription: outline.metaDescription,
    slug: slugify(brief.title),
    wordCount: countWords(bodyHtml),
  };
}
