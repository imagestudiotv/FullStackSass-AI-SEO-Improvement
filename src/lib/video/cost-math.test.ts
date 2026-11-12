import { describe, expect, it } from "vitest";

import { addCost, emptyLedger, estimateCost, holdCost, nextAttempt, normalLedger, sandboxCost, spentUsd, UNMEASURED_USD } from "./cost-math";
import { BUDGET_SAFETY_MARGIN_USD, PRODUCTION_BUDGET_USD } from "./formats";

/**
 * The production budget gate (client, 2026-11-12: under $0.30 a video):
 * held before each paid step, never reset by a retry, unknown costs never
 * counted as free, the safety margin always kept.
 */

const planning = (usd: number) => ({ kind: "planning" as const, provider: "anthropic", usd, basis: "measured" as const });

describe("the production budget gate", () => {
  it("refuses a step whose estimate would eat into the safety margin", () => {
    let ledger = addCost(emptyLedger(), planning(0.02));
    // 0.02 spent: exactly budget - margin - spent is allowed, a cent more is not.
    const room = PRODUCTION_BUDGET_USD - BUDGET_SAFETY_MARGIN_USD - 0.02;
    const fits = holdCost(ledger, "render", room, "rendering");
    expect(fits.ok).toBe(true);
    ledger = fits.ledger;
    const over = holdCost(ledger, "image:1", 0.01, "an AI image");
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.reason).toMatch(/production budget/);
  });

  it("counts an unmeasured cost at its conservative figure, never as zero", () => {
    const ledger = addCost(addCost(emptyLedger(), planning(0.02)), { kind: "render", provider: "vercel-sandbox", usd: null, basis: "measured" });
    // A null figure is stored as unmeasured whatever basis was claimed.
    expect(ledger.items[1].basis).toBe("unmeasured");
    expect(spentUsd(ledger)).toBeCloseTo(0.02 + UNMEASURED_USD.render, 6);
    expect(holdCost(ledger, "x", PRODUCTION_BUDGET_USD - BUDGET_SAFETY_MARGIN_USD - 0.02 - UNMEASURED_USD.render + 0.001, "x").ok).toBe(false);
  });

  it("counts a missing planning share instead of assuming the idea was free to write", () => {
    expect(spentUsd(emptyLedger())).toBeGreaterThan(0);
  });

  it("keeps every attempt's costs across retries; only the holds of a dead attempt go", () => {
    let ledger = addCost(emptyLedger(), planning(0.02));
    ledger = nextAttempt(ledger, "run-1");
    const held = holdCost(ledger, "narration", 0.03, "voice");
    expect(held.ok).toBe(true);
    ledger = addCost(held.ok ? held.ledger : ledger, { kind: "narration", provider: "openai", usd: 0.02, basis: "estimated" }, "narration");
    ledger = holdCost(ledger, "render", 0.1, "render").ledger;
    // The attempt dies; the customer tries again.
    ledger = nextAttempt(ledger, "run-2");
    expect(ledger.attempt).toBe(2);
    expect(ledger.reservedUsd).toBe(0);
    expect(ledger.items.map((item) => [item.kind, item.attempt])).toEqual([
      ["planning", 0],
      ["narration", 1],
    ]);
    expect(spentUsd(ledger)).toBeCloseTo(0.04, 6);
    // Stored and read back, nothing is lost.
    expect(normalLedger(JSON.parse(JSON.stringify(ledger)))).toEqual(ledger);
  });

  it("re-holds a repeated step under the same key instead of holding twice", () => {
    let ledger = emptyLedger();
    ledger = holdCost(ledger, "render", 0.1, "render").ledger;
    ledger = holdCost(ledger, "render", 0.12, "render").ledger;
    expect(ledger.reservedUsd).toBeCloseTo(0.12, 6);
  });

  it("prices a measured sandbox run at list prices with the 1-minute minimum", () => {
    expect(sandboxCost(10_000)).toBeCloseTo(sandboxCost(60_000), 9);
    // 4 vCPUs busy, 8 GB: about 1.1 cents a minute.
    expect(sandboxCost(5 * 60_000)).toBeGreaterThan(0.05);
    expect(sandboxCost(5 * 60_000)).toBeLessThan(0.06);
  });

  it("fits a standard 30-45 s voiced footage video in the budget, and says so", () => {
    const estimate = estimateCost({ direction: "footage", format: "reel", production: { audio: "voiceover", duration: "30-45" }, aiImages: 0 });
    expect(estimate.withinBudget).toBe(true);
    expect(estimate.items.map((item) => item.kind)).toEqual(["planning", "narration", "transcription", "footage", "render", "storage"]);
    expect(estimate.summary).toMatch(/Internal production cost/);
    // Text + Music has no narration items at all.
    const silent = estimateCost({ direction: "text_music", format: "reel", production: { audio: "text_music", duration: "15-30" } });
    expect(silent.items.some((item) => item.kind === "narration" || item.kind === "transcription")).toBe(false);
  });
});
