import { anthropic, isAiConfigured, MODELS } from "@/lib/ai/client";
import { dataBlock, dataRule } from "@/lib/ai/untrusted";
import type { KeywordMetrics } from "@/lib/providers/dataforseo";
import type { SearchIntent, SiteType } from "./score";
import type { SeedInput } from "./seeds";

/**
 * Search intent, labelled for what the searcher wants - not for what would
 * suit the business.
 *
 * The 2026-11-27 review of a Ukrainian publisher found all 257 keywords
 * labelled "transactional": seed prompts asked for "people ready to buy", and
 * the provider's own label, for a market it knows little about, said the same
 * of everything. "Wishes for a son-in-law, in your own words" is somebody
 * looking for the wishes, and the article written for it gave advice instead.
 *
 * So: the provider's label is kept where it looks like a measurement, and
 * replaced by one cheap model call (Haiku, all keywords at once) where it is
 * missing or degenerate. The same call says whether the site is a business or
 * a publisher (lib/keywords/score.ts SiteType), which decides how much each
 * intent is worth.
 */

const CODE: Record<string, SearchIntent> = {
  i: "informational",
  c: "commercial",
  t: "transactional",
  n: "navigational",
};

const SYSTEM = `You label the search intent of keywords for an SEO plan, and say what kind of website the plan is for.

siteType:
- "business": the site sells products or services, takes bookings, orders or enquiries.
- "publisher": a blog, magazine, news, recipe, greetings, reference or other content site that lives from its readers (ads, affiliate links), not from selling.

Intent codes, by what the PERSON SEARCHING wants. Never by what would suit the website.
- "i" informational: wants to know or to get something to read or use: how to, what is, why, ideas, examples, wishes, greetings, quotes, templates, lyrics, recipes, instructions, meaning.
- "c" commercial: comparing before a purchase: best X, top X, X vs Y, X reviews, X price or cost, X alternatives.
- "t" transactional: ready to act now: buy, order, book, hire, download, sign up, near me, a price list to order from.
- "n" navigational: looking for one specific brand, website or place by name.
Most searches are informational. Label a keyword transactional only when its own words show the searcher is about to buy, book or order.

Return every keyword by its number, exactly once. ${dataRule("business_profile")} ${dataRule("site_data")}`;

export type IntentClassification = {
  siteType: SiteType;
  intents: Map<string, SearchIntent>;
  usage: { inputTokens: number; outputTokens: number };
};

/** At most this many keywords per call; a larger set is sent in turns. */
export const INTENT_BATCH = 300;

function schema() {
  return {
    type: "object",
    properties: {
      siteType: { type: "string", enum: ["business", "publisher"] },
      keywords: {
        type: "array",
        items: {
          type: "object",
          properties: {
            n: { type: "integer", description: "The keyword's number." },
            t: { type: "string", enum: ["i", "c", "t", "n"] },
          },
          required: ["n", "t"],
          additionalProperties: false,
        },
      },
    },
    required: ["siteType", "keywords"],
    additionalProperties: false,
  } as const;
}

function profileFacts(profile: SeedInput): string {
  return [
    profile.brandName ? `Brand: ${profile.brandName}` : null,
    profile.industry ? `Industry: ${profile.industry}` : null,
    profile.description ? `About: ${profile.description}` : null,
    profile.services.length ? `Offers: ${profile.services.slice(0, 12).join(", ")}` : null,
    profile.language ? `Language: ${profile.language}` : null,
    profile.country ? `Market: ${profile.country}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

/** One call: the site type, and an intent per numbered keyword. Unparseable entries are left out. */
async function classifyBatch(profile: SeedInput, terms: string[]) {
  const list = terms.map((term, index) => `${index + 1}. ${term}`).join("\n");
  const response = await anthropic.messages.create({
    model: MODELS.EXTRACTION,
    // About a dozen tokens a keyword, with room for the wrapper.
    max_tokens: Math.min(16000, 600 + terms.length * 20),
    system: SYSTEM,
    output_config: { format: { type: "json_schema", schema: schema() } },
    messages: [
      {
        role: "user",
        content: [
          dataBlock("business_profile", profileFacts(profile) || "(no profile)"),
          dataBlock("site_data", list),
        ].join("\n"),
      },
    ],
  });
  const usage = {
    inputTokens: response.usage?.input_tokens ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
  };
  if (response.stop_reason === "max_tokens") throw new Error("Intent classification ran out of room");
  if (response.stop_reason === "refusal") throw new Error("The model declined to classify keywords");
  const block = response.content.find((item) => item.type === "text");
  if (!block || block.type !== "text") throw new Error("No content returned from intent classification");
  const parsed = JSON.parse(block.text) as { siteType?: unknown; keywords?: unknown };
  const intents = new Map<string, SearchIntent>();
  for (const item of Array.isArray(parsed.keywords) ? parsed.keywords : []) {
    if (typeof item !== "object" || item === null) continue;
    const { n, t } = item as { n?: unknown; t?: unknown };
    const term = typeof n === "number" ? terms[n - 1] : undefined;
    const intent = typeof t === "string" ? CODE[t] : undefined;
    if (term && intent && !intents.has(term)) intents.set(term, intent);
  }
  const siteType: SiteType | null = parsed.siteType === "publisher" ? "publisher" : parsed.siteType === "business" ? "business" : null;
  return { siteType, intents, usage };
}

export async function classifyKeywordIntents(profile: SeedInput, terms: string[]): Promise<IntentClassification> {
  if (!isAiConfigured()) throw new Error("ANTHROPIC_API_KEY is not set");
  const unique = [...new Set(terms)];
  const intents = new Map<string, SearchIntent>();
  const usage = { inputTokens: 0, outputTokens: 0 };
  const votes: SiteType[] = [];
  for (let start = 0; start < unique.length; start += INTENT_BATCH) {
    const batch = await classifyBatch(profile, unique.slice(start, start + INTENT_BATCH));
    for (const [term, intent] of batch.intents) intents.set(term, intent);
    usage.inputTokens += batch.usage.inputTokens;
    usage.outputTokens += batch.usage.outputTokens;
    if (batch.siteType) votes.push(batch.siteType);
  }
  return { siteType: votes[0] ?? "business", intents, usage };
}

/**
 * Whether the provider's labels say anything.
 *
 * One label on nine in ten of twenty or more keywords is not a measurement of
 * twenty different searches: it is what the 2026-11-27 review saw (257 of 257
 * "transactional"). Labels from such a run are all ignored.
 */
export function providerIntentsTrustworthy(rows: Pick<KeywordMetrics, "intent" | "source">[]): boolean {
  const labelled = rows.filter((row) => row.source !== "ai_seed" && row.intent !== null);
  if (labelled.length < 20) return true;
  const counts = new Map<string, number>();
  for (const row of labelled) counts.set(row.intent!, (counts.get(row.intent!) ?? 0) + 1);
  return Math.max(...counts.values()) / labelled.length < 0.9;
}

/**
 * The terms whose intent should come from the classifier: every seed (the
 * seed model labelled them while choosing them), every row the provider left
 * unlabelled, and every provider label when those are degenerate.
 */
export function termsToClassify(rows: Pick<KeywordMetrics, "term" | "intent" | "source">[]): string[] {
  const trustProvider = providerIntentsTrustworthy(rows);
  return rows
    .filter((row) => row.source === "ai_seed" || row.intent === null || !trustProvider)
    .map((row) => row.term);
}

/**
 * The rows with the classifier's labels applied. A term that was sent but came
 * back unlabelled keeps a seed's label, and otherwise loses the provider's:
 * it was sent because that label was not trusted.
 */
export function applyIntents<T extends Pick<KeywordMetrics, "term" | "intent" | "source">>(
  rows: T[],
  intents: Map<string, SearchIntent>,
  sent: Set<string> = new Set(intents.keys()),
): T[] {
  return rows.map((row) => {
    const intent = intents.get(row.term);
    if (intent) return { ...row, intent };
    if (sent.has(row.term) && row.source !== "ai_seed") return { ...row, intent: null };
    return row;
  });
}
