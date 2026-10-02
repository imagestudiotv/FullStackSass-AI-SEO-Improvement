import { eq } from "drizzle-orm";
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
  // listPendingInvitations, for hasOnlySharedWork.
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

import {
  member,
  organization,
  user,
  websiteInvitations,
  websiteMembers,
  websites,
} from "@/lib/db/schema";
import { requireWebsite, WebsiteNotFoundError } from "@/lib/tenant";
import { createInvitationToken } from "@/lib/websites/invitation-token";

import {
  accessibleWebsitesFor,
  hasOnlySharedWork,
  isGuestOnly,
  listAccessibleWebsites,
  pickDashboardSite,
  type AccessibleWebsite,
} from "./accessible";

/**
 * The list that lets routing see websites shared with the caller.
 *
 * It must never show more than requireWebsite grants: a guest invited to one
 * site sees that site and nothing else of the owner's, and every id listed
 * opens with the same access the list claims.
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

/** Owner's sites: invited is shared with the guest, other is not. */
let invitedSite: string;
let otherSite: string;
/** A second owner's site, shared with the dual-role user after invitedSite. */
let laterShared: string;
/** The dual-role user's own sites. */
let dualOld: string;
let dualNew: string;

const day = (n: number) => new Date(Date.UTC(2026, 0, n));

async function addSite(orgId: string, domain: string, createdAt: Date) {
  const [site] = await test.db
    .insert(websites)
    .values({ organizationId: orgId, domain, url: `https://${domain}`, createdAt })
    .returning({ id: websites.id });
  return site.id;
}

async function share(
  websiteId: string,
  userId: string,
  role: string,
  createdAt: Date,
) {
  await test.db
    .insert(websiteMembers)
    .values({ websiteId, userId, role, createdAt });
}

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

beforeEach(async () => {
  await test.client.exec(`
    delete from website_invitations;
    delete from website_members;
    delete from websites;
    delete from "member";
    delete from "user";
    delete from organization;
  `);

  const now = new Date();
  await test.db.insert(organization).values(
    [OWNER_ORG, GUEST_ORG, DUAL_ORG, NEW_ORG, "org_second_owner"].map((id) => ({
      id,
      name: id,
      slug: id,
      createdAt: now,
    })),
  );
  await test.db.insert(user).values(
    [OWNER_USER, GUEST_USER, DUAL_USER, NEW_USER].map((id) => ({
      id,
      name: id,
      email: `${id}@example.com`,
      createdAt: now,
      updatedAt: now,
    })),
  );
  await test.db.insert(member).values([
    { id: "m1", organizationId: OWNER_ORG, userId: OWNER_USER, role: "owner", createdAt: now },
    { id: "m2", organizationId: GUEST_ORG, userId: GUEST_USER, role: "owner", createdAt: now },
    { id: "m3", organizationId: DUAL_ORG, userId: DUAL_USER, role: "owner", createdAt: now },
    { id: "m4", organizationId: NEW_ORG, userId: NEW_USER, role: "owner", createdAt: now },
  ]);

  // Inserted out of date order, so only the ORDER BY can put them right.
  otherSite = await addSite(OWNER_ORG, "other.example", day(5));
  invitedSite = await addSite(OWNER_ORG, "invited.example", day(1));
  laterShared = await addSite("org_second_owner", "later.example", day(2));
  dualNew = await addSite(DUAL_ORG, "dual-new.example", day(20));
  dualOld = await addSite(DUAL_ORG, "dual-old.example", day(10));

  await share(invitedSite, GUEST_USER, "editor", day(3));
  // Granted later than invitedSite, though the website itself is older.
  await share(laterShared, DUAL_USER, "viewer", day(9));
  await share(invitedSite, DUAL_USER, "editor", day(8));
});

function signIn(userId: string, activeOrganizationId: string) {
  state.session = {
    user: { id: userId },
    session: { id: `sess_${userId}`, activeOrganizationId },
  };
}

const ids = (sites: AccessibleWebsite[]) => sites.map((site) => site.id);

describe("accessibleWebsitesFor", () => {
  it("lists only what an owner's workspace owns, oldest first", async () => {
    const sites = await accessibleWebsitesFor(OWNER_ORG, OWNER_USER);

    expect(ids(sites)).toEqual([invitedSite, otherSite]);
    expect(sites.every((site) => site.access === "owner")).toBe(true);
  });

  it("lists a guest's invited site with its role, and NOT the owner's other site", async () => {
    const sites = await accessibleWebsitesFor(GUEST_ORG, GUEST_USER);

    expect(sites).toHaveLength(1);
    expect(sites[0]).toMatchObject({
      id: invitedSite,
      domain: "invited.example",
      access: "editor",
    });
    expect(ids(sites)).not.toContain(otherSite);
  });

  it("never carries an organization id to the client", async () => {
    const [site] = await accessibleWebsitesFor(GUEST_ORG, GUEST_USER);
    expect(Object.keys(site).sort()).toEqual(
      ["access", "brandName", "createdAt", "domain", "id", "industry", "status", "url"],
    );
    expect(JSON.stringify(site)).not.toContain(OWNER_ORG);
  });

  it("puts owned sites first (oldest first), then shared ones in the order they were granted", async () => {
    const sites = await accessibleWebsitesFor(DUAL_ORG, DUAL_USER);

    expect(ids(sites)).toEqual([dualOld, dualNew, invitedSite, laterShared]);
    expect(sites.map((site) => site.access)).toEqual([
      "owner",
      "owner",
      "editor",
      "viewer",
    ]);
  });

  it("drops a shared site the moment the membership is removed", async () => {
    await test.client.exec(
      `delete from website_members where user_id = '${GUEST_USER}'`,
    );
    expect(await accessibleWebsitesFor(GUEST_ORG, GUEST_USER)).toEqual([]);
  });

  it("lists a site the workspace owns ONCE, as owner, even with a stray membership row", async () => {
    // Somebody invited to a site before joining the workspace that owns it.
    await share(otherSite, OWNER_USER, "viewer", day(30));

    const sites = await accessibleWebsitesFor(OWNER_ORG, OWNER_USER);
    expect(ids(sites)).toEqual([invitedSite, otherSite]);
    expect(sites.every((site) => site.access === "owner")).toBe(true);
  });

  it("maps any role but viewer to editor, as requireWebsite does", async () => {
    await test.client.exec(
      `update website_members set role = 'something-else' where user_id = '${GUEST_USER}'`,
    );
    const [site] = await accessibleWebsitesFor(GUEST_ORG, GUEST_USER);
    expect(site.access).toBe("editor");
  });

  it("lists nothing for a brand-new account", async () => {
    expect(await accessibleWebsitesFor(NEW_ORG, NEW_USER)).toEqual([]);
  });
});

describe("the list never disagrees with requireWebsite", () => {
  const callers = [
    [OWNER_USER, OWNER_ORG],
    [GUEST_USER, GUEST_ORG],
    [DUAL_USER, DUAL_ORG],
  ] as const;

  it.each(callers)("every id listed for %s opens with the same access", async (userId, orgId) => {
    signIn(userId, orgId);
    const sites = await listAccessibleWebsites();
    expect(sites.length).toBeGreaterThan(0);

    for (const site of sites) {
      const ctx = await requireWebsite(site.id);
      expect(ctx.access).toBe(site.access);
    }
  });

  it("an owner site the guest cannot see is also refused by requireWebsite", async () => {
    signIn(GUEST_USER, GUEST_ORG);
    expect(ids(await listAccessibleWebsites())).not.toContain(otherSite);
    await expect(requireWebsite(otherSite)).rejects.toThrow(WebsiteNotFoundError);
  });
});

describe("isGuestOnly", () => {
  it("is true for someone who owns nothing and was invited to a site", async () => {
    signIn(GUEST_USER, GUEST_ORG);
    expect(await isGuestOnly()).toBe(true);
  });

  it("is false for an owner", async () => {
    signIn(OWNER_USER, OWNER_ORG);
    expect(await isGuestOnly()).toBe(false);
  });

  it("is false for someone with sites of their own AND shared ones", async () => {
    signIn(DUAL_USER, DUAL_ORG);
    expect(await isGuestOnly()).toBe(false);
  });

  it("is false for a brand-new account - onboarding is right for them", async () => {
    signIn(NEW_USER, NEW_ORG);
    expect(await isGuestOnly()).toBe(false);
  });
});

describe("hasOnlySharedWork", () => {
  /** A pending invitation to `email`; the address is proven separately. */
  async function invite(email: string) {
    await test.db.insert(websiteInvitations).values({
      websiteId: otherSite,
      email,
      role: "editor",
      tokenHash: createInvitationToken().hash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      invitedBy: OWNER_USER,
    });
  }

  async function verify(userId: string) {
    await test.db.update(user).set({ emailVerified: true }).where(eq(user.id, userId));
  }

  it("is true for someone who owns nothing and was given a site", async () => {
    signIn(GUEST_USER, GUEST_ORG);
    expect(await hasOnlySharedWork()).toBe(true);
  });

  it("is true for someone who owns nothing and has an invitation waiting", async () => {
    await invite(`${NEW_USER}@example.com`);
    await verify(NEW_USER);
    signIn(NEW_USER, NEW_ORG);
    expect(await hasOnlySharedWork()).toBe(true);
  });

  it("is false while that address is unproven - no invitation is listed for it", async () => {
    await invite(`${NEW_USER}@example.com`);
    signIn(NEW_USER, NEW_ORG);
    expect(await hasOnlySharedWork()).toBe(false);
  });

  it("is false for a brand-new account with nothing waiting", async () => {
    signIn(NEW_USER, NEW_ORG);
    expect(await hasOnlySharedWork()).toBe(false);
  });

  it("is false for an owner, and for a dual-role user, invitations or not", async () => {
    await invite(`${DUAL_USER}@example.com`);
    await verify(DUAL_USER);
    signIn(DUAL_USER, DUAL_ORG);
    expect(await hasOnlySharedWork()).toBe(false);

    signIn(OWNER_USER, OWNER_ORG);
    expect(await hasOnlySharedWork()).toBe(false);
  });
});

describe("pickDashboardSite", () => {
  const site = (
    id: string,
    access: AccessibleWebsite["access"],
  ): AccessibleWebsite => ({
    id,
    url: `https://${id}.example`,
    domain: `${id}.example`,
    brandName: null,
    industry: null,
    status: "ready",
    createdAt: new Date(),
    access,
  });

  const ownedOld = site("owned-old", "owner");
  const ownedNew = site("owned-new", "owner");
  const sharedA = site("shared-a", "editor");
  const sharedB = site("shared-b", "viewer");
  const dual = [ownedOld, ownedNew, sharedA, sharedB];

  it("honours a requested site that is listed, shared ones included", () => {
    expect(pickDashboardSite(dual, "shared-b")).toBe(sharedB);
    expect(pickDashboardSite(dual, "owned-new")).toBe(ownedNew);
  });

  it("falls back SILENTLY to the oldest owned site for an id that is not listed", () => {
    expect(pickDashboardSite(dual, "somebody-elses")).toBe(ownedOld);
  });

  it("defaults to the oldest owned site when nothing is requested", () => {
    expect(pickDashboardSite(dual, null)).toBe(ownedOld);
  });

  it("defaults to the first shared site when nothing is owned", () => {
    expect(pickDashboardSite([sharedA, sharedB], null)).toBe(sharedA);
    expect(pickDashboardSite([sharedA, sharedB], "unknown")).toBe(sharedA);
  });

  it("returns null when there is nothing at all", () => {
    expect(pickDashboardSite([], null)).toBeNull();
    expect(pickDashboardSite([], "anything")).toBeNull();
  });
});
