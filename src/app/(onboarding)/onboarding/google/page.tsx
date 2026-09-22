import { redirect } from "next/navigation";

import { WizardProgress } from "@/components/wizard-progress";
import { requireSession } from "@/lib/auth-guard";
import { getAnalyticsConnection } from "@/lib/analytics/actions";
import { getOnboardingState } from "@/lib/onboarding/steps";
import { requireOrg } from "@/lib/tenant";
import { GoogleStep } from "./google-step";

export const metadata = { title: "Connect Google" };

export const dynamic = "force-dynamic";

/**
 * Step three: Google Analytics and Search Console.
 *
 * The client put it here — "This is on our onboarding step 3 - Connect
 * Google" — straight after paying. Two reasons that is the right slot:
 * Analytics and Search Console are what make the later screens show real
 * numbers instead of empty states, and an OAuth consent screen is a detour
 * better taken once, early, than met halfway through reading a report.
 *
 * SKIPPABLE, and that is not a detail. OAuth with a third party fails for
 * reasons nothing here controls — a Google account without the right
 * property, an admin who has not granted access, a popup blocker — and a
 * customer who has just paid must never be stuck behind it. Everything after
 * this step works without it; the data simply arrives later.
 */
export default async function OnboardingGooglePage({
  searchParams,
}: PageProps<"/onboarding/google">) {
  await requireSession();
  const { orgId } = await requireOrg();

  const params = await searchParams;
  const siteParam = typeof params.site === "string" ? params.site : undefined;

  const state = await getOnboardingState(orgId, siteParam);
  if (!state.websiteId) redirect("/onboarding/website");

  /*
    Billing is step two, so this and everything after it needs a plan. Same
    guard as the other post-billing steps: without it the screen is reachable
    by typing its URL.
  */
  if (!state.hasPlan) {
    redirect(
      siteParam ? `/onboarding/plan?site=${siteParam}` : "/onboarding/plan",
    );
  }

  const connection = await getAnalyticsConnection(state.websiteId);

  return (
    <div>
      <WizardProgress current="google" />
      <GoogleStep websiteId={state.websiteId} connection={connection} />
    </div>
  );
}
