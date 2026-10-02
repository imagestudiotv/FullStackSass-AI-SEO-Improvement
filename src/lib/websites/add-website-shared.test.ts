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

/*
  The one thing addWebsite does that leaves the process: the analysis job.
  Everything up to it - the reservation, the website row, the outbox row - is
  real, so a refusal is proven to leave nothing behind.
*/
const inngestMock = vi.hoisted(() => ({
  send: vi.fn(),
  createFunction: vi.fn((config: unknown, handler: unknown) => ({ config, handler })),
}));
vi.mock("@/inngest/client", () => ({ inngest: inngestMock }));

import {
  member,
  organization,
  user,
  websiteInvitations,
  websiteMembers,
  websites,
} from "@/lib/db/schema";
import { createInvitationToken } from "@/lib/websites/invitation-token";

import { addWebsite } from "./actions";

/**
 * addWebsite refuses a domain that is already SHARED with the caller.
 *
 * An invitee who could not find the site they were invited to added it again
 * in their own empty workspace, which started a second, unpaid copy with its
 * own onboarding and paywall. The refusal must send them to the shared site
 * without ever naming the workspace that owns it, and must not turn into a
 * way to learn which domains strangers have added.
 */

/*
  Points at the Websites page, not the switcher: the add-website form has no
  switcher, and the header hides it on phones.
*/
const SHARED_MESSAGE =
  "That website is already shared with you. Find it under Websites, in Shared with you.";
const WAITING_MESSAGE =
  "You have an invitation waiting for that website. Accept it on your dashboard.";

const OWNER_ORG = "org_owner";
const GUEST_ORG = "org_guest";
const STRANGER_ORG = "org_stranger";
const OWNER_USER = "user_owner";
const GUEST_USER = "user_guest";
const OTHER_USER = "user_other";

/** What the owner's workspace is called; the guest must never be told. */
const OWNER_WORKSPACE_NAME = "Dana's Private Workspace";

let test: TestDb;

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

beforeEach(async () => {
  inngestMock.send.mockReset();
  inngestMock.send.mockResolvedValue({ ids: [] });

  await test.client.exec(`
    delete from spend_reservations;
    delete from job_outbox;
    delete from network_sites;
    delete from website_invitations;
    delete from website_members;
    delete from websites;
    delete from "member";
    delete from "user";
    delete from organization;
  `);

  const now = new Date();
  await test.db.insert(organization).values([
    { id: OWNER_ORG, name: OWNER_WORKSPACE_NAME, slug: "owner", createdAt: now },
    { id: GUEST_ORG, name: "Guest", slug: "guest", createdAt: now },
    { id: STRANGER_ORG, name: "Stranger", slug: "stranger", createdAt: now },
  ]);
  await test.db.insert(user).values([
    { id: OWNER_USER, name: "O", email: "o@example.com", createdAt: now, updatedAt: now },
    { id: GUEST_USER, name: "G", email: "g@example.com", createdAt: now, updatedAt: now },
    { id: OTHER_USER, name: "X", email: "x@example.com", createdAt: now, updatedAt: now },
  ]);
  await test.db.insert(member).values([
    { id: "m_owner", organizationId: OWNER_ORG, userId: OWNER_USER, role: "owner", createdAt: now },
    { id: "m_guest", organizationId: GUEST_ORG, userId: GUEST_USER, role: "owner", createdAt: now },
    { id: "m_other", organizationId: STRANGER_ORG, userId: OTHER_USER, role: "owner", createdAt: now },
  ]);
});

/** Signs in as a user, with the organization their session claims is active. */
function signIn(userId: string, activeOrganizationId: string) {
  state.session = {
    user: { id: userId },
    session: { id: `sess_${userId}`, activeOrganizationId },
  };
}

async function site(organizationId: string, domain: string) {
  const [row] = await test.db
    .insert(websites)
    .values({ organizationId, domain, url: `https://${domain}`, status: "ready" })
    .returning({ id: websites.id });
  return row.id;
}

async function share(websiteId: string, userId: string, role: "editor" | "viewer" = "editor") {
  await test.db.insert(websiteMembers).values({ websiteId, userId, role, invitedBy: OWNER_USER });
}

/** An unaccepted invitation to `email`, expiring `days` from now. */
async function invite(websiteId: string, email: string, days = 7) {
  await test.db.insert(websiteInvitations).values({
    websiteId,
    email,
    role: "editor",
    tokenHash: createInvitationToken().hash,
    expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
    invitedBy: OWNER_USER,
  });
}

async function verify(userId: string) {
  await test.db.update(user).set({ emailVerified: true }).where(eq(user.id, userId));
}

async function sitesIn(organizationId: string) {
  return test.db
    .select({ domain: websites.domain })
    .from(websites)
    .where(eq(websites.organizationId, organizationId));
}

describe("addWebsite - a domain already shared with the caller", () => {
  it("refuses it, creates nothing, and queues no analysis", async () => {
    await share(await site(OWNER_ORG, "shared.example"), GUEST_USER);
    signIn(GUEST_USER, GUEST_ORG);

    const result = await addWebsite("https://shared.example/");

    expect(result).toEqual({ ok: false, error: SHARED_MESSAGE });
    expect(await sitesIn(GUEST_ORG)).toEqual([]);
    expect(inngestMock.send).not.toHaveBeenCalled();
  });

  it("never names the workspace that owns it", async () => {
    await share(await site(OWNER_ORG, "shared.example"), GUEST_USER);
    signIn(GUEST_USER, GUEST_ORG);

    const result = await addWebsite("shared.example");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).not.toContain(OWNER_WORKSPACE_NAME);
    expect(result.error).not.toContain(OWNER_ORG);
  });

  it("refuses a viewer's shared site as well as an editor's", async () => {
    await share(await site(OWNER_ORG, "viewed.example"), GUEST_USER, "viewer");
    signIn(GUEST_USER, GUEST_ORG);

    expect(await addWebsite("viewed.example")).toEqual({ ok: false, error: SHARED_MESSAGE });
  });

  it("matches with or without www., in either direction, and ignores case", async () => {
    await share(await site(OWNER_ORG, "plain.example"), GUEST_USER);
    // A row written before domains were normalised can still carry "www.".
    await share(await site(OWNER_ORG, "www.legacy.example"), GUEST_USER);
    signIn(GUEST_USER, GUEST_ORG);

    expect(await addWebsite("https://www.plain.example")).toEqual({ ok: false, error: SHARED_MESSAGE });
    expect(await addWebsite("https://WWW.Plain.Example/about")).toEqual({ ok: false, error: SHARED_MESSAGE });
    expect(await addWebsite("legacy.example")).toEqual({ ok: false, error: SHARED_MESSAGE });
    expect(await sitesIn(GUEST_ORG)).toEqual([]);
  });

  it("does not match a different domain that merely contains the shared one", async () => {
    await share(await site(OWNER_ORG, "shared.example"), GUEST_USER);
    signIn(GUEST_USER, GUEST_ORG);

    const result = await addWebsite("blog.shared.example");

    expect(result.ok).toBe(true);
    expect(await sitesIn(GUEST_ORG)).toEqual([{ domain: "blog.shared.example" }]);
  });
});

describe("addWebsite - a domain with an invitation WAITING for the caller", () => {
  /*
    Adding it made an unpaid copy whose paywall stood in front of the
    dashboard, where the invitation card is. The card is the way in.
  */
  it("refuses it for a proven address, and sends them to the dashboard", async () => {
    await invite(await site(OWNER_ORG, "invited.example"), "g@example.com");
    await verify(GUEST_USER);
    signIn(GUEST_USER, GUEST_ORG);

    expect(await addWebsite("https://www.Invited.example/")).toEqual({
      ok: false,
      error: WAITING_MESSAGE,
    });
    expect(await sitesIn(GUEST_ORG)).toEqual([]);
    expect(inngestMock.send).not.toHaveBeenCalled();
  });

  it("says nothing to an unproven address, which sees no invitations either", async () => {
    await invite(await site(OWNER_ORG, "invited.example"), "g@example.com");
    signIn(GUEST_USER, GUEST_ORG);

    expect((await addWebsite("invited.example")).ok).toBe(true);
  });

  it("does not refuse for an invitation addressed to somebody else", async () => {
    await invite(await site(OWNER_ORG, "invited.example"), "x@example.com");
    await verify(GUEST_USER);
    signIn(GUEST_USER, GUEST_ORG);

    expect((await addWebsite("invited.example")).ok).toBe(true);
  });

  it("does not refuse for an expired invitation", async () => {
    await invite(await site(OWNER_ORG, "invited.example"), "g@example.com", -1);
    await verify(GUEST_USER);
    signIn(GUEST_USER, GUEST_ORG);

    expect((await addWebsite("invited.example")).ok).toBe(true);
  });
});

describe("addWebsite - what the shared check must NOT refuse", () => {
  it("a domain in a stranger's workspace the caller has no access to", async () => {
    /*
      Refusing here would disclose that somebody else has added this domain -
      the existence leak tenant.ts answers with a 404 everywhere else.
    */
    await site(STRANGER_ORG, "taken.example");
    signIn(GUEST_USER, GUEST_ORG);

    const result = await addWebsite("taken.example");

    expect(result.ok).toBe(true);
    expect(await sitesIn(GUEST_ORG)).toEqual([{ domain: "taken.example" }]);
  });

  it("a domain shared with SOMEBODY ELSE", async () => {
    await share(await site(OWNER_ORG, "theirs.example"), OTHER_USER);
    signIn(GUEST_USER, GUEST_ORG);

    expect((await addWebsite("theirs.example")).ok).toBe(true);
  });

  it("the owner re-adding their own site still reads as the same-workspace duplicate", async () => {
    // The owner holding a website_members row on their own site changes nothing.
    const id = await site(OWNER_ORG, "mine.example");
    await share(id, OWNER_USER);
    signIn(OWNER_USER, OWNER_ORG);

    expect(await addWebsite("mine.example")).toEqual({
      ok: false,
      error: "That website is already in this workspace",
    });
  });

  it("an ordinary new website for someone with nothing shared", async () => {
    signIn(GUEST_USER, GUEST_ORG);

    const result = await addWebsite("brand-new.example");

    expect(result.ok).toBe(true);
    expect(await sitesIn(GUEST_ORG)).toEqual([{ domain: "brand-new.example" }]);
    expect(inngestMock.send).toHaveBeenCalledTimes(1);
  });
});
