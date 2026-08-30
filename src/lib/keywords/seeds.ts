import { anthropic, isAiConfigured, MODELS } from "@/lib/ai/client";

/**
 * Turns a website profile into seed keywords.
 *
 * Seeds are only a starting point: DataForSEO expands them and replaces every
 * guessed number with a real one. What the model contributes is domain sense —
 * a dental clinic and a law firm need entirely different vocabulary, and the
 * profile already knows which one this is.
 *
 * Runs on Haiku: short, structured, and one call per website.
 */

export type SeedInput = {
  brandName: string | null;
  industry: string | null;
  country: string | null;
  language: string | null;
  description: string | null;
  targetAudience: string | null;
  services: string[];
};

const SCHEMA = {
  type: "object",
  properties: {
    keywords: {
      type: "array",
      items: {
        type: "object",
        properties: {
          term: {
            type: "string",
            description: "The search phrase, lowercase, as a person would type it.",
          },
          intent: {
            type: "string",
            enum: [
              "transactional",
              "commercial",
              "informational",
              "navigational",
            ],
          },
        },
        required: ["term", "intent"],
        additionalProperties: false,
      },
    },
  },
  required: ["keywords"],
  additionalProperties: false,
} as const;

const SYSTEM = `You produce seed keywords for SEO research from a business profile.

Rules:
- Write phrases real customers type, not marketing language or internal jargon.
- Include the location when the business serves a local market ("dentist dublin").
- Cover the full funnel, weighted toward people ready to buy:
  * transactional: ready to act ("book dentist dublin", "buy X online")
  * commercial: comparing before buying ("best X", "X cost", "X vs Y")
  * informational: researching a problem ("why does X hurt")
  * navigational: a specific brand by name
- Do NOT include the business's own brand name; it already ranks for that.
- No duplicates, and no near-duplicates that differ only by word order.
- Return 25-40 keywords in the site's own language.`;

export type SeedKeyword = {
  term: string;
  intent: "transactional" | "commercial" | "informational" | "navigational";
};

function buildPrompt(profile: SeedInput): string {
  return [
    profile.industry ? `Industry: ${profile.industry}` : null,
    profile.description ? `Business: ${profile.description}` : null,
    profile.services.length ? `Services: ${profile.services.join(", ")}` : null,
    profile.country ? `Primary market: ${profile.country}` : null,
    profile.language ? `Language: ${profile.language}` : null,
    profile.targetAudience ? `Target audience: ${profile.targetAudience}` : null,
    profile.brandName ? `Brand to exclude: ${profile.brandName}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function generateSeedKeywords(
  profile: SeedInput,
): Promise<SeedKeyword[]> {
  if (!isAiConfigured()) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  // Nothing useful can be produced from an empty profile, and a call would
  // still be billed. Onboarding analysis must run first.
  if (!profile.industry && !profile.description && profile.services.length === 0) {
    return [];
  }

  const response = await anthropic.messages.create({
    model: MODELS.EXTRACTION,
    max_tokens: 2000,
    system: SYSTEM,
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    messages: [{ role: "user", content: buildPrompt(profile) }],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("The model declined to generate keywords");
  }

  const block = response.content.find((item) => item.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("No content returned from keyword generation");
  }

  const parsed = JSON.parse(block.text) as { keywords?: unknown };
  if (!Array.isArray(parsed.keywords)) return [];

  // Case-insensitive de-duplication: the model occasionally returns the same
  // phrase capitalised differently, which would become two keyword rows.
  const seen = new Set<string>();
  const result: SeedKeyword[] = [];

  for (const item of parsed.keywords) {
    if (typeof item !== "object" || item === null) continue;
    const { term, intent } = item as Record<string, unknown>;
    if (typeof term !== "string") continue;

    const normalized = term.trim().toLowerCase().replace(/\s+/g, " ");
    if (!normalized || normalized.length > 120 || seen.has(normalized)) continue;
    seen.add(normalized);

    result.push({
      term: normalized,
      intent:
        intent === "transactional" ||
        intent === "commercial" ||
        intent === "informational" ||
        intent === "navigational"
          ? intent
          : "informational",
    });
    if (result.length >= 40) break;
  }

  return result;
}
