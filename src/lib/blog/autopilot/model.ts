import "server-only";

import type Anthropic from "@anthropic-ai/sdk";

import { anthropic, MODELS } from "@/lib/ai/client";

/**
 * One call to Claude Opus 5.5 (MODELS.BLOG) for the blog autopilot - the
 * writer (write.ts) and the translator (translate.ts) - and what it cost.
 *
 * Opus 5.5 always thinks; `effort` says how much. A forced tool is refused
 * by this model, so answers come back as JSON in a fixed shape
 * (output_config.format). Streamed, because a long answer would otherwise
 * meet the request timeout.
 */

/** Room for the model's thinking and the longest answer. */
const MAX_TOKENS = 32_000;

/** Published at $ per million tokens for Claude Opus 5.5; a 5-minute cache write is 1.25x input. */
const PRICE_PER_MTOK = { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 };

export type CallUsage = { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number; costUsd: number };

function priced(usage: Anthropic.Usage): CallUsage {
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  const costUsd =
    (usage.input_tokens * PRICE_PER_MTOK.input +
      usage.output_tokens * PRICE_PER_MTOK.output +
      cacheRead * PRICE_PER_MTOK.cacheRead +
      cacheWrite * PRICE_PER_MTOK.cacheWrite) /
    1_000_000;
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
