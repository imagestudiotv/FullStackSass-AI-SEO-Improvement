import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { videoIdeas } from "@/lib/db/schema";

import { activeProvider } from "@/lib/images/generate";

import {
  addCost,
  estimateCost,
  holdCost,
  ledgerSummary,
  nextAttempt,
  normalLedger,
  releaseHold,
  type CostEstimate,
  type StoredLedger,
} from "./cost-math";
import { DURATION_SECONDS, isCreativeDirection, spokenParts, type CostItem, type ProductionChoices, type ShotPlan, type VideoFormat, type VideoScript } from "./formats";

/**
 * The production cost ledger on each idea (video_ideas.cost), across every
 * attempt to make it - the math is in cost-math.ts. Each change happens in a
 * transaction with the row locked, so two steps never lose each other's items.
 *
 * Internal cost only (client, 2026-11-12: below $0.30 a standard video); the
 * customer pays credits, never this.
 */

export { ledgerSummary };
export type { CostEstimate, StoredLedger };

/** A paid step refused by the budget: the job fails the make with this reason (the credit is returned). */
export class BudgetExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BudgetExceededError";
  }
}

/** The idea's ledger (an empty one before anything was recorded). */
export async function readLedger(ideaId: string): Promise<StoredLedger> {
  const [row] = await db.select({ cost: videoIdeas.cost }).from(videoIdeas).where(eq(videoIdeas.id, ideaId));
  return normalLedger(row?.cost);
}

async function change<T>(ideaId: string, update: (ledger: StoredLedger) => { ledger: StoredLedger; result: T }): Promise<T> {
  return db.transaction(async (tx) => {
    const [row] = await tx.select({ cost: videoIdeas.cost }).from(videoIdeas).where(eq(videoIdeas.id, ideaId)).for("update");
    if (!row) throw new Error("The idea is gone");
    const { ledger, result } = update(normalLedger(row.cost));
    await tx.update(videoIdeas).set({ cost: ledger }).where(eq(videoIdeas.id, ideaId));
    return result;
  });
}

/**
 * Holds a paid step's conservative estimate before it runs; throws
 * BudgetExceededError (nothing held) when spent + held + estimate + margin
 * would pass the budget.
 */
export async function reserveCost(ideaId: string, key: string, estimateUsd: number, label: string): Promise<void> {
  const refusal = await change(ideaId, (ledger) => {
    const gate = holdCost(ledger, key, estimateUsd, label);
    return gate.ok ? { ledger: gate.ledger, result: null } : { ledger, result: gate.reason };
  });
  if (refusal) throw new BudgetExceededError(refusal);
}

/** Whether a step would fit the budget now, without holding anything (optional extras such as AI images). */
export async function canAfford(ideaId: string, key: string, estimateUsd: number): Promise<boolean> {
  const ledger = await readLedger(ideaId);
  return holdCost(ledger, key, estimateUsd, key).ok;
}

/** Records what a step cost (measured, estimated, or unmeasured = usd null), releasing its hold. */
export async function recordCost(ideaId: string, item: Omit<CostItem, "attempt" | "at">, key?: string | null): Promise<void> {
  await change(ideaId, (ledger) => ({ ledger: addCost(ledger, item, key), result: null }));
}

export async function releaseCost(ideaId: string, key: string): Promise<void> {
  await change(ideaId, (ledger) => ({ ledger: releaseHold(ledger, key), result: null }));
}

/** A new make attempt (the job's claim): attempt + 1, the items kept, the run recorded. */
export async function startAttempt(ideaId: string, run: string | null): Promise<StoredLedger> {
  return change(ideaId, (ledger) => {
    const next = nextAttempt(ledger, run);
    return { ledger: next, result: next };
  });
}

type EstimateIdea = {
  direction: string;
  format: string;
  production: unknown;
  plan: unknown;
  script: unknown;
  voiceUrl: string | null;
  cost: unknown;
};

/** The production choices of an idea, with the old columns' meaning when it has none. */
export function productionChoicesOf(idea: { production: unknown; voice?: string | null; captions?: boolean; musicTrack?: string | null }): ProductionChoices {
  const stored = (idea.production ?? null) as Partial<ProductionChoices> | null;
  return {
    audio: stored?.audio ?? (idea.voice ? "voiceover" : "text_music"),
    narration: stored?.narration ?? "natural",
    captionStyle: stored?.captionStyle ?? "bold",
    music: stored?.music ?? (idea.musicTrack === "none" ? "none" : "auto"),
    duration: stored?.duration && stored.duration in DURATION_SECONDS ? stored.duration : "30-45",
    showHook: stored?.showHook ?? true,
    includeCta: stored?.includeCta ?? true,
    ctaText: stored?.ctaText ?? null,
  };
}

/** How many original AI images a plan may ask for (at most 2 a video). */
export function plannedAiImages(plan: ShotPlan | null): number {
  if (!plan?.scenes) return 0;
  return Math.min(2, plan.scenes.filter((scene) => scene.visual?.source === "ai_image").length);
}

/**
 * The expected internal cost of making an idea, by component: the UI's
 * preflight (shown as internal cost, never a price) and the job's first
 * check. Includes what the ledger has recorded so far.
 */
export function estimateProductionCost(idea: EstimateIdea): CostEstimate {
  const plan = (idea.plan ?? null) as ShotPlan | null;
  const production = productionChoicesOf(idea);
  const script = idea.script as VideoScript;
  return estimateCost({
    direction: isCreativeDirection(idea.direction) ? idea.direction : "animated",
    format: (["reel", "story", "carousel"].includes(idea.format) ? idea.format : "reel") as VideoFormat,
    production,
    voiced: Boolean(idea.voiceUrl),
    aiImages: plannedAiImages(plan),
    imageProvider: activeProvider(),
    spokenTexts: script?.points ? spokenParts(script) : undefined,
    ledger: normalLedger(idea.cost),
  });
}
