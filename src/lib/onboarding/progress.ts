/**
 * THE set-up count. One definition, read by every screen that shows one: the
 * sidebar's "Setup n/total", the Setup page's dial and "n steps left", the
 * floating set-up tracker, and the Tasks page's ring.
 *
 * They used to count four different things - the sidebar every row including
 * the closing "Launched live" summary (4/9), the Setup page only the required
 * steps left (3 steps left), Tasks the steps plus the social and video
 * accounts (4/10) - so one customer read three numbers for one checklist.
 *
 * Counted: the REQUIRED steps only. An optional step (Search Console) is
 * shown as "Optional" until it is done and never counts either way, so
 * connecting it is never needed to finish, and "steps left" is exactly
 * total - done. The "Launched live" row is a summary, not a step.
 *
 * No server import: client components (the tracker) use it too.
 */
export type CountedStep = { id: string; done: boolean; optional: boolean };

export type SetupProgress = {
  /** Required steps done. */
  done: number;
  /** Required steps in all. */
  total: number;
  /** Required steps still to do: total - done. */
  remaining: number;
};

/** The id of the closing summary row (lib/onboarding/launch.ts), never counted. */
export const LAUNCHED_STEP_ID = "launched";

export function countedSteps<T extends CountedStep>(steps: readonly T[]): T[] {
  return steps.filter((step) => step.id !== LAUNCHED_STEP_ID && !step.optional);
}

export function setupProgress(steps: readonly CountedStep[]): SetupProgress {
  const counted = countedSteps(steps);
  const done = counted.filter((step) => step.done).length;
  return { done, total: counted.length, remaining: counted.length - done };
}
