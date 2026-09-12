import { and, eq, isNull, sql as raw } from "drizzle-orm";
import Link from "next/link";

import { MobileNav } from "@/components/mobile-nav";
import { NotificationBell } from "@/components/notification-bell";
import { OrgSwitcher } from "@/components/org-switcher";
import { BrandLogo, BrandMark } from "@/components/brand-logo";
import { LiveChat } from "@/components/live-chat";
import { SidebarNav } from "@/components/sidebar-nav";
import { SidebarUsage } from "@/components/sidebar-usage";
import { UserMenu } from "@/components/user-menu";
import { WebsiteSwitcher } from "@/components/dashboard/website-switcher";
import { isAdmin } from "@/lib/admin/guard";
import { requireSession } from "@/lib/auth-guard";
import { db } from "@/lib/db";
import { notifications, organization, websites } from "@/lib/db/schema";
import {
  clearReferralCode,
  readReferralCode,
} from "@/lib/referrals/cookie";
import { attachReferral } from "@/lib/referrals/core";
import { getOnboardingState } from "@/lib/onboarding/steps";
import { getSubscription } from "@/lib/billing";
import { requireOrg } from "@/lib/tenant";
import {
  readSelectedWebsite,
  resolveWebsiteId,
} from "@/lib/websites/selected";

/**
 * Every authenticated route is per-request by definition: it reads the
 * caller's session and their organization's data. Without this Next tries to
 * prerender them at build time, which needs the auth secrets and fails a
 * deploy on any host where they are set as runtime-only variables.
 */
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await requireSession();
  const { orgId, role } = await requireOrg();

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
   * Whether to keep "Get started" in the sidebar. The onboarding routes are
   * not going anywhere — they carry plan selection and checkout — but once the
   * checklist is finished the link points at a page with nothing left to do.
   */
  const onboarding = await getOnboardingState(orgId);

  /** Plan name for the chat widget, so support can see what they pay for. */
  const subscription = await getSubscription(orgId);
  // Only admins see the link; the area itself 404s for everyone else.
  const admin = await isAdmin();

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

  return (
    <div className="flex min-h-svh flex-col bg-muted/30">
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <MobileNav onboardingComplete={onboarding.complete} />
        <Link
          href="/dashboard"
          aria-label="RepGet dashboard"
          className="flex items-center"
        >
          <span className="sm:hidden">
            <BrandMark size={24} />
          </span>
          <span className="hidden sm:inline-flex">
            <BrandLogo height={22} priority />
          </span>
        </Link>

        <div className="hidden sm:block">
          <OrgSwitcher
            currentOrgId={orgId}
            currentOrgName={org?.name ?? "Workspace"}
            role={role}
          />
        </div>

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
            />
          </div>
        ) : null}

        <div className="ml-auto flex items-center gap-1">
          {admin ? (
            <Link
              href="/admin"
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              Admin
            </Link>
          ) : null}
          {/*
            Count is rendered on the server so the badge is correct on first
            paint. The list itself loads when the bell is opened.
          */}
          <NotificationBell initialUnread={unread} />
          <UserMenu
            name={session.user.name}
            email={session.user.email}
            image={session.user.image}
          />
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="hidden w-60 shrink-0 border-r bg-background md:block">
          <div className="sticky top-14 py-4">
            <SidebarNav
              onboardingComplete={onboarding.complete}
              selectedWebsiteId={fallbackWebsiteId}
            />
            {/*
              Plan usage under the navigation: what is left this month, and
              where to go when it runs out.
            */}
            <SidebarUsage
              organizationId={orgId}
              firstWebsiteId={firstWebsiteId}
            />
          </div>
        </aside>
        {/*
          The page content sits on a slightly tinted ground while cards are
          plain background, so cards read as raised surfaces without needing
          heavy shadows.
        */}
        <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
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
