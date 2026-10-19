import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/inngest/client", () => ({ inngest: { send: vi.fn() } }));

import { partnerAttributions, partnerCommissions, partnerLedgerEntries, partnerPaymentFacts } from "@/lib/db/schema";
import type { Database } from "@/lib/db/types";
import { createPostgresTestDb, testPostgresUrl } from "@/test/postgres";
import { fakeBilling, partnerTestDeps, seedPartner, seedStripeCustomer, seedUser, seedWorkspace, setControl } from "@/test/partners";

import { captureSignupEligibility } from "./attribute-new-customer";
import { processChargeAdjustments } from "./process-adjustment";
import { processInvoice } from "./process-payment";
import { recordReferralClick } from "./record-referral-click";

/**
 * Part 3 on a REAL Postgres with independent connections: the same Stripe
 * payment processed four times at once (webhook retries, the recovery job,
 * reconciliation), the same refund applied four times at once, and two
 * renewals of one customer racing. One fact, one commission, one earned
 * entry; the reversal applied exactly once.
 */

const available = Boolean(testPostgresUrl());
let env: Awaited<ReturnType<typeof createPostgresTestDb>>;
let dbs: Database[];

beforeAll(async () => {
  if (!available) return;
  env = await createPostgresTestDb(4);
  dbs = env.dbs as unknown as Database[];
  await setControl(dbs[0], "partner_program", true);
  await setControl(dbs[0], "partner_commissions", true);
}, 120_000);

afterAll(async () => {
  if (available) await env.dispose();
});

async function referred(billing: ReturnType<typeof fakeBilling>) {
  const base = partnerTestDeps(dbs[0], { billing: billing.source });
  const partner = await seedPartner(dbs[0]);
  const click = await recordReferralClick(base.deps, { code: partner.code, existingToken: null, landingPath: "/", referrerHost: null, visitor: randomUUID() });
  const createdAt = base.clock.now();
  const person = await seedUser(dbs[0], { createdAt });
  const orgId = await seedWorkspace(dbs[0], person.id, { createdAt });
  await captureSignupEligibility(base.deps, { userId: person.id, email: person.email, createdAt, method: "email", trackingToken: click.setCookie!.token, ipAddress: null, userAgent: null });
  return { partner, orgId, customerId: await seedStripeCustomer(dbs[0], orgId), at: (days: number) => new Date(createdAt.getTime() + days * 86_400_000) };
}

const depsOn = (db: Database, billing: ReturnType<typeof fakeBilling>) => partnerTestDeps(db, { billing: billing.source }).deps;

describe.skipIf(!available)("commissions under concurrency (real Postgres)", () => {
  it("one payment processed on four connections at once: one fact, one commission, one earned entry", async () => {
    const billing = fakeBilling();
    const customer = await referred(billing);
    const invoice = billing.invoice({ customerId: customer.customerId, total: 9900, collections: [{ cash: 9900, paidAt: customer.at(1) }] });
    const results = await Promise.all(dbs.map((db) => processInvoice(depsOn(db, billing), invoice.invoiceId, "test")));
    expect(results.filter((r) => r.outcome === "commissioned")).toHaveLength(1);
    const facts = await dbs[0].select().from(partnerPaymentFacts).where(eq(partnerPaymentFacts.invoiceId, invoice.invoiceId));
    expect(facts).toHaveLength(1);
    const commissions = await dbs[0].select().from(partnerCommissions).where(eq(partnerCommissions.paymentFactId, facts[0].id));
    expect(commissions).toMatchObject([{ amount: BigInt(2475) }]);
    const earned = await dbs[0].select().from(partnerLedgerEntries).where(eq(partnerLedgerEntries.commissionId, commissions[0].id));
    expect(earned).toHaveLength(1);
  });

  it("one refund applied on four connections at once is reversed exactly once", async () => {
    const billing = fakeBilling();
    const customer = await referred(billing);
    const invoice = billing.invoice({ customerId: customer.customerId, total: 9900, collections: [{ cash: 9900, paidAt: customer.at(1) }] });
    await processInvoice(depsOn(dbs[0], billing), invoice.invoiceId, "test");
    const chargeId = invoice.collections[0].chargeId!;
    billing.setCharge(chargeId, { refunded: 4950 });
    await Promise.all(dbs.map((db) => processChargeAdjustments(depsOn(db, billing), chargeId, "test")));
    const [fact] = await dbs[0].select().from(partnerPaymentFacts).where(eq(partnerPaymentFacts.invoiceId, invoice.invoiceId));
    const [commission] = await dbs[0].select().from(partnerCommissions).where(eq(partnerCommissions.paymentFactId, fact.id));
    expect(commission.reversedAmount).toBe(BigInt(1238));
    const adjustments = (await dbs[0].select().from(partnerLedgerEntries).where(eq(partnerLedgerEntries.commissionId, commission.id))).filter((e) => e.kind === "commission_adjustment");
    expect(adjustments.map((e) => e.amount)).toEqual([BigInt(-1238)]);
  });

  it("two renewals of one customer racing set one window from the earlier payment", async () => {
    const billing = fakeBilling();
    const customer = await referred(billing);
    const first = billing.invoice({ customerId: customer.customerId, total: 9900, collections: [{ cash: 9900, paidAt: customer.at(1) }] });
    const second = billing.invoice({ customerId: customer.customerId, total: 9900, collections: [{ cash: 9900, paidAt: customer.at(31) }] });
    await Promise.all([processInvoice(depsOn(dbs[1], billing), second.invoiceId, "test"), processInvoice(depsOn(dbs[2], billing), first.invoiceId, "test")]);
    const [attribution] = await dbs[0].select().from(partnerAttributions).where(eq(partnerAttributions.organizationId, customer.orgId));
    expect(attribution.windowStartsAt?.toISOString()).toBe(customer.at(1).toISOString());
    const facts = await dbs[0].select().from(partnerPaymentFacts).where(eq(partnerPaymentFacts.organizationId, customer.orgId));
    expect(facts.map((f) => f.outcome).sort()).toEqual(["commissioned", "commissioned"]);
  });
});
