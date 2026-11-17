import { eq, inArray } from "drizzle-orm";
import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { POST as withdraw } from "@/app/api/analytics/consent/route";
import { billingCheckouts, organization, paidAcquisitions, payments, plans } from "@/lib/db/schema";
import { applyMigration, createTestDb, type TestDb } from "@/test/db";

import { ANALYTICS_CONSENT_COOKIE, conversionId } from "./config";
import { deliverPaidAcquisitions, recoverPaidAcquisitions, reportFirstPayment } from "./paid-acquisitions";
import { previousReportFirstPayment } from "./previous-reporter.fixture";

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

  it.each(["no consent", "old checkout without revocation proof"])("suppresses %s; later consent does not turn a renewal into an acquisition", async scenario => {
    const first = await paid({ key: scenario === "no consent" ? null : KEY, occurredAt: later(-10) });
    if (scenario === "old checkout without revocation proof") await test.db.update(billingCheckouts).set({ analytics: { clientId: "111.222", sessionId: null, capturedAt: later(-20).toISOString() } }).where(eq(billingCheckouts.id, first.checkout.id));
    const send = vi.fn();
    await recoverPaidAcquisitions(test.db, send, NOW);
    const laterPayment = await paid({ occurredAt: NOW });
    await reportFirstPayment(test.db, laterPayment.args, send, NOW);
    expect(send).not.toHaveBeenCalled();
    expect((await test.db.select().from(paidAcquisitions))).toHaveLength(1);
  });

  it("a PayPal credit pack bought during the trial neither is an acquisition nor blocks the first subscription charge", async () => {
    // PayPal Orders captures share the ledger with no subscription id (lib/paypal/orders.ts); Stripe's credit packs never reach it.
    await test.db.insert(payments).values({ organizationId: "org_a", provider: "paypal", externalId: "capture_1", providerObject: "paypal_capture", amountCents: 900, currency: "eur", status: "paid", paidAt: later(-30) });
    const send = vi.fn(async () => new Response(null, { status: 204 }));
    expect(await recoverPaidAcquisitions(test.db, send, later(-20))).toMatchObject({ discovered: 0 });
    expect(await test.db.select().from(paidAcquisitions)).toEqual([]);
    const first = await paid({ provider: "paypal" });
    expect(await reportFirstPayment(test.db, first.args, send, NOW)).toBe("sent");
    expect(body(send).events[0].params.transaction_id).toBe(conversionId("purchase", `paypal:${first.payment.externalId}`));
  });

  it("waits for a checkout that has not completed yet instead of suppressing the payment for good", async () => {
    const first = await paid({ provider: "paypal" });
    await test.db.update(billingCheckouts).set({ status: "open" }).where(eq(billingCheckouts.id, first.checkout.id));
    const send = vi.fn(async () => new Response(null, { status: 204 }));
    expect(await reportFirstPayment(test.db, first.args, send, NOW)).toBe("skipped");
    expect(await test.db.select().from(paidAcquisitions)).toEqual([]);
    await test.db.update(billingCheckouts).set({ status: "completed" }).where(eq(billingCheckouts.id, first.checkout.id));
    expect(await recoverPaidAcquisitions(test.db, send, later(5))).toMatchObject({ discovered: 1, delivered: 1 });
    // Past the window it is decided, so an abandoned checkout cannot hold discovery forever.
    const stale = await paid({ org: "org_b", occurredAt: later(-73 * 60) });
    await test.db.update(billingCheckouts).set({ status: "abandoned" }).where(eq(billingCheckouts.id, stale.checkout.id));
    await recoverPaidAcquisitions(test.db, send, NOW);
    expect((await test.db.select().from(paidAcquisitions).where(eq(paidAcquisitions.organizationId, "org_b")))[0]).toMatchObject({ status: "suppressed", lastError: "not_subscription_checkout" });
  });

  it("deferred checkouts never fill the recovery batch: a completed payment is found at once, the rest as they complete or expire", async () => {
    // More waiting workspaces than one batch (20), named and dated to come before the completed one.
    const waiting = Array.from({ length: 25 }, (_, n) => `wait_${String(n).padStart(2, "0")}`);
    await test.db.insert(organization).values([...waiting, "zz_valid"].map(id => ({ id, name: id, slug: id, createdAt: NOW }))).onConflictDoNothing();
    const open: string[] = [];
    for (const org of waiting) {
      const { checkout } = await paid({ provider: "paypal", org, occurredAt: later(-30) });
      open.push(checkout.id);
    }
    await test.db.update(billingCheckouts).set({ status: "open" }).where(inArray(billingCheckouts.id, open));
    const valid = await paid({ provider: "paypal", org: "zz_valid", occurredAt: later(-1) });
    const send = vi.fn(async () => new Response(null, { status: 204 }));

    expect(await recoverPaidAcquisitions(test.db, send, NOW)).toMatchObject({ discovered: 1, delivered: 1 });
    expect(body(send).events[0].params.transaction_id).toBe(conversionId("purchase", `paypal:${valid.payment.externalId}`));
    // Repeated passes: the waiting ones stay undecided, with no row of their own.
    for (const minutes of [5, 10]) expect(await recoverPaidAcquisitions(test.db, send, later(minutes))).toMatchObject({ discovered: 0, delivered: 0 });
    expect(await test.db.select().from(paidAcquisitions)).toHaveLength(1);

    // Their checkouts complete later: found across more than one batch, each with its own payment time.
    await test.db.update(billingCheckouts).set({ status: "completed" }).where(inArray(billingCheckouts.id, open.slice(0, 24)));
    expect(await recoverPaidAcquisitions(test.db, send, later(15))).toMatchObject({ discovered: 20, delivered: 20 });
    expect(await recoverPaidAcquisitions(test.db, send, later(20))).toMatchObject({ discovered: 4, delivered: 4 });

    // The one never completed is decided once its 72 hours pass, never sent.
    expect(await recoverPaidAcquisitions(test.db, send, later(72 * 60))).toMatchObject({ discovered: 1, delivered: 0 });
    expect((await test.db.select().from(paidAcquisitions).where(eq(paidAcquisitions.organizationId, "wait_24")))[0]).toMatchObject({ status: "suppressed", lastError: "not_subscription_checkout" });
    expect(send).toHaveBeenCalledTimes(25);
  });

  it("a provider clock a little ahead waits until the payment time, never sends a future or shifted time", async () => {
    const first = await paid({ occurredAt: later(2) });
    const send = vi.fn(async () => new Response(null, { status: 204 }));
    expect(await reportFirstPayment(test.db, first.args, send, NOW)).toBe("skipped");
    expect((await test.db.select().from(paidAcquisitions))[0]).toMatchObject({ status: "pending", nextAttemptAt: later(2) });
    expect((await deliverPaidAcquisitions(test.db, { now: later(1) }, send)).delivered).toBe(0);
    expect((await deliverPaidAcquisitions(test.db, { now: later(2) }, send)).delivered).toBe(1);
    expect(body(send).timestamp_micros).toBe(later(2).getTime() * 1000);
    const wrong = await paid({ org: "org_b", occurredAt: later(60) });
    await reportFirstPayment(test.db, wrong.args, send, NOW);
    expect((await test.db.select().from(paidAcquisitions).where(eq(paidAcquisitions.organizationId, "org_b")))[0]).toMatchObject({ status: "suppressed", lastError: "outside_measurement_window" });
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

/*
  Rolling PR #133 back puts the previous reporter (previous-reporter.fixture.ts,
  verbatim from 33038bef) in charge again. It claims any checkout with a
  clientId and no purchaseSentAt, so every subscription already paying under
  this code must carry the marker, or its next renewal is reported as a new
  purchase (release review F1). These run that reporter against the database
  this code leaves behind.
*/
describe("rollback compatibility with the previous reporter", () => {
  const renewal = async (of: Awaited<ReturnType<typeof paid>>, minutes: number) => {
    const [row] = await test.db.insert(payments).values({
      organizationId: of.checkout.organizationId, provider: of.args.provider, externalId: `renewal_${++sequence}`,
      providerSubscriptionId: of.args.providerSubscriptionId, amountCents: 4900, currency: "eur", status: "paid", paidAt: later(minutes),
    }).returning();
    return { ...of.args, externalId: row.externalId, paidAt: row.paidAt };
  };
  const checkoutOf = async (of: Awaited<ReturnType<typeof paid>>) =>
    (await test.db.select().from(billingCheckouts).where(eq(billingCheckouts.id, of.checkout.id)))[0];

  it("marks a paid subscription while its delivery is still retrying; the previous reporter skips its renewal; the outbox still delivers once", async () => {
    const first = await paid();
    expect(await reportFirstPayment(test.db, first.args, async () => new Response(null, { status: 500 }), NOW)).toBe("failed");
    expect((await test.db.select().from(paidAcquisitions))[0]).toMatchObject({ status: "pending", lastError: "http_500" });

    const marked = await checkoutOf(first);
    // The identity and consent proof are kept; the marker is added; updated_at does not move.
    expect(marked.analytics).toEqual({ ...(first.checkout.analytics as object), purchaseSentAt: NOW.toISOString(), legacyMarker: "rollback_compat" });
    expect(marked.updatedAt).toEqual(first.checkout.updatedAt);

    // Rolled back: the previous reporter sees the renewal and reports nothing.
    const oldSend = vi.fn(async () => new Response(null, { status: 204 }));
    expect(await previousReportFirstPayment(test.db, await renewal(first, 10), oldSend, later(10))).toBe("skipped");
    expect(oldSend).not.toHaveBeenCalled();

    // Not rolled back: the marker changes nothing for the outbox, which retries and sends the first payment once.
    const send = vi.fn(async () => new Response(null, { status: 204 }));
    expect(await recoverPaidAcquisitions(test.db, send, later(1))).toMatchObject({ delivered: 1 });
    expect(body(send).events[0].params.transaction_id).toBe(conversionId("purchase", `stripe:${first.payment.externalId}`));
    expect(await test.db.select().from(paidAcquisitions)).toHaveLength(1);
  });

  it("marks a later subscription on another provider although it gets no acquisition row", async () => {
    const send = vi.fn(async () => new Response(null, { status: 204 }));
    const first = await paid({ occurredAt: later(-10) });
    expect(await reportFirstPayment(test.db, first.args, send, NOW)).toBe("sent");
    const second = await paid({ provider: "paypal", key: OTHER_KEY });
    expect(await reportFirstPayment(test.db, second.args, send, NOW)).toBe("skipped");
    expect(await test.db.select().from(paidAcquisitions)).toHaveLength(1);
    expect((await checkoutOf(second)).analytics).toMatchObject({ purchaseSentAt: NOW.toISOString(), consentKey: OTHER_KEY });

    const oldSend = vi.fn(async () => new Response(null, { status: 204 }));
    for (const of of [first, second]) expect(await previousReportFirstPayment(test.db, await renewal(of, 30), oldSend, later(30))).toBe("skipped");
    expect(oldSend).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("leaves unpaid checkouts, zero-value trial invoices and withdrawn identities exactly as they were", async () => {
    const send = vi.fn(async () => new Response(null, { status: 204 }));
    const trial = await paid({ amount: 0 });
    expect(await reportFirstPayment(test.db, trial.args, send, NOW)).toBe("skipped");
    const withdrawn = await paid({ org: "org_b", key: null });
    await reportFirstPayment(test.db, withdrawn.args, send, NOW);
    const [unpaid] = await test.db.insert(billingCheckouts).values({
      organizationId: "org_b", provider: "stripe", providerSubscriptionId: "sub_unpaid", planId, status: "completed", trialDays: 3,
      analytics: { clientId: "333.444", sessionId: null, capturedAt: later(-5).toISOString(), consentKey: KEY }, updatedAt: later(-5),
    }).returning();
    await recoverPaidAcquisitions(test.db, send, later(1));

    expect((await checkoutOf(trial)).analytics).toEqual(trial.checkout.analytics);
    expect((await checkoutOf(withdrawn)).analytics).toBeNull();
    const [still] = await test.db.select().from(billingCheckouts).where(eq(billingCheckouts.id, unpaid.id));
    expect(still.analytics).toEqual(unpaid.analytics);
    expect(still.updatedAt).toEqual(unpaid.updatedAt);
    // So the previous reporter still reports these subscriptions' real first payment after a rollback, as it always did.
    const oldSend = vi.fn(async () => new Response(null, { status: 204 }));
    const firstAfterRollback = { provider: "stripe" as const, providerSubscriptionId: "sub_unpaid", externalId: "in_first_after_rollback", amountCents: 4900, currency: "eur", paidAt: later(60) };
    expect(await previousReportFirstPayment(test.db, firstAfterRollback, oldSend, later(60))).toBe("sent");
    expect(await previousReportFirstPayment(test.db, { ...trial.args, amountCents: 4900, externalId: "in_trial_end" }, oldSend, later(60))).toBe("sent");
    expect(oldSend).toHaveBeenCalledTimes(2);
  });

  it("a payment committed without its marker (the request ended first) is marked by the next recovery pass", async () => {
    // The ledger row exists, but reportFirstPayment never ran: the window the recovery pass closes.
    const crashed = await paid();
    const renewed = await paid({ org: "org_b", key: OTHER_KEY, occurredAt: later(-20) });
    await reportFirstPayment(test.db, renewed.args, async () => new Response(null, { status: 204 }), later(-19));
    // A renewal whose request also ended before the marker: the workspace already has its acquisition row.
    await test.db.update(billingCheckouts).set({ analytics: renewed.checkout.analytics }).where(eq(billingCheckouts.id, renewed.checkout.id));
    await renewal(renewed, -1);
    expect((await checkoutOf(crashed)).analytics).not.toHaveProperty("purchaseSentAt");
    expect((await checkoutOf(renewed)).analytics).not.toHaveProperty("purchaseSentAt");

    const send = vi.fn(async () => new Response(null, { status: 204 }));
    expect(await recoverPaidAcquisitions(test.db, send, NOW)).toMatchObject({ marked: 2, discovered: 1, delivered: 1 });
    expect(await recoverPaidAcquisitions(test.db, send, later(5))).toMatchObject({ marked: 0, discovered: 0 });
    const oldSend = vi.fn(async () => new Response(null, { status: 204 }));
    for (const of of [crashed, renewed]) expect(await previousReportFirstPayment(test.db, await renewal(of, 40), oldSend, later(40))).toBe("skipped");
    expect(oldSend).not.toHaveBeenCalled();
    expect(await test.db.select().from(paidAcquisitions)).toHaveLength(2);
  });
});

describe("first-party consent withdrawal route → outbox recovery", () => {
  function request(site: string | null, consent = "2.denied", key = KEY, origin?: string) {
    return new NextRequest("https://www.repget.com/api/analytics/consent", { method: "POST", headers: {
      host: "www.repget.com", ...(site ? { "sec-fetch-site": site } : {}), ...(origin ? { origin } : {}),
      cookie: `repget_consent=${consent}; ${ANALYTICS_CONSENT_COOKIE}=${key}`,
    } });
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
    // Browsers without Sec-Fetch-Site (Safari before 16.4): the Origin decides; neither header is refused.
    expect((await withdraw(request(null, "2.denied", KEY, "https://evil.example"))).status).toBe(403);
    expect((await withdraw(request(null))).status).toBe(403);
    await withdraw(request("same-origin", "2.granted"));
    await withdraw(request("same-origin", "2.denied", "invalid"));
    await withdraw(request("same-origin", "2.denied", OTHER_KEY));
    expect((await test.db.select().from(billingCheckouts).where(eq(billingCheckouts.id, first.checkout.id)))[0].analytics).not.toBeNull();
    expect((await withdraw(request(null, "2.denied", KEY, "https://www.repget.com"))).status).toBe(204);
    expect((await test.db.select().from(billingCheckouts).where(eq(billingCheckouts.id, first.checkout.id)))[0].analytics).toBeNull();
  });
});

it("migration marks existing paid and refunded workspaces as legacy without queuing or sending old sales", async () => {
  const old = await createTestDb({ through: "0093_nov13_topups_engagement_ads" });
  try {
    await old.db.insert(organization).values([{ id: "old", name: "Old", slug: "old", createdAt: NOW }, { id: "zero", name: "Zero", slug: "zero", createdAt: NOW }, { id: "credits", name: "Credits", slug: "credits", createdAt: NOW }]);
    await old.db.insert(payments).values([
      { organizationId: "old", provider: "stripe", externalId: "historic", providerSubscriptionId: "sub_old", amountCents: 4900, currency: "eur", status: "refunded", paidAt: later(-5000) },
      { organizationId: "old", provider: "paypal", externalId: "later", providerSubscriptionId: "I-OLD", amountCents: 4900, currency: "eur", status: "paid", paidAt: later(-4000) },
      { organizationId: "zero", provider: "stripe", externalId: "trial", providerSubscriptionId: "sub_zero", amountCents: 0, currency: "eur", status: "paid", paidAt: later(-10) },
      // A credit pack is not a subscription customer, here as at runtime.
      { organizationId: "credits", provider: "paypal", externalId: "capture", providerObject: "paypal_capture", amountCents: 900, currency: "eur", status: "paid", paidAt: later(-10) },
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
