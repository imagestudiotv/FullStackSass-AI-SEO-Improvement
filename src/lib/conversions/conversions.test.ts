import { eq } from "drizzle-orm";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { account, billingCheckouts, organization, plans, user } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";

import { checkoutVisitor, conversionId, pendingConversions, rememberCheckoutVisitor, reportFirstPayment } from "./conversions";
import { gaClientId, gaSessionId } from "./ga-identity";

/**
 * The three conversions for Google Ads (client, 2026-10-09): which sign-ups
 * and free-articles starts a signed-in page reports, the payer's GA identity
 * kept at checkout (only after Accept), and the first real payment reported
 * to GA4 once, from the webhook. Real rows; Google replaced at its boundary.
 */

let test: TestDb;
let planId: string;
const NOW = new Date("2026-10-10T12:00:00Z");
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000);

beforeAll(async () => {
  test = await createTestDb();
  await test.db.insert(organization).values([{ id: "org_a", name: "Acme", slug: "acme", createdAt: NOW }]);
  await test.db.insert(user).values([
    { id: "u_new", name: "N", email: "new@example.com", createdAt: minutesAgo(10), updatedAt: minutesAgo(10) },
    { id: "u_old", name: "O", email: "old@example.com", createdAt: minutesAgo(61), updatedAt: minutesAgo(61) },
  ]);
  await test.db.insert(account).values([
    { id: "a1", accountId: "g-1", providerId: "google", issuer: "google", userId: "u_new", createdAt: minutesAgo(10), updatedAt: minutesAgo(10) },
    { id: "a2", accountId: "u_old", providerId: "credential", issuer: "credential", userId: "u_old", createdAt: minutesAgo(61), updatedAt: minutesAgo(61) },
  ]);
  const [plan] = await test.db
    .insert(plans)
    .values({ name: "Growth", tier: "growth", stripePriceId: "price_growth", priceCents: 4900, articleLimit: 30, keywordLimit: 100, siteLimit: 1, monthlyCredits: 0 })
    .returning();
  planId = plan.id;
});

beforeEach(async () => {
  vi.stubEnv("NEXT_PUBLIC_GA4_MEASUREMENT_ID", "G-ABC123XYZ");
  vi.stubEnv("NEXT_PUBLIC_GTM_ID", "");
  vi.stubEnv("GA4_API_SECRET", "secret_ABCDEFGH");
  await test.db.delete(billingCheckouts);
});
afterEach(() => {
  vi.unstubAllEnvs();
});

async function checkout(values: Partial<typeof billingCheckouts.$inferInsert>) {
  const [row] = await test.db
    .insert(billingCheckouts)
    .values({ organizationId: "org_a", provider: "stripe", planId, status: "completed", trialDays: 30, updatedAt: minutesAgo(5), ...values })
    .returning();
  return row;
}

describe("GA's cookies", () => {
  it("reads the client id and both session cookie formats", () => {
    expect(gaClientId("GA1.1.1234567890.1700000000")).toBe("1234567890.1700000000");
    expect(gaClientId("GA1.2.99.88")).toBe("99.88");
    expect(gaClientId("nonsense")).toBeNull();
    expect(gaClientId("GA1.1.abc.def")).toBeNull();
    expect(gaClientId(undefined)).toBeNull();
    expect(gaSessionId("GS1.1.1700000000.3.1.1700000100.0.0.0")).toBe("1700000000");
    expect(gaSessionId("GS2.1.s1700000000$o3$g1$t1700000100$j0$l0$h0")).toBe("1700000000");
    expect(gaSessionId("GS2.1.x1$o3")).toBeNull();
  });
});

describe("pendingConversions", () => {
  const who = (userId: string) => ({ userId, userCreatedAt: userId === "u_new" ? minutesAgo(10) : minutesAgo(61), organizationId: "org_a" });

  it("reports a sign-up in the hour after it, with how they signed up", async () => {
    expect(await pendingConversions(test.db, who("u_new"), NOW)).toEqual([
      { id: conversionId("sign_up", "u_new"), name: "sign_up", params: { method: "google" } },
    ]);
    expect(await pendingConversions(test.db, who("u_old"), NOW)).toEqual([]);
  });

  it("reports the start of free articles in the hour after the checkout completed, and nothing else", async () => {
    const trial = await checkout({});
    await checkout({ trialDays: 0 }); // paid at once: the server reports the purchase
    await checkout({ status: "open" });
    await checkout({ updatedAt: minutesAgo(90) });
    expect(await pendingConversions(test.db, who("u_old"), NOW)).toEqual([
      { id: conversionId("start_trial", trial.id), name: "start_trial", params: { plan: "Growth" } },
    ]);
  });

  it("asks the database nothing when the deployment has no Google tag", async () => {
    vi.stubEnv("NEXT_PUBLIC_GA4_MEASUREMENT_ID", "");
    await checkout({});
    expect(await pendingConversions(test.db, who("u_new"), NOW)).toEqual([]);
  });

  it("gives Google opaque ids, never ours", () => {
    const id = conversionId("sign_up", "u_new");
    expect(id).toMatch(/^[0-9a-f]{32}$/);
    expect(id).not.toContain("u_new");
  });
});

describe("the payer's GA identity", () => {
  const jar = (cookies: Record<string, string>) => (name: string) => cookies[name];

  it("is read only after Accept, and only when GA has identified the browser", () => {
    const ga = { _ga: "GA1.1.111.222", _ga_ABC123XYZ: "GS2.1.s1700000000$o1" };
    expect(checkoutVisitor(jar({ ...ga, repget_consent: "2.granted" }), NOW)).toEqual({
      clientId: "111.222",
      sessionId: "1700000000",
      capturedAt: NOW.toISOString(),
    });
    expect(checkoutVisitor(jar({ ...ga, repget_consent: "2.denied" }), NOW)).toBeNull();
    expect(checkoutVisitor(jar({ ...ga, repget_consent: "1.granted" }), NOW)).toBeNull();
    expect(checkoutVisitor(jar(ga), NOW)).toBeNull();
    expect(checkoutVisitor(jar({ repget_consent: "2.granted" }), NOW)).toBeNull();
  });

  it("is kept on the checkout without touching its date", async () => {
    const row = await checkout({ status: "open" });
    await rememberCheckoutVisitor(test.db, row.id, { clientId: "111.222", sessionId: null, capturedAt: NOW.toISOString() });
    const [after] = await test.db.select().from(billingCheckouts).where(eq(billingCheckouts.id, row.id));
    expect(after.analytics).toEqual({ clientId: "111.222", sessionId: null, capturedAt: NOW.toISOString() });
    expect(after.updatedAt).toEqual(row.updatedAt);
  });
});

describe("reportFirstPayment", () => {
  const PAYMENT = {
    provider: "stripe" as const,
    providerSubscriptionId: "sub_1",
    externalId: "in_1",
    amountCents: 4900,
    currency: "eur",
    paidAt: minutesAgo(1),
  };

  async function paying(capturedMinutesAgo = 5) {
    return checkout({
      providerSubscriptionId: "sub_1",
      analytics: { clientId: "111.222", sessionId: "1700000000", capturedAt: minutesAgo(capturedMinutesAgo).toISOString() },
    });
  }

  it("sends the first payment for money as a purchase, once", async () => {
    const row = await paying();
    const send = vi.fn(async () => new Response(null, { status: 204 }));
    expect(await reportFirstPayment(test.db, PAYMENT, send, NOW)).toBe("sent");

    const [url, init] = send.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://www.google-analytics.com/mp/collect?measurement_id=G-ABC123XYZ&api_secret=secret_ABCDEFGH");
    expect(JSON.parse(init.body as string)).toEqual({
      client_id: "111.222",
      timestamp_micros: PAYMENT.paidAt.getTime() * 1000,
      consent: { ad_user_data: "GRANTED", ad_personalization: "GRANTED" },
      events: [
        {
          name: "purchase",
          params: {
            transaction_id: conversionId("purchase", "stripe:in_1"),
            value: 49,
            currency: "EUR",
            payment_type: "stripe",
            session_id: "1700000000",
            engagement_time_msec: 1,
            items: [{ item_id: planId, item_name: "Growth", price: 49, quantity: 1 }],
          },
        },
      ],
    });

    // A replayed webhook, or next month's renewal: nothing more.
    expect(await reportFirstPayment(test.db, PAYMENT, send, NOW)).toBe("skipped");
    expect(await reportFirstPayment(test.db, { ...PAYMENT, externalId: "in_2" }, send, NOW)).toBe("skipped");
    expect(send).toHaveBeenCalledTimes(1);
    const [after] = await test.db.select().from(billingCheckouts).where(eq(billingCheckouts.id, row.id));
    expect(after.analytics).toMatchObject({ purchaseSentAt: NOW.toISOString() });
    expect(after.updatedAt).toEqual(row.updatedAt);
  });

  it("after the free articles, leaves out the visit they started paying in", async () => {
    await paying(30 * 24 * 60);
    const send = vi.fn(async () => new Response(null, { status: 204 }));
    await reportFirstPayment(test.db, PAYMENT, send, NOW);
    const body = JSON.parse((send.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.events[0].params.session_id).toBeUndefined();
    expect(body.client_id).toBe("111.222");
  });

  it("sends nothing for a free period, without the secret, or for a payer who did not accept", async () => {
    await paying();
    const send = vi.fn(async () => new Response(null, { status: 204 }));
    expect(await reportFirstPayment(test.db, { ...PAYMENT, amountCents: 0 }, send, NOW)).toBe("skipped");
    vi.stubEnv("GA4_API_SECRET", "");
    expect(await reportFirstPayment(test.db, PAYMENT, send, NOW)).toBe("skipped");
    vi.stubEnv("GA4_API_SECRET", "secret_ABCDEFGH");
    expect(await reportFirstPayment(test.db, { ...PAYMENT, providerSubscriptionId: "sub_other" }, send, NOW)).toBe("skipped");
    expect(await reportFirstPayment(test.db, { ...PAYMENT, provider: "paypal" }, send, NOW)).toBe("skipped");
    expect(send).not.toHaveBeenCalled();
  });

  it("logs a failure instead of failing the webhook", async () => {
    await paying();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await reportFirstPayment(test.db, PAYMENT, async () => new Response("no", { status: 500 }), NOW)).toBe("failed");
    await checkout({ providerSubscriptionId: "sub_2", analytics: { clientId: "1.2", sessionId: null, capturedAt: NOW.toISOString() } });
    const thrown = async () => {
      throw new Error("network");
    };
    expect(await reportFirstPayment(test.db, { ...PAYMENT, providerSubscriptionId: "sub_2" }, thrown, NOW)).toBe("failed");
    log.mockRestore();
  });
});
