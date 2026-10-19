import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { user } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { seedPartner, seedUser } from "@/test/partners";

/**
 * The partner guards derive identity from the session's user and re-read
 * that user from the database: an unverified address never reaches the
 * program, a profile is found by its OWNER only, a suspended partner can see
 * but not act, and nothing here involves a workspace, plan or website.
 */

const state = vi.hoisted(() => ({ db: null as unknown, session: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
  isDatabaseConfigured: () => true,
}));
vi.mock("@/lib/auth-guard", () => ({ getSession: async () => state.session }));
// React's request cache is a no-op outside a render; identity is enough here.
vi.mock("react", async (original) => ({ ...(await original<typeof import("react")>()), cache: <T>(fn: T) => fn }));

import { partnerViewer, requireActivePartner, requirePartnerAccess, requirePartnerApplicant } from "./guards";

let test: TestDb;
const sessionFor = (id: string, email: string, emailVerified = true) => ({
  user: { id, email, emailVerified },
  session: { id: "s", activeOrganizationId: null },
});

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

beforeEach(() => {
  state.session = null;
});

describe("partner guards", () => {
  it("refuses signed-out visitors", async () => {
    await expect(requirePartnerApplicant()).rejects.toMatchObject({ reason: "unauthenticated", status: 401 });
    expect(await partnerViewer()).toEqual({ state: "signed_out" });
  });

  it("reads verification from the user row, not the session", async () => {
    const person = await seedUser(test.db, { verified: false });
    // The session claims verified; the database says otherwise.
    state.session = sessionFor(person.id, person.email, true);
    await expect(requirePartnerApplicant()).rejects.toMatchObject({ reason: "unverified" });
    expect((await partnerViewer()).state).toBe("unverified");

    await test.db.update(user).set({ emailVerified: true }).where(eq(user.id, person.id));
    expect(await requirePartnerApplicant()).toMatchObject({ kind: "applicant", userId: person.id });
  });

  it("lets a verified user without a plan or workspace apply, but not use the portal", async () => {
    const person = await seedUser(test.db);
    state.session = sessionFor(person.id, person.email);
    expect((await partnerViewer()).state).toBe("applicant");
    await expect(requirePartnerAccess()).rejects.toMatchObject({ reason: "not_partner", status: 404 });
  });

  it("finds the profile by its owner only", async () => {
    const owner = await seedPartner(test.db);
    const stranger = await seedUser(test.db);
    state.session = sessionFor(stranger.id, stranger.email);
    await expect(requirePartnerAccess()).rejects.toMatchObject({ reason: "not_partner" });

    state.session = sessionFor(owner.userId, owner.email);
    const access = await requireActivePartner();
    expect(access.context).toEqual({ kind: "partner", userId: owner.userId, partnerId: owner.partnerId });
  });

  it("lets a suspended partner see history but not act", async () => {
    const suspended = await seedPartner(test.db, { status: "suspended" });
    state.session = sessionFor(suspended.userId, suspended.email);
    expect((await requirePartnerAccess()).partner.status).toBe("suspended");
    await expect(requireActivePartner()).rejects.toMatchObject({ reason: "suspended" });
  });
});
