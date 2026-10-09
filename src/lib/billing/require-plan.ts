import { redirect } from "next/navigation";

import { isEntitledToSpend } from "@/lib/billing/entitled";
import { getOnboardingState } from "@/lib/onboarding/steps";
import type { WebsiteContext } from "@/lib/tenant";

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

/**
 * THE PAYWALL FOR A WEBSITE PAGE, for whoever is looking at it.
 *
 * OWNERS GET requirePlan, UNCHANGED. Their unpaid site sends them to the plan
 * screen exactly as before; nothing about an owner's paywall or onboarding
 * moves.
 *
 * GUESTS DO NOT. Somebody invited to one website (website_members) is not in
 * the workspace that pays for it, and requirePlan(ownerOrgId) was wrong for
 * them twice over. It sent them into /onboarding/plan - a checkout for a
 * website they do not own, in a flow built for setting up your own - and it
 * named the OWNER's oldest site in the URL (?site=), which may be a site the
 * guest was never invited to. The owner's plan is the owner's business; the
 * guest can only ask them to renew.
 *
 * So a guest is judged on THIS website alone, by the same question the
 * server actions ask before spending: isEntitledToSpend, which reads the
 * site's own subscription and treats an agency workspace as paid. When it
 * says no, they go to the dashboard for this site, which explains that it is
 * paused and who can fix it, and names no other site.
 *
 * Takes the WebsiteContext from requireWebsitePage rather than an org id, so
 * the decision rests on the access the tenant guard actually granted and
 * cannot be asked about a site the caller has not been checked against.
 */
export async function requireWebsitePlan(
  ctx: Pick<WebsiteContext, "access" | "ownerOrgId" | "site">,
): Promise<void> {
  if (ctx.access === "owner") {
    await requirePlan(ctx.ownerOrgId);
    return;
  }

  const entitled = await isEntitledToSpend(ctx.site.id, { freeArticles: true });
  if (!entitled.ok) {
    redirect(`/dashboard?site=${ctx.site.id}`);
  }
}
