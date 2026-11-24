import { randomUUID } from "node:crypto";

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestDb, type TestDb } from "@/test/db";

const state = vi.hoisted(() => ({
  db: null as unknown,
  session: null as unknown,
  cookies: new Map<string, string>(),
}));

vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
}));

/** requireOrg reads the session; the database decides membership. */
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
  permanentRedirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
  notFound: () => {
    throw new Error("notFound");
  },
}));

/** /setup reads the selected-website cookie. */
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      state.cookies.has(name) ? { name, value: state.cookies.get(name) } : undefined,
    set: (name: string, value: string) => {
      state.cookies.set(name, value);
    },
  }),
}));

vi.mock("@/lib/i18n/app-locale", async () => {
  const { getMessages } = await import("@/lib/i18n/messages");
  return { getAppMessages: async () => ({ locale: "en", t: getMessages("en") }) };
});

import SetupPage from "@/app/(site)/(app)/setup/page";
import {
  member,
  organization,
  plans,
  subscriptions,
  user,
  websiteInvitations,
  websiteMembers,
  websites,
} from "@/lib/db/schema";
import { createInvitationToken } from "@/lib/websites/invitation-token";

import OnboardingPage from "./page";
import RetiredStepPage from "./[step]/page";
import OnboardingWebsitePage from "./website/page";

/**
 * The ways into setup, for somebody who came to work on another person's
 * website.
 *
 * The production failure: an invited editor owns nothing, so /dashboard sent
 * them to /onboarding, which forwarded to /onboarding/website, and every
 * other step (and /setup) sent a caller without a website back there. The
 * site they were invited to was never on screen. Each entry now sends a
 * person who owns nothing - but has a shared site, or an invitation waiting
 * for their proven address - to /dashboard instead.
 *
 * What must NOT move: an owner's setup, a brand-new customer's setup, and an
 * invitee who asks to add a site of their own (?next=1).
 */

let test: TestDb;

const OWNER_ORG = "org_owner";
const GUEST_ORG = "org_guest";
const INVITEE_ORG = "org_invitee";
const UNVERIFIED_ORG = "org_unverified";
const NEW_ORG = "org_new";
const DUAL_ORG = "org_dual";

const OWNER_USER = "user_owner";
const GUEST_USER = "user_guest";
const INVITEE_USER = "user_invitee";
const UNVERIFIED_USER = "user_unverified";
const NEW_USER = "user_new";
const DUAL_USER = "user_dual";

/** The owner's site, shared with the guest and the dual-role user. */
let sharedSite: string;

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

beforeEach(async () => {
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
  state.cookies.clear();
  state.session = null;

  const now = new Date();
  const orgs = [OWNER_ORG, GUEST_ORG, INVITEE_ORG, UNVERIFIED_ORG, NEW_ORG, DUAL_ORG];
  await test.db
    .insert(organization)
    .values(orgs.map((id) => ({ id, name: id, slug: id, createdAt: now })));
  await test.db.insert(user).values([
    { id: OWNER_USER, name: "Olivia", email: "olivia@owner.example", emailVerified: true, createdAt: now, updatedAt: now },
    { id: GUEST_USER, name: "Gus", email: "gus@guest.example", emailVerified: true, createdAt: now, updatedAt: now },
    { id: INVITEE_USER, name: "Ines", email: "ines@invitee.example", emailVerified: true, createdAt: now, updatedAt: now },
    // Password-only: the address is not proven, so no token-less invitations.
    { id: UNVERIFIED_USER, name: "Pat", email: "pat@unverified.example", emailVerified: false, createdAt: now, updatedAt: now },
    { id: NEW_USER, name: "Nia", email: "nia@new.example", emailVerified: true, createdAt: now, updatedAt: now },
    { id: DUAL_USER, name: "Dee", email: "dee@dual.example", emailVerified: true, createdAt: now, updatedAt: now },
  ]);
  await test.db.insert(member).values([
    { id: "m_owner", organizationId: OWNER_ORG, userId: OWNER_USER, role: "owner", createdAt: now },
    { id: "m_guest", organizationId: GUEST_ORG, userId: GUEST_USER, role: "owner", createdAt: now },
    { id: "m_invitee", organizationId: INVITEE_ORG, userId: INVITEE_USER, role: "owner", createdAt: now },
    { id: "m_unverified", organizationId: UNVERIFIED_ORG, userId: UNVERIFIED_USER, role: "owner", createdAt: now },
    { id: "m_new", organizationId: NEW_ORG, userId: NEW_USER, role: "owner", createdAt: now },
    { id: "m_dual", organizationId: DUAL_ORG, userId: DUAL_USER, role: "owner", createdAt: now },
  ]);

  sharedSite = await addSite(OWNER_ORG, "shared.example");
  await subscribe(OWNER_ORG, sharedSite);
  await test.db.insert(websiteMembers).values([
    { websiteId: sharedSite, userId: GUEST_USER, role: "editor" },
    { websiteId: sharedSite, userId: DUAL_USER, role: "viewer" },
  ]);
});

async function addSite(orgId: string, domain: string) {
  const [site] = await test.db
    .insert(websites)
    .values({ organizationId: orgId, domain, url: `https://${domain}`, status: "ready" })
    .returning({ id: websites.id });
  return site.id;
}

async function subscribe(orgId: string, websiteId: string) {
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
    status: "active",
    currentPeriodStart: new Date(Date.now() - 24 * 60 * 60 * 1000),
  });
}

/** An unaccepted, unexpired invitation to the shared site, as members.ts writes one. */
async function invite(email: string) {
  await test.db.insert(websiteInvitations).values({
    websiteId: sharedSite,
    email,
    role: "editor",
    tokenHash: createInvitationToken().hash,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    invitedBy: OWNER_USER,
  });
}

function signIn(userId: string, activeOrganizationId: string) {
  state.session = {
    user: { id: userId, email: `${userId}@example`, name: userId },
    session: { id: `sess_${userId}`, activeOrganizationId },
  };
}

/** The page's redirect target, or "rendered" when it returned a screen. */
async function outcome(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
    return "rendered";
  } catch (error) {
    const message = (error as Error).message;
    if (message.startsWith("redirect:")) return message.slice("redirect:".length);
    throw error;
  }
}

const onboarding = (search: Record<string, string> = {}) =>
  outcome(() =>
    OnboardingPage({ searchParams: Promise.resolve(search) } as never),
  );
const websiteStep = (search: Record<string, string> = {}) =>
  outcome(() =>
    OnboardingWebsitePage({ searchParams: Promise.resolve(search) } as never),
  );
const setup = (search: Record<string, string> = {}) =>
  outcome(() => SetupPage({ searchParams: Promise.resolve(search) } as never));

const retired = (step: string, search: Record<string, string> = {}) =>
  outcome(() => RetiredStepPage({ params: Promise.resolve({ step }), searchParams: Promise.resolve(search) } as never));

describe("the steps that are gone (bookmarks, old emails, a Google sign-in in flight)", () => {
  it("lead a customer with a plan to where each job is done now", async () => {
    signIn(OWNER_USER, OWNER_ORG);
    expect(await retired("google")).toBe(`/websites/${sharedSite}/google`);
    expect(await retired("google", { site: sharedSite, google: "cancelled" })).toBe(`/websites/${sharedSite}/google?google=cancelled`);
    expect(await retired("visibility")).toBe(`/websites/${sharedSite}/ai-visibility`);
    expect(await retired("content", { site: sharedSite })).toBe(`/websites/${sharedSite}/content`);
    expect(await retired("profile")).toBe(`/websites/${sharedSite}/profile`);
    expect(await retired("setup")).toBe(`/tasks?site=${sharedSite}`);
    expect(await retired("done")).toBe(`/dashboard?site=${sharedSite}`);
  });

  it("send an unpaid customer to the plan and a new one to the website step, never round in a circle", async () => {
    signIn(NEW_USER, NEW_ORG);
    expect(await retired("google")).toBe("/onboarding/website");
    const own = await addSite(NEW_ORG, "unpaid.example");
    for (const step of ["google", "visibility", "content", "setup", "done", "profile"]) {
      expect(await retired(step), step).toBe(`/onboarding/plan?site=${own}`);
    }
  });

  it("send somebody who only works on a shared site to the dashboard", async () => {
    signIn(GUEST_USER, GUEST_ORG);
    expect(await retired("content", { site: sharedSite })).toBe("/dashboard");
  });

  it("are the only ones: anything else is not a page", async () => {
    signIn(OWNER_USER, OWNER_ORG);
    for (const step of ["anything", "constructor", "toString"]) await expect(retired(step)).rejects.toThrow("notFound");
  });
});

describe("a guest-only user (a shared site, none of their own)", () => {
  beforeEach(() => signIn(GUEST_USER, GUEST_ORG));

  it("is sent from /onboarding to the dashboard, not to 'add your website'", async () => {
    expect(await onboarding()).toBe("/dashboard");
  });

  it("is sent to the dashboard even when ?site= names the shared site", async () => {
    // getOnboardingState is scoped to the caller's workspace, so the shared
    // id finds nothing there - it must not fall through to the wizard.
    expect(await onboarding({ site: sharedSite })).toBe("/dashboard");
  });

  it("is sent from /onboarding/website to the dashboard", async () => {
    expect(await websiteStep()).toBe("/dashboard");
  });

  it("still gets the form when adding a site of their own (?next=1)", async () => {
    expect(await websiteStep({ next: "1" })).toBe("rendered");
  });

  it("is sent from /setup to the dashboard, not to the wizard", async () => {
    expect(await setup()).toBe("/dashboard");
  });
});

describe("a new account with an invitation waiting (accept not pressed yet)", () => {
  it("with a proven address, goes to the dashboard from every entry", async () => {
    await invite("ines@invitee.example");
    signIn(INVITEE_USER, INVITEE_ORG);

    expect(await onboarding()).toBe("/dashboard");
    expect(await websiteStep()).toBe("/dashboard");
    expect(await setup()).toBe("/dashboard");
    // Adding a site of their own is still possible.
    expect(await websiteStep({ next: "1" })).toBe("rendered");
  });

  it("with an UNPROVEN address, keeps ordinary onboarding (no token-less invitations)", async () => {
    await invite("pat@unverified.example");
    signIn(UNVERIFIED_USER, UNVERIFIED_ORG);

    expect(await onboarding()).toBe("/onboarding/website");
    expect(await websiteStep()).toBe("rendered");
    expect(await setup()).toBe("/onboarding/website");
  });

  it("ignores an expired invitation", async () => {
    await test.db.insert(websiteInvitations).values({
      websiteId: sharedSite,
      email: "ines@invitee.example",
      role: "editor",
      tokenHash: createInvitationToken().hash,
      expiresAt: new Date(Date.now() - 60_000),
      invitedBy: OWNER_USER,
    });
    signIn(INVITEE_USER, INVITEE_ORG);

    expect(await onboarding()).toBe("/onboarding/website");
  });
});

describe("unchanged for everybody else", () => {
  it("a brand-new customer with nothing shared starts setup as before", async () => {
    signIn(NEW_USER, NEW_ORG);

    expect(await onboarding()).toBe("/onboarding/website");
    expect(await websiteStep()).toBe("rendered");
    expect(await setup()).toBe("/onboarding/website");
  });

  it("an owner with an unpaid site is sent to the plan, even with an invitation waiting", async () => {
    const own = await addSite(NEW_ORG, "unpaid.example");
    await invite("nia@new.example");
    signIn(NEW_USER, NEW_ORG);

    expect(await onboarding()).toBe("/onboarding/plan");
    expect(await websiteStep()).toBe("/onboarding/plan");
    expect(await setup()).toBe(`/onboarding/plan?site=${own}`);
  });

  it("an owner following ?site= to a site outside their workspace keeps the old forward", async () => {
    await addSite(NEW_ORG, "unpaid.example");
    await invite("nia@new.example");
    signIn(NEW_USER, NEW_ORG);

    // The state finds no website for a foreign id; before this change that
    // forwarded to "add your website", and an owner must still get that.
    expect(await onboarding({ site: sharedSite })).toBe("/onboarding/website");
  });

  it("a dual-role user's own setup still applies to their own site", async () => {
    const own = await addSite(DUAL_ORG, "dual.example");
    await subscribe(DUAL_ORG, own);
    signIn(DUAL_USER, DUAL_ORG);

    // Paid: setup is over, and the dashboard shows their own site.
    expect(await onboarding()).toBe("/dashboard");
    expect(await websiteStep()).toBe("/onboarding/plan");
    expect(await websiteStep({ next: "1" })).toBe("rendered");
  });

  it("the owner of the shared site is not affected by having shared it", async () => {
    signIn(OWNER_USER, OWNER_ORG);

    expect(await onboarding()).toBe("/dashboard");
    expect(await onboarding({ site: sharedSite })).toBe(`/dashboard?site=${sharedSite}`);
    expect(await websiteStep()).toBe("/onboarding/plan");
  });
});
