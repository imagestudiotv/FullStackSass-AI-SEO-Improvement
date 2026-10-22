import { eq } from "drizzle-orm";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { billingCheckouts, organization, plans, subscriptions, websites } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";

/**
 * "Pay with PayPal" with the free articles (client, 2026-10-22): a
 * first-time workspace with a confirmed address subscribes to the plan's
 * free-articles PayPal plan; one without a confirmed address is asked to
 * confirm it first, as at card checkout; anyone else gets the plan itself.
 * PayPal is stubbed.
 */

const state = vi.hoisted(() => ({ db: null as unknown, verified: true }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/tenant", () => ({ requireOrg: vi.fn(async () => ({ orgId: "org_a", userId: "user_1", role: "owner" })) }));
vi.mock("@/lib/auth-guard", () => ({
  requireSession: vi.fn(async () => ({ user: { id: "user_1", email: "owner@acme.test", emailVerified: state.verified } })),
}));
vi.mock("@/lib/conversions/conversions", () => ({ rememberPayer: vi.fn() }));
const paypal = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@/lib/paypal/subscriptions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/paypal/subscriptions")>()),
  createSubscription: paypal.create,
}));

import { CONFIRM_EMAIL_FIRST, FREE_ARTICLES_DAYS } from "@/lib/plans/features";

import { createPayPalCheckout } from "./actions";

let test: TestDb;
let planId = "";
let siteId = "";

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

beforeEach(async () => {
  vi.stubEnv("PAYPAL_CLIENT_ID", "client-placeholder");
  vi.stubEnv("PAYPAL_CLIENT_SECRET", "secret-placeholder");
  vi.stubEnv("PAYPAL_WEBHOOK_ID", "WH-PLACEHOLDER");
  vi.stubEnv("PAYPAL_ENV", "sandbox");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.repget.com");
  state.verified = true;
  paypal.create.mockReset();
  paypal.create.mockImplementation(async () => ({ subscriptionId: "I-NEW", approveUrl: "https://paypal.test/approve/I-NEW" }));
  await test.client.exec("delete from subscriptions; delete from billing_checkouts; delete from websites; delete from organization; delete from plans;");
  await test.db.insert(organization).values({ id: "org_a", name: "Acme", slug: "acme", createdAt: new Date() });
  const [plan] = await test.db
    .insert(plans)
    .values({ name: "Grow", tier: "grow", paypalPlanId: "P-GROW", paypalTrialPlanId: "P-GROW-FREE", priceCents: 9900, articleLimit: 30, keywordLimit: 100, siteLimit: 1, monthlyCredits: 0 })
    .returning();
  planId = plan.id;
  const [site] = await test.db.insert(websites).values({ organizationId: "org_a", url: "https://acme.test", domain: "acme.test" }).returning();
  siteId = site.id;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const checkout = async () => (await test.db.select().from(billingCheckouts).where(eq(billingCheckouts.websiteId, siteId)))[0];

describe("paying with PayPal, with the free articles", () => {
  it("subscribes a first-time workspace to the free-articles plan, and records the free days", async () => {
    expect(await createPayPalCheckout(planId, siteId)).toEqual({ url: "https://paypal.test/approve/I-NEW" });
    expect(paypal.create).toHaveBeenCalledWith(expect.objectContaining({ planId: "P-GROW-FREE" }));
    expect(await checkout()).toMatchObject({ provider: "paypal", trialDays: FREE_ARTICLES_DAYS, providerSubscriptionId: "I-NEW" });
  });

  it("asks for a confirmed address first, as card checkout does - nothing is sent to PayPal", async () => {
    state.verified = false;
    expect(await createPayPalCheckout(planId, siteId)).toEqual({ error: CONFIRM_EMAIL_FIRST });
    expect(paypal.create).not.toHaveBeenCalled();
  });

  it("subscribes a workspace that has had its free articles to the plan itself, address or not", async () => {
    state.verified = false;
    await test.db.insert(subscriptions).values({ organizationId: "org_a", websiteId: null, provider: "stripe", stripeSubscriptionId: "sub_old", status: "canceled", planId });
    expect(await createPayPalCheckout(planId, siteId)).toEqual({ url: "https://paypal.test/approve/I-NEW" });
    expect(paypal.create).toHaveBeenCalledWith(expect.objectContaining({ planId: "P-GROW" }));
    expect(await checkout()).toMatchObject({ trialDays: 0 });
  });

  it("charges at once for a plan without its free-articles PayPal plan, and needs no confirmed address", async () => {
    state.verified = false;
    await test.db.update(plans).set({ paypalTrialPlanId: null }).where(eq(plans.id, planId));
    expect(await createPayPalCheckout(planId, siteId)).toEqual({ url: "https://paypal.test/approve/I-NEW" });
    expect(paypal.create).toHaveBeenCalledWith(expect.objectContaining({ planId: "P-GROW" }));
  });
});
