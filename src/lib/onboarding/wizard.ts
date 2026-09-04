/**
 * The guided setup wizard.
 *
 * The brief describes a sequence of full pages — insert the website, review
 * what the audit found, choose AI visibility prompts, then content and
 * backlinks — with a progress bar across the top showing where you are.
 *
 * That is a different thing from the checklist on /onboarding, which links out
 * to where each job already happens. The checklist is right for someone coming
 * back to finish setup; the wizard is right for someone doing it the first
 * time, because it keeps them in one place and never shows them a screen they
 * are not ready for.
 *
 * Both read the same derived state, so they can never disagree about what is
 * done.
 */

export type WizardStepId =
  | "website"
  | "profile"
  | "visibility"
  | "content"
  | "done";

export type WizardStep = {
  id: WizardStepId;
  /** Short label under the progress dot. */
  label: string;
  /** Path this step lives at. */
  href: string;
};

/**
 * The steps, in order.
 *
 * The reference has six, splitting "Audit" from "Performance & Strategic
 * Analysis". Ours are merged: both are the same crawl on our side, and a step
 * that completes instantly without the customer doing anything is a dot that
 * flickers past rather than a stage they experience.
 */
export const WIZARD_STEPS: WizardStep[] = [
  { id: "website", label: "Website", href: "/onboarding/website" },
  { id: "profile", label: "Brand profile", href: "/onboarding/profile" },
  { id: "visibility", label: "AI visibility", href: "/onboarding/visibility" },
  { id: "content", label: "Content & backlinks", href: "/onboarding/content" },
  { id: "done", label: "Ready to grow", href: "/onboarding/done" },
];

export function wizardStepIndex(id: WizardStepId): number {
  return WIZARD_STEPS.findIndex((step) => step.id === id);
}
