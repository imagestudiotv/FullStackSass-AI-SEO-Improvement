import { describe, expect, it } from "vitest";

import {
  autoAdvanceTarget,
  countdownRuns,
  DWELL_MS,
  flowReturnPath,
  flowSteps,
  compactLogStep,
  initialStep,
  nextStep,
  previousStep,
  readPeriod,
  scrollsToStage,
  showsLog,
  startLinks,
  stepViews,
  type Holds,
  type Progress,
} from "./flow-steps";

/**
 * The growth plan's steps (flow-steps.ts): every one can be opened at any
 * time, which are done, and when the one on screen continues by itself -
 * never before its answer is in, never onto a step that is only queued,
 * never out of a step that needs the visitor, never while the visitor is
 * busy with it, never under reduced motion.
 */

const free: Holds = { reducedMotion: false, focused: false, hidden: false, paused: false };

const progress = (over: Partial<Omit<Progress, "ready">> & { ready?: Partial<Progress["ready"]> } = {}): Progress => ({
  working: null,
  chose: false,
  signedIn: false,
  ...over,
  ready: { business: false, pages: false, plan: false, ...over.ready },
});

const visitor = flowSteps(false);
const member = flowSteps(true);

describe("flowSteps", () => {
  it("walks a visitor through the account; someone signed in on arrival skips it", () => {
    expect(visitor).toEqual(["business", "pages", "plan", "choose", "account", "billing"]);
    expect(member).toEqual(["business", "pages", "plan", "choose", "billing"]);
  });
});

describe("stepViews", () => {
  it("on arrival: the first step on screen and being worked on, the read steps after it queued", () => {
    const views = stepViews(visitor, 0, progress({ working: "business" }));
    expect(views.map((view) => view.state)).toEqual(["active", "next", "next", "next", "next", "next"]);
    expect(views.map((view) => view.busy)).toEqual([true, false, false, false, false, false]);
    expect(views.map((view) => view.queued)).toEqual([false, true, true, false, false, false]);
  });

  it("marks answered steps done, the choice once moved past, the account once signed in; billing never", () => {
    const views = stepViews(visitor, 5, progress({ ready: { business: true, pages: true, plan: true }, chose: true, signedIn: true }));
    expect(views.map((view) => view.state)).toEqual(["done", "done", "done", "done", "done", "active"]);
    expect(stepViews(visitor, 0, progress({ ready: { business: true, pages: true, plan: true } }))[3].state).toBe("next");
  });

  it("has no disabled step: every view is a step that can be opened", () => {
    // The step list renders a button per view with no disabled state (growth-plan.render.test.ts checks the HTML).
    expect(stepViews(visitor, 4, progress({ working: "pages", ready: { business: true } })).map((view) => view.id)).toEqual(visitor);
  });
});

describe("autoAdvanceTarget", () => {
  it("continues an answered read step to the next one, up to the plan choice", () => {
    const all = progress({ ready: { business: true, pages: true, plan: true } });
    expect(autoAdvanceTarget(visitor, 0, all)).toBe(1);
    expect(autoAdvanceTarget(visitor, 1, all)).toBe(2);
    expect(autoAdvanceTarget(visitor, 2, all)).toBe(3);
  });

  it("waits while the step's own answer is still on its way", () => {
    expect(autoAdvanceTarget(visitor, 0, progress({ working: "business" }))).toBeNull();
    expect(autoAdvanceTarget(visitor, 1, progress({ working: "pages", ready: { business: true } }))).toBeNull();
  });

  it("moves onto the step RepGet is working on (it fills live), never onto one only queued", () => {
    expect(autoAdvanceTarget(visitor, 0, progress({ working: "pages", ready: { business: true } }))).toBe(1);
    // The plan's answer waits for the pages, which nobody is working on yet: it would sit on "waiting".
    expect(autoAdvanceTarget(visitor, 1, progress({ working: null, ready: { business: true, pages: true } }))).toBeNull();
  });

  it("never leaves a step that needs the visitor, so the choice, the account and billing are never skipped", () => {
    const all = progress({ ready: { business: true, pages: true, plan: true }, chose: true, signedIn: true });
    for (const steps of [visitor, member]) {
      for (const id of ["choose", "account", "billing"] as const) {
        const index = steps.indexOf(id);
        if (index >= 0) expect(autoAdvanceTarget(steps, index, all)).toBeNull();
      }
    }
    expect(DWELL_MS.choose).toBeNull();
    expect(DWELL_MS.account).toBeNull();
    expect(DWELL_MS.billing).toBeNull();
  });

  it("gives every read step a few seconds", () => {
    for (const id of ["business", "pages", "plan"] as const) {
      expect(DWELL_MS[id]).toBeGreaterThanOrEqual(4000);
      expect(DWELL_MS[id]).toBeLessThanOrEqual(10000);
    }
  });
});

describe("countdownRuns", () => {
  const all = progress({ ready: { business: true, pages: true, plan: true } });

  it("runs on an answered read step nobody is busy with", () => {
    expect(countdownRuns(visitor, 0, all, free)).toBe(true);
  });

  it.each(["reducedMotion", "focused", "hidden", "paused"] as const)("stands still while %s", (hold) => {
    expect(countdownRuns(visitor, 0, all, { ...free, [hold]: true })).toBe(false);
  });

  it("has no hold for reading the page: a scroll, a wheel, a touch or the pointer never stop or restart it (2026-11-21)", () => {
    expect(Object.keys(free).sort()).toEqual(["focused", "hidden", "paused", "reducedMotion"]);
  });

  it("does not run where nothing would follow", () => {
    expect(countdownRuns(visitor, 3, all, free)).toBe(false);
    expect(countdownRuns(visitor, 1, progress({ working: "pages", ready: { business: true } }), free)).toBe(false);
  });
});

describe("Continue, Back and where the flow opens", () => {
  it("move one step and stop at the ends", () => {
    expect(nextStep(visitor, 0)).toBe(1);
    expect(nextStep(visitor, 5)).toBeNull();
    expect(nextStep(member, 4)).toBeNull();
    expect(previousStep(3)).toBe(2);
    expect(previousStep(0)).toBeNull();
  });

  it("opens at billing only for the flow's own return, else at the start", () => {
    expect(initialStep(visitor, "billing")).toBe(5);
    expect(initialStep(member, "billing")).toBe(4);
    expect(initialStep(visitor, "account")).toBe(0);
    expect(initialStep(visitor, null)).toBe(0);
    expect(readPeriod("year")).toBe("year");
    expect(readPeriod("yearly")).toBe("month");
    expect(readPeriod(null)).toBe("month");
  });
});

describe("flowReturnPath", () => {
  it("comes back to this flow at billing with the plan and the period, as a path on this origin", () => {
    const path = flowReturnPath("/es/growth-plan", "https://acme.com/shop", "grow", "year");
    expect(path.startsWith("/es/growth-plan?")).toBe(true);
    const params = new URL(path, "https://x.test").searchParams;
    expect(params.get("domain")).toBe("https://acme.com/shop");
    expect(params.get("plan")).toBe("grow");
    expect(params.get("period")).toBe("year");
    expect(params.get("step")).toBe("billing");
    expect(new URL(flowReturnPath("/growth-plan", "acme.com", "free", "month"), "https://x.test").searchParams.has("period")).toBe(false);
  });
});

describe("startLinks (the old way, kept as the fallback)", () => {
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
  });
});

describe("scrollsToStage", () => {
  it("brings the card back into view only for a step the visitor opened, never on auto-continue", () => {
    expect(scrollsToStage("visitor", -120)).toBe(true);
    expect(scrollsToStage("visitor", 40)).toBe(false);
    expect(scrollsToStage("auto", -120)).toBe(false);
    expect(scrollsToStage("auto", 40)).toBe(false);
  });
});

describe("the work log under its step", () => {
  it("shows a read step's lines while it is on screen or being worked on, never under the visitor's own steps", () => {
    expect(showsLog("business", "business", "pages")).toBe(true);
    expect(showsLog("pages", "business", "pages")).toBe(true);
    expect(showsLog("plan", "business", "pages")).toBe(false);
    expect(showsLog("business", "choose", null)).toBe(false);
    expect(showsLog("choose", "choose", null)).toBe(false);
  });

  it("on a phone: the lines of the step on screen, else of the one being worked on, else none", () => {
    const written = new Set(["business", "pages"] as const);
    expect(compactLogStep("business", "pages", written)).toBe("business");
    expect(compactLogStep("plan", "pages", written)).toBe("pages");
    expect(compactLogStep("choose", null, written)).toBeNull();
    expect(compactLogStep("plan", "plan", written)).toBeNull();
  });
});
