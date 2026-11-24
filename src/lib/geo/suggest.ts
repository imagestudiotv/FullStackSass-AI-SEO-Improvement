import "server-only";

import { anthropic, MODELS } from "@/lib/ai/client";
import { dataBlock, dataRule } from "@/lib/ai/untrusted";
import { paidCall, releaseUnspent, reserveAll, type QuotaRule } from "@/lib/billing/spend-quota";
import type { websites } from "@/lib/db/schema";
import { MAX_PROMPT_LENGTH } from "@/lib/geo/shared";
import { PRICING, track } from "@/lib/usage";

/**
 * The one paid call behind every suggested AI-visibility question: "Suggest"
 * on the AI visibility page (lib/geo/actions.ts) and a new website's first
 * questions (lib/geo/first-questions.ts).
 *
 * WHO MAY ASK IS THE CALLER'S BUSINESS - an editor on a website with a live
 * plan, or the job for a website that has one. The hourly allowance, the
 * spending record and the cost are here, so no caller can skip them.
 */

/** The spend ledger's name for it. */
export const SUGGEST_OPERATION = "geo.suggest";

/**
 * Suggestion requests per workspace per hour. Onboarding fills a list once and
 * "suggest more" is pressed a handful of times; thirty is room for both and a
 * ceiling on a loop.
 */
const SUGGESTIONS_PER_WORKSPACE_PER_HOUR = 30;

/** Trims and rejects a prompt that is empty or over-long. */
export function cleanPrompt(value: string): string | null {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (trimmed.length < 5) return null;
  return trimmed.slice(0, MAX_PROMPT_LENGTH);
}

export type SuggestOutcome = { ok: true; questions: string[] } | { ok: false; reason: "limited" | "failed" };

export async function suggestQuestions(input: {
  site: typeof websites.$inferSelect;
  /** How many to ask for, already held to the plan's allowance. */
  count: number;
  /** Questions already tracked, trimmed, so the model does not return them again. */
  tracked?: string[];
  /** Further allowances this call must hold (the first questions' once ever). */
  rules?: QuotaRule[];
}): Promise<SuggestOutcome> {
  const { site, count, tracked = [] } = input;
  // Billed to the website's owner, not an invited editor's own workspace.
  const ownerOrgId = site.organizationId;

  const held = await reserveAll(
    [
      ...(input.rules ?? []),
      { key: `geo-suggest:org:${ownerOrgId}`, limit: SUGGESTIONS_PER_WORKSPACE_PER_HOUR, window: { seconds: 60 * 60 } },
    ],
    { operation: SUGGEST_OPERATION, organizationId: ownerOrgId, websiteId: site.id },
  );
  if (!held.ok) return { ok: false, reason: "limited" };
  const slots = held.reservations;

  // As material (lib/ai/untrusted.ts): the profile was first filled from the crawled homepage.
  const facts = [
    site.industry && `Industry: ${site.industry}`,
    site.country && `Country: ${site.country}`,
    site.description && `About: ${site.description}`,
  ]
    .filter(Boolean)
    .join("\n");
  const description = facts ? dataBlock("business_profile", facts) : "";

  /**
   * Questions already tracked, listed so the model does not return them
   * again. Without this, "suggest more" comes back with rephrasings of what
   * is already on screen and the button looks broken.
   */
  const avoid = tracked.length
    ? [
        "- Do NOT repeat or rephrase any of these, which are already tracked:",
        ...tracked.map((e) => `  - ${e}`),
      ].join("\n")
    : "";

  let response;
  try {
    response = await paidCall(slots, () => anthropic.messages.create({
      model: MODELS.EXTRACTION,
      // ~60 tokens a question plus overhead; 50 questions needs real room.
      max_tokens: Math.min(4000, 400 + count * 70),
      messages: [
        {
          role: "user",
          content: `A business has this website: ${site.domain}
${description}

Write ${count} questions a potential customer might ask an AI assistant when looking for a business like this one.

Rules:
- Never name this business. The question must be one someone asks BEFORE they know it exists.
- Ask the way a real person types, not like a search query.
- Be specific to the industry and, where it matters, the location.
- Vary the intent: some comparing options, some asking about price, some about a specific service or place.
- ${dataRule("business_profile")}
${avoid}

Reply with JSON only: {"prompts": ["...", "..."]}`,
        },
      ],
    }));
  } catch {
    /*
      A provider refusal was not billed, so its slots go back; a timeout may
      have been, and paidCall has already recorded it as spent - releasing a
      consumed reservation changes nothing.
    */
    await releaseUnspent(slots, "provider_refused");
    return { ok: false, reason: "failed" };
  }

  const price = PRICING.llm[MODELS.EXTRACTION];
  await track(ownerOrgId, {
    kind: "llm",
    websiteId: site.id,
    provider: "anthropic",
    model: MODELS.EXTRACTION,
    costUsd:
      (response.usage.input_tokens / 1000) * price.inputPer1k +
      (response.usage.output_tokens / 1000) * price.outputPer1k,
    metadata: { purpose: "geo_suggest", wanted: count },
  }).catch(() => {});

  try {
    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "");

    const parsed = JSON.parse(text) as { prompts?: unknown };
    const suggestions = Array.isArray(parsed.prompts)
      ? parsed.prompts
          .filter((p): p is string => typeof p === "string")
          .map((p) => cleanPrompt(p))
          .filter((p): p is string => p !== null)
          .slice(0, count)
      : [];

    if (suggestions.length === 0) {
      return { ok: false, reason: "failed" };
    }

    return { ok: true, questions: suggestions };
  } catch {
    return { ok: false, reason: "failed" };
  }
}
