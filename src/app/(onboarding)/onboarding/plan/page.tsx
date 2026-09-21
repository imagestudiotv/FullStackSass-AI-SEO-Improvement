import { redirect } from "next/navigation";

import { OnboardingAside } from "@/components/onboarding/onboarding-aside";
import { TestimonialRail } from "@/components/onboarding/testimonial-rail";
import { WizardProgress } from "@/components/wizard-progress";
import { requireSession } from "@/lib/auth-guard";
import { listPlans } from "@/lib/billing";
import { getOnboardingState } from "@/lib/onboarding/steps";
import { isPayPalAvailable } from "@/lib/paypal/actions";
import { toPickerPlan } from "@/lib/plans/features";
import { requireOrg } from "@/lib/tenant";
import { CheckoutPending } from "./checkout-pending";
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

  /**
   * Just paid, but the subscription has not landed yet.
   *
   * Stripe sends the browser back the instant the payment is authorised,
   * while the subscription row is written by the webhook a moment later —
   * so `hasPlan` above is routinely still false for the first few seconds
   * after a genuine, successful payment.
   *
   * Without this the customer is shown the plan picker again, which reads as
   * "your payment did not work" at the worst possible moment: they have been
   * charged, and the screen is asking them to pay a second time.
   *
   * The waiting screen polls and moves on by itself. Entitlement is NEVER
   * granted from this redirect — it only decides what to show while the
   * webhook, which is the sole source of truth, catches up.
   */
  const returning =
    params.checkout === "success" || params.paypal === "success";
  if (returning) {
    return (
      <div>
        <WizardProgress current="plan" />
        <CheckoutPending websiteId={state.websiteId} />
      </div>
    );
  }

  const monthlyPlans = allPlans
    .filter((plan) => plan.interval === "month")
    .map(toPickerPlan);
  const annualPlans = allPlans
    .filter((plan) => plan.interval === "year")
    .map(toPickerPlan);

  return (
    <div>
      <WizardProgress current="plan" />
      {/*
          Less headroom than the other steps. The client: "move the part a
          little up because the button start free trial is not visible in the
          main block and needs scrolling". On a 700px laptop the CTA started
          around 618px down — inside the viewport by a few pixels, which in
          practice means below the fold once a browser's own chrome is
          counted. Trimming the top padding and the gaps below buys back
          roughly 60px, which puts the button and the price on screen
          together.
        */}
        <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
        {/*
          Equal columns, stretched.

          The rail was 0.85fr against the form's 1fr and sized to its own
          content, so it stopped roughly halfway down and left a block of
          empty panel beside the plan's feature list. The reference runs the
          two columns to the same height at roughly equal width, which is what
          makes them read as one composition rather than a card with a note
          next to it.

          `items-stretch` is the half that matters: without it a grid child
          is sized by its content, and no amount of height inside the aside
          can fill a track that has already collapsed.
        */}
        <div className="grid items-stretch gap-10 lg:grid-cols-2 lg:gap-12">
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
          >
            {/*
              Customer quotes and the public review score, as the reference
              has here. Renders nothing at all while there are none — see
              lib/marketing/testimonials.ts for why that file is empty.
            */}
            <TestimonialRail />
          </OnboardingAside>
        </div>
      </div>
    </div>
  );
}
