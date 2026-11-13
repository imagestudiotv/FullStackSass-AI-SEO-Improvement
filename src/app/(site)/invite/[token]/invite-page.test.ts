import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestDb, type TestDb } from "@/test/db";

const state = vi.hoisted(() => ({
  db: null as unknown,
  session: null as unknown,
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

vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
  notFound: () => {
    throw new Error("notFound");
  },
}));

/*
  The two client components, as markers that show the props they were given.
  Their own behaviour (signing out, the server action) needs a browser; what
  this file checks is which one the page chose and what it told it.
*/
vi.mock("@/components/switch-account", () => ({
  SwitchAccount: (props: { label: string; next: string; email?: string }) =>
    createElement(
      "switch-account",
      { "data-next": props.next, "data-email": props.email ?? "" },
      props.label,
    ),
}));
vi.mock("./accept-invitation-form", () => ({
  AcceptInvitation: (props: { token: string; domain: string }) =>
    createElement("accept-invitation", { "data-domain": props.domain }),
}));

import { organization, user, websiteInvitations, websites } from "@/lib/db/schema";
import { createInvitationToken } from "@/lib/websites/invitation-token";

import InvitePage from "./page";

/**
 * The invitation page's states.
 *
 * Two fixes are held here. "Sign in as someone else" was a plain link to
 * /sign-in, which sends a signed-in browser straight on - so it never let
 * anybody switch; it now signs out and comes back to this invitation. And the
 * dead ends (not valid, expired) offered only the marketing homepage; they now
 * lead to the dashboard when signed in and to sign-in when not, with one
 * answer for every kind of invalid token.
 */

let test: TestDb;

const OWNER_USER = "user_owner";
const INVITED_EMAIL = "editor@client.example";
const DAY = 24 * 60 * 60 * 1000;

let siteId: string;

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

beforeEach(async () => {
  await test.client.exec(`
    delete from website_invitations;
    delete from websites;
    delete from "user";
    delete from organization;
  `);
  state.session = null;

  const now = new Date();
  await test.db
    .insert(organization)
    .values({ id: "org_owner", name: "Owner", slug: "org_owner", createdAt: now });
  await test.db.insert(user).values({
    id: OWNER_USER,
    name: "Olivia Owner",
    email: "olivia@owner.example",
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  });
  const [site] = await test.db
    .insert(websites)
    .values({ organizationId: "org_owner", domain: "client.example", url: "https://client.example" })
    .returning({ id: websites.id });
  siteId = site.id;
});

async function invite(options: { expiresAt?: Date; acceptedAt?: Date | null } = {}) {
  const { token, hash } = createInvitationToken();
  await test.db.insert(websiteInvitations).values({
    websiteId: siteId,
    email: INVITED_EMAIL,
    role: "editor",
    tokenHash: hash,
    expiresAt: options.expiresAt ?? new Date(Date.now() + 7 * DAY),
    acceptedAt: options.acceptedAt ?? null,
    invitedBy: OWNER_USER,
  });
  return token;
}

function signInAs(email: string) {
  state.session = {
    user: { id: "user_reader", email, name: "Reader" },
    session: { id: "sess_reader", activeOrganizationId: null },
  };
}

async function render(token: string): Promise<string> {
  return renderToStaticMarkup(
    await InvitePage({ params: Promise.resolve({ token }) } as never),
  );
}

describe("a token that is not valid", () => {
  it("signed out: one way on, to sign-in - never the marketing homepage", async () => {
    const html = await render("x".repeat(43));

    expect(html).toContain("This invitation is not valid");
    expect(html).toContain('href="/sign-in"');
    expect(html).toContain("Sign in");
    expect(html).not.toContain('href="/"');
  });

  it("signed in: 'Open RepGet', to the dashboard", async () => {
    signInAs("someone@else.example");
    const html = await render("x".repeat(43));

    expect(html).toContain("This invitation is not valid");
    expect(html).toContain('href="/dashboard"');
    expect(html).toContain("Open RepGet");
    expect(html).not.toContain('href="/sign-in"');
  });

  it("gives an accepted token exactly the answer an unknown one gets", async () => {
    const accepted = await invite({ acceptedAt: new Date() });
    signInAs(INVITED_EMAIL);

    const unknownHtml = await render("y".repeat(43));
    expect(await render(accepted)).toBe(unknownHtml);
  });

  it("gives a revoked (deleted) token exactly the answer an unknown one gets", async () => {
    const revoked = await invite();
    await test.client.exec("delete from website_invitations");

    expect(await render(revoked)).toBe(await render("y".repeat(43)));
  });
});

describe("an expired invitation", () => {
  it("says so, and leads on to the dashboard when signed in", async () => {
    const token = await invite({ expiresAt: new Date(Date.now() - 60_000) });
    signInAs(INVITED_EMAIL);
    const html = await render(token);

    expect(html).toContain("This invitation has expired");
    expect(html).toContain('href="/dashboard"');
  });
});

describe("a valid invitation", () => {
  it("signed out: sign-up with the address prefilled and ?next= back here", async () => {
    const token = await invite();

    await expect(render(token)).rejects.toThrow(
      `redirect:/sign-up?email=${encodeURIComponent(INVITED_EMAIL)}&next=${encodeURIComponent(`/invite/${token}`)}`,
    );
  });

  it("signed in as somebody else: a switch that signs out and returns to THIS invitation", async () => {
    const token = await invite();
    signInAs("personal@home.example");
    const html = await render(token);

    expect(html).toContain("This invitation is for a different account");
    expect(html).toContain("<switch-account");
    expect(html).toContain(`data-next="/invite/${token}"`);
    expect(html).toContain(`data-email="${INVITED_EMAIL}"`);
    expect(html).toContain("Sign in as someone else");
    // Not a plain link to sign-in, which a signed-in browser skips straight past.
    expect(html).not.toContain('href="/sign-in"');
    expect(html).not.toContain("<accept-invitation");
  });

  it("signed in as the invited address (any case): the Accept button", async () => {
    const token = await invite();
    signInAs("Editor@Client.example");
    const html = await render(token);

    expect(html).toContain("Join client.example");
    expect(html).toContain("Olivia Owner invited you to work on client.example as an editor.");
    expect(html).toContain('<accept-invitation data-domain="client.example">');
  });
});
