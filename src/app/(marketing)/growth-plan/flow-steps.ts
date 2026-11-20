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
 *    its pages, the plan). Then the visitor's own steps: choosing the plan,
 *    the account (left out for someone already signed in when they arrived),
 *    and billing, the last one.
 *  - ANY STEP CAN BE OPENED AT ANY TIME (2026-11-20). A step whose answer is
 *    still on its way shows what RepGet is doing for it and fills in when the
 *    answer arrives; billing before an account shows the order and the way to
 *    the account step.
 *  - A step is DONE once its answer is in (a read step), the visitor has
 *    moved on from it (the plan choice), or the visitor is signed in (the
 *    account). Billing is never done here: it ends on Stripe or PayPal.
 *  - AUTO-CONTINUE (autoAdvanceTarget): only from a read step, only once its
 *    own answer is on screen, one step at a time, and only onto a step that
 *    can show something now: its answer is in, it is the one RepGet is
 *    working on this moment (its card fills live), or it is the plan choice.
 *    Never onto a step that is merely queued behind other work (it would sit
 *    on "waiting"), never out of a step that needs the visitor (the plan
 *    choice, the account, billing), so nothing that needs input is ever
 *    skipped, and never backwards.
 */

export const READ_STEPS = ["business", "pages", "plan"] as const;
export type ReadStepId = (typeof READ_STEPS)[number];
export type StepId = ReadStepId | "choose" | "account" | "billing";

/** Every step, in order. */
export const ALL_STEPS: readonly StepId[] = ["business", "pages", "plan", "choose", "account", "billing"];

/** The steps this visitor walks: no account step for someone signed in on arrival (they skip it). */
export function flowSteps(signedInOnArrival: boolean): StepId[] {
  return ALL_STEPS.filter((id) => !(signedInOnArrival && id === "account"));
}

export function isReadStep(id: StepId): id is ReadStepId {
  return (READ_STEPS as readonly string[]).includes(id);
}

/**
 * How long an answered step stays before continuing by itself: long enough to
 * read its card (explee's demo moves on every 3-5 s; ours carry more words).
 * The steps that need the visitor have none.
 */
export const DWELL_MS: Record<StepId, number | null> = {
  business: 6000,
  pages: 8000,
  plan: 9000,
  choose: null,
  account: null,
  billing: null,
};

/** What is known about the work and the visitor, for the step list. */
export type Progress = {
  /** Each read step's answer is in (a failed check counts: it has something to say). */
  ready: Record<ReadStepId, boolean>;
  /** The read step RepGet is working on now, or null once all are in. */
  working: ReadStepId | null;
  /** The visitor has continued past the plan choice (or came back to the flow with one). */
  chose: boolean;
  /** The visitor has an account and is signed in. */
  signedIn: boolean;
};

export type StepState = "done" | "active" | "next";

export type StepView = {
  id: StepId;
  state: StepState;
  /** RepGet is working on its answer right now. */
  busy: boolean;
  /** Its answer waits for earlier work: it shows what comes, then fills in. */
  queued: boolean;
};

/** Whether a step has what it needs to show its final content. */
export function stepReady(id: StepId, progress: Progress): boolean {
  return isReadStep(id) ? progress.ready[id] : true;
}

function stepDone(id: StepId, progress: Progress): boolean {
  if (isReadStep(id)) return progress.ready[id];
  if (id === "choose") return progress.chose;
  if (id === "account") return progress.signedIn;
  return false;
}

/** Every step's state. Every one can be opened: the list never disables a step. */
export function stepViews(steps: readonly StepId[], viewing: number, progress: Progress): StepView[] {
  return steps.map((id, index) => {
    const ready = stepReady(id, progress);
    return {
      id,
      state: index === viewing ? "active" : stepDone(id, progress) ? "done" : "next",
      busy: !ready && progress.working === id,
      queued: !ready && progress.working !== id,
    };
  });
}

/**
 * Where the step on screen continues to by itself, or null (the rules are at
 * the top of this file).
 */
export function autoAdvanceTarget(steps: readonly StepId[], viewing: number, progress: Progress): number | null {
  const current = steps[viewing];
  if (!current || DWELL_MS[current] === null) return null;
  if (!stepReady(current, progress)) return null;
  const next = steps[viewing + 1];
  if (!next) return null;
  if (isReadStep(next) && !progress.ready[next] && progress.working !== next) return null;
  return viewing + 1;
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
export function countdownRuns(steps: readonly StepId[], viewing: number, progress: Progress, holds: Holds): boolean {
  if (autoAdvanceTarget(steps, viewing, progress) === null) return false;
  return !holds.reducedMotion && !holds.hovering && !holds.focused && !holds.hidden && !holds.paused;
}

/** The step the Continue button opens, or null on the last one. */
export function nextStep(steps: readonly StepId[], viewing: number): number | null {
  return viewing >= steps.length - 1 ? null : viewing + 1;
}

/** The step Back opens, or null on the first one. */
export function previousStep(viewing: number): number | null {
  return viewing <= 0 ? null : viewing - 1;
}

/**
 * Where the flow opens. `?step=billing` is the flow's own continuation (Google
 * sign-in and the sign-in page return the visitor there with their plan); any
 * other value, or none, starts at the beginning.
 */
export function initialStep(steps: readonly StepId[], requested: string | null | undefined): number {
  if (requested === "billing") return Math.max(0, steps.indexOf("billing"));
  return 0;
}

export type BillingPeriod = "month" | "year";

/** `?period=year`, else monthly. */
export function readPeriod(value: string | null | undefined): BillingPeriod {
  return value === "year" ? "year" : "month";
}

/**
 * The flow's address with the visitor's choice, opened at billing: where
 * "Continue with Google" and "Sign in" bring the visitor back once they have
 * an account, so they land on the step they were going to, plan included.
 * A path on this origin (lib/auth/next.ts safeNext keeps it unchanged).
 */
export function flowReturnPath(growthPlanPath: string, domain: string, tier: string | null, period: BillingPeriod): string {
  const params = new URLSearchParams({ domain });
  if (tier) params.set("plan", tier);
  if (period === "year") params.set("period", "year");
  params.set("step", "billing");
  return `${growthPlanPath}?${params.toString()}`;
}

/**
 * The old way, kept as the fallback when something in the flow fails:
 * sign-up, then the website step with the address filled in and the chosen
 * plan carried on to the plan step (onboarding/website reads ?plan=, the plan
 * step preselects it, then checks out through Stripe or PayPal as always).
 * Without a plan: as before.
 */
export function startLinks(signUpPath: string, onboardingPath: string, domain: string, tier: string | null): { signUp: string; googleNext: string } {
  const next = tier ? `${websiteStep(onboardingPath, domain)}&plan=${encodeURIComponent(tier)}` : websiteStep(onboardingPath, domain);
  return { signUp: `${signUpPath}?next=${encodeURIComponent(next)}`, googleNext: next };
}
