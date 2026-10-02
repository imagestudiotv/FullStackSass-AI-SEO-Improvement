import { randomUUID } from "node:crypto";

import { isValidElement } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestDb, type TestDb } from "@/test/db";

/**
 * What the dashboard PAGE decides for each kind of person, on top of the
 * gate (gate.test covers which site the gate picks).
 *
 * The page chooses whether the owner's credits are shown, whether the site
 * is badged as shared, whether a paused shared site offers "Open website",
 * and when to bring the shell (switcher, sidebar, Add-ons, credits) back in
 * line with the site on screen. None of that was covered: reverting
 * showCredits to true would have shown a guest the owner's balance and a
 * "Get credits" link with every test still passing.
 *
 * The gate, the tenant guard and the website list run for real against the
 * database; the overview, the cards and the client components are stubs, and
 * the page's returned element tree is searched for them, so what is asserted
 * is the decision (the props), not the markup.
 */

const state = vi.hoisted(() => ({
  db: null as unknown,
  session: null as unknown,
  /** The "site" cookie - the remembered website the layout's shell follows. */
  siteCookie: null as string | null,
}));

vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
}));

vi.mock("@/lib/auth-guard", () => ({
  getSession: async () => state.session,
  requireSession: async () => {
    if (!state.session) throw new Error("redirect:/sign-in");
    return state.session;
  },
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

vi.mock("@/lib/i18n/app-locale", async () => {
  const { getMessages } = await import("@/lib/i18n/messages");
  return { getAppMessages: async () => ({ locale: "en", t: getMessages("en") }) };
});

/** The overview's figures are overview.test's business; only its inputs matter here. */
vi.mock("@/lib/dashboard/overview", () => ({
  getDashboardOverview: vi.fn(async (input: { websiteId: string }) => ({
    websiteId: input.websiteId,
    domain: "stub.example",
    achievements: { ok: false, error: "stub" },
  })),
}));

vi.mock("@/components/dashboard/overview-cards", () => ({
  AuthorityCard: () => null,
  TodaysArticleCard: () => null,
  WinsCard: () => null,
  BestArticlesCard: () => null,
  SearchPanels: () => null,
}));
vi.mock("@/components/dashboard/achievements", () => ({
  AchievementsSection: () => null,
}));
vi.mock("@/components/dashboard/pending-invitations", () => ({
  PendingInvitations: () => null,
}));
vi.mock("@/components/dashboard/remember-website", () => ({
  RememberWebsite: () => null,
}));

import Link from "next/link";

import DashboardPage from "@/app/(app)/dashboard/page";
import { RememberWebsite } from "@/components/dashboard/remember-website";
import { Badge } from "@/components/ui/badge";
import { getDashboardOverview } from "@/lib/dashboard/overview";
import {
  member,
  organization,
  plans,
  subscriptions,
  user,
  websiteMembers,
  websites,
} from "@/lib/db/schema";

let test: TestDb;

const OWNER_ORG = "org_owner";
const GUEST_ORG = "org_guest";
const DUAL_ORG = "org_dual";
const OWNER_USER = "user_owner";
const GUEST_USER = "user_guest";
const DUAL_USER = "user_dual";

/** The owner's sites: both shared with the guest; `sharedA` also with dual. */
let sharedA: string;
let sharedB: string;
/** The dual-role user's own site. */
let dualSite: string;

const day = (n: number) => new Date(Date.UTC(2026, 0, n));

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

beforeEach(async () => {
  vi.clearAllMocks();
  state.siteCookie = null;

  await test.client.exec(`
    delete from website_invitations;
    delete from website_members;
    delete from subscriptions;
    delete from websites;
    delete from plans;
    delete from "member";
    delete from "user";
    delete from organization;
  `);

  const now = new Date();
  await test.db.insert(organization).values(
    [OWNER_ORG, GUEST_ORG, DUAL_ORG].map((id) => ({
      id,
      name: id,
      slug: id,
      createdAt: now,
    })),
  );
  await test.db.insert(user).values(
    [OWNER_USER, GUEST_USER, DUAL_USER].map((id) => ({
      id,
      name: id,
      email: `${id}@example.com`,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    })),
  );
  await test.db.insert(member).values([
    { id: "m_owner", organizationId: OWNER_ORG, userId: OWNER_USER, role: "owner", createdAt: now },
    { id: "m_guest", organizationId: GUEST_ORG, userId: GUEST_USER, role: "owner", createdAt: now },
    { id: "m_dual", organizationId: DUAL_ORG, userId: DUAL_USER, role: "owner", createdAt: now },
  ]);

  sharedA = await addSite(OWNER_ORG, "a.example", day(1));
  sharedB = await addSite(OWNER_ORG, "b.example", day(2));
  dualSite = await addSite(DUAL_ORG, "dual.example", day(3));
  await subscribe(OWNER_ORG, sharedA);
  await subscribe(OWNER_ORG, sharedB);

  await test.db.insert(websiteMembers).values([
    { websiteId: sharedA, userId: GUEST_USER, role: "editor", createdAt: day(4) },
    { websiteId: sharedB, userId: GUEST_USER, role: "viewer", createdAt: day(5) },
    { websiteId: sharedA, userId: DUAL_USER, role: "editor", createdAt: day(4) },
  ]);
});

async function addSite(orgId: string, domain: string, createdAt: Date) {
  const [site] = await test.db
    .insert(websites)
    .values({ organizationId: orgId, domain, url: `https://${domain}`, status: "ready", createdAt })
    .returning({ id: websites.id });
  return site.id;
}

async function subscribe(orgId: string, websiteId: string, status = "active") {
  const [plan] = await test.db
    .insert(plans)
    .values({
      name: "Test plan",
      tier: `test_${randomUUID()}`,
      priceCents: 1000,
      articleLimit: 30,
      keywordLimit: 100,
      siteLimit: 1,
      monthlyCredits: 0,
    })
    .returning({ id: plans.id });
  await test.db.insert(subscriptions).values({
    organizationId: orgId,
    websiteId,
    planId: plan.id,
    status,
    currentPeriodStart: new Date(Date.now() - 24 * 60 * 60 * 1000),
  });
}

function signIn(userId: string, orgId: string) {
  state.session = {
    user: { id: userId, name: userId, email: `${userId}@example.com` },
    session: { id: `sess_${userId}`, activeOrganizationId: orgId },
  };
}

async function renderPage(site?: string) {
  return DashboardPage({
    params: Promise.resolve({}),
    searchParams: Promise.resolve(site ? { site } : {}),
  } as unknown as Parameters<typeof DashboardPage>[0]);
}

type Props = Record<string, unknown>;

/**
 * Every element of `type` in a tree, as its props. Searches every prop, not
 * only children: the badge and "Open website" sit in PageHeader's `actions`.
 */
function findAll(node: unknown, type: unknown): Props[] {
  if (Array.isArray(node)) return node.flatMap((child) => findAll(child, type));
  if (!isValidElement(node)) return [];
  const props = node.props as Props;
  return [
    ...(node.type === type ? [props] : []),
    ...Object.values(props).flatMap((value) => findAll(value, type)),
  ];
}

/** All text directly or nested inside an element's children. */
function textOf(node: unknown): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (!isValidElement(node)) return "";
  return textOf((node.props as Props).children);
}

const overviewInput = () =>
  vi.mocked(getDashboardOverview).mock.calls[0]?.[0] as Props | undefined;

describe("dashboard page - a guest", () => {
  it("asks for the overview WITHOUT credits, billed to the owner, and badges the site", async () => {
    signIn(GUEST_USER, GUEST_ORG);
    const tree = await renderPage();

    expect(overviewInput()).toMatchObject({
      websiteId: sharedA,
      ownerOrgId: OWNER_ORG,
      showCredits: false,
    });

    const badges = findAll(tree, Badge);
    expect(badges).toHaveLength(1);
    expect(textOf(badges[0].children)).toBe("Shared with you · Editor");
  });

  it("says Viewer on a site shared as a viewer", async () => {
    signIn(GUEST_USER, GUEST_ORG);
    const tree = await renderPage(sharedB);

    expect(textOf(findAll(tree, Badge)[0].children)).toBe("Shared with you · Viewer");
  });

  it("offers no 'Open website' on a paused shared site, and loads no overview", async () => {
    await test.client.exec(
      `update subscriptions set status = 'canceled' where website_id = '${sharedA}'`,
    );
    signIn(GUEST_USER, GUEST_ORG);
    const tree = await renderPage(sharedA);

    const hrefs = findAll(tree, Link).map((link) => link.href);
    expect(hrefs).not.toContain(`/websites/${sharedA}`);
    expect(getDashboardOverview).not.toHaveBeenCalled();
    expect(findAll(tree, Badge)).toHaveLength(1);
  });

  it("keeps the site chosen in the switcher on a bare /dashboard, and leaves the cookie alone", async () => {
    state.siteCookie = sharedB;
    signIn(GUEST_USER, GUEST_ORG);
    const tree = await renderPage();

    expect(overviewInput()?.websiteId).toBe(sharedB);
    expect(findAll(tree, RememberWebsite)).toHaveLength(0);
  });

  it("brings the shell to a shared site asked for by ?site=", async () => {
    // The lapsed-plan redirect and an accepted invitation both land here.
    state.siteCookie = sharedB;
    signIn(GUEST_USER, GUEST_ORG);
    const tree = await renderPage(sharedA);

    expect(findAll(tree, RememberWebsite)).toEqual([{ websiteId: sharedA }]);
  });

  it("does nothing when the shell is already on the site", async () => {
    state.siteCookie = sharedA;
    signIn(GUEST_USER, GUEST_ORG);
    const tree = await renderPage(sharedA);

    expect(findAll(tree, RememberWebsite)).toHaveLength(0);
  });
});

describe("dashboard page - an owner", () => {
  it("asks for the overview WITH credits, and shows no badge", async () => {
    signIn(OWNER_USER, OWNER_ORG);
    const tree = await renderPage();

    expect(overviewInput()).toMatchObject({
      websiteId: sharedA,
      ownerOrgId: OWNER_ORG,
      showCredits: true,
    });
    expect(findAll(tree, Badge)).toHaveLength(0);
    expect(findAll(tree, Link).map((link) => link.href)).toContain(`/websites/${sharedA}`);
  });

  it("leaves the shell on another site of their own alone, as before", async () => {
    state.siteCookie = sharedB;
    signIn(OWNER_USER, OWNER_ORG);
    const tree = await renderPage();

    expect(overviewInput()?.websiteId).toBe(sharedA);
    expect(findAll(tree, RememberWebsite)).toHaveLength(0);
  });
});

describe("dashboard page - a dual-role user", () => {
  it("brings a shell left on the SHARED site back to their own dashboard", async () => {
    /*
      After accepting (or visiting) the shared site the cookie names it, and a
      bare /dashboard shows their own: without this the shell said "Editor"
      and hid their credits, Add-ons and setup panel over their own site.
    */
    await subscribe(DUAL_ORG, dualSite);
    state.siteCookie = sharedA;
    signIn(DUAL_USER, DUAL_ORG);
    const tree = await renderPage();

    expect(overviewInput()).toMatchObject({ websiteId: dualSite, showCredits: true });
    expect(findAll(tree, RememberWebsite)).toEqual([{ websiteId: dualSite }]);
  });

  it("shows the shared site when their own is unpaid, and moves the shell to it", async () => {
    state.siteCookie = dualSite;
    signIn(DUAL_USER, DUAL_ORG);
    const tree = await renderPage();

    expect(overviewInput()).toMatchObject({
      websiteId: sharedA,
      ownerOrgId: OWNER_ORG,
      showCredits: false,
    });
    expect(findAll(tree, RememberWebsite)).toEqual([{ websiteId: sharedA }]);
  });
});
