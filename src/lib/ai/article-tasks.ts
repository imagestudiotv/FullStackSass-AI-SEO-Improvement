import type Anthropic from "@anthropic-ai/sdk";
import { MODELS } from "./client";

export type ArticleTask = "research" | "outline" | "body" | "evidence_check" | "image_scene" | "body_scenes";
export type AiMeasurement = {
  task: ArticleTask;
  model: string;
  promptVersion: string;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  cacheWrite1hTokens: number;
  outcome: string;
  usageKnown?: boolean;
};
export type MeasureAi = (measurement: AiMeasurement) => Promise<void>;

/** Article experiments never change keyword research, GEO, or the marketing blog. */
export function articleTask(task: ArticleTask) {
  const defaults = {
    research: MODELS.EXTRACTION,
    outline: MODELS.GENERATION,
    body: MODELS.GENERATION,
    // Evidence reasoning is not simple extraction: preserve platform/date scope.
    evidence_check: MODELS.GENERATION,
    image_scene: MODELS.EXTRACTION,
    body_scenes: MODELS.EXTRACTION,
  };
  return {
    model: process.env[`ARTICLE_MODEL_${task.toUpperCase()}`]?.trim() || defaults[task],
    maxTokens: task === "outline" || task === "body" ? 16000 : task === "evidence_check" ? 8000 : 4000,
    promptVersion: `article-${task}-v1`,
  };
}

export function articleModelExperiment(): boolean {
  return (["research", "outline", "body", "evidence_check", "image_scene", "body_scenes"] as const)
    .some(task => Boolean(process.env[`ARTICLE_MODEL_${task.toUpperCase()}`]?.trim()));
}

/** Called before parsing, so refusals, truncated JSON and invalid outputs still count. */
export async function measureResponse(
  task: ArticleTask,
  response: Anthropic.Message,
  startedAt: number,
  measure?: MeasureAi,
) {
  const usage = response.usage;
  await measure?.({
    task, model: response.model, promptVersion: articleTask(task).promptVersion,
    durationMs: Date.now() - startedAt,
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    cacheReadTokens: usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: usage.cache_creation_input_tokens ?? 0,
    cacheWrite1hTokens: usage.cache_creation?.ephemeral_1h_input_tokens ?? 0,
    outcome: response.stop_reason ?? "unknown",
    usageKnown: true,
  });
}

/** Unknown models remain unpriced; never report an unmeasured request as free. */
export function estimatedAiCost(
  usage: AiMeasurement,
  prices: Record<string, { inputPer1k: number; outputPer1k: number }>,
): number | undefined {
  const price = prices[usage.model] ?? prices[usage.model.replace(/-\d{8}$/, "")];
  if (!price || usage.usageKnown === false) return undefined;
  const writes5m = Math.max(0, usage.cacheWriteTokens - usage.cacheWrite1hTokens);
  return (
    (usage.inputTokens + usage.cacheReadTokens * 0.1 +
      writes5m * 1.25 + usage.cacheWrite1hTokens * 2) * price.inputPer1k +
    usage.outputTokens * price.outputPer1k
  ) / 1000;
}

/** SDK retries are disabled at call sites; the durable job owns visible retries. */
export async function measuredRequest(
  task: ArticleTask, call: () => Promise<Anthropic.Message>, measure?: MeasureAi,
): Promise<Anthropic.Message> {
  const startedAt = Date.now();
  let response: Anthropic.Message;
  try { response = await call(); }
  catch (error) {
    await measure?.({
      task, model: articleTask(task).model, promptVersion: articleTask(task).promptVersion,
      durationMs: Date.now() - startedAt, inputTokens: 0, outputTokens: 0,
      cacheReadTokens: 0, cacheWriteTokens: 0, cacheWrite1hTokens: 0,
      outcome: "request_failed_usage_unknown", usageKnown: false,
    });
    throw error;
  }
  await measureResponse(task, response, startedAt, measure);
  return response;
}
