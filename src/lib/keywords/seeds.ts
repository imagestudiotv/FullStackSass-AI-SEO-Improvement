import { anthropic, isAiConfigured, MODELS } from "@/lib/ai/client";
import { dataBlock, dataRule } from "@/lib/ai/untrusted";
import { variantOf } from "./variants";

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

/*
  No "weighted toward people ready to buy" any more (review of 2026-11-27): on
  a content site that steered every seed - and every label - to
  "transactional", and the plan away from what its readers search for. The
  mix now follows the site, and each label says what the searcher wants.
*/
const SYSTEM = `You produce seed keywords for SEO research from a website profile.

Rules:
- Write phrases real people type, not marketing language or internal jargon.
- Include the location when the business serves a local market ("dentist dublin").
- Fit the mix to the site:
  * a business that sells products or services: the whole funnel, from the
    questions its customers research to the searches of people ready to buy;
  * a blog, magazine, news or content site that lives from its readers: mostly
    the questions, ideas and things to read or use that its readers search
    for, with commercial terms only where the site reviews or compares.
- Label each phrase with what the PERSON SEARCHING wants, never with what would
  suit the site:
  * transactional: about to act ("book dentist dublin", "buy X online")
  * commercial: comparing before buying ("best X", "X cost", "X vs Y")
  * informational: wants to know or to get something to read or use ("why
    does X hurt", "birthday wishes for a colleague", "X ideas", "how to X")
  * navigational: a specific brand by name
- Do NOT include the business's own brand name; it already ranks for that.
- No duplicates, and no near-duplicates that differ only by word order, a word's
  ending or its spelling: one form of each search, the one people type most.
- Return 25-40 keywords in the site's own language.
- ${dataRule("business_profile")}`;

export type SeedKeyword = {
  term: string;
  intent: "transactional" | "commercial" | "informational" | "navigational";
};

/**
 * The profile as material (lib/ai/untrusted.ts): it was first filled from the
 * crawled homepage. The brand to leave out is an instruction, so it stays
 * outside the block.
 */
export function buildPrompt(profile: SeedInput): string {
  const facts = [
    profile.industry ? `Industry: ${profile.industry}` : null,
    profile.description ? `Business: ${profile.description}` : null,
    profile.services.length ? `Services: ${profile.services.join(", ")}` : null,
    profile.country ? `Primary market: ${profile.country}` : null,
    profile.language ? `Language: ${profile.language}` : null,
    profile.targetAudience ? `Target audience: ${profile.targetAudience}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  return [
    facts ? dataBlock("business_profile", facts) : null,
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

  /*
    Truncation, named. Unlike clustering and calendar planning this response
    is a fixed-size list rather than one scaled by the input, so 2000 tokens
    is a sound cap - but a silent truncation here would still surface as a
    JSON parse error about a character offset, which is what sent me looking
    in the wrong place when the content calendar broke.
  */
  if (response.stop_reason === "max_tokens") {
    throw new Error("Keyword seed generation ran out of room");
  }

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
    // Another ending or spelling of a seed already kept (lib/keywords/variants.ts).
    if (variantOf(normalized, [...seen])) continue;
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
