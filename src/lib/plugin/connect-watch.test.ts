import { describe, expect, it } from "vitest";

import { IDLE, reconcileWatch, resumeWatch, watchKey, type WatchedKey, type WatchState } from "./connect-watch";

/**
 * The WordPress card's wait, sequence by sequence: each list of keys is what
 * the server returns on one refresh (lib/plugin/keys.ts listIntegrationKeys).
 */

const k = (keyPrefix: string, over: Partial<WatchedKey> = {}): WatchedKey => ({
  keyPrefix,
  lastUsedAt: null,
  pending: false,
  ...over,
});
const USED = new Date("2026-09-29T12:00:00Z");

/** Feeds refreshes in order; returns every outcome and the final state. */
function play(start: WatchState, refreshes: WatchedKey[][]) {
  let state = start;
  const outcomes: string[] = [];
  for (const keys of refreshes) {
    const next = reconcileWatch(state, keys);
    state = next.state;
    if (next.outcome) outcomes.push(next.outcome);
  }
  return { state, outcomes };
}

describe("the WordPress card's wait", () => {
  it("press, listed, saved in WordPress: connected once", () => {
    const start = watchKey(IDLE, "seo_K1", []);
    const { state, outcomes } = play(start, [
      [], // the refresh can arrive before the new key is listed: not "replaced"
      [k("seo_K1", { pending: true })],
      [k("seo_K1", { lastUsedAt: USED })],
      [k("seo_K1", { lastUsedAt: USED })],
    ]);
    expect(outcomes).toEqual(["connected"]);
    expect(state).toEqual(IDLE);
  });

  it("an install already connected checking in hourly is not a new connection", () => {
    const before = [k("seo_OLD", { lastUsedAt: new Date("2026-09-29T09:00:00Z") })];
    const start = watchKey(IDLE, "seo_K1", before);
    const { state, outcomes } = play(start, [
      [k("seo_OLD", { lastUsedAt: USED }), k("seo_K1", { pending: true })],
    ]);
    expect(outcomes).toEqual([]);
    expect(state.watching).toEqual(["seo_K1"]);
  });

  it("a second press whose key connects ends the wait for both - no 'waiting' beside 'Connected'", () => {
    let start = watchKey(IDLE, "seo_K1", []);
    start = watchKey(start, "seo_K2", []);
    const { outcomes, state } = play(start, [
      [k("seo_K2", { pending: true }), k("seo_K1", { pending: true })],
      // K2 saved; the server no longer lists K1 as pending (superseded).
      [k("seo_K2", { lastUsedAt: USED }), k("seo_K1")],
    ]);
    expect(outcomes).toEqual(["connected"]);
    expect(state).toEqual(IDLE);
  });

  it("another tab's key connecting ends this tab's wait too", () => {
    const start = watchKey(IDLE, "seo_A", []);
    const { outcomes } = play(start, [
      [k("seo_A", { pending: true })],
      [k("seo_B", { lastUsedAt: USED }), k("seo_A")],
    ]);
    expect(outcomes).toEqual(["connected"]);
  });

  it("a watched key revoked before WordPress used it: replaced", () => {
    const start = watchKey(IDLE, "seo_K1", []);
    const { outcomes, state } = play(start, [[k("seo_K1", { pending: true })], []]);
    expect(outcomes).toEqual(["replaced"]);
    expect(state).toEqual(IDLE);
  });

  it("a watched key past its grace period, never used: expired", () => {
    const start = watchKey(IDLE, "seo_K1", []);
    const { outcomes } = play(start, [[k("seo_K1", { pending: true })], [k("seo_K1")]]);
    expect(outcomes).toEqual(["expired"]);
  });

  it("waits on while any watched key is still pending", () => {
    let start = watchKey(IDLE, "seo_K1", []);
    start = watchKey(start, "seo_K2", []);
    const { outcomes, state } = play(start, [
      [k("seo_K1", { pending: true }), k("seo_K2", { pending: true })],
      [k("seo_K2", { pending: true })], // K1 revoked; K2 still on its way
    ]);
    expect(outcomes).toEqual([]);
    expect(state.watching).toEqual(["seo_K2"]);
  });

  it("after a reload: resumes only what the server lists as pending, with used keys as the baseline", () => {
    expect(resumeWatch([k("seo_DONE", { lastUsedAt: USED }), k("seo_OLD")])).toEqual(IDLE);
    const resumed = resumeWatch([k("seo_DONE", { lastUsedAt: USED }), k("seo_WAIT", { pending: true })]);
    expect(resumed).toEqual({ watching: ["seo_WAIT"], seen: ["seo_WAIT"], baseline: ["seo_DONE"] });
    expect(play(resumed, [[k("seo_DONE", { lastUsedAt: USED }), k("seo_WAIT", { lastUsedAt: USED })]]).outcomes).toEqual([
      "connected",
    ]);
  });

  it("pressing again for the same key changes nothing", () => {
    const once = watchKey(IDLE, "seo_K1", []);
    expect(watchKey(once, "seo_K1", [])).toBe(once);
  });

  it("with nothing watched, a refresh changes nothing", () => {
    expect(reconcileWatch(IDLE, [k("seo_X", { lastUsedAt: USED })])).toEqual({ state: IDLE, outcome: null });
  });
});
