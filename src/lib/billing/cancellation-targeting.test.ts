import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { organization, payments, subscriptions, websites } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";

/**
 * Issue 6: a cancellation must hit exactly the subscription it is about -
 * the refunded invoice's, or the website the customer pressed cancel on -
 * and never be recorded locally unless the provider confirmed it. Every
 * provider call is a mock.
 */

const state = vi.hoisted(() => ({ db: null as unknown, orgId: "org_a", usedSite: "" }));
const stripeMock = vi.hoisted(() => ({
  refundsCreate: vi.fn(),
  invoicesRetrieve: vi.fn(),
  subscriptionsCancel: vi.fn(),
  portalCreate: vi.fn(),
}));
const paypalMock = vi.hoisted(() => ({
  cancelSubscription: vi.fn(),
  getSubscription: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/admin/guard", () => ({
  requireAdmin: vi.fn(async () => ({ email: "ops@example.test" })),
}));
vi.mock("@/lib/usage", () => ({
  checkLimit: vi.fn(async (websiteId: string) => ({
    allowed: true,
    used: websiteId === state.usedSite ? 20 : 0,
    limit: 40,
    reason: null,
  })),
}));
vi.mock("@/lib/stripe/client", () => ({
  isStripeConfigured: () => true,
  stripe: {
    refunds: { create: stripeMock.refundsCreate },
    invoices: { retrieve: stripeMock.invoicesRetrieve },
    subscriptions: { cancel: stripeMock.subscriptionsCancel },
    billingPortal: { sessions: { create: stripeMock.portalCreate } },
  },
}));
vi.mock("@/lib/paypal/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/paypal/client")>()),
  isPayPalConfigured: () => true,
}));
vi.mock("@/lib/paypal/subscriptions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/paypal/subscriptions")>()),
  cancelSubscription: paypalMock.cancelSubscription,
  getSubscription: paypalMock.getSubscription,
}));
vi.mock("@/lib/tenant", () => ({
  requireOrg: vi.fn(async () => ({ orgId: state.orgId, userId: "user_1", role: "owner" })),
}));

import { quoteRefund, refundPayment } from "@/lib/admin/operations";
import { cancelPayPalSubscription } from "@/lib/paypal/actions";
import { createPortalSession } from "@/lib/stripe/portal";

let test: TestDb;

beforeAll(async () => {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example.test");
  test = await createTestDb();
  state.db = test.db;
});

beforeEach(async () => {
  vi.clearAllMocks();
  state.orgId = "org_a";
  await test.client.exec(`
    delete from admin_audit_log; delete from payments; delete from subscriptions;
    delete from billing_customers; delete from websites; delete from organization;`);
  await test.db.insert(organization).values([
    { id: "org_a", name: "A", slug: "a", createdAt: new Date() },
    { id: "org_b", name: "B", slug: "b", createdAt: new Date() },
  ]);
  stripeMock.refundsCreate.mockResolvedValue({ id: "re_1" });
  stripeMock.subscriptionsCancel.mockImplementation(async (id: string) => ({ id, status: "canceled" }));
  stripeMock.invoicesRetrieve.mockResolvedValue({ payments: { data: [{ payment: { type: "payment_intent", payment_intent: "pi_1" } }] } });
});

async function site(organizationId: string, domain: string) {
  const [row] = await test.db
    .insert(websites)
    .values({ organizationId, url: `https://${domain}`, domain })
    .returning();
  return row.id;
}

async function sub(
  organizationId: string,
  websiteId: string,
  values: Partial<typeof subscriptions.$inferInsert>,
) {
  const [row] = await test.db
    .insert(subscriptions)
    .values({ organizationId, websiteId, status: "active", ...values })
    .returning();
  return row.id;
}

async function statusOf(id: string) {
  const [row] = await test.db.select({ status: subscriptions.status }).from(subscriptions).where(eq(subscriptions.id, id));
  return row.status;
}

async function payment(values: Partial<typeof payments.$inferInsert>) {
  const [row] = await test.db
    .insert(payments)
    .values({
      organizationId: "org_a",
      provider: "stripe",
      externalId: `in_${Math.random().toString(36).slice(2)}`,
      amountCents: 4000,
      currency: "eur",
      status: "paid",
      ...values,
    })
    .returning();
  return row.id;
}

describe("refund with cancellation", () => {
  it("cancels the refunded invoice's subscription, not the workspace's newest", async () => {
    const older = await sub("org_a", await site("org_a", "a.test"), {
      stripeSubscriptionId: "sub_older",
      createdAt: new Date("2026-01-01T00:00:00Z"),
    });
    const newer = await sub("org_a", await site("org_a", "b.test"), {
      stripeSubscriptionId: "sub_newer",
      createdAt: new Date("2026-06-01T00:00:00Z"),
    });
    const paid = await payment({ providerSubscriptionId: "sub_older", subscriptionId: older });

    const result = await refundPayment(paid, "customer asked", { cancelSubscription: true });

    expect(result).toEqual({ ok: true, data: { refunded: 4000, cancelled: true } });
    expect(stripeMock.subscriptionsCancel).toHaveBeenCalledTimes(1);
    expect(stripeMock.subscriptionsCancel).toHaveBeenCalledWith("sub_older", {}, {
      idempotencyKey: `refund-cancel:${paid}`,
    });
    expect(await statusOf(older)).toBe("canceled");
    expect(await statusOf(newer)).toBe("active");
  });

  it("resolves an older payment recorded without its subscription through the invoice", async () => {
    const target = await sub("org_a", await site("org_a", "a.test"), { stripeSubscriptionId: "sub_invoice" });
    await sub("org_a", await site("org_a", "b.test"), { stripeSubscriptionId: "sub_other" });
    const paid = await payment({});
    stripeMock.invoicesRetrieve.mockResolvedValue({
      parent: { subscription_details: { subscription: "sub_invoice" } },
      payments: { data: [{ payment: { type: "payment_intent", payment_intent: "pi_1" } }] },
    });

    expect((await refundPayment(paid, "goodwill", { cancelSubscription: true })).ok).toBe(true);
    expect(stripeMock.subscriptionsCancel).toHaveBeenCalledWith("sub_invoice", {}, expect.anything());
    expect(await statusOf(target)).toBe("canceled");
  });

  it("refuses - before any money moves - when the subscription cannot be told", async () => {
    await sub("org_a", await site("org_a", "a.test"), { stripeSubscriptionId: "sub_a" });
    const paid = await payment({ externalId: "pi_direct" });

    const result = await refundPayment(paid, "customer asked", { cancelSubscription: true });

    expect(!result.ok && result.error).toMatch(/nothing was refunded/);
    expect(stripeMock.refundsCreate).not.toHaveBeenCalled();
    expect(stripeMock.subscriptionsCancel).not.toHaveBeenCalled();
  });

  it("refuses a payment whose recorded subscription belongs to another workspace", async () => {
    const foreign = await sub("org_b", await site("org_b", "b.test"), { stripeSubscriptionId: "sub_foreign" });
    const paid = await payment({ providerSubscriptionId: "sub_foreign", subscriptionId: foreign });

    const result = await refundPayment(paid, "customer asked", { cancelSubscription: true });

    expect(result.ok).toBe(false);
    expect(stripeMock.refundsCreate).not.toHaveBeenCalled();
    expect(await statusOf(foreign)).toBe("active");
  });

  it("keeps the local status when Stripe fails to cancel", async () => {
    const target = await sub("org_a", await site("org_a", "a.test"), { stripeSubscriptionId: "sub_a" });
    const paid = await payment({ providerSubscriptionId: "sub_a", subscriptionId: target });
    stripeMock.subscriptionsCancel.mockRejectedValueOnce(new Error("Stripe is down"));

    const result = await refundPayment(paid, "customer asked", { cancelSubscription: true });

    expect(result).toEqual({ ok: true, data: { refunded: 4000, cancelled: false } });
    expect(await statusOf(target)).toBe("active");
  });

  it("prorates against the paid website's usage, not the newest site's", async () => {
    const usedSite = await site("org_a", "a.test");
    state.usedSite = usedSite;
    const target = await sub("org_a", usedSite, {
      stripeSubscriptionId: "sub_a",
      createdAt: new Date("2026-01-01T00:00:00Z"),
    });
    await sub("org_a", await site("org_a", "b.test"), {
      stripeSubscriptionId: "sub_b",
      createdAt: new Date("2026-06-01T00:00:00Z"),
    });
    const paid = await payment({ providerSubscriptionId: "sub_a", subscriptionId: target });

    const quote = await quoteRefund(paid);
    expect(quote).toMatchObject({ ok: true, data: { articlesUsed: 20, suggestedCents: 2000 } });
  });
});

describe("PayPal cancellation from the app", () => {
  it("cancels exactly the named website's subscription and records what PayPal says", async () => {
    const siteA = await site("org_a", "a.test");
    const siteB = await site("org_a", "b.test");
    const a = await sub("org_a", siteA, { provider: "paypal", paypalSubscriptionId: "I-A" });
    const b = await sub("org_a", siteB, { provider: "paypal", paypalSubscriptionId: "I-B" });
    paypalMock.getSubscription.mockResolvedValue({ id: "I-B", status: "CANCELLED", custom_id: `org_a:${siteB}` });

    expect(await cancelPayPalSubscription(siteB)).toEqual({ ok: true });
    expect(paypalMock.cancelSubscription).toHaveBeenCalledTimes(1);
    expect(paypalMock.cancelSubscription).toHaveBeenCalledWith("I-B");
    expect(await statusOf(b)).toBe("canceled");
    expect(await statusOf(a)).toBe("active");
  });

  it("refuses another workspace's website", async () => {
    const theirs = await site("org_b", "b.test");
    await sub("org_b", theirs, { provider: "paypal", paypalSubscriptionId: "I-THEIRS" });

    expect(await cancelPayPalSubscription(theirs)).toMatchObject({ ok: false });
    expect(paypalMock.cancelSubscription).not.toHaveBeenCalled();
  });

  it("refuses a website billed by card", async () => {
    const mine = await site("org_a", "a.test");
    await sub("org_a", mine, { stripeSubscriptionId: "sub_card" });
    expect(await cancelPayPalSubscription(mine)).toMatchObject({ ok: false });
  });

  it("does not mark anything cancelled when PayPal refuses", async () => {
    const mine = await site("org_a", "a.test");
    const row = await sub("org_a", mine, { provider: "paypal", paypalSubscriptionId: "I-A" });
    const { PayPalError } = await import("@/lib/paypal/client");
    paypalMock.cancelSubscription.mockRejectedValueOnce(new PayPalError("no", "rejected", 422));

    expect(await cancelPayPalSubscription(mine)).toMatchObject({ ok: false });
    expect(await statusOf(row)).toBe("active");
  });
});

describe("the Stripe portal's cancel screen", () => {
  beforeEach(async () => {
    await test.client.exec(
      "insert into billing_customers (organization_id, stripe_customer_id) values ('org_a', 'cus_a')",
    );
    stripeMock.portalCreate.mockResolvedValue({ url: "https://billing.stripe.test/cancel" });
  });

  it("opens on the selected website's subscription", async () => {
    await sub("org_a", await site("org_a", "old.test"), {
      stripeSubscriptionId: "sub_old",
      createdAt: new Date("2026-01-01T00:00:00Z"),
    });
    const chosen = await site("org_a", "new.test");
    await sub("org_a", chosen, { stripeSubscriptionId: "sub_new", createdAt: new Date("2025-01-01T00:00:00Z") });

    expect(await createPortalSession("cancel", chosen)).toEqual({ url: "https://billing.stripe.test/cancel" });
    expect(stripeMock.portalCreate.mock.calls[0][0].flow_data.subscription_cancel.subscription).toBe("sub_new");
  });

  it("refuses without a website, or for another workspace's", async () => {
    const theirs = await site("org_b", "b.test");
    await sub("org_b", theirs, { stripeSubscriptionId: "sub_theirs" });

    expect(await createPortalSession("cancel")).toHaveProperty("error");
    expect(await createPortalSession("cancel", theirs)).toHaveProperty("error");
    expect(stripeMock.portalCreate).not.toHaveBeenCalled();
  });
});
