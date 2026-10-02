import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestDb, type TestDb } from "@/test/db";

const state = vi.hoisted(() => ({
  db: null as unknown,
  session: null as unknown,
  granted: [] as string[],
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

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

/** The real credit functions, with the monthly grant observed. */
vi.mock("@/lib/backlinks/credits", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/backlinks/credits")>();
  return {
    ...actual,
    grantMonthlyCredits: async (organizationId: string, now?: Date) => {
      state.granted.push(organizationId);
      return actual.grantMonthlyCredits(organizationId, now);
    },
  };
});

import {
  creditLedger,
  member,
  organization,
  user,
  websiteMembers,
  websites,
} from "@/lib/db/schema";

import { getLedger, getNetworkStatus } from "./actions";

/**
 * A guest invited to one website never reads the owner's credits.
 *
 * Credits belong to the WORKSPACE and are shared by all of its websites, so
 * the ledger and balance describe the owner's whole account, not the site the
 * guest was invited to. The Backlinks Overview and Credit activity pages
 * already refused guests; these two server actions answered anyway.
 */

const OWNER_ORG = "org_owner";
const GUEST_ORG = "org_guest";
const OWNER_USER = "user_owner";
const GUEST_USER = "user_guest";

let test: TestDb;
let siteId: string;

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

beforeEach(async () => {
  state.granted = [];
  await test.client.exec(`
    delete from credit_ledger;
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
    .values({ organizationId: OWNER_ORG, domain: "owned.example", url: "https://owned.example" })
    .returning({ id: websites.id });
  siteId = site.id;

  // The owner's money: a purchase made for some other website of theirs.
  await test.db.insert(creditLedger).values({
    organizationId: OWNER_ORG,
    type: "purchase",
    amount: 25,
    note: "Credit pack for another-site.example",
  });
});

function signIn(userId: string, activeOrganizationId: string) {
  state.session = {
    user: { id: userId },
    session: { id: `sess_${userId}`, activeOrganizationId },
  };
}

async function invite(role: "editor" | "viewer") {
  await test.db.insert(websiteMembers).values({ websiteId: siteId, userId: GUEST_USER, role });
}

describe("getLedger", () => {
  it("gives the owner their workspace's ledger", async () => {
    signIn(OWNER_USER, OWNER_ORG);

    expect(await getLedger(siteId)).toEqual([
      expect.objectContaining({ type: "purchase", amount: 25 }),
    ]);
  });

  it.each(["editor", "viewer"] as const)("gives an invited %s nothing", async (role) => {
    await invite(role);
    signIn(GUEST_USER, GUEST_ORG);

    expect(await getLedger(siteId)).toEqual([]);
  });
});

describe("getNetworkStatus", () => {
  it("shows the owner the workspace's credits", async () => {
    signIn(OWNER_USER, OWNER_ORG);

    const status = await getNetworkStatus(siteId);

    expect(status).toMatchObject({ balance: 25, reserved: 0, available: 25, earnedThisMonth: 0 });
    expect(state.granted).toEqual([OWNER_ORG]);
  });

  it.each(["editor", "viewer"] as const)(
    "shows an invited %s the site's network settings but no credits",
    async (role) => {
      await invite(role);
      signIn(GUEST_USER, GUEST_ORG);

      const status = await getNetworkStatus(siteId);

      expect(status).toMatchObject({
        balance: null,
        reserved: null,
        available: null,
        earnedThisMonth: null,
        monthlyCap: expect.any(Number),
        linksGivenThisMonth: 0,
      });
      // Nothing written to the owner's ledger on a guest's behalf, either.
      expect(state.granted).toEqual([]);
    },
  );

  it("is still a 404 for somebody with no access at all", async () => {
    signIn(GUEST_USER, GUEST_ORG);

    await expect(getNetworkStatus(siteId)).rejects.toThrow("Website not found");
  });
});
