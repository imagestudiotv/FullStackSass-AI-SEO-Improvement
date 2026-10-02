import { randomUUID } from "node:crypto";

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestDb, type TestDb } from "@/test/db";

const state = vi.hoisted(() => ({
  db: null as unknown,
  session: null as unknown,
  /** The "site" cookie - the website last chosen in the switcher. */
  siteCookie: null as string | null,
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

import { resolveDashboard, type DashboardGate } from "./gate";

/**
 * What /dashboard does for each kind of person.
 *
 * The production failure: an invited editor owns nothing, so the dashboard
 * asked about THEIR empty workspace, sent them to onboarding, and the site
 * they were invited to was never shown. A shared site now skips onboarding
 * and the owner's paywall entirely, while an owner's path - paywall, then
 * onboarding - is exactly what it was.
 */

let test: TestDb;

const OWNER_ORG = "org_owner";
const GUEST_ORG = "org_guest";
const DUAL_ORG = "org_dual";
const NEW_ORG = "org_new";
const OWNER_USER = "user_owner";
const GUEST_USER = "user_guest";
const DUAL_USER = "user_dual";
const NEW_USER = "user_new";

/** The owner's sites: invited (shared with guest and dual), private (not shared). */
let invitedSite: string;
let privateSite: string;

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

beforeEach(async () => {
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
    [OWNER_ORG, GUEST_ORG, DUAL_ORG, NEW_ORG].map((id) => ({
      id,
      name: id,
      slug: id,
      createdAt: now,
    })),
  );
  await test.db.insert(user).values([
    { id: OWNER_USER, name: "Olivia", email: "olivia@owner.example", emailVerified: true, createdAt: now, updatedAt: now },
    { id: GUEST_USER, name: "Gus", email: "gus@guest.example", emailVerified: true, createdAt: now, updatedAt: now },
    { id: DUAL_USER, name: "Dee", email: "dee@dual.example", emailVerified: true, createdAt: now, updatedAt: now },
    { id: NEW_USER, name: "Nia", email: "nia@new.example", emailVerified: true, createdAt: now, updatedAt: now },
  ]);
  await test.db.insert(member).values([
    { id: "m1", organizationId: OWNER_ORG, userId: OWNER_USER, role: "owner", createdAt: now },
    { id: "m2", organizationId: GUEST_ORG, userId: GUEST_USER, role: "owner", createdAt: now },
    { id: "m3", organizationId: DUAL_ORG, userId: DUAL_USER, role: "owner", createdAt: now },
    { id: "m4", organizationId: NEW_ORG, userId: NEW_USER, role: "owner", createdAt: now },
  ]);

  invitedSite = await addSite(OWNER_ORG, "invited.example", new Date(Date.UTC(2026, 0, 1)));
  privateSite = await addSite(OWNER_ORG, "private.example", new Date(Date.UTC(2026, 0, 2)));
  await subscribe(OWNER_ORG, invitedSite, "active");
  await subscribe(OWNER_ORG, privateSite, "active");
  await share(invitedSite, GUEST_USER, "editor");
});

async function addSite(orgId: string, domain: string, createdAt = new Date()) {
  const [site] = await test.db
    .insert(websites)
    .values({ organizationId: orgId, domain, url: `https://${domain}`, status: "ready", createdAt })
    .returning({ id: websites.id });
  return site.id;
}

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

async function share(websiteId: string, userId: string, role: "editor" | "viewer") {
  await test.db.insert(websiteMembers).values({ websiteId, userId, role });
}

async function pendingInvite(email: string, websiteId = invitedSite) {
  await test.db.insert(websiteInvitations).values({
    websiteId,
    email,
    role: "editor",
    tokenHash: createInvitationToken().hash,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    invitedBy: OWNER_USER,
  });
}

function signIn(userId: string, activeOrganizationId: string) {
  state.session = {
    user: { id: userId },
    session: { id: `sess_${userId}`, activeOrganizationId },
  };
}

/** Narrows to a kind that carries a website context. */
function siteOf(gate: DashboardGate) {
  if (gate.kind !== "site" && gate.kind !== "inactive") {
    throw new Error(`expected a website, got ${gate.kind}`);
  }
  return gate.ctx;
}

/** Narrows to a kind that carries invitations - every kind but "empty". */
function invitationsOf(gate: DashboardGate) {
  if (gate.kind === "empty") throw new Error("expected invitations, got empty");
  return gate.invitations;
}

describe("a guest-only user (invited, owns nothing)", () => {
  it("gets the shared site as an EDITOR, billed to the owner - not onboarding", async () => {
    signIn(GUEST_USER, GUEST_ORG);

    const gate = await resolveDashboard(null);
    expect(gate.kind).toBe("site");

    const ctx = siteOf(gate);
    expect(ctx.site.id).toBe(invitedSite);
    expect(ctx.access).toBe("editor");
    expect(ctx.ownerOrgId).toBe(OWNER_ORG);
    expect(ctx.actorOrgId).toBe(GUEST_ORG);
  });

  it("gets the viewer role when invited as a viewer", async () => {
    await test.client.exec(`update website_members set role = 'viewer'`);
    signIn(GUEST_USER, GUEST_ORG);

    expect(siteOf(await resolveDashboard(null)).access).toBe("viewer");
  });

  it("cannot reach the owner's other site through ?site= - it falls back to the shared one", async () => {
    signIn(GUEST_USER, GUEST_ORG);

    const ctx = siteOf(await resolveDashboard(privateSite));
    expect(ctx.site.id).toBe(invitedSite);
  });

  describe("with two shared sites", () => {
    let secondShared: string;

    beforeEach(async () => {
      // Granted after invitedSite, so invitedSite is the default.
      secondShared = await addSite(OWNER_ORG, "second.example", new Date(Date.UTC(2026, 0, 3)));
      await subscribe(OWNER_ORG, secondShared, "active");
      await share(secondShared, GUEST_USER, "viewer");
    });

    it("keeps the site last chosen in the switcher on a bare /dashboard", async () => {
      // The sidebar's "Dashboard", the logo and sign-in all carry no ?site=.
      state.siteCookie = secondShared;
      signIn(GUEST_USER, GUEST_ORG);

      const ctx = siteOf(await resolveDashboard(null));
      expect(ctx.site.id).toBe(secondShared);
      expect(ctx.access).toBe("viewer");
    });

    it("still honours ?site= over the remembered site", async () => {
      state.siteCookie = secondShared;
      signIn(GUEST_USER, GUEST_ORG);

      expect(siteOf(await resolveDashboard(invitedSite)).site.id).toBe(invitedSite);
    });

    it("keeps the remembered site when ?site= names one they cannot open", async () => {
      state.siteCookie = secondShared;
      signIn(GUEST_USER, GUEST_ORG);

      expect(siteOf(await resolveDashboard(privateSite)).site.id).toBe(secondShared);
    });

    it("ignores a remembered site they cannot open and takes the first shared one", async () => {
      state.siteCookie = privateSite;
      signIn(GUEST_USER, GUEST_ORG);

      expect(siteOf(await resolveDashboard(null)).site.id).toBe(invitedSite);
    });
  });

  it("sees the site as paused when the owner's plan for it is not active", async () => {
    await test.client.exec(
      `update subscriptions set status = 'canceled' where website_id = '${invitedSite}'`,
    );
    signIn(GUEST_USER, GUEST_ORG);

    const gate = await resolveDashboard(null);
    expect(gate.kind).toBe("inactive");
    expect(siteOf(gate).site.id).toBe(invitedSite);
  });
});

/** Exactly /onboarding - not the plan screen, which also starts with it. */
const ONBOARDING_ONLY = /^redirect:\/onboarding$/;

describe("a brand-new user", () => {
  it("is sent to onboarding, as before", async () => {
    signIn(NEW_USER, NEW_ORG);
    await expect(resolveDashboard(null)).rejects.toThrow(ONBOARDING_ONLY);
  });

  it("sees their pending invitation instead of onboarding when their address is verified", async () => {
    await pendingInvite("nia@new.example");
    signIn(NEW_USER, NEW_ORG);

    const gate = await resolveDashboard(null);
    expect(gate.kind).toBe("invitations");
    expect(invitationsOf(gate)).toHaveLength(1);
    expect(invitationsOf(gate)[0]).toMatchObject({
      domain: "invited.example",
      role: "editor",
      invitedByName: "Olivia",
    });
  });

  it("is still sent to onboarding when the address is not verified", async () => {
    await test.client.exec(
      `update "user" set email_verified = false where id = '${NEW_USER}'`,
    );
    await pendingInvite("nia@new.example");
    signIn(NEW_USER, NEW_ORG);

    await expect(resolveDashboard(null)).rejects.toThrow(ONBOARDING_ONLY);
  });
});

describe("an owner (unchanged)", () => {
  it("gets their oldest site as owner", async () => {
    signIn(OWNER_USER, OWNER_ORG);

    const gate = await resolveDashboard(null);
    expect(gate.kind).toBe("site");
    const ctx = siteOf(gate);
    expect(ctx.site.id).toBe(invitedSite);
    expect(ctx.access).toBe("owner");
    expect(ctx.ownerOrgId).toBe(OWNER_ORG);
  });

  it("gets the requested site of their own", async () => {
    signIn(OWNER_USER, OWNER_ORG);
    expect(siteOf(await resolveDashboard(privateSite)).site.id).toBe(privateSite);
  });

  it("falls back silently from another tenant's id", async () => {
    const foreign = await addSite(DUAL_ORG, "foreign.example");
    signIn(OWNER_USER, OWNER_ORG);

    expect(siteOf(await resolveDashboard(foreign)).site.id).toBe(invitedSite);
  });

  it("still hits the paywall for an unpaid website", async () => {
    await test.client.exec(`delete from subscriptions`);
    signIn(OWNER_USER, OWNER_ORG);

    await expect(resolveDashboard(null)).rejects.toThrow(
      `redirect:/onboarding/plan?site=${invitedSite}`,
    );
  });

  it("still defaults to their oldest site whatever the switcher remembers", async () => {
    state.siteCookie = privateSite;
    signIn(OWNER_USER, OWNER_ORG);

    expect(siteOf(await resolveDashboard(null)).site.id).toBe(invitedSite);
  });
});

describe("a dual-role user (own site, plus one shared with them)", () => {
  let ownSite: string;

  beforeEach(async () => {
    // Their own site is unpaid; the shared one is paid by its owner.
    ownSite = await addSite(DUAL_ORG, "dual-own.example");
    await share(invitedSite, DUAL_USER, "editor");
  });

  it("gets the shared site as an editor, not their own unpaid site's plan screen", async () => {
    /*
      The invitee who once typed a domain into "add your website": that site
      is unpaid, and sending every sign-in to its plan screen - which has no
      way back - kept them from the site they were invited to.
    */
    signIn(DUAL_USER, DUAL_ORG);

    const gate = await resolveDashboard(null);
    expect(gate.kind).toBe("site");
    const ctx = siteOf(gate);
    expect(ctx.site.id).toBe(invitedSite);
    expect(ctx.access).toBe("editor");
    expect(ctx.ownerOrgId).toBe(OWNER_ORG);
  });

  it("still meets THEIR OWN paywall when ?site= names their own site", async () => {
    signIn(DUAL_USER, DUAL_ORG);

    await expect(resolveDashboard(ownSite)).rejects.toThrow(
      `redirect:/onboarding/plan?site=${ownSite}`,
    );
  });

  it("takes the shared site last chosen, when their own is unpaid", async () => {
    const secondShared = await addSite(OWNER_ORG, "second.example", new Date(Date.UTC(2026, 0, 3)));
    await subscribe(OWNER_ORG, secondShared, "active");
    await share(secondShared, DUAL_USER, "viewer");
    state.siteCookie = secondShared;
    signIn(DUAL_USER, DUAL_ORG);

    const ctx = siteOf(await resolveDashboard(null));
    expect(ctx.site.id).toBe(secondShared);
    expect(ctx.access).toBe("viewer");
  });

  it("gets their invitations, not the plan screen, when nothing is shared yet", async () => {
    await test.client.exec(`delete from website_members`);
    await pendingInvite("dee@dual.example", privateSite);
    signIn(DUAL_USER, DUAL_ORG);

    const gate = await resolveDashboard(null);
    expect(gate.kind).toBe("invitations");
    expect(invitationsOf(gate).map((i) => i.domain)).toEqual(["private.example"]);
  });

  it("meets their own paywall when nothing is shared and nothing is waiting", async () => {
    // Exactly an owner: their path is the owner's, unchanged.
    await test.client.exec(`delete from website_members`);
    signIn(DUAL_USER, DUAL_ORG);

    await expect(resolveDashboard(null)).rejects.toThrow(
      `redirect:/onboarding/plan?site=${ownSite}`,
    );
  });

  it("gets the shared view when ?site= names the shared site", async () => {
    signIn(DUAL_USER, DUAL_ORG);

    const gate = await resolveDashboard(invitedSite);
    expect(gate.kind).toBe("site");
    const ctx = siteOf(gate);
    expect(ctx.site.id).toBe(invitedSite);
    expect(ctx.access).toBe("editor");
    expect(ctx.ownerOrgId).toBe(OWNER_ORG);
  });

  it("gets their own site by default once it is paid", async () => {
    await subscribe(DUAL_ORG, ownSite, "active");
    signIn(DUAL_USER, DUAL_ORG);

    const ctx = siteOf(await resolveDashboard(null));
    expect(ctx.site.id).toBe(ownSite);
    expect(ctx.access).toBe("owner");
  });

  it("gets their own paid site even when the switcher remembers the shared one", async () => {
    // The owner default is untouched by the cookie; the page re-syncs the shell.
    await subscribe(DUAL_ORG, ownSite, "active");
    state.siteCookie = invitedSite;
    signIn(DUAL_USER, DUAL_ORG);

    const ctx = siteOf(await resolveDashboard(null));
    expect(ctx.site.id).toBe(ownSite);
    expect(ctx.access).toBe("owner");
  });

  it("carries pending invitations alongside a site", async () => {
    await subscribe(DUAL_ORG, ownSite, "active");
    await pendingInvite("dee@dual.example", privateSite);
    signIn(DUAL_USER, DUAL_ORG);

    const gate = await resolveDashboard(null);
    expect(gate.kind).toBe("site");
    expect(invitationsOf(gate).map((i) => i.domain)).toEqual(["private.example"]);
  });
});
