import Anthropic from "@anthropic-ai/sdk";

import { anthropic, MODELS } from "@/lib/ai/client";

/**
 * Measuring whether an AI assistant recommends a business.
 *
 * People increasingly choose a supplier by asking an assistant rather than by
 * searching, and being absent from that answer is invisible in every existing
 * SEO tool: it is not a ranking, so there is nothing to look up. No API reports
 * "is this brand mentioned in ChatGPT". The only honest measurement is to ask
 * the question the way a customer would and read what comes back.
 *
 * Two rules govern everything here, because the output is a claim about the
 * customer's business that they will act on:
 *
 *  1. We report only what the answer actually said. No inferring, no filling
 *     gaps, no generous interpretation of a near-match.
 *  2. When a check cannot be completed we record nothing, rather than record a
 *     miss. "Not mentioned" and "we failed to ask" look identical on a chart
 *     and mean opposite things — one is a problem to fix, the other is our bug.
 *     Writing a failure as a miss would invent a decline that never happened.
 */

/** Which assistant produced an answer. Stored in geo_results.engine. */
export const ENGINE = "claude";

/**
 * Brands named in one answer, in the order they appeared.
 *
 * Order is the signal: assistants list their strongest recommendation first,
 * so position is closer to a ranking than mention alone.
 */
export type Extraction = {
  /** Every business named, in the order the answer named them. */
  brands: string[];
  /** The sentence naming our brand, verbatim, or null. */
  excerpt: string | null;
  /** True when the answer pointed at the customer's own domain. */
  citedDomain: boolean;
};

export type CheckOutcome = {
  mentioned: boolean;
  /** 1-based rank among named brands; null when absent. */
  position: number | null;
  competitors: string[];
  excerpt: string | null;
  cited: boolean;
};

/**
 * Normalises a brand for comparison.
 *
 * An assistant writes "Bright Smile Dental", "Bright Smile", or
 * "BrightSmile Dental Clinic" for one business. Comparing raw strings would
 * report a brand missing when it was named, which is the worst failure mode
 * here: it tells a customer they are invisible when they are not.
 */
function normalise(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    // Legal suffixes and generic trade words carry no identity.
    .replace(
      /\b(inc|llc|ltd|limited|bv|b\.v\.|gmbh|nv|plc|co|corp|company|clinic|dental|dentist|agency|studio|group|the)\b/g,
      " ",
    )
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

/**
 * Does `candidate` refer to the customer's brand?
 *
 * Deliberately strict. A loose match inflates the score, and a customer acting
 * on an inflated score is worse served than one seeing an honest zero. Requires
 * an exact normalised match or full containment of a distinctive name — a
 * three-character stem like "abc" is too weak to accept as containment.
 */
export function isSameBrand(candidate: string, brand: string): boolean {
  const a = normalise(candidate);
  const b = normalise(brand);
  if (!a || !b) return false;
  /**
   * Very short stems are rejected outright. Stripping generic words can reduce
   * two unrelated businesses to the same few characters — "ABC" and "ABC
   * Dental" both become "abc" — and treating that as a match would credit a
   * customer for a mention that belongs to someone else.
   */
  if (a.length < 4 || b.length < 4) return false;
  if (a === b) return true;
  // Containment only when the shorter name is distinctive enough to be unique.
  const shorter = a.length < b.length ? a : b;
  const longer = a.length < b.length ? b : a;
  return shorter.length >= 6 && longer.includes(shorter);
}

/**
 * Asks the assistant a customer's question.
 *
 * No system prompt naming the brand: mentioning it would prime the model to
 * produce it, and the measurement would report our own suggestion back to us.
 * The question is asked cold, exactly as a customer would ask it.
 */
export async function askAssistant(prompt: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: MODELS.GENERATION,
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

/** Strips markdown fencing that models sometimes wrap JSON in. */
function stripFence(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
}

/**
 * Pulls the named businesses out of an answer.
 *
 * A second model call rather than a regex: answers are prose, and the brands
 * appear in sentences rather than a list. Haiku is used because this is short
 * structured extraction, the job it is cheapest and best at.
 *
 * The extractor is never told which brand we care about. Told to look for one,
 * a model tends to find it — so it lists everything, and the comparison happens
 * in code where it is deterministic and testable.
 */
export async function extractBrands(
  answer: string,
  domain: string,
): Promise<Extraction> {
  const response = await anthropic.messages.create({
    model: MODELS.EXTRACTION,
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `Below is an answer an AI assistant gave to someone asking for a recommendation.

List every business the answer RECOMMENDS as an option the reader could choose, in the order they appear.

Include only businesses being recommended. Exclude:
- generic advice ("your local dentist") and categories
- directories and search engines (Yelp, Google, TripAdvisor)
- tools, frameworks, languages or products mentioned in passing rather than recommended as the choice (for example, a framework the reader already uses)
- a company named only as the maker of something else

Reply with JSON only:
{"brands": ["Name One", "Name Two"], "citedDomain": false}

Set "citedDomain" to true only if the answer explicitly mentions the website ${domain}.

Answer:
"""
${answer}
"""`,
      },
    ],
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");

  try {
    const parsed = JSON.parse(stripFence(text)) as {
      brands?: unknown;
      citedDomain?: unknown;
    };
    const brands = Array.isArray(parsed.brands)
      ? parsed.brands
          .filter((b): b is string => typeof b === "string" && b.trim() !== "")
          .map((b) => b.trim())
          // Bounded: a runaway list would distort position and cost.
          .slice(0, 25)
      : [];

    return {
      brands,
      excerpt: null,
      citedDomain: parsed.citedDomain === true,
    };
  } catch {
    /**
     * Malformed JSON means we do not know what the answer said. Returning an
     * empty extraction here would be recorded as "not mentioned" — inventing a
     * miss out of our own parse failure. The caller treats a throw as "could
     * not check" and writes nothing.
     */
    throw new Error("Could not read the assistant's answer");
  }
}

/** The sentence naming the brand, so the customer can see the evidence. */
function findExcerpt(answer: string, brand: string): string | null {
  const target = normalise(brand);
  if (!target) return null;

  /**
   * Split on line breaks as well as sentence endings. Assistants answer in
   * markdown, and a heading carries no full stop — splitting on punctuation
   * alone runs several headings together into one "sentence", which is what
   * the customer would then be shown as evidence.
   */
  const candidates = answer
    .split(/\n+|(?<=[.!?])\s+/)
    .map((line) =>
      line
        // Strip markdown so the quote reads as prose, not source.
        .replace(/^\s*#{1,6}\s*/, "")
        .replace(/^\s*[-*+]\s+/, "")
        .replace(/\*\*(.+?)\*\*/g, "$1")
        .replace(/\*(.+?)\*/g, "$1")
        .replace(/`/g, "")
        .trim(),
    )
    .filter((line) => line.length > 0);

  /**
   * Prefer a line that reads like a sentence over a bare heading: "Vercel"
   * as a heading is technically a mention but shows the customer nothing,
   * whereas the sentence below it explains why it was recommended.
   */
  const matches = candidates.filter((line) => normalise(line).includes(target));
  const best =
    matches.find((line) => line.length > 40 && /[.!?]/.test(line)) ??
    matches[0];

  if (!best) return null;
  return best.length > 300 ? `${best.slice(0, 297)}...` : best;
}

/**
 * Runs one check: ask, extract, compare.
 *
 * Throws when the check could not be completed. That is deliberate — see the
 * note at the top of this file about never recording a failure as a miss.
 */
export async function runCheck(
  prompt: string,
  brand: string,
  domain: string,
): Promise<CheckOutcome> {
  const answer = await askAssistant(prompt);
  const extraction = await extractBrands(answer, domain);

  const index = extraction.brands.findIndex((candidate) =>
    isSameBrand(candidate, brand),
  );
  const mentioned = index >= 0;

  return {
    mentioned,
    position: mentioned ? index + 1 : null,
    // Everyone else named. This is the competitive picture the customer buys.
    competitors: extraction.brands.filter(
      (candidate) => !isSameBrand(candidate, brand),
    ),
    excerpt: mentioned ? findExcerpt(answer, brand) : null,
    cited: extraction.citedDomain,
  };
}
