import { and, asc, eq, isNull, sql as raw } from "drizzle-orm";
import Link from "next/link";

import { AppSidebar } from "@/components/app-sidebar";
import { MobileNav } from "@/components/mobile-nav";
import { NotificationBell } from "@/components/notification-bell";
import { BrandLogo, BrandMark } from "@/components/brand-logo";
import { LiveChat } from "@/components/live-chat";
import { SidebarNav } from "@/components/sidebar-nav";
import { SidebarUsage } from "@/components/sidebar-usage";
import { UserMenu } from "@/components/user-menu";
import { WebsiteSwitcher } from "@/components/dashboard/website-switcher";
import { isAdmin } from "@/lib/admin/guard";
import { requireSession } from "@/lib/auth-guard";
import { getAppMessages } from "@/lib/i18n/app-locale";
import { db } from "@/lib/db";
import { addons, notifications, organization } from "@/lib/db/schema";
import { ReferralClaim } from "@/components/referral-claim";
import { ResearchWatcher } from "@/components/research-watcher";
import { readReferralCookie } from "@/lib/referrals/cookie";
import { getLaunchState } from "@/lib/onboarding/launch";
import { SetupTracker } from "@/components/setup-tracker";
import { getSubscription } from "@/lib/billing";
import { requireOrg } from "@/lib/tenant";
import {
  hasOnlySharedWork,
  listAccessibleWebsites,
} from "@/lib/websites/accessible";
import { readSelectedWebsite, resolveWebsiteId } from "@/lib/websites/selected";

/**
 * Every authenticated route is per-request by definition: it reads the
 * caller's session and their organization's data. Without this Next tries to
 * prerender them at build time, which needs the auth secrets and fails a
 * deploy on any host where they are set as runtime-only variables.
 */
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await requireSession();

  /*
    requireOrg creates the workspace for an account that has none - see its
    comment. That recovery used to live here, but this layout renders in
    parallel with the page, so the page crashed before it ran.
  */
  const { orgId } = await requireOrg();

  /**
   * Every website this person can open, for the switcher in the header and
   * to work out which one the sidebar's sections belong to: the workspace's
   * own, oldest first, then the ones shared with them, in the order they were
   * granted (lib/websites/accessible.ts).
   *
   * Not just the workspace's own any more. An invited editor is not in the
   * owner's workspace, and their own workspace is empty, so an owned-only
   * list gave them no switcher and a sidebar with nothing in it - the site
   * they were invited to was reachable only by typing its URL.
   *
   * FOR CHOOSING, NOT FOR READING. Every page these ids lead to checks access
   * again through requireWebsitePage; nothing below reads a site's data on
   * the strength of being in this list. Nor does the list carry any
   * organisation id, which matters because it is handed to the switcher, a
   * client component.
   */
  const accessibleWebsites = await listAccessibleWebsites();

  /**
   * The website to fall back to when the address does not name one.
   *
   * The last one chosen, or the first in the list - the oldest site they own,
   * or the first shared with them if they own none, the same default the
   * dashboard picks. The sidebar prefers the id in the URL and only uses this
   * when there is none — it knows the pathname on the client, and a layout
   * cannot read it without adding middleware for one value.
   */
  const remembered = await readSelectedWebsite();
  const fallbackWebsiteId = resolveWebsiteId(
    null,
    remembered,
    accessibleWebsites.map((site) => site.id),
  );
  const selected =
    accessibleWebsites.find((site) => site.id === fallbackWebsiteId) ?? null;

  /**
   * Whose site the shell is showing, which decides what it offers.
   *
   * selectedOwned: the selected site belongs to this workspace. Only then is
   * its launch checklist, its credits and its add-ons this person's business;
   * on a site shared with them those are the owner's, and offering them would
   * sell an invitee credits that can never be spent on the site they work on.
   *
   * sharedWorkOnly: they own nothing and came for somebody else's site - one
   * shared with them, or an invitation still waiting (hasOnlySharedWork in
   * lib/websites/accessible.ts, the same rule the setup entry pages use; the
   * list it reads is the request-cached one above). Their own workspace has
   * no site to buy add-ons or spend credits on, whichever site is selected -
   * including none, on the dashboard that lists only their invitations.
   * A dual-role user (own sites and shared ones) is NOT this - billing is
   * still theirs for their own sites.
   */
  const selectedOwned = selected?.access === "owner";
  const selectedShared = selected !== null && !selectedOwned;
  const sharedWorkOnly = await hasOnlySharedWork();

  /**
   * Whether to keep "Set up" in the sidebar, and what the floating tracker
   * should list.
   *
   * The LAUNCH state now, not the signup wizard's: signup is finished by the
   * time anyone sees this sidebar, and what is left is connecting the site,
   * auditing it, switching on the exchange and so on. Null when the workspace
   * has no website yet, in which case there is nothing to check off.
   *
   * Computed for a shared site too, but only `researching` is used from it
   * then (see ResearchWatcher below). getLaunchState reads nothing but rows
   * keyed on this website id - no workspace, plan or credit data - and the
   * guard on every page already lets this person read the site, so it tells
   * them nothing new. The checklist itself is the owner's to-do list, so it
   * stays off a guest's screen.
   */
  const launch = fallbackWebsiteId
    ? await getLaunchState(fallbackWebsiteId)
    : null;
  const ownedLaunch = selectedOwned ? launch : null;

  /**
   * "Set up" in the sidebar: hidden when finished, when there is no website,
   * and on a shared site, where the steps are for the owner to take.
   */
  const onboardingComplete = ownedLaunch ? ownedLaunch.live : true;
  const setupProgress = ownedLaunch
    ? { done: ownedLaunch.doneCount, total: ownedLaunch.steps.length }
    : null;

  /**
   * Add-ons are bought by this workspace for this workspace's sites. Hidden
   * for someone who owns no site but came for somebody else's, and while a
   * shared site is selected, where "buy credits" reads as buying them for
   * the site on screen - which they would not be. A brand-new customer with
   * nothing at all still sees them.
   */
  const hideAddons = sharedWorkOnly || selectedShared;

  /**
   * What the switcher needs and no more. The list's other columns (status,
   * dates, the URL) are not secrets, but nothing in the menu reads them and
   * every field handed to a client component is a field it can leak later.
   */
  const switcherWebsites = accessibleWebsites.map((site) => ({
    id: site.id,
    domain: site.domain,
    brandName: site.brandName,
    access: site.access,
  }));
  const switcherCurrent =
    switcherWebsites.find((site) => site.id === fallbackWebsiteId) ?? null;

  /** Plan name for the chat widget, so support can see what they pay for. */
  const subscription = await getSubscription(orgId);
  // Only admins see the link; the area itself 404s for everyone else.
  const admin = await isAdmin();
  const { t } = await getAppMessages(session.user.id);

  const org = await db.query.organization.findFirst({
    where: eq(organization.id, orgId),
  });

  /**
   * A referral left by a /r/CODE visit is attached by <ReferralClaim>, a
   * Server Action, because clearing the cookie is a write and a render cannot
   * do it (lib/referrals/actions.ts). Reading it here is free; with no cookie
   * nothing is rendered and nothing runs.
   */
  const referralPending = Boolean(await readReferralCookie());

  /**
   * Queried here rather than inside the bell so the badge is right on first
   * paint — a count that appears a moment after the page reads as a glitch.
   * The layout is already force-dynamic, so this adds a query, not a render.
   */
  const [unreadRow] = await db
    .select({ n: raw<number>`count(*)::int` })
    .from(notifications)
    .where(
      and(
        eq(notifications.organizationId, orgId),
        isNull(notifications.readAt),
      ),
    );
  const unread = unreadRow?.n ?? 0;

  /**
   * What the Add-ons menu expands into.
   *
   * The active catalogue, not what this account has bought: the item exists
   * to show people what they can buy, and a customer who has bought nothing
   * is exactly who it is for. Selected straight from the table rather than
   * through listAddons() because this is a render, not an action, and the
   * sidebar needs only the name.
   */
  const addonRows = await db
    .select({ id: addons.id, name: addons.name, kind: addons.kind })
    .from(addons)
    .where(eq(addons.isActive, true))
    .orderBy(asc(addons.sortOrder));

  /**
   * The credit packs collapse into one entry.
   *
   * There are three of them — 10, 25 and 50 link credits — which are one
   * offering at three prices, not three destinations. Listed separately they
   * fill the sidebar with near-identical lines and push the allowance strip
   * below the fold, while telling the customer nothing they cannot see on the
   * panel itself. Which size to buy is a decision made there.
   */
  const creditPack = addonRows.find((row) => row.kind === "credits");
  const sidebarAddons = [
    ...(creditPack ? [{ id: creditPack.id, name: "Link credits" }] : []),
    ...addonRows
      .filter((row) => row.kind !== "credits")
      .map((row) => ({ id: row.id, name: row.name })),
  ];

  return (
    <div className="flex min-h-svh flex-col bg-muted/30">
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <MobileNav
          t={t.app.nav}
          onboardingComplete={onboardingComplete}
          setupProgress={setupProgress}
          selectedWebsiteId={fallbackWebsiteId}
          addons={sidebarAddons}
          hideAddons={hideAddons}
        />
        <Link
          href="/dashboard"
          aria-label="RepGet"
          className="flex items-center"
        >
          <span className="sm:hidden">
            <BrandMark size={24} />
          </span>
          <span className="hidden sm:inline-flex">
            <BrandLogo height={22} priority />
          </span>
        </Link>

        {/*
          The website switcher sits beside the workspace picker, in the header
          rather than on the dashboard, because the sidebar now shows a
          website's sections everywhere — and changing site from the sidebar
          would otherwise mean going back to the dashboard first.

          Hidden with no websites: an empty menu offering nothing to switch to
          is worse than no menu. Shared sites are in it, after the owned ones
          and under their own heading, so an invitee can find the site they
          were invited to without typing its address.
        */}
        {switcherCurrent ? (
          <div className="hidden md:block">
            <WebsiteSwitcher
              websites={switcherWebsites}
              current={switcherCurrent}
              compact
              t={t.app.dash}
            />
          </div>
        ) : null}

        <div className="ml-auto flex items-center gap-1">
          {/*
            The admin link moved into the account menu.

            It was a header button here and NOWHERE ELSE, so it disappeared
            the moment an administrator left this route group - including on
            /onboarding, which is where signing in with a fresh admin account
            actually lands. The account menu is rendered by both layouts, so
            one entry covers every authenticated screen.
          */}
          {/*
            Count is rendered on the server so the badge is correct on first
            paint. The list itself loads when the bell is opened.
          */}
          <NotificationBell initialUnread={unread} t={t.app.auth} />
          <UserMenu
            name={session.user.name}
            email={session.user.email}
            image={session.user.image}
            isAdmin={admin}
            adminLabel={t.app.common.admin}
          />
        </div>
      </header>

      <div className="flex flex-1">
        <AppSidebar>
          <SidebarNav
            t={t.app.nav}
            onboardingComplete={onboardingComplete}
            setupProgress={setupProgress}
            selectedWebsiteId={fallbackWebsiteId}
            addons={sidebarAddons}
            hideAddons={hideAddons}
          />
          {/*
            Plan usage under the navigation: what is left this month, and
            where to go when it runs out.

            No credit figure on a shared site. `orgId` is this person's own
            workspace, so the number would be THEIR balance shown beside the
            owner's site - credits that cannot be spent there (spending is
            charged to the site's owner; see WebsiteContext.ownerOrgId). The
            article allowance stays: it belongs to the site, and is what an
            editor actually works against. Nor for someone who owns nothing
            and has only invitations: "0 backlink credits" there invites a
            purchase for a site they do not have.
          */}
          <SidebarUsage
            organizationId={orgId}
            websiteId={fallbackWebsiteId}
            showCredits={!selectedShared && !sharedWorkOnly}
            t={t.app.nav}
          />
        </AppSidebar>
        {/*
          The page content sits on a slightly tinted ground while cards are
          plain background, so cards read as raised surfaces without needing
          heavy shadows.
        */}
        {/*
          A TINTED CONTENT AREA, so the white cards on it have something to
          sit against.

          --background and --card are both pure white in the light theme, so
          every panel was white-on-white and the page read as one flat sheet
          with hairline borders - the client: "the each tabs are too white in
          UI side". muted/40 is a very light grey: enough for a card to look
          like a card, not so much that the page looks grey.

          Left on the MAIN element rather than the cards, so every page gains
          it at once and nothing has to remember to opt in.
        */}
        {referralPending ? <ReferralClaim /> : null}
        <main className="min-w-0 flex-1 bg-muted/40 px-4 py-6 md:px-8 md:py-8">
          {children}
        </main>
      </div>

      {/*
        Chat here as well as on the marketing site — the brief asks for it on
        the whole website, and a customer with a problem is more likely to ask
        from inside the product than to find the contact page.

        Identified, unlike the anonymous marketing widget. Crisp sees the
        email, name, workspace and plan, and nothing else: page contents are
        never sent, so a customer's own data stays out of a third party.
      */}
      {/*
        The floating setup panel, above the chat launcher. Renders nothing once
        the required steps are done, when there is no website yet, or when the
        selected website is one shared with this person - its launch steps are
        the owner's to take, and several (connecting the site, the exchange)
        are refused to anyone but the owner anyway.
      */}
      {ownedLaunch && fallbackWebsiteId ? (
        <SetupTracker steps={ownedLaunch.steps} t={t.app.common} />
      ) : null}
      {/*
        Every screen follows a content plan being built, not only Planned
        Articles. Any selected site, shared ones included: an editor waiting
        on research wants the page to update as much as the owner does, and
        all this renders is a refresh timer.
      */}
      {launch?.researching ? <ResearchWatcher /> : null}

      <LiveChat
        user={{
          email: session.user.email,
          name: session.user.name,
          organization: org?.name ?? null,
          plan: subscription?.planName ?? null,
        }}
      />
    </div>
  );
}
