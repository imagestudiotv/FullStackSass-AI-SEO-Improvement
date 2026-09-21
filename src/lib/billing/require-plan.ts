import { redirect } from "next/navigation";

import { getOnboardingState } from "@/lib/onboarding/steps";

/**
 * THE PAYWALL. Call at the top of every page that a plan pays for.
 *
 * WHY THIS EXISTS: a customer who had added a website but not paid could
 * reach the whole dashboard by pressing Back twice from the plan screen. The
 * onboarding steps after billing each check hasPlan, so the wizard itself was
 * sealed — but /dashboard only checked `!websiteId && !complete`, which
 * someone mid-signup passes: they HAVE a website, they simply have not bought
 * anything. An audit of (app) found entitlement checks on two pages out of
 * twenty; Planned Articles, Backlink Exchange, Website Health, Google
 * Results, AI Visibility and Losing Traffic had none.
 *
 * NOT IN THE LAYOUT, though that was the first instinct. A layout wraps
 * /billing and /settings too, and a redirect there would lock an unpaid
 * customer out of the only screen where they can pay — a paywall that
 * prevents payment. A server layout also cannot read the pathname without
 * adding middleware, so it cannot make the exception itself.
 *
 * So it is a function each gated page calls. Two rules keep that honest:
 * every NEW page under (app) calls this unless it is deliberately free, and
 * the free list is short enough to state — billing, settings, and the admin
 * area, which has its own guard.
 *
 * Returns the state it read, so a caller that needs websiteId does not query
 * it twice; getOnboardingState is request-cached, so this is one query per
 * request no matter how many callers there are.
 */
export async function requirePlan(orgId: string) {
  const onboarding = await getOnboardingState(orgId);

  /**
   * Only redirects when a website EXISTS but is unpaid.
   *
   * Someone with no website at all is earlier in the flow than this — the
   * page's own onboarding redirect sends them to add one, and bouncing them
   * to a plan screen for a website they have not created yet would be a loop.
   */
  if (onboarding.websiteId && !onboarding.hasPlan) {
    redirect(`/onboarding/plan?site=${onboarding.websiteId}`);
  }

  return onboarding;
}
