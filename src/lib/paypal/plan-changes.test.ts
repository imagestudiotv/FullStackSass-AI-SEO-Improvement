import { eq } from "drizzle-orm";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { organization, payments, paypalOrders, paypalPlanChanges, plans, subscriptions, websites } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";

/**
 * PayPal plan changes (review P1; owner 2026-11-07: an upgrade charges the
 * difference now) on a disposable PGlite. PayPal is stubbed at the calls it
 * makes; the subscription sync is the real one, so the downgrade hold is
 * what every sync records. What matters: the difference is charged before
 * the revision is asked and only once; nothing changes until PayPal reports
 * it; an upgrade paid but never revised is refunded - unless there is a sign
 * the buyer approved, then a person decides; a downgrade keeps the paid plan
 * until the next billing date. Stubbed only: no sandbox evidence.
 */

const state = vi.hoisted(() => ({ db: null as unknown, paypal: null as unknown }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }) }));
vi.mock("@/lib/referrals/core", () => ({ convertReferral: vi.fn(), reverseReferralReward: vi.fn() }));
vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/admin/guard", () => ({ adminEmails: () => ["ops@example.test"] }));
vi.mock("@/lib/paypal/subscriptions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/paypal/subscriptions")>()),
  getSubscription: async () => structuredClone(state.paypal),
  cancelSubscription: vi.fn(),
}));

const { syncPayPalSubscription } = await import("@/lib/billing/paypal-events");
const { settleOrder } = await import("@/lib/paypal/orders");
const { PayPalError } = await import("@/lib/paypal/client");
const pc = await import("@/lib/paypal/plan-changes");

let test: TestDb;
let siteId = "";
let subId = "";
const plan = { launch: "", grow: "", growYear: "" };
const NOW = new Date("2026-11-16T00:00:00Z");

type Order = { id: string; status: string; purchase_units?: { payments?: { captures?: Record<string, unknown>[] } }[] };

function harness() {
  const orders = new Map<string, Order>();
  const orderOps = {
    createOrder: vi.fn(async (input: { reference: string }) => {
      const id = `ORDER-${input.reference.slice(0, 8)}`;
      orders.set(id, { id, status: "PAYER_ACTION_REQUIRED" });
      return { orderId: id, approveUrl: `https://www.sandbox.paypal.com/checkoutnow?token=${id}` };
    }),
    getOrder: vi.fn(async (id: string) => structuredClone(orders.get(id)!)),
    captureOrder: vi.fn(async (id: string) => {
      const order = orders.get(id)!;
      order.status = "COMPLETED";
      order.purchase_units = [{ payments: { captures: [capture] } }];
      return structuredClone(order);
    }),
  };
  let capture: Record<string, unknown> = {};
  const ops = {
    getSubscription: vi.fn(async () => structuredClone(state.paypal) as never),
    reviseSubscription: vi.fn(async (input: { idempotencyKey?: string }) => ({
      approveUrl: `https://www.sandbox.paypal.com/webapps/billing/subscriptions/update?key=${input.idempotencyKey}`,
    })),
    sync: vi.fn((id: string) => syncPayPalSubscription(id)),
    refunds: { refund: vi.fn(async () => ({ kind: "succeeded" as const, providerRefundId: "REF-1", settled: "completed" as const })) },
    orders: orderOps,
    notifyStaff: vi.fn(async () => {}),
  };
  const options = (now: Date = NOW) => ({ database: test.db as never, ops: ops as never, now, baseUrl: "https://app.test" });
  return {
    ops,
    options,
    approveOrder: (id: string, cents: number, customId: string) => {
      orders.get(id)!.status = "APPROVED";
      capture = { id: `CAP-${id}`, status: "COMPLETED", custom_id: customId, amount: { value: (cents / 100).toFixed(2), currency_code: "EUR" } };
    },
    settleOrderRow: (rowId: string, now: Date = NOW) =>
      settleOrder(rowId, pc.planUpgradeFulfilment(options(now)), { database: test.db as never, ops: orderOps as never, now }),
  };
}

/** PayPal's subscription, billing monthly: paid 1 Nov, next 1 Dec. */
const live = (paypalPlanId: string, extra: Record<string, unknown> = {}) => ({
  id: "I-1",
  status: "ACTIVE",
  plan_id: paypalPlanId,
  custom_id: `org_a:${siteId}`,
  start_time: "2026-10-01T00:00:00Z",
  billing_info: {
    next_billing_time: "2026-12-01T00:00:00Z",
    last_payment: { time: "2026-11-01T00:00:00Z", amount: { value: "49.00", currency_code: "EUR" } },
    failed_payments_count: 0,
  },
  ...extra,
});

const change = async () => (await test.db.select().from(paypalPlanChanges))[0];
const sub = async () => (await test.db.select().from(subscriptions).where(eq(subscriptions.id, subId)))[0];
const start = (h: ReturnType<typeof harness>, toPlanId: string, now: Date = NOW) =>
  pc.startPlanChange({ organizationId: "org_a", subscriptionId: subId, toPlanId }, h.options(now));

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  await test.client.exec(
    "delete from paypal_plan_changes; delete from payment_refunds; delete from payments; delete from paypal_orders; delete from subscriptions; delete from billing_checkouts; delete from websites; delete from organization; delete from plans;",
  );
  await test.db.insert(organization).values({ id: "org_a", name: "Acme", slug: "acme", createdAt: new Date() });
  const base = { articleLimit: 30, keywordLimit: 100, siteLimit: 1, monthlyCredits: 0 };
  const rows = await test.db
    .insert(plans)
    .values([
      { name: "Launch", tier: "launch", interval: "month", paypalPlanId: "P-LAUNCH", priceCents: 4900, ...base },
      { name: "Grow", tier: "grow", interval: "month", paypalPlanId: "P-GROW", priceCents: 14900, ...base },
      { name: "Grow yearly", tier: "grow", interval: "year", paypalPlanId: "P-GROW-Y", priceCents: 149000, ...base },
    ])
    .returning();
  plan.launch = rows[0].id;
  plan.grow = rows[1].id;
  plan.growYear = rows[2].id;
  const [site] = await test.db.insert(websites).values({ organizationId: "org_a", url: "https://acme.test", domain: "acme.test" }).returning();
  siteId = site.id;
  const [row] = await test.db
    .insert(subscriptions)
    .values({
      organizationId: "org_a",
      websiteId: siteId,
      provider: "paypal",
      paypalSubscriptionId: "I-1",
      planId: plan.launch,
      status: "active",
      currentPeriodStart: new Date("2026-11-01T00:00:00Z"),
      currentPeriodEnd: new Date("2026-12-01T00:00:00Z"),
    })
    .returning();
  subId = row.id;
  state.paypal = live("P-LAUNCH");
});

afterEach(() => {
  vi.useRealTimers();
});

describe("the prorated difference", () => {
  it("is the price difference for the share of the period left", () => {
    const period = { periodStart: new Date("2026-11-01T00:00:00Z"), periodEnd: new Date("2026-12-01T00:00:00Z") };
    expect(pc.prorateDifference({ fromCents: 4900, toCents: 14900, ...period, now: NOW })).toBe(5000);
    expect(pc.prorateDifference({ fromCents: 4900, toCents: 14900, ...period, now: period.periodStart })).toBe(10000);
    expect(pc.prorateDifference({ fromCents: 4900, toCents: 14900, ...period, now: new Date("2026-12-02T00:00:00Z") })).toBe(0);
    expect(pc.prorateDifference({ fromCents: 14900, toCents: 4900, ...period, now: NOW })).toBe(0);
  });
});

describe("an upgrade through PayPal", () => {
  it("charges the difference first, asks the revision only once that is captured, and changes the plan when PayPal reports it", async () => {
    const h = harness();
    const started = await start(h, plan.grow);
    expect(started).toEqual({ kind: "redirect", url: expect.stringContaining("checkoutnow") });
    expect(h.ops.orders.createOrder).toHaveBeenCalledWith(expect.objectContaining({ amountCents: 5000, currency: "eur" }));
    expect(h.ops.reviseSubscription).not.toHaveBeenCalled();
    const opened = await change();
    expect(opened).toMatchObject({ kind: "upgrade", status: "awaiting_payment", differenceCents: 5000 });
    const [order] = await test.db.select().from(paypalOrders).where(eq(paypalOrders.id, opened.orderRowId!));
    expect(order).toMatchObject({ purpose: "plan_upgrade", referenceId: opened.id, amountCents: 5000 });

    // Paid: the capture is recorded and the revision asked, once, however often it is settled.
    h.approveOrder(order.paypalOrderId!, 5000, `plan_upgrade:${order.id}`);
    expect(await h.settleOrderRow(order.id)).toEqual({ kind: "completed", granted: true });
    expect(await h.settleOrderRow(order.id)).toEqual({ kind: "completed", granted: false });
    expect(h.ops.reviseSubscription).toHaveBeenCalledTimes(1);
    expect(h.ops.reviseSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ subscriptionId: "I-1", planId: "P-GROW", idempotencyKey: `plan-change:${opened.id}` }),
    );
    expect(await change()).toMatchObject({ status: "awaiting_approval", approveUrl: expect.stringContaining("update") });
    expect((await test.db.select().from(payments)).map((p) => p.amountCents)).toEqual([5000]);
    // Nothing changes before PayPal reports it.
    expect(await pc.settlePlanChange(opened.id, h.options())).toBe("awaiting_approval");
    expect((await sub()).planId).toBe(plan.launch);

    // Approved: PayPal reports the new plan; recorded at once, its allowances from now.
    state.paypal = live("P-GROW");
    expect(await pc.settlePlanChange(opened.id, h.options())).toBe("completed");
    expect((await sub()).planId).toBe(plan.grow);
    expect(h.ops.refunds.refund).not.toHaveBeenCalled();
  });

  it("refunds the difference after 72 hours without approval, and tells staff", async () => {
    const h = harness();
    await start(h, plan.grow);
    const opened = await change();
    const [order] = await test.db.select().from(paypalOrders);
    h.approveOrder(order.paypalOrderId!, 5000, `plan_upgrade:${order.id}`);
    await h.settleOrderRow(order.id);

    const later = new Date(NOW.getTime() + pc.APPROVAL_WINDOW_MS + 60_000);
    expect(await pc.settlePlanChange(opened.id, h.options(later))).toBe("refunded");
    expect(h.ops.refunds.refund).toHaveBeenCalledWith(expect.objectContaining({ amountCents: 5000 }));
    expect(h.ops.notifyStaff).toHaveBeenCalledWith("PayPal plan change refunded", expect.any(String));
    expect((await test.db.select().from(payments))[0]).toMatchObject({ status: "refunded", refundedCents: 5000 });
    expect((await sub()).planId).toBe(plan.launch);
    // A second settle refunds nothing more.
    await pc.settlePlanChange(opened.id, h.options(later));
    expect(h.ops.refunds.refund).toHaveBeenCalledTimes(1);
  });

  it("does not refund by itself when the buyer may have approved: a person decides", async () => {
    const h = harness();
    await start(h, plan.grow);
    const opened = await change();
    const [order] = await test.db.select().from(paypalOrders);
    h.approveOrder(order.paypalOrderId!, 5000, `plan_upgrade:${order.id}`);
    await h.settleOrderRow(order.id);
    // Back through the success link, but PayPal still reports the old plan.
    expect(await pc.returnFromRevision(opened.id, "success", h.options())).toBe("awaiting_approval");

    const later = new Date(NOW.getTime() + pc.APPROVAL_WINDOW_MS + 60_000);
    expect(await pc.settlePlanChange(opened.id, h.options(later))).toBe("failed");
    expect(h.ops.refunds.refund).not.toHaveBeenCalled();
    expect(h.ops.notifyStaff).toHaveBeenCalledWith("PayPal plan change needs a person", expect.any(String));
  });

  it("takes BILLING.SUBSCRIPTION.UPDATED after the request as the same sign", async () => {
    const h = harness();
    await start(h, plan.grow);
    const opened = await change();
    const [order] = await test.db.select().from(paypalOrders);
    h.approveOrder(order.paypalOrderId!, 5000, `plan_upgrade:${order.id}`);
    await h.settleOrderRow(order.id);
    await pc.onSubscriptionEvent("I-1", "BILLING.SUBSCRIPTION.UPDATED", h.options());
    expect((await change()).approvalSignalAt).not.toBeNull();
    const later = new Date(NOW.getTime() + pc.APPROVAL_WINDOW_MS + 60_000);
    expect(await pc.settlePlanChange(opened.id, h.options(later))).toBe("failed");
    expect(h.ops.refunds.refund).not.toHaveBeenCalled();
  });

  it("refunds at once when the buyer declines the revision on PayPal", async () => {
    const h = harness();
    await start(h, plan.grow);
    const opened = await change();
    const [order] = await test.db.select().from(paypalOrders);
    h.approveOrder(order.paypalOrderId!, 5000, `plan_upgrade:${order.id}`);
    await h.settleOrderRow(order.id);
    expect(await pc.returnFromRevision(opened.id, "cancelled", h.options())).toBe("refunded");
    expect(h.ops.refunds.refund).toHaveBeenCalledTimes(1);
  });

  it("refunds when PayPal refuses the revision after the difference was paid", async () => {
    const h = harness();
    h.ops.reviseSubscription.mockRejectedValueOnce(new PayPalError("Unprocessable", "rejected" as never, 422));
    await start(h, plan.grow);
    const [order] = await test.db.select().from(paypalOrders);
    h.approveOrder(order.paypalOrderId!, 5000, `plan_upgrade:${order.id}`);
    await h.settleOrderRow(order.id);
    expect(await change()).toMatchObject({ status: "refunded" });
    expect(h.ops.refunds.refund).toHaveBeenCalledWith(expect.objectContaining({ amountCents: 5000 }));
  });

  it("an unanswered revision is asked again with the same key", async () => {
    const h = harness();
    h.ops.reviseSubscription.mockRejectedValueOnce(new PayPalError("timeout", "unknown", 0));
    await start(h, plan.grow);
    const opened = await change();
    const [order] = await test.db.select().from(paypalOrders);
    h.approveOrder(order.paypalOrderId!, 5000, `plan_upgrade:${order.id}`);
    await h.settleOrderRow(order.id);
    expect(await change()).toMatchObject({ status: "awaiting_approval", approveUrl: null });
    await pc.settlePlanChange(opened.id, h.options());
    expect(h.ops.reviseSubscription).toHaveBeenCalledTimes(2);
    expect(new Set(h.ops.reviseSubscription.mock.calls.map(([input]) => input.idempotencyKey))).toEqual(new Set([`plan-change:${opened.id}`]));
    expect((await change()).approveUrl).toContain("update");
  });

  it("resumes the same unpaid change, and a new target replaces it; a late capture of the replaced one is refunded", async () => {
    const h = harness();
    const first = await start(h, plan.grow);
    const again = await start(h, plan.grow);
    expect(again).toEqual(first);
    expect(h.ops.orders.createOrder).toHaveBeenCalledTimes(1);
    const [old] = await test.db.select().from(paypalOrders);

    // A downgrade instead: the unpaid upgrade is cancelled and its order voided.
    state.paypal = live("P-GROW");
    await test.db.update(subscriptions).set({ planId: plan.grow }).where(eq(subscriptions.id, subId));
    expect((await start(h, plan.launch)).kind).toBe("redirect");
    const all = await test.db.select().from(paypalPlanChanges);
    expect(all.map((row) => row.status).sort()).toEqual(["awaiting_approval", "cancelled"]);
    expect((await test.db.select().from(paypalOrders).where(eq(paypalOrders.id, old.id)))[0].status).toBe("voided");
    // A voided row is never captured, even if the buyer approves it at PayPal.
    h.approveOrder(old.paypalOrderId!, 5000, `plan_upgrade:${old.id}`);
    expect(await h.settleOrderRow(old.id)).toEqual({ kind: "voided" });
    expect(h.ops.orders.captureOrder).not.toHaveBeenCalled();
  });

  it("is refused while a payment is failing, and between monthly and yearly", async () => {
    const h = harness();
    expect(await start(h, plan.growYear)).toEqual({ kind: "error", error: expect.stringContaining("monthly and yearly") });
    await test.db.update(subscriptions).set({ status: "past_due" }).where(eq(subscriptions.id, subId));
    expect(await start(h, plan.grow)).toEqual({ kind: "error", error: expect.stringContaining("not gone through") });
    expect(h.ops.orders.createOrder).not.toHaveBeenCalled();
  });
});

describe("a downgrade through PayPal", () => {
  beforeEach(async () => {
    await test.db.update(subscriptions).set({ planId: plan.grow }).where(eq(subscriptions.id, subId));
    state.paypal = live("P-GROW");
  });

  it("charges nothing, and keeps the paid plan until the next billing date", async () => {
    const h = harness();
    const started = await start(h, plan.launch);
    expect(started).toEqual({ kind: "redirect", url: expect.stringContaining("update") });
    expect(h.ops.orders.createOrder).not.toHaveBeenCalled();
    const opened = await change();
    expect(opened).toMatchObject({ kind: "downgrade", status: "awaiting_approval", differenceCents: 0 });

    // Approved: PayPal reports the lower plan at once, but the paid plan stays - whichever sync runs.
    state.paypal = live("P-LAUNCH");
    await syncPayPalSubscription("I-1");
    expect((await sub()).planId).toBe(plan.grow);
    expect(await pc.settlePlanChange(opened.id, h.options())).toBe("completed");
    expect(await change()).toMatchObject({ effectiveAt: new Date("2026-12-01T00:00:00Z") });
    expect((await sub()).planId).toBe(plan.grow);
    // Another change is refused until then.
    expect(await start(h, plan.launch)).toEqual({ kind: "error", error: expect.stringContaining("2026-12-01") });

    // Its date has come: recorded on the lower plan.
    const after = new Date("2026-12-01T01:00:00Z");
    vi.setSystemTime(after);
    await pc.reconcilePlanChanges(h.options(after));
    expect((await sub()).planId).toBe(plan.launch);
  });

  it("a revision not approved in time just ends: nothing paid, nothing refunded", async () => {
    const h = harness();
    await start(h, plan.launch);
    const opened = await change();
    const later = new Date(NOW.getTime() + pc.APPROVAL_WINDOW_MS + 60_000);
    expect(await pc.settlePlanChange(opened.id, h.options(later))).toBe("cancelled");
    expect(h.ops.refunds.refund).not.toHaveBeenCalled();
    expect((await sub()).planId).toBe(plan.grow);
  });
});
