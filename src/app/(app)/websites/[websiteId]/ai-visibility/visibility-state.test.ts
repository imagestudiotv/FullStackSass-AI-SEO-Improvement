import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { CHECK_WAIT_LIMIT_MS, checkBaseline } from "@/lib/geo/progress";
import type { GeoPromptView } from "@/lib/geo/shared";
import { getMessages } from "@/lib/i18n/messages";

import {
  checkProgress,
  evidenceFor,
  followNewRequest,
  freshnessOf,
  localiseGeoError,
  matchesFilter,
  nextStep,
  parseFilter,
  runBoundaries,
  RUN_GAP_MS,
  trackingFromPress,
  trackingFromRequest,
  type CheckRequest,
  type QuestionDetails,
} from "./visibility-state";

/**
 * The AI Visibility page's states, derived from stored data alone: a check's
 * phase (queued, running, completed, partial, timed out, failed), each
 * question's outcome and freshness, the next action, the list filter and the
 * translated refusals.
 */

const T0 = new Date("2026-10-03T10:00:00Z").getTime();
const at = (minutes: number) => new Date(T0 + minutes * 60_000);

const prompt = (id: string, latestAt: Date | null, over: Partial<GeoPromptView> = {}): GeoPromptView => ({
  id,
  prompt: `Question ${id}?`,
  isSuggested: false,
  active: true,
  latest: latestAt ? { mentioned: false, position: null, excerpt: null, checkedAt: latestAt } : null,
  ...over,
});

const named = (id: string, latestAt: Date, position = 2): GeoPromptView => ({
  ...prompt(id, latestAt),
  latest: { mentioned: true, position, excerpt: "Named here.", checkedAt: latestAt },
});

const request = (over: Partial<CheckRequest> = {}): CheckRequest => ({
  id: "r1",
  requestedAt: at(0),
  elapsedMs: 60_000,
  state: "reserved",
  spendStarted: false,
  ...over,
});

const created = (ids: string[], when = at(-60 * 24)): Record<string, QuestionDetails> =>
  Object.fromEntries(ids.map((id) => [id, { createdAt: when, latest: null, earlier: [] }]));

describe("runBoundaries", () => {
  it("has nothing before the first answer", () => {
    expect(runBoundaries([])).toEqual({ latestStartedAt: null, previousAt: null });
  });

  it("splits runs on gaps longer than an hour, like previousScore does", () => {
    const times = [at(30), at(20), at(0), at(-7 * 24 * 60), at(-7 * 24 * 60 - 15)].map((d) => d.getTime());
    expect(runBoundaries(times)).toEqual({ latestStartedAt: at(0).getTime(), previousAt: at(-7 * 24 * 60).getTime() });
  });

  it("keeps answers exactly an hour apart in one run", () => {
    const times = [T0 + RUN_GAP_MS, T0];
    expect(runBoundaries(times)).toEqual({ latestStartedAt: T0, previousAt: null });
  });
});

describe("a check pressed on this page", () => {
  const before = [prompt("a", at(-60 * 24 * 7)), prompt("b", null), named("c", at(-60 * 24 * 7))];

  it("is queued until its first answer, even while the old request record is still on screen", () => {
    const old = request({ id: "old", state: "released", requestedAt: at(-600) });
    const tracking = trackingFromPress(before, old);
    const progress = checkProgress({ tracking, timedOut: false, prompts: before, request: old, lastCheckedAt: at(-60 * 24 * 7) });
    // The older, released request belongs to an earlier press: not "failed".
    expect(progress.phase).toBe("queued");
    expect(progress.expected).toBe(3);
  });

  it("is running, not complete, when one answer of three has arrived", () => {
    const tracking = trackingFromPress(before, null);
    const after = [prompt("a", at(2)), prompt("b", null), named("c", at(-60 * 24 * 7))];
    const progress = checkProgress({
      tracking,
      timedOut: false,
      prompts: after,
      request: request({ id: "new", state: "consumed", spendStarted: true }),
      lastCheckedAt: at(2),
    });
    expect(progress.phase).toBe("running");
    expect(progress.answered).toBe(1);
    expect(progress.expected).toBe(3);
    expect([...progress.pending].sort()).toEqual(["b", "c"]);
  });

  it("is running once the job has started spending, before any answer", () => {
    const tracking = trackingFromPress(before, null);
    const progress = checkProgress({
      tracking,
      timedOut: false,
      prompts: before,
      request: request({ id: "new", spendStarted: true }),
      lastCheckedAt: null,
    });
    expect(progress.phase).toBe("running");
  });

  it("completes only when every question in it has a newer answer", () => {
    const tracking = trackingFromPress(before, null);
    const after = [prompt("a", at(2)), named("b", at(3)), named("c", at(4))];
    expect(checkProgress({ tracking, timedOut: false, prompts: after, request: null, lastCheckedAt: at(4) }).phase).toBe(
      "completed",
    );
  });

  it("ignores questions added after the press and no longer counts removed ones", () => {
    const tracking = trackingFromPress(before, null);
    const after = [prompt("a", at(2)), named("c", at(4)), prompt("new", null)];
    const progress = checkProgress({ tracking, timedOut: false, prompts: after, request: null, lastCheckedAt: at(4) });
    expect(progress.phase).toBe("completed");
    expect(progress.expected).toBe(2);
  });

  it("ends partial after the wait limit with some answers, timed out with none", () => {
    const tracking = trackingFromPress(before, null);
    const some = [prompt("a", at(2)), prompt("b", null), named("c", at(-60 * 24 * 7))];
    expect(checkProgress({ tracking, timedOut: true, prompts: some, request: null, lastCheckedAt: at(2) }).phase).toBe(
      "partial",
    );
    expect(checkProgress({ tracking, timedOut: true, prompts: before, request: null, lastCheckedAt: null }).phase).toBe(
      "timedOut",
    );
  });

  it("fails when its request was given up on before any answer", () => {
    const tracking = trackingFromPress(before, request({ id: "old" }));
    const released = request({ id: "new", state: "released" });
    expect(checkProgress({ tracking, timedOut: false, prompts: before, request: released, lastCheckedAt: null }).phase).toBe(
      "failed",
    );
  });
});

describe("a check restored from the server on arrival", () => {
  const prompts = [prompt("a", at(-60 * 24)), prompt("b", null)];

  it("follows a request from the last ten minutes, for the time left", () => {
    const tracking = trackingFromRequest(request({ elapsedMs: 4 * 60_000 }), prompts, created(["a", "b"]));
    expect(tracking).not.toBeNull();
    expect(tracking!.waitMs).toBe(CHECK_WAIT_LIMIT_MS - 4 * 60_000);
    expect(checkProgress({ tracking, timedOut: false, prompts, request: request(), lastCheckedAt: null }).phase).toBe(
      "queued",
    );
  });

  it("counts an answer as new only when it is newer than the request", () => {
    const tracking = trackingFromRequest(request(), prompts, created(["a", "b"]));
    const later = [prompt("a", at(3)), prompt("b", null)];
    const progress = checkProgress({
      tracking,
      timedOut: false,
      prompts: later,
      request: request({ state: "consumed" }),
      lastCheckedAt: at(3),
    });
    expect(progress.phase).toBe("running");
    expect(progress.answered).toBe(1);
  });

  it("leaves out questions created after the request, and inactive ones", () => {
    const questions = { ...created(["a"]), b: { createdAt: at(1), latest: null, earlier: [] } };
    const paused = [prompt("a", null), prompt("b", null), prompt("c", null, { active: false })];
    const tracking = trackingFromRequest(request(), paused, { ...questions, ...created(["c"]) });
    expect([...tracking!.baseline.keys()]).toEqual(["a"]);
  });

  it("does not follow an old, a released or a missing request", () => {
    expect(trackingFromRequest(request({ elapsedMs: CHECK_WAIT_LIMIT_MS }), prompts, created(["a", "b"]))).toBeNull();
    expect(trackingFromRequest(request({ state: "released" }), prompts, created(["a", "b"]))).toBeNull();
    expect(trackingFromRequest(null, prompts, created(["a", "b"]))).toBeNull();
  });
});

describe("a check request that appears after the page was rendered", () => {
  const prompts = [prompt("a", at(-60 * 24)), prompt("b", null)];
  const questions = created(["a", "b"]);

  it("is followed when the page was not following a check (another tab, a colleague)", () => {
    const followed = followNewRequest({ tracking: null, timedOut: false, request: request({ id: "theirs" }), prompts, questions });
    expect(followed?.requestId).toBe("theirs");
    expect(checkProgress({ tracking: followed, timedOut: false, prompts, request: request({ id: "theirs" }), lastCheckedAt: null }).phase).toBe(
      "queued",
    );
  });

  it("is left alone while this page is following a check that is still answering", () => {
    const pressed = trackingFromPress(prompts, request({ id: "old", state: "consumed", elapsedMs: 20 * 60_000 }));
    expect(followNewRequest({ tracking: pressed, timedOut: false, request: request({ id: "mine" }), prompts, questions })).toBeNull();
  });

  it("replaces a check that already ended, but never re-follows the one it came from", () => {
    const pressed = trackingFromPress(prompts, request({ id: "old" }));
    expect(followNewRequest({ tracking: pressed, timedOut: true, request: request({ id: "next" }), prompts, questions })?.requestId).toBe(
      "next",
    );
    expect(followNewRequest({ tracking: pressed, timedOut: true, request: request({ id: "old" }), prompts, questions })).toBeNull();
    const restored = trackingFromRequest(request({ id: "r1" }), prompts, questions);
    expect(followNewRequest({ tracking: restored, timedOut: true, request: request({ id: "r1" }), prompts, questions })).toBeNull();
  });

  it("ignores a request that was released or is older than the wait limit", () => {
    expect(followNewRequest({ tracking: null, timedOut: false, request: request({ state: "released" }), prompts, questions })).toBeNull();
    expect(
      followNewRequest({ tracking: null, timedOut: false, request: request({ elapsedMs: CHECK_WAIT_LIMIT_MS }), prompts, questions }),
    ).toBeNull();
    expect(followNewRequest({ tracking: null, timedOut: false, request: null, prompts, questions })).toBeNull();
  });
});

describe("with no check being followed", () => {
  const prompts = [prompt("a", at(-60))];

  it("reports a request that never ran when nothing was answered after it", () => {
    const released = request({ state: "released", requestedAt: at(0) });
    expect(checkProgress({ tracking: null, timedOut: false, prompts, request: released, lastCheckedAt: at(-60) }).phase).toBe(
      "failed",
    );
  });

  it("is idle once answers arrived after that request, and for live requests", () => {
    const released = request({ state: "released", requestedAt: at(0) });
    expect(checkProgress({ tracking: null, timedOut: false, prompts, request: released, lastCheckedAt: at(5) }).phase).toBe(
      "idle",
    );
    expect(
      checkProgress({ tracking: null, timedOut: false, prompts, request: request({ state: "consumed" }), lastCheckedAt: at(5) })
        .phase,
    ).toBe("idle");
  });
});

describe("a question's freshness", () => {
  const latestRun = at(0);
  const idle = checkProgress({ tracking: null, timedOut: false, prompts: [], request: null, lastCheckedAt: null });

  it("is stale when its answer predates the newest run, current otherwise", () => {
    expect(freshnessOf(prompt("old", at(-60 * 24 * 14)), idle, latestRun)).toBe("stale");
    expect(freshnessOf(prompt("new", at(5)), idle, latestRun)).toBe("current");
    expect(freshnessOf(prompt("never", null), idle, latestRun)).toBe("current");
  });

  it("is waiting during a check, and missed once it ended without an answer", () => {
    const prompts = [prompt("a", at(-90)), prompt("b", at(-90))];
    const tracking = { ...trackingFromPress(prompts, null) };
    const answered = [prompt("a", at(3)), prompt("b", at(-90))];
    const running = checkProgress({ tracking, timedOut: false, prompts: answered, request: null, lastCheckedAt: at(3) });
    expect(freshnessOf(answered[0], running, at(3))).toBe("answered");
    expect(freshnessOf(answered[1], running, at(3))).toBe("waiting");
    const ended = checkProgress({ tracking, timedOut: true, prompts: answered, request: null, lastCheckedAt: at(3) });
    expect(ended.phase).toBe("partial");
    expect(freshnessOf(answered[1], ended, at(3))).toBe("missed");
  });
});

describe("evidenceFor", () => {
  const evidence = {
    checkedAt: at(0),
    mentioned: true,
    position: 2,
    assistant: "Claude",
    cited: true,
    competitors: ["Bright Smile"],
    excerpt: "Named here.",
  };

  it("pairs the stored evidence with the overview's latest answer and lists older ones", () => {
    const details: QuestionDetails = {
      createdAt: at(-1000),
      latest: evidence,
      earlier: [{ checkedAt: at(-60 * 24 * 7), mentioned: false, position: null }],
    };
    const result = evidenceFor(named("a", at(0)), details);
    expect(result.evidence).toBe(evidence);
    expect(result.earlier).toHaveLength(1);
  });

  it("shows no mismatched evidence when the two reads disagree during a check", () => {
    const details: QuestionDetails = {
      createdAt: at(-1000),
      latest: { ...evidence, checkedAt: at(5) },
      earlier: [{ checkedAt: at(0), mentioned: true, position: 2 }, { checkedAt: at(-60), mentioned: false, position: null }],
    };
    const result = evidenceFor(named("a", at(0)), details);
    expect(result.evidence).toBeNull();
    expect(result.earlier.map((r) => r.checkedAt)).toEqual([at(-60)]);
  });
});

describe("nextStep", () => {
  const base = { canEdit: true, blocked: false, phase: "idle" as const, latestRunStartedAt: at(0) };

  it("follows the order: viewer, waiting, no questions, blocked, never checked, unchecked, stale, not named", () => {
    expect(nextStep({ ...base, canEdit: false, prompts: [] }).kind).toBe("viewer");
    expect(nextStep({ ...base, phase: "running", prompts: [prompt("a", null)] }).kind).toBe("waiting");
    expect(nextStep({ ...base, prompts: [] }).kind).toBe("addQuestions");
    expect(nextStep({ ...base, blocked: true, prompts: [prompt("a", null)] }).kind).toBe("blocked");
    expect(nextStep({ ...base, prompts: [prompt("a", null)] }).kind).toBe("firstCheck");
    expect(nextStep({ ...base, prompts: [prompt("a", null), named("b", at(1))] })).toEqual({ kind: "unchecked", count: 1 });
    expect(nextStep({ ...base, prompts: [named("a", at(-60 * 48)), named("b", at(1))] })).toEqual({ kind: "stale", count: 1 });
    expect(nextStep({ ...base, prompts: [prompt("a", at(1)), named("b", at(1))] })).toEqual({ kind: "notNamed", count: 1 });
    expect(nextStep({ ...base, prompts: [named("b", at(1))] }).kind).toBe("upToDate");
  });
});

describe("the list filter", () => {
  it("reads ?show= and falls back to all", () => {
    expect(parseFilter("not-named")).toBe("not-named");
    expect(parseFilter(["named", "all"])).toBe("named");
    expect(parseFilter("everything")).toBe("all");
    expect(parseFilter(undefined)).toBe("all");
  });

  it("keeps never-checked questions out of not named", () => {
    expect(matchesFilter(prompt("a", null), "not-named")).toBe(false);
    expect(matchesFilter(prompt("a", null), "not-checked")).toBe(true);
    expect(matchesFilter(prompt("a", at(0)), "not-named")).toBe(true);
    expect(matchesFilter(named("a", at(0)), "named")).toBe(true);
  });
});

describe("localiseGeoError", () => {
  const de = getMessages("de").app;

  it("translates every refusal the geo actions and their guards can return", () => {
    const root = path.resolve(__dirname, "../../../../../..");
    const sources = ["src/lib/geo/actions.ts", "src/lib/websites/require-editor.ts", "src/lib/billing/entitled.ts"]
      .map((file) => readFileSync(path.join(root, file), "utf8"))
      .join("\n");
    const literals = [...sources.matchAll(/error:\s*\n?\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(literals.length).toBeGreaterThan(8);
    for (const literal of literals) {
      expect(localiseGeoError(literal, de.geo, de.workspace), literal).not.toBe(literal);
    }
    expect(localiseGeoError("Your plan tracks up to 50 questions. Remove one to add another.", de.geo, de.workspace)).toBe(
      "Ihr Tarif verfolgt bis zu 50 Fragen. Entfernen Sie eine, um eine andere hinzuzufügen.",
    );
  });

  it("shows an unknown message as written", () => {
    expect(localiseGeoError("Something new", de.geo, de.workspace)).toBe("Something new");
  });
});

it("every language fills the same placeholders and plural forms as English", () => {
  const en = getMessages("en").app.geo;
  const holes = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
  for (const locale of ["es", "fr", "it", "de"] as const) {
    const geo = getMessages(locale).app.geo;
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(holes(geo[key]), `${locale}.${key}`).toBe(holes(en[key]));
      expect(geo[key].split("|").length, `${locale}.${key} plural forms`).toBe(en[key].split("|").length);
      expect(geo[key].trim(), `${locale}.${key}`).not.toBe("");
    }
  }
});

it("the in-page baseline is lib/geo/progress.ts's own", () => {
  const prompts = [prompt("a", at(0)), prompt("b", null)];
  expect(trackingFromPress(prompts, null).baseline).toEqual(checkBaseline(prompts));
});
