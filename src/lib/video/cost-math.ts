import {
  BUDGET_SAFETY_MARGIN_USD,
  DURATION_SECONDS,
  PRODUCTION_BUDGET_USD,
  type CostBasis,
  type CostItem,
  type CostKind,
  type CostLedger,
  type CreativeDirection,
  type DurationRange,
  type ProductionChoices,
  type VideoFormat,
} from "./formats";

/**
 * The internal production cost of one video (client, 2026-11-12: "target a
 * production cost below $0.30 per video"; not a customer price) - the pure
 * part: ledger math, the gate and the estimates. lib/video/cost.ts keeps the
 * ledger on the idea (video_ideas.cost) and the UI preflight reads
 * estimateProductionCost. No server imports.
 *
 * Rules:
 *  - one ledger per logical video, across every attempt: a retry never resets
 *    it (attempt counts up);
 *  - before each paid step its conservative estimate is held, and the step is
 *    refused when spent + held + estimate + margin would pass the budget;
 *  - an unmeasured cost (usd null) is never counted as zero: the gate counts
 *    it at UNMEASURED_USD for its kind.
 */

/** The ledger as stored: the contract's CostLedger plus the attempt counter and the named holds. */
export type StoredLedger = CostLedger & {
  /** Make attempts so far (the claim counts up; retries keep the items). */
  attempt: number;
  /** Held estimates by key, so a repeated step re-holds instead of double-holding; reservedUsd is their sum. */
  holds: Record<string, number>;
  /** The make run that holds the video (the job's claim), so a duplicate run never renders it twice. */
  run?: string | null;
};

/*
  List prices (USD), re-checked 2026-11-12. They drift: re-check before quoting.
   - OpenAI gpt-4o-mini-tts: about $0.015 a minute of speech (lib/video/voice.ts).
   - OpenAI whisper-1: $0.006 a minute.
   - Images (lib/images/generate.ts): gpt-image measured from output tokens at
     $30 / 1M, $0.04 when the response has no usage; Replicate flux-schnell $0.003.
   - Vercel Sandbox, Pro, iad1 (vercel.com/docs/vercel-sandbox/pricing,
     updated 2026-09-10): Active CPU $0.128 / vCPU-hour, provisioned memory
     $0.0212 / GB-hour (2 GB per vCPU, billed in 1-minute minimums),
     creations $0.60 / 1M; downloads into the sandbox free. A render uses 4
     vCPUs; counted as fully busy (conservative).
   - Supabase Storage: about $0.021 / GB-month stored and $0.09 / GB egress
     beyond the plan's quota (files are kept FILE_DAYS after posting).
*/
export const PRICES = {
  ttsPerMinute: 0.015,
  whisperPerMinute: 0.006,
  imageOpenAiEstimate: 0.04,
  imageReplicate: 0.003,
  sandboxCpuPerVcpuHour: 0.128,
  sandboxMemoryPerGbHour: 0.0212,
  sandboxCreation: 0.6 / 1_000_000,
  storagePerGbMonth: 0.021,
  egressPerGb: 0.09,
} as const;

export const RENDER_VCPUS = 4;

/** What one minute of a 4-vCPU render sandbox costs, all of it busy. */
export function sandboxCostPerMinute(vcpus: number = RENDER_VCPUS): number {
  return (vcpus * PRICES.sandboxCpuPerVcpuHour + vcpus * 2 * PRICES.sandboxMemoryPerGbHour) / 60;
}

/** A measured sandbox run: wall-clock minutes (1-minute minimum) at the rates above. */
export function sandboxCost(runtimeMs: number, vcpus: number = RENDER_VCPUS): number {
  const minutes = Math.max(1, runtimeMs / 60_000);
  return round(minutes * sandboxCostPerMinute(vcpus) + PRICES.sandboxCreation);
}

/**
 * Render minutes a reel is expected to take on the sandbox: about 1.5 min to
 * set the machine up plus about 0.12 min per second of video (4 vCPUs,
 * 1080x1920, footage) - on the high side, as a gate estimate should be.
 */
export function renderMinutesEstimate(videoSeconds: number): number {
  return 1.5 + 0.12 * videoSeconds;
}

/** The conservative figure the gate uses for an unmeasured item of each kind. */
export const UNMEASURED_USD: Record<CostKind, number> = {
  planning: 0.02,
  narration: 0.03,
  transcription: 0.012,
  image: 0.06,
  footage: 0.01,
  render: 0.15,
  storage: 0.01,
  audio_mux: 0.02,
};

/** The planning share when the idea writer recorded none (one call writes a whole batch of ideas). */
export const PLANNING_FALLBACK_USD = 0.02;

export function round(usd: number): number {
  return Math.round(usd * 1_000_000) / 1_000_000;
}

export function emptyLedger(): StoredLedger {
  return { budgetUsd: PRODUCTION_BUDGET_USD, reservedUsd: 0, items: [], attempt: 0, holds: {}, run: null };
}

/** A stored value (null, an older shape, the contract's CostLedger) as a full ledger. */
export function normalLedger(value: unknown): StoredLedger {
  const base = emptyLedger();
  if (!value || typeof value !== "object") return base;
  const raw = value as Partial<StoredLedger>;
  const items = Array.isArray(raw.items) ? raw.items.filter((item): item is CostItem => Boolean(item && typeof item === "object" && "kind" in item)) : [];
  const holds = raw.holds && typeof raw.holds === "object" ? Object.fromEntries(Object.entries(raw.holds).filter(([, usd]) => typeof usd === "number" && usd > 0)) : {};
  return {
    budgetUsd: typeof raw.budgetUsd === "number" && raw.budgetUsd > 0 ? raw.budgetUsd : base.budgetUsd,
    reservedUsd: round(Object.values(holds).reduce((sum, usd) => sum + usd, 0)),
    items,
    attempt: typeof raw.attempt === "number" ? raw.attempt : 0,
    holds,
    run: typeof raw.run === "string" ? raw.run : null,
  };
}

/** What an item counts for at the gate: its figure, or the conservative one when unmeasured. */
export function gateUsd(item: Pick<CostItem, "kind" | "usd">): number {
  return typeof item.usd === "number" && Number.isFinite(item.usd) ? Math.max(0, item.usd) : UNMEASURED_USD[item.kind];
}

/** Spent so far as the gate counts it (unmeasured never zero; a missing planning share counted). */
export function spentUsd(ledger: StoredLedger): number {
  const items = ledger.items.reduce((sum, item) => sum + gateUsd(item), 0);
  const planning = ledger.items.some((item) => item.kind === "planning") ? 0 : PLANNING_FALLBACK_USD;
  return round(items + planning);
}

/** Only figures we know (measured or estimated), for reporting; unmeasured listed apart. */
export function knownUsd(ledger: Pick<CostLedger, "items">): number {
  return round(ledger.items.reduce((sum, item) => sum + (typeof item.usd === "number" ? item.usd : 0), 0));
}

export type GateResult = { ok: true; ledger: StoredLedger } | { ok: false; ledger: StoredLedger; reason: string };

/**
 * Holds `estimateUsd` for a paid step under `key`, or refuses when the
 * budget would be passed: spent + other holds + this estimate + the safety
 * margin > budget. A repeated key replaces its own hold.
 */
export function holdCost(ledger: StoredLedger, key: string, estimateUsd: number, label: string): GateResult {
  const estimate = Math.max(0, estimateUsd);
  const others = Object.entries(ledger.holds).reduce((sum, [k, usd]) => (k === key ? sum : sum + usd), 0);
  const spent = spentUsd(ledger);
  const needed = round(spent + others + estimate + BUDGET_SAFETY_MARGIN_USD);
  if (needed > ledger.budgetUsd + 1e-9) {
    return {
      ok: false,
      ledger,
      reason: `This video would cost more to make than its $${ledger.budgetUsd.toFixed(2)} production budget: $${spent.toFixed(3)} spent, $${others.toFixed(3)} held, $${estimate.toFixed(3)} for ${label} and a $${BUDGET_SAFETY_MARGIN_USD.toFixed(2)} margin. Nothing more was spent; the credit is returned.`,
    };
  }
  const holds = { ...ledger.holds, [key]: round(estimate) };
  return { ok: true, ledger: { ...ledger, holds, reservedUsd: round(Object.values(holds).reduce((a, b) => a + b, 0)) } };
}

/** Records a cost item, releasing the hold under `key` (if any). */
export function addCost(ledger: StoredLedger, item: Omit<CostItem, "attempt" | "at"> & { at?: string }, key?: string | null, now: Date = new Date()): StoredLedger {
  const holds = { ...ledger.holds };
  if (key) delete holds[key];
  const usd = typeof item.usd === "number" && Number.isFinite(item.usd) ? round(Math.max(0, item.usd)) : null;
  const basis: CostBasis = usd === null ? "unmeasured" : item.basis;
  const entry: CostItem = { kind: item.kind, provider: item.provider, usd, basis, attempt: ledger.attempt, at: item.at ?? now.toISOString(), ...(item.note ? { note: item.note.slice(0, 200) } : {}) };
  return { ...ledger, items: [...ledger.items, entry], holds, reservedUsd: round(Object.values(holds).reduce((a, b) => a + b, 0)) };
}

/** Releases a hold without recording (the step turned out not to be needed). */
export function releaseHold(ledger: StoredLedger, key: string): StoredLedger {
  if (!(key in ledger.holds)) return ledger;
  const holds = { ...ledger.holds };
  delete holds[key];
  return { ...ledger, holds, reservedUsd: round(Object.values(holds).reduce((a, b) => a + b, 0)) };
}

/** A new make attempt: the items stay, stale holds of an attempt that died are dropped. */
export function nextAttempt(ledger: StoredLedger, run: string | null): StoredLedger {
  return { ...ledger, attempt: ledger.attempt + 1, holds: {}, reservedUsd: 0, run };
}

/* ------------------------------------------------------------- estimates */

/** Speech seconds a text takes at an average narration speed (2.6 words/s), for the estimates. */
export function speechSecondsEstimate(texts: string[]): number {
  const words = texts.reduce((n, text) => n + text.trim().split(/\s+/).filter(Boolean).length, 0);
  return words / 2.6 + texts.length * 0.3;
}

export function narrationEstimate(seconds: number): number {
  // Conservative: 25% over the list price for retakes of parts and rounding.
  return round((seconds / 60) * PRICES.ttsPerMinute * 1.25);
}

export function transcriptionEstimate(seconds: number): number {
  return round((Math.max(1, seconds) / 60) * PRICES.whisperPerMinute * 1.25);
}

export function imageEstimate(provider: "openai" | "replicate" | null): number {
  return provider === "replicate" ? PRICES.imageReplicate * 2 : PRICES.imageOpenAiEstimate;
}

export function renderEstimate(videoSeconds: number, format: VideoFormat): number {
  if (format === "carousel") return round(sandboxCostPerMinute() * 3 + PRICES.sandboxCreation);
  return round(sandboxCostPerMinute() * renderMinutesEstimate(videoSeconds) + PRICES.sandboxCreation);
}

/** Storage and transfer of one video's files: ~25 MB kept a few weeks, fetched a few times. */
export function storageEstimate(format: VideoFormat): number {
  const gb = format === "carousel" ? 0.01 : 0.03;
  return round(gb * PRICES.storagePerGbMonth + gb * 4 * PRICES.egressPerGb);
}

export type EstimateInput = {
  direction: CreativeDirection;
  format: VideoFormat;
  production: Pick<ProductionChoices, "audio" | "duration">;
  /** Voice already made (a retry): no narration cost. */
  voiced?: boolean;
  /** AI images the plan may need (0-2). */
  aiImages?: number;
  imageProvider?: "openai" | "replicate" | null;
  /** The voice script's parts, for the speech length; else the duration range's upper end. */
  spokenTexts?: string[];
  /** Recorded so far (planning share etc.). */
  ledger?: StoredLedger | null;
};

export type CostEstimate = {
  items: { kind: CostKind; usd: number; basis: CostBasis; note: string }[];
  totalUsd: number;
  budgetUsd: number;
  marginUsd: number;
  withinBudget: boolean;
  summary: string;
};

/**
 * What making a video is expected to cost internally, by component - for the
 * UI preflight ("internal cost, not a price") and the job's own planning.
 */
export function estimateCost(input: EstimateInput): CostEstimate {
  const range = DURATION_SECONDS[input.production.duration as DurationRange] ?? DURATION_SECONDS["30-45"];
  const story = input.format === "story";
  const seconds = Math.min(range.max, story ? 60 : 90);
  const speech = input.spokenTexts?.length ? Math.min(seconds, speechSecondsEstimate(input.spokenTexts)) : seconds;
  const items: CostEstimate["items"] = [];
  const recordedPlanning = input.ledger?.items.filter((item) => item.kind === "planning") ?? [];
  if (recordedPlanning.length) {
    for (const item of recordedPlanning) items.push({ kind: "planning", usd: gateUsd(item), basis: item.basis, note: "idea writing share (recorded)" });
  } else items.push({ kind: "planning", usd: PLANNING_FALLBACK_USD, basis: "estimated", note: "idea writing share (not recorded; conservative)" });
  const voiced = input.production.audio === "voiceover" && input.format !== "carousel";
  if (voiced && !input.voiced) {
    items.push({ kind: "narration", usd: narrationEstimate(speech), basis: "estimated", note: `about ${Math.round(speech)} s of AI voice` });
    items.push({ kind: "transcription", usd: transcriptionEstimate(speech), basis: "estimated", note: "word timings for the captions" });
  }
  const images = Math.max(0, Math.min(2, input.aiImages ?? 0));
  if (images) items.push({ kind: "image", usd: round(images * imageEstimate(input.imageProvider ?? "openai")), basis: "estimated", note: `${images} original AI image${images > 1 ? "s" : ""}` });
  if (input.direction !== "animated" && input.direction !== "text_music") items.push({ kind: "footage", usd: 0, basis: "estimated", note: "free stock providers; customer media" });
  items.push({ kind: "render", usd: renderEstimate(seconds, input.format), basis: "estimated", note: input.format === "carousel" ? "slides on Vercel Sandbox" : `up to ${seconds} s on Vercel Sandbox (4 vCPU)` });
  items.push({ kind: "storage", usd: storageEstimate(input.format), basis: "estimated", note: "files and transfer" });
  const totalUsd = round(items.reduce((sum, item) => sum + item.usd, 0));
  const budgetUsd = input.ledger?.budgetUsd ?? PRODUCTION_BUDGET_USD;
  const withinBudget = totalUsd + BUDGET_SAFETY_MARGIN_USD <= budgetUsd;
  const summary = `Internal production cost about $${totalUsd.toFixed(2)} of the $${budgetUsd.toFixed(2)} budget (${items
    .filter((item) => item.usd > 0)
    .map((item) => `${item.kind} $${item.usd.toFixed(3)}`)
    .join(", ")})${withinBudget ? "" : " - over budget: it would be refused"}.`;
  return { items, totalUsd, budgetUsd, marginUsd: BUDGET_SAFETY_MARGIN_USD, withinBudget, summary };
}

/** A readable summary of what a video has cost so far. */
export function ledgerSummary(value: unknown): string {
  const ledger = normalLedger(value);
  const unmeasured = ledger.items.filter((item) => item.usd === null);
  const byKind = new Map<string, number>();
  for (const item of ledger.items) byKind.set(item.kind, (byKind.get(item.kind) ?? 0) + (item.usd ?? 0));
  const parts = [...byKind.entries()].map(([kind, usd]) => `${kind} $${usd.toFixed(3)}`);
  return `$${knownUsd(ledger).toFixed(3)} known over ${ledger.attempt} attempt${ledger.attempt === 1 ? "" : "s"}${parts.length ? ` (${parts.join(", ")})` : ""}${
    unmeasured.length ? `; ${unmeasured.length} unmeasured item${unmeasured.length > 1 ? "s" : ""} (counted at a conservative estimate)` : ""
  }; budget $${ledger.budgetUsd.toFixed(2)}.`;
}
