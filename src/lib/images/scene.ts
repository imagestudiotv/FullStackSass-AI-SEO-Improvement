import { anthropic, isAiConfigured, MODELS } from "@/lib/ai/client";

/**
 * What the header image should SHOW, read from the article itself.
 *
 * The image prompt used to be the title and the business's industry - "An
 * image illustrating 'Wedding Photo Booth Rentals: What to Know Before You
 * Book' for a film and photography business" - so the picture matched the
 * headline's words at best and the article's actual subject by luck. The
 * client's requirement is that the image matches the content.
 *
 * So a small model reads the title, the section headings and the opening, and
 * writes one concrete photograph: what is in the frame, where, what is
 * happening. That scene is the image prompt, and a plain description of it is
 * the alt text - which also serves screen readers and search better than
 * repeating the title.
 *
 * Returns null on any failure: the caller falls back to the title-based
 * prompt, because an image a little less specific beats no image.
 */

export type ArticleScene = {
  /** The photograph to generate, 1-3 sentences. */
  scene: string;
  /** Alt text: what the picture shows, for someone who cannot see it. */
  alt: string;
};

const SCHEMA = {
  type: "object",
  properties: {
    scene: {
      type: "string",
      description:
        "One realistic photograph illustrating the article's actual subject: subject, setting, action, composition, light. 1-3 sentences, under 70 words.",
    },
    alt: {
      type: "string",
      description:
        "Plain description of that photograph for alt text, under 125 characters.",
    },
  },
  required: ["scene", "alt"],
  additionalProperties: false,
} as const;

const SYSTEM = `You choose the header photograph for a blog article.

Describe ONE realistic photograph that a reader would expect above THIS
article - its specific subject, not the business in general and not a generic
stock image. If the article is about a thing, show that thing in use; if it is
about a place, show that place; if it is a comparison or a how-to, show the
situation the reader is in.

Rules:
- Concrete and visual: who or what is in the frame, the setting, the action,
  the composition and the light. No abstract ideas, no metaphors.
- Nothing with readable text: no signs, captions, screens, documents or logos.
- No real, identifiable people, brands or products by name.
- No charts, diagrams, collages or split images.
- Match the country or region the article is about when it names one.`;

/** Headings and the opening paragraphs: what the article is about. */
function outlineOf(html: string): string {
  const text = (s: string) =>
    s
      .replace(/<[^>]+>/g, " ")
      .replace(/&[a-z#0-9]+;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  const headings = [...html.matchAll(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi)]
    .map((m) => text(m[1]))
    .filter(Boolean)
    .slice(0, 10);
  const paragraphs = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => text(m[1]))
    .filter(Boolean)
    .slice(0, 3)
    .join(" ")
    .slice(0, 1500);
  return [
    headings.length ? `Sections:\n- ${headings.join("\n- ")}` : null,
    paragraphs ? `Opening:\n${paragraphs}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export async function describeArticleScene(article: {
  title: string;
  targetKeyword?: string | null;
  industry?: string | null;
  country?: string | null;
  bodyHtml: string | null;
}): Promise<ArticleScene | null> {
  if (!isAiConfigured()) return null;

  const content = [
    `Title: ${article.title}`,
    article.targetKeyword ? `Topic: ${article.targetKeyword}` : null,
    article.industry ? `Written for a business in: ${article.industry}` : null,
    article.country ? `Business country: ${article.country}` : null,
    article.bodyHtml ? outlineOf(article.bodyHtml) : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const response = await anthropic.messages.create({
      model: MODELS.EXTRACTION,
      max_tokens: 600,
      system: SYSTEM,
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
      messages: [{ role: "user", content }],
    });
    const block = response.content.find((item) => item.type === "text");
    if (!block || block.type !== "text" || response.stop_reason !== "end_turn") {
      return null;
    }
    const parsed = JSON.parse(block.text) as Partial<ArticleScene>;
    if (typeof parsed.scene !== "string" || !parsed.scene.trim()) return null;
    return {
      scene: parsed.scene.trim().slice(0, 600),
      alt: (typeof parsed.alt === "string" && parsed.alt.trim()
        ? parsed.alt
        : article.title
      )
        .trim()
        .slice(0, 150),
    };
  } catch {
    return null;
  }
}
