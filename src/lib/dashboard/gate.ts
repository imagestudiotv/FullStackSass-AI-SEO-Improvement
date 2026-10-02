import "server-only";

import { redirect } from "next/navigation";

import { isEntitledToSpend } from "@/lib/billing/entitled";
import { requirePlan } from "@/lib/billing/require-plan";
import {
  getOnboardingState,
  type OnboardingState,
} from "@/lib/onboarding/steps";
import { requireOrg, requireWebsitePage, type WebsiteContext } from "@/lib/tenant";
import {
  isGuestOnly,
  listAccessibleWebsites,
  pickDashboardSite,
} from "@/lib/websites/accessible";
import {
  listPendingInvitations,
  type PendingInvitation,
} from "@/lib/websites/pending-invitations";
import { readSelectedWebsite } from "@/lib/websites/selected";

/**
 * What /dashboard shows, or where it sends the caller instead.
 *
 *  - "site"        a website's overview. ctx.access says whose: "owner", or
 *                  the "editor" / "viewer" role it was shared with.
 *  - "inactive"    a SHARED website whose owner's plan is not active. Shown as
 *                  a neutral "this website is paused" rather than the owner's
 *                  checkout.
 *  - "invitations" no websites yet (or only an unpaid one of their own), but
 *                  invitations are waiting for this person's verified
 *                  address - shown instead of onboarding or the plan screen.
 *  - "empty"       nothing to show. Rare: an account without any website is
 *                  normally redirected to onboarding first, so this is only
 *                  reached when a site of their own APPEARED between the list
 *                  and the paywall's read of the workspace - the page's old
 *                  "no website yet" state, kept for that case. Never carries
 *                  invitations: with any waiting, "invitations" is returned
 *                  before this.
 *
 * Pending invitations ride along on the other kinds, so they are listed above
 * the overview too: someone with a site of their own can still be invited to
 * somebody else's.
 */
export type DashboardGate =
  | { kind: "site"; ctx: WebsiteContext; invitations: PendingInvitation[] }
  | { kind: "inactive"; ctx: WebsiteContext; invitations: PendingInvitation[] }
  | { kind: "invitations"; invitations: PendingInvitation[] }
  | { kind: "empty" };

/**
 * Whether the owner path below would send the caller away from the dashboard:
 * requirePlan's redirect (a website exists, unpaid), then the onboarding one
 * (no website, setup unfinished). The same two conditions, in the same terms,
 * so the invitee check can ask without redirecting.
 */
function ownerPathRedirects(onboarding: OnboardingState): boolean {
  return onboarding.websiteId
    ? !onboarding.hasPlan
    : !onboarding.complete;
}

/**
 * Decides the dashboard for the signed-in caller. May redirect (to sign-in,
 * the plan screen or onboarding) and so belongs in the page, not an action.
 *
 * WHY IT LIVES HERE AND NOT IN THE PAGE. The dashboard used to ask two
 * questions about the caller's OWN workspace - has it paid, has it finished
 * onboarding - before anything else, and an invited editor's own workspace is
 * always empty. Every invitee was therefore sent to "add your website" while
 * the site they were invited to sat unreachable. The rule is now: those two
 * questions are asked only when the dashboard is about to show a site the
 * caller OWNS (or nothing at all). A shared site is never the caller's to set
 * up or pay for, so it skips both.
 *
 * THE OWNER PATH IS UNCHANGED, in what it checks and in its order: the
 * paywall first, then the onboarding redirect - the same two steps the page
 * took before, against the same workspace. Someone with no shared site and
 * no invitation - every pure owner - always takes it.
 *
 * A DUAL-ROLE USER (own sites and shared ones) gets the shared view when
 * ?site= names a shared site, and their own site's paywall when ?site= names
 * that. A bare /dashboard shows their own site when it is paid for; when it
 * is not, it shows the site shared with them (or the invitations waiting)
 * instead of the plan screen. Otherwise an invitee who once started a site
 * of their own - often by typing the client's domain into "add your
 * website" before they could find the invitation - met that site's paywall
 * on every sign-in, and the plan screen has no way back to the shared site.
 * Their own site is still a click away in the switcher, paywall and all.
 *
 * THE SITE IS LOADED THROUGH requireWebsitePage, never from the list. The
 * list (lib/websites/accessible.ts) only chooses WHICH id to show; the tenant
 * guard decides whether the caller may read it, and its ownerOrgId is the one
 * the overview must bill and count against. A list entry is never passed on
 * as an authority.
 */
export async function resolveDashboard(
  requested: string | null,
): Promise<DashboardGate> {
  const { orgId } = await requireOrg();
  const sites = await listAccessibleWebsites();
  const invitations = await listPendingInvitations();
  const shared = sites.filter((site) => site.access !== "owner");

  /** ?site=, when it names a site this person can open. */
  const asked =
    requested !== null && sites.some((site) => site.id === requested)
      ? requested
      : null;

  /*
    Without one, someone who owns nothing gets the shared site they last
    chose (the remembered-site cookie the switcher and sidebar write), when
    they can still open it. Otherwise the sidebar's "Dashboard", the logo and
    signing in all reset a guest with two shared sites to the first one.
    Owners keep their default - the oldest site they own - and the cookie is
    not read for them.
  */
  let target = pickDashboardSite(
    sites,
    asked ?? ((await isGuestOnly()) ? await readSelectedWebsite() : null),
  );

  /*
    INVITED, AND STUCK ON A SITE OF THEIR OWN. The dashboard defaulted to a
    site this person owns, but it would send them to its plan screen or to
    onboarding, and somebody else's site - or an invitation - is waiting for
    them. Show that instead: the shared site they last chose, else the first;
    or the invitations, when nothing is shared yet. See the dual-role note
    above. Not when ?site= asked for their own site, and never for someone
    with nothing shared and nothing waiting - their path is the owner's.
  */
  if (
    target?.access === "owner" &&
    asked === null &&
    (shared.length > 0 || invitations.length > 0) &&
    ownerPathRedirects(await getOnboardingState(orgId))
  ) {
    if (shared.length === 0) return { kind: "invitations", invitations };
    target = pickDashboardSite(shared, await readSelectedWebsite());
  }

  if (!target || target.access === "owner") {
    /*
      Nothing owned or shared, but an invitation is waiting: show it rather
      than onboarding. This is the person who signed up from an invitation
      email and lost the link on the way - "add your website" would bury the
      one thing they came for. Onboarding is still one click away if they
      have a site of their own.
    */
    if (!target && invitations.length > 0) {
      return { kind: "invitations", invitations };
    }

    // Paywall. See lib/billing/require-plan.ts.
    const onboarding = await requirePlan(orgId);
    /**
     * A customer who has not finished setting up goes to the guided flow
     * rather than an empty dashboard. Redirected here rather than from
     * sign-up so it also catches someone who left halfway and came back days
     * later.
     */
    if (!onboarding.websiteId && !onboarding.complete) {
      redirect("/onboarding");
    }
  }

  if (!target) return { kind: "empty" };

  const ctx = await requireWebsitePage(target.id);

  /*
    A guest is judged on THIS site's plan alone, by the same question the
    server actions ask before spending (it handles agency workspaces). Not
    requirePlan: that would send them into the owner's checkout and name the
    owner's other sites. See requireWebsitePlan.
  */
  if (ctx.access !== "owner" && !(await isEntitledToSpend(ctx.site.id)).ok) {
    return { kind: "inactive", ctx, invitations };
  }

  return { kind: "site", ctx, invitations };
}
