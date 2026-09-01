import { anthropic, isAiConfigured, MODELS } from "@/lib/ai/client";
import type { PageSnapshot } from "@/lib/websites/crawl";
import { normalizeLanguage } from "@/lib/websites/languages";

/**
 * Turns a homepage snapshot into the website profile shown during onboarding.
 *
 * Runs on Haiku: the job is short, structured and high volume, and the output
 * is a handful of fields rather than prose. Article generation uses Sonnet
 * because that output is the product itself.
 *
 * Everything here is a GUESS presented to the user for correction — the detail
 * page makes every field editable for exactly this reason.
 */

export type ExtractedProfile = {
  brandName: string | null;
  industry: string | null;
  country: string | null;
  language: string | null;
  description: string | null;
  targetAudience: string | null;
  services: string[];
  competitors: string[];
};

/**
 * Every field is nullable and the model is told to use null rather than guess.
 * A confidently wrong industry propagates into keywords and articles, so an
 * empty field the user fills in is worth more than an invented one.
 */
const SCHEMA = {
  type: "object",
  properties: {
    brandName: {
      type: ["string", "null"],
      description: "The business or brand name, as it refers to itself.",
    },
    industry: {
      type: ["string", "null"],
      description:
        "Specific industry, e.g. 'dental clinic' rather than 'healthcare'.",
    },
    country: {
      type: ["string", "null"],
      description:
        "Primary market country in English, inferred from addresses, phone numbers, currency or domain. Null if unclear.",
    },
    language: {
      type: ["string", "null"],
      description: "Main content language in English, e.g. 'English'.",
    },
    description: {
      type: ["string", "null"],
      description:
        "One or two sentences on what the business does, in neutral third person.",
    },
    targetAudience: {
      type: ["string", "null"],
      description:
        "Who the business sells to, e.g. 'homeowners aged 30-55 in Ireland'.",
    },
    services: {
      type: "array",
      items: { type: "string" },
      description: "Up to 8 concrete products or services offered.",
    },
    competitors: {
      type: "array",
      items: { type: "string" },
      description:
        "Up to 5 likely competitor domains in the same niche and market. Bare domains, no scheme. Omit rather than invent.",
    },
  },
  required: [
    "brandName",
    "industry",
    "country",
    "language",
    "description",
    "targetAudience",
    "services",
    "competitors",
  ],
  additionalProperties: false,
} as const;

const SYSTEM = `You analyse a company's homepage and produce a factual profile of the business for an SEO tool.

Rules:
- Use only what the page supports. Do not invent facts, awards, locations or figures.
- If a field is not evident, return null (or an empty array) rather than guessing.
- "industry" should be specific enough to guide keyword research.
- "competitors" are well-known companies in the same niche and market. This is the only field where reasonable inference is expected; return fewer, or none, rather than padding the list.
- Ignore navigation, cookie banners, and boilerplate.`;

function buildPrompt(snapshot: PageSnapshot): string {
  return [
    `URL: ${snapshot.finalUrl}`,
    snapshot.title ? `Title: ${snapshot.title}` : null,
    snapshot.metaDescription
      ? `Meta description: ${snapshot.metaDescription}`
      : null,
    snapshot.ogSiteName ? `Site name: ${snapshot.ogSiteName}` : null,
    snapshot.lang ? `HTML lang: ${snapshot.lang}` : null,
    snapshot.h1 ? `Main heading: ${snapshot.h1}` : null,
    snapshot.headings.length
      ? `Headings: ${snapshot.headings.slice(0, 25).join(" | ")}`
      : null,
    snapshot.internalLinks.length
      ? `Internal pages: ${snapshot.internalLinks.slice(0, 30).join(" ")}`
      : null,
    "",
    "Page text:",
    snapshot.text,
  ]
    .filter((line) => line !== null)
    .join("\n");
}

/** Trims, drops empties, de-duplicates and caps a model-supplied list. */
function cleanList(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (trimmed) seen.add(trimmed);
    if (seen.size >= max) break;
  }
  return [...seen];
}

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

/** Strips scheme, path and "www." so competitors are storable as domains. */
function cleanDomain(value: string): string | null {
  const withoutScheme = value.trim().replace(/^https?:\/\//i, "");
  const host = withoutScheme.split("/")[0].toLowerCase().replace(/^www\./, "");
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) ? host : null;
}

export async function extractProfile(
  snapshot: PageSnapshot,
): Promise<ExtractedProfile> {
  // Before a key exists this is the expected path, not an outage.
  if (!isAiConfigured()) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const response = await anthropic.messages.create({
    model: MODELS.EXTRACTION,
    max_tokens: 2000,
    system: SYSTEM,
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    messages: [{ role: "user", content: buildPrompt(snapshot) }],
  });

  // A safety refusal is not an error to retry; treat it as "nothing extracted".
  if (response.stop_reason === "refusal") {
    throw new Error("The model declined to analyse this page");
  }

  const block = response.content.find((item) => item.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("No content returned from extraction");
  }

  // Always JSON.parse — never string-match a model's serialised output.
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(block.text) as Record<string, unknown>;
  } catch {
    throw new Error("Extraction did not return valid JSON");
  }

  return {
    brandName: cleanText(parsed.brandName, 120),
    industry: cleanText(parsed.industry, 120),
    country: cleanText(parsed.country, 80),
    // Detection returns free text ("es", "Español"); normalised so the stored
    // value matches what the picker offers and the prompt expects.
    language:
      normalizeLanguage(cleanText(parsed.language, 80)) ??
      cleanText(parsed.language, 80),
    description: cleanText(parsed.description, 1000),
    targetAudience: cleanText(parsed.targetAudience, 300),
    services: cleanList(parsed.services, 8),
    competitors: cleanList(parsed.competitors, 5)
      .map(cleanDomain)
      .filter((domain): domain is string => domain !== null),
  };
}
