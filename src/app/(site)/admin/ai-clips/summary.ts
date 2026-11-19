import type { AiHookClip, AiRejectedTake } from "@/lib/video/footage/ai-library";
import { HOOK_TYPES, type HookType } from "@/lib/video/formats";

/**
 * The figures on Admin -> AI clips (client, 2026-11-19: "it's not clear how
 * much we spend, what exact videos we generate"): how many clips the library
 * holds, what they cost in all and this month, and the batches they were made
 * in. Pure, so the sums are tested without a database.
 */

export type ClipBatch<T extends AiHookClip = AiHookClip> = {
  /** The day the batch was made (YYYY-MM-DD). */
  madeOn: string;
  clips: T[];
  /** Takes paid for that day but not kept. */
  rejected: number;
  /** The kept clips and the rejected takes. */
  costUsd: number;
};

export type ClipSummary<T extends AiHookClip = AiHookClip> = {
  count: number;
  /** Takes paid for but not kept. */
  rejected: number;
  /** Every take paid for, kept or not. */
  totalUsd: number;
  /** The current UTC month, YYYY-MM. */
  month: string;
  monthCount: number;
  monthUsd: number;
  byType: Record<HookType, number>;
  /** Newest batch first; clips keep the library's order. */
  batches: ClipBatch<T>[];
};

/** Sums to the hundredth of a cent, so 0.1 + 0.2 never shows as 0.30000000000000004. */
function sum(values: number[]): number {
  return Math.round(values.reduce((total, value) => total + value, 0) * 10_000) / 10_000;
}

export function summarizeClips<T extends AiHookClip>(clips: readonly T[], now: Date = new Date(), rejected: readonly AiRejectedTake[] = []): ClipSummary<T> {
  const month = now.toISOString().slice(0, 7);
  const byType = Object.fromEntries(HOOK_TYPES.map((type) => [type, 0])) as Record<HookType, number>;
  const byDay = new Map<string, T[]>();
  for (const clip of clips) {
    byType[clip.type] = (byType[clip.type] ?? 0) + 1;
    const day = byDay.get(clip.madeOn);
    if (day) day.push(clip);
    else byDay.set(clip.madeOn, [clip]);
  }
  for (const take of rejected) if (!byDay.has(take.madeOn)) byDay.set(take.madeOn, []);
  const inMonth = (madeOn: string) => madeOn.startsWith(`${month}-`);
  const thisMonth = clips.filter((clip) => inMonth(clip.madeOn));
  const rejectedOn = (day: string) => rejected.filter((take) => take.madeOn === day);
  const batches = [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([madeOn, dayClips]) => ({
      madeOn,
      clips: dayClips,
      rejected: rejectedOn(madeOn).length,
      costUsd: sum([...dayClips, ...rejectedOn(madeOn)].map((clip) => clip.costUsd)),
    }));

  return {
    count: clips.length,
    rejected: rejected.length,
    totalUsd: sum([...clips, ...rejected].map((clip) => clip.costUsd)),
    month,
    monthCount: thisMonth.length,
    monthUsd: sum([...thisMonth, ...rejected.filter((take) => inMonth(take.madeOn))].map((clip) => clip.costUsd)),
    byType,
    batches,
  };
}

/** US dollars with cents: "$0.56", "$5.60". */
export function formatUsd(value: number): string {
  return new Intl.NumberFormat("en", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

/** A length in seconds: "8 s", "5.5 s". */
export function formatSeconds(ms: number): string {
  const seconds = Math.round(ms / 100) / 10;
  return `${Number.isInteger(seconds) ? seconds.toFixed(0) : seconds.toFixed(1)} s`;
}
