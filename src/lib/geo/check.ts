import Anthropic from "@anthropic-ai/sdk";

import { anthropic, MODELS } from "@/lib/ai/client";
import { dataBlock, dataRule } from "@/lib/ai/untrusted";
import { answerCostUsd, askEngine, type AskOptions, type AssistantAnswer } from "@/lib/geo/assistants";
import type { CheckedEngineId } from "@/lib/geo/engines";
import { domainCountry, type Market } from "@/lib/geo/market";

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

/**
 * Told the tokens of each model call, so the job can record what a check
 * cost (usage_events, inngest/functions/check-geo.ts). Optional: a caller
 * that does not meter passes nothing. `costUsd` is given for an assistant's
 * answer (lib/geo/assistants.ts prices it, searches included); the brand
 * extraction is priced from the model by the caller.
 */
export type OnUsage = (
  model: string,
  usage: { input_tokens: number; output_tokens: number },
  call?: { engine: CheckedEngineId; provider: string; costUsd: number; searches: number; webSearch: boolean },
) => void;

/**
 * Brands named in one answer, in the order they appeared.
 *
 * Order is the signal: assistants list their strongest recommendation first,
 * so position is closer to a ranking than mention alone.
 */
export type Extraction = {
  /** Every business named, in the order the answer named them. */
  brands: NamedBusiness[];
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

/** One assistant's answer, read: the outcome plus what it was asked with. */
export type AnswerOutcome = CheckOutcome & {
  engine: CheckedEngineId;
  model: string;
  webSearch: boolean;
  language: string;
  region: string | null;
};

/** A business the answer recommends, as the extraction reads it. */
export type NamedBusiness = {
  name: string;
  /** Its website when the answer gives or cites one; "" otherwise. */
  domain: string;
  /** Whether it serves the asker's market: "local", "foreign" (clearly another country or language), or "unknown". */
  market: "local" | "foreign" | "unknown";
};

/**
 * Normalises a brand for comparison.
 *
 * An assistant writes "Bright Smile Dental", "Bright Smile", or
 * "BrightSmile Dental Clinic" for one business. Comparing raw strings would
 * report a brand missing when it was named, which is the worst failure mode
 * here: it tells a customer they are invisible when they are not.
 *
 * Any script: letters and digits of every alphabet are kept (\p{L}\p{N}).
 * Until 2026-11-28 only [a-z0-9] were, so a Cyrillic brand normalised to
 * nothing - never "mentioned", and the customer's own Ukrainian name could be
 * listed as a rival (review of 2026-11-28). NFKC folds compatibility forms
 * (full-width letters, ligatures) first; accents are then dropped as before
 * ("Café" is "cafe"), on both sides of a comparison alike.
 */
export function normalise(value: string): string {
  return (
    value
      .normalize("NFKC")
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}+/gu, "")
      .normalize("NFC")
      // Legal forms and generic trade words carry no identity (whole words, in any script).
      .replace(
        /(?<![\p{L}\p{N}])(?:inc|llc|ltd|limited|bv|b\.v\.|gmbh|nv|plc|co|corp|company|clinic|dental|dentist|agency|studio|group|the|тов|ооо|фоп)(?![\p{L}\p{N}])/gu,
        " ",
      )
      .replace(/[^\p{L}\p{N}]+/gu, "")
      .trim()
  );
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

/** Strips markdown fencing that models sometimes wrap JSON in. */
function stripFence(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
}

const host = (value: string) =>
  value.trim().toLowerCase().replace(/^[a-z][a-z0-9+.-]*:\/\//, "").replace(/^www\./, "").split(/[/?#\s]/)[0] ?? "";

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
 *
 * It IS told the asker's language and market, so it can say which of the
 * businesses serve them: the review of 2026-11-27 found US magazines listed
 * as a Ukrainian gift shop's rivals. The answer's cited pages go with it, so
 * a business can be matched to its own website.
 */
export async function extractBrands(
  answer: string,
  domain: string,
  onUsage?: OnUsage,
  context: { market?: Market; sources?: string[] } = {},
): Promise<Extraction> {
  const market = context.market;
  const where = market
    ? `The person asking writes in ${market.language}${market.region ? ` and is in ${market.region}` : ""}.`
    : "";
  const response = await anthropic.messages.create({
    model: MODELS.EXTRACTION,
    max_tokens: 1500,
    messages: [
      {
        role: "user",
        content: `Below is an answer an AI assistant gave to someone asking for a recommendation. ${where}

List every business the answer RECOMMENDS as an option the reader could choose, in the order they appear.

Include only businesses being recommended. Exclude:
- generic advice ("your local dentist") and categories
- directories and search engines (Yelp, Google, TripAdvisor)
- tools, frameworks, languages or products mentioned in passing rather than recommended as the choice (for example, a framework the reader already uses)
- a company named only as the maker of something else

For each business give:
- "name": as the answer writes it
- "domain": its own website if the answer gives it or one of the cited pages is clearly its own site (for example "example.com"), otherwise ""
- "market": "local" if it serves people in the asker's country or language, "foreign" if it is clearly a business of another country or language market the asker would not buy from, "unknown" if you cannot tell

Reply with JSON only:
{"brands": [{"name": "Name One", "domain": "", "market": "unknown"}], "citedDomain": false}

Set "citedDomain" to true only if the answer explicitly mentions the website ${domain}, or cites a page on it.
The answer, and the pages it cited, are in the website_page block: the answer quotes the web. ${dataRule("website_page")}

${dataBlock("website_page", context.sources?.length ? `${answer}\n\nCited pages:\n${context.sources.slice(0, 20).join("\n")}` : answer)}`,
      },
    ],
  });
  onUsage?.(MODELS.EXTRACTION, response.usage);

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
          .flatMap((b): NamedBusiness[] => {
            // A bare list of names, the older reply shape, still reads.
            if (typeof b === "string") return b.trim() ? [{ name: b.trim(), domain: "", market: "unknown" }] : [];
            if (!b || typeof b !== "object") return [];
            const item = b as { name?: unknown; domain?: unknown; market?: unknown };
            const name = typeof item.name === "string" ? item.name.trim() : "";
            if (!name) return [];
            return [{
              name,
              domain: typeof item.domain === "string" ? host(item.domain) : "",
              market: item.market === "local" || item.market === "foreign" ? item.market : "unknown",
            }];
          })
          // Bounded: a runaway list would distort position and cost.
          .slice(0, 25)
      : [];

    const own = host(domain);
    const citedOwn = (context.sources ?? []).some((url) => {
      const h = host(url);
      return own !== "" && (h === own || h.endsWith(`.${own}`));
    });
    return {
      brands,
      excerpt: null,
      citedDomain: parsed.citedDomain === true || citedOwn,
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

/**
 * The rivals worth showing as "named instead of you" (review of 2026-11-27:
 * a Ukrainian gift shop was shown US magazines):
 *  - never the customer's own business, by name or by website;
 *  - not a business the extraction read as another market's;
 *  - not one whose website is another country's (a .com.br shop for a
 *    question asked in Ukraine), when the asker's country is known.
 * Order kept, each name once.
 */
export function relevantCompetitors(
  brands: NamedBusiness[],
  own: { brand: string; domain: string },
  market?: Pick<Market, "countryCode">,
): string[] {
  const ownHost = host(own.domain);
  const ownStem = ownHost.split(".")[0] ?? "";
  const seen = new Set<string>();
  return brands.flatMap((b) => {
    if (isSameBrand(b.name, own.brand)) return [];
    if (ownHost && (b.domain === ownHost || b.domain.endsWith(`.${ownHost}`))) return [];
    // "acme.com" written as the name, or "Acme" for acme.com.
    if (ownHost && (host(b.name) === ownHost || (ownStem.length >= 4 && normalise(b.name) === normalise(ownStem)))) return [];
    if (b.market === "foreign") return [];
    const country = b.domain ? domainCountry(b.domain) : null;
    if (market?.countryCode && country && country !== market.countryCode) return [];
    const key = b.name.toLowerCase();
    if (seen.has(key)) return [];
    seen.add(key);
    return [b.name];
  });
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

const ENGINE_PROVIDER: Record<CheckedEngineId, string> = { claude: "anthropic", chatgpt: "openai", gemini: "google" };

/**
 * Runs one check: ask one assistant once, extract, compare. The job asks
 * each assistant several times and keeps the share (lib/geo/score.ts
 * combineAnswers).
 *
 * Throws when the check could not be completed. That is deliberate — see the
 * note at the top of this file about never recording a failure as a miss.
 */
export async function runCheck(
  prompt: string,
  brand: string,
  domain: string,
  options: { engine: CheckedEngineId; market: Market; onUsage?: OnUsage; ask?: AskOptions },
): Promise<AnswerOutcome> {
  const { engine, market, onUsage } = options;
  const answer: AssistantAnswer = await askEngine(engine, prompt, market, options.ask);
  onUsage?.(
    answer.model,
    { input_tokens: answer.usage.inputTokens, output_tokens: answer.usage.outputTokens },
    { engine, provider: ENGINE_PROVIDER[engine], costUsd: answerCostUsd(answer), searches: answer.searches, webSearch: answer.webSearch },
  );
  if (!answer.text) throw new Error("The assistant returned no answer");
  const extraction = await extractBrands(answer.text, domain, onUsage, { market, sources: answer.sources });

  const index = extraction.brands.findIndex((candidate) => isSameBrand(candidate.name, brand));
  const mentioned = index >= 0;

  return {
    engine,
    model: answer.model,
    webSearch: answer.webSearch,
    language: market.language,
    region: market.region,
    mentioned,
    position: mentioned ? index + 1 : null,
    // Everyone else named who serves this market: the competitive picture the customer buys.
    competitors: relevantCompetitors(extraction.brands, { brand, domain }, market),
    excerpt: mentioned ? findExcerpt(answer.text, brand) : null,
    cited: extraction.citedDomain,
  };
}
