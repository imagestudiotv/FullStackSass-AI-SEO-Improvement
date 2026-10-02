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

/** requireWebsite reads the session; the database decides access. */
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

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

/*
  The two emails, captured rather than sent. The invitation's token exists in
  plain form only in its email, so the accept URL is read back from here.
*/
const mail = vi.hoisted(() => ({
  sendInvitationEmail: vi.fn<
    (options: { acceptUrl: string }) => Promise<{ ok: true }>
  >(async () => ({ ok: true as const })),
  sendAccessGrantedEmail: vi.fn(async () => ({ ok: true as const })),
}));
vi.mock("@/lib/email/invitation", () => mail);

import {
  member,
  organization,
  user,
  websiteInvitations,
  websiteMembers,
  websites,
} from "@/lib/db/schema";
import { acceptInvitation } from "@/lib/websites/accept-invitation";
import { accessibleWebsitesFor } from "@/lib/websites/accessible";
import { pendingInvitationsFor } from "@/lib/websites/pending-invitations";

import { addWebsiteMember } from "./members";

/**
 * Who an owner's invitation is GRANTED to straight away.
 *
 * Email/password signup does not verify the address, so anyone can register
 * the address an owner is about to invite. The direct grant used to go to
 * any account with that address, and the website list now puts every
 * granted site in the switcher and on the dashboard - so a squatter would
 * have found the client's site without ever seeing the email. Only a PROVEN
 * address is granted at once; anything else gets the emailed link, whose
 * acceptance is the proof of the mailbox.
 */

let test: TestDb;

const OWNER_ORG = "org_owner";
const SQUATTER_ORG = "org_squatter";
const VERIFIED_ORG = "org_verified";
const OWNER_USER = "user_owner";
const SQUATTER = "user_squatter";
const VERIFIED = "user_verified";

const INVITED_EMAIL = "alice@agency.example";
const VERIFIED_EMAIL = "bob@agency.example";

let siteId: string;

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

beforeEach(async () => {
  vi.clearAllMocks();
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
    [OWNER_ORG, SQUATTER_ORG, VERIFIED_ORG].map((id) => ({
      id,
      name: id,
      slug: id,
      createdAt: now,
    })),
  );
  await test.db.insert(user).values([
    { id: OWNER_USER, name: "Olivia", email: "olivia@owner.example", emailVerified: true, createdAt: now, updatedAt: now },
    // Registered with a password under the address the owner will invite.
    { id: SQUATTER, name: "Mallory", email: INVITED_EMAIL, emailVerified: false, createdAt: now, updatedAt: now },
    { id: VERIFIED, name: "Bob", email: VERIFIED_EMAIL, emailVerified: true, createdAt: now, updatedAt: now },
  ]);
  await test.db.insert(member).values([
    { id: "m_owner", organizationId: OWNER_ORG, userId: OWNER_USER, role: "owner", createdAt: now },
    { id: "m_squatter", organizationId: SQUATTER_ORG, userId: SQUATTER, role: "owner", createdAt: now },
    { id: "m_verified", organizationId: VERIFIED_ORG, userId: VERIFIED, role: "owner", createdAt: now },
  ]);

  const [site] = await test.db
    .insert(websites)
    .values({
      organizationId: OWNER_ORG,
      domain: "client.example",
      url: "https://client.example",
      status: "ready",
    })
    .returning({ id: websites.id });
  siteId = site.id;

  signIn(OWNER_USER, OWNER_ORG);
});

function signIn(userId: string, activeOrganizationId: string) {
  state.session = {
    user: { id: userId },
    session: { id: `sess_${userId}`, activeOrganizationId },
  };
}

async function membersOf(websiteId: string) {
  return test.db
    .select({ userId: websiteMembers.userId, role: websiteMembers.role })
    .from(websiteMembers)
    .where(eq(websiteMembers.websiteId, websiteId));
}

async function invitationsFor(websiteId: string) {
  return test.db
    .select({ email: websiteInvitations.email, acceptedAt: websiteInvitations.acceptedAt })
    .from(websiteInvitations)
    .where(eq(websiteInvitations.websiteId, websiteId));
}

describe("addWebsiteMember - an existing account whose address is NOT proven", () => {
  it("grants nothing: it gets the emailed link instead", async () => {
    const result = await addWebsiteMember(siteId, INVITED_EMAIL, "editor");

    expect(result).toEqual({ ok: true, data: { invited: true, emailSent: true } });
    expect(await membersOf(siteId)).toEqual([]);
    expect(await invitationsFor(siteId)).toEqual([
      { email: INVITED_EMAIL, acceptedAt: null },
    ]);
    expect(mail.sendInvitationEmail).toHaveBeenCalledTimes(1);
    expect(mail.sendAccessGrantedEmail).not.toHaveBeenCalled();
  });

  it("leaves the site out of that account's switcher, dashboard and invitation cards", async () => {
    await addWebsiteMember(siteId, INVITED_EMAIL, "editor");

    expect(await accessibleWebsitesFor(SQUATTER_ORG, SQUATTER)).toEqual([]);
    // The token-less accept is closed to an unproven address too.
    expect(await pendingInvitationsFor(SQUATTER)).toEqual([]);
  });

  it("is granted once the emailed link is accepted - the link proves the mailbox", async () => {
    await addWebsiteMember(siteId, INVITED_EMAIL, "viewer");
    const acceptUrl = mail.sendInvitationEmail.mock.calls[0][0].acceptUrl;
    const token = acceptUrl.slice(acceptUrl.lastIndexOf("/") + 1);

    expect(await acceptInvitation(token, SQUATTER)).toEqual({ ok: true, websiteId: siteId });
    expect(await membersOf(siteId)).toEqual([{ userId: SQUATTER, role: "viewer" }]);
  });
});

describe("addWebsiteMember - an existing account whose address IS proven", () => {
  it("is granted at once and told by email, as before", async () => {
    const result = await addWebsiteMember(siteId, VERIFIED_EMAIL, "editor");

    expect(result).toEqual({ ok: true, data: { invited: false, emailSent: true } });
    expect(await membersOf(siteId)).toEqual([{ userId: VERIFIED, role: "editor" }]);
    expect(await invitationsFor(siteId)).toEqual([]);
    expect(mail.sendAccessGrantedEmail).toHaveBeenCalledTimes(1);
    expect(mail.sendInvitationEmail).not.toHaveBeenCalled();

    const listed = await accessibleWebsitesFor(VERIFIED_ORG, VERIFIED);
    expect(listed.map((site) => [site.id, site.access])).toEqual([[siteId, "editor"]]);
  });

  it("still refuses an owner inviting themselves", async () => {
    expect(await addWebsiteMember(siteId, "olivia@owner.example", "editor")).toEqual({
      ok: false,
      error: "You already have access to this website.",
    });
  });
});
