import "server-only";

import type Anthropic from "@anthropic-ai/sdk";

import { anthropic, MODELS } from "@/lib/ai/client";

/**
 * One call to one of the blog autopilot's models - and what it cost:
 * MODELS.BLOG (Claude Sonnet 5 since 2026-10-18, Opus 5.5 before) for the
 * writer (write.ts) and the topic chooser (suggest.ts), MODELS.BLOG_TRANSLATION
 * (Claude Haiku 5.5 since 2026-10-20) for the translator (translate.ts).
 *
 * All of them think by default (adaptive); `effort` says how much. Answers
 * come back as JSON in a fixed shape (output_config.format), which all of
 * them accept - Opus 5.5 refuses a forced tool. No temperature and no
 * prefill: Haiku 5.5 refuses both. Streamed, because a long answer would
 * otherwise meet the request timeout.
 */

/** Room for the model's thinking and the longest answer. */
const MAX_TOKENS = 32_000;

type Rates = { input: number; output: number; cacheRead: number; cacheWrite: number };

/** Published prices, $ per million tokens; a 5-minute cache write is 1.25x input, a cache read 0.1x. */
const PRICES_PER_MTOK: Record<string, Rates> = {
  // Claude Haiku 5.5 (the translations, MODELS.BLOG_TRANSLATION), for a prompt of up to 100K tokens.
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
  "claude-sonnet-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
};

/** A second rate card some models have for a long prompt: Claude Haiku 5.5 costs five times as much past 100K tokens. */
const LONG_PROMPT: Record<string, { over: number; rates: Rates }> = {
  "claude-haiku-5-5": { over: 100_000, rates: { input: 0.5, output: 2.5, cacheRead: 0.05, cacheWrite: 0.625 } },
};

/** The model's prices for a prompt this long; an unknown model is priced as Opus 5.5, so a cost is never under-reported. */
function prices(model: string, promptTokens: number): Rates {
  const long = LONG_PROMPT[model];
  if (long && promptTokens > long.over) return long.rates;
  return PRICES_PER_MTOK[model] ?? PRICES_PER_MTOK["claude-opus-5-5"];
}

export type CallUsage = { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number; costUsd: number };

function priced(usage: Anthropic.Usage, model: string): CallUsage {
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  const price = prices(model, usage.input_tokens + cacheRead + cacheWrite);
  const costUsd = (usage.input_tokens * price.input + usage.output_tokens * price.output + cacheRead * price.cacheRead + cacheWrite * price.cacheWrite) / 1_000_000;
  return { inputTokens: usage.input_tokens, outputTokens: usage.output_tokens, cacheReadTokens: cacheRead, cacheWriteTokens: cacheWrite, costUsd };
}

/**
 * A call that was answered - and paid for - but whose answer could not be
 * used: cut off, refused, not the expected shape, or refused by a check
 * after it (a part with missing sections, a translation that changed the
 * links). Carries what the call cost, so the run still counts it.
 */
export class SpentError extends Error {
  constructor(message: string, readonly usage: CallUsage) {
    super(message);
    this.name = "SpentError";
  }
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
  /** MODELS.BLOG unless given (the translator gives MODELS.BLOG_TRANSLATION). */
  model?: string;
}): Promise<{ value: Record<string, unknown>; usage: CallUsage }> {
  const model = options.model ?? MODELS.BLOG;
  const message = await anthropic.messages
    .stream({
      model,
      max_tokens: MAX_TOKENS,
      system: [{ type: "text", text: options.system, ...(options.cache ? { cache_control: { type: "ephemeral" as const } } : {}) }],
      output_config: { effort: options.effort, format: { type: "json_schema", schema: options.schema } },
      messages: [{ role: "user", content: options.request }],
    })
    .finalMessage();

  const usage = priced(message.usage, model);
  if (message.stop_reason === "refusal") throw new SpentError("The AI declined to write about this topic. Reword the topic, then try again.", usage);
  if (message.stop_reason === "max_tokens") throw new SpentError("The AI ran out of room while writing. Try again.", usage);
  const text = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new SpentError("The AI's answer was not in the expected form. Try again.", usage);
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new SpentError("The AI's answer was not in the expected form. Try again.", usage);
  return { value: value as Record<string, unknown>, usage };
}
