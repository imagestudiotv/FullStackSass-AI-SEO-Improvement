import { anthropic, isAiConfigured, MODELS } from "@/lib/ai/client";

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
  /** Brand voice, when the site has one configured. */
  tone: string | null;
  avoid: string | null;
  /**
   * A backlink this article must include, when one has been matched. The link
   * has to read as a natural citation, not an obvious paid placement — an
   * article that visibly exists to carry a link helps nobody's rankings.
   */
  backlink: { url: string; anchor: string | null } | null;
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

function briefContext(brief: ArticleBrief): string {
  return [
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
    brief.language ? `Language: ${brief.language}` : null,
    brief.tone ? `Brand tone: ${brief.tone}` : null,
    brief.avoid ? `Avoid: ${brief.avoid}` : null,
    brief.customInstructions
      ? `Specific instructions: ${brief.customInstructions}`
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
  describes the factors instead of stating a number.
- The meta description must read as a sentence, not a list of keywords.`;

const BODY_SYSTEM = `You write the final SEO article body as HTML.

Output rules:
- HTML fragment only: <h2>, <h3>, <p>, <ul>, <ol>, <li>, <strong>, <em>, <a>.
- NO <html>, <head>, <body>, <h1>, style attributes, classes or scripts. The
  title is rendered separately, so a second H1 would compete with it.
- 900-1,400 words unless instructed otherwise.

Writing rules:
- Use the target keyword in the first paragraph, then only where it reads
  naturally. Keyword stuffing is penalised by search engines and by readers.
- Short paragraphs, two to four sentences. Plain words over jargon.
- Write for someone deciding what to do, not for a search engine.
- NEVER invent statistics, prices, dates, studies, quotes or customer names.
  Describe the factors that determine a price rather than stating one.
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
 * Removes anything the model should not have emitted.
 *
 * The prompt forbids these, but prompts are not a security boundary: this HTML
 * is published to a customer's live site, so scripts, event handlers and
 * document-level tags are stripped rather than trusted not to appear.
 */
export function sanitizeHtml(html: string): string {
  return html
    .replace(/<(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<\/?(html|head|body|!doctype)[^>]*>/gi, "")
    // A second H1 competes with the title for the page's main heading.
    .replace(/<h1[^>]*>/gi, "<h2>")
    .replace(/<\/h1>/gi, "</h2>")
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/```html\s*/gi, "")
    .replace(/```\s*$/g, "")
    .trim();
}

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
