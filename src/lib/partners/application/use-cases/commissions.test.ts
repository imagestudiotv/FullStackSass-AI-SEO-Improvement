import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";

import {
  partnerAttributions,
  partnerCommissions,
  partnerLedgerEntries,
  partnerPaymentFacts,
  partnerProviderEvents,
  partnerReviewCases,
  partnerCoupons,
  payments,
  referrals,
} from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import {
  fakeBilling,
  partnerTestDeps,
  seedActiveSubscription,
  seedPartner,
  seedStripeCustomer,
  seedUser,
  seedWorkspace,
  setControl,
} from "@/test/partners";

/**
 * Part 3: Stripe payments into commissions. Real repositories on PGlite, a
 * controlled clock, and a fake Stripe Billing that answers what Stripe would
 * report NOW (the adapter itself is tested separately). Every money example
 * from the requirements, plus refunds, disputes, windows, tiers, duplicates,
 * out-of-order and missed events.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
  isDatabaseConfigured: () => true,
}));

import { captureSignupEligibility } from "./attribute-new-customer";
import { computeBalances, matureCommissions } from "./mature-commissions";
import { processChargeAdjustments } from "./process-adjustment";
import { processInvoice } from "./process-payment";
import { processProviderEvents } from "./process-provider-events";
import { reconcileCommissions } from "./reconcile-commissions";
import { recordReferralClick } from "./record-referral-click";
import { refreshPartnerTier } from "./refresh-partner-tier";

let test: TestDb;
const DAY = 24 * 60 * 60 * 1000;

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
  await setControl(test.db, "partner_program", true);
  await setControl(test.db, "partner_commissions", true);
});

type Env = ReturnType<typeof partnerTestDeps> & { billing: ReturnType<typeof fakeBilling> };

function environment(): Env {
  const billing = fakeBilling();
  const base = partnerTestDeps(test.db, { billing: billing.source });
  return { ...base, billing };
}

/** A partner, and a new customer who opened their link and signed up: attributed, with a Stripe customer. */
async function referredCustomer(env: Env, partner?: Awaited<ReturnType<typeof seedPartner>>) {
  const p = partner ?? (await seedPartner(test.db));
  const click = await recordReferralClick(env.deps, { code: p.code, existingToken: null, landingPath: "/", referrerHost: null, visitor: randomUUID() });
  const createdAt = env.clock.now();
  const person = await seedUser(test.db, { createdAt });
  const orgId = await seedWorkspace(test.db, person.id, { createdAt });
  const captured = await captureSignupEligibility(env.deps, {
    userId: person.id,
    email: person.email,
    createdAt,
    method: "email",
    trackingToken: click.setCookie!.token,
    ipAddress: null,
    userAgent: null,
  });
  if (!captured.ok || !captured.value.attribution) throw new Error("setup: not attributed");
  const customerId = await seedStripeCustomer(test.db, orgId);
  return { partner: p, orgId, customerId, person };
}

async function commissionsFor(orgId: string) {
  const facts = await test.db.select().from(partnerPaymentFacts).where(eq(partnerPaymentFacts.organizationId, orgId));
  const rows = [];
  for (const fact of facts) {
    const [commission] = await test.db.select().from(partnerCommissions).where(eq(partnerCommissions.paymentFactId, fact.id));
    rows.push({ fact, commission: commission ?? null });
  }
  return rows.sort((a, b) => a.fact.paidAt.getTime() - b.fact.paidAt.getTime());
}

async function ledger(partnerId: string) {
  return test.db.select().from(partnerLedgerEntries).where(eq(partnerLedgerEntries.partnerId, partnerId));
}

const paidAt = (env: Env, days = 0) => new Date(env.clock.now().getTime() + days * DAY);

describe("payment to commission", () => {
  it("EUR 99.00 at 25% earns EUR 24.75, with the breakdown kept and Net 30", async () => {
    const env = environment();
    const { orgId, customerId, partner } = await referredCustomer(env);
    const at = paidAt(env, 1);
    const invoice = env.billing.invoice({ customerId, total: 9900, collections: [{ cash: 9900, paidAt: at }] });
    expect(await processInvoice(env.deps, invoice.invoiceId, "test")).toMatchObject({ outcome: "commissioned", partnerIds: [partner.partnerId] });
    const [{ fact, commission }] = await commissionsFor(orgId);
    expect(fact).toMatchObject({ cashCollected: BigInt(9900), eligibleBase: BigInt(9900), taxShare: BigInt(0), outcome: "commissioned" });
    expect(commission).toMatchObject({ amount: BigInt(2475), rateBasisPoints: 2500, tierKey: "base", programVersion: 1, status: "pending", reviewState: "approved" });
    expect(commission!.maturesAt.toISOString()).toBe(new Date(at.getTime() + 30 * DAY).toISOString());
    const entries = await ledger(partner.partnerId);
    expect(entries.map((e) => [e.kind, e.amount])).toEqual([["commission_earned", BigInt(2475)]]);
    const [attribution] = await test.db.select().from(partnerAttributions).where(eq(partnerAttributions.organizationId, orgId));
    expect(attribution.windowStartsAt?.toISOString()).toBe(at.toISOString());
    expect(attribution.windowEndsAt?.toISOString()).toBe(new Date(Date.UTC(at.getUTCFullYear() + 1, at.getUTCMonth(), at.getUTCDate(), at.getUTCHours())).toISOString());
  });

  it("EUR 89.10 after a discount earns EUR 22.28: the discount is not subtracted twice", async () => {
    const env = environment();
    const { orgId, customerId } = await referredCustomer(env);
    const invoice = env.billing.invoice({ customerId, total: 8910, discount: 990, collections: [{ cash: 8910, paidAt: paidAt(env, 1) }] });
    await processInvoice(env.deps, invoice.invoiceId, "test");
    expect((await commissionsFor(orgId))[0].commission?.amount).toBe(BigInt(2228));
  });

  it("excludes inclusive tax, and credit balance (only cash counts)", async () => {
    const env = environment();
    const taxed = await referredCustomer(env);
    await processInvoice(env.deps, env.billing.invoice({ customerId: taxed.customerId, total: 9900, tax: 1785, collections: [{ cash: 9900, paidAt: paidAt(env, 1) }] }).invoiceId, "test");
    // 81.15 x 25% = 20.2875 -> 20.29
    expect((await commissionsFor(taxed.orgId))[0]).toMatchObject({ fact: { eligibleBase: BigInt(8115) }, commission: { amount: BigInt(2029) } });

    const credited = await referredCustomer(env);
    await processInvoice(env.deps, env.billing.invoice({ customerId: credited.customerId, total: 9900, collections: [{ cash: 5900, paidAt: paidAt(env, 1) }] }).invoiceId, "test");
    expect((await commissionsFor(credited.orgId))[0].commission?.amount).toBe(BigInt(1475));
  });

  it("counts partial collections once each, never the invoice total twice", async () => {
    const env = environment();
    const { orgId, customerId, partner } = await referredCustomer(env);
    const invoice = env.billing.invoice({ customerId, total: 9900, collections: [{ cash: 5000, paidAt: paidAt(env, 1) }, { cash: 4900, paidAt: paidAt(env, 2) }] });
    await processInvoice(env.deps, invoice.invoiceId, "test");
    await processInvoice(env.deps, invoice.invoiceId, "test");
    const rows = await commissionsFor(orgId);
    expect(rows.map((r) => r.commission?.amount)).toEqual([BigInt(1250), BigInt(1225)]);
    expect((await ledger(partner.partnerId)).filter((e) => e.kind === "commission_earned")).toHaveLength(2);
  });

  it("earns nothing on a free trial, a zero invoice, or a failed or out-of-band payment", async () => {
    const env = environment();
    const { orgId, customerId } = await referredCustomer(env);
    await processInvoice(env.deps, env.billing.invoice({ customerId, total: 0, collections: [{ cash: 0, paidAt: paidAt(env, 0) }] }).invoiceId, "test");
    await processInvoice(env.deps, env.billing.invoice({ customerId, total: 9900, collections: [{ cash: 9900, paidAt: paidAt(env, 1), verified: false }] }).invoiceId, "test");
    await processInvoice(env.deps, env.billing.invoice({ customerId, total: 9900, collections: [{ cash: 9900, paidAt: paidAt(env, 2), outOfBand: true }] }).invoiceId, "test");
    const rows = await commissionsFor(orgId);
    expect(rows.every((r) => r.commission === null)).toBe(true);
    expect(rows.map((r) => r.fact.outcome)).toEqual(["zero_base"]);
  });

  it("makes exactly one more commission per renewal, and none twice for one invoice", async () => {
    const env = environment();
    const { orgId, customerId } = await referredCustomer(env);
    const first = env.billing.invoice({ customerId, total: 9900, collections: [{ cash: 9900, paidAt: paidAt(env, 1) }] });
    const renewal = env.billing.invoice({ customerId, total: 9900, collections: [{ cash: 9900, paidAt: paidAt(env, 31) }] });
    await processInvoice(env.deps, first.invoiceId, "test");
    await processInvoice(env.deps, renewal.invoiceId, "test");
    await processInvoice(env.deps, renewal.invoiceId, "test");
    expect((await commissionsFor(orgId)).map((r) => r.commission?.amount)).toEqual([BigInt(2475), BigInt(2475)]);
  });

  it("follows the 12-month window to the millisecond, for monthly and annual payments", async () => {
    const env = environment();
    const { orgId, customerId } = await referredCustomer(env);
    const start = paidAt(env, 1);
    await processInvoice(env.deps, env.billing.invoice({ customerId, total: 99000, collections: [{ cash: 99000, paidAt: start }] }).invoiceId, "test");
    const end = new Date(Date.UTC(start.getUTCFullYear() + 1, start.getUTCMonth(), start.getUTCDate(), start.getUTCHours()));
    await processInvoice(env.deps, env.billing.invoice({ customerId, total: 9900, collections: [{ cash: 9900, paidAt: new Date(end.getTime() - 1) }] }).invoiceId, "test");
    await processInvoice(env.deps, env.billing.invoice({ customerId, total: 99000, collections: [{ cash: 99000, paidAt: end }] }).invoiceId, "test");
    const rows = await commissionsFor(orgId);
    expect(rows.map((r) => [r.fact.outcome, r.commission?.amount ?? null])).toEqual([
      ["commissioned", BigInt(24750)],
      ["commissioned", BigInt(2475)],
      ["outside_window", null],
    ]);
  });

  it("commissions upgrade prorations on what was paid, and nothing on a downgrade credit", async () => {
    const env = environment();
    const { orgId, customerId } = await referredCustomer(env);
    await processInvoice(env.deps, env.billing.invoice({ customerId, total: 20000, collections: [{ cash: 20000, paidAt: paidAt(env, 1) }] }).invoiceId, "test");
    await processInvoice(env.deps, env.billing.invoice({ customerId, total: -5000, collections: [] }).invoiceId, "test");
    expect((await commissionsFor(orgId)).map((r) => r.commission?.amount)).toEqual([BigInt(5000)]);
  });

  it("turns facts that do not add up into a review case instead of a guess", async () => {
    const env = environment();
    const { orgId, customerId } = await referredCustomer(env);
    const mixed = env.billing.invoice({ customerId, total: 9900, allLinesSubscription: false, collections: [{ cash: 9900, paidAt: paidAt(env, 1) }] });
    expect(await processInvoice(env.deps, mixed.invoiceId, "test")).toMatchObject({ outcome: "review" });
    const huf = env.billing.invoice({ customerId, currency: "huf", total: 9900, collections: [{ cash: 9900, paidAt: paidAt(env, 2) }] });
    expect(await processInvoice(env.deps, huf.invoiceId, "test")).toMatchObject({ outcome: "review" });
    expect(await commissionsFor(orgId)).toHaveLength(0);
    const cases = await test.db.select().from(partnerReviewCases).where(eq(partnerReviewCases.organizationId, orgId));
    expect(cases.map((c) => c.kind)).toEqual(["financial_inconsistency", "financial_inconsistency"]);
  });

  it("holds the cash commission for review when the customer is also a credit referral", async () => {
    const env = environment();
    const { orgId, customerId } = await referredCustomer(env);
    const referrer = await seedWorkspace(test.db, (await seedUser(test.db)).id);
    await test.db.insert(referrals).values({ referrerOrgId: referrer, referredOrgId: orgId, status: "pending" });
    await processInvoice(env.deps, env.billing.invoice({ customerId, total: 9900, collections: [{ cash: 9900, paidAt: paidAt(env, 1) }] }).invoiceId, "test");
    expect((await commissionsFor(orgId))[0].commission).toMatchObject({ reviewState: "needs_review" });
    const cases = await test.db.select().from(partnerReviewCases).where(eq(partnerReviewCases.organizationId, orgId));
    expect(cases.map((c) => c.kind)).toContain("credit_cash_conflict");
  });

  it("ignores customers that are neither attributed nor eligible, without calling Stripe", async () => {
    const env = environment();
    const person = await seedUser(test.db);
    const orgId = await seedWorkspace(test.db, person.id);
    const customerId = await seedStripeCustomer(test.db, orgId);
    const invoice = env.billing.invoice({ customerId, total: 9900, collections: [{ cash: 9900, paidAt: paidAt(env, 1) }] });
    await test.db.insert(payments).values({ organizationId: orgId, provider: "stripe", externalId: invoice.invoiceId, amountCents: 9900, currency: "eur", status: "paid", paidAt: paidAt(env, 1) });
    expect(await processInvoice(env.deps, invoice.invoiceId, "test")).toMatchObject({ outcome: "not_relevant" });
    expect(env.billing.reads).toEqual([]);
  });
});

describe("refunds and disputes", () => {
  async function commissioned(env: Env) {
    const customer = await referredCustomer(env);
    const invoice = env.billing.invoice({ customerId: customer.customerId, total: 9900, collections: [{ cash: 9900, paidAt: paidAt(env, 1) }] });
    await processInvoice(env.deps, invoice.invoiceId, "test");
    const chargeId = invoice.collections[0].chargeId!;
    return { ...customer, invoice, chargeId };
  }
  const current = async (orgId: string) => (await commissionsFor(orgId))[0].commission!;

  it("reverses partial, repeated and full refunds cumulatively, never more than the commission", async () => {
    const env = environment();
    const { orgId, chargeId, partner } = await commissioned(env);
    env.billing.setCharge(chargeId, { refunded: 4950 });
    await processChargeAdjustments(env.deps, chargeId, "test");
    await processChargeAdjustments(env.deps, chargeId, "test"); // the same refund, delivered twice
    expect((await current(orgId)).reversedAmount).toBe(BigInt(1238));
    env.billing.setCharge(chargeId, { refunded: 9900 });
    await processChargeAdjustments(env.deps, chargeId, "test");
    const commission = await current(orgId);
    expect(commission).toMatchObject({ reversedAmount: BigInt(2475), status: "reversed" });
    const entries = await ledger(partner.partnerId);
    expect(entries.reduce((sum, e) => sum + e.amount, BigInt(0))).toBe(BigInt(0));
    expect(entries.filter((e) => e.kind === "commission_adjustment").map((e) => e.amount)).toEqual([BigInt(-1238), BigInt(-1237)]);
  });

  it("applies a refund that happened before the payment was processed", async () => {
    const env = environment();
    const customer = await referredCustomer(env);
    const invoice = env.billing.invoice({ customerId: customer.customerId, total: 9900, collections: [{ cash: 9900, paidAt: paidAt(env, 1) }] });
    env.billing.setCharge(invoice.collections[0].chargeId!, { refunded: 9900 });
    // The refund event arrives first: nothing recorded for that charge yet.
    expect(await processChargeAdjustments(env.deps, invoice.collections[0].chargeId!, "test")).toMatchObject({ outcome: "no_fact" });
    await processInvoice(env.deps, invoice.invoiceId, "test");
    expect(await current(customer.orgId)).toMatchObject({ amount: BigInt(2475), reversedAmount: BigInt(2475), status: "reversed" });
  });

  it("holds on an open dispute, releases once when won, reverses when lost", async () => {
    const env = environment();
    const { orgId, chargeId } = await commissioned(env);
    env.billing.setCharge(chargeId, { disputes: [{ status: "needs_response", amount: 9900 }] });
    await processChargeAdjustments(env.deps, chargeId, "test");
    expect((await current(orgId)).holdReason).toBe("dispute_open");
    env.billing.setCharge(chargeId, { disputes: [{ status: "won", amount: 9900 }] });
    await processChargeAdjustments(env.deps, chargeId, "test");
    await processChargeAdjustments(env.deps, chargeId, "test");
    expect(await current(orgId)).toMatchObject({ holdReason: null, reversedAmount: BigInt(0) });

    const lost = await commissioned(env);
    env.billing.setCharge(lost.chargeId, { disputes: [{ status: "lost", amount: 9900 }] });
    await processChargeAdjustments(env.deps, lost.chargeId, "test");
    expect(await current(lost.orgId)).toMatchObject({ reversedAmount: BigInt(2475), status: "reversed", holdReason: null });
  });

  it("never reverses twice for a refund and a lost dispute over the same money", async () => {
    const env = environment();
    const { orgId, chargeId, partner } = await commissioned(env);
    env.billing.setCharge(chargeId, { refunded: 6000, disputes: [{ status: "lost", amount: 9900 }] });
    await processChargeAdjustments(env.deps, chargeId, "test");
    expect((await current(orgId)).reversedAmount).toBe(BigInt(2475));
    const adjustments = (await ledger(partner.partnerId)).filter((e) => e.kind === "commission_adjustment");
    expect(adjustments.reduce((sum, e) => sum + e.amount, BigInt(0))).toBe(BigInt(-2475));
  });

  it("records a refund after payout as a negative position and a review case", async () => {
    const env = environment();
    const { orgId, chargeId, partner } = await commissioned(env);
    const commission = await current(orgId);
    await test.db.update(partnerCommissions).set({ status: "paid" }).where(eq(partnerCommissions.id, commission.id));
    // The transfer that paid it (as Part 4 would have written it).
    await test.db.insert(partnerLedgerEntries).values({ environment: "test", partnerId: partner.partnerId, currency: "eur", kind: "transfer_confirmed", amount: BigInt(-2475), operationKey: `transfer:test:${commission.id}`, reason: "test", actor: "system" });
    env.billing.setCharge(chargeId, { refunded: 9900 });
    await processChargeAdjustments(env.deps, chargeId, "test");
    expect(await current(orgId)).toMatchObject({ status: "paid", reversedAmount: BigInt(2475) });
    const balances = await computeBalances(env.deps, partner.partnerId, "test", "eur");
    expect(balances.liability).toBe(BigInt(-2475));
    const cases = await test.db.select().from(partnerReviewCases).where(eq(partnerReviewCases.commissionId, commission.id));
    expect(cases.map((c) => c.kind)).toEqual(["reconciliation"]);
  });
});

describe("tiers", () => {
  it("moves to Growth at 10 and Premier at 25 distinct paying organizations; earlier payments keep their rate", async () => {
    const env = environment();
    const partner = await seedPartner(test.db);
    const customers: Awaited<ReturnType<typeof referredCustomer>>[] = [];
    for (let i = 0; i < 25; i += 1) {
      const customer = await referredCustomer(env, partner);
      await seedActiveSubscription(test.db, customer.orgId, new Date(env.clock.now().getTime() + 20 * DAY));
      customers.push(customer);
    }
    const pay = async (index: number, at: Date) =>
      processInvoice(env.deps, env.billing.invoice({ customerId: customers[index].customerId, total: 9900, collections: [{ cash: 9900, paidAt: at }] }).invoiceId, "test");

    for (let i = 0; i < 9; i += 1) await pay(i, paidAt(env, 1));
    expect(await refreshPartnerTier(env.deps, partner.partnerId)).toMatchObject({ tier: "base", qualifyingCustomers: 9 });
    const beforePromotion = paidAt(env, 1);
    await pay(9, paidAt(env, 1));
    env.clock.advance(2 * DAY);
    expect(await refreshPartnerTier(env.deps, partner.partnerId)).toMatchObject({ tier: "growth", qualifyingCustomers: 10, changed: true });

    // A payment made BEFORE the promotion but processed after it keeps the base rate.
    const late = await referredCustomer(env, partner);
    await processInvoice(env.deps, env.billing.invoice({ customerId: late.customerId, total: 9900, collections: [{ cash: 9900, paidAt: beforePromotion }] }).invoiceId, "test");
    expect((await commissionsFor(late.orgId))[0].commission).toMatchObject({ rateBasisPoints: 2500 });
    await pay(10, paidAt(env, 1));
    expect((await commissionsFor(customers[10].orgId))[0].commission).toMatchObject({ rateBasisPoints: 3000, tierKey: "growth", amount: BigInt(2970) });

    for (let i = 11; i < 25; i += 1) await pay(i, paidAt(env, 1));
    env.clock.advance(2 * DAY);
    expect(await refreshPartnerTier(env.deps, partner.partnerId)).toMatchObject({ tier: "premier", qualifyingCustomers: 25 });
  });

  it("counts organizations, not invoices, and stops counting a lapsed or fully refunded customer", async () => {
    const env = environment();
    const partner = await seedPartner(test.db);
    const a = await referredCustomer(env, partner);
    await seedActiveSubscription(test.db, a.orgId, new Date(env.clock.now().getTime() + 20 * DAY));
    for (let i = 0; i < 3; i += 1) {
      await processInvoice(env.deps, env.billing.invoice({ customerId: a.customerId, total: 9900, collections: [{ cash: 9900, paidAt: paidAt(env, i + 1) }] }).invoiceId, "test");
    }
    const lapsed = await referredCustomer(env, partner);
    await seedActiveSubscription(test.db, lapsed.orgId, new Date(env.clock.now().getTime() - DAY));
    await processInvoice(env.deps, env.billing.invoice({ customerId: lapsed.customerId, total: 9900, collections: [{ cash: 9900, paidAt: paidAt(env, 1) }] }).invoiceId, "test");
    const refunded = await referredCustomer(env, partner);
    await seedActiveSubscription(test.db, refunded.orgId, new Date(env.clock.now().getTime() + 20 * DAY));
    const inv = env.billing.invoice({ customerId: refunded.customerId, total: 9900, collections: [{ cash: 9900, paidAt: paidAt(env, 1) }] });
    await processInvoice(env.deps, inv.invoiceId, "test");
    env.billing.setCharge(inv.collections[0].chargeId!, { refunded: 9900 });
    await processChargeAdjustments(env.deps, inv.collections[0].chargeId!, "test");
    expect(await refreshPartnerTier(env.deps, partner.partnerId)).toMatchObject({ qualifyingCustomers: 1 });
  });
});

describe("coupons at payment", () => {
  it("attributes a new customer by a partner's promotion code, and commissions it", async () => {
    const env = environment();
    const partner = await seedPartner(test.db);
    const [coupon] = await test.db
      .insert(partnerCoupons)
      .values({ environment: "test", partnerId: partner.partnerId, code: `P${randomUUID().slice(0, 7).toUpperCase()}`, campaign: "Launch", discountType: "percent_first_payment", percentOffBasisPoints: 1000, duration: "once", createdByEmail: "a@x", status: "active", stripePromotionCodeId: `promo_${randomUUID()}` })
      .returning();
    const createdAt = env.clock.now();
    const person = await seedUser(test.db, { createdAt });
    const orgId = await seedWorkspace(test.db, person.id, { createdAt });
    await captureSignupEligibility(env.deps, { userId: person.id, email: person.email, createdAt, method: "email", trackingToken: null, ipAddress: null, userAgent: null });
    const customerId = await seedStripeCustomer(test.db, orgId);
    const invoice = env.billing.invoice({ customerId, total: 8910, discount: 990, promotionCodeIds: [coupon.stripePromotionCodeId!], collections: [{ cash: 8910, paidAt: paidAt(env, 3) }] });
    expect(await processInvoice(env.deps, invoice.invoiceId, "test")).toMatchObject({ outcome: "commissioned", partnerIds: [partner.partnerId] });
    const [attribution] = await test.db.select().from(partnerAttributions).where(eq(partnerAttributions.organizationId, orgId));
    expect(attribution).toMatchObject({ source: "coupon", partnerId: partner.partnerId, couponId: coupon.id });
    expect((await commissionsFor(orgId))[0].commission?.amount).toBe(BigInt(2228));
  });
});

describe("recovery and switches", () => {
  it("recovers a payment whose webhook was missed, through reconciliation", async () => {
    const env = environment();
    const { orgId, customerId } = await referredCustomer(env);
    const invoice = env.billing.invoice({ customerId, total: 9900, collections: [{ cash: 9900, paidAt: paidAt(env, 1) }] });
    // Billing recorded the payment; the partner work for it was never recorded.
    await test.db.insert(payments).values({ organizationId: orgId, provider: "stripe", externalId: invoice.invoiceId, amountCents: 9900, currency: "eur", status: "paid", paidAt: paidAt(env, 1) });
    const report = await reconcileCommissions(env.deps);
    expect(report?.recovered).toBeGreaterThanOrEqual(1);
    const [work] = await test.db.select().from(partnerProviderEvents).where(eq(partnerProviderEvents.objectId, invoice.invoiceId));
    await processProviderEvents(env.deps, { only: [work.id] });
    expect((await commissionsFor(orgId))[0].commission?.amount).toBe(BigInt(2475));
    // A second reconciliation finds nothing more to recover for it.
    const again = await reconcileCommissions(env.deps);
    expect((await test.db.select().from(partnerProviderEvents).where(eq(partnerProviderEvents.objectId, invoice.invoiceId))).length).toBe(1);
    expect(again?.findings.filter((f) => f.subject.includes(orgId))).toEqual([]);
  });

  it("keeps recorded work waiting while commission processing is switched off", async () => {
    const env = environment();
    const { orgId, customerId } = await referredCustomer(env);
    const invoice = env.billing.invoice({ customerId, total: 9900, collections: [{ cash: 9900, paidAt: paidAt(env, 1) }] });
    const [work] = await test.db
      .insert(partnerProviderEvents)
      .values({ environment: "test", stripeEventId: `evt_${randomUUID()}`, eventType: "invoice:invoice.paid", objectId: invoice.invoiceId, eventCreatedAt: new Date(), nextAttemptAt: new Date(0) })
      .returning();
    await setControl(test.db, "partner_commissions", false);
    try {
      expect(await processProviderEvents(env.deps, { only: [work.id] })).toMatchObject({ deferred: true });
      const [waiting] = await test.db.select().from(partnerProviderEvents).where(eq(partnerProviderEvents.id, work.id));
      expect(waiting).toMatchObject({ status: "pending", attempts: 0 });
    } finally {
      await setControl(test.db, "partner_commissions", true);
    }
    expect((await processProviderEvents(env.deps, { only: [work.id] })).done).toEqual([work.id]);
    expect((await commissionsFor(orgId))[0].commission?.amount).toBe(BigInt(2475));
  });

  it("marks commissions available at Net 30", async () => {
    const env = environment();
    const { orgId, customerId } = await referredCustomer(env);
    await processInvoice(env.deps, env.billing.invoice({ customerId, total: 9900, collections: [{ cash: 9900, paidAt: paidAt(env, 0) }] }).invoiceId, "test");
    env.clock.advance(29 * DAY);
    await matureCommissions(env.deps);
    expect((await commissionsFor(orgId))[0].commission?.status).toBe("pending");
    env.clock.advance(1 * DAY + 1);
    await matureCommissions(env.deps);
    expect((await commissionsFor(orgId))[0].commission?.status).toBe("available");
  });

  it("refuses an event for another environment", async () => {
    const env = environment();
    expect(await processInvoice(env.deps, "in_whatever", "live")).toMatchObject({ outcome: "wrong_environment" });
    const rows = await test.db.select().from(partnerPaymentFacts).where(and(eq(partnerPaymentFacts.environment, "live")));
    expect(rows).toHaveLength(0);
  });
});
