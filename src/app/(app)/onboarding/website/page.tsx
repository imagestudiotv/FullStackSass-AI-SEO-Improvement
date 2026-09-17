import { redirect } from "next/navigation";

import { WizardProgress } from "@/components/wizard-progress";
import { requireSession } from "@/lib/auth-guard";
import { getOnboardingState } from "@/lib/onboarding/steps";
import { requireOrg } from "@/lib/tenant";
import { WebsiteStep } from "./website-step";

export const metadata = { title: "Add your website" };

export const dynamic = "force-dynamic";

/**
 * Step one: the website.
 *
 * The brief: "We start inserting the website .../onboarding/select-website".
 * Everything after this depends on having crawled something, so this is the
 * only screen in setup that cannot be skipped.
 */
export default async function OnboardingWebsitePage() {
  await requireSession();
  const { orgId } = await requireOrg();

  const state = await getOnboardingState(orgId);

  /**
   * NO PLAN GATE HERE — DELIBERATELY.
   *
   * This used to redirect to /onboarding unless a plan was already chosen.
   * That contradicted the checklist, which lists "Add your website" first and
   * "Choose a plan" second: clicking step one bounced you straight back to the
   * list you came from, with nothing on screen explaining why. A customer with
   * no plan could never reach this page at all.
   *
   * The gate was written when a plan carried a website allowance. It no longer
   * does — billing is per website now, so a site is added first and then
   * subscribed, and adding one cannot fail a limit check because there is no
   * limit left to fail. The real gate is that an unsubscribed website cannot
   * generate anything, which checkLimit enforces where the spending happens.
   */

  // Already added: go on to the profile rather than offering to add a second.
  if (state.websiteId) {
    redirect("/onboarding/profile");
  }

  return (
    <div>
      <WizardProgress current="website" />
      <div className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">
          Add your website
        </h1>
        <p className="mt-2 text-muted-foreground">
          We read your pages and work out what your business does, who it is
          for, and who you compete with. It takes a minute or two.
        </p>

        <div className="mt-8">
          <WebsiteStep />
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          You can change any of this later in your account.
        </p>
      </div>
    </div>
  );
}
