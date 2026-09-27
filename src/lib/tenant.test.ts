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

import { member, organization, user, websiteMembers, websites } from "@/lib/db/schema";

import { isGuestContext, requireWebsite, WebsiteNotFoundError } from "./tenant";

/**
 * Issue 14: a guest acting on somebody else's website must bill the OWNER.
 *
 * WebsiteContext spreads OrgContext, so `orgId` is the CALLER's organization.
 * For an owner the caller and the owner are the same workspace, which is why
 * this was invisible; website_members was empty in production. For a guest they
 * differ, and every `orgId` read for billing charged the guest's own workspace
 * for work done on another tenant's site.
 *
 * `ownerOrgId` and `actorOrgId` name the two meanings so a call site has to say
 * which it wants.
 */

let test: TestDb;

const OWNER_ORG = "org_owner";
const GUEST_ORG = "org_guest";
const OWNER_USER = "user_owner";
const GUEST_USER = "user_guest";

let siteId: string;

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

beforeEach(async () => {
  await test.client.exec(`
    delete from website_members;
    delete from websites;
    delete from "member";
    delete from "user";
    delete from organization;
  `);

  const now = new Date();
  await test.db.insert(organization).values([
    { id: OWNER_ORG, name: "Owner", slug: "owner", createdAt: now },
    { id: GUEST_ORG, name: "Guest", slug: "guest", createdAt: now },
  ]);
  await test.db.insert(user).values([
    { id: OWNER_USER, name: "O", email: "o@example.com", createdAt: now, updatedAt: now },
    { id: GUEST_USER, name: "G", email: "g@example.com", createdAt: now, updatedAt: now },
  ]);
  await test.db.insert(member).values([
    { id: "m_owner", organizationId: OWNER_ORG, userId: OWNER_USER, role: "owner", createdAt: now },
    { id: "m_guest", organizationId: GUEST_ORG, userId: GUEST_USER, role: "owner", createdAt: now },
  ]);

  const [site] = await test.db
    .insert(websites)
    .values({
      organizationId: OWNER_ORG,
      domain: "owned.example",
      url: "https://owned.example",
    })
    .returning({ id: websites.id });
  siteId = site.id;
});

/** Signs in as a user, with the organization their session claims is active. */
function signIn(userId: string, activeOrganizationId: string) {
  state.session = {
    user: { id: userId },
    session: { id: `sess_${userId}`, activeOrganizationId },
  };
}

async function inviteGuest(role: "editor" | "viewer") {
  await test.db.insert(websiteMembers).values({
    websiteId: siteId,
    userId: GUEST_USER,
    role,
  });
}

describe("requireWebsite - owner", () => {
  it("reports the same organization as owner and actor", async () => {
    signIn(OWNER_USER, OWNER_ORG);
    const ctx = await requireWebsite(siteId);

    expect(ctx.access).toBe("owner");
    expect(ctx.ownerOrgId).toBe(OWNER_ORG);
    expect(ctx.actorOrgId).toBe(OWNER_ORG);
    // The legacy field keeps its old meaning for every existing call site.
    expect(ctx.orgId).toBe(OWNER_ORG);
    expect(isGuestContext(ctx)).toBe(false);
  });
});

describe("requireWebsite - invited guest", () => {
  it("BILLS THE OWNER while keeping the guest's identity", async () => {
    await inviteGuest("editor");
    signIn(GUEST_USER, GUEST_ORG);

    const ctx = await requireWebsite(siteId);

    expect(ctx.access).toBe("editor");

    // The whole point of issue 14: money follows the website, not the caller.
    expect(ctx.ownerOrgId).toBe(OWNER_ORG);
    expect(ctx.ownerOrgId).toBe(ctx.site.organizationId);

    // Identity is still the guest's, for authorization and audit.
    expect(ctx.actorOrgId).toBe(GUEST_ORG);
    expect(ctx.userId).toBe(GUEST_USER);

    // The bug in one assertion: the pre-existing field is the GUEST's org, so
    // anything still reading it for billing charges the wrong workspace.
    expect(ctx.orgId).toBe(GUEST_ORG);
    expect(ctx.orgId).not.toBe(ctx.ownerOrgId);

    expect(isGuestContext(ctx)).toBe(true);
  });

  it("does the same for a viewer", async () => {
    await inviteGuest("viewer");
    signIn(GUEST_USER, GUEST_ORG);

    const ctx = await requireWebsite(siteId);
    expect(ctx.access).toBe("viewer");
    expect(ctx.ownerOrgId).toBe(OWNER_ORG);
    expect(ctx.actorOrgId).toBe(GUEST_ORG);
  });
});

describe("tenant isolation is unchanged", () => {
  it("404s a website the caller neither owns nor was invited to", async () => {
    signIn(GUEST_USER, GUEST_ORG);
    await expect(requireWebsite(siteId)).rejects.toThrow(WebsiteNotFoundError);
  });

  it("404s a malformed id without a database cast error", async () => {
    signIn(OWNER_USER, OWNER_ORG);
    await expect(requireWebsite("not-a-uuid")).rejects.toThrow(
      WebsiteNotFoundError,
    );
  });

  it("does not widen a guest's reach to the owner's OTHER sites", async () => {
    await inviteGuest("editor");
    const [other] = await test.db
      .insert(websites)
      .values({
        organizationId: OWNER_ORG,
        domain: "other.example",
        url: "https://other.example",
      })
      .returning({ id: websites.id });

    signIn(GUEST_USER, GUEST_ORG);

    // Invited to one site only.
    expect((await requireWebsite(siteId)).access).toBe("editor");
    await expect(requireWebsite(other.id)).rejects.toThrow(WebsiteNotFoundError);
  });

  it("ignores a session naming an organization the user is not in", async () => {
    // A stale activeOrganizationId must never grant anything: the membership
    // row is the authority.
    signIn(GUEST_USER, OWNER_ORG);
    await expect(requireWebsite(siteId)).rejects.toThrow(WebsiteNotFoundError);
  });
});
