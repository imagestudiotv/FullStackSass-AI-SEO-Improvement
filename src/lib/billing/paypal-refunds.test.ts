import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { organization, paymentRefunds, payments, subscriptions, websites } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";

/**
 * PayPal refunds end to end inside RepGet (review P6): the admin action
 * (lib/admin/operations.ts refundPayment, checkRefundAgain), the real
 * provider mapping (lib/billing/refund-providers.ts: a subscription SALE vs an
 * Orders CAPTURE) and the webhook (lib/billing/paypal-events.ts). PayPal is
 * replaced at its HTTP wrappers, so the request each refund would send is
 * checked, and nothing leaves the test. Stubbed only: no sandbox evidence.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
const paypalMock = vi.hoisted(() => ({
  refundSale: vi.fn(),
  refundCapture: vi.fn(),
  cancelSubscription: vi.fn(),
  getSubscription: vi.fn(),
}));
const referralMock = vi.hoisted(() => ({ reverseReferralReward: vi.fn(async () => true), convertReferral: vi.fn() }));
const audit = vi.hoisted(() => ({ recordAdminAction: vi.fn(async () => undefined) }));

vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/inngest/send", () => ({ queueJob: vi.fn() }));
vi.mock("@/lib/admin/guard", () => ({ requireAdmin: vi.fn(async () => ({ email: "ops@example.test" })) }));
vi.mock("@/lib/admin/audit", () => audit);
vi.mock("@/lib/backlinks/credits", () => ({ recordCredit: vi.fn(), getBalance: vi.fn() }));
vi.mock("@/lib/usage", () => ({ checkLimit: vi.fn() }));
vi.mock("@/lib/referrals/core", () => referralMock);
vi.mock("@/lib/stripe/client", () => ({ isStripeConfigured: () => false, stripe: {} }));
vi.mock("@/lib/paypal/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/paypal/client")>()),
  isPayPalConfigured: () => true,
}));
vi.mock("@/lib/paypal/payments", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/paypal/payments")>()),
  refundSale: paypalMock.refundSale,
  refundCapture: paypalMock.refundCapture,
}));
vi.mock("@/lib/paypal/subscriptions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/paypal/subscriptions")>()),
  cancelSubscription: paypalMock.cancelSubscription,
  getSubscription: paypalMock.getSubscription,
}));

const { refundPayment, checkRefundAgain } = await import("@/lib/admin/operations");
const { processPayPalEvent } = await import("@/lib/billing/paypal-events");
const { PayPalError } = await import("@/lib/paypal/client");

let test: TestDb;
let saleId: string;
let captureId: string;

async function payment(id: string) {
  const [row] = await test.db.select().from(payments).where(eq(payments.id, id));
  return row;
}

beforeEach(async () => {
  vi.clearAllMocks();
  test = await createTestDb();
  state.db = test.db;
  await test.db.insert(organization).values({ id: "org_a", name: "Acme", slug: "acme", createdAt: new Date() });
  const [site] = await test.db.insert(websites).values({ organizationId: "org_a", url: "https://acme.test", domain: "acme.test" }).returning({ id: websites.id });
  const [sub] = await test.db
    .insert(subscriptions)
    .values({ organizationId: "org_a", websiteId: site.id, provider: "paypal", paypalSubscriptionId: "I-SUB1", status: "active" })
    .returning({ id: subscriptions.id });
  const rows = await test.db
    .insert(payments)
    .values([
      { organizationId: "org_a", provider: "paypal", externalId: "SALE-1", providerObject: "paypal_sale", amountCents: 14900, currency: "eur", status: "paid", providerSubscriptionId: "I-SUB1", subscriptionId: sub.id },
      // A one-off Orders purchase (a credit pack): a capture, not a sale.
      { organizationId: "org_a", provider: "paypal", externalId: "CAP-1", providerObject: "paypal_capture", amountCents: 7900, currency: "eur", status: "paid", description: "100 credits" },
    ])
    .returning({ id: payments.id });
  [saleId, captureId] = rows.map((row) => row.id);
});

describe("admin PayPal refunds", () => {
  it("refunds part of a subscription sale through the v1 sale endpoint, and keeps the subscription", async () => {
    paypalMock.refundSale.mockResolvedValueOnce({ id: "REF-1", status: "COMPLETED", amountCents: 5000 });
    const result = await refundPayment(saleId, "goodwill, staying", { amountCents: 5000 });
    expect(result).toEqual({ ok: true, data: expect.objectContaining({ refunded: 5000, cancelled: false, state: "completed" }) });
    expect(paypalMock.refundSale).toHaveBeenCalledWith(expect.objectContaining({ saleId: "SALE-1", amountCents: 5000, currency: "eur", operationKey: `refund:${saleId}:1` }));
    expect(paypalMock.refundCapture).not.toHaveBeenCalled();
    expect(paypalMock.cancelSubscription).not.toHaveBeenCalled();
    expect(await payment(saleId)).toMatchObject({ status: "paid", refundedCents: 5000 });
    // Partial: the referral stands.
    expect(referralMock.reverseReferralReward).not.toHaveBeenCalled();
    // The audit entry was written before the money, with the refund's id.
    expect(audit.recordAdminAction).toHaveBeenCalledWith(expect.objectContaining({ action: "payment.refunded", detail: expect.objectContaining({ partial: true, provider: "paypal" }) }));
  });

  it("refunds an Orders purchase through the v2 capture endpoint", async () => {
    paypalMock.refundCapture.mockResolvedValueOnce({ id: "REF-C", status: "COMPLETED", amountCents: 7900 });
    const result = await refundPayment(captureId, "duplicate purchase");
    expect(result).toMatchObject({ ok: true, data: { refunded: 7900, state: "completed" } });
    expect(paypalMock.refundCapture).toHaveBeenCalledWith(expect.objectContaining({ captureId: "CAP-1", amountCents: 7900 }));
    expect(paypalMock.refundSale).not.toHaveBeenCalled();
    expect(referralMock.reverseReferralReward).toHaveBeenCalledTimes(1);
  });

  it("cancels the payment's own PayPal subscription only when asked, after the money is back", async () => {
    const order: string[] = [];
    paypalMock.refundSale.mockImplementationOnce(async () => (order.push("refund"), { id: "REF-2", status: "COMPLETED", amountCents: 14900 }));
    paypalMock.cancelSubscription.mockImplementationOnce(async () => void order.push("cancel"));
    paypalMock.getSubscription.mockRejectedValueOnce(new PayPalError("Not found at PayPal", "not_found", 404));
    const result = await refundPayment(saleId, "leaving", { cancelSubscription: true });
    expect(result.ok).toBe(true);
    expect(order).toEqual(["refund", "cancel"]);
    expect(paypalMock.cancelSubscription).toHaveBeenCalledWith("I-SUB1", expect.any(String));
  });

  it("does not refund at all when the subscription to cancel cannot be told", async () => {
    const result = await refundPayment(captureId, "leaving", { cancelSubscription: true });
    expect(result).toMatchObject({ ok: false });
    expect(paypalMock.refundCapture).not.toHaveBeenCalled();
    expect(await test.db.select().from(paymentRefunds)).toHaveLength(0);
  });

  it("reports an unanswered PayPal call as unknown, and checking again repeats it with the same key", async () => {
    paypalMock.refundSale
      .mockRejectedValueOnce(new PayPalError("PayPal took too long to respond", "unknown"))
      .mockResolvedValueOnce({ id: "REF-3", status: "COMPLETED", amountCents: 14900 });
    const first = await refundPayment(saleId, "goodwill");
    expect(first).toMatchObject({ ok: true, data: { state: "unknown", refunded: 0 } });
    // A second press is refused while it is unknown: no second refund.
    expect(await refundPayment(saleId, "goodwill")).toMatchObject({ ok: false });
    const refundId = first.ok ? first.data.refundId : "";
    expect(await checkRefundAgain(refundId)).toEqual({ ok: true, data: { state: "completed" } });
    const keys = paypalMock.refundSale.mock.calls.map(([input]) => (input as { operationKey: string }).operationKey);
    expect(keys).toEqual([`refund:${saleId}:1`, `refund:${saleId}:1`]);
    expect(await payment(saleId)).toMatchObject({ refundedCents: 14900 });
  });

  it("records a PayPal refusal as failed and changes nothing", async () => {
    paypalMock.refundSale.mockRejectedValueOnce(new PayPalError("Refund refused", "rejected", 422, "TRANSACTION_REFUSED"));
    expect(await refundPayment(saleId, "goodwill")).toEqual({ ok: false, error: "Refund refused (TRANSACTION_REFUSED)" });
    expect(await payment(saleId)).toMatchObject({ status: "paid", refundedCents: 0 });
  });
});

describe("PayPal refund webhooks", () => {
  it("records a partial dashboard refund (it used to be dropped), and reverses the referral once whole", async () => {
    await processPayPalEvent({ id: "WH-1", event_type: "PAYMENT.SALE.REFUNDED", resource: { id: "REF-D1", sale_id: "SALE-1", state: "completed", amount: { total: "50.00", currency: "EUR" } } });
    expect(await payment(saleId)).toMatchObject({ status: "paid", refundedCents: 5000 });
    expect(referralMock.reverseReferralReward).not.toHaveBeenCalled();

    // The same delivery again: nothing more.
    await processPayPalEvent({ id: "WH-1", event_type: "PAYMENT.SALE.REFUNDED", resource: { id: "REF-D1", sale_id: "SALE-1", state: "completed", amount: { total: "50.00", currency: "EUR" } } });
    expect(await payment(saleId)).toMatchObject({ refundedCents: 5000 });

    await processPayPalEvent({ id: "WH-2", event_type: "PAYMENT.SALE.REFUNDED", resource: { id: "REF-D2", sale_id: "SALE-1", state: "completed", amount: { total: "99.00", currency: "EUR" } } });
    expect(await payment(saleId)).toMatchObject({ refundedCents: 14900 });
    expect(referralMock.reverseReferralReward).toHaveBeenCalledTimes(1);
  });

  it("records a v2 capture refund against the capture its 'up' link names", async () => {
    await processPayPalEvent({
      id: "WH-3",
      event_type: "PAYMENT.CAPTURE.REFUNDED",
      resource: { id: "REF-V2", status: "COMPLETED", amount: { value: "79.00", currency_code: "EUR" }, links: [{ rel: "up", href: "https://api-m.sandbox.paypal.com/v2/payments/captures/CAP-1" }] },
    });
    expect(await payment(captureId)).toMatchObject({ status: "refunded", refundedCents: 7900 });
  });

  it("takes a reversal with no amount as all that remains", async () => {
    await processPayPalEvent({ id: "WH-4", event_type: "PAYMENT.SALE.REFUNDED", resource: { id: "REF-D3", sale_id: "SALE-1", amount: { total: "40.00", currency: "EUR" } } });
    await processPayPalEvent({ id: "WH-5", event_type: "PAYMENT.SALE.REVERSED", resource: { id: "REV-1", sale_id: "SALE-1" } });
    expect(await payment(saleId)).toMatchObject({ refundedCents: 14900 });
  });
});
