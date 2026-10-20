import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";

import { stripeBillingSource, stripeCouponGateway } from "./billing-source";
import { connectAccountGateway } from "./connect-onboarding";
import { classifyStripeError } from "./errors";
import { partnerWorkFor, PARTNER_PLATFORM_EVENTS } from "./event-normalizer";

/**
 * The Stripe adapters against payloads shaped like the installed SDK's
 * types (stripe 22.6.0, API 2026-08-26.dahlia): what counts as collected,
 * what is read in full, and which events mean what. No network.
 */

function list<T>(items: T[]) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const item of items) yield item;
    },
  };
}

function fakeStripe(options: {
  invoice: Partial<Stripe.Invoice>;
  lines?: Partial<Stripe.InvoiceLineItem>[];
  payments: Partial<Stripe.InvoicePayment>[];
  intents?: Record<string, Partial<Stripe.PaymentIntent>>;
  charges?: Record<string, Partial<Stripe.Charge>>;
  disputes?: Partial<Stripe.Dispute>[];
}) {
  const calls: string[] = [];
  const stripe = {
    invoices: {
      retrieve: vi.fn(async (id: string, params: unknown) => {
        calls.push(`invoices.retrieve ${id} ${JSON.stringify(params)}`);
        return { id, object: "invoice", livemode: false, ...options.invoice };
      }),
      listLineItems: vi.fn((id: string) => {
        calls.push(`invoices.listLineItems ${id}`);
        return list(options.lines ?? []);
      }),
    },
    invoicePayments: {
      list: vi.fn((params: unknown) => {
        calls.push(`invoicePayments.list ${JSON.stringify(params)}`);
        return list(options.payments);
      }),
    },
    paymentIntents: {
      retrieve: vi.fn(async (id: string) => ({ id, ...options.intents?.[id] })),
    },
    charges: {
      retrieve: vi.fn(async (id: string) => ({ id, ...options.charges?.[id] })),
    },
    disputes: {
      list: vi.fn(() => list(options.disputes ?? [])),
    },
  };
  return { stripe: stripe as unknown as Stripe, calls };
}

const subscriptionLine = (amount: number) => ({ id: `il_${amount}`, amount, parent: { type: "subscription_item_details", subscription_item_details: { proration: false } } }) as unknown as Stripe.InvoiceLineItem;

describe("stripeBillingSource.loadInvoice", () => {
  const baseInvoice = {
    currency: "eur",
    customer: "cus_1",
    status: "paid" as const,
    billing_reason: "subscription_cycle" as const,
    total: 9900,
    subtotal: 9900,
    total_excluding_tax: 8115,
    total_taxes: [{ amount: 1785, tax_behavior: "inclusive" }],
    total_discount_amounts: [],
    starting_balance: 0,
    amount_paid: 9900,
    amount_paid_off_stripe: 0,
    post_payment_credit_notes_amount: 0,
    pre_payment_credit_notes_amount: 0,
    parent: { subscription_details: { subscription: "sub_1" } },
    discounts: [{ id: "di_1", object: "discount", promotion_code: "promo_1" }],
    lines: { data: [subscriptionLine(9900)], has_more: false },
  } as unknown as Partial<Stripe.Invoice>;

  it("verifies each invoice payment against its succeeded payment intent and captured charge", async () => {
    const { stripe } = fakeStripe({
      invoice: baseInvoice,
      payments: [
        { id: "inpay_ok", status: "paid", amount_paid: 9900, currency: "eur", payment: { type: "payment_intent", payment_intent: "pi_ok" }, status_transitions: { paid_at: 1790000000, canceled_at: null } },
      ] as unknown as Stripe.InvoicePayment[],
      intents: { pi_ok: { status: "succeeded", amount_received: 9900, latest_charge: { id: "ch_ok", captured: true, status: "succeeded" } as Stripe.Charge } },
    });
    const invoice = await stripeBillingSource(stripe, "test").loadInvoice("in_1");
    expect(invoice).toMatchObject({ total: BigInt(9900), tax: BigInt(1785), subscriptionId: "sub_1", customerId: "cus_1", allLinesSubscription: true, promotionCodeIds: ["promo_1"] });
    expect(invoice.collections).toEqual([
      expect.objectContaining({ invoicePaymentId: "inpay_ok", cash: BigInt(9900), verified: true, chargeId: "ch_ok", paymentIntentId: "pi_ok", outOfBand: false, paidAt: new Date(1790000000 * 1000) }),
    ]);
  });

  it("does not verify a payment intent that did not succeed, an amount not received, or an uncaptured charge", async () => {
    const { stripe } = fakeStripe({
      invoice: baseInvoice,
      payments: [
        { id: "inpay_a", status: "paid", amount_paid: 9900, currency: "eur", payment: { type: "payment_intent", payment_intent: "pi_a" }, status_transitions: { paid_at: 1, canceled_at: null } },
        { id: "inpay_b", status: "paid", amount_paid: 9900, currency: "eur", payment: { type: "payment_intent", payment_intent: "pi_b" }, status_transitions: { paid_at: 1, canceled_at: null } },
        { id: "inpay_c", status: "open", amount_paid: null, currency: "eur", payment: { type: "payment_intent", payment_intent: "pi_c" }, status_transitions: { paid_at: null, canceled_at: null } },
        { id: "inpay_d", status: "paid", amount_paid: 9900, currency: "eur", payment: { type: "payment_record", payment_record: "pr_1" }, status_transitions: { paid_at: 1, canceled_at: null } },
      ] as unknown as Stripe.InvoicePayment[],
      intents: {
        pi_a: { status: "processing", amount_received: 0, latest_charge: null },
        pi_b: { status: "succeeded", amount_received: 5000, latest_charge: { id: "ch_b", captured: true, status: "succeeded" } as Stripe.Charge },
      },
    });
    const { collections } = await stripeBillingSource(stripe, "test").loadInvoice("in_1");
    expect(collections.map((c) => [c.invoicePaymentId, c.verified, c.outOfBand, c.cash])).toEqual([
      ["inpay_a", false, false, BigInt(9900)],
      ["inpay_b", false, false, BigInt(9900)],
      ["inpay_c", false, false, BigInt(0)],
      ["inpay_d", false, true, BigInt(9900)],
    ]);
  });

  it("reads every line when Stripe says there are more, and flags non-subscription lines", async () => {
    const { stripe, calls } = fakeStripe({
      invoice: { ...baseInvoice, lines: { data: [subscriptionLine(9900)], has_more: true } as unknown as Stripe.ApiList<Stripe.InvoiceLineItem> },
      lines: [subscriptionLine(9900), { id: "il_x", amount: 500, parent: { type: "invoice_item_details" } } as unknown as Stripe.InvoiceLineItem],
      payments: [],
    });
    const invoice = await stripeBillingSource(stripe, "test").loadInvoice("in_1");
    expect(calls.some((c) => c.startsWith("invoices.listLineItems"))).toBe(true);
    expect(invoice.allLinesSubscription).toBe(false);
  });

  it("records the price each line charged, so the partner sees which plan a commission came from", async () => {
    const priced = (price: unknown) => ({ ...subscriptionLine(9900), pricing: { type: "price_details", price_details: { price, product: "prod_1" } } }) as unknown as Stripe.InvoiceLineItem;
    const { stripe } = fakeStripe({
      invoice: { ...baseInvoice, lines: { data: [priced("price_grow"), priced({ id: "price_expanded" }), subscriptionLine(100)], has_more: false } as unknown as Stripe.ApiList<Stripe.InvoiceLineItem> },
      payments: [],
    });
    const invoice = await stripeBillingSource(stripe, "test").loadInvoice("in_1");
    expect((invoice.evidence.lines as { price: string | null }[]).map((line) => line.price)).toEqual(["price_grow", "price_expanded", null]);
  });

  it("reads a charge's cumulative refunds and every dispute", async () => {
    const { stripe } = fakeStripe({
      invoice: baseInvoice,
      payments: [],
      charges: { ch_1: { currency: "eur", amount: 9900, amount_captured: 9900, amount_refunded: 4950, payment_intent: "pi_1" } },
      disputes: [{ id: "dp_1", status: "lost", amount: 4950, currency: "eur" }],
    });
    expect(await stripeBillingSource(stripe, "test").loadCharge("ch_1")).toEqual({
      environment: "test",
      chargeId: "ch_1",
      paymentIntentId: "pi_1",
      currency: "eur",
      amount: BigInt(9900),
      refunded: BigInt(4950),
      disputes: [{ id: "dp_1", status: "lost", amount: BigInt(4950), currency: "eur" }],
    });
  });
});

describe("connectAccountGateway (Accounts v2)", () => {
  function connectStripe(options: { create?: () => Promise<unknown>; schedule?: () => Promise<unknown> } = {}) {
    const calls: { method: string; params: unknown; options: unknown }[] = [];
    const stripe = {
      v2: {
        core: {
          accounts: {
            create: vi.fn(async (params: unknown, requestOptions: unknown) => {
              calls.push({ method: "v2.core.accounts.create", params, options: requestOptions });
              return options.create ? options.create() : { id: "acct_v2", object: "v2.core.account" };
            }),
          },
        },
      },
      balanceSettings: {
        update: vi.fn(async (params: unknown, requestOptions: unknown) => {
          calls.push({ method: "balanceSettings.update", params, options: requestOptions });
          return options.schedule ? options.schedule() : { object: "balance_settings" };
        }),
      },
      accounts: {
        create: vi.fn(async () => {
          throw new Error("Accounts v1 creation must not be used");
        }),
      },
    };
    return { stripe: stripe as unknown as Stripe, calls };
  }
  const input = { partnerId: "p1", email: "partner@example.test", country: "IT", idempotencyKey: "partner-account:p1:test" };

  it("creates the partner's account with Accounts v2 (Express, RepGet pays fees and losses, transfers only), then makes payouts manual", async () => {
    const { stripe, calls } = connectStripe();
    expect(await connectAccountGateway(stripe, "test").createConnectedAccount(input)).toEqual({ kind: "succeeded", value: { accountId: "acct_v2" } });
    expect(calls.map((c) => c.method)).toEqual(["v2.core.accounts.create", "balanceSettings.update"]);
    expect(calls[0].params).toEqual({
      contact_email: "partner@example.test",
      identity: { country: "it" },
      dashboard: "express",
      defaults: {
        responsibilities: { fees_collector: "application", losses_collector: "application" },
        profile: { product_description: "Affiliate partner promoting RepGet" },
      },
      configuration: { recipient: { capabilities: { stripe_balance: { stripe_transfers: { requested: true } } } } },
      metadata: { repget_partner_id: "p1", repget_environment: "test", repget_purpose: "partner_payouts" },
    });
    // The same key on every attempt: a lost answer can never make a second account.
    expect(calls[0].options).toEqual({ idempotencyKey: "partner-account:p1:test" });
    expect(calls[1]).toMatchObject({ params: { payments: { payouts: { schedule: { interval: "manual" } } } }, options: { stripeAccount: "acct_v2" } });
  });

  it("keeps a created account when the schedule step fails (it is repaired when the account is read)", async () => {
    const { stripe } = connectStripe({
      schedule: async () => {
        throw Object.assign(new Error("timeout"), { type: "StripeConnectionError" });
      },
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await connectAccountGateway(stripe, "test").createConnectedAccount(input)).toEqual({ kind: "succeeded", value: { accountId: "acct_v2" } });
    warn.mockRestore();
  });

  it("reports a refusal and a lost answer as Stripe gave them", async () => {
    const refused = connectStripe({
      create: async () => {
        throw Object.assign(new Error("Invalid country"), { type: "StripeInvalidRequestError", statusCode: 400, code: "parameter_invalid" });
      },
    });
    expect(await connectAccountGateway(refused.stripe, "test").createConnectedAccount(input)).toMatchObject({ kind: "refused", code: "parameter_invalid" });
    expect(refused.calls.map((c) => c.method)).toEqual(["v2.core.accounts.create"]);
    const lost = connectStripe({
      create: async () => {
        throw Object.assign(new Error("socket hang up"), { type: "StripeConnectionError" });
      },
    });
    expect(await connectAccountGateway(lost.stripe, "test").createConnectedAccount(input)).toMatchObject({ kind: "unknown" });
  });

  it("makes payouts manual on demand, on the partner's account", async () => {
    const { stripe, calls } = connectStripe();
    await connectAccountGateway(stripe, "test").ensureManualPayouts("acct_v2");
    expect(calls).toMatchObject([{ method: "balanceSettings.update", options: { stripeAccount: "acct_v2" } }]);
  });
});

describe("partnerWorkFor", () => {
  const event = (type: string, object: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
    ({ id: "evt_1", object: "event", type, livemode: false, created: 1, data: { object }, ...extra }) as unknown as Stripe.Event;

  it("maps each platform event to the object whose current state is read", () => {
    expect(partnerWorkFor(event("invoice.paid", { object: "invoice", id: "in_1" }))).toEqual({ kind: "invoice", objectId: "in_1", environment: "test" });
    expect(partnerWorkFor(event("invoice_payment.paid", { object: "invoice_payment", id: "inpay_1", invoice: "in_2" }))?.objectId).toBe("in_2");
    expect(partnerWorkFor(event("credit_note.created", { object: "credit_note", id: "cn_1", invoice: "in_3" }))?.objectId).toBe("in_3");
    expect(partnerWorkFor(event("charge.refunded", { object: "charge", id: "ch_1" }))).toEqual({ kind: "charge", objectId: "ch_1", environment: "test" });
    expect(partnerWorkFor(event("charge.dispute.closed", { object: "dispute", id: "dp_1", charge: "ch_2" }))?.objectId).toBe("ch_2");
    expect(partnerWorkFor(event("refund.updated", { object: "refund", id: "re_1", charge: "ch_3" }))?.objectId).toBe("ch_3");
    expect(partnerWorkFor(event("transfer.reversed", { object: "transfer", id: "tr_1" }))).toMatchObject({ kind: "transfer", objectId: "tr_1" });
    expect(partnerWorkFor(event("invoice.paid", { object: "invoice", id: "in_9" }, { livemode: true }))?.environment).toBe("live");
  });

  it("ignores unrelated events and anything from a connected account", () => {
    expect(partnerWorkFor(event("customer.subscription.updated", { id: "sub_1" }))).toBeNull();
    expect(partnerWorkFor(event("invoice.paid", { object: "invoice", id: "in_1" }, { account: "acct_1" }))).toBeNull();
    for (const type of PARTNER_PLATFORM_EVENTS) expect(typeof type).toBe("string");
  });
});

describe("classifyStripeError", () => {
  it("treats only a 4xx as a definite refusal; timeouts, 5xx and idempotency conflicts are unknown", () => {
    expect(classifyStripeError({ type: "StripeInvalidRequestError", statusCode: 400, code: "balance_insufficient", message: "x" })).toMatchObject({ kind: "refused", code: "balance_insufficient" });
    expect(classifyStripeError({ type: "StripeRateLimitError", statusCode: 429, message: "x" })).toMatchObject({ kind: "refused", code: "rate_limited" });
    expect(classifyStripeError({ type: "StripeConnectionError", message: "ETIMEDOUT" })).toMatchObject({ kind: "unknown" });
    expect(classifyStripeError({ type: "StripeAPIError", statusCode: 500, message: "x" })).toMatchObject({ kind: "unknown" });
    expect(classifyStripeError({ type: "StripeIdempotencyError", statusCode: 409, message: "x" })).toMatchObject({ kind: "unknown" });
    expect(classifyStripeError(new Error("socket hang up"))).toMatchObject({ kind: "unknown" });
  });
});

describe("stripeCouponGateway", () => {
  it("creates the coupon and its promotion code with stable idempotency keys and the restrictions", async () => {
    const created: unknown[] = [];
    const stripe = {
      coupons: { create: vi.fn(async (params: unknown, options: unknown) => (created.push(["coupon", params, options]), { id: "co_1" })) },
      promotionCodes: { create: vi.fn(async (params: unknown, options: unknown) => (created.push(["promo", params, options]), { id: "promo_1" })) },
    } as unknown as Stripe;
    const ids = await stripeCouponGateway(stripe).createCouponWithCode({
      name: "Launch (SAVE10)",
      percentOffBasisPoints: 1000,
      amountOff: null,
      currency: null,
      duration: "repeating",
      durationInMonths: 3,
      appliesToProducts: ["prod_1"],
      code: "SAVE10",
      expiresAt: new Date("2027-01-01T00:00:00Z"),
      maxRedemptions: 50,
      firstTimeTransaction: true,
      metadata: { repget_partner_id: "p1" },
      idempotencyKey: "partner-coupon:c1",
      active: false,
    });
    expect(ids).toEqual({ couponId: "co_1", promotionCodeId: "promo_1" });
    expect(created).toEqual([
      ["coupon", expect.objectContaining({ percent_off: 10, duration: "repeating", duration_in_months: 3, applies_to: { products: ["prod_1"] } }), { idempotencyKey: "partner-coupon:c1:coupon" }],
      ["promo", expect.objectContaining({ promotion: { type: "coupon", coupon: "co_1" }, code: "SAVE10", active: false, max_redemptions: 50, expires_at: 1798761600, restrictions: { first_time_transaction: true } }), { idempotencyKey: "partner-coupon:c1:promotion" }],
    ]);
  });
});
