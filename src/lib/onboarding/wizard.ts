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
  "website" | "setup" | "plan" | "visibility" | "content" | "done";

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
 * The reference has seven, splitting market, description and competitors into
 * three. Ours are merged into one "About your business" screen at the client's
 * request — "having this 3 options all in one" — and the audit is merged into
 * the website step, because on our side it is the same crawl and a step that
 * completes without the customer doing anything is a dot that flickers past
 * rather than a stage they experience.
 *
 * The plan sits after the business questions, not before: someone is far more
 * willing to pay once they have seen us describe their own business.
 */
export const WIZARD_STEPS: WizardStep[] = [
  { id: "website", label: "Website", href: "/onboarding/website" },
  { id: "plan", label: "Plan", href: "/onboarding/plan" },
  { id: "visibility", label: "AI visibility", href: "/onboarding/visibility" },
  { id: "content", label: "Content & backlinks", href: "/onboarding/content" },
  /*
    The final stop is the dashboard's own setup checklist, not a page inside
    the wizard: signup ends at step five and the remaining work — connecting
    the site, auditing it, switching on the exchange — happens in the product.
  */
  { id: "done", label: "Ready to grow", href: "/setup" },
];

export function wizardStepIndex(id: WizardStepId): number {
  return WIZARD_STEPS.findIndex((step) => step.id === id);
}
