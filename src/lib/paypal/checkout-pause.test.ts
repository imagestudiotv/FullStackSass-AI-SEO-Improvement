import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { organization, plans, websites } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";

/**
 * PAYPAL_CHECKOUT=off (review L9, 2026-10-20): the owner can pause new PayPal
 * checkouts - the button and the checkout itself - without touching the
 * credentials, so the webhook keeps serving the customers already paying
 * through PayPal. PayPal itself is stubbed: no call may be made while paused.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/tenant", () => ({ requireOrg: vi.fn(async () => ({ orgId: "org_a", userId: "user_1", role: "owner" })) }));
const paypal = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@/lib/paypal/subscriptions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/paypal/subscriptions")>()),
  createSubscription: paypal.create,
}));

import { createPayPalCheckout, isPayPalAvailable } from "./actions";
import { isPayPalConfigured } from "./client";

let test: TestDb;
let planId = "";
let siteId = "";

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
  await test.db.insert(organization).values({ id: "org_a", name: "Acme", slug: "acme", createdAt: new Date() });
  const [plan] = await test.db
    .insert(plans)
    .values({ name: "Grow", tier: "grow", paypalPlanId: "P-OURS", priceCents: 9900, articleLimit: 30, keywordLimit: 100, siteLimit: 1, monthlyCredits: 0 })
    .returning();
  planId = plan.id;
  const [site] = await test.db.insert(websites).values({ organizationId: "org_a", url: "https://acme.test", domain: "acme.test" }).returning();
  siteId = site.id;
});

beforeEach(() => {
  vi.stubEnv("PAYPAL_CLIENT_ID", "client-placeholder");
  vi.stubEnv("PAYPAL_CLIENT_SECRET", "secret-placeholder");
  vi.stubEnv("PAYPAL_WEBHOOK_ID", "WH-PLACEHOLDER");
  vi.stubEnv("PAYPAL_ENV", "sandbox");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.repget.com");
  paypal.create.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("pausing new PayPal checkouts", () => {
  it("hides the button and refuses a checkout, without asking PayPal anything", async () => {
    vi.stubEnv("PAYPAL_CHECKOUT", "off");
    expect(await isPayPalAvailable()).toBe(false);
    expect(await createPayPalCheckout(planId, siteId)).toEqual({ error: "Paying with PayPal is paused for now. Please pay by card, or try again later." });
    expect(paypal.create).not.toHaveBeenCalled();
    // Still configured: the webhook and the return from PayPal keep working for existing subscribers.
    expect(isPayPalConfigured()).toBe(true);
  });

  it("offers PayPal again once it is not off", async () => {
    vi.stubEnv("PAYPAL_CHECKOUT", "");
    expect(await isPayPalAvailable()).toBe(true);
  });
});
