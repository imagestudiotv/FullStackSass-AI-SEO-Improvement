import "server-only";

import type Anthropic from "@anthropic-ai/sdk";

import { anthropic, MODELS } from "@/lib/ai/client";

/**
 * One call to the blog autopilot's model (MODELS.BLOG: Claude Sonnet 5 since
 * 2026-10-18, Opus 5.5 before) for the writer (write.ts), the translator
 * (translate.ts) and the topic chooser (suggest.ts) - and what it cost.
 *
 * Both models think by default (adaptive); `effort` says how much. Answers
 * come back as JSON in a fixed shape (output_config.format), which both
 * accept - Opus 5.5 refuses a forced tool. Streamed, because a long answer
 * would otherwise meet the request timeout.
 */

/** Room for the model's thinking and the longest answer. */
const MAX_TOKENS = 32_000;

/** Published prices, $ per million tokens; a 5-minute cache write is 1.25x input, a cache read 0.1x. */
const PRICES_PER_MTOK: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  "claude-sonnet-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
};

/** The model's prices; an unknown model is priced as Opus 5.5, so a cost is never under-reported. */
function prices() {
  return PRICES_PER_MTOK[MODELS.BLOG] ?? PRICES_PER_MTOK["claude-opus-5-5"];
}

export type CallUsage = { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number; costUsd: number };

function priced(usage: Anthropic.Usage): CallUsage {
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  const price = prices();
  const costUsd = (usage.input_tokens * price.input + usage.output_tokens * price.output + cacheRead * price.cacheRead + cacheWrite * price.cacheWrite) / 1_000_000;
  return { inputTokens: usage.input_tokens, outputTokens: usage.output_tokens, cacheReadTokens: cacheRead, cacheWriteTokens: cacheWrite, costUsd };
}

export function addUsage(usages: CallUsage[]): CallUsage & { calls: number } {
  const sum = (key: keyof CallUsage) => usages.reduce((total, usage) => total + usage[key], 0);
  return {
    calls: usages.length,
    inputTokens: sum("inputTokens"),
    outputTokens: sum("outputTokens"),
    cacheReadTokens: sum("cacheReadTokens"),
    cacheWriteTokens: sum("cacheWriteTokens"),
    costUsd: Math.round(sum("costUsd") * 10_000) / 10_000,
  };
}

/**
 * Asks once: `system` (cached when `cache`, for instructions several calls
 * share), the request, and the JSON shape of the answer. Throws, with words
 * an administrator can act on, when there is no usable answer.
 */
export async function askClaude(options: {
  system: string;
  request: string;
  schema: Record<string, unknown>;
  effort: "low" | "medium" | "high";
  cache?: boolean;
}): Promise<{ value: Record<string, unknown>; usage: CallUsage }> {
  const message = await anthropic.messages
    .stream({
      model: MODELS.BLOG,
      max_tokens: MAX_TOKENS,
      system: [{ type: "text", text: options.system, ...(options.cache ? { cache_control: { type: "ephemeral" as const } } : {}) }],
      output_config: { effort: options.effort, format: { type: "json_schema", schema: options.schema } },
      messages: [{ role: "user", content: options.request }],
    })
    .finalMessage();

  if (message.stop_reason === "refusal") throw new Error("The AI declined to write about this topic. Reword the topic, then try again.");
  if (message.stop_reason === "max_tokens") throw new Error("The AI ran out of room while writing. Try again.");
  const text = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("The AI's answer was not in the expected form. Try again.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("The AI's answer was not in the expected form. Try again.");
  return { value: value as Record<string, unknown>, usage: priced(message.usage) };
}
