/**
 * The guided setup: add the website, choose a plan, and into the dashboard.
 *
 * It used to go on - Connect Google, AI visibility, the content plan, the
 * setup checklist. Daniel, 2026-11-24: "delete all this steps and redirect
 * straight to the dashboard ... all will be possible to set all steps adding
 * connect on the tasks dashboard and chat we have". Their old addresses send
 * people on (app/(onboarding)/onboarding/[step]), and each is a task
 * (lib/tasks/tasks.ts ONBOARDING_STEP_TASKS).
 */

export type WizardStepId = "website" | "plan";

export type WizardStep = {
  id: WizardStepId;
  /** Short label under the progress dot. */
  label: string;
  /** Path this step lives at. */
  href: string;
};

/** The steps, in order. The plan step is where someone pays or starts Free. */
export const WIZARD_STEPS: WizardStep[] = [
  { id: "website", label: "Website", href: "/onboarding/website" },
  { id: "plan", label: "Plan", href: "/onboarding/plan" },
];

export function wizardStepIndex(id: WizardStepId): number {
  return WIZARD_STEPS.findIndex((step) => step.id === id);
}
