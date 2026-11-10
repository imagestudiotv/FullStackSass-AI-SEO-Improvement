import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { addonPurchases, addons, blogSponsorships, creditLedger, organization, payments, paypalOrders } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";

/**
 * PayPal one-off purchases (lib/paypal/orders.ts; reviews P4, P8) on a
 * disposable PGlite, PayPal's Orders API stubbed at the three calls it makes.
 * What matters: the server's price is what PayPal is asked for and what the
 * capture must match; money moves only by RepGet's capture, once; credits
 * and placements are granted only on a COMPLETED capture, once, whoever
 * settles first. Stubbed only: no sandbox evidence.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
const notifyMock = vi.hoisted(() => vi.fn());
const email = vi.hoisted(() => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }) }));
vi.mock("@/lib/notifications/create", () => ({ notify: notifyMock }));
vi.mock("@/lib/email/send", () => email);
vi.mock("@/lib/admin/guard", () => ({ adminEmails: () => ["ops@example.test"] }));
vi.mock("@/lib/blog/posts", () => ({ getPostInAnyLanguage: vi.fn(async () => null) }));

const { startOrder, settleOrder, fulfilCreditPack, ABANDON_AFTER_MS } = await import("@/lib/paypal/orders");
const { confirmSponsorshipPayPal } = await import("@/lib/blog/sponsorship");
const { PayPalError } = await import("@/lib/paypal/client");

let test: TestDb;
let addonId: string;

type Order = { id: string; status: string; purchase_units?: { payments?: { captures?: Record<string, unknown>[] } }[] };

function payPal() {
  const orders = new Map<string, Order>();
  const ops = {
    createOrder: vi.fn(async (input: { reference: string; customId: string; amountCents: number; currency: string }) => {
      const id = `ORDER-${input.reference.slice(0, 8)}`;
      orders.set(id, { id, status: "PAYER_ACTION_REQUIRED" });
      return { orderId: id, approveUrl: `https://www.sandbox.paypal.com/checkoutnow?token=${id}` };
    }),
    getOrder: vi.fn(async (id: string) => {
      const order = orders.get(id);
      if (!order) throw new PayPalError("Not found at PayPal", "not_found", 404);
      return structuredClone(order);
    }),
    captureOrder: vi.fn(async (id: string) => {
      const order = orders.get(id)!;
      order.status = "COMPLETED";
      order.purchase_units = [{ payments: { captures: [capture] } }];
      return structuredClone(order);
    }),
  };
  let capture: Record<string, unknown> = {};
  return {
    ops,
    approve: (id: string) => void (orders.get(id)!.status = "APPROVED"),
    /** What the capture will say (and its custom_id must be ours). */
    willCapture: (value: Record<string, unknown>) => void (capture = value),
    set: (id: string, order: Order) => void orders.set(id, order),
  };
}

const urls = { returnUrl: (id: string) => `https://app.test/r?row=${id}`, cancelUrl: (id: string) => `https://app.test/c?row=${id}` };

async function start(paypal: ReturnType<typeof payPal>, overrides: Partial<Parameters<typeof startOrder>[0]> = {}) {
  const started = await startOrder(
    { purpose: "addon_credits", organizationId: "org_a", referenceId: addonId, amountCents: 7900, currency: "eur", description: "100 credits", ...urls, ...overrides },
    { database: test.db as never, ops: paypal.ops as never },
  );
  if (started.kind !== "started") throw new Error("not started");
  const [row] = await test.db.select().from(paypalOrders).where(eq(paypalOrders.id, started.rowId));
  return row;
}

const settle = (rowId: string, paypal: ReturnType<typeof payPal>, now?: Date) =>
  settleOrder(rowId, fulfilCreditPack, { database: test.db as never, ops: paypal.ops as never, now });

async function credits() {
  return (await test.db.select().from(creditLedger).where(eq(creditLedger.organizationId, "org_a"))).reduce((sum, row) => sum + row.amount, 0);
}

beforeEach(async () => {
  vi.clearAllMocks();
  test = await createTestDb();
  state.db = test.db;
  await test.db.insert(organization).values({ id: "org_a", name: "A", slug: "a", createdAt: new Date() });
  const [addon] = await test.db
    .insert(addons)
    .values({ slug: `credits_${randomUUID()}`, name: "100 credits", priceCents: 7900, creditsGranted: 100, kind: "credits" })
    .returning({ id: addons.id });
  addonId = addon.id;
});

describe("a credit pack bought with PayPal", () => {
  it("asks PayPal for the server's price, for our row, and grants nothing on creation", async () => {
    const paypal = payPal();
    const row = await start(paypal);
    expect(paypal.ops.createOrder).toHaveBeenCalledWith(expect.objectContaining({ reference: row.id, customId: `addon_credits:${row.id}`, amountCents: 7900, currency: "eur" }));
    expect(row).toMatchObject({ status: "created", amountCents: 7900 });
    expect(await settle(row.id, paypal)).toEqual({ kind: "waiting" });
    expect(paypal.ops.captureOrder).not.toHaveBeenCalled();
    expect(await credits()).toBe(0);
  });

  it("captures an approved order once and grants its credits once, however often it is settled", async () => {
    const paypal = payPal();
    const row = await start(paypal);
    paypal.approve(row.paypalOrderId!);
    paypal.willCapture({ id: "CAP-1", status: "COMPLETED", custom_id: `addon_credits:${row.id}`, amount: { value: "79.00", currency_code: "EUR" } });

    expect(await settle(row.id, paypal)).toEqual({ kind: "completed", granted: true });
    // The return page, the webhook and the sweep all arrive: nothing more.
    expect(await settle(row.id, paypal)).toEqual({ kind: "completed", granted: false });
    expect(await settle(row.id, paypal)).toEqual({ kind: "completed", granted: false });

    expect(paypal.ops.captureOrder).toHaveBeenCalledTimes(1);
    expect(await credits()).toBe(100);
    expect(await test.db.select().from(addonPurchases)).toHaveLength(1);
    const [paid] = await test.db.select().from(payments);
    expect(paid).toMatchObject({ provider: "paypal", externalId: "CAP-1", providerObject: "paypal_capture", amountCents: 7900, status: "paid" });
  });

  it("grants nothing while PayPal is still clearing the capture, then once it completes", async () => {
    const paypal = payPal();
    const row = await start(paypal);
    paypal.approve(row.paypalOrderId!);
    paypal.willCapture({ id: "CAP-P", status: "PENDING", custom_id: `addon_credits:${row.id}`, amount: { value: "79.00", currency_code: "EUR" } });
    expect(await settle(row.id, paypal)).toEqual({ kind: "pending" });
    expect(await credits()).toBe(0);

    paypal.set(row.paypalOrderId!, { id: row.paypalOrderId!, status: "COMPLETED", purchase_units: [{ payments: { captures: [{ id: "CAP-P", status: "COMPLETED", custom_id: `addon_credits:${row.id}`, amount: { value: "79.00", currency_code: "EUR" } }] } }] });
    expect(await settle(row.id, paypal)).toEqual({ kind: "completed", granted: true });
    expect(await credits()).toBe(100);
  });

  it("grants nothing for a declined capture", async () => {
    const paypal = payPal();
    const row = await start(paypal);
    paypal.approve(row.paypalOrderId!);
    paypal.willCapture({ id: "CAP-D", status: "DECLINED", custom_id: `addon_credits:${row.id}`, amount: { value: "79.00", currency_code: "EUR" } });
    expect(await settle(row.id, paypal)).toMatchObject({ kind: "failed" });
    expect(await credits()).toBe(0);
    expect(await test.db.select().from(payments)).toHaveLength(0);
  });

  it("never grants a capture of another amount or currency, or for another row", async () => {
    for (const capture of [
      { amount: { value: "7.90", currency_code: "EUR" } },
      { amount: { value: "79.00", currency_code: "USD" } },
      { amount: { value: "79.00", currency_code: "EUR" }, custom_id: "addon_credits:00000000-0000-0000-0000-000000000000" },
    ]) {
      const paypal = payPal();
      const row = await start(paypal);
      paypal.approve(row.paypalOrderId!);
      paypal.willCapture({ id: `CAP-${randomUUID()}`, status: "COMPLETED", custom_id: `addon_credits:${row.id}`, ...capture });
      expect(await settle(row.id, paypal)).toMatchObject({ kind: "failed" });
    }
    expect(await credits()).toBe(0);
  });

  it("keeps an unanswered capture open and captures with the same order key next time", async () => {
    const paypal = payPal();
    const row = await start(paypal);
    paypal.approve(row.paypalOrderId!);
    paypal.willCapture({ id: "CAP-U", status: "COMPLETED", custom_id: `addon_credits:${row.id}`, amount: { value: "79.00", currency_code: "EUR" } });
    paypal.ops.captureOrder.mockRejectedValueOnce(new PayPalError("PayPal took too long to respond", "unknown"));
    expect(await settle(row.id, paypal)).toMatchObject({ kind: "unknown" });
    expect(await credits()).toBe(0);
    expect(await settle(row.id, paypal)).toEqual({ kind: "completed", granted: true });
    expect(paypal.ops.captureOrder.mock.calls.map(([id]) => id)).toEqual([row.paypalOrderId, row.paypalOrderId]);
  });

  it("reads the existing capture when PayPal says the order was already captured", async () => {
    const paypal = payPal();
    const row = await start(paypal);
    paypal.approve(row.paypalOrderId!);
    paypal.ops.captureOrder.mockImplementationOnce(async (id: string) => {
      paypal.set(id, { id, status: "COMPLETED", purchase_units: [{ payments: { captures: [{ id: "CAP-A", status: "COMPLETED", custom_id: `addon_credits:${row.id}`, amount: { value: "79.00", currency_code: "EUR" } }] } }] });
      throw new PayPalError("Order already captured", "rejected", 422, "ORDER_ALREADY_CAPTURED");
    });
    expect(await settle(row.id, paypal)).toEqual({ kind: "completed", granted: true });
    expect(await credits()).toBe(100);
  });

  it("abandons an order never approved, and one whose creation was never confirmed", async () => {
    const paypal = payPal();
    const row = await start(paypal);
    const later = new Date(row.createdAt.getTime() + ABANDON_AFTER_MS + 1000);
    expect(await settle(row.id, paypal, later)).toEqual({ kind: "voided" });

    const lost = payPal();
    lost.ops.createOrder.mockRejectedValueOnce(new PayPalError("PayPal took too long to respond", "unknown"));
    const failed = await startOrder({ purpose: "addon_credits", organizationId: "org_a", referenceId: addonId, amountCents: 7900, currency: "eur", description: "100 credits", ...urls }, { database: test.db as never, ops: lost.ops as never });
    expect(failed).toMatchObject({ kind: "error" });
    const rowId = failed.kind === "error" ? failed.rowId! : "";
    expect((await test.db.select().from(paypalOrders).where(eq(paypalOrders.id, rowId)))[0].status).toBe("unknown");
    expect(await settleOrder(rowId, fulfilCreditPack, { database: test.db as never, ops: lost.ops as never, now: new Date(Date.now() + 2 * 3_600_000) })).toEqual({ kind: "voided" });
    expect(await credits()).toBe(0);
  });
});

describe("a placement bought with PayPal", () => {
  async function request(status = "pending") {
    const [row] = await test.db
      .insert(blogSponsorships)
      .values({ postSlug: "a-post", email: "buyer@example.test", websiteUrl: "https://buyer.test/", message: "please", status })
      .returning();
    return row;
  }

  it("is paid once, by the order the request names", async () => {
    const placement = await request();
    const order = { id: randomUUID(), referenceId: placement.id, amountCents: 9900, currency: "eur", paypalCaptureId: "CAP-S" };
    await test.db.update(blogSponsorships).set({ paypalOrderId: order.id }).where(eq(blogSponsorships.id, placement.id));
    expect(await confirmSponsorshipPayPal(order)).toBe(true);
    expect(await confirmSponsorshipPayPal(order)).toBe(true);
    const [after] = await test.db.select().from(blogSponsorships).where(eq(blogSponsorships.id, placement.id));
    expect(after.status).toBe("paid");
    // Told once (the admins' "new paid placement" mail); no double-payment alarm.
    expect(email.sendEmail).toHaveBeenCalledTimes(1);
    expect(email.sendEmail.mock.calls[0][0].subject).not.toContain("twice");
  });

  it("tells the administrators to refund one payment when it was already paid by card", async () => {
    const placement = await request("paid");
    const order = { id: randomUUID(), referenceId: placement.id, amountCents: 9900, currency: "eur", paypalCaptureId: "CAP-2" };
    await test.db.update(blogSponsorships).set({ paypalOrderId: order.id }).where(eq(blogSponsorships.id, placement.id));
    expect(await confirmSponsorshipPayPal({ ...order, id: randomUUID() })).toBe(true);
    expect(email.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ subject: "Placement paid twice: refund one payment" }));
  });
});
