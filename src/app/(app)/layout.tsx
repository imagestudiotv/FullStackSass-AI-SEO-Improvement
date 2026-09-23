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
import { ensureOrganization } from "@/lib/auth";
import { db } from "@/lib/db";
import { addons, notifications, organization, websites } from "@/lib/db/schema";
import { clearReferralCode, readReferralCode } from "@/lib/referrals/cookie";
import { attachReferral } from "@/lib/referrals/core";
import { getLaunchState } from "@/lib/onboarding/launch";
import { SetupTracker } from "@/components/setup-tracker";
import { getSubscription } from "@/lib/billing";
import { NoOrganizationError, requireOrg } from "@/lib/tenant";
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

  /**
   * Recover a signed-in user who has no organization.
   *
   * ensureOrganization runs in Better Auth's user.create.after hook, so it
   * fires exactly once and never again. Any account that got past signup
   * without a membership row — one created before that hook existed, or one
   * whose hook lost its database write — was then locked out permanently:
   * requireOrg throws NoOrganizationError here, and a LAYOUT that throws
   * cannot be caught by error.tsx in its own segment, so the whole app
   * rendered as a blank browser error page immediately after a successful
   * sign-in.
   *
   * Creating the workspace is the same work signup would have done, and
   * ensureOrganization already returns early when a membership exists, so
   * this is a no-op on every normal request. Only the retry is new.
   */
  let ctx;
  try {
    ctx = await requireOrg();
  } catch (error) {
    if (!(error instanceof NoOrganizationError)) throw error;
    await ensureOrganization(session.user);
    // Once. A second failure is a real fault and must surface, not loop.
    ctx = await requireOrg();
  }
  const { orgId, role } = ctx;

  /**
   * Every website, for the switcher in the header and to work out which one
   * the sidebar's sections belong to. Oldest first, so "the first website" is
   * a stable idea rather than whichever was added most recently.
   */
  const ownedWebsites = await db
    .select({
      id: websites.id,
      domain: websites.domain,
      brandName: websites.brandName,
    })
    .from(websites)
    .where(eq(websites.organizationId, orgId))
    .orderBy(websites.createdAt);

  const firstWebsiteId = ownedWebsites[0]?.id ?? null;

  /**
   * The website to fall back to when the address does not name one.
   *
   * The last one chosen, or the first they own. The sidebar prefers the id in
   * the URL and only uses this when there is none — it knows the pathname on
   * the client, and a layout cannot read it without adding middleware for one
   * value.
   */
  const remembered = await readSelectedWebsite();
  const fallbackWebsiteId = resolveWebsiteId(
    null,
    remembered,
    ownedWebsites.map((site) => site.id),
  );
  const selected =
    ownedWebsites.find((site) => site.id === fallbackWebsiteId) ?? null;

  /**
   * Whether to keep "Set up" in the sidebar, and what the floating tracker
   * should list.
   *
   * The LAUNCH state now, not the signup wizard's: signup is finished by the
   * time anyone sees this sidebar, and what is left is connecting the site,
   * auditing it, switching on the exchange and so on. Null when the workspace
   * has no website yet, in which case there is nothing to check off.
   */
  const launch = fallbackWebsiteId
    ? await getLaunchState(fallbackWebsiteId)
    : null;

  /** Plan name for the chat widget, so support can see what they pay for. */
  const subscription = await getSubscription(orgId);
  // Only admins see the link; the area itself 404s for everyone else.
  const admin = await isAdmin();
  const { t } = await getAppMessages(session.user.id);

  const org = await db.query.organization.findFirst({
    where: eq(organization.id, orgId),
  });

  /**
   * Attach a referral code left by a /?ref=CODE visit.
   *
   * Done here rather than in the auth hook because that hook runs inside
   * Better Auth's config and cannot read request cookies. Every authenticated
   * page passes through this layout, so the first one after signup catches it.
   *
   * Cheap in the normal case: no cookie means no work at all. The cookie is
   * cleared either way, so a code that cannot attach — self-referral, an
   * unknown code, an already-referred workspace — is not retried on every
   * subsequent page load.
   */
  const referralCode = await readReferralCode();
  if (referralCode) {
    await attachReferral(orgId, referralCode);
    await clearReferralCode();
  }

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
          onboardingComplete={launch ? launch.live : true}
          setupProgress={
            launch
              ? { done: launch.doneCount, total: launch.steps.length }
              : null
          }
          selectedWebsiteId={fallbackWebsiteId}
          addons={sidebarAddons}
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
          is worse than no menu.
        */}
        {selected ? (
          <div className="hidden md:block">
            <WebsiteSwitcher
              websites={ownedWebsites}
              current={selected}
              compact
              t={t.app.dash}
            />
          </div>
        ) : null}

        <div className="ml-auto flex items-center gap-1">
          {admin ? (
            <Link
              href="/admin"
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {t.app.common.admin}
            </Link>
          ) : null}
          {/*
            Count is rendered on the server so the badge is correct on first
            paint. The list itself loads when the bell is opened.
          */}
          <NotificationBell initialUnread={unread} t={t.app.auth} />
          <UserMenu
            name={session.user.name}
            email={session.user.email}
            image={session.user.image}
          />
        </div>
      </header>

      <div className="flex flex-1">
        <AppSidebar>
          <SidebarNav
            t={t.app.nav}
            onboardingComplete={launch ? launch.live : true}
            setupProgress={
              launch
                ? { done: launch.doneCount, total: launch.steps.length }
                : null
            }
            selectedWebsiteId={fallbackWebsiteId}
            addons={sidebarAddons}
          />
          {/*
            Plan usage under the navigation: what is left this month, and
            where to go when it runs out.
          */}
          <SidebarUsage
            organizationId={orgId}
            websiteId={fallbackWebsiteId}
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
        the required steps are done, or when there is no website yet.
      */}
      {launch && fallbackWebsiteId ? (
        <SetupTracker steps={launch.steps} />
      ) : null}

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
