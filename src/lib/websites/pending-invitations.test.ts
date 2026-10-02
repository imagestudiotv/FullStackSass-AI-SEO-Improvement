import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestDb, type TestDb } from "@/test/db";

const state = vi.hoisted(() => ({
  db: null as unknown,
  session: null as unknown,
  cookies: new Map<string, string>(),
  revalidated: [] as string[],
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

/** The selected-website cookie, written by both accept actions. */
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      state.cookies.has(name) ? { name, value: state.cookies.get(name) } : undefined,
    set: (name: string, value: string) => {
      state.cookies.set(name, value);
    },
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: (path: string, type?: string) => {
    state.revalidated.push(`${path}:${type ?? ""}`);
  },
}));

import { eq } from "drizzle-orm";

import { acceptPendingInvitationAction } from "@/app/(app)/dashboard/invitation-actions";
import { acceptInvitationAction } from "@/app/invite/[token]/actions";
import {
  member,
  organization,
  user,
  websiteInvitations,
  websiteMembers,
  websites,
} from "@/lib/db/schema";
import {
  acceptInvitation,
  acceptPendingInvitation,
  lookupInvitation,
} from "@/lib/websites/accept-invitation";
import { createInvitationToken } from "@/lib/websites/invitation-token";

import { listPendingInvitations, pendingInvitationsFor } from "./pending-invitations";

/**
 * Invitations waiting on the dashboard, and accepting one without the link.
 *
 * The rule that makes this safe: only an account whose address is PROVEN
 * (emailVerified === true - Google or a one-time code) sees or accepts by id.
 * A password-only account could have been registered under anybody's address,
 * so it keeps using the emailed link, which is its own proof.
 */

let test: TestDb;

const OWNER_ORG = "org_owner";
const OWNER_USER = "user_owner";
const INVITEE = "user_invitee";
const UNVERIFIED = "user_unverified";
const STRANGER = "user_stranger";

const INVITEE_EMAIL = "editor@client.example";

let siteId: string;
let otherSiteId: string;

const DAY = 24 * 60 * 60 * 1000;

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
  state.cookies.clear();
  state.revalidated = [];
  state.session = null;

  const now = new Date();
  await test.db
    .insert(organization)
    .values({ id: OWNER_ORG, name: "Owner", slug: OWNER_ORG, createdAt: now });
  await test.db.insert(user).values([
    { id: OWNER_USER, name: "Olivia Owner", email: "olivia@owner.example", emailVerified: true, createdAt: now, updatedAt: now },
    // Mixed case on purpose: invitations are stored lower-cased, accounts are not.
    { id: INVITEE, name: "Ed", email: "Editor@Client.example", emailVerified: true, createdAt: now, updatedAt: now },
    { id: UNVERIFIED, name: "Pat", email: "pat@client.example", emailVerified: false, createdAt: now, updatedAt: now },
    { id: STRANGER, name: "Sam", email: "sam@elsewhere.example", emailVerified: true, createdAt: now, updatedAt: now },
  ]);
  await test.db.insert(member).values({
    id: "m_owner",
    organizationId: OWNER_ORG,
    userId: OWNER_USER,
    role: "owner",
    createdAt: now,
  });

  const [site, other] = await test.db
    .insert(websites)
    .values([
      { organizationId: OWNER_ORG, domain: "client.example", url: "https://client.example" },
      { organizationId: OWNER_ORG, domain: "second.example", url: "https://second.example" },
    ])
    .returning({ id: websites.id });
  siteId = site.id;
  otherSiteId = other.id;
});

/** An invitation as members.ts writes one. Returns its id and raw token. */
async function invite(
  options: {
    email?: string;
    websiteId?: string;
    role?: "editor" | "viewer";
    expiresAt?: Date;
    acceptedAt?: Date | null;
    invitedBy?: string | null;
  } = {},
) {
  const { token, hash } = createInvitationToken();
  const [row] = await test.db
    .insert(websiteInvitations)
    .values({
      websiteId: options.websiteId ?? siteId,
      email: options.email ?? INVITEE_EMAIL,
      role: options.role ?? "editor",
      tokenHash: hash,
      expiresAt: options.expiresAt ?? new Date(Date.now() + 7 * DAY),
      acceptedAt: options.acceptedAt ?? null,
      invitedBy: options.invitedBy === undefined ? OWNER_USER : options.invitedBy,
    })
    .returning({ id: websiteInvitations.id });
  return { id: row.id, token };
}

async function membership(userId: string, websiteId = siteId) {
  const [row] = await test.db
    .select()
    .from(websiteMembers)
    .where(eq(websiteMembers.userId, userId));
  return row && row.websiteId === websiteId ? row : undefined;
}

async function invitationRow(id: string) {
  const [row] = await test.db
    .select()
    .from(websiteInvitations)
    .where(eq(websiteInvitations.id, id));
  return row;
}

function signIn(userId: string) {
  state.session = {
    user: { id: userId },
    session: { id: `sess_${userId}`, activeOrganizationId: null },
  };
}

describe("pendingInvitationsFor", () => {
  it("lists an invitation to a verified address, matched case-insensitively", async () => {
    const { id } = await invite();

    const pending = await pendingInvitationsFor(INVITEE);
    expect(pending).toEqual([
      {
        id,
        domain: "client.example",
        role: "editor",
        invitedByName: "Olivia Owner",
        expiresAt: expect.any(Date),
      },
    ]);
  });

  it("never returns a token hash or an organization id", async () => {
    await invite();
    const [row] = await pendingInvitationsFor(INVITEE);

    expect(Object.keys(row).sort()).toEqual(
      ["domain", "expiresAt", "id", "invitedByName", "role"],
    );
    expect(JSON.stringify(row)).not.toContain(OWNER_ORG);
  });

  it("returns nothing for an UNVERIFIED account, even with a matching address", async () => {
    await invite({ email: "pat@client.example" });
    expect(await pendingInvitationsFor(UNVERIFIED)).toEqual([]);
  });

  it("excludes expired and already-accepted invitations", async () => {
    await invite({ expiresAt: new Date(Date.now() - 1000) });
    await invite({ websiteId: otherSiteId, acceptedAt: new Date() });

    expect(await pendingInvitationsFor(INVITEE)).toEqual([]);
  });

  it("excludes invitations addressed to somebody else", async () => {
    await invite({ email: "someone@else.example" });
    expect(await pendingInvitationsFor(INVITEE)).toEqual([]);
    expect(await pendingInvitationsFor(STRANGER)).toEqual([]);
  });

  it("still lists an invitation whose sender has since been deleted", async () => {
    await invite({ invitedBy: null });
    const [row] = await pendingInvitationsFor(INVITEE);
    expect(row.invitedByName).toBeNull();
  });

  it("leaves out a site they already have access to", async () => {
    // Invited before they had an account, then granted directly later.
    await invite({ role: "viewer" });
    await test.db
      .insert(websiteMembers)
      .values({ websiteId: siteId, userId: INVITEE, role: "editor", invitedBy: OWNER_USER });

    expect(await pendingInvitationsFor(INVITEE)).toEqual([]);
  });

  it("reports a viewer invitation as viewer", async () => {
    await invite({ role: "viewer" });
    const [row] = await pendingInvitationsFor(INVITEE);
    expect(row.role).toBe("viewer");
  });

  it("returns nothing for an unknown user", async () => {
    await invite();
    expect(await pendingInvitationsFor("user_nobody")).toEqual([]);
  });

  it("listPendingInvitations reads the signed-in user", async () => {
    await invite();
    signIn(INVITEE);
    expect(await listPendingInvitations()).toHaveLength(1);

    signIn(STRANGER);
    expect(await listPendingInvitations()).toEqual([]);
  });
});

describe("acceptPendingInvitation", () => {
  it("grants the website, records who invited them, and marks the invitation accepted", async () => {
    const { id } = await invite({ role: "viewer" });

    const result = await acceptPendingInvitation(id, INVITEE);
    expect(result).toEqual({ ok: true, websiteId: siteId });

    const row = await membership(INVITEE);
    expect(row).toMatchObject({ role: "viewer", invitedBy: OWNER_USER });
    expect((await invitationRow(id)).acceptedAt).toBeInstanceOf(Date);

    // Gone from the dashboard once accepted.
    expect(await pendingInvitationsFor(INVITEE)).toEqual([]);
  });

  it("refuses an UNVERIFIED account and grants nothing", async () => {
    const { id } = await invite({ email: "pat@client.example" });

    const result = await acceptPendingInvitation(id, UNVERIFIED);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/invitation email/);
    expect(await membership(UNVERIFIED)).toBeUndefined();
    expect((await invitationRow(id)).acceptedAt).toBeNull();
  });

  it("refuses a verified account with a different address, without naming the address", async () => {
    const { id } = await invite();

    const result = await acceptPendingInvitation(id, STRANGER);
    expect(result).toEqual({ ok: false, error: "This invitation is no longer valid." });
    expect(await membership(STRANGER)).toBeUndefined();
    expect((await invitationRow(id)).acceptedAt).toBeNull();
  });

  it("refuses an expired invitation", async () => {
    const { id } = await invite({ expiresAt: new Date(Date.now() - 1000) });

    const result = await acceptPendingInvitation(id, INVITEE);
    expect(result).toEqual({ ok: false, error: "This invitation has expired." });
    expect(await membership(INVITEE)).toBeUndefined();
  });

  it("refuses an invitation that was already accepted", async () => {
    const { id } = await invite();
    expect((await acceptPendingInvitation(id, INVITEE)).ok).toBe(true);

    const again = await acceptPendingInvitation(id, INVITEE);
    expect(again).toEqual({ ok: false, error: "This invitation is no longer valid." });
  });

  it("refuses an unknown or malformed id", async () => {
    expect(
      await acceptPendingInvitation("00000000-0000-4000-8000-000000000000", INVITEE),
    ).toEqual({ ok: false, error: "This invitation is no longer valid." });
    expect(await acceptPendingInvitation("not-a-uuid", INVITEE)).toEqual({
      ok: false,
      error: "This invitation is no longer valid.",
    });
  });

  it("updates an existing membership to the invited role rather than failing", async () => {
    await test.db
      .insert(websiteMembers)
      .values({ websiteId: siteId, userId: INVITEE, role: "viewer", invitedBy: null });
    const { id } = await invite({ role: "editor" });

    expect((await acceptPendingInvitation(id, INVITEE)).ok).toBe(true);
    expect(await membership(INVITEE)).toMatchObject({
      role: "editor",
      invitedBy: OWNER_USER,
    });
  });
});

describe("acceptInvitation by token (unchanged, now sharing the grant)", () => {
  it("still works, and now records who sent the invitation", async () => {
    const { id, token } = await invite();

    const result = await acceptInvitation(token, INVITEE);
    expect(result).toEqual({ ok: true, websiteId: siteId });
    expect(await membership(INVITEE)).toMatchObject({
      role: "editor",
      invitedBy: OWNER_USER,
    });
    expect((await invitationRow(id)).acceptedAt).toBeInstanceOf(Date);

    // A used token is "invalid", indistinguishable from an unknown one.
    expect(await lookupInvitation(token)).toEqual({ state: "invalid" });
  });

  it("still works for an unverified account - the link is the proof of the mailbox", async () => {
    const { token } = await invite({ email: "pat@client.example" });
    expect((await acceptInvitation(token, UNVERIFIED)).ok).toBe(true);
  });

  it("still refuses a different address, naming the one it was sent to", async () => {
    const { token } = await invite();
    const result = await acceptInvitation(token, STRANGER);
    expect(result).toEqual({
      ok: false,
      error: `This invitation was sent to ${INVITEE_EMAIL}. Sign in with that address to accept it.`,
    });
    expect(await membership(STRANGER)).toBeUndefined();
  });

  it("still reports an expired token as expired", async () => {
    const { token } = await invite({ expiresAt: new Date(Date.now() - 1000) });
    expect(await acceptInvitation(token, INVITEE)).toEqual({
      ok: false,
      error: "This invitation has expired.",
    });
  });
});

describe("the accept actions", () => {
  it("dashboard action: accepts for the SESSION user and remembers the site", async () => {
    const { id } = await invite();
    signIn(INVITEE);

    const result = await acceptPendingInvitationAction(id);
    expect(result).toEqual({ ok: true, websiteId: siteId });
    expect(state.cookies.get("site")).toBe(siteId);
    expect(state.revalidated).toContain("/:layout");
  });

  it("dashboard action: a stranger's session cannot accept someone else's invitation", async () => {
    const { id } = await invite();
    signIn(STRANGER);

    const result = await acceptPendingInvitationAction(id);
    expect(result.ok).toBe(false);
    expect(await membership(STRANGER)).toBeUndefined();
    expect(state.cookies.has("site")).toBe(false);
  });

  it("dashboard action: rejects a malformed id before any query", async () => {
    signIn(INVITEE);
    expect(await acceptPendingInvitationAction("'; drop table users; --")).toEqual({
      ok: false,
      error: "This invitation is no longer valid.",
    });
  });

  it("dashboard action: requires a session", async () => {
    const { id } = await invite();
    await expect(acceptPendingInvitationAction(id)).rejects.toThrow("redirect:/sign-in");
  });

  it("invite-link action: remembers the accepted site as the current one", async () => {
    const { token } = await invite();
    signIn(INVITEE);

    const result = await acceptInvitationAction(token);
    expect(result).toEqual({ ok: true, websiteId: siteId });
    expect(state.cookies.get("site")).toBe(siteId);
  });

  it("invite-link action: remembers nothing when acceptance fails", async () => {
    const { token } = await invite();
    signIn(STRANGER);

    expect((await acceptInvitationAction(token)).ok).toBe(false);
    expect(state.cookies.has("site")).toBe(false);
  });
});
