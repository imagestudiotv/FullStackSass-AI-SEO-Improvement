import { eq } from "drizzle-orm";
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
  locale: "en",
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
  return { getAppMessages: async () => ({ locale: state.locale, t: getMessages(state.locale as "en") }) };
});
vi.mock("@/lib/websites/pending-invitations", () => ({ listPendingInvitations: async () => [] }));
vi.mock("@/lib/billing", () => ({
  getSubscription: vi.fn(async () => null),
  isEntitled: (status: string | null | undefined) => ["active", "trialing", "past_due"].includes(status ?? ""),
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
vi.mock("@/app/(site)/(app)/billing/billing-client", () => ({ BillingClient: () => null }));
vi.mock("@/components/billing/purchases-panel", () => ({ PurchasesPanel: () => null }));
vi.mock("@/app/(site)/(app)/billing/payments-panel", () => ({ PaymentsPanel: () => null }));

import { BillingClient } from "@/app/(site)/(app)/billing/billing-client";
import BillingPage from "@/app/(site)/(app)/billing/page";
import { PaymentsPanel } from "@/app/(site)/(app)/billing/payments-panel";
import { PurchasesPanel } from "@/components/billing/purchases-panel";
import { SettingsNav } from "@/components/settings-nav";
import { listAddons, listPurchases } from "@/lib/addons/actions";
import { listPayments, listPlans, listWebsiteSubscriptions } from "@/lib/billing";
import type { PlanRow } from "@/lib/billing-shared";
import { billingCheckouts, billingCustomers, member, organization, subscriptions, user, websiteMembers, websites } from "@/lib/db/schema";

let test: TestDb;

const WEBSITE_PURCHASE = { id: "p1", slug: "website_new", name: "New website", kind: "quote", pricePaidCents: 0, currency: "eur", creditsPaid: 100, status: "paid", fulfilledAt: null, createdAt: new Date() };
const OTHER_PURCHASE = { ...WEBSITE_PURCHASE, id: "p2", slug: "usa_local_citations", name: "Top 250 live USA Local Citations" };

const SCALE_ROW = {
  id: "plan_scale",
  name: "Scale",
  tier: "scale",
  interval: "month",
  priceCents: 34900,
  currency: "eur",
  articleLimit: 60,
  socialPostLimit: 180,
  keywordLimit: 1200,
  siteLimit: 10,
  monthlyCredits: 700,
  sortOrder: 2,
  paypalPlanId: "P-SCALE",
  paypalTrialPlanId: null,
} as unknown as PlanRow;

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
  state.locale = "en";
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
  it("names a website project in the reader's language under Your purchases, and leaves other purchases alone", async () => {
    state.locale = "es";
    vi.mocked(listPurchases).mockResolvedValueOnce([WEBSITE_PURCHASE, OTHER_PURCHASE]);
    signIn("user_owner", OWNER_ORG);
    const purchases = findOne(await render(), PurchasesPanel).purchases as { slug: string; name: string }[];
    expect(purchases.map((row) => row.name)).toEqual(["Sitio web nuevo", "Top 250 live USA Local Citations"]);
  });

  it("does the same on a guest's page, which lists past purchases only", async () => {
    state.locale = "de";
    vi.mocked(listPurchases).mockResolvedValueOnce([WEBSITE_PURCHASE]);
    signIn("user_guest", GUEST_ORG);
    const purchases = findOne(await render(), PurchasesPanel).purchases as { name: string }[];
    expect(purchases.map((row) => row.name)).toEqual(["Neue Website"]);
  });

  it("owner: their selected site, the strip, and links to the other add-ons", async () => {
    const row = { description: null, priceCents: 100, currency: "eur", creditsGranted: 0, creditPrice: 1, purchasable: false };
    vi.mocked(listAddons).mockResolvedValueOnce([
      { ...row, id: "a1", slug: "credits_10", name: "100 credits", kind: "credits" },
      { ...row, id: "a2", slug: "usa_local_citations", name: "Top 250 live USA Local Citations", kind: "service" },
      { ...row, id: "a3", slug: "website_new", name: "New website", kind: "quote" },
    ]);
    signIn("user_owner", OWNER_ORG);
    const tree = await render();

    expect(findOne(tree, SettingsNav).websiteId).toBe(sharedSite);
    const client = findOne(tree, BillingClient);
    expect(client.websiteId).toBe(sharedSite);
    expect(client.viewingSharedDomain).toBeNull();
    // The packs are one link of the strip's own; the rest by name, a website project on its own screen.
    expect(client.addonLinks).toEqual([
      { id: "a2", name: "Top 250 live USA Local Citations", href: "/credits/buy#services" },
      { id: "a3", name: "New website", href: expect.stringMatching(/^\/website-projects/) },
    ]);
    expect(findAll(tree, PaymentsPanel)).toHaveLength(1);
  });

  // eval 2026-11-28: a Ukrainian site was offered "250 USA Local Citations".
  it.each([
    ["Ukraine", false],
    ["United States", true],
    [null, true],
  ] as const)("a website whose market is %s is offered the USA-only add-on: %s", async (country, offered) => {
    const row = { description: null, priceCents: 100, currency: "eur", creditsGranted: 0, creditPrice: 1, purchasable: false };
    vi.mocked(listAddons).mockResolvedValueOnce([
      { ...row, id: "a2", slug: "usa_local_citations", name: "Top 250 live USA Local Citations", kind: "service" },
      { ...row, id: "a4", slug: "audit_fix", name: "We fix the errors for you", kind: "service" },
    ]);
    await test.db.update(websites).set({ country }).where(eq(websites.id, sharedSite));
    signIn("user_owner", OWNER_ORG);
    try {
      const links = findOne(await render(), BillingClient).addonLinks as { id: string }[];
      expect(links.map((link) => link.id)).toEqual(offered ? ["a2", "a4"] : ["a4"]);
    } finally {
      await test.db.update(websites).set({ country: null }).where(eq(websites.id, sharedSite));
    }
  });

  it("guest who owns nothing: no plan picker, no shop, no strip - the owner pays", async () => {
    signIn("user_guest", GUEST_ORG);
    const tree = await render();

    expect(findAll(tree, BillingClient)).toHaveLength(0);
    expect(findAll(tree, SettingsNav)).toHaveLength(0);
    expect(findAll(tree, PurchasesPanel)).toHaveLength(1);
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
  });

  it("a ?site= that is not theirs selects nothing of anyone else's", async () => {
    signIn("user_dual", DUAL_ORG);
    const tree = await render({ site: sharedSite });
    expect(findOne(tree, BillingClient).websiteId).toBe(dualSite);
  });

  it("new customer with no website: plans with nothing selected", async () => {
    signIn("user_new", NEW_ORG);
    const tree = await render();

    const client = findOne(tree, BillingClient);
    expect(client.websiteId).toBeNull();
    expect(findAll(tree, SettingsNav)).toHaveLength(0);
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
          cancelAt: null,
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
    const tree = await render({ paypal: "success", checkout: "cancelled" });
    const client = findOne(tree, BillingClient);
    expect(client.paypalResult).toBe("success");
    expect(client.checkout).toBe("cancelled");
  });

  it("sends a credit purchase's return, and a quote's credits, on to the packs' page", async () => {
    signIn("user_owner", OWNER_ORG);
    await expect(render({ addon: "success" })).rejects.toThrow("redirect:/credits/buy?addon=success");
    await expect(render({ project: "p1", revision: "5" })).rejects.toThrow("redirect:/credits/buy?project=p1&revision=5");
  });

  it("marks the plan a link names, only when it is on sale", async () => {
    signIn("user_owner", OWNER_ORG);
    vi.mocked(listPlans).mockResolvedValue([SCALE_ROW]);
    expect(findOne(await render({ plan: "scale" }), BillingClient).selectedPlan).toEqual({ tier: "scale", interval: null });
    expect(findOne(await render({ plan: "agency" }), BillingClient).selectedPlan).toBeNull();
    expect(findOne(await render(), BillingClient).selectedPlan).toBeNull();
    vi.mocked(listPlans).mockResolvedValue([]);
  });

  describe("the prices of a plan change", () => {
    const subscribed = (provider: "stripe" | "paypal", status = "active") => ({
      websiteId: sharedSite,
      domain: "shared.example",
      status,
      planId: "plan_grow",
      planName: "Grow",
      tier: "grow",
      interval: "month",
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      cancelAt: null,
      hasCustomer: provider === "stripe",
      provider,
    });

    const GROW_ROW = { ...SCALE_ROW, id: "plan_grow", name: "Grow", tier: "grow", priceCents: 14900, sortOrder: 1 } as unknown as PlanRow;

    async function card(provider: "stripe" | "paypal", offered: boolean, status = "active", offerOn = true) {
      vi.stubEnv("REPGET_OFFER_ENABLED", offerOn ? "1" : "0");
      signIn("user_owner", OWNER_ORG);
      vi.mocked(listPlans).mockResolvedValueOnce([GROW_ROW, SCALE_ROW]);
      vi.mocked(listWebsiteSubscriptions).mockResolvedValueOnce([subscribed(provider, status)]);
      const id = provider === "stripe" ? { stripeSubscriptionId: "sub_1" } : { paypalSubscriptionId: "I-1" };
      await test.db.insert(subscriptions).values({ organizationId: OWNER_ORG, websiteId: sharedSite, provider, status, ...id });
      await test.db.insert(billingCheckouts).values({
        organizationId: OWNER_ORG,
        websiteId: sharedSite,
        provider,
        status: "completed",
        providerSubscriptionId: provider === "stripe" ? "sub_1" : "I-1",
        requestParams: offered ? { offer: "REPGET" } : {},
      });
      try {
        const client = findOne(await render(), BillingClient);
        const cards = client.planCards as Record<string, { price: string; strike: string | null; terms: string[] }>;
        return { client, view: cards.plan_scale, current: cards.plan_grow };
      } finally {
        vi.unstubAllEnvs();
        await test.client.exec("delete from billing_checkouts; delete from subscriptions;");
      }
    }

    it.each(["stripe", "paypal"] as const)("keeps the launch price a %s subscription has", async (provider) => {
      const { client, view } = await card(provider, true);
      expect(view.price).toBe("€209");
      expect(view.strike).toBe("€349");
      expect(client.launchPriceKept).toBe(true);
    });

    it.each(["stripe", "paypal"] as const)("is the regular price for a %s subscription without it, though the offer is on", async (provider) => {
      const { client, view } = await card(provider, false);
      expect(view.price).toBe("€349");
      expect(view.strike).toBeNull();
      expect(view.terms).toEqual([]);
      expect(client.launchPriceKept).toBe(false);
      expect(client.offerCopy).toBeNull();
      // ...and says why, beside the cards, as /pricing shows the launch price.
      expect(client.regularPrice).toBe(true);
    });

    it("says nothing about regular prices while the offer is off", async () => {
      const { client } = await card("stripe", false, "active", false);
      expect(client.regularPrice).toBe(false);
    });

    /*
      The tester's account (eval 2026-11-28): a card free trial on Grow. The
      trial converts at the price its checkout took - with the launch price
      EUR 89, without it EUR 149 - and a plan change keeps the same.
    */
    it.each([
      [true, "€89", "€149", false],
      [false, "€149", null, true],
    ] as const)("a card free trial with launch price %s: Grow shows %s", async (offered, price, strike, regular) => {
      const { client, current } = await card("stripe", offered, "trialing");
      expect(current.price).toBe(price);
      expect(current.strike).toBe(strike);
      expect(client.regularPrice).toBe(regular);
    });

    /*
      A PayPal free trial: another plan is a new checkout (the offer's price
      while it is on), but its own plan converts at the price it was started on,
      whether the offer is on now or not.
    */
    it.each([
      [true, true, "€89", "€209"],
      [false, true, "€149", "€209"],
      [true, false, "€89", "€349"],
      [false, false, "€149", "€349"],
    ] as const)("a PayPal free trial (launch price %s, offer on %s): Grow %s, Scale %s", async (offered, offerOn, grow, scale) => {
      const { client, view, current } = await card("paypal", offered, "trialing", offerOn);
      expect(current.price).toBe(grow);
      expect(view.price).toBe(scale);
      expect(client.regularPrice).toBe(false);
    });
  });
});
