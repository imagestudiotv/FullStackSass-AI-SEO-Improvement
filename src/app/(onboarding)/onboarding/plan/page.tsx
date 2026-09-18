import { redirect } from "next/navigation";

import { OnboardingAside } from "@/components/onboarding/onboarding-aside";
import { WizardProgress } from "@/components/wizard-progress";
import { requireSession } from "@/lib/auth-guard";
import { listPlans } from "@/lib/billing";
import { getOnboardingState } from "@/lib/onboarding/steps";
import { isPayPalAvailable } from "@/lib/paypal/actions";
import { toPickerPlan } from "@/lib/plans/features";
import { requireOrg } from "@/lib/tenant";
import { PlanStep } from "./plan-step";

export const metadata = { title: "Choose your plan" };

export const dynamic = "force-dynamic";

/**
 * Step three: the plan, and then Stripe.
 *
 * The client: "I think after these steps, the user should be redirected to
 * billing page" — agreed, and this is that page, inside the onboarding shell
 * rather than the dashboard's /billing, which carries the sidebar this flow
 * deliberately hides.
 *
 * /billing is NOT replaced: it is where an existing customer changes or
 * cancels a plan, and it keeps its own layout. This screen is the one-time
 * purchase at the end of setup.
 */
export default async function OnboardingPlanPage({
  searchParams,
}: PageProps<"/onboarding/plan">) {
  await requireSession();
  const { orgId } = await requireOrg();

  const params = await searchParams;
  const siteParam = typeof params.site === "string" ? params.site : undefined;

  const [state, paypalAvailable, allPlans] = await Promise.all([
    getOnboardingState(orgId, siteParam),
    isPayPalAvailable(),
    listPlans(),
  ]);

  if (!state.websiteId) redirect("/onboarding/website");

  /**
   * Already paid: there is nothing to buy here.
   *
   * Sends them on rather than showing a plan picker to someone who has a
   * plan — which would read as being asked to pay twice, and on a page whose
   * only button starts a checkout, that is worse than a detour.
   */
  if (state.hasPlan) redirect("/onboarding/visibility");

  const monthlyPlans = allPlans
    .filter((plan) => plan.interval === "month")
    .map(toPickerPlan);
  const annualPlans = allPlans
    .filter((plan) => plan.interval === "year")
    .map(toPickerPlan);

  return (
    <div>
      <WizardProgress current="plan" />
      <div className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] lg:gap-14">
          <div>
            <PlanStep
              monthlyPlans={monthlyPlans}
              annualPlans={annualPlans}
              paypalAvailable={paypalAvailable}
              websiteId={state.websiteId}
            />
          </div>

          <OnboardingAside
            title="What happens the moment you subscribe"
            note="We research your keywords, build a content calendar sized to your plan, and start writing. You will have your first article to review shortly after."
          />
        </div>
      </div>
    </div>
  );
}
