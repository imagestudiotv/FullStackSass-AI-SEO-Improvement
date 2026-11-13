import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import type Stripe from "stripe";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { addonPurchases, addons, creditLedger, creditTopups, organization, paypalOrders, websiteProjects } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";

/**
 * Credits for a quote (Daniel, 2026-11-13: "When click buy credits is good to
 * having the custom credit package 1000 credits in this cases on the main top,
 * so it's already calculated how much should cost 1000 credits and purchase").
 *
 * On a disposable database with the draft migration applied, no network: the
 * quote is checked in its own workspace and revision, the shortfall priced by
 * the server at the smallest pack's rate, and the credits granted once by the
 * credit pack's own webhook and PayPal paths - never the quote paid.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
}));
const notifyMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/notifications/create", () => ({ notify: notifyMock }));
vi.mock("@/lib/stripe/client", () => ({ stripe: { subscriptions: { retrieve: vi.fn() } }, isStripeConfigured: () => true }));

import { getBalance } from "@/lib/backlinks/credits";
import { processStripeEvent } from "@/lib/billing/stripe-events";
import { fulfilCreditPack } from "@/lib/paypal/orders";

import { checkQuoteTopUp, startQuoteTopUp, topUpForReturn, type TopUpProviders } from "./quote-topup";
import { quoteCancelPath, quoteReturnPath, quoteRevisionOf, quoteShortfall, quoteTopUpHref, topUpPriceCents } from "./quote-topup-shared";

let test: TestDb;
let customAddonId: string;

beforeAll(async () => {
  // credit_topups and the inactive credits_custom add-on come from migration 0093.
  test = await createTestDb();
  state.db = test.db;
  await test.db.insert(addons).values([
    { slug: "credits_10", name: "100 credits", priceCents: 7900, creditsGranted: 100, kind: "credits", stripePriceId: "price_100", sortOrder: 1 },
    { slug: "credits_25", name: "250 credits", priceCents: 14900, creditsGranted: 250, kind: "credits", stripePriceId: "price_250", sortOrder: 2 },
    { slug: "credits_50", name: "500 credits", priceCents: 27900, creditsGranted: 500, kind: "credits", stripePriceId: "price_500", sortOrder: 3 },
  ]);
  const [custom] = await test.db.select({ id: addons.id, isActive: addons.isActive }).from(addons).where(eq(addons.slug, "credits_custom"));
  expect(custom.isActive).toBe(false);
  customAddonId = custom.id;
});
beforeEach(() => notifyMock.mockReset());

async function seed(options: { credits?: number; status?: "quoted" | "paid" | "declined"; balance?: number } = {}) {
  const organizationId = `org_${randomUUID()}`;
  await test.db.insert(organization).values({ id: organizationId, name: "W", slug: organizationId, createdAt: new Date() });
  const quotedAt = new Date(Date.now() - 60_000);
  const cost = options.credits ?? 1000;
  const status = options.status ?? "quoted";
  const [project] = await test.db
    .insert(websiteProjects)
    .values({
      organizationId,
      kind: "new",
      status,
      requestKey: randomUUID(),
      brief: "A new website for my bakery, with an online menu.",
      contactName: "Ana",
      contactEmail: "ana@example.com",
      scope: "Five pages and a menu.",
      creditCost: cost,
      quotedAt,
      ...(status === "paid" ? { creditsPaid: cost, paidAt: new Date() } : {}),
    })
    .returning({ id: websiteProjects.id });
  if (options.balance) {
    await test.db.insert(creditLedger).values({ organizationId, type: "purchase", amount: options.balance, idempotencyKey: `seed:${randomUUID()}` });
  }
  return { organizationId, projectId: project.id, revision: quoteRevisionOf(quotedAt)! };
}
type Scene = Awaited<ReturnType<typeof seed>>;

function fakeProviders() {
  const sessions: Parameters<TopUpProviders["stripe"]["createSession"]>[0][] = [];
  const orders: Parameters<TopUpProviders["paypal"]["startOrder"]>[0][] = [];
  const providers: TopUpProviders = {
    appUrl: "https://app.repget.test/",
    stripe: {
      customerFor: async () => "cus_test",
      createSession: async (params) => {
        sessions.push(params);
        return { id: `cs_test_${randomUUID()}`, url: "https://checkout.stripe.test/pay" };
      },
    },
    paypal: {
      startOrder: async (params) => {
        orders.push(params);
        return { kind: "started", url: "https://paypal.test/approve" };
      },
    },
  };
  return { providers, sessions, orders };
}

const start = (s: Scene, providers: TopUpProviders, overrides: Partial<Parameters<typeof startQuoteTopUp>[1]> = {}) =>
  startQuoteTopUp(
    test.db,
    { organizationId: s.organizationId, userId: null as unknown as string, projectId: s.projectId, revision: s.revision, expectedCredits: 1000, expectedPriceCents: 79000, provider: "stripe", locale: "en", ...overrides },
    providers,
  );

const sessionEvent = (
  type: "checkout.session.completed" | "checkout.session.async_payment_succeeded" | "checkout.session.async_payment_failed",
  sessionId: string,
  metadata: Record<string, string>,
  paymentStatus: "paid" | "unpaid",
  amount = 79000,
) =>
  ({
    id: `evt_${randomUUID()}`,
    type,
    data: { object: { id: sessionId, object: "checkout.session", mode: "payment", payment_status: paymentStatus, amount_total: amount, currency: "eur", metadata } },
  }) as unknown as Stripe.Event;

async function topUpRows(organizationId: string) {
  return test.db.select().from(creditTopups).where(eq(creditTopups.organizationId, organizationId));
}
async function quote(projectId: string) {
  const [row] = await test.db
    .select({ status: websiteProjects.status, creditCost: websiteProjects.creditCost, creditsPaid: websiteProjects.creditsPaid })
    .from(websiteProjects)
    .where(eq(websiteProjects.id, projectId));
  return row;
}

describe("the price", () => {
  it("is the smallest pack's rate, rounded up to the cent, with no bulk discount", () => {
    const rate = { priceCents: 7900, credits: 100 };
    expect(topUpPriceCents(1000, rate)).toBe(79000);
    expect(topUpPriceCents(1, rate)).toBe(79);
    expect(topUpPriceCents(1, { priceCents: 1000, credits: 3 })).toBe(334);
    expect(() => topUpPriceCents(0, rate)).toThrow();
    expect(() => topUpPriceCents(1.5, rate)).toThrow();
  });

  it("is for exactly the shortfall: 1,000 credits at EUR 790 for a 1,000-credit quote and an empty wallet", async () => {
    const s = await seed();
    const checked = await checkQuoteTopUp(test.db, s);
    expect(checked).toMatchObject({
      ok: true,
      offer: { projectId: s.projectId, quoteCredits: 1000, available: 0, credits: 1000, priceCents: 79000, currency: "eur", rate: { priceCents: 7900, credits: 100 } },
    });
  });

  it("counts the balance: 250 credits held leave 750 to buy", async () => {
    const s = await seed({ balance: 250 });
    expect(quoteShortfall(1000, 250)).toBe(750);
    expect(await checkQuoteTopUp(test.db, s)).toMatchObject({ ok: true, offer: { available: 250, credits: 750, priceCents: 59250 } });
  });
});

describe("the quote is checked on the server", () => {
  it("in its own workspace only", async () => {
    const mine = await seed();
    const theirs = await seed();
    expect(await checkQuoteTopUp(test.db, { ...mine, organizationId: theirs.organizationId })).toEqual({ ok: false, reason: "unavailable" });
  });

  it("at its current revision: a quote priced again since is stale", async () => {
    const s = await seed();
    await test.db.update(websiteProjects).set({ creditCost: 1200, quotedAt: new Date() }).where(eq(websiteProjects.id, s.projectId));
    expect(await checkQuoteTopUp(test.db, s)).toEqual({ ok: false, reason: "stale" });
  });

  it("still waiting for payment: not once paid or declined", async () => {
    expect(await checkQuoteTopUp(test.db, await seed({ status: "paid" }))).toEqual({ ok: false, reason: "unavailable" });
    expect(await checkQuoteTopUp(test.db, await seed({ status: "declined" }))).toEqual({ ok: false, reason: "unavailable" });
  });

  it("and offers nothing when the credits already cover it", async () => {
    expect(await checkQuoteTopUp(test.db, await seed({ balance: 1000 }))).toEqual({ ok: false, reason: "covered" });
  });

  it("refuses ids that are not ids", async () => {
    const s = await seed();
    expect(await checkQuoteTopUp(test.db, { ...s, projectId: "nope" })).toEqual({ ok: false, reason: "unavailable" });
    expect(await checkQuoteTopUp(test.db, { ...s, revision: "1; drop" })).toEqual({ ok: false, reason: "unavailable" });
  });
});

describe("starting the payment", () => {
  it("charges the server's amount, never the browser's: a different shown amount starts nothing", async () => {
    const s = await seed();
    const { providers, sessions } = fakeProviders();
    expect(await start(s, providers, { expectedPriceCents: 100 })).toMatchObject({ ok: false, reason: "changed" });
    expect(await start(s, providers, { expectedCredits: 10 })).toMatchObject({ ok: false, reason: "changed" });
    expect(sessions).toHaveLength(0);
    expect(await topUpRows(s.organizationId)).toEqual([]);
  });

  it("opens Stripe Checkout for a one-off amount, carrying the quote, and comes back to the quote only when paid", async () => {
    const s = await seed();
    const { providers, sessions } = fakeProviders();
    expect(await start(s, providers)).toEqual({ ok: true, url: "https://checkout.stripe.test/pay" });
    const [row] = await topUpRows(s.organizationId);
    expect(row).toMatchObject({ websiteProjectId: s.projectId, quoteRevision: s.revision, credits: 1000, amountCents: 79000, currency: "eur", rateCents: 7900, rateCredits: 100, provider: "stripe", status: "open" });
    expect(sessions[0]).toMatchObject({
      amountCents: 79000,
      currency: "eur",
      name: "1,000 RepGet credits",
      metadata: { organizationId: s.organizationId, addonId: customAddonId, topupId: row.id, websiteProjectId: s.projectId, quoteRevision: s.revision, credits: "1000" },
      idempotencyKey: `credit-topup:${row.id}`,
      successUrl: `https://app.repget.test${quoteReturnPath(s.projectId, row.id)}`,
      cancelUrl: `https://app.repget.test${quoteCancelPath(s.projectId, s.revision, "cancelled")}`,
    });
    // Paid: the quote's page. Cancelled: Billing again, with the same offer - not the quote.
    expect(sessions[0].successUrl).toContain(`/website-projects?topup=${row.id}#project-${s.projectId}`);
    expect(sessions[0].cancelUrl).toMatch(/^https:\/\/app\.repget\.test\/billing\?addon=cancelled&project=/);
    expect(row.stripeSessionId).toMatch(/^cs_test_/);
  });

  it("with PayPal, names the top-up as the order's reference", async () => {
    const s = await seed();
    const { providers, orders } = fakeProviders();
    expect(await start(s, providers, { provider: "paypal" })).toEqual({ ok: true, url: "https://paypal.test/approve" });
    const [row] = await topUpRows(s.organizationId);
    expect(orders[0]).toMatchObject({ referenceId: row.id, amountCents: 79000, currency: "eur", organizationId: s.organizationId });
  });

  it("links Billing from the quote with its id and revision", () => {
    expect(quoteTopUpHref("p1", "123")).toBe("/billing?project=p1&revision=123#quote-credits");
  });
});

describe("the credits are granted once, by the confirmed payment, and the quote is never paid", () => {
  async function started(s: Scene) {
    const { providers, sessions } = fakeProviders();
    await start(s, providers);
    const [row] = await topUpRows(s.organizationId);
    return { row, sessionId: row.stripeSessionId!, metadata: sessions[0].metadata };
  }

  it("a paid checkout grants the 1,000 credits once, however often the webhook is delivered", async () => {
    const s = await seed();
    const { row, sessionId, metadata } = await started(s);
    const paid = sessionEvent("checkout.session.completed", sessionId, metadata, "paid");
    await processStripeEvent(paid);
    await processStripeEvent(paid);
    await Promise.all([processStripeEvent(paid), processStripeEvent(sessionEvent("checkout.session.async_payment_succeeded", sessionId, metadata, "paid"))]);
    expect(await getBalance(s.organizationId)).toBe(1000);
    expect(await test.db.select().from(addonPurchases).where(eq(addonPurchases.stripeSessionId, sessionId))).toHaveLength(1);
    expect(notifyMock).toHaveBeenCalledTimes(1);
    expect(notifyMock.mock.calls[0][0]).toMatchObject({ title: "1000 credits added", href: `/website-projects#project-${s.projectId}` });
    expect(await topUpForReturn(s.organizationId, row.id, test.db)).toMatchObject({ status: "paid", credits: 1000, websiteProjectId: s.projectId });
    // The quote is untouched: same price, still waiting for "Accept and pay".
    expect(await quote(s.projectId)).toEqual({ status: "quoted", creditCost: 1000, creditsPaid: null });
  });

  it("a delayed payment grants nothing until it clears, and nothing if it fails", async () => {
    const s = await seed();
    const { row, sessionId, metadata } = await started(s);
    await processStripeEvent(sessionEvent("checkout.session.completed", sessionId, metadata, "unpaid"));
    expect(await getBalance(s.organizationId)).toBe(0);
    expect((await topUpForReturn(s.organizationId, row.id, test.db))?.status).toBe("open");
    await processStripeEvent(sessionEvent("checkout.session.async_payment_failed", sessionId, metadata, "unpaid"));
    expect(await getBalance(s.organizationId)).toBe(0);
    expect((await topUpForReturn(s.organizationId, row.id, test.db))?.status).toBe("failed");

    const later = await seed();
    const second = await started(later);
    await processStripeEvent(sessionEvent("checkout.session.completed", second.sessionId, second.metadata, "unpaid"));
    await processStripeEvent(sessionEvent("checkout.session.async_payment_succeeded", second.sessionId, second.metadata, "paid"));
    expect(await getBalance(later.organizationId)).toBe(1000);
  });

  it("a cancelled checkout grants nothing: no event, no credits, the top-up stays open", async () => {
    const s = await seed();
    const { row } = await started(s);
    expect(await getBalance(s.organizationId)).toBe(0);
    expect((await topUpForReturn(s.organizationId, row.id, test.db))?.status).toBe("open");
    expect(await quote(s.projectId)).toEqual({ status: "quoted", creditCost: 1000, creditsPaid: null });
  });

  it("a payment naming another workspace's top-up grants nothing", async () => {
    const s = await seed();
    const other = await seed();
    const { sessionId, metadata } = await started(s);
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await processStripeEvent(sessionEvent("checkout.session.completed", sessionId, { ...metadata, organizationId: other.organizationId }, "paid"));
    spy.mockRestore();
    expect(await getBalance(other.organizationId)).toBe(0);
    expect(await getBalance(s.organizationId)).toBe(0);
  });

  it("with PayPal, the captured order grants the top-up's credits once", async () => {
    const s = await seed();
    const { providers } = fakeProviders();
    await start(s, providers, { provider: "paypal" });
    const [topUp] = await topUpRows(s.organizationId);
    const [order] = await test.db
      .insert(paypalOrders)
      .values({ organizationId: s.organizationId, purpose: "addon_credits", referenceId: topUp.id, amountCents: 79000, currency: "eur", description: "1,000 RepGet credits", status: "completed" })
      .returning();
    const capture = { id: "CAP-1", status: "COMPLETED" } as never;
    await fulfilCreditPack(order, capture);
    await fulfilCreditPack(order, capture);
    expect(await getBalance(s.organizationId)).toBe(1000);
    const purchases = await test.db.select().from(addonPurchases).where(and(eq(addonPurchases.paypalOrderId, order.id), eq(addonPurchases.addonId, customAddonId)));
    expect(purchases).toHaveLength(1);
    expect((await topUpForReturn(s.organizationId, topUp.id, test.db))?.status).toBe("paid");
    expect(await quote(s.projectId)).toEqual({ status: "quoted", creditCost: 1000, creditsPaid: null });
  });

  it("a credit pack bought by PayPal is granted as before", async () => {
    const s = await seed();
    const [pack] = await test.db.select({ id: addons.id }).from(addons).where(eq(addons.slug, "credits_10"));
    const [order] = await test.db
      .insert(paypalOrders)
      .values({ organizationId: s.organizationId, purpose: "addon_credits", referenceId: pack.id, amountCents: 7900, currency: "eur", description: "100 credits", status: "completed" })
      .returning();
    await fulfilCreditPack(order, { id: "CAP-2", status: "COMPLETED" } as never);
    expect(await getBalance(s.organizationId)).toBe(100);
  });
});
