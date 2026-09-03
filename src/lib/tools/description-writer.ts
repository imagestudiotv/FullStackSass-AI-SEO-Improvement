import type Anthropic from "@anthropic-ai/sdk";

import { anthropic, isAiConfigured, MODELS } from "@/lib/ai/client";
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

/** Strips markdown fencing that models sometimes wrap JSON in. */
function stripFence(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
}

export async function writeDescriptions(
  input: string,
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
    const response = await anthropic.messages.create({
      model: MODELS.GENERATION,
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });
    raw = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n");
  } catch {
    return {
      ok: false,
      error: "We could not write descriptions just now. Please try again.",
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFence(raw));
  } catch {
    return {
      ok: false,
      error: "We could not write descriptions just now. Please try again.",
    };
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
    return {
      ok: false,
      error: "We could not write descriptions just now. Please try again.",
    };
  }

  return {
    ok: true,
    result: {
      domain: normalized.domain,
      finalUrl: page.finalUrl,
      pageTitle: page.title,
      currentDescription: page.metaDescription,
      descriptions,
    },
  };
}
