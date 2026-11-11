import { eq } from "drizzle-orm";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  adminAuditLog,
  billingCheckouts,
  organization,
  paypalPlanChanges,
  plans,
  subscriptions,
  websites,
} from "@/lib/db/schema";
import { lifecycleEmails, member, user } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";

/**
 * Checkout creation and website/workspace deletion, coordinated through
 * billing_checkouts. The real actions run against a disposable PGlite; the
 * Stripe and PayPal SDKs are replaced at their boundary, so nothing is ever
 * sent to a provider.
 */

const state = vi.hoisted(() => ({
  db: null as unknown,
  orgId: "org_a",
  context: null as unknown,
  emailVerified: true,
}));

const stripeMock = vi.hoisted(() => ({
  sessionsCreate: vi.fn(),
  sessionsExpire: vi.fn(),
  sessionsRetrieve: vi.fn(),
  sessionsList: vi.fn(),
  subscriptionsRetrieve: vi.fn(),
  portalCreate: vi.fn(),
}));

const paypalMock = vi.hoisted(() => ({
  createSubscription: vi.fn(),
  getSubscription: vi.fn(),
  reviseSubscription: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/inngest/send", () => ({ queueJob: vi.fn() }));
vi.mock("@/lib/admin/guard", () => ({
  requireAdmin: vi.fn(async () => ({ email: "ops@example.test" })),
  adminEmails: () => ["staff@fixture.test"],
}));
vi.mock("@/lib/backlinks/credits", () => ({
  recordCredit: vi.fn(),
  getBalance: vi.fn(),
}));
vi.mock("@/lib/usage", () => ({ checkLimit: vi.fn() }));
vi.mock("@/lib/stripe/customer", () => ({
  getOrCreateCustomer: vi.fn(async () => "cus_test"),
}));
const mail = vi.hoisted(() => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/email/send", () => mail);
vi.mock("@/lib/stripe/client", () => ({
  isStripeConfigured: () => true,
  stripe: {
    checkout: {
      sessions: {
        create: stripeMock.sessionsCreate,
        expire: stripeMock.sessionsExpire,
        retrieve: stripeMock.sessionsRetrieve,
        list: stripeMock.sessionsList,
      },
    },
    subscriptions: { retrieve: stripeMock.subscriptionsRetrieve },
    billingPortal: { sessions: { create: stripeMock.portalCreate } },
  },
}));
vi.mock("@/lib/paypal/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/paypal/client")>()),
  isPayPalConfigured: () => true,
}));
vi.mock("@/lib/paypal/subscriptions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/paypal/subscriptions")>()),
  createSubscription: paypalMock.createSubscription,
  getSubscription: paypalMock.getSubscription,
  reviseSubscription: paypalMock.reviseSubscription,
}));
// The signed-in person; card checkout asks whether their address is confirmed.
vi.mock("@/lib/auth-guard", () => ({
  requireSession: vi.fn(async () => ({
    user: { id: "user_1", email: "owner@example.test", emailVerified: state.emailVerified },
  })),
}));
vi.mock("@/lib/tenant", () => {
  class WebsiteNotFoundError extends Error {}
  return {
    WebsiteNotFoundError,
    requireOrg: vi.fn(async () => ({
      orgId: state.orgId,
      userId: "user_1",
      role: "owner",
    })),
    requireWebsite: vi.fn(async () => {
      if (!state.context) throw new WebsiteNotFoundError();
      return state.context;
    }),
  };
});

import { deleteOrganization } from "@/lib/admin/operations";
import { CHECKOUT_IN_FLIGHT_MS } from "@/lib/billing/checkouts";
import { CONFIRM_EMAIL_FIRST, FREE_ARTICLES_DAYS } from "@/lib/plans/features";
import { runReconciliation } from "@/lib/billing/reconciliation";
import { createPayPalCheckout } from "@/lib/paypal/actions";
import { createCheckoutSession } from "@/lib/stripe/actions";
import { deleteWebsite } from "@/lib/websites/actions";

let test: TestDb;
let planId: string;

beforeAll(async () => {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example.test");
  test = await createTestDb();
  state.db = test.db;
});

beforeEach(async () => {
  vi.clearAllMocks();
  state.orgId = "org_a";
  state.context = null;
  state.emailVerified = true;
  await test.client.exec(`
    delete from admin_audit_log;
    delete from billing_checkouts;
    delete from subscriptions;
    delete from websites;
    delete from organization;
    delete from plans;
  `);
  await test.db.insert(organization).values([
    { id: "org_a", name: "Acme", slug: "acme", createdAt: new Date() },
    { id: "org_b", name: "Other", slug: "other", createdAt: new Date() },
  ]);
  const [plan] = await test.db
    .insert(plans)
    .values({
      name: "Growth",
      tier: "growth",
      stripePriceId: "price_growth",
      paypalPlanId: "P-GROWTH",
      priceCents: 4900,
      articleLimit: 30,
      keywordLimit: 100,
      siteLimit: 1,
      monthlyCredits: 0,
    })
    .returning();
  planId = plan.id;

  stripeMock.sessionsCreate.mockImplementation(async () => ({
    id: "cs_test_1",
    url: "https://checkout.stripe.test/cs_test_1",
    expires_at: Math.floor(Date.now() / 1000) + 24 * 3600,
  }));
  paypalMock.createSubscription.mockImplementation(async () => ({
    subscriptionId: "I-PENDING",
    approveUrl: "https://paypal.test/approve",
  }));
  // An open session, as Stripe reports one it has not been asked to expire.
  stripeMock.sessionsRetrieve.mockImplementation(async (id: string) => ({
    id,
    status: "open",
    url: `https://checkout.stripe.test/${id}`,
    expires_at: Math.floor(Date.now() / 1000) + 24 * 3600,
  }));
  stripeMock.sessionsList.mockImplementation(() => sessionsFound([]));
});

/** What checkout.sessions.list iterates over. */
function sessionsFound(sessions: Record<string, unknown>[]) {
  return (async function* () {
    yield* sessions;
  })();
}

/** A Stripe error that says Stripe answered and refused. */
function stripeRefusal(message: string) {
  return Object.assign(new Error(message), { statusCode: 400, type: "StripeInvalidRequestError" });
}

async function addSite(organizationId = "org_a", domain = "acme.test") {
  const [site] = await test.db
    .insert(websites)
    .values({ organizationId, url: `https://${domain}`, domain })
    .returning();
  return site;
}

function actAsOwner(site: typeof websites.$inferSelect) {
  state.context = {
    site,
    access: "owner",
    orgId: site.organizationId,
    userId: "user_1",
    role: "owner",
  };
}

async function checkouts() {
  return test.db.select().from(billingCheckouts);
}

async function siteExists(id: string) {
  const rows = await test.db.select().from(websites).where(eq(websites.id, id));
  return rows.length === 1;
}

describe("the REPGET offer, applied automatically (2026-11-11)", () => {
  const row = { articleLimit: 30, keywordLimit: 100, siteLimit: 1, monthlyCredits: 0 };
  let version = 10;
  const params = () => stripeMock.sessionsCreate.mock.calls.at(-1)![0];
  const growPlan = async (fields: Partial<typeof plans.$inferInsert> = {}) =>
    (await test.db.insert(plans).values({ ...row, name: "Grow", tier: "grow", interval: "month", currency: "eur", priceCents: 14900, stripePriceId: "price_grow_2", catalogVersion: (version += 1), ...fields }).returning())[0].id;
  const usedTrial = async (organizationId = "org_a") => {
    const site = await addSite(organizationId, "earlier.test");
    await test.db.insert(subscriptions).values({ organizationId, websiteId: site.id, planId, status: "canceled", provider: "stripe", stripeSubscriptionId: "sub_earlier" });
  };
  /** A checkout of this workspace that used (completed) or holds (open) REPGET. */
  const usedOffer = async (plan: string, status = "completed") => {
    const earlier = await addSite("org_a", "used.test");
    await test.db.insert(billingCheckouts).values({ organizationId: "org_a", websiteId: earlier.id, provider: "stripe", planId: plan, status, trialDays: 0, stripeSessionId: `cs_${status}`, requestParams: { offer: "REPGET" }, createdAt: new Date(Date.now() - 3_600_000) });
  };

  beforeEach(() => {
    process.env.REPGET_OFFER_ENABLED = "1";
  });
  afterEach(() => {
    delete process.env.REPGET_OFFER_ENABLED;
  });

  it("nothing typed: the plan's coupon is on the checkout, with the free period, and no code box beside it", async () => {
    const site = await addSite();
    await createCheckoutSession(await growPlan(), site.id);
    expect(params().discounts).toEqual([{ coupon: "GROW40" }]);
    expect(params().allow_promotion_codes).toBeUndefined();
    expect(params().subscription_data.trial_period_days).toBe(FREE_ARTICLES_DAYS);
    expect(params().subscription_data.metadata.repget_offer).toBe("REPGET");
    const [checkout] = await checkouts();
    expect(checkout.requestParams).toMatchObject({ offer: "REPGET" });
  });

  it("with no free period, the same", async () => {
    await usedTrial();
    const site = await addSite();
    await createCheckoutSession(await growPlan(), site.id);
    expect(params().discounts).toEqual([{ coupon: "GROW40" }]);
    expect(params().subscription_data.trial_period_days).toBeUndefined();
  });

  it("yearly: the plan's YEARLY coupon (40% off the first year)", async () => {
    const site = await addSite();
    await createCheckoutSession(await growPlan({ interval: "year", priceCents: 149000, stripePriceId: "price_year" }), site.id);
    expect(params().discounts).toEqual([{ coupon: "GROW40Y" }]);
  });

  it("the plan decides the coupon", async () => {
    await usedTrial();
    const site = await addSite();
    await createCheckoutSession(await growPlan({ name: "Scale", tier: "scale", priceCents: 34900, stripePriceId: "price_scale" }), site.id);
    expect(params().discounts).toEqual([{ coupon: "SCALE40" }]);
  });

  it("a price it does not cover (an older catalogue's): no coupon, Stripe's code box as before", async () => {
    const site = await addSite();
    await createCheckoutSession(await growPlan({ name: "Old Grow", priceCents: 9900, stripePriceId: "price_old" }), site.id);
    expect(params().discounts).toBeUndefined();
    expect(params().allow_promotion_codes).toBe(true);
    expect((await checkouts())[0].requestParams).not.toMatchObject({ offer: "REPGET" });
  });

  it("switched off: no coupon, Stripe's code box, nothing remembered", async () => {
    delete process.env.REPGET_OFFER_ENABLED;
    const site = await addSite();
    await createCheckoutSession(await growPlan(), site.id);
    expect(params().allow_promotion_codes).toBe(true);
    expect(params().discounts).toBeUndefined();
    expect(params().subscription_data.metadata.repget_offer).toBeUndefined();
  });

  it("a coupon Stripe refuses starts nothing: no checkout at full price, the customer is told, staff are emailed", async () => {
    const site = await addSite();
    const plan = await growPlan();
    stripeMock.sessionsCreate.mockRejectedValueOnce(stripeRefusal("No such coupon: 'GROW40'"));
    expect(await createCheckoutSession(plan, site.id)).toEqual({ error: expect.stringContaining("you have not been charged") });
    expect(stripeMock.sessionsCreate).toHaveBeenCalledTimes(1);
    expect(mail.sendEmail).toHaveBeenCalledTimes(1);
    expect(mail.sendEmail.mock.calls[0][0].text).toContain("GROW40");
    const [checkout] = await checkouts();
    expect(checkout.status).toBe("failed");
  });

  it("without the offer, any Stripe refusal answers as before, and tells nobody", async () => {
    delete process.env.REPGET_OFFER_ENABLED;
    const site = await addSite();
    stripeMock.sessionsCreate.mockRejectedValueOnce(stripeRefusal("Something else"));
    const answer = await createCheckoutSession(await growPlan(), site.id);
    expect(answer).toEqual({ error: expect.any(String) });
    expect(JSON.stringify(answer)).not.toContain("REPGET");
    expect(mail.sendEmail).not.toHaveBeenCalled();
  });

  it("one use per account: once used, the next checkout goes at the full price with the code box; another workspace still gets it", async () => {
    const plan = await growPlan();
    await usedOffer(plan);
    const site = await addSite();
    expect(await createCheckoutSession(plan, site.id)).toEqual({ url: expect.any(String) });
    expect(params().discounts).toBeUndefined();
    expect(params().allow_promotion_codes).toBe(true);
    const other = await addSite("org_b", "other.test");
    state.orgId = "org_b";
    await createCheckoutSession(plan, other.id);
    expect(params().discounts).toEqual([{ coupon: "GROW40" }]);
  });

  it("held by another website's open checkout: refused until that one is settled, and that one is not closed", async () => {
    const plan = await growPlan();
    await usedOffer(plan, "open");
    const site = await addSite();
    expect(await createCheckoutSession(plan, site.id)).toEqual({ error: expect.stringContaining("another checkout") });
    expect(stripeMock.sessionsCreate).not.toHaveBeenCalled();
    expect(stripeMock.sessionsExpire).not.toHaveBeenCalled();
  });

  it("an open checkout without the offer is not reused for one with it", async () => {
    const site = await addSite();
    const plan = await growPlan();
    delete process.env.REPGET_OFFER_ENABLED;
    await createCheckoutSession(plan, site.id);
    process.env.REPGET_OFFER_ENABLED = "1";
    stripeMock.sessionsExpire.mockResolvedValueOnce({ status: "expired" });
    stripeMock.sessionsCreate.mockImplementationOnce(async () => ({
      id: "cs_test_2",
      url: "https://checkout.stripe.test/cs_test_2",
      expires_at: Math.floor(Date.now() / 1000) + 24 * 3600,
    }));
    await createCheckoutSession(plan, site.id);
    expect(stripeMock.sessionsExpire).toHaveBeenCalledWith("cs_test_1");
    expect(stripeMock.sessionsCreate).toHaveBeenCalledTimes(2);
    expect(params().discounts).toEqual([{ coupon: "GROW40" }]);
    // The same request again is the same checkout.
    await createCheckoutSession(plan, site.id);
    expect(stripeMock.sessionsCreate).toHaveBeenCalledTimes(2);
  });

  it("a plan change of a paying website is not stopped by it", async () => {
    const site = await addSite();
    await test.db.insert(subscriptions).values({ organizationId: "org_a", websiteId: site.id, provider: "stripe", planId, status: "active", stripeSubscriptionId: "sub_live" });
    stripeMock.subscriptionsRetrieve.mockResolvedValueOnce({ id: "sub_live", customer: "cus_test", status: "active", metadata: {}, discounts: [], items: { data: [{ id: "si_1", quantity: 1 }] } });
    stripeMock.portalCreate.mockResolvedValueOnce({ url: "https://billing.stripe.test/confirm" });
    expect(await createCheckoutSession(await growPlan(), site.id)).toEqual({ url: "https://billing.stripe.test/confirm" });
    expect(stripeMock.portalCreate.mock.calls[0][0].flow_data.subscription_update_confirm.discounts).toBeUndefined();
  });

  /*
    The Grow + Visibility bundle (2026-11-11): bought outright - no free
    trial, no free articles, no REPGET, and so no email code first.
  */
  describe("Grow + Visibility, a direct purchase", () => {
    const bundle = (fields: Partial<typeof plans.$inferInsert> = {}) =>
      growPlan({ name: "Grow + Visibility", tier: "grow_visibility", priceCents: 9900, stripePriceId: "price_bundle", ...fields });

    it("charges at checkout: no trial even for a new workspace, no coupon, Stripe's code box", async () => {
      const site = await addSite();
      await createCheckoutSession(await bundle(), site.id);
      expect(params().subscription_data.trial_period_days).toBeUndefined();
      expect(params().discounts).toBeUndefined();
      expect(params().allow_promotion_codes).toBe(true);
      const [checkout] = await checkouts();
      expect(checkout.trialDays).toBe(0);
      expect(checkout.requestParams).not.toMatchObject({ offer: "REPGET" });
    });

    it("an unconfirmed address can pay: there are no free articles to protect", async () => {
      state.emailVerified = false;
      const site = await addSite();
      expect(await createCheckoutSession(await bundle(), site.id)).toEqual({ url: expect.any(String) });
    });

    it("through PayPal: its own plan, charged at once, never a free-articles one", async () => {
      const site = await addSite();
      await createPayPalCheckout(await bundle({ paypalPlanId: "P-BUNDLE", paypalTrialPlanId: "P-BUNDLE-FREE" }), site.id);
      const call = paypalMock.createSubscription.mock.calls.at(-1)![0];
      expect(call).toMatchObject({ planId: "P-BUNDLE" });
      expect(call.intro).toBeUndefined();
      expect((await checkouts())[0].trialDays).toBe(0);
    });
  });

  /*
    REPGET through PayPal (review P5): the plan's REPGET offer plan, its ONE
    intro cycle priced lower on this subscription only (createSubscription's
    override), after any free days. PayPal is stubbed at createSubscription:
    the override body is plans-body/subscriptions tests; PayPal honouring it
    is the owner's sandbox flow.
  */
  describe("through PayPal (review P5)", () => {
    const offerPlan = (fields: Partial<typeof plans.$inferInsert> = {}) =>
      growPlan({ paypalPlanId: "P-GROW", paypalTrialPlanId: "P-GROW-FREE", paypalOfferPlanId: "P-GROW-OFFER", paypalTrialOfferPlanId: "P-GROW-FREE-OFFER", ...fields });
    const created = () => paypalMock.createSubscription.mock.calls.at(-1)![0];

    it("subscribes to the offer plan, its first payment the fixed monthly amount less", async () => {
      await usedTrial();
      const site = await addSite();
      expect(await createPayPalCheckout(await offerPlan(), site.id)).toEqual({ url: expect.any(String) });
      // 149.00 less 59.60.
      expect(created()).toMatchObject({ planId: "P-GROW-OFFER", intro: { sequence: 1, priceCents: 8940, currency: "eur" } });
      const [row] = await checkouts();
      expect(row.requestParams).toMatchObject({ plan: "P-GROW-OFFER", offer: "REPGET", introCents: 8940 });
    });

    it("after the free articles: the free days first, then the discounted payment", async () => {
      const site = await addSite();
      await createPayPalCheckout(await offerPlan(), site.id);
      expect(created()).toMatchObject({ planId: "P-GROW-FREE-OFFER", intro: { sequence: 2, priceCents: 8940 } });
    });

    it("yearly: the annual offer plan, its first year at 40% off (EUR 890 of 1,490)", async () => {
      await usedTrial();
      const site = await addSite();
      await createPayPalCheckout(await offerPlan({ interval: "year", priceCents: 149000, stripePriceId: "price_year_pp" }), site.id);
      expect(created()).toMatchObject({ planId: "P-GROW-OFFER", intro: { sequence: 1, priceCents: 89000 } });
    });

    it("switched off: the plan as before, with no override", async () => {
      delete process.env.REPGET_OFFER_ENABLED;
      await usedTrial();
      const site = await addSite();
      await createPayPalCheckout(await offerPlan(), site.id);
      expect(created()).toMatchObject({ planId: "P-GROW" });
      expect(created().intro).toBeUndefined();
    });

    it("a plan without its offer plans gives the discount by card only: nothing is started, and the offer is given back", async () => {
      const site = await addSite();
      expect(await createPayPalCheckout(await offerPlan({ paypalTrialOfferPlanId: null }), site.id)).toEqual({
        error: expect.stringContaining("not available with PayPal"),
      });
      expect(paypalMock.createSubscription).not.toHaveBeenCalled();
      expect((await checkouts()).map((c) => c.status)).toEqual(["failed"]);
    });

    it("one use per account, whichever processor used it: used, PayPal goes without it", async () => {
      const plan = await offerPlan();
      await usedOffer(plan);
      const site = await addSite();
      expect(await createPayPalCheckout(plan, site.id)).toEqual({ url: expect.any(String) });
      expect(created().planId).toBe("P-GROW-FREE");
      expect(created().intro).toBeUndefined();
    });

    it("a plan change of a PayPal website is not stopped by it", async () => {
      const site = await addSite();
      const [scale] = await test.db.insert(plans).values({ ...row, name: "Scale", tier: "scale", interval: "month", currency: "eur", priceCents: 34900, stripePriceId: "price_scale_pp", paypalPlanId: "P-SCALE", catalogVersion: (version += 1) }).returning();
      await test.db.insert(subscriptions).values({ organizationId: "org_a", websiteId: site.id, provider: "paypal", planId: scale.id, status: "active", paypalSubscriptionId: "I-LIVE" });
      paypalMock.getSubscription.mockResolvedValueOnce({ id: "I-LIVE", status: "ACTIVE", plan_id: "P-SCALE", billing_info: { next_billing_time: "2099-01-01T00:00:00Z" } });
      paypalMock.reviseSubscription.mockResolvedValueOnce({ approveUrl: "https://paypal.test/revise" });
      expect(await createPayPalCheckout(await offerPlan({ paypalTrialOfferPlanId: null }), site.id)).toEqual({ url: "https://paypal.test/revise" });
      expect(paypalMock.createSubscription).not.toHaveBeenCalled();
    });
  });
});

describe("opening a checkout", () => {
  it("records the checkout before sending the customer to Stripe", async () => {
    const site = await addSite();

    const result = await createCheckoutSession(planId, site.id);

    expect(result).toEqual({ url: "https://checkout.stripe.test/cs_test_1" });
    const [row] = await checkouts();
    expect(row).toMatchObject({
      organizationId: "org_a",
      websiteId: site.id,
      provider: "stripe",
      status: "open",
      stripeSessionId: "cs_test_1",
    });
    expect(row.expiresAt).toBeInstanceOf(Date);
    const params = stripeMock.sessionsCreate.mock.calls[0][0];
    expect(params.client_reference_id).toBe(row.id);
    expect(params.subscription_data.metadata.checkoutId).toBe(row.id);
  });

  it("refuses a website in another workspace without calling Stripe", async () => {
    const site = await addSite("org_b", "other.test");

    expect(await createCheckoutSession(planId, site.id)).toEqual({
      error: "Website not found",
    });
    expect(stripeMock.sessionsCreate).not.toHaveBeenCalled();
    expect(await checkouts()).toHaveLength(0);
  });

  it("refuses a website deleted before the checkout opened", async () => {
    const site = await addSite();
    actAsOwner(site);
    expect((await deleteWebsite(site.id)).ok).toBe(true);

    expect(await createCheckoutSession(planId, site.id)).toEqual({
      error: "Website not found",
    });
    expect(stripeMock.sessionsCreate).not.toHaveBeenCalled();
  });

  it("marks the checkout failed when Stripe refuses", async () => {
    const site = await addSite();
    stripeMock.sessionsCreate.mockRejectedValueOnce(stripeRefusal("No such price"));

    expect(await createCheckoutSession(planId, site.id)).toHaveProperty("error");
    const [row] = await checkouts();
    expect(row.status).toBe("failed");
  });

  it("records the PayPal subscription id for a PayPal checkout", async () => {
    const site = await addSite();

    expect(await createPayPalCheckout(planId, site.id)).toEqual({
      url: "https://paypal.test/approve",
    });
    const [row] = await checkouts();
    expect(row).toMatchObject({
      provider: "paypal",
      status: "open",
      providerSubscriptionId: "I-PENDING",
    });
  });
});

describe("deleting a website with a checkout open", () => {
  it("refuses while a paid PayPal upgrade waits for approval or its refund (review P1)", async () => {
    const site = await addSite();
    const [sub] = await test.db
      .insert(subscriptions)
      // Ended (an active one refuses deletion already); its upgrade's difference not yet refunded.
      .values({ organizationId: "org_a", websiteId: site.id, provider: "paypal", planId, status: "canceled", paypalSubscriptionId: "I-UP" })
      .returning();
    const [change] = await test.db
      .insert(paypalPlanChanges)
      .values({ organizationId: "org_a", subscriptionId: sub.id, paypalSubscriptionId: "I-UP", fromPlanId: planId, toPlanId: planId, kind: "upgrade", status: "refunding", differenceCents: 5000, currency: "eur" })
      .returning();
    actAsOwner(site);
    const website = await deleteWebsite(site.id);
    expect(!website.ok && website.error).toMatch(/plan change/);
    const workspace = await deleteOrganization("org_a", "erasure request", "DELETE");
    expect(!workspace.ok && workspace.error).toMatch(/plan change/);
    expect(await siteExists(site.id)).toBe(true);

    // Nothing paid (a downgrade) holds nothing.
    await test.db.update(paypalPlanChanges).set({ status: "refunded" }).where(eq(paypalPlanChanges.id, change.id));
    const after = await deleteOrganization("org_a", "erasure request", "DELETE");
    expect(!after.ok && after.error ? after.error : "").not.toMatch(/plan change/);
  });

  it("expires the Stripe session, then deletes", async () => {
    const site = await addSite();
    await createCheckoutSession(planId, site.id);
    stripeMock.sessionsExpire.mockResolvedValueOnce({ status: "expired" });
    actAsOwner(site);

    expect((await deleteWebsite(site.id)).ok).toBe(true);

    expect(stripeMock.sessionsExpire).toHaveBeenCalledWith("cs_test_1");
    expect(await siteExists(site.id)).toBe(false);
    const [row] = await checkouts();
    // Kept, detached, for reconciliation.
    expect(row).toMatchObject({ status: "expired", websiteId: null });
  });

  it("refuses when the checkout was paid but the webhook has not arrived", async () => {
    const site = await addSite();
    await createCheckoutSession(planId, site.id);
    stripeMock.sessionsExpire.mockRejectedValueOnce(new Error("not open"));
    stripeMock.sessionsRetrieve.mockResolvedValueOnce({
      status: "complete",
      subscription: "sub_paid",
    });
    actAsOwner(site);

    const result = await deleteWebsite(site.id);

    expect(!result.ok && result.error).toMatch(/just gone through/);
    expect(await siteExists(site.id)).toBe(true);
    const [row] = await checkouts();
    expect(row).toMatchObject({
      status: "completed",
      providerSubscriptionId: "sub_paid",
    });
  });

  it("then refuses on the subscription once the webhook records it", async () => {
    const site = await addSite();
    await createCheckoutSession(planId, site.id);
    await test.db
      .update(billingCheckouts)
      .set({ status: "completed", providerSubscriptionId: "sub_paid" });
    await test.db.insert(subscriptions).values({
      organizationId: "org_a",
      websiteId: site.id,
      status: "trialing",
      stripeSubscriptionId: "sub_paid",
    });
    actAsOwner(site);

    const result = await deleteWebsite(site.id);

    expect(!result.ok && result.error).toMatch(/active subscription/);
  });

  it("refuses when Stripe cannot be reached", async () => {
    const site = await addSite();
    await createCheckoutSession(planId, site.id);
    stripeMock.sessionsExpire.mockRejectedValueOnce(new Error("ECONNRESET"));
    stripeMock.sessionsRetrieve.mockRejectedValueOnce(new Error("ECONNRESET"));
    actAsOwner(site);

    const result = await deleteWebsite(site.id);

    expect(!result.ok && result.error).toMatch(/still open/);
    expect(await siteExists(site.id)).toBe(true);
    expect((await checkouts())[0].status).toBe("open");
  });

  /*
    Review correction: the clock is not the provider. A session past its
    expiry hint that Stripe says was PAID (the webhook is late) must block.
  */
  it("asks Stripe even after the expiry hint, and refuses a late-paid session", async () => {
    const site = await addSite();
    await createCheckoutSession(planId, site.id);
    await test.db.update(billingCheckouts).set({ expiresAt: new Date(Date.now() - 1000) });
    stripeMock.sessionsExpire.mockRejectedValueOnce(new Error("session is not open"));
    stripeMock.sessionsRetrieve.mockResolvedValueOnce({ status: "complete", subscription: "sub_late" });
    actAsOwner(site);

    const result = await deleteWebsite(site.id);

    expect(!result.ok && result.error).toMatch(/just gone through/);
    expect(stripeMock.sessionsExpire).toHaveBeenCalledWith("cs_test_1");
    expect(await siteExists(site.id)).toBe(true);
  });

  it("deletes after the expiry hint once Stripe confirms the session expired", async () => {
    const site = await addSite();
    await createCheckoutSession(planId, site.id);
    await test.db.update(billingCheckouts).set({ expiresAt: new Date(Date.now() - 1000) });
    stripeMock.sessionsExpire.mockRejectedValueOnce(new Error("session is not open"));
    stripeMock.sessionsRetrieve.mockResolvedValueOnce({ status: "expired" });
    actAsOwner(site);

    expect((await deleteWebsite(site.id)).ok).toBe(true);
  });

  it("refuses while a checkout is still being opened", async () => {
    const site = await addSite();
    // Recorded, but Stripe has not answered yet: no session id.
    await test.db.insert(billingCheckouts).values({
      organizationId: "org_a",
      websiteId: site.id,
      provider: "stripe",
      planId,
      status: "open",
      createdAt: new Date(),
    });
    actAsOwner(site);

    const result = await deleteWebsite(site.id);

    expect(!result.ok && result.error).toMatch(/still open/);
  });

  it("recovers a checkout orphaned mid-creation from Stripe, and refuses if it was paid", async () => {
    const site = await addSite();
    const [orphan] = await test.db
      .insert(billingCheckouts)
      .values({
        organizationId: "org_a",
        websiteId: site.id,
        provider: "stripe",
        status: "open",
        requestParams: { customer: "cus_test" },
        createdAt: new Date(Date.now() - CHECKOUT_IN_FLIGHT_MS - 60_000),
      })
      .returning();
    // The create DID go through before the process died.
    stripeMock.sessionsList.mockImplementationOnce(() =>
      sessionsFound([{ id: "cs_lost", client_reference_id: orphan.id, url: "https://x", expires_at: null }]),
    );
    stripeMock.sessionsExpire.mockRejectedValueOnce(new Error("not open"));
    stripeMock.sessionsRetrieve.mockResolvedValueOnce({ status: "complete", subscription: "sub_lost" });
    actAsOwner(site);

    const result = await deleteWebsite(site.id);

    expect(!result.ok && result.error).toMatch(/just gone through/);
    expect((await checkouts())[0]).toMatchObject({
      stripeSessionId: "cs_lost",
      status: "completed",
      providerSubscriptionId: "sub_lost",
    });
  });

  it("settles an orphaned checkout Stripe never created as failed, and deletes", async () => {
    const site = await addSite();
    await test.db.insert(billingCheckouts).values({
      organizationId: "org_a",
      websiteId: site.id,
      provider: "stripe",
      status: "open",
      requestParams: { customer: "cus_test" },
      createdAt: new Date(Date.now() - CHECKOUT_IN_FLIGHT_MS - 60_000),
    });
    actAsOwner(site);

    expect((await deleteWebsite(site.id)).ok).toBe(true);
    expect((await checkouts())[0].status).toBe("failed");
  });

  it("refuses for an orphaned checkout that cannot be looked up", async () => {
    const site = await addSite();
    await test.db.insert(billingCheckouts).values({
      organizationId: "org_a",
      websiteId: site.id,
      provider: "stripe",
      status: "open",
      createdAt: new Date(Date.now() - CHECKOUT_IN_FLIGHT_MS - 60_000),
    });
    actAsOwner(site);

    const result = await deleteWebsite(site.id);
    expect(!result.ok && result.error).toMatch(/still open/);
    expect((await checkouts())[0].status).toBe("unresolved");
  });

  /*
    Review correction: a PayPal approval cannot be withdrawn, so until its
    behaviour is verified the deletion is refused rather than abandoned.
  */
  it("refuses while a PayPal approval is pending", async () => {
    const site = await addSite();
    await createPayPalCheckout(planId, site.id);
    paypalMock.getSubscription.mockResolvedValue({ id: "I-PENDING", status: "APPROVAL_PENDING" });
    actAsOwner(site);

    const result = await deleteWebsite(site.id);

    expect(!result.ok && result.error).toMatch(/waiting for approval/);
    expect(await siteExists(site.id)).toBe(true);
    expect((await checkouts())[0]).toMatchObject({ status: "open", providerState: "approval_pending" });
  });

  it("deletes once PayPal reports the pending approval expired", async () => {
    const site = await addSite();
    await createPayPalCheckout(planId, site.id);
    paypalMock.getSubscription.mockResolvedValueOnce({ id: "I-PENDING", status: "EXPIRED" });
    actAsOwner(site);

    expect((await deleteWebsite(site.id)).ok).toBe(true);
    expect((await checkouts())[0].status).toBe("expired");
  });


  it("refuses when PayPal reports the subscription approved but unrecorded", async () => {
    const site = await addSite();
    await createPayPalCheckout(planId, site.id);
    paypalMock.getSubscription.mockResolvedValueOnce({
      id: "I-PENDING",
      status: "ACTIVE",
    });
    actAsOwner(site);

    const result = await deleteWebsite(site.id);

    expect(!result.ok && result.error).toMatch(/just gone through/);
    expect(await siteExists(site.id)).toBe(true);
  });

  it("ignores another site's open checkout", async () => {
    const site = await addSite();
    const other = await addSite("org_a", "second.test");
    await createCheckoutSession(planId, other.id);
    actAsOwner(site);

    expect((await deleteWebsite(site.id)).ok).toBe(true);
    expect(stripeMock.sessionsExpire).not.toHaveBeenCalled();
    expect((await checkouts())[0].status).toBe("open");
  });
});

describe("deleting a workspace", () => {
  async function auditRows() {
    return test.db.select().from(adminAuditLog);
  }

  it("expires open checkouts, audits and deletes in one go", async () => {
    const site = await addSite();
    await createCheckoutSession(planId, site.id);
    stripeMock.sessionsExpire.mockResolvedValueOnce({ status: "expired" });

    const result = await deleteOrganization("org_a", "erasure request", "DELETE");

    expect(result).toEqual({ ok: true, data: null });
    expect(stripeMock.sessionsExpire).toHaveBeenCalledWith("cs_test_1");
    const orgs = await test.db
      .select()
      .from(organization)
      .where(eq(organization.id, "org_a"));
    expect(orgs).toHaveLength(0);
    const [audit] = await auditRows();
    expect(audit).toMatchObject({ action: "organization.deleted", targetId: "org_a" });
    expect(audit.summary).toMatch(/1 websites/);
  });

  it("refuses, without an audit entry, while a checkout is paid but unrecorded", async () => {
    const site = await addSite();
    await createCheckoutSession(planId, site.id);
    stripeMock.sessionsExpire.mockRejectedValueOnce(new Error("not open"));
    stripeMock.sessionsRetrieve.mockResolvedValueOnce({
      status: "complete",
      subscription: "sub_paid",
    });

    const result = await deleteOrganization("org_a", "erasure request", "DELETE");

    expect(!result.ok && result.error).toMatch(/workspace has just gone through/);
    expect(await auditRows()).toHaveLength(0);
    expect(await siteExists(site.id)).toBe(true);
  });

  it("refuses while any subscription can still bill", async () => {
    const site = await addSite();
    await test.db.insert(subscriptions).values({
      organizationId: "org_a",
      websiteId: site.id,
      status: "active",
      stripeSubscriptionId: "sub_live",
    });

    const result = await deleteOrganization("org_a", "erasure request", "DELETE");

    expect(!result.ok && result.error).toMatch(/active subscription/);
    expect(await auditRows()).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------------ */
/* Issue 5: one subscription per website, across Stripe and PayPal           */
/* ------------------------------------------------------------------------ */

describe("duplicate checkouts and subscriptions", () => {
  async function addPlan(tier: string, stripePriceId: string, paypalPlanId: string) {
    const [plan] = await test.db
      .insert(plans)
      .values({
        name: tier,
        tier,
        stripePriceId,
        paypalPlanId,
        priceCents: 9900,
        articleLimit: 60,
        keywordLimit: 100,
        siteLimit: 1,
        monthlyCredits: 0,
      })
      .returning();
    return plan.id;
  }

  it("reuses the open checkout for a repeated request instead of making another", async () => {
    const site = await addSite();
    const first = await createCheckoutSession(planId, site.id);
    const second = await createCheckoutSession(planId, site.id);

    expect(second).toEqual(first);
    expect(stripeMock.sessionsCreate).toHaveBeenCalledTimes(1);
    expect(stripeMock.sessionsExpire).not.toHaveBeenCalled();
    expect(await checkouts()).toHaveLength(1);
  });

  it("makes one Stripe session for simultaneous presses", async () => {
    const site = await addSite();
    const results = await Promise.all(
      Array.from({ length: 5 }, () => createCheckoutSession(planId, site.id)),
    );
    expect(stripeMock.sessionsCreate).toHaveBeenCalledTimes(1);
    expect(results.filter((r) => "url" in r)).not.toHaveLength(0);
    expect(await checkouts()).toHaveLength(1);
  });

  it("passes a stable idempotency key and records the request before calling Stripe", async () => {
    const site = await addSite();
    let recordedBeforeCall: unknown = null;
    stripeMock.sessionsCreate.mockImplementationOnce(async () => {
      recordedBeforeCall = (await checkouts())[0].requestParams;
      return { id: "cs_test_1", url: "https://checkout.stripe.test/cs_test_1", expires_at: null };
    });
    await createCheckoutSession(planId, site.id);

    const [row] = await checkouts();
    expect(stripeMock.sessionsCreate.mock.calls[0][1]).toEqual({ idempotencyKey: `checkout:${row.id}` });
    expect(recordedBeforeCall).toMatchObject({ customer: "cus_test" });
  });

  it("finds the session after a timeout instead of making the customer wait", async () => {
    const site = await addSite();
    stripeMock.sessionsCreate.mockRejectedValueOnce(new Error("ETIMEDOUT"));
    // Stripe did make it: the lookup matches it on our checkout id.
    stripeMock.sessionsList.mockImplementation(async function* () {
      const [row] = await checkouts();
      yield { id: "cs_made", client_reference_id: row.id, url: "https://checkout.stripe.test/cs_made", expires_at: null };
    });

    expect(await createCheckoutSession(planId, site.id)).toEqual({
      url: "https://checkout.stripe.test/cs_made",
    });
    expect((await checkouts())[0]).toMatchObject({ status: "open", stripeSessionId: "cs_made" });
  });

  it("marks a timed-out create failed when Stripe confirms it made nothing", async () => {
    const site = await addSite();
    stripeMock.sessionsCreate.mockRejectedValueOnce(new Error("ETIMEDOUT"));

    expect(await createCheckoutSession(planId, site.id)).toHaveProperty("error");
    expect((await checkouts())[0].status).toBe("failed");
    // Not locked: the next attempt goes through.
    expect(await createCheckoutSession(planId, site.id)).toHaveProperty("url");
  });

  it("expires an abandoned checkout for another plan before opening a new one", async () => {
    const site = await addSite();
    await createCheckoutSession(planId, site.id);
    const other = await addPlan("scale", "price_scale", "P-SCALE");
    stripeMock.sessionsExpire.mockResolvedValueOnce({ status: "expired" });
    stripeMock.sessionsCreate.mockResolvedValueOnce({
      id: "cs_test_2",
      url: "https://checkout.stripe.test/cs_test_2",
      expires_at: null,
    });

    expect(await createCheckoutSession(other, site.id)).toEqual({
      url: "https://checkout.stripe.test/cs_test_2",
    });
    expect(stripeMock.sessionsExpire).toHaveBeenCalledWith("cs_test_1");
    const statuses = (await checkouts()).map((c) => c.status).sort();
    expect(statuses).toEqual(["expired", "open"]);
  });

  it("refuses a second checkout while the first cannot be closed", async () => {
    const site = await addSite();
    await createCheckoutSession(planId, site.id);
    const other = await addPlan("scale", "price_scale", "P-SCALE");
    stripeMock.sessionsExpire.mockRejectedValueOnce(new Error("ECONNRESET"));
    stripeMock.sessionsRetrieve.mockRejectedValueOnce(new Error("ECONNRESET"));

    expect(await createCheckoutSession(other, site.id)).toEqual({
      error: expect.stringMatching(/still open/),
    });
    expect(stripeMock.sessionsCreate).toHaveBeenCalledTimes(1);
  });

  it("refuses a new checkout while a paid one is still being recorded", async () => {
    const site = await addSite();
    await createCheckoutSession(planId, site.id);
    const other = await addPlan("scale", "price_scale", "P-SCALE");
    stripeMock.sessionsExpire.mockRejectedValueOnce(new Error("not open"));
    stripeMock.sessionsRetrieve.mockResolvedValueOnce({ status: "complete", subscription: "sub_paid" });

    expect(await createCheckoutSession(other, site.id)).toEqual({
      error: expect.stringMatching(/still being recorded/),
    });
  });

  it("changes the plan of an existing card subscriber instead of subscribing again", async () => {
    const site = await addSite();
    await test.db.insert(subscriptions).values({
      organizationId: "org_a",
      websiteId: site.id,
      provider: "stripe",
      planId,
      status: "active",
      stripeSubscriptionId: "sub_live",
    });
    const other = await addPlan("scale", "price_scale", "P-SCALE");
    stripeMock.subscriptionsRetrieve.mockResolvedValueOnce({
      id: "sub_live",
      customer: "cus_test",
      status: "active",
      metadata: {},
      discounts: [],
      items: { data: [{ id: "si_1", quantity: 1 }] },
    });
    stripeMock.portalCreate.mockResolvedValueOnce({ url: "https://billing.stripe.test/confirm" });

    expect(await createCheckoutSession(other, site.id)).toEqual({
      url: "https://billing.stripe.test/confirm",
    });
    expect(stripeMock.sessionsCreate).not.toHaveBeenCalled();
    expect(stripeMock.portalCreate.mock.calls[0][0].flow_data).toMatchObject({
      type: "subscription_update_confirm",
      subscription_update_confirm: {
        subscription: "sub_live",
        items: [{ id: "si_1", price: "price_scale" }],
      },
    });
    expect(stripeMock.portalCreate.mock.calls[0][0].flow_data.subscription_update_confirm.discounts).toBeUndefined();
    expect(await checkouts()).toHaveLength(0);
  });

  describe("with a REPGET discount not used yet", () => {
    const onGrow = async () => {
      const site = await addSite();
      await test.db.insert(subscriptions).values({ organizationId: "org_a", websiteId: site.id, planId, status: "trialing", stripeSubscriptionId: "sub_live" });
      stripeMock.subscriptionsRetrieve.mockResolvedValueOnce({
        id: "sub_live",
        customer: "cus_test",
        status: "trialing",
        metadata: { repget_offer: "REPGET" },
        discounts: [{ id: "di_1", source: { coupon: "GROW40" } }],
        items: { data: [{ id: "si_1", quantity: 1 }] },
      });
      return site;
    };
    const scale = () => test.db.insert(plans).values({ name: "Scale", tier: "scale", interval: "month", currency: "eur", priceCents: 34900, stripePriceId: "price_scale_2", articleLimit: 30, keywordLimit: 100, siteLimit: 1, monthlyCredits: 0, catalogVersion: 40 }).returning().then(([row]) => row.id);

    it("the new plan's coupon is in the same Stripe request as the change", async () => {
      const site = await onGrow();
      stripeMock.portalCreate.mockResolvedValueOnce({ url: "https://billing.stripe.test/confirm" });
      expect(await createCheckoutSession(await scale(), site.id)).toEqual({ url: "https://billing.stripe.test/confirm" });
      expect(stripeMock.portalCreate.mock.calls[0][0].flow_data.subscription_update_confirm).toMatchObject({
        items: [{ id: "si_1", price: "price_scale_2" }],
        discounts: [{ coupon: "SCALE40" }],
      });
    });

    it("a coupon Stripe refuses stops the change: no full price, the customer is told, staff are emailed", async () => {
      const site = await onGrow();
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      stripeMock.portalCreate.mockRejectedValueOnce(stripeRefusal("No such coupon: 'SCALE40'"));
      expect(await createCheckoutSession(await scale(), site.id)).toEqual({ error: expect.stringContaining("you have not been charged") });
      expect(mail.sendEmail.mock.calls[0][0].text).toContain("SCALE40");
      log.mockRestore();
    });

    it("to annual: the annual price's yearly coupon, in the same Stripe request (40% off the first year)", async () => {
      const site = await onGrow();
      const annual = await test.db.insert(plans).values({ name: "Grow (Annual)", tier: "grow", interval: "year", currency: "eur", priceCents: 149000, stripePriceId: "price_grow_year", articleLimit: 30, keywordLimit: 100, siteLimit: 1, monthlyCredits: 0, catalogVersion: 41 }).returning().then(([row]) => row.id);
      stripeMock.portalCreate.mockResolvedValueOnce({ url: "https://billing.stripe.test/confirm" });
      expect(await createCheckoutSession(annual, site.id)).toEqual({ url: "https://billing.stripe.test/confirm" });
      expect(stripeMock.portalCreate.mock.calls[0][0].flow_data.subscription_update_confirm).toMatchObject({
        items: [{ id: "si_1", price: "price_grow_year" }],
        discounts: [{ coupon: "GROW40Y" }],
      });
    });

    it("to a price the offer does not cover: refused before Stripe is asked to change anything", async () => {
      const site = await onGrow();
      const older = await test.db.insert(plans).values({ name: "Old Grow", tier: "grow", interval: "month", currency: "eur", priceCents: 9900, stripePriceId: "price_grow_old", articleLimit: 30, keywordLimit: 100, siteLimit: 1, monthlyCredits: 0, catalogVersion: 39 }).returning().then(([row]) => row.id);
      expect(await createCheckoutSession(older, site.id)).toEqual({ error: expect.stringContaining("does not cover") });
      expect(stripeMock.portalCreate).not.toHaveBeenCalled();
    });
  });

  it("says so for the plan the website is already on", async () => {
    const site = await addSite();
    await test.db.insert(subscriptions).values({
      organizationId: "org_a",
      websiteId: site.id,
      planId,
      status: "trialing",
      stripeSubscriptionId: "sub_live",
    });
    expect(await createCheckoutSession(planId, site.id)).toEqual({
      error: expect.stringMatching(/already on/),
    });
  });

  it("revises an existing PayPal subscription instead of creating another", async () => {
    const site = await addSite();
    // A downgrade (an upgrade pays the difference first: lib/paypal/plan-changes.test.ts).
    const higher = await addPlan("scale", "price_scale", "P-SCALE");
    await test.db.insert(subscriptions).values({
      organizationId: "org_a",
      websiteId: site.id,
      provider: "paypal",
      planId: higher,
      status: "active",
      paypalSubscriptionId: "I-LIVE",
    });
    paypalMock.getSubscription.mockResolvedValueOnce({ id: "I-LIVE", status: "ACTIVE", plan_id: "P-SCALE", billing_info: { next_billing_time: "2099-01-01T00:00:00Z" } });
    paypalMock.reviseSubscription.mockResolvedValueOnce({ approveUrl: "https://paypal.test/revise" });

    expect(await createPayPalCheckout(planId, site.id)).toEqual({ url: "https://paypal.test/revise" });
    expect(paypalMock.reviseSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ subscriptionId: "I-LIVE", idempotencyKey: expect.stringMatching(/^plan-change:/) }),
    );
    expect(paypalMock.createSubscription).not.toHaveBeenCalled();
  });

  it("refuses to switch provider while a subscription is live", async () => {
    const site = await addSite();
    await test.db.insert(subscriptions).values({
      organizationId: "org_a",
      websiteId: site.id,
      provider: "paypal",
      planId,
      status: "active",
      paypalSubscriptionId: "I-LIVE",
    });

    expect(await createCheckoutSession(planId, site.id)).toEqual({
      error: expect.stringMatching(/already billed by PayPal/),
    });
    expect(stripeMock.sessionsCreate).not.toHaveBeenCalled();
  });

  it("opens a new checkout for a website whose previous subscription ended", async () => {
    const site = await addSite();
    await test.db.insert(subscriptions).values({
      organizationId: "org_a",
      websiteId: site.id,
      planId,
      status: "canceled",
      stripeSubscriptionId: "sub_old",
    });
    expect(await createCheckoutSession(planId, site.id)).toHaveProperty("url");
  });

  /*
    Review reproduction: a four-hour-old PayPal approval, still pending at
    PayPal, used to be released by age - a card checkout was then allowed,
    and completing both left two live subscriptions for one site.
  */
  const HOURS_4 = 4 * 60 * 60 * 1000;
  const age = (ms: number) =>
    test.db.update(billingCheckouts).set({ createdAt: new Date(Date.now() - ms) });

  it("never lets a card checkout replace a PayPal approval PayPal still reports pending, however old", async () => {
    const site = await addSite();
    await createPayPalCheckout(planId, site.id);
    paypalMock.getSubscription.mockResolvedValue({ id: "I-PENDING", status: "APPROVAL_PENDING" });

    for (const ms of [0, HOURS_4, 30 * 24 * HOURS_4]) {
      await age(ms);
      expect(await createCheckoutSession(planId, site.id)).toEqual({
        error: expect.stringMatching(/PayPal approval/),
      });
    }
    expect(stripeMock.sessionsCreate).not.toHaveBeenCalled();
    expect((await checkouts()).map((c) => c.status)).toEqual(["open"]);

    // ...and still blocks deleting the site.
    actAsOwner(site);
    const result = await deleteWebsite(site.id);
    expect(!result.ok && result.error).toMatch(/waiting for approval/);
  });

  it("does not replace it with a PayPal checkout for another plan either", async () => {
    const site = await addSite();
    await createPayPalCheckout(planId, site.id);
    paypalMock.getSubscription.mockResolvedValue({ id: "I-PENDING", status: "APPROVAL_PENDING" });
    const [other] = await test.db
      .insert(plans)
      .values({ name: "Scale", tier: "scale", stripePriceId: "price_scale", paypalPlanId: "P-SCALE", priceCents: 9900, articleLimit: 60, keywordLimit: 100, siteLimit: 1, monthlyCredits: 0 })
      .returning();
    await age(HOURS_4);

    expect(await createPayPalCheckout(other.id, site.id)).toEqual({ error: expect.stringMatching(/PayPal approval/) });
    expect(paypalMock.createSubscription).toHaveBeenCalledTimes(1);
  });

  it("still reuses the same pending approval after hours", async () => {
    const site = await addSite();
    await createPayPalCheckout(planId, site.id);
    paypalMock.getSubscription.mockResolvedValue({ id: "I-PENDING", status: "APPROVAL_PENDING" });
    await age(HOURS_4);

    expect(await createPayPalCheckout(planId, site.id)).toEqual({ url: "https://paypal.test/approve" });
    expect(paypalMock.createSubscription).toHaveBeenCalledTimes(1);
  });

  it("does not reuse an approval PayPal could not be asked about just now", async () => {
    const site = await addSite();
    await createPayPalCheckout(planId, site.id);
    paypalMock.getSubscription.mockRejectedValue(new Error("ECONNRESET"));

    expect(await createPayPalCheckout(planId, site.id)).toHaveProperty("error");
    expect(paypalMock.createSubscription).toHaveBeenCalledTimes(1);
  });

  it("allows a replacement once PayPal confirms the approval expired", async () => {
    const site = await addSite();
    await createPayPalCheckout(planId, site.id);
    paypalMock.getSubscription.mockResolvedValue({ id: "I-PENDING", status: "EXPIRED" });

    expect(await createCheckoutSession(planId, site.id)).toHaveProperty("url");
    const byProvider = Object.fromEntries((await checkouts()).map((c) => [c.provider, c.status]));
    expect(byProvider).toEqual({ paypal: "expired", stripe: "open" });
  });

  it("refuses a replacement while a PayPal approval PayPal says is live awaits its webhook", async () => {
    const site = await addSite();
    await createPayPalCheckout(planId, site.id);
    paypalMock.getSubscription.mockResolvedValue({ id: "I-PENDING", status: "ACTIVE" });

    expect(await createCheckoutSession(planId, site.id)).toEqual({ error: expect.stringMatching(/still being recorded/) });
    expect(stripeMock.sessionsCreate).not.toHaveBeenCalled();
  });

  it.each([
    ["a PayPal create whose answer was lost", { provider: "paypal" }],
    ["a Stripe create whose answer was lost, with nothing to look it up by", { provider: "stripe" }],
    ["an unresolved row", { provider: "paypal", status: "unresolved" }],
    ["an abandoned row", { provider: "stripe", status: "abandoned" }],
  ])("blocks replacement checkouts on both providers for %s", async (_label, row) => {
    const site = await addSite();
    await test.db.insert(billingCheckouts).values({
      organizationId: "org_a",
      websiteId: site.id,
      planId,
      status: "open",
      ...row,
      createdAt: new Date(Date.now() - 30 * 24 * HOURS_4),
    });

    expect(await createCheckoutSession(planId, site.id)).toHaveProperty("error");
    expect(await createPayPalCheckout(planId, site.id)).toHaveProperty("error");
    expect(stripeMock.sessionsCreate).not.toHaveBeenCalled();
    expect(paypalMock.createSubscription).not.toHaveBeenCalled();
  });

  it("releases a lost Stripe create once Stripe confirms no session was made", async () => {
    const site = await addSite();
    await test.db.insert(billingCheckouts).values({
      organizationId: "org_a",
      websiteId: site.id,
      provider: "stripe",
      planId,
      status: "open",
      requestParams: { customer: "cus_test" },
      createdAt: new Date(Date.now() - CHECKOUT_IN_FLIGHT_MS - 60_000),
    });

    expect(await createCheckoutSession(planId, site.id)).toHaveProperty("url");
    expect((await checkouts()).map((c) => c.status).sort()).toEqual(["failed", "open"]);
  });

  it("keeps reporting an existing duplicate without cancelling anything", async () => {
    const site = await addSite();
    await test.db.insert(subscriptions).values([
      { organizationId: "org_a", websiteId: site.id, status: "active", stripeSubscriptionId: "sub_card" },
      { organizationId: "org_a", websiteId: null, claimedWebsiteId: site.id, provider: "paypal", status: "active", paypalSubscriptionId: "I-OLD" },
    ]);
    const rows = await runReconciliation(test.db, "duplicateLiveSubscriptions");
    expect(rows.find((r) => r.website_id === site.id)).toMatchObject({ live_subscriptions: 2 });
    expect(stripeMock.sessionsExpire).not.toHaveBeenCalled();
  });

  it("reuses a pending PayPal approval for the same plan", async () => {
    const site = await addSite();
    await createPayPalCheckout(planId, site.id);
    paypalMock.getSubscription.mockResolvedValue({ id: "I-PENDING", status: "APPROVAL_PENDING" });

    expect(await createPayPalCheckout(planId, site.id)).toEqual({ url: "https://paypal.test/approve" });
    expect(paypalMock.createSubscription).toHaveBeenCalledTimes(1);
  });
});

describe("trial eligibility", () => {
  const trialOf = (call: number) =>
    stripeMock.sessionsCreate.mock.calls[call][0].subscription_data.trial_period_days;

  it("offers the free articles' trial to a workspace that has never subscribed", async () => {
    const site = await addSite();
    await createCheckoutSession(planId, site.id);
    expect(trialOf(0)).toBe(FREE_ARTICLES_DAYS);
    expect((await checkouts())[0].trialDays).toBe(FREE_ARTICLES_DAYS);
  });

  it("refuses it to an unconfirmed address, before anything is recorded or sent to Stripe", async () => {
    state.emailVerified = false;
    const site = await addSite();
    expect(await createCheckoutSession(planId, site.id)).toEqual({ error: CONFIRM_EMAIL_FIRST });
    expect(stripeMock.sessionsCreate).not.toHaveBeenCalled();
    expect(await checkouts()).toHaveLength(0);
  });

  it("lets an unconfirmed address pay when there are no free articles to give", async () => {
    state.emailVerified = false;
    await test.db.insert(subscriptions).values({
      organizationId: "org_a",
      websiteId: null,
      planId,
      status: "canceled",
      stripeSubscriptionId: "sub_before",
    });
    const site = await addSite();
    expect(await createCheckoutSession(planId, site.id)).toEqual({
      url: "https://checkout.stripe.test/cs_test_1",
    });
    expect(trialOf(0)).toBeUndefined();
  });

  it("does not offer it again after any earlier subscription, even a cancelled one", async () => {
    const old = await addSite("org_a", "old.test");
    await test.db.insert(subscriptions).values({
      organizationId: "org_a",
      websiteId: null,
      claimedWebsiteId: old.id,
      planId,
      status: "canceled",
      stripeSubscriptionId: "sub_history",
    });
    const site = await addSite();
    await createCheckoutSession(planId, site.id);
    expect(trialOf(0)).toBeUndefined();
  });

  it("does not offer it to a second website while the first checkout's trial is outstanding", async () => {
    const one = await addSite();
    const two = await addSite("org_a", "two.test");
    stripeMock.sessionsCreate
      .mockResolvedValueOnce({ id: "cs_1", url: "https://s/1", expires_at: null })
      .mockResolvedValueOnce({ id: "cs_2", url: "https://s/2", expires_at: null });

    await createCheckoutSession(planId, one.id);
    await createCheckoutSession(planId, two.id);
    expect([trialOf(0), trialOf(1)]).toEqual([FREE_ARTICLES_DAYS, undefined]);
  });

  it("never offers one through PayPal", async () => {
    const site = await addSite();
    await createPayPalCheckout(planId, site.id);
    expect((await checkouts())[0].trialDays).toBe(0);
  });
});

/*
  The win-back offer (lib/billing/winback-offer.ts): 20% off the first payment
  for an account whose owner was SENT the win-back email, chosen by the server,
  once per account, never stacked - REPGET, while the account can still have
  it, wins instead.
*/
describe("the win-back offer, applied automatically", () => {
  const row = { articleLimit: 30, keywordLimit: 100, siteLimit: 1, monthlyCredits: 0 };
  let version = 100;
  const params = () => stripeMock.sessionsCreate.mock.calls.at(-1)![0];
  const growPlan = async (fields: Partial<typeof plans.$inferInsert> = {}) =>
    (await test.db.insert(plans).values({ ...row, name: "Grow", tier: "grow", interval: "month", currency: "eur", priceCents: 14900, stripePriceId: "price_grow_w", catalogVersion: (version += 1), ...fields }).returning())[0].id;
  /** An earlier subscription that ended: no free period again, as for anyone who left. */
  const left = async () => {
    const site = await addSite("org_a", "left.test");
    await test.db.insert(subscriptions).values({ organizationId: "org_a", websiteId: site.id, planId, status: "canceled", provider: "stripe", stripeSubscriptionId: "sub_left" });
  };
  const usedOffer = async (offer: string, plan: string) => {
    const earlier = await addSite("org_a", `used-${offer.toLowerCase()}.test`);
    await test.db.insert(billingCheckouts).values({ organizationId: "org_a", websiteId: earlier.id, provider: "stripe", planId: plan, status: "completed", trialDays: 0, stripeSessionId: `cs_${offer}`, requestParams: { offer }, createdAt: new Date(Date.now() - 3_600_000) });
  };

  beforeEach(async () => {
    process.env.WINBACK_OFFER_ENABLED = "1";
    await test.db.insert(user).values({ id: "user_w", name: "Ada", email: "ada@example.test", emailVerified: true, createdAt: new Date(), updatedAt: new Date() });
    await test.db.insert(member).values({ id: "m_w", organizationId: "org_a", userId: "user_w", role: "owner", createdAt: new Date() });
    await test.db.insert(lifecycleEmails).values({ scope: "user:user_w", kind: "winback", dedupeKey: "winback", userId: "user_w", status: "sent", updatedAt: new Date() });
    await left();
  });
  afterEach(async () => {
    delete process.env.WINBACK_OFFER_ENABLED;
    delete process.env.REPGET_OFFER_ENABLED;
    await test.client.exec(`delete from lifecycle_emails; delete from member; delete from "user";`);
  });

  it("sent the email, REPGET off: WINBACK20 on the checkout, no code box, remembered as WINBACK", async () => {
    const site = await addSite();
    expect(await createCheckoutSession(await growPlan(), site.id)).toEqual({ url: expect.any(String) });
    expect(params().discounts).toEqual([{ coupon: "WINBACK20" }]);
    expect(params().allow_promotion_codes).toBeUndefined();
    expect(params().subscription_data.metadata.repget_offer).toBeUndefined();
    const open = (await checkouts()).find((c) => c.websiteId === site.id)!;
    expect(open.requestParams).toMatchObject({ offer: "WINBACK" });
  });

  it("still eligible for REPGET: REPGET wins (bigger) and the win-back stays unused", async () => {
    process.env.REPGET_OFFER_ENABLED = "1";
    const site = await addSite();
    await createCheckoutSession(await growPlan(), site.id);
    expect(params().discounts).toEqual([{ coupon: "GROW40" }]);
    expect((await checkouts()).find((c) => c.websiteId === site.id)!.requestParams).toMatchObject({ offer: "REPGET" });
  });

  it("REPGET used: the win-back instead", async () => {
    process.env.REPGET_OFFER_ENABLED = "1";
    const plan = await growPlan();
    await usedOffer("REPGET", plan);
    const site = await addSite();
    await createCheckoutSession(plan, site.id);
    expect(params().discounts).toEqual([{ coupon: "WINBACK20" }]);
  });

  it("never sent the email (or switched off): nothing, and Stripe's code box for a partner code", async () => {
    await test.client.exec(`delete from lifecycle_emails;`);
    const site = await addSite();
    await createCheckoutSession(await growPlan(), site.id);
    expect(params().discounts).toBeUndefined();
    expect(params().allow_promotion_codes).toBe(true);
    await test.db.insert(lifecycleEmails).values({ scope: "user:user_w", kind: "winback", dedupeKey: "winback", userId: "user_w", status: "sent", updatedAt: new Date() });
    delete process.env.WINBACK_OFFER_ENABLED;
    const other = await addSite("org_a", "other-a.test");
    await createCheckoutSession(await growPlan(), other.id);
    expect(params().discounts).toBeUndefined();
  });

  it("an email skipped (unsubscribed) is no offer", async () => {
    await test.client.exec(`update lifecycle_emails set status = 'skipped';`);
    const site = await addSite();
    await createCheckoutSession(await growPlan(), site.id);
    expect(params().discounts).toBeUndefined();
  });

  it("once per account: used, the next checkout goes at full price", async () => {
    const plan = await growPlan();
    await usedOffer("WINBACK", plan);
    const site = await addSite();
    await createCheckoutSession(plan, site.id);
    expect(params().discounts).toBeUndefined();
    expect(params().allow_promotion_codes).toBe(true);
  });

  it("never on the Grow + Visibility bundle", async () => {
    const site = await addSite();
    await createCheckoutSession(await growPlan({ name: "Grow + Visibility", tier: "grow_visibility", priceCents: 9900, stripePriceId: "price_bundle_w" }), site.id);
    expect(params().discounts).toBeUndefined();
  });

  it("yearly too: the same coupon, 20% off the first year", async () => {
    const site = await addSite();
    await createCheckoutSession(await growPlan({ interval: "year", priceCents: 149000, stripePriceId: "price_grow_wy" }), site.id);
    expect(params().discounts).toEqual([{ coupon: "WINBACK20" }]);
  });

  it("a coupon Stripe refuses starts nothing, and says so without naming REPGET", async () => {
    const site = await addSite();
    stripeMock.sessionsCreate.mockRejectedValueOnce(stripeRefusal("No such coupon: 'WINBACK20'"));
    const answer = await createCheckoutSession(await growPlan(), site.id);
    expect(answer).toEqual({ error: expect.stringContaining("welcome-back discount") });
    expect((await checkouts()).find((c) => c.websiteId === site.id)!.status).toBe("failed");
  });

  it("through PayPal: the offer plan, its first payment 80% of the price", async () => {
    const site = await addSite();
    const plan = await growPlan({ paypalPlanId: "P-GROW", paypalTrialPlanId: "P-GROW-FREE", paypalOfferPlanId: "P-GROW-OFFER", paypalTrialOfferPlanId: "P-GROW-FREE-OFFER" });
    expect(await createPayPalCheckout(plan, site.id)).toEqual({ url: expect.any(String) });
    // 149.00 less 29.80.
    expect(paypalMock.createSubscription.mock.calls.at(-1)![0]).toMatchObject({ planId: "P-GROW-OFFER", intro: { sequence: 1, priceCents: 11920, currency: "eur" } });
    const open = (await checkouts()).find((c) => c.websiteId === site.id)!;
    expect(open.requestParams).toMatchObject({ plan: "P-GROW-OFFER", offer: "WINBACK", introCents: 11920 });
  });

  it("through PayPal without offer plans: refused, pay by card", async () => {
    const site = await addSite();
    const plan = await growPlan({ paypalPlanId: "P-GROW" });
    expect(await createPayPalCheckout(plan, site.id)).toEqual({ error: expect.stringContaining("welcome-back discount is not available with PayPal") });
  });
});
