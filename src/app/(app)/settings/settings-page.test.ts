import { isValidElement, type ReactNode } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestDb, type TestDb } from "@/test/db";

/**
 * What the Account page hands its sections, by kind of account: which sign-in
 * methods it reports, which website the members panel controls and whether
 * it says so, what someone who owns no website is told instead, and that a
 * failing panel no longer takes the page down. Components are stubs found by
 * identity in the returned tree; see components/app-shell.test.ts for the
 * strip and the members panel's site choice.
 */

const state = vi.hoisted(() => ({
  db: null as unknown,
  session: null as unknown,
  siteCookie: null as string | null,
  referralFails: false,
  membersFail: false,
}));

vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
}));
vi.mock("@/lib/auth-guard", () => ({
  getSession: async () => state.session,
  requireSession: async () => state.session,
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
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === "site" && state.siteCookie ? { name, value: state.siteCookie } : undefined),
    set: () => {},
  }),
}));
vi.mock("@/lib/i18n/app-locale", async () => {
  const { getMessages } = await import("@/lib/i18n/messages");
  return { getAppMessages: async () => ({ locale: "en", t: getMessages("en") }) };
});
vi.mock("@/lib/referrals/actions", () => ({
  getReferralSummary: async () => {
    if (state.referralFails) throw new Error("Could not allocate a referral code");
    return { code: "ABC", earned: 0, pending: 0, referrals: [] };
  },
}));
vi.mock("@/lib/referrals/core", () => ({ REFERRAL_REWARD_CREDITS: 20 }));
vi.mock("@/lib/websites/members", () => ({
  listWebsiteMembers: vi.fn(async () => {
    if (state.membersFail) throw new Error("down");
    return [];
  }),
  listWebsiteInvitations: vi.fn(async () => []),
}));

vi.mock("@/components/settings-nav", () => ({ SettingsNav: () => null }));
vi.mock("@/app/(app)/settings/personal-details", () => ({ PersonalDetails: () => null }));
vi.mock("@/app/(app)/settings/referral-card", () => ({ ReferralCard: () => null }));
vi.mock("@/app/(app)/settings/website-members", () => ({ WebsiteMembers: () => null }));
vi.mock("@/app/(app)/settings/account-section-nav", () => ({ AccountSectionNav: () => null }));

import { AccountSectionNav } from "@/app/(app)/settings/account-section-nav";
import SettingsPage from "@/app/(app)/settings/page";
import { PersonalDetails } from "@/app/(app)/settings/personal-details";
import { ReferralCard } from "@/app/(app)/settings/referral-card";
import { WebsiteMembers } from "@/app/(app)/settings/website-members";
import { WorkspaceSection } from "@/components/workspace/section";
import { account, member, organization, user, websiteMembers, websites } from "@/lib/db/schema";

let test: TestDb;
let sharedSite: string;
let dualSite: string;

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

beforeEach(async () => {
  vi.clearAllMocks();
  state.siteCookie = null;
  state.referralFails = false;
  state.membersFail = false;
  await test.client.exec(`
    delete from website_members;
    delete from websites;
    delete from account;
    delete from "member";
    delete from "user";
    delete from organization;
  `);
  const now = new Date();
  await test.db.insert(organization).values(
    ["org_owner", "org_guest", "org_dual"].map((id) => ({ id, name: id, slug: id, createdAt: now })),
  );
  await test.db.insert(user).values(
    ["owner", "guest", "dual"].map((id) => ({
      id: `user_${id}`,
      name: id,
      email: `${id}@example.com`,
      createdAt: now,
      updatedAt: now,
    })),
  );
  await test.db.insert(member).values([
    { id: "m_owner", organizationId: "org_owner", userId: "user_owner", role: "owner", createdAt: now },
    { id: "m_guest", organizationId: "org_guest", userId: "user_guest", role: "owner", createdAt: now },
    { id: "m_dual", organizationId: "org_dual", userId: "user_dual", role: "owner", createdAt: now },
  ]);
  [{ id: sharedSite }] = await test.db
    .insert(websites)
    .values({ organizationId: "org_owner", domain: "shared.example", url: "https://shared.example", createdAt: new Date(Date.UTC(2026, 0, 1)) })
    .returning({ id: websites.id });
  [{ id: dualSite }] = await test.db
    .insert(websites)
    .values({ organizationId: "org_dual", domain: "dual.example", url: "https://dual.example", createdAt: new Date(Date.UTC(2026, 0, 2)) })
    .returning({ id: websites.id });
  await test.db.insert(websiteMembers).values([
    { websiteId: sharedSite, userId: "user_guest", role: "viewer" },
    { websiteId: sharedSite, userId: "user_dual", role: "editor" },
  ]);
});

function signIn(id: string, orgId: string) {
  state.session = {
    user: { id: `user_${id}`, name: id, email: `${id}@example.com`, image: null },
    session: { id: `sess_${id}`, activeOrganizationId: orgId },
  };
}

async function addAccount(userId: string, providerId: string, password: string | null) {
  const now = new Date();
  await test.db.insert(account).values({
    id: `${userId}_${providerId}`,
    accountId: userId,
    providerId,
    issuer: providerId,
    userId,
    password,
    createdAt: now,
    updatedAt: now,
  });
}

type Props = Record<string, unknown>;

function findAll(node: unknown, type: unknown): Props[] {
  if (Array.isArray(node)) return node.flatMap((child) => findAll(child, type));
  if (!isValidElement(node)) return [];
  const props = node.props as Props;
  return [...(node.type === type ? [props] : []), ...findAll(props.children as ReactNode, type)];
}

function findOne(node: unknown, type: unknown): Props {
  const found = findAll(node, type);
  expect(found).toHaveLength(1);
  return found[0];
}

const sectionIds = (tree: unknown) =>
  (findAll(tree, AccountSectionNav)[0].sections as { id: string }[]).map((section) => section.id);

describe("account page", () => {
  it("reports a password only when the credential row holds one, and a linked Google account", async () => {
    signIn("owner", "org_owner");
    await addAccount("user_owner", "credential", null);
    await addAccount("user_owner", "google", null);
    let details = findOne(await SettingsPage(), PersonalDetails);
    expect(details.hasPassword).toBe(false);
    expect(details.googleLinked).toBe(true);

    await test.db.delete(account);
    await addAccount("user_owner", "credential", "hash");
    details = findOne(await SettingsPage(), PersonalDetails);
    expect(details.hasPassword).toBe(true);
    expect(details.googleLinked).toBe(false);
  });

  it("points the article-language link at the strip's website", async () => {
    signIn("owner", "org_owner");
    expect(findOne(await SettingsPage(), PersonalDetails).articleLanguageSite).toEqual({
      href: `/websites/${sharedSite}/profile`,
      domain: "shared.example",
    });
  });

  it("owner: the members panel for their site, saying nothing about shared sites", async () => {
    signIn("owner", "org_owner");
    const tree = await SettingsPage();
    const panel = findOne(tree, WebsiteMembers);
    expect(panel.initialWebsiteId).toBe(sharedSite);
    expect(panel.viewingSharedDomain).toBeNull();
    expect(panel.initialError).toBe(false);
    expect(panel.ownEmail).toBe("owner@example.com");
    expect(sectionIds(tree)).toEqual(["profile", "security", "language", "members", "referral"]);
  });

  it("dual-role on a shared site: the panel is for their own site and says the shared one is not theirs to manage", async () => {
    state.siteCookie = sharedSite;
    signIn("dual", "org_dual");
    const panel = findOne(await SettingsPage(), WebsiteMembers);
    expect(panel.initialWebsiteId).toBe(dualSite);
    expect(panel.viewingSharedDomain).toBe("shared.example");
  });

  it("guest who owns nothing: no controls, a note naming the site, its role and who manages it", async () => {
    signIn("guest", "org_guest");
    const tree = await SettingsPage();
    expect(findAll(tree, WebsiteMembers)).toHaveLength(0);
    const note = findAll(tree, WorkspaceSection).find((section) => section.id === "members");
    expect(note).toBeDefined();
    const text = JSON.stringify(note?.children);
    expect(text).toContain("shared.example is shared with you as Viewer.");
    expect(sectionIds(tree)).toContain("members");
  });

  it("a failing members read or referral summary leaves the rest of the page working", async () => {
    state.membersFail = true;
    state.referralFails = true;
    signIn("owner", "org_owner");
    const tree = await SettingsPage();
    expect(findOne(tree, WebsiteMembers).initialError).toBe(true);
    expect(findOne(tree, ReferralCard).summary).toBeNull();
    expect(findAll(tree, PersonalDetails)).toHaveLength(1);
  });
});
