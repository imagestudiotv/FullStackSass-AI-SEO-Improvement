import { isValidElement, type ReactNode } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestDb, type TestDb } from "@/test/db";

/**
 * Who /billing describes, by role. The page is called as a plain async
 * function and its element tree is searched for stubbed components, so what
 * is asserted is the decisions handed down: which website, whether the plan
 * picker appears at all, whether add-ons can be bought, and whether the page
 * says that the website on screen is somebody else's.
 */

const state = vi.hoisted(() => ({
  db: null as unknown,
  session: null as unknown,
  siteCookie: null as string | null,
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
vi.mock("@/lib/websites/pending-invitations", () => ({ listPendingInvitations: async () => [] }));
vi.mock("@/lib/billing", () => ({
  getSubscription: vi.fn(async () => null),
  isEntitled: (status: string | null | undefined) => status === "active",
  listPayments: vi.fn(async () => []),
  listPlans: vi.fn(async () => []),
  listWebsiteSubscriptions: vi.fn(async () => []),
}));
vi.mock("@/lib/paypal/actions", () => ({ isPayPalAvailable: async () => false }));
vi.mock("@/lib/addons/actions", () => ({
  listAddons: vi.fn(async () => []),
  listPurchases: vi.fn(async () => []),
}));

/* The rendered pieces, as named stubs the tree search can recognise. */
vi.mock("@/components/settings-nav", () => ({ SettingsNav: () => null }));
vi.mock("@/app/(app)/billing/billing-client", () => ({ BillingClient: () => null }));
vi.mock("@/app/(app)/billing/addons-panel", () => ({ AddonsPanel: () => null }));
vi.mock("@/app/(app)/billing/payments-panel", () => ({ PaymentsPanel: () => null }));

import { AddonsPanel } from "@/app/(app)/billing/addons-panel";
import { BillingClient } from "@/app/(app)/billing/billing-client";
import BillingPage from "@/app/(app)/billing/page";
import { PaymentsPanel } from "@/app/(app)/billing/payments-panel";
import { SettingsNav } from "@/components/settings-nav";
import { listPayments, listPlans, listWebsiteSubscriptions } from "@/lib/billing";
import { billingCustomers, member, organization, user, websiteMembers, websites } from "@/lib/db/schema";

let test: TestDb;

const OWNER_ORG = "org_owner";
const GUEST_ORG = "org_guest";
const DUAL_ORG = "org_dual";
const NEW_ORG = "org_new";

let sharedSite: string;
let dualSite: string;

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

beforeEach(async () => {
  vi.clearAllMocks();
  state.siteCookie = null;
  await test.client.exec(`
    delete from billing_customers;
    delete from website_members;
    delete from websites;
    delete from "member";
    delete from "user";
    delete from organization;
  `);
  const now = new Date();
  await test.db.insert(organization).values(
    [OWNER_ORG, GUEST_ORG, DUAL_ORG, NEW_ORG].map((id) => ({ id, name: id, slug: id, createdAt: now })),
  );
  await test.db.insert(user).values(
    ["owner", "guest", "dual", "new"].map((id) => ({
      id: `user_${id}`,
      name: id,
      email: `${id}@example.com`,
      createdAt: now,
      updatedAt: now,
    })),
  );
  await test.db.insert(member).values([
    { id: "m_owner", organizationId: OWNER_ORG, userId: "user_owner", role: "owner", createdAt: now },
    { id: "m_guest", organizationId: GUEST_ORG, userId: "user_guest", role: "owner", createdAt: now },
    { id: "m_dual", organizationId: DUAL_ORG, userId: "user_dual", role: "owner", createdAt: now },
    { id: "m_new", organizationId: NEW_ORG, userId: "user_new", role: "owner", createdAt: now },
  ]);
  [{ id: sharedSite }] = await test.db
    .insert(websites)
    .values({ organizationId: OWNER_ORG, domain: "shared.example", url: "https://shared.example", createdAt: new Date(Date.UTC(2026, 0, 1)) })
    .returning({ id: websites.id });
  [{ id: dualSite }] = await test.db
    .insert(websites)
    .values({ organizationId: DUAL_ORG, domain: "dual.example", url: "https://dual.example", createdAt: new Date(Date.UTC(2026, 0, 2)) })
    .returning({ id: websites.id });
  await test.db.insert(websiteMembers).values([
    { websiteId: sharedSite, userId: "user_guest", role: "editor" },
    { websiteId: sharedSite, userId: "user_dual", role: "viewer" },
  ]);
});

function signIn(userId: string, orgId: string) {
  state.session = {
    user: { id: userId, name: userId, email: `${userId}@example.com`, image: null },
    session: { id: `sess_${userId}`, activeOrganizationId: orgId },
  };
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

function render(params: Record<string, string> = {}) {
  return BillingPage({ searchParams: Promise.resolve(params) } as unknown as Parameters<typeof BillingPage>[0]);
}

describe("billing page", () => {
  it("owner: their selected site, the strip, and an add-on shop", async () => {
    signIn("user_owner", OWNER_ORG);
    const tree = await render();

    expect(findOne(tree, SettingsNav).websiteId).toBe(sharedSite);
    const client = findOne(tree, BillingClient);
    expect(client.websiteId).toBe(sharedSite);
    expect(client.viewingSharedDomain).toBeNull();
    expect(findOne(tree, AddonsPanel).canBuy).toBe(true);
    expect(findAll(tree, PaymentsPanel)).toHaveLength(1);
  });

  it("guest who owns nothing: no plan picker, no shop, no strip - the owner pays", async () => {
    signIn("user_guest", GUEST_ORG);
    const tree = await render();

    expect(findAll(tree, BillingClient)).toHaveLength(0);
    expect(findAll(tree, SettingsNav)).toHaveLength(0);
    expect(findOne(tree, AddonsPanel).canBuy).toBe(false);
    expect(findAll(tree, PaymentsPanel)).toHaveLength(1);
    // Nothing on sale is even loaded for them.
    expect(listPlans).not.toHaveBeenCalled();
  });

  it("dual-role on a shared site: bills their own site and says the shared one is the owner's", async () => {
    state.siteCookie = sharedSite;
    signIn("user_dual", DUAL_ORG);
    const tree = await render();

    const client = findOne(tree, BillingClient);
    expect(client.websiteId).toBe(dualSite);
    expect(client.viewingSharedDomain).toBe("shared.example");
    expect(findOne(tree, SettingsNav).websiteId).toBe(dualSite);
    expect(findOne(tree, AddonsPanel).canBuy).toBe(true);
  });

  it("a ?site= that is not theirs selects nothing of anyone else's", async () => {
    signIn("user_dual", DUAL_ORG);
    const tree = await render({ site: sharedSite });
    expect(findOne(tree, BillingClient).websiteId).toBe(dualSite);
  });

  it("new customer with no website: plans with nothing selected, and the shop", async () => {
    signIn("user_new", NEW_ORG);
    const tree = await render();

    const client = findOne(tree, BillingClient);
    expect(client.websiteId).toBeNull();
    expect(findAll(tree, SettingsNav)).toHaveLength(0);
    expect(findOne(tree, AddonsPanel).canBuy).toBe(true);
  });

  describe("card invoices without a link point at a Manage billing that is on the page", () => {
    const cardRow = {
      id: "pay_1",
      provider: "stripe",
      amountCents: 9900,
      currency: "eur",
      status: "paid",
      invoiceUrl: null,
      description: "Grow",
      paidAt: new Date(Date.UTC(2026, 8, 1)),
    };

    it("the plan section has it for a card-billed site", async () => {
      signIn("user_owner", OWNER_ORG);
      vi.mocked(listWebsiteSubscriptions).mockResolvedValueOnce([
        {
          websiteId: sharedSite,
          domain: "shared.example",
          status: "active",
          planId: "plan_grow",
          planName: "Grow",
          tier: "grow",
          interval: "month",
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
          hasCustomer: true,
          provider: "stripe",
        },
      ]);
      vi.mocked(listPayments).mockResolvedValueOnce([cardRow]);
      expect(findOne(await render(), PaymentsPanel).portal).toBe("page");
    });

    it("the history offers it when the site on screen has no card plan but the workspace has a Stripe customer", async () => {
      signIn("user_owner", OWNER_ORG);
      await test.db.insert(billingCustomers).values({ organizationId: OWNER_ORG, stripeCustomerId: "cus_test" });
      vi.mocked(listPayments).mockResolvedValueOnce([cardRow]);
      expect(findOne(await render(), PaymentsPanel).portal).toBe("here");
    });

    it("nowhere to point without a Stripe customer, and no read when every row has its link", async () => {
      signIn("user_guest", GUEST_ORG);
      vi.mocked(listPayments).mockResolvedValueOnce([cardRow]);
      expect(findOne(await render(), PaymentsPanel).portal).toBe("none");

      vi.mocked(listPayments).mockResolvedValueOnce([{ ...cardRow, invoiceUrl: "https://stripe.test/inv" }]);
      expect(findOne(await render(), PaymentsPanel).portal).toBe("none");
    });
  });

  it("reads the PayPal return parameter alongside the card and add-on ones", async () => {
    signIn("user_owner", OWNER_ORG);
    const tree = await render({ paypal: "success", checkout: "cancelled", addon: "success" });
    const client = findOne(tree, BillingClient);
    expect(client.paypalResult).toBe("success");
    expect(client.checkout).toBe("cancelled");
    expect(client.addonResult).toBe("success");
  });
});
