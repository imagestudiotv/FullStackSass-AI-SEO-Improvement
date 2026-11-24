import { notFound, redirect } from "next/navigation";

import { getOnboardingState } from "@/lib/onboarding/steps";
import { requireOrg } from "@/lib/tenant";
import { hasOnlySharedWork } from "@/lib/websites/accessible";

export const dynamic = "force-dynamic";

/**
 * The setup steps that are gone (Daniel, 2026-11-24: "delete all this steps
 * and redirect straight to the dashboard"), and where their job is done now.
 * Their addresses are in browser histories, in old emails, and in checkouts
 * and Google sign-ins that were open when the steps went.
 */
const MOVED: Record<string, (websiteId: string) => string> = {
  google: (id) => `/websites/${id}/google`,
  visibility: (id) => `/websites/${id}/ai-visibility`,
  content: (id) => `/websites/${id}/content`,
  profile: (id) => `/websites/${id}/profile`,
  setup: (id) => `/tasks?site=${id}`,
  done: (id) => `/dashboard?site=${id}`,
};

/**
 * Never a loop: no website goes to the website step, a website without a plan
 * to the plan step, and neither of those ever leads back here. Somebody who
 * only works on a shared website goes to the dashboard, which shows it.
 */
export default async function RetiredStepPage({ params, searchParams }: PageProps<"/onboarding/[step]">) {
  const { step } = await params;
  const moved = Object.hasOwn(MOVED, step) ? MOVED[step] : undefined;
  if (!moved) notFound();

  const { orgId } = await requireOrg();
  const query = await searchParams;
  const asked = typeof query.site === "string" ? query.site : undefined;
  const state = await getOnboardingState(orgId, asked);

  if (!state.websiteId) redirect((await hasOnlySharedWork()) ? "/dashboard" : "/onboarding/website");
  if (!state.hasPlan) redirect(`/onboarding/plan?site=${state.websiteId}`);

  const to = moved(state.websiteId);
  // How a trip to Google ended (?google=connected|cancelled|...): the Google page says it.
  const google = step === "google" && typeof query.google === "string" ? `?google=${encodeURIComponent(query.google)}` : "";
  redirect(`${to}${google}`);
}
