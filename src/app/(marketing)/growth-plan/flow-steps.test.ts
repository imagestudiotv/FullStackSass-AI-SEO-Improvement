import { describe, expect, it } from "vitest";

import { autoAdvanceTarget, countdownRuns, DWELL_MS, nextStep, previousStep, startLinks, STEP_IDS, stepViews, type Holds } from "./flow-steps";

/**
 * The growth plan's steps (flow-steps.ts): which can be opened, which are
 * done, and when the one on screen continues by itself - never before its
 * answer is in, never while the visitor is busy with it, never under reduced
 * motion, never past the plans, which wait for the visitor.
 */

const free: Holds = { reducedMotion: false, hovering: false, focused: false, hidden: false, paused: false };

describe("stepViews", () => {
  it("on arrival: the first step on screen and being worked on, the plans open, the rest next", () => {
    const views = stepViews(0, [false, false, false], 0);
    expect(views.map((view) => view.state)).toEqual(["active", "next", "next", "next"]);
    expect(views.map((view) => view.reachable)).toEqual([true, false, false, true]);
    expect(views.map((view) => view.busy)).toEqual([true, false, false, false]);
  });

  it("marks answered steps done and lets any of them be opened", () => {
    const views = stepViews(1, [true, true, false], 2);
    expect(views.map((view) => view.state)).toEqual(["done", "active", "next", "next"]);
    expect(views.map((view) => view.reachable)).toEqual([true, true, true, true]);
    expect(views[2].busy).toBe(true);
  });

  it("never marks the plans done: they are chosen, not found", () => {
    expect(stepViews(0, [true, true, true], null)[3].state).toBe("next");
    expect(stepViews(3, [true, true, true], null).map((view) => view.state)).toEqual(["done", "done", "done", "active"]);
  });
});

describe("autoAdvanceTarget", () => {
  it("continues an answered step to the next one", () => {
    expect(autoAdvanceTarget(0, [true, false, false])).toBe(1);
    expect(autoAdvanceTarget(1, [true, true, false])).toBe(2);
    expect(autoAdvanceTarget(2, [true, true, true])).toBe(3);
  });

  it("waits while the step's own answer is still on its way", () => {
    expect(autoAdvanceTarget(0, [false, false, false])).toBeNull();
    expect(autoAdvanceTarget(1, [true, false, false])).toBeNull();
  });

  it("never moves past the plans, which need the visitor", () => {
    expect(autoAdvanceTarget(3, [true, true, true])).toBeNull();
    expect(DWELL_MS.billing).toBeNull();
  });

  it("gives every other step a few seconds", () => {
    for (const id of STEP_IDS.filter((step) => step !== "billing")) {
      expect(DWELL_MS[id]).toBeGreaterThanOrEqual(4000);
      expect(DWELL_MS[id]).toBeLessThanOrEqual(10000);
    }
  });
});

describe("countdownRuns", () => {
  const ready = [true, true, true];

  it("runs on an answered step nobody is busy with", () => {
    expect(countdownRuns(0, ready, free)).toBe(true);
  });

  it.each(["reducedMotion", "hovering", "focused", "hidden", "paused"] as const)("stands still while %s", (hold) => {
    expect(countdownRuns(0, ready, { ...free, [hold]: true })).toBe(false);
  });

  it("does not run where nothing would follow", () => {
    expect(countdownRuns(3, ready, free)).toBe(false);
    expect(countdownRuns(1, [true, false, false], free)).toBe(false);
  });
});

describe("Continue and Back", () => {
  it("move one step and stop at the ends", () => {
    expect(nextStep(0)).toBe(1);
    expect(nextStep(3)).toBeNull();
    expect(previousStep(3)).toBe(2);
    expect(previousStep(0)).toBeNull();
  });
});

describe("startLinks", () => {
  it("without a plan: sign-up then the website step, exactly as before", () => {
    expect(startLinks("/sign-up", "/onboarding/website", "acme.com", null)).toEqual({
      signUp: `/sign-up?next=${encodeURIComponent("/onboarding/website?domain=acme.com")}`,
      googleNext: "/onboarding/website?domain=acme.com",
    });
  });

  it("carries the chosen plan to the website step, which hands it to the plan step", () => {
    const links = startLinks("/es/sign-up", "/es/onboarding/website", "https://acme.com/shop", "grow");
    expect(links.googleNext).toBe(`/es/onboarding/website?domain=${encodeURIComponent("https://acme.com/shop")}&plan=grow`);
    expect(links.signUp).toBe(`/es/sign-up?next=${encodeURIComponent(links.googleNext)}`);
    expect(new URL(links.signUp, "https://x.test").searchParams.get("next")).toBe(links.googleNext);
  });
});
