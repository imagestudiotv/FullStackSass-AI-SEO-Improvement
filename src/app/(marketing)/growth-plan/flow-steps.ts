import { websiteStep } from "@/app/(marketing)/_home/start-field";

/**
 * The growth plan's steps and when they move on by themselves (Daniel,
 * 2026-11-19: "like explee.com ... all the steps filled, you can choose any
 * step, if you stop on any step it's auto continue, and finally the details
 * to insert the billing information").
 *
 * Pure, so the rules are tested without a browser (flow-steps.test.ts);
 * growth-plan-flow.tsx draws them.
 *
 *  - Three steps show what was read from the visitor's site (the business,
 *    its pages, the plan); the last one is the plan and the way to payment.
 *  - A step is DONE once its answer is in, ACTIVE while on screen, NEXT
 *    otherwise. Any step can be opened once there is something to show: its
 *    answer is in, it is the one being worked on, or it is the last step,
 *    which needs nothing from the analysis (a visitor in a hurry can go
 *    straight to the plans).
 *  - A step whose answer is on screen continues to the next one after a few
 *    seconds, unless the visitor is busy with it. The last step needs the
 *    visitor's choice and an account, so nothing ever moves past it.
 */

export const STEP_IDS = ["business", "pages", "plan", "billing"] as const;
export type StepId = (typeof STEP_IDS)[number];
export type StepIndex = 0 | 1 | 2 | 3;
export const LAST_STEP: StepIndex = 3;

/**
 * How long an answered step stays before continuing by itself: long enough to
 * read its card (explee's demo moves on every 3-5 s; ours carry more words).
 * The steps that need the visitor have none.
 */
export const DWELL_MS: Record<StepId, number | null> = {
  business: 6000,
  pages: 8000,
  plan: 9000,
  billing: null,
};

export type StepState = "done" | "active" | "next";

export type StepView = {
  id: StepId;
  state: StepState;
  /** Can be opened from the step list. */
  reachable: boolean;
  /** Its answer is still on its way. */
  busy: boolean;
};

/**
 * Every step's state.
 *
 * `ready[i]`: step i's answer is in (the last step is always ready).
 * `working`: the step RepGet is working on now, or null once all are in.
 */
export function stepViews(viewing: StepIndex, ready: readonly boolean[], working: StepIndex | null): StepView[] {
  return STEP_IDS.map((id, index) => {
    const isReady = index === LAST_STEP || Boolean(ready[index]);
    return {
      id,
      state: index === viewing ? "active" : isReady && index !== LAST_STEP ? "done" : "next",
      reachable: isReady || index === working,
      busy: index === working && !isReady,
    };
  });
}

/**
 * Where the step on screen continues to by itself, or null: never from a step
 * that needs the visitor, never before its own answer is on screen (the
 * visitor would be moved on from a loading card), never past the last step.
 */
export function autoAdvanceTarget(viewing: StepIndex, ready: readonly boolean[]): StepIndex | null {
  if (DWELL_MS[STEP_IDS[viewing]] === null) return null;
  if (!ready[viewing]) return null;
  return viewing >= LAST_STEP ? null : ((viewing + 1) as StepIndex);
}

/** Why the countdown may stand still: each one stops it on its own. */
export type Holds = {
  /** prefers-reduced-motion: no moving bar and no timed change (the visitor uses Continue). */
  reducedMotion: boolean;
  /** The pointer is over the step's card. */
  hovering: boolean;
  /** The keyboard is in the step's card. */
  focused: boolean;
  /** The tab is hidden. */
  hidden: boolean;
  /** The visitor pressed Pause. */
  paused: boolean;
};

/** Whether the bar fills and the step continues when it is full. */
export function countdownRuns(viewing: StepIndex, ready: readonly boolean[], holds: Holds): boolean {
  if (autoAdvanceTarget(viewing, ready) === null) return false;
  return !holds.reducedMotion && !holds.hovering && !holds.focused && !holds.hidden && !holds.paused;
}

/** The step the Continue button opens, or null on the last one. */
export function nextStep(viewing: StepIndex): StepIndex | null {
  return viewing >= LAST_STEP ? null : ((viewing + 1) as StepIndex);
}

/** The step Back opens, or null on the first one. */
export function previousStep(viewing: StepIndex): StepIndex | null {
  return viewing <= 0 ? null : ((viewing - 1) as StepIndex);
}

/**
 * Sign-up, then the website step with the address filled in and the chosen
 * plan carried on to the plan step (onboarding/website reads ?plan=, the plan
 * step preselects it as it does for the pricing page's buttons, then checks
 * out through Stripe or PayPal as always). Without a plan: as before.
 */
export function startLinks(signUpPath: string, onboardingPath: string, domain: string, tier: string | null): { signUp: string; googleNext: string } {
  const next = tier ? `${websiteStep(onboardingPath, domain)}&plan=${encodeURIComponent(tier)}` : websiteStep(onboardingPath, domain);
  return { signUp: `${signUpPath}?next=${encodeURIComponent(next)}`, googleNext: next };
}
