import { redirect } from "next/navigation";

import { requireSession } from "@/lib/auth-guard";
import { getAppMessages } from "@/lib/i18n/app-locale";
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
export default async function OnboardingWebsitePage({
  searchParams,
}: PageProps<"/onboarding/website">) {
  const session = await requireSession();
  const { orgId } = await requireOrg();
  const { t } = await getAppMessages(session.user.id);

  const params = await searchParams;
  /**
   * Set when the customer came here to add ANOTHER website, from the
   * dashboard or the switcher, rather than being walked through their first.
   */
  const addingAnother = params.next === "1";

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

  /**
   * Already has a website: continue that setup rather than offering to add a
   * second — UNLESS adding another is exactly what was asked for.
   *
   * Without the exception this page was unreachable for anyone who already
   * had a site, which is every customer adding their second one. They got
   * bounced to the profile of a site they set up weeks ago.
   */
  if (state.websiteId && !addingAnother) {
    redirect("/onboarding/plan");
  }

  return (
    /*
      No WizardProgress bar and no page heading here: the step component owns
      its own "STEP 01 / 05" marker and headline, which is what the design
      shows. Two progress indicators on one screen is one too many.
    */
    <div className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
      <WebsiteStep t={t.app.onboarding} />
    </div>
  );
}
