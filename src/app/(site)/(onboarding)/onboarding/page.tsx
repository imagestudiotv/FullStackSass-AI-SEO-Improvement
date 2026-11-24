import { redirect } from "next/navigation";

import { getOnboardingState } from "@/lib/onboarding/steps";
import { requireOrg } from "@/lib/tenant";
import { hasOnlySharedWork } from "@/lib/websites/accessible";

export const metadata = { title: "Get started" };

// Reads live setup state, so it can never be cached.
export const dynamic = "force-dynamic";

/**
 * The entry point to setup: a router, not a screen. Add the website, choose a
 * plan, and the dashboard after that - whichever is next for this person, from
 * the same state the paywall reads, so the two cannot disagree.
 *
 * Sign-up, the lifecycle emails and old links all come here.
 */
export default async function OnboardingPage({
  searchParams,
}: PageProps<"/onboarding">) {
  const { orgId } = await requireOrg();

  /**
   * Which website this run of setup is about. Without it the state describes
   * the oldest site, which is right for a returning customer and wrong the
   * moment someone adds another one.
   */
  const params = await searchParams;
  const siteParam = typeof params.site === "string" ? params.site : undefined;

  const state = await getOnboardingState(orgId, siteParam);

  if (!state.websiteId) {
    /**
     * INVITED, NOT SETTING UP. Somebody who owns no website but can open one
     * that was shared with them (website_members), or has an invitation waiting
     * for their proven address, came to work on somebody else's site: the
     * dashboard shows the shared site or the invitation. Without this the
     * dashboard sent them here, and here sent them to "add your website".
     * Someone who also wants a site of their own still reaches the form through
     * "Add website", which asks for /onboarding/website?next=1.
     *
     * "Owns nothing" is read from the list (hasOnlySharedWork) rather than taken
     * from the empty websiteId: ?site= naming a site outside this workspace also
     * leaves websiteId empty, and an owner who followed such a link keeps the
     * flow they had.
     */
    redirect((await hasOnlySharedWork()) ? "/dashboard" : "/onboarding/website");
  }

  const site = siteParam ? `?site=${encodeURIComponent(state.websiteId)}` : "";
  redirect(state.hasPlan ? `/dashboard${site}` : `/onboarding/plan${site}`);
}
