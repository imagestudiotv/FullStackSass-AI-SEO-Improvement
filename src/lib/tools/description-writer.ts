import { createHash } from "node:crypto";

import type Anthropic from "@anthropic-ai/sdk";

import { anthropic, isAiConfigured, MODELS } from "@/lib/ai/client";
import {
  acquireLease,
  paidCall,
  releaseLease,
  releaseUnspent,
  reserveAll,
  type QuotaRule,
  type Reservation,
} from "@/lib/billing/spend-quota";
import { readCache, writeCache } from "@/lib/providers/cache";
import { fetchHomepage } from "@/lib/websites/crawl";
import { SNIPPET_LIMITS } from "@/lib/tools/snippet";
import {
  InvalidUrlError,
  isPublicWebsiteUrl,
  normalizeWebsiteUrl,
} from "@/lib/websites/url";

/**
 * Meta description generator.
 *
 * Reads the page first, then writes from what is actually on it. A generator
 * that works from a URL alone produces five paraphrases of the domain name,
 * which is why most of them are useless.
 *
 * Length is enforced in code afterwards rather than trusted to the prompt:
 * models treat "under 158 characters" as a suggestion, and a description that
 * gets cut off mid-sentence in search results is the exact failure this tool
 * exists to prevent.
 */

/** Descriptions returned, matching the reference's "five descriptions". */
const WANTED = 5;

/** Page text sent to the model. Enough to know the business, small enough to be cheap. */
const MAX_TEXT_CHARS = 4_000;

export type WrittenDescription = {
  text: string;
  length: number;
  /** True when it fits inside what Google shows. */
  fits: boolean;
};

export type DescriptionResult = {
  domain: string;
  finalUrl: string;
  pageTitle: string | null;
  /** What the page has now, so the suggestions can be compared to it. */
  currentDescription: string | null;
  descriptions: WrittenDescription[];
};

export type DescriptionOutcome =
  | { ok: true; result: DescriptionResult }
  | { ok: false; error: string };

const WRITE_FAILED = "We could not write descriptions just now. Please try again.";

/** Strips markdown fencing that models sometimes wrap JSON in. */
function stripFence(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
}

/**
 * Spend limits for an anonymous, free tool that calls a paid model.
 *
 * Before these, every GET of the page with ?domain= was a model call with
 * nothing in front of it — a script could run up the bill without an account.
 * Now each distinct page is written once a day (cached); identical requests
 * arriving together wait on one lease rather than each paying; and new calls
 * are capped per visitor and overall, over sliding windows.
 */
export const PUBLIC_LIMITS = {
  perVisitorPerHour: 5,
  perVisitorPerDay: 20,
  /** Every visitor together. About $1 an hour at most, whatever happens. */
  globalPerHour: 100,
  /**
   * How long one request may hold a page's lease. Longer than a slow model
   * call, so a live request keeps it; a crashed one frees it after this.
   */
  leaseSeconds: 120,
  cacheDays: 1,
};

const CACHE_PROVIDER = "public-meta-description";

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

/**
 * Who is asking, as a hash - the address itself is never stored.
 *
 * x-real-ip and the first x-forwarded-for entry are set by the hosting edge
 * (Vercel overwrites whatever the client sent). Without either, everyone
 * shares one bucket, which fails closed rather than open.
 */
export function visitorKey(headers: Pick<Headers, "get">): string {
  const ip =
    headers.get("x-real-ip")?.trim() ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  return hash(ip);
}

function publicRules(visitor: string): QuotaRule[] {
  return [
    { key: `public-meta:visitor:${visitor}`, limit: PUBLIC_LIMITS.perVisitorPerHour, window: { seconds: 3600 } },
    { key: `public-meta:visitor-day:${visitor}`, limit: PUBLIC_LIMITS.perVisitorPerDay, window: { seconds: 86400 } },
    { key: "public-meta:global", limit: PUBLIC_LIMITS.globalPerHour, window: { seconds: 3600 } },
  ];
}

const ALREADY_WRITING =
  "We are already writing descriptions for that page. Refresh in a moment.";

function refusal(rule: QuotaRule): string {
  if (rule.key === "public-meta:global") {
    return "This tool is busy right now. Please try again in a few minutes.";
  }
  return "You have written several sets of descriptions recently. Please try again later.";
}

export async function writeDescriptions(
  input: string,
  /** From visitorKey(). The page reads the request headers; this does not. */
  visitor: string,
): Promise<DescriptionOutcome> {
  if (!isAiConfigured()) {
    return {
      ok: false,
      error: "This tool is temporarily unavailable. Please try again later.",
    };
  }

  let normalized;
  try {
    normalized = normalizeWebsiteUrl(input);
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof InvalidUrlError
          ? error.message
          : "Enter a valid website address",
    };
  }

  const cacheParams = { url: normalized.url };
  const cached = await readCache<DescriptionResult>(
    CACHE_PROVIDER,
    "descriptions",
    cacheParams,
  );
  if (cached) return { ok: true, result: cached };

  /*
    One request per page at a time, under an expiring lease rather than a
    counter in a clock window: the lease lasts leaseSeconds from when it was
    taken, and only its holder can end it, so a slow request that overran
    cannot release the lease a newer request now holds.
  */
  const lease = await acquireLease(
    `public-meta:url:${hash(normalized.url)}`,
    PUBLIC_LIMITS.leaseSeconds,
  );
  if (!lease) return { ok: false, error: ALREADY_WRITING };

  try {
    // The previous holder may have just finished and cached this page.
    const fresh = await readCache<DescriptionResult>(
      CACHE_PROVIDER,
      "descriptions",
      cacheParams,
    );
    if (fresh) return { ok: true, result: fresh };

    const slot = await reserveAll(publicRules(visitor), {
      operation: "public.meta_description",
      metadata: { visitor },
    });
    if (!slot.ok) return { ok: false, error: refusal(slot.rule) };

    try {
      return await writeFromPage(normalized, cacheParams, slot.reservations);
    } finally {
      /*
        Only unspent slots come back: an unreachable page or a provider
        refusal. A call that reached the model - even one whose answer was
        unusable, or that timed out - stays counted.
      */
      await releaseUnspent(slot.reservations, "not_spent");
    }
  } finally {
    await releaseLease(lease);
  }
}

async function writeFromPage(
  normalized: { url: string; domain: string },
  cacheParams: Record<string, unknown>,
  reservations: Reservation[],
): Promise<DescriptionOutcome> {
  let page;
  try {
    page = await fetchHomepage(normalized.url, isPublicWebsiteUrl);
  } catch {
    return {
      ok: false,
      error: "We could not reach that page. Check the address and try again.",
    };
  }

  const pageText = page.text.slice(0, MAX_TEXT_CHARS);
  if (pageText.trim().length < 80) {
    return {
      ok: false,
      error:
        "There is not enough text on that page to write from. Try a page with more content.",
    };
  }

  const prompt = [
    "Write meta descriptions for this web page.",
    "",
    `Page title: ${page.title ?? "(none)"}`,
    `Page URL: ${page.finalUrl}`,
    "",
    "Page content:",
    pageText,
    "",
    "Rules:",
    `- Between ${SNIPPET_LIMITS.metaMin} and ${SNIPPET_LIMITS.metaMax} characters. This is a hard limit.`,
    "- Describe what is actually on this page. Invent nothing.",
    "- Give the reader a reason to click, in their words, not marketing language.",
    "- No quotes around the description, no emoji, no brand name padding.",
    "- Each one should take a genuinely different angle.",
    "",
    `Return ONLY a JSON array of exactly ${WANTED} strings. No other text.`,
  ].join("\n");

  let raw: string;
  try {
    const response = await paidCall(reservations, () =>
      anthropic.messages.create({
        model: MODELS.GENERATION,
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    );
    raw = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n");
  } catch {
    // paidCall has recorded a timeout as spent; a refusal stays unspent.
    return { ok: false, error: WRITE_FAILED };
  }

  // From here the call has been paid for, whatever comes back.
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFence(raw));
  } catch {
    return { ok: false, error: WRITE_FAILED };
  }

  const descriptions = (Array.isArray(parsed) ? parsed : [])
    .filter((item): item is string => typeof item === "string")
    .map((text) => text.trim().replace(/^["']|["']$/g, ""))
    .filter((text) => text.length > 0)
    .slice(0, WANTED)
    .map((text) => ({
      text,
      length: text.length,
      // Checked here, not trusted to the prompt.
      fits: text.length >= SNIPPET_LIMITS.metaMin && text.length <= SNIPPET_LIMITS.metaMax,
    }));

  if (descriptions.length === 0) {
    return { ok: false, error: WRITE_FAILED };
  }

  const result: DescriptionResult = {
    domain: normalized.domain,
    finalUrl: page.finalUrl,
    pageTitle: page.title,
    currentDescription: page.metaDescription,
    descriptions,
  };

  // Shared across visitors: descriptions of a public page are not private.
  await writeCache(
    CACHE_PROVIDER,
    "descriptions",
    cacheParams,
    result,
    PUBLIC_LIMITS.cacheDays,
  ).catch(() => {});

  return { ok: true, result };
}
