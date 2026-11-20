/**
 * What one generated image costs us, in USD (lib/usage.ts PRICING.image
 * points here). Recorded on every image's usage_events row, so the Free
 * plan's monthly cap and daily budget (lib/plans/free-plan-server.ts), which
 * add up usage_events.cost_usd, include pictures like every other AI call.
 *
 * OPENAI bills its GPT Image models by TOKEN, per 1M tokens, from
 * https://developers.openai.com/api/docs/pricing ("Multimodal models ->
 * Images", Standard; checked 2026-11-20): text input, image input and image
 * output are priced separately. The response's `usage` names each count, so
 * the cost is MEASURED per image; nothing is assumed while it is there.
 * Batch and cached prices do not apply (we call images/generations directly).
 *
 * When a response carries no usage, a PER-IMAGE ESTIMATE is recorded instead
 * of nothing - an image that seems free quietly breaks the Free plan's caps.
 * From the per-image table in the image generation guide's "Cost and
 * latency" section, https://developers.openai.com/api/docs/guides/image-generation,
 * gpt-image-2 at the 1536x1024 size we ask for (lib/images/process.ts
 * openAiSize). Quality "auto" (what the article images send: none) can be
 * any of the three, so it is priced as "high": the cap errs on stopping
 * early, never on spending more.
 *
 * Re-check both pages when OpenAI changes prices or OPENAI_IMAGE_MODEL moves
 * to another model; an unknown model is priced as gpt-image-2.
 */

type TokenRates = {
  /** USD per 1M text input tokens (the prompt). */
  textInputPer1M: number;
  /** USD per 1M image input tokens (edits; 0 tokens for a plain generation). */
  imageInputPer1M: number;
  /** USD per 1M image output tokens: almost the whole cost. */
  imageOutputPer1M: number;
};

export const OPENAI_IMAGE_TOKEN_RATES: Record<string, TokenRates> = {
  "gpt-image-2": { textInputPer1M: 5, imageInputPer1M: 8, imageOutputPer1M: 30 },
  "gpt-image-1.5": { textInputPer1M: 5, imageInputPer1M: 8, imageOutputPer1M: 32 },
  "gpt-image-1-mini": { textInputPer1M: 2, imageInputPer1M: 2.5, imageOutputPer1M: 8 },
};

const DEFAULT_MODEL = "gpt-image-2";

export type ImageQuality = "low" | "medium" | "high";

/** gpt-image-2, 1536x1024, USD per image (the guide's table; see the top of this file). */
export const OPENAI_IMAGE_PER_IMAGE_USD: Record<ImageQuality, number> = { low: 0.005, medium: 0.041, high: 0.165 };

/**
 * Replicate's black-forest-labs/flux-schnell bills per image run, so a flat
 * rate is the real price there (https://replicate.com/black-forest-labs/flux-schnell).
 * The rate the code always used; not re-checked on 2026-11-20, as production
 * uses OpenAI. Only used with IMAGE_PROVIDER=replicate.
 */
export const REPLICATE_FLUX_SCHNELL_PER_IMAGE_USD = 0.003;

/** The usage object of an images/generations response (only the fields priced here). */
export type OpenAiImageUsage = {
  input_tokens?: number;
  output_tokens?: number;
  input_tokens_details?: { text_tokens?: number; image_tokens?: number } | null;
};

const count = (value: unknown) => (typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0);

/** One OpenAI image's cost: measured from `usage` when it has output tokens, else the per-image estimate. */
export function openAiImageCostUsd(model: string | null | undefined, usage: OpenAiImageUsage | null | undefined, quality?: ImageQuality): number {
  const rates = OPENAI_IMAGE_TOKEN_RATES[model?.trim() || DEFAULT_MODEL] ?? OPENAI_IMAGE_TOKEN_RATES[DEFAULT_MODEL];
  const output = count(usage?.output_tokens);
  if (!usage || output === 0) return OPENAI_IMAGE_PER_IMAGE_USD[quality ?? "high"];
  const imageInput = count(usage.input_tokens_details?.image_tokens);
  // Text tokens when the details name them; else every input token not an image token is text.
  const textInput = usage.input_tokens_details?.text_tokens !== undefined ? count(usage.input_tokens_details.text_tokens) : Math.max(0, count(usage.input_tokens) - imageInput);
  const usd = (textInput * rates.textInputPer1M + imageInput * rates.imageInputPer1M + output * rates.imageOutputPer1M) / 1_000_000;
  return Number(usd.toFixed(6));
}
