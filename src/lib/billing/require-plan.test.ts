import { randomUUID } from "node:crypto";

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestDb, type TestDb } from "@/test/db";

const state = vi.hoisted(() => ({
  db: null as unknown,
  session: null as unknown,
}));

vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
}));

/** requireOrg reads the session; the database decides membership. */
vi.mock("@/lib/auth-guard", () => ({
  getSession: async () => state.session,
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

import {
  agencyWorkspaces,
  member,
  organization,
  plans,
  subscriptions,
  user,
  websiteMembers,
  websites,
} from "@/lib/db/schema";
import { requireWebsite } from "@/lib/tenant";

import { requirePlan, requireWebsitePlan } from "./require-plan";

/**
 * The paywall, for owners and for guests.
 *
 * requirePlan is LOCKED: an owner's unpaid site still sends them to their own
 * plan screen, exactly as before. requireWebsitePlan adds the guest's answer -
 * judged on the shared site alone, and never the owner's checkout or the
 * owner's other site ids.
 */

let test: TestDb;

const OWNER_USER = "user_owner";
const GUEST_USER = "user_guest";
const GUEST_ORG = "org_guest";

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

beforeEach(async () => {
  await test.client.exec(`
    delete from website_members;
    delete from subscriptions;
    delete from agency_workspaces;
    delete from websites;
    delete from plans;
    delete from "member";
    delete from "user";
    delete from organization;
  `);

  const now = new Date();
  await test.db.insert(user).values([
    { id: OWNER_USER, name: "O", email: "o@example.com", createdAt: now, updatedAt: now },
    { id: GUEST_USER, name: "G", email: "g@example.com", createdAt: now, updatedAt: now },
  ]);
  await test.db
    .insert(organization)
    .values({ id: GUEST_ORG, name: "Guest", slug: GUEST_ORG, createdAt: now });
  await test.db.insert(member).values({
    id: "m_guest",
    organizationId: GUEST_ORG,
    userId: GUEST_USER,
    role: "owner",
    createdAt: now,
  });
});

/** A workspace owned by OWNER_USER. */
async function ownerWorkspace() {
  const orgId = `org_${randomUUID()}`;
  await test.db
    .insert(organization)
    .values({ id: orgId, name: "Owner", slug: orgId, createdAt: new Date() });
  await test.db.insert(member).values({
    id: `m_${orgId}`,
    organizationId: orgId,
    userId: OWNER_USER,
    role: "owner",
    createdAt: new Date(),
  });
  return orgId;
}

async function addSite(orgId: string, createdAt = new Date()) {
  const domain = `${randomUUID()}.example`;
  const [site] = await test.db
    .insert(websites)
    .values({ organizationId: orgId, domain, url: `https://${domain}`, status: "ready", createdAt })
    .returning({ id: websites.id });
  return site.id;
}

/** This website's own subscription, as fixtures.ts writes one. */
async function subscribe(orgId: string, websiteId: string, status: string) {
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

async function invite(websiteId: string, role: "editor" | "viewer" = "editor") {
  await test.db.insert(websiteMembers).values({ websiteId, userId: GUEST_USER, role });
}

function signIn(userId: string, activeOrganizationId: string) {
  state.session = {
    user: { id: userId },
    session: { id: `sess_${userId}`, activeOrganizationId },
  };
}

describe("requirePlan (unchanged for owners)", () => {
  it("sends an owner with an unpaid website to THEIR plan screen", async () => {
    const orgId = await ownerWorkspace();
    const siteId = await addSite(orgId);

    await expect(requirePlan(orgId)).rejects.toThrow(
      `redirect:/onboarding/plan?site=${siteId}`,
    );
  });

  it("lets a paid owner through and returns the state it read", async () => {
    const orgId = await ownerWorkspace();
    const siteId = await addSite(orgId);
    await subscribe(orgId, siteId, "active");

    const onboarding = await requirePlan(orgId);
    expect(onboarding.hasPlan).toBe(true);
    expect(onboarding.websiteId).toBe(siteId);
  });

  it("does not redirect a workspace with no website yet", async () => {
    const orgId = await ownerWorkspace();

    const onboarding = await requirePlan(orgId);
    expect(onboarding.websiteId).toBeNull();
  });
});

describe("requireWebsitePlan - owner", () => {
  it("is requirePlan for an owner: unpaid goes to their own plan screen", async () => {
    const orgId = await ownerWorkspace();
    const siteId = await addSite(orgId);
    signIn(OWNER_USER, orgId);

    const ctx = await requireWebsite(siteId);
    expect(ctx.access).toBe("owner");
    await expect(requireWebsitePlan(ctx)).rejects.toThrow(
      `redirect:/onboarding/plan?site=${siteId}`,
    );
  });

  it("lets a paid owner through", async () => {
    const orgId = await ownerWorkspace();
    const siteId = await addSite(orgId);
    await subscribe(orgId, siteId, "active");
    signIn(OWNER_USER, orgId);

    await expect(requireWebsitePlan(await requireWebsite(siteId))).resolves.toBeUndefined();
  });
});

describe("requireWebsitePlan - guest", () => {
  it("lets a guest through when the shared website's plan is active", async () => {
    const orgId = await ownerWorkspace();
    const siteId = await addSite(orgId);
    await subscribe(orgId, siteId, "active");
    await invite(siteId);
    signIn(GUEST_USER, GUEST_ORG);

    const ctx = await requireWebsite(siteId);
    expect(ctx.access).toBe("editor");
    await expect(requireWebsitePlan(ctx)).resolves.toBeUndefined();
  });

  it("treats a trialing plan as active, as the spend check does", async () => {
    const orgId = await ownerWorkspace();
    const siteId = await addSite(orgId);
    await subscribe(orgId, siteId, "trialing");
    await invite(siteId, "viewer");
    signIn(GUEST_USER, GUEST_ORG);

    await expect(requireWebsitePlan(await requireWebsite(siteId))).resolves.toBeUndefined();
  });

  it("sends a guest on a lapsed site to the dashboard for THAT site - never the owner's checkout", async () => {
    const orgId = await ownerWorkspace();
    // The owner's oldest site, unpaid, which the guest was NOT invited to.
    const ownersOldest = await addSite(orgId, new Date(Date.UTC(2026, 0, 1)));
    const invited = await addSite(orgId, new Date(Date.UTC(2026, 0, 2)));
    await subscribe(orgId, invited, "canceled");
    await invite(invited);

    // The owner's paywall would name the owner's oldest site.
    await expect(requirePlan(orgId)).rejects.toThrow(
      `redirect:/onboarding/plan?site=${ownersOldest}`,
    );

    signIn(GUEST_USER, GUEST_ORG);
    const error = await requireWebsitePlan(await requireWebsite(invited)).catch(
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe(`redirect:/dashboard?site=${invited}`);
    expect((error as Error).message).not.toContain(ownersOldest);
    expect((error as Error).message).not.toContain("onboarding");
  });

  it("treats a shared site with no subscription at all as paused", async () => {
    const orgId = await ownerWorkspace();
    const siteId = await addSite(orgId);
    await invite(siteId);
    signIn(GUEST_USER, GUEST_ORG);

    await expect(requireWebsitePlan(await requireWebsite(siteId))).rejects.toThrow(
      `redirect:/dashboard?site=${siteId}`,
    );
  });

  it("judges the shared site alone: an unpaid sibling site does not lock the guest out", async () => {
    const orgId = await ownerWorkspace();
    await addSite(orgId, new Date(Date.UTC(2026, 0, 1)));
    const invited = await addSite(orgId, new Date(Date.UTC(2026, 0, 2)));
    await subscribe(orgId, invited, "active");
    await invite(invited);
    signIn(GUEST_USER, GUEST_ORG);

    await expect(requireWebsitePlan(await requireWebsite(invited))).resolves.toBeUndefined();
  });

  it("lets a guest through on an agency workspace's site, which needs no plan", async () => {
    const orgId = await ownerWorkspace();
    const siteId = await addSite(orgId);
    await test.db.insert(agencyWorkspaces).values({ organizationId: orgId });
    await invite(siteId);
    signIn(GUEST_USER, GUEST_ORG);

    await expect(requireWebsitePlan(await requireWebsite(siteId))).resolves.toBeUndefined();
  });
});
