import { isValidElement, type ReactNode } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestDb, type TestDb } from "@/test/db";

/**
 * The app shell for somebody invited to a website.
 *
 * The (app) layout and the Account page decide what the header, sidebar and
 * settings strip offer. Both used to look only at the caller's OWN workspace,
 * so an invitee - whose workspace is empty - got no switcher, a sidebar with
 * nothing per-site in it, and no settings strip. These tests hold the shell to
 * the rules: shared sites are listed (and only those), owner-only offers
 * (add-ons, credits, the launch checklist, Billing) disappear while a shared
 * site is selected, and an owner's shell is exactly what it was.
 *
 * Every component the shell renders is a stub. The pages are called as plain
 * async functions and the returned element tree is searched for the stubs, so
 * what is asserted is the PROPS the shell hands down - the decisions - not
 * markup. The components' own rendering is covered in shell-components.test.
 */

const state = vi.hoisted(() => ({
  db: null as unknown,
  session: null as unknown,
  /** The "site" cookie - the remembered website. */
  siteCookie: null as string | null,
  /** Sites whose keyword research the launch-state stub reports in flight. */
  researching: new Set<string>(),
}));

vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
}));

/** requireOrg reads the session; the database decides membership. */
vi.mock("@/lib/auth-guard", () => ({
  getSession: async () => state.session,
  requireSession: async () => state.session,
}));

/** Only reached when a user has no membership at all; never in these tests. */
vi.mock("@/lib/auth", () => ({
  ensureOrganization: async () => {
    throw new Error("ensureOrganization should not be reached");
  },
}));

vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
  notFound: () => {
    throw new Error("notFound");
  },
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "site" && state.siteCookie
        ? { name, value: state.siteCookie }
        : undefined,
    set: () => {},
  }),
}));

/*
  The launch checklist, stubbed: what matters here is which site the layout
  asks about and what it does with the answer. Never "live", so an owner's
  tracker always has something to show.
*/
vi.mock("@/lib/onboarding/launch", () => ({
  getLaunchState: vi.fn(async (websiteId: string) => ({
    steps: [
      { id: "profile", title: "", description: "", done: true, optional: false, href: `/websites/${websiteId}/profile`, icon: "profile" },
      { id: "site", title: "", description: "", done: false, optional: false, href: `/websites/${websiteId}/integrations`, icon: "site" },
    ],
    doneCount: 1,
    requiredRemaining: 1,
    live: false,
    researching: state.researching.has(websiteId),
  })),
}));

vi.mock("@/lib/admin/guard", () => ({ isAdmin: async () => false }));
vi.mock("@/lib/billing", () => ({ getSubscription: async () => null }));
vi.mock("@/lib/referrals/cookie", () => ({ readReferralCookie: async () => null }));
vi.mock("@/lib/i18n/app-locale", async () => {
  const { getMessages } = await import("@/lib/i18n/messages");
  return { getAppMessages: async () => ({ locale: "en", t: getMessages("en") }) };
});
vi.mock("@/lib/referrals/actions", () => ({ getReferralSummary: async () => null }));
vi.mock("@/lib/referrals/core", () => ({ REFERRAL_REWARD_CREDITS: 5 }));
vi.mock("@/lib/websites/members", () => ({
  listWebsiteMembers: vi.fn(async () => []),
  listWebsiteInvitations: vi.fn(async () => []),
}));

/* The rendered pieces, as named stubs the tree search can recognise. */
vi.mock("@/components/app-sidebar", () => ({
  AppSidebar: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/components/mobile-nav", () => ({ MobileNav: () => null }));
vi.mock("@/components/sidebar-nav", () => ({ SidebarNav: () => null }));
vi.mock("@/components/sidebar-usage", () => ({ SidebarUsage: () => null }));
vi.mock("@/components/dashboard/website-switcher", () => ({
  WebsiteSwitcher: () => null,
}));
vi.mock("@/components/setup-tracker", () => ({ SetupTracker: () => null }));
vi.mock("@/components/research-watcher", () => ({ ResearchWatcher: () => null }));
vi.mock("@/components/notification-bell", () => ({ NotificationBell: () => null }));
vi.mock("@/components/brand-logo", () => ({
  BrandLogo: () => null,
  BrandMark: () => null,
}));
vi.mock("@/components/live-chat", () => ({ LiveChat: () => null }));
vi.mock("@/components/user-menu", () => ({ UserMenu: () => null }));
vi.mock("@/components/referral-claim", () => ({ ReferralClaim: () => null }));
vi.mock("@/components/settings-nav", () => ({ SettingsNav: () => null }));
vi.mock("@/app/(app)/settings/personal-details", () => ({
  PersonalDetails: () => null,
}));
vi.mock("@/app/(app)/settings/referral-card", () => ({ ReferralCard: () => null }));
vi.mock("@/app/(app)/settings/website-members", () => ({
  WebsiteMembers: () => null,
}));

import { eq } from "drizzle-orm";

import {
  member,
  organization,
  user,
  websiteInvitations,
  websiteMembers,
  websites,
} from "@/lib/db/schema";
import { createInvitationToken } from "@/lib/websites/invitation-token";
import { MobileNav } from "@/components/mobile-nav";
import { SettingsNav } from "@/components/settings-nav";
import { SetupTracker } from "@/components/setup-tracker";
import { ResearchWatcher } from "@/components/research-watcher";
import { SidebarNav } from "@/components/sidebar-nav";
import { SidebarUsage } from "@/components/sidebar-usage";
import { WebsiteSwitcher } from "@/components/dashboard/website-switcher";
import { WebsiteMembers } from "@/app/(app)/settings/website-members";
import { listWebsiteMembers } from "@/lib/websites/members";

import AppLayout from "@/app/(app)/layout";
import SettingsPage from "@/app/(app)/settings/page";

let test: TestDb;

const OWNER_ORG = "org_owner";
const GUEST_ORG = "org_guest";
const DUAL_ORG = "org_dual";
const OWNER_USER = "user_owner";
const GUEST_USER = "user_guest";
const DUAL_USER = "user_dual";

/** The owner's sites: `shared` is shared with guest and dual, `other` is not. */
let sharedSite: string;
let otherSite: string;
/** The dual-role user's own site. */
let dualSite: string;

const day = (n: number) => new Date(Date.UTC(2026, 0, n));

async function addSite(orgId: string, domain: string, createdAt: Date) {
  const [site] = await test.db
    .insert(websites)
    .values({ organizationId: orgId, domain, url: `https://${domain}`, createdAt })
    .returning({ id: websites.id });
  return site.id;
}

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

beforeEach(async () => {
  vi.clearAllMocks();
  state.siteCookie = null;
  state.researching = new Set();

  await test.client.exec(`
    delete from website_invitations;
    delete from website_members;
    delete from websites;
    delete from "member";
    delete from "user";
    delete from organization;
  `);

  const now = new Date();
  await test.db.insert(organization).values([
    { id: OWNER_ORG, name: "Owner Co", slug: "owner", createdAt: now },
    { id: GUEST_ORG, name: "Guest's Workspace", slug: "guest", createdAt: now },
    { id: DUAL_ORG, name: "Dual's Workspace", slug: "dual", createdAt: now },
  ]);
  await test.db.insert(user).values([
    { id: OWNER_USER, name: "O", email: "o@example.com", createdAt: now, updatedAt: now },
    { id: GUEST_USER, name: "G", email: "g@example.com", createdAt: now, updatedAt: now },
    { id: DUAL_USER, name: "D", email: "d@example.com", createdAt: now, updatedAt: now },
  ]);
  await test.db.insert(member).values([
    { id: "m_owner", organizationId: OWNER_ORG, userId: OWNER_USER, role: "owner", createdAt: now },
    { id: "m_guest", organizationId: GUEST_ORG, userId: GUEST_USER, role: "owner", createdAt: now },
    { id: "m_dual", organizationId: DUAL_ORG, userId: DUAL_USER, role: "owner", createdAt: now },
  ]);

  sharedSite = await addSite(OWNER_ORG, "shared.example", day(1));
  otherSite = await addSite(OWNER_ORG, "other.example", day(2));
  dualSite = await addSite(DUAL_ORG, "dual.example", day(3));

  await test.db.insert(websiteMembers).values([
    { websiteId: sharedSite, userId: GUEST_USER, role: "editor" },
    { websiteId: sharedSite, userId: DUAL_USER, role: "viewer" },
  ]);
});

function signIn(userId: string, orgId: string) {
  state.session = {
    user: { id: userId, name: userId, email: `${userId}@example.com`, image: null },
    session: { id: `sess_${userId}`, activeOrganizationId: orgId },
  };
}

type Props = Record<string, unknown>;

/** Every element of `type` in a rendered tree, as its props. */
function findAll(node: unknown, type: unknown): Props[] {
  if (Array.isArray(node)) return node.flatMap((child) => findAll(child, type));
  if (!isValidElement(node)) return [];
  const props = node.props as Props;
  return [
    ...(node.type === type ? [props] : []),
    ...findAll(props.children, type),
  ];
}

function findOne(node: unknown, type: unknown): Props {
  const found = findAll(node, type);
  expect(found).toHaveLength(1);
  return found[0];
}

async function renderLayout() {
  return AppLayout({
    children: null,
    params: Promise.resolve({}),
  } as unknown as Parameters<typeof AppLayout>[0]);
}

describe("app layout - owner", () => {
  it("is unchanged: own sites, add-ons, credits and the launch checklist", async () => {
    signIn(OWNER_USER, OWNER_ORG);
    const tree = await renderLayout();

    const switcher = findOne(tree, WebsiteSwitcher);
    expect(switcher.websites).toEqual([
      { id: sharedSite, domain: "shared.example", brandName: null, access: "owner" },
      { id: otherSite, domain: "other.example", brandName: null, access: "owner" },
    ]);
    expect((switcher.current as Props).id).toBe(sharedSite);

    const nav = findOne(tree, SidebarNav);
    expect(nav.hideAddons).toBe(false);
    expect(nav.selectedWebsiteId).toBe(sharedSite);
    expect(nav.onboardingComplete).toBe(false);
    expect(nav.setupProgress).toEqual({ done: 1, total: 2 });
    expect(findOne(tree, MobileNav).hideAddons).toBe(false);

    const usage = findOne(tree, SidebarUsage);
    expect(usage.showCredits).toBe(true);
    expect(usage.organizationId).toBe(OWNER_ORG);

    expect(findAll(tree, SetupTracker)).toHaveLength(1);
  });
});

describe("app layout - invited guest who owns nothing", () => {
  it("lists ONLY the shared site, with its role and no workspace id", async () => {
    signIn(GUEST_USER, GUEST_ORG);
    const tree = await renderLayout();

    const switcher = findOne(tree, WebsiteSwitcher);
    // The owner's other site is never offered.
    expect(switcher.websites).toEqual([
      { id: sharedSite, domain: "shared.example", brandName: null, access: "editor" },
    ]);
    expect(switcher.current).toEqual({
      id: sharedSite,
      domain: "shared.example",
      brandName: null,
      access: "editor",
    });
    // Nothing handed to the client names the owner's workspace.
    expect(JSON.stringify(switcher)).not.toContain(OWNER_ORG);
    expect(JSON.stringify(switcher)).not.toMatch(/organi[sz]ation/i);
  });

  it("points the sidebar at the shared site and hides owner-only offers", async () => {
    signIn(GUEST_USER, GUEST_ORG);
    const tree = await renderLayout();

    const nav = findOne(tree, SidebarNav);
    expect(nav.selectedWebsiteId).toBe(sharedSite);
    expect(nav.hideAddons).toBe(true);
    // "Set up" is the owner's checklist.
    expect(nav.onboardingComplete).toBe(true);
    expect(nav.setupProgress).toBeNull();

    const mobile = findOne(tree, MobileNav);
    expect(mobile.hideAddons).toBe(true);
    expect(mobile.onboardingComplete).toBe(true);
    expect(mobile.setupProgress).toBeNull();

    const usage = findOne(tree, SidebarUsage);
    expect(usage.showCredits).toBe(false);
    // The per-site article allowance still follows the shared site.
    expect(usage.websiteId).toBe(sharedSite);
    // Never the owner's workspace.
    expect(usage.organizationId).toBe(GUEST_ORG);

    expect(findAll(tree, SetupTracker)).toHaveLength(0);
  });

  it("still follows research on the shared site", async () => {
    state.researching.add(sharedSite);
    signIn(GUEST_USER, GUEST_ORG);
    const tree = await renderLayout();

    expect(findAll(tree, ResearchWatcher)).toHaveLength(1);
    expect(findAll(tree, SetupTracker)).toHaveLength(0);
  });

  it("ignores a remembered id it cannot open and falls back to the shared site", async () => {
    state.siteCookie = otherSite;
    signIn(GUEST_USER, GUEST_ORG);
    const tree = await renderLayout();

    expect(findOne(tree, SidebarNav).selectedWebsiteId).toBe(sharedSite);
    expect((findOne(tree, WebsiteSwitcher).current as Props).id).toBe(sharedSite);
  });
});

describe("app layout - dual-role user", () => {
  it("lists owned first, then shared, and defaults to their own site", async () => {
    signIn(DUAL_USER, DUAL_ORG);
    const tree = await renderLayout();

    const switcher = findOne(tree, WebsiteSwitcher);
    expect(
      (switcher.websites as Props[]).map((site) => [site.id, site.access]),
    ).toEqual([
      [dualSite, "owner"],
      [sharedSite, "viewer"],
    ]);

    // Their own site selected: their own offers, as for any owner.
    const nav = findOne(tree, SidebarNav);
    expect(nav.selectedWebsiteId).toBe(dualSite);
    expect(nav.hideAddons).toBe(false);
    expect(nav.setupProgress).toEqual({ done: 1, total: 2 });
    expect(findOne(tree, SidebarUsage).showCredits).toBe(true);
    expect(findAll(tree, SetupTracker)).toHaveLength(1);
  });

  it("hides owner-only offers while the shared site is selected", async () => {
    state.siteCookie = sharedSite;
    signIn(DUAL_USER, DUAL_ORG);
    const tree = await renderLayout();

    const nav = findOne(tree, SidebarNav);
    expect(nav.selectedWebsiteId).toBe(sharedSite);
    expect(nav.hideAddons).toBe(true);
    expect(nav.onboardingComplete).toBe(true);
    expect(nav.setupProgress).toBeNull();
    expect(findOne(tree, SidebarUsage).showCredits).toBe(false);
    expect(findAll(tree, SetupTracker)).toHaveLength(0);
    expect((findOne(tree, WebsiteSwitcher).current as Props).access).toBe("viewer");
  });
});

describe("app layout - brand-new account", () => {
  it("renders no switcher and keeps the owner defaults", async () => {
    await test.db.delete(websiteMembers);
    signIn(GUEST_USER, GUEST_ORG);
    const tree = await renderLayout();

    expect(findAll(tree, WebsiteSwitcher)).toHaveLength(0);
    const nav = findOne(tree, SidebarNav);
    expect(nav.selectedWebsiteId).toBeNull();
    // Not guest-only: someone with no sites at all is a new customer.
    expect(nav.hideAddons).toBe(false);
    expect(findOne(tree, SidebarUsage).showCredits).toBe(true);
  });

  it("hides Add-ons and the credit figure when all they have is an invitation", async () => {
    /*
      The dashboard that lists only their invitations. Nothing is selected,
      so "is a shared site selected" says no - but they own no site to buy
      for, and "0 backlink credits" there invites a purchase for nothing.
    */
    await test.db.delete(websiteMembers);
    await test.db
      .update(user)
      .set({ emailVerified: true })
      .where(eq(user.id, GUEST_USER));
    await test.db.insert(websiteInvitations).values({
      websiteId: sharedSite,
      email: "g@example.com",
      role: "editor",
      tokenHash: createInvitationToken().hash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      invitedBy: OWNER_USER,
    });
    signIn(GUEST_USER, GUEST_ORG);
    const tree = await renderLayout();

    expect(findAll(tree, WebsiteSwitcher)).toHaveLength(0);
    expect(findOne(tree, SidebarNav).hideAddons).toBe(true);
    expect(findOne(tree, MobileNav).hideAddons).toBe(true);
    expect(findOne(tree, SidebarUsage).showCredits).toBe(false);
  });
});

describe("settings page", () => {
  it("owner: strip with Billing, members panel on their remembered site", async () => {
    state.siteCookie = otherSite;
    signIn(OWNER_USER, OWNER_ORG);
    const tree = await SettingsPage();

    const strip = findOne(tree, SettingsNav);
    expect(strip.websiteId).toBe(otherSite);
    expect(strip.access).toBe("owner");

    const members = findOne(tree, WebsiteMembers);
    expect(members.sites).toEqual([
      { id: sharedSite, domain: "shared.example" },
      { id: otherSite, domain: "other.example" },
    ]);
    expect(members.initialWebsiteId).toBe(otherSite);
  });

  it("guest: keeps the strip on the shared site, without Billing or the members panel", async () => {
    signIn(GUEST_USER, GUEST_ORG);
    const tree = await SettingsPage();

    const strip = findOne(tree, SettingsNav);
    expect(strip.websiteId).toBe(sharedSite);
    expect(strip.access).toBe("editor");

    expect(findAll(tree, WebsiteMembers)).toHaveLength(0);
    expect(listWebsiteMembers).not.toHaveBeenCalled();
  });

  it("dual-role on a shared site: strip follows it, members panel stays on their own site", async () => {
    state.siteCookie = sharedSite;
    signIn(DUAL_USER, DUAL_ORG);
    const tree = await SettingsPage();

    const strip = findOne(tree, SettingsNav);
    expect(strip.websiteId).toBe(sharedSite);
    expect(strip.access).toBe("viewer");

    const members = findOne(tree, WebsiteMembers);
    expect(members.sites).toEqual([{ id: dualSite, domain: "dual.example" }]);
    expect(members.initialWebsiteId).toBe(dualSite);
    expect(listWebsiteMembers).toHaveBeenCalledWith(dualSite);
    expect(listWebsiteMembers).not.toHaveBeenCalledWith(sharedSite);
  });
});
