import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { partnerCommissions, partnerLedgerEntries, partnerPaymentFacts, payments } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { partnerTestDeps, seedPartner, seedUser, seedWorkspace, setControl } from "@/test/partners";

import type { NormalizedPayPalSale, PayPalSaleSource } from "../ports/billing-source";

/**
 * PayPal subscription sales into partner commissions (review P7): the same
 * money as a Stripe invoice payment (commissions.test.ts) - EUR 99.00 at 25%
 * earns EUR 24.75, refunds reverse it cumulatively, a reversal (chargeback)
 * reverses all of it - through process-paypal-sale.ts. Real repositories on
 * PGlite; PayPal's sale answer is a fake that reports what PayPal would NOW.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
  isDatabaseConfigured: () => true,
}));

import { captureSignupEligibility } from "./attribute-new-customer";
import { processPayPalSale } from "./process-paypal-sale";
import { recordReferralClick } from "./record-referral-click";

let test: TestDb;

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
  await setControl(test.db, "partner_program", true);
  await setControl(test.db, "partner_commissions", true);
});

function fakePayPal(environment: "test" | "live" = "test") {
  const sales = new Map<string, NormalizedPayPalSale>();
  const orgs = new Map<string, string>();
  const source: PayPalSaleSource = {
    environment: () => environment,
    loadSale: async (id) => {
      const sale = sales.get(id);
      if (!sale) throw new Error(`no sale ${id}`);
      return sale;
    },
    organizationForSale: async (id) => orgs.get(id) ?? null,
  };
  return {
    source,
    sale(orgId: string, overrides: Partial<NormalizedPayPalSale> = {}) {
      const saleId = `SALE-${randomUUID().slice(0, 8)}`;
      sales.set(saleId, {
        environment,
        saleId,
        subscriptionId: "I-SUB",
        state: "completed",
        verified: true,
        cash: BigInt(9900),
        currency: "eur",
        tax: BigInt(0),
        paidAt: new Date(Date.now() + 60_000),
        refunded: BigInt(0),
        reversed: false,
        evidence: { provider: "paypal" },
        ...overrides,
      });
      orgs.set(saleId, orgId);
      return saleId;
    },
    update(saleId: string, overrides: Partial<NormalizedPayPalSale>) {
      sales.set(saleId, { ...sales.get(saleId)!, ...overrides });
    },
  };
}

function environment(paypalEnvironment: "test" | "live" = "test") {
  const paypal = fakePayPal(paypalEnvironment);
  const base = partnerTestDeps(test.db, { paypalSales: paypal.source });
  return { ...base, paypal };
}

/** A partner, and a new customer who opened their link and signed up: attributed. */
async function referredCustomer(env: ReturnType<typeof environment>) {
  const partner = await seedPartner(test.db);
  const click = await recordReferralClick(env.deps, { code: partner.code, existingToken: null, landingPath: "/", referrerHost: null, visitor: randomUUID() });
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
  return { partner, orgId };
}

async function commissionFor(orgId: string) {
  const [fact] = await test.db.select().from(partnerPaymentFacts).where(eq(partnerPaymentFacts.organizationId, orgId));
  if (!fact) return { fact: null, commission: null };
  const [commission] = await test.db.select().from(partnerCommissions).where(eq(partnerCommissions.paymentFactId, fact.id));
  return { fact, commission: commission ?? null };
}

describe("a PayPal payment by a referred customer", () => {
  it("earns the same commission as card: EUR 99.00 at 25% is EUR 24.75, once however often it arrives", async () => {
    const env = environment();
    const { orgId, partner } = await referredCustomer(env);
    const saleId = env.paypal.sale(orgId);
    await test.db.insert(payments).values({ organizationId: orgId, provider: "paypal", externalId: saleId, providerObject: "paypal_sale", amountCents: 9900, currency: "eur", status: "paid" });

    expect(await processPayPalSale(env.deps, { saleId, environment: "test" })).toMatchObject({ outcome: "commissioned", partnerIds: [partner.partnerId] });
    expect(await processPayPalSale(env.deps, { saleId, environment: "test" })).toMatchObject({ outcome: "recorded" });

    const { fact, commission } = await commissionFor(orgId);
    expect(fact).toMatchObject({ provider: "paypal", invoicePaymentId: `paypal_sale:${saleId}`, cashCollected: BigInt(9900), eligibleBase: BigInt(9900), paypalSubscriptionId: "I-SUB" });
    expect(commission).toMatchObject({ amount: BigInt(2475), rateBasisPoints: 2500, status: "pending" });
    const entries = await test.db.select().from(partnerLedgerEntries).where(eq(partnerLedgerEntries.partnerId, partner.partnerId));
    expect(entries.map((entry) => [entry.kind, entry.amount])).toEqual([["commission_earned", BigInt(2475)]]);
  });

  it("reverses with refunds cumulatively, never more than the commission", async () => {
    const env = environment();
    const { orgId } = await referredCustomer(env);
    const saleId = env.paypal.sale(orgId);
    await test.db.insert(payments).values({ organizationId: orgId, provider: "paypal", externalId: saleId, providerObject: "paypal_sale", amountCents: 9900, currency: "eur", status: "paid" });
    await processPayPalSale(env.deps, { saleId, environment: "test" });

    env.paypal.update(saleId, { state: "partially_refunded", refunded: BigInt(4950) });
    await processPayPalSale(env.deps, { saleId, environment: "test" });
    // The same refund event again: nothing more.
    await processPayPalSale(env.deps, { saleId, environment: "test" });
    expect((await commissionFor(orgId)).commission?.reversedAmount).toBe(BigInt(1238));

    env.paypal.update(saleId, { state: "refunded", refunded: BigInt(9900) });
    await processPayPalSale(env.deps, { saleId, environment: "test" });
    expect((await commissionFor(orgId)).commission).toMatchObject({ reversedAmount: BigInt(2475), status: "reversed" });
  });

  it("reverses all of it on a PayPal reversal (chargeback), counted once with a refund", async () => {
    const env = environment();
    const { orgId } = await referredCustomer(env);
    const saleId = env.paypal.sale(orgId);
    await test.db.insert(payments).values({ organizationId: orgId, provider: "paypal", externalId: saleId, providerObject: "paypal_sale", amountCents: 9900, currency: "eur", status: "paid" });
    await processPayPalSale(env.deps, { saleId, environment: "test" });
    env.paypal.update(saleId, { state: "reversed", reversed: true, refunded: BigInt(6000) });
    await processPayPalSale(env.deps, { saleId, environment: "test" });
    expect((await commissionFor(orgId)).commission?.reversedAmount).toBe(BigInt(2475));
  });

  it("earns nothing for a sale PayPal has not completed", async () => {
    const env = environment();
    const { orgId } = await referredCustomer(env);
    const saleId = env.paypal.sale(orgId, { state: "pending", verified: false });
    await test.db.insert(payments).values({ organizationId: orgId, provider: "paypal", externalId: saleId, providerObject: "paypal_sale", amountCents: 9900, currency: "eur", status: "paid" });
    expect(await processPayPalSale(env.deps, { saleId, environment: "test" })).toMatchObject({ outcome: "recorded" });
    expect((await commissionFor(orgId)).commission).toBeNull();
  });

  it("does nothing for a customer nobody referred, or across environments", async () => {
    const env = environment();
    const person = await seedUser(test.db, { createdAt: env.clock.now() });
    const orgId = await seedWorkspace(test.db, person.id);
    const saleId = env.paypal.sale(orgId);
    await test.db.insert(payments).values({ organizationId: orgId, provider: "paypal", externalId: saleId, providerObject: "paypal_sale", amountCents: 9900, currency: "eur", status: "paid" });
    expect(await processPayPalSale(env.deps, { saleId, environment: "test" })).toMatchObject({ outcome: "not_relevant" });

    const live = environment("live");
    expect(await processPayPalSale(live.deps, { saleId, environment: "test" })).toMatchObject({ outcome: "wrong_environment" });
  });
});
