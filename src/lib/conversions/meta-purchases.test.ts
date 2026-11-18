import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { POST as withdraw } from "@/app/api/analytics/consent/route";
import { billingCheckouts, metaPurchases, organization, paidAcquisitions, payments, plans } from "@/lib/db/schema";
import { applyMigration, createTestDb, type TestDb } from "@/test/db";

import { ANALYTICS_CONSENT_COOKIE, conversionId } from "./config";
import { metaHash } from "./meta-capi";
import { deliverMetaPurchases, recoverMetaPurchases, reportMetaPurchase } from "./meta-purchases";
import { reportFirstPayment } from "./paid-acquisitions";

/**
 * Meta's Purchase (client's guide, 2026-11-18): the first subscription
 * payment, once, from the webhooks, with the identity the payer had at
 * checkout - only if they accepted - queued and retried on its own.
 * Real rows (PGlite); Meta replaced at its boundary.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }) }));

const NOW = new Date("2026-11-18T12:00:00Z");
const KEY = "a".repeat(32);
const OTHER_KEY = "b".repeat(32);
const PIXEL = "1063151092935473";
const TOKEN = "EAAtesttoken1234567890abcdef";
const META = {
  fbp: "fb.1.1763460000000.1234567890",
  fbc: "fb.1.1763460000000.IwAR0abc_DEF-123",
  ip: "203.0.113.7",
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
  em: metaHash("Buyer@Example.com "),
  externalId: metaHash("user_1"),
};
let test: TestDb;
let planId: string;
let sequence = 0;
const later = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000);
const call = (send: ReturnType<typeof vi.fn>, n = 0) => ({ url: send.mock.calls[n][0] as string, body: JSON.parse(send.mock.calls[n][1].body) });
const ok = () => vi.fn(async () => new Response(JSON.stringify({ events_received: 1 }), { status: 200 }));

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
  await test.db.insert(organization).values([{ id: "org_a", name: "Acme", slug: "acme", createdAt: NOW }, { id: "org_b", name: "Other", slug: "other", createdAt: NOW }]);
  const [plan] = await test.db.insert(plans).values({ name: "Grow", tier: "grow", priceCents: 14900, articleLimit: 30, keywordLimit: 100, siteLimit: 1, monthlyCredits: 0 }).returning();
  planId = plan.id;
});
beforeEach(async () => {
  vi.stubEnv("NEXT_PUBLIC_META_PIXEL_ID", PIXEL);
  vi.stubEnv("META_CAPI_TOKEN", TOKEN);
  vi.stubEnv("META_TEST_EVENT_CODE", "");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.repget.com");
  vi.stubEnv("NEXT_PUBLIC_GA4_MEASUREMENT_ID", "");
  vi.stubEnv("GA4_API_SECRET", "");
  vi.spyOn(console, "error").mockImplementation(() => {});
  await test.db.delete(metaPurchases);
  await test.db.delete(paidAcquisitions);
  await test.db.delete(payments);
  await test.db.delete(billingCheckouts);
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
afterAll(async () => { await test.client.close(); });

async function paid(options: { provider?: "stripe" | "paypal"; org?: string; key?: string | null; meta?: object | null; occurredAt?: Date; status?: string; amount?: number; ga?: boolean } = {}) {
  const provider = options.provider ?? "stripe";
  const org = options.org ?? "org_a";
  const id = ++sequence;
  const sub = `sub_${id}`;
  const analytics = options.key === null ? null : {
    ...(options.ga ? { clientId: "111.222", sessionId: null } : {}),
    capturedAt: later(-5).toISOString(), consentKey: options.key ?? KEY,
    ...(options.meta === null ? {} : { meta: options.meta ?? META }),
  };
  const [checkout] = await test.db.insert(billingCheckouts).values({
    organizationId: org, provider, providerSubscriptionId: sub, planId, status: "completed", trialDays: 3, analytics, updatedAt: later(-5),
  }).returning();
  const [payment] = await test.db.insert(payments).values({
    organizationId: org, provider, externalId: `payment_${id}`, providerSubscriptionId: sub,
    amountCents: options.amount ?? 14900, currency: "eur", status: options.status ?? "paid", paidAt: options.occurredAt ?? later(-1),
  }).returning();
  return { checkout, payment, args: { provider, providerSubscriptionId: sub, externalId: payment.externalId, amountCents: payment.amountCents, currency: payment.currency } };
}

describe("Meta Purchase from the payment webhooks", () => {
  it.each(["stripe", "paypal"] as const)("%s: a zero trial invoice is nothing; the first payment is one Purchase in the guide's shape; a renewal is nothing", async (provider) => {
    const zero = await paid({ provider, amount: 0 });
    const send = ok();
    expect(await reportMetaPurchase(test.db, zero.args, send, NOW)).toBe("skipped");
    const first = await paid({ provider });
    expect(await reportMetaPurchase(test.db, first.args, send, NOW)).toBe("sent");
    const { url, body } = call(send);
    expect(url).toBe(`https://graph.facebook.com/v26.0/${PIXEL}/events?access_token=${TOKEN}`);
    expect(body).toEqual({
      data: [{
        event_name: "Purchase",
        event_time: Math.floor(first.payment.paidAt.getTime() / 1000),
        event_id: conversionId("purchase", `${provider}:${first.payment.externalId}`),
        action_source: "website",
        event_source_url: "https://www.repget.com/pricing",
        user_data: {
          em: [metaHash("buyer@example.com")], external_id: [metaHash("user_1")],
          client_ip_address: META.ip, client_user_agent: META.userAgent, fbp: META.fbp, fbc: META.fbc,
        },
        custom_data: { value: 149, currency: "EUR", content_name: "grow" },
      }],
    });
    // The consent proof and the token never reach the body.
    expect(JSON.stringify(body)).not.toContain(KEY);
    expect(JSON.stringify(body)).not.toContain(TOKEN);
    expect(await reportMetaPurchase(test.db, first.args, send, NOW)).toBe("skipped");
    const renewal = await paid({ provider, occurredAt: NOW });
    expect(await reportMetaPurchase(test.db, renewal.args, send, NOW)).toBe("skipped");
    expect(send).toHaveBeenCalledTimes(1);
    const [row] = await test.db.select().from(metaPurchases);
    expect(row).toMatchObject({ status: "delivered", attempts: 1, visitor: null, paymentId: first.payment.id, pixelId: PIXEL });
  });

  it("carries the test code only while one is set", async () => {
    vi.stubEnv("META_TEST_EVENT_CODE", "TEST11921");
    const first = await paid();
    const send = ok();
    await reportMetaPurchase(test.db, first.args, send, NOW);
    expect(call(send).body.test_event_code).toBe("TEST11921");
  });

  it("keeps a refused send and retries it from the five-minute job with the same event", async () => {
    const first = await paid();
    const fail = vi.fn(async () => new Response("{}", { status: 500 }));
    expect(await reportMetaPurchase(test.db, first.args, fail, NOW)).toBe("failed");
    expect((await test.db.select().from(metaPurchases))[0]).toMatchObject({ status: "pending", attempts: 1, lastError: "meta_refused_or_unreachable" });
    // The log names the event, never the address that carries the token.
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(TOKEN);
    const send = ok();
    expect((await deliverMetaPurchases(test.db, { now: NOW }, send)).delivered).toBe(0);
    expect((await recoverMetaPurchases(test.db, send, later(1))).delivered).toBe(1);
    expect(call(send).body).toEqual(call(fail).body);
  });

  it("finds a payment whose request died before it was queued", async () => {
    const first = await paid({ provider: "paypal" });
    const send = ok();
    expect(await recoverMetaPurchases(test.db, send, NOW)).toMatchObject({ discovered: 1, delivered: 1 });
    expect(call(send).body.data[0].event_id).toBe(conversionId("purchase", `paypal:${first.payment.externalId}`));
  });

  it.each([
    ["no consent at checkout", { key: null }],
    ["consent without a Meta identity", { meta: null }],
  ] as const)("sends nothing for %s, and a later payment is not a first one", async (_label, options) => {
    await paid({ ...options, occurredAt: later(-10) });
    const send = vi.fn();
    await recoverMetaPurchases(test.db, send, NOW);
    const next = await paid({ occurredAt: NOW });
    await reportMetaPurchase(test.db, next.args, send, NOW);
    expect(send).not.toHaveBeenCalled();
    const rows = await test.db.select().from(metaPurchases);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: "suppressed", lastError: "no_current_consent_identity", visitor: null });
  });

  it("waits without the token, sends when it is set, and lets nothing outlive 72 hours", async () => {
    vi.stubEnv("META_CAPI_TOKEN", "");
    const first = await paid();
    const send = ok();
    expect(await reportMetaPurchase(test.db, first.args, send, NOW)).toBe("skipped");
    expect((await test.db.select().from(metaPurchases))[0]).toMatchObject({ status: "pending", attempts: 0 });
    vi.stubEnv("META_CAPI_TOKEN", TOKEN);
    expect((await deliverMetaPurchases(test.db, { now: later(1) }, send)).delivered).toBe(1);

    await test.db.delete(metaPurchases);
    vi.stubEnv("META_CAPI_TOKEN", "");
    await reportMetaPurchase(test.db, first.args, send, NOW);
    expect((await deliverMetaPurchases(test.db, { now: later(73 * 60) }, send)).expired).toBe(1);
    expect((await test.db.select().from(metaPurchases))[0]).toMatchObject({ status: "expired", visitor: null });
  });

  it("never sends a queued identity to another pixel", async () => {
    const first = await paid();
    await reportMetaPurchase(test.db, first.args, async () => new Response("{}", { status: 500 }), NOW);
    vi.stubEnv("NEXT_PUBLIC_META_PIXEL_ID", "1111111111111111");
    const send = ok();
    await recoverMetaPurchases(test.db, send, later(1));
    expect(send).not.toHaveBeenCalled();
    expect((await test.db.select().from(metaPurchases))[0]).toMatchObject({ status: "pending", lastError: "pixel_configuration_changed" });
  });

  it("Google's queue never keeps the checkout's Meta identity", async () => {
    vi.stubEnv("NEXT_PUBLIC_GA4_MEASUREMENT_ID", "G-ABC123XYZ");
    vi.stubEnv("GA4_API_SECRET", "test_secret");
    const first = await paid({ ga: true });
    await reportFirstPayment(test.db, first.args, async () => new Response(null, { status: 500 }), NOW);
    const [row] = await test.db.select().from(paidAcquisitions);
    expect(row.visitor).toEqual({ clientId: "111.222", sessionId: null, capturedAt: later(-5).toISOString(), consentKey: KEY });
  });
});

describe("withdrawing consent", () => {
  const request = (key: string) => new NextRequest("https://www.repget.com/api/analytics/consent", { method: "POST", headers: {
    host: "www.repget.com", "sec-fetch-site": "same-origin", cookie: `repget_consent=2.denied; ${ANALYTICS_CONSENT_COOKIE}=${key}`,
  } });

  it("erases this browser's queued Purchase and leaves another browser's", async () => {
    const mine = await paid();
    const theirs = await paid({ org: "org_b", key: OTHER_KEY });
    const fail = async () => new Response("{}", { status: 500 });
    await reportMetaPurchase(test.db, mine.args, fail, NOW);
    await reportMetaPurchase(test.db, theirs.args, fail, NOW);
    expect((await withdraw(request(KEY))).status).toBe(204);
    const [row] = await test.db.select().from(metaPurchases).where(eq(metaPurchases.organizationId, "org_a"));
    expect(row).toMatchObject({ status: "suppressed", visitor: null, lastError: "consent_withdrawn" });
    const send = ok();
    await recoverMetaPurchases(test.db, send, later(1));
    expect(send).toHaveBeenCalledTimes(1);
    expect((await test.db.select().from(metaPurchases).where(eq(metaPurchases.organizationId, "org_b")))[0].status).toBe("delivered");
  });
});

it("migration 0095 marks every workspace that already paid as legacy, so no old sale is sent", async () => {
  const old = await createTestDb({ through: "0094_paid_acquisitions" });
  try {
    await old.db.insert(organization).values([{ id: "old", name: "Old", slug: "old", createdAt: NOW }, { id: "zero", name: "Zero", slug: "zero", createdAt: NOW }]);
    await old.db.insert(payments).values([
      { organizationId: "old", provider: "stripe", externalId: "historic", providerSubscriptionId: "sub_old", amountCents: 4900, currency: "eur", status: "paid", paidAt: later(-10) },
      { organizationId: "zero", provider: "stripe", externalId: "trial", providerSubscriptionId: "sub_zero", amountCents: 0, currency: "eur", status: "paid", paidAt: later(-10) },
    ]);
    await applyMigration(old.client, "0095_meta_purchases");
    const rows = await old.db.select().from(metaPurchases);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ organizationId: "old", status: "legacy", visitor: null, attempts: 0 });
    const send = vi.fn();
    expect((await recoverMetaPurchases(old.db, send, NOW)).discovered).toBe(0);
    expect(send).not.toHaveBeenCalled();
  } finally { await old.client.close(); }
});
