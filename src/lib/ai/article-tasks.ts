import type Anthropic from "@anthropic-ai/sdk";
import { MODELS } from "./client";

export type ArticleTask = "research_plan" | "research" | "outline" | "body" | "evidence_check" | "evidence_correction" | "image_scene" | "body_scenes";
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
export function articleTask(task: ArticleTask, researched = false) {
  const defaults = {
    research_plan: MODELS.EXTRACTION,
    // Relevance and factual scope require reasoning, not just extraction.
    research: "claude-sonnet-5-5",
    outline: researched ? "claude-sonnet-5-5" : MODELS.GENERATION,
    body: researched ? "claude-sonnet-5-5" : MODELS.GENERATION,
    // Evidence reasoning is not simple extraction: preserve platform/date scope.
    evidence_check: "claude-opus-5-5",
    evidence_correction: "claude-sonnet-5-5",
    image_scene: MODELS.EXTRACTION,
    body_scenes: MODELS.EXTRACTION,
  };
  return {
    model: process.env[`ARTICLE_MODEL_${task.toUpperCase()}`]?.trim() || defaults[task],
    maxTokens: task === "research_plan" ? 1000 : task === "outline" || task === "body" || task === "evidence_correction" || task === "evidence_check" ? 16000 : 4000,
    promptVersion: `article-${task}-${task === "evidence_check" || task === "outline" || task === "body" ? "v6" : task === "research" ? "v4" : task === "evidence_correction" || task === "research_plan" ? "v3" : "v1"}`,
  };
}

export function articleModelExperiment(): boolean {
  return (["research_plan", "research", "outline", "body", "evidence_check", "evidence_correction", "image_scene", "body_scenes"] as const)
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
  prices: Record<string, { inputPer1k: number; outputPer1k: number; cacheReadPer1k?: number }>,
): number | undefined {
  const price = prices[usage.model] ?? prices[usage.model.replace(/-\d{8}$/, "")];
  if (!price || usage.usageKnown === false) return undefined;
  const writes5m = Math.max(0, usage.cacheWriteTokens - usage.cacheWrite1hTokens);
  return (
    (usage.inputTokens + writes5m * 1.25 + usage.cacheWrite1hTokens * 2) * price.inputPer1k +
    usage.cacheReadTokens * (price.cacheReadPer1k ?? price.inputPer1k * 0.1) +
    usage.outputTokens * price.outputPer1k
  ) / 1000;
}

/** SDK retries are disabled at call sites; the durable job owns visible retries. */
export async function measuredRequest(
  task: ArticleTask, call: () => Promise<Anthropic.Message>, measure?: MeasureAi,
  requestedModel = articleTask(task).model,
): Promise<Anthropic.Message> {
  const startedAt = Date.now();
  let response: Anthropic.Message;
  try { response = await call(); }
  catch (error) {
    await measure?.({
      task, model: requestedModel, promptVersion: articleTask(task).promptVersion,
      durationMs: Date.now() - startedAt, inputTokens: 0, outputTokens: 0,
      cacheReadTokens: 0, cacheWriteTokens: 0, cacheWrite1hTokens: 0,
      outcome: "request_failed_usage_unknown", usageKnown: false,
    });
    throw error;
  }
  await measureResponse(task, response, startedAt, measure);
  return response;
}
