import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { POST as withdraw } from "@/app/api/analytics/consent/route";
import { billingCheckouts, organization, paidAcquisitions, payments, plans } from "@/lib/db/schema";
import { applyMigration, createTestDb, type TestDb } from "@/test/db";

import { ANALYTICS_CONSENT_COOKIE, conversionId } from "./config";
import { deliverPaidAcquisitions, recoverPaidAcquisitions, reportFirstPayment } from "./paid-acquisitions";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }) }));

const NOW = new Date("2026-11-16T12:00:00Z");
const KEY = "a".repeat(32);
const OTHER_KEY = "b".repeat(32);
let test: TestDb;
let planId: string;
let sequence = 0;
const later = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000);
const body = (send: ReturnType<typeof vi.fn>) => JSON.parse(send.mock.calls[0][1].body);

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
  await test.db.insert(organization).values([{ id: "org_a", name: "Acme", slug: "acme", createdAt: NOW }, { id: "org_b", name: "Other", slug: "other", createdAt: NOW }]);
  const [plan] = await test.db.insert(plans).values({ name: "Grow", tier: "grow", priceCents: 4900, articleLimit: 30, keywordLimit: 100, siteLimit: 1, monthlyCredits: 0 }).returning();
  planId = plan.id;
});
beforeEach(async () => {
  vi.stubEnv("NEXT_PUBLIC_GA4_MEASUREMENT_ID", "G-ABC123XYZ");
  vi.stubEnv("GA4_API_SECRET", "test_secret");
  vi.spyOn(console, "error").mockImplementation(() => {});
  await test.db.delete(paidAcquisitions);
  await test.db.delete(payments);
  await test.db.delete(billingCheckouts);
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
afterAll(async () => { await test.client.close(); });

async function paid(options: { provider?: "stripe" | "paypal"; org?: string; key?: string | null; occurredAt?: Date; subscription?: boolean; status?: string; amount?: number; capturedAt?: Date } = {}) {
  const provider = options.provider ?? "stripe";
  const org = options.org ?? "org_a";
  const id = ++sequence;
  const sub = `sub_${id}`;
  const [checkout] = await test.db.insert(billingCheckouts).values({
    organizationId: org, provider, providerSubscriptionId: sub, planId, status: "completed", trialDays: 3,
    analytics: options.key === null ? null : { clientId: "111.222", sessionId: "1700000000", capturedAt: (options.capturedAt ?? later(-5)).toISOString(), consentKey: options.key ?? KEY },
    updatedAt: later(-5),
  }).returning();
  const [payment] = await test.db.insert(payments).values({
    organizationId: org, provider, externalId: `payment_${id}`, providerSubscriptionId: options.subscription === false ? null : sub,
    amountCents: options.amount ?? 4900, currency: "eur", status: options.status ?? "paid", paidAt: options.occurredAt ?? later(-1),
  }).returning();
  return { checkout, payment, args: { provider, providerSubscriptionId: sub, externalId: payment.externalId, amountCents: payment.amountCents, currency: payment.currency } };
}

describe("paid acquisition ledger to delivery", () => {
  it.each(["stripe", "paypal"] as const)("%s: zero trial, first positive payment, replay and renewal produce one acquisition", async provider => {
    const zero = await paid({ provider, amount: 0 });
    const send = vi.fn(async () => new Response(null, { status: 204 }));
    expect(await reportFirstPayment(test.db, zero.args, send, NOW)).toBe("skipped");
    expect(await test.db.select().from(paidAcquisitions)).toEqual([]);
    const first = await paid({ provider });
    expect(await reportFirstPayment(test.db, { ...first.args, amountCents: 1, currency: "xxx" }, send, NOW)).toBe("sent");
    const payload = body(send);
    expect(payload.events[0].params).toMatchObject({ transaction_id: conversionId("purchase", `${provider}:${first.payment.externalId}`), value: 49, currency: "EUR", payment_type: provider });
    expect(payload.timestamp_micros).toBe(first.payment.paidAt.getTime() * 1000);
    expect(payload).not.toHaveProperty("consentKey");
    expect(JSON.stringify(payload)).not.toContain(KEY);
    expect(await reportFirstPayment(test.db, first.args, send, NOW)).toBe("skipped");
    const renewal = await paid({ provider, occurredAt: NOW });
    expect(await reportFirstPayment(test.db, renewal.args, send, NOW)).toBe("skipped");
    expect(send).toHaveBeenCalledTimes(1);
    const [row] = await test.db.select().from(paidAcquisitions);
    expect(row).toMatchObject({ status: "delivered", attempts: 1, visitor: null, paymentId: first.payment.id });
    const [unchanged] = await test.db.select().from(billingCheckouts).where(eq(billingCheckouts.id, first.checkout.id));
    expect(unchanged.updatedAt).toEqual(first.checkout.updatedAt);
  });

  it("persists a failed send and retries with the same event and payment time, without a renewal", async () => {
    const first = await paid();
    const fail = vi.fn(async () => new Response(null, { status: 500 }));
    expect(await reportFirstPayment(test.db, first.args, fail, NOW)).toBe("failed");
    const [pending] = await test.db.select().from(paidAcquisitions);
    expect(pending).toMatchObject({ status: "pending", attempts: 1, deliveredAt: null, lastError: "http_500" });
    const send = vi.fn(async () => new Response(null, { status: 204 }));
    expect((await deliverPaidAcquisitions(test.db, { now: NOW }, send)).delivered).toBe(0);
    expect((await recoverPaidAcquisitions(test.db, send, later(1))).delivered).toBe(1);
    expect(body(send)).toEqual(body(fail));
    expect((await test.db.select().from(paidAcquisitions))[0]).toMatchObject({ status: "delivered", attempts: 2 });
  });

  it("recovers a process death after the payment committed but before the queue insert", async () => {
    const first = await paid({ provider: "paypal" });
    const send = vi.fn(async () => new Response(null, { status: 204 }));
    expect(await recoverPaidAcquisitions(test.db, send, NOW)).toMatchObject({ discovered: 1, delivered: 1 });
    expect(body(send).events[0].params.transaction_id).toBe(conversionId("purchase", `paypal:${first.payment.externalId}`));
  });

  it("does not call a returning workspace new when it uses another subscription or provider", async () => {
    await paid({ status: "refunded", occurredAt: later(-100) });
    const returning = await paid({ provider: "paypal", occurredAt: NOW });
    const send = vi.fn();
    await reportFirstPayment(test.db, returning.args, send, NOW);
    expect(send).not.toHaveBeenCalled();
    expect((await test.db.select().from(paidAcquisitions))[0]).toMatchObject({ status: "suppressed", lastError: "refunded_before_delivery" });
  });

  it.each(["no consent", "one-off purchase", "old checkout without revocation proof"])("suppresses %s; later consent does not turn a renewal into an acquisition", async scenario => {
    const first = await paid({ key: scenario === "no consent" ? null : KEY, subscription: scenario !== "one-off purchase", occurredAt: later(-10) });
    if (scenario === "old checkout without revocation proof") await test.db.update(billingCheckouts).set({ analytics: { clientId: "111.222", sessionId: null, capturedAt: later(-20).toISOString() } }).where(eq(billingCheckouts.id, first.checkout.id));
    const send = vi.fn();
    await recoverPaidAcquisitions(test.db, send, NOW);
    const laterPayment = await paid({ occurredAt: NOW });
    await reportFirstPayment(test.db, laterPayment.args, send, NOW);
    expect(send).not.toHaveBeenCalled();
    expect((await test.db.select().from(paidAcquisitions))).toHaveLength(1);
  });

  it("queues without the server secret, then retries when configured; aged payments are never redated", async () => {
    const first = await paid();
    vi.stubEnv("GA4_API_SECRET", "");
    const send = vi.fn(async () => new Response(null, { status: 204 }));
    await reportFirstPayment(test.db, first.args, send, NOW);
    expect(send).not.toHaveBeenCalled();
    expect((await test.db.select().from(paidAcquisitions))[0].status).toBe("pending");
    vi.stubEnv("GA4_API_SECRET", "test_secret");
    expect((await deliverPaidAcquisitions(test.db, { now: later(1) }, send)).delivered).toBe(1);
    expect(body(send).timestamp_micros).toBe(first.payment.paidAt.getTime() * 1000);
    const other = await paid({ org: "org_b" });
    vi.stubEnv("GA4_API_SECRET", "");
    await reportFirstPayment(test.db, other.args, send, NOW);
    expect((await deliverPaidAcquisitions(test.db, { now: later(72 * 60 + 1) }, send)).expired).toBe(1);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("does not invent a checkout session for a delayed trial payment", async () => {
    const first = await paid({ capturedAt: later(-3 * 24 * 60) });
    const send = vi.fn(async () => new Response(null, { status: 204 }));
    await reportFirstPayment(test.db, first.args, send, NOW);
    expect(body(send).events[0].params.session_id).toBeUndefined();
    expect(body(send).client_id).toBe("111.222");
  });

  it("a timeout can retry after a crashed lease; overlapping workers send one claimed event", async () => {
    const first = await paid();
    await reportFirstPayment(test.db, first.args, async () => { throw Error("URL containing a secret must never be logged"); }, NOW);
    const [row] = await test.db.select().from(paidAcquisitions);
    await test.db.update(paidAcquisitions).set({ claimToken: "00000000-0000-0000-0000-000000000001", claimedUntil: later(5) }).where(eq(paidAcquisitions.id, row.id));
    const send = vi.fn(async () => new Response(null, { status: 204 }));
    await deliverPaidAcquisitions(test.db, { now: later(1) }, send);
    expect(send).not.toHaveBeenCalled();
    const results = await Promise.all([deliverPaidAcquisitions(test.db, { now: later(6) }, send), deliverPaidAcquisitions(test.db, { now: later(6) }, send)]);
    expect(results.reduce((n, x) => n + x.delivered, 0)).toBe(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("containing a secret");
  });
});

describe("first-party consent withdrawal route → outbox recovery", () => {
  function request(site: string, consent = "2.denied", key = KEY) {
    return new NextRequest("https://www.repget.com/api/analytics/consent", { method: "POST", headers: { "sec-fetch-site": site, cookie: `repget_consent=${consent}; ${ANALYTICS_CONSENT_COOKIE}=${key}` } });
  }
  it("withdraws this browser's pending conversion and saved identity, leaving another browser intact", async () => {
    const first = await paid();
    await paid({ org: "org_b", key: OTHER_KEY });
    await reportFirstPayment(test.db, first.args, async () => new Response(null, { status: 500 }), NOW);
    expect((await withdraw(request("same-origin"))).status).toBe(204);
    expect((await test.db.select().from(paidAcquisitions))[0]).toMatchObject({ status: "suppressed", visitor: null, lastError: "consent_withdrawn" });
    const [checkout] = await test.db.select().from(billingCheckouts).where(eq(billingCheckouts.id, first.checkout.id));
    expect(checkout.analytics).toBeNull();
    expect(checkout.updatedAt).toEqual(first.checkout.updatedAt);
    const send = vi.fn(async () => new Response(null, { status: 204 }));
    await recoverPaidAcquisitions(test.db, send, later(1));
    expect(send).toHaveBeenCalledTimes(1); // Only the other workspace/browser.
    expect((await test.db.select().from(paidAcquisitions).where(eq(paidAcquisitions.organizationId, "org_b")))[0].status).toBe("delivered");
  });
  it("rejects cross-site requests and ignores unconsented, forged or missing proof", async () => {
    const first = await paid();
    expect((await withdraw(request("cross-site"))).status).toBe(403);
    await withdraw(request("same-origin", "2.granted"));
    await withdraw(request("same-origin", "2.denied", "invalid"));
    await withdraw(request("same-origin", "2.denied", OTHER_KEY));
    expect((await test.db.select().from(billingCheckouts).where(eq(billingCheckouts.id, first.checkout.id)))[0].analytics).not.toBeNull();
  });
});

it("migration marks existing paid and refunded workspaces as legacy without queuing or sending old sales", async () => {
  const old = await createTestDb({ through: "0093_nov13_topups_engagement_ads" });
  try {
    await old.db.insert(organization).values([{ id: "old", name: "Old", slug: "old", createdAt: NOW }, { id: "zero", name: "Zero", slug: "zero", createdAt: NOW }]);
    await old.db.insert(payments).values([
      { organizationId: "old", provider: "stripe", externalId: "historic", amountCents: 4900, currency: "eur", status: "refunded", paidAt: later(-5000) },
      { organizationId: "old", provider: "paypal", externalId: "later", amountCents: 4900, currency: "eur", status: "paid", paidAt: later(-4000) },
      { organizationId: "zero", provider: "stripe", externalId: "trial", amountCents: 0, currency: "eur", status: "paid", paidAt: later(-10) },
    ]);
    await applyMigration(old.client, "0094_paid_acquisitions");
    const rows = await old.db.select().from(paidAcquisitions);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ organizationId: "old", status: "legacy", visitor: null, attempts: 0 });
    const send = vi.fn();
    expect((await recoverPaidAcquisitions(old.db, send, NOW)).discovered).toBe(0);
    expect(send).not.toHaveBeenCalled();
  } finally { await old.client.close(); }
});
