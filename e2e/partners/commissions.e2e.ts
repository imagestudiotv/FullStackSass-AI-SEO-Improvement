import { randomUUID } from "node:crypto";

import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { partnerLedgerEntries, partnerPaymentFacts, partnerProviderEvents, partnerReviewCases, partnerSignupEligibility, webhookEvents } from "@/lib/db/schema";
import { executeSettlement } from "@/lib/partners/application/use-cases/execute-transfer";
import { createPartnerCoupon } from "@/lib/partners/application/use-cases/manage-coupon";
import { prepareSettlement } from "@/lib/partners/application/use-cases/prepare-settlement";
import { processChargeAdjustments } from "@/lib/partners/application/use-cases/process-adjustment";
import { processInvoice } from "@/lib/partners/application/use-cases/process-payment";
import { processProviderEvents } from "@/lib/partners/application/use-cases/process-provider-events";
import { refreshPartnerTier } from "@/lib/partners/application/use-cases/refresh-partner-tier";
import { customerReference } from "@/lib/partners/infrastructure/directory";
import { partnerCopy } from "@/lib/partners/presentation/copy";
import { seedActiveSubscription, seedStripeCustomer } from "@/test/partners";

import { Browser, type Page } from "./browser";
import {
  ADMIN,
  approvedPartner,
  attributionOf,
  commissionsOf,
  database,
  foundingWorkspace,
  openProgram,
  pay,
  person,
  referredPayment,
  signedInAdmin,
  signedUpCustomer,
  signedStripeDelivery,
  signIn,
  signUpInBrowser,
  STATE,
  stripeWorld,
  unique,
  userByEmail,
} from "./driver";

/**
 * Flows 4, 5, 7-9, 14 and 15 (before transfer): from a click on a partner
 * link to the commission the partner sees, through the running application.
 */

const t = partnerCopy("en").portal;
const base = STATE.baseUrl;
let browser: Browser;
let admin: Awaited<ReturnType<typeof signedInAdmin>>;

beforeAll(async () => {
  await openProgram();
  browser = await Browser.launch();
  admin = await signedInAdmin(browser);
});

afterAll(async () => {
  await browser?.close();
});

async function portalFor(email: string) {
  const portal = await person(browser);
  await signIn(portal.page, email);
  return portal;
}

/** The overview's metric tiles, label -> value. */
async function metrics(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() =>
    Object.fromEntries([...document.querySelectorAll("dl > div")].map((tile) => [tile.querySelector("dt")?.textContent?.trim() ?? "", tile.querySelector("dd")?.textContent?.trim() ?? ""])),
  );
}

const count = (text: string, needle: string) => text.split(needle).length - 1;

describe("from a click to a commission", () => {
  it("4-5: click, signup and payment give EUR 24.75 on EUR 99.00; a renewal adds exactly one more", async () => {
    const w = stripeWorld();
    const partner = await approvedPartner(w);

    // A visitor opens the partner's link, repget.com/?ref=<name>: the first-party cookie is set, httpOnly.
    const visitor = await person(browser);
    const landed = await visitor.page.goto(`${base}/?ref=${partner.code}`);
    expect(landed).toEqual({ status: 200, path: "/" });
    const cookie = (await visitor.context.cookies()).find((c) => c.name === "repget_partner");
    expect(cookie).toMatchObject({ httpOnly: true });
    expect(cookie!.value).toHaveLength(43);

    // ...signs up through the real form (the sign-up hook reads that cookie), and pays.
    const email = `${unique("customer")}@e2e.test`;
    await signUpInBrowser(visitor.page, email, "Paying Customer");
    const customer = (await userByEmail(email))!;
    const [eligibility] = await database.select().from(partnerSignupEligibility).where(eq(partnerSignupEligibility.userId, customer.id));
    expect(eligibility).toMatchObject({ eligible: true, linkOutcome: "attribute", candidatePartnerId: partner.partnerId });
    const organizationId = await foundingWorkspace(customer.id);
    const customerId = await seedStripeCustomer(database, organizationId);
    await pay(w, customerId, 9900, 0);
    expect((await commissionsOf(partner.partnerId)).map((c) => [c.baseAmount, c.amount, c.rateBasisPoints])).toEqual([[BigInt(9900), BigInt(2475), 2500]]);
    expect((await attributionOf(organizationId))!.source).toBe("link");

    const portal = await portalFor(partner.email);
    await portal.page.goto(`${base}/partner/commissions`);
    await portal.page.waitForText("€24.75");
    const reference = customerReference(organizationId);
    expect(count(await portal.page.text(), reference)).toBe(1);
    expect(await portal.page.text()).toContain("€99.00");
    await portal.page.goto(`${base}/partner`);
    expect(await metrics(portal.page)).toMatchObject({ [t.overview.metrics.clicks]: "1", [t.overview.metrics.signups]: "1", [t.overview.metrics.referred]: "1", [t.overview.metrics.customers]: "1" });

    // A renewal: one more commission, and processing the same invoice again adds nothing.
    const renewal = await pay(w, customerId, 9900, 0);
    await processInvoice(w.deps, renewal.invoiceId, "test");
    await processInvoice(w.deps, renewal.invoiceId, "test");
    expect(await commissionsOf(partner.partnerId)).toHaveLength(2);
    await portal.page.goto(`${base}/partner/commissions`);
    await portal.page.waitForText(reference);
    // Each row appears twice in the markup (table and phone card) but once in visible text.
    expect(count(await portal.page.text(), reference)).toBe(2);

    await admin.page.goto(`${base}/admin/partners/commissions?partner=${partner.partnerId}`);
    await admin.page.waitForText("2 commissions");
    for (const p of [visitor, portal]) await p.context.close();
  });
});

describe("coupons", () => {
  it("7: a partner's coupon attributes a new customer; another partner's coupon on a referred customer is a conflict for review", async () => {
    const w = stripeWorld();
    const owner = await approvedPartner(w);
    const other = await approvedPartner(w);
    const code = `E2E${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
    const coupon = await createPartnerCoupon(w.deps, ADMIN, { partnerId: owner.partnerId, code, campaign: "E2E campaign", discountType: "percent_first_payment", percentOffBasisPoints: 2000 });
    if (!coupon.ok) throw new Error(JSON.stringify(coupon));
    const promotion = coupon.value.stripePromotionCodeId!;

    const portal = await portalFor(owner.email);
    await portal.page.goto(`${base}/partner`);
    await portal.page.waitForText(code);
    expect(await portal.page.text()).toContain("20%");

    // Matching: no partner link, first payment with the code (EUR 99.00 less 20% = 79.20).
    const fresh = await signedUpCustomer(w, null);
    await pay(w, fresh.customerId, 7920, 0, { discount: 1980, promotionCodeIds: [promotion] });
    expect(await attributionOf(fresh.organizationId)).toMatchObject({ partnerId: owner.partnerId, source: "coupon" });
    expect((await commissionsOf(owner.partnerId)).map((c) => c.amount)).toEqual([BigInt(1980)]);
    await portal.page.goto(`${base}/partner/referrals`);
    await portal.page.waitForText(t.referrals.sources.coupon);

    // Conflict: referred by the other partner's link, pays with this coupon -> stays with the link, and a case.
    const referred = await signedUpCustomer(w, other.code);
    await pay(w, referred.customerId, 7920, 0, { discount: 1980, promotionCodeIds: [promotion] });
    expect(await attributionOf(referred.organizationId)).toMatchObject({ partnerId: other.partnerId, source: "link" });
    expect(await commissionsOf(owner.partnerId)).toHaveLength(1);
    const cases = await database.select().from(partnerReviewCases).where(and(eq(partnerReviewCases.organizationId, referred.organizationId), eq(partnerReviewCases.kind, "coupon_conflict")));
    expect(cases).toHaveLength(1);
    await admin.page.goto(`${base}/admin/partners/reviews?kind=coupon_conflict`);
    await admin.page.waitForText("Coupon conflict");
    await portal.context.close();
  });
});

describe("what a commission is based on", () => {
  it("8: tax is excluded, a discount is not counted twice, and credit is not cash", async () => {
    const w = stripeWorld();
    const partner = await approvedPartner(w);
    const taxed = await signedUpCustomer(w, partner.code);
    await pay(w, taxed.customerId, 9900, 0, { tax: 1785 });
    const discounted = await signedUpCustomer(w, partner.code);
    await pay(w, discounted.customerId, 8910, 0, { discount: 990 });
    const credited = await signedUpCustomer(w, partner.code);
    await pay(w, credited.customerId, 9900, 0, { cash: 5900 });
    const byOrg = async (organizationId: string) => {
      const attribution = (await attributionOf(organizationId))!;
      return (await commissionsOf(partner.partnerId)).find((c) => c.attributionId === attribution.id)!;
    };
    expect((await byOrg(taxed.organizationId)).amount).toBe(BigInt(2029)); // 81.15 x 25% = 20.2875 -> 20.29
    expect((await byOrg(discounted.organizationId)).amount).toBe(BigInt(2228)); // 89.10 x 25% = 22.275 -> 22.28
    expect((await byOrg(credited.organizationId)).amount).toBe(BigInt(1475)); // only the 59.00 paid in cash

    const portal = await portalFor(partner.email);
    await portal.page.goto(`${base}/partner/commissions`);
    await portal.page.waitForText("€20.29");
    const text = await portal.page.text();
    for (const shown of ["€81.15", "€22.28", "€89.10", "€14.75", "€59.00"]) expect(text).toContain(shown);
    await portal.context.close();
  });

  it("9: ten paying customers move the partner to Growth (30%); the next payment is commissioned at 30%", async () => {
    const w = stripeWorld();
    const partner = await approvedPartner(w);
    for (let i = 0; i < 10; i += 1) {
      const customer = await referredPayment(w, partner.code, 9900, 3);
      await seedActiveSubscription(database, customer.organizationId, new Date(Date.now() + 20 * 86_400_000));
    }
    const portal = await portalFor(partner.email);
    await portal.page.goto(`${base}/partner`);
    await portal.page.waitForText("Base Partner");
    expect(await refreshPartnerTier(w.deps, partner.partnerId)).toMatchObject({ tier: "growth", qualifyingCustomers: 10 });
    await portal.page.goto(`${base}/partner`);
    await portal.page.waitForText("Growth Partner");
    const text = await portal.page.text();
    expect(text).toContain("30%");
    expect(text).toContain("10 / 25");

    await referredPayment(w, partner.code, 9900, 0);
    const amounts = (await commissionsOf(partner.partnerId)).map((c) => c.amount).sort((a, b) => Number(b - a));
    expect(amounts[0]).toBe(BigInt(2970));
    await portal.page.goto(`${base}/partner/commissions`);
    await portal.page.waitForText("€29.70");
    await portal.context.close();
  });
});

describe("Stripe events through the real webhook route", () => {
  it("14: duplicate and out-of-order deliveries (refund before payment) are recorded once and give one commission, reversed once", async () => {
    const w = stripeWorld();
    const partner = await approvedPartner(w);
    const customer = await signedUpCustomer(w, partner.code);
    const invoice = w.billing.invoice({ customerId: customer.customerId, total: 9900, collections: [{ cash: 9900, paidAt: new Date(Date.now() - 3_600_000) }] });
    const charge = invoice.collections[0].chargeId!;
    w.billing.setCharge(charge, { refunded: 9900 });

    const now = Math.floor(Date.now() / 1000);
    const event = (type: string, object: Record<string, unknown>, created: number) => ({
      id: `evt_e2e_${randomUUID().replace(/-/g, "").slice(0, 20)}`,
      object: "event",
      api_version: "2026-08-26.dahlia",
      created,
      livemode: false,
      pending_webhooks: 1,
      request: { id: null, idempotency_key: null },
      type,
      data: { object },
    });
    const paid = event("invoice_payment.paid", { id: invoice.collections[0].invoicePaymentId, object: "invoice_payment", invoice: invoice.invoiceId }, now - 3600);
    const refunded = event("charge.refunded", { id: charge, object: "charge" }, now - 60);
    // The refund arrives first, everything twice, the refund a third time.
    for (const delivery of [refunded, refunded, paid, paid, refunded]) {
      const response = await signedStripeDelivery("/api/stripe/webhook", delivery);
      expect(response.status).toBe(200);
    }
    // A forged delivery is refused.
    const forged = await fetch(`${base}/api/stripe/webhook`, { method: "POST", headers: { "content-type": "application/json", "stripe-signature": `t=${now},v1=${"0".repeat(64)}` }, body: JSON.stringify(paid) });
    expect(forged.status).toBe(400);

    const recorded = await database.select().from(partnerProviderEvents).where(inArray(partnerProviderEvents.stripeEventId, [paid.id, refunded.id]));
    expect(recorded).toHaveLength(2);
    // The worker, as the job would run it (twice, as a retry would) - after the deliveries.
    w.clock.set(new Date());
    await processProviderEvents(w.deps, { only: recorded.map((row) => row.id) });
    await processProviderEvents(w.deps, { only: recorded.map((row) => row.id) });

    const facts = await database.select().from(partnerPaymentFacts).where(eq(partnerPaymentFacts.organizationId, customer.organizationId));
    expect(facts).toHaveLength(1);
    const commissions = await commissionsOf(partner.partnerId);
    expect(commissions.map((c) => [c.amount, c.reversedAmount, c.status])).toEqual([[BigInt(2475), BigInt(2475), "reversed"]]);
    const ledger = await database.select().from(partnerLedgerEntries).where(eq(partnerLedgerEntries.commissionId, commissions[0].id));
    expect(ledger.map((e) => [e.kind, e.amount]).sort()).toEqual([["commission_adjustment", BigInt(-2475)], ["commission_earned", BigInt(2475)]]);

    const portal = await portalFor(partner.email);
    await portal.page.goto(`${base}/partner/commissions`);
    await portal.page.waitForText(t.commissions.statuses.reversed);
    await portal.context.close();
  });

  it("14 (Connect): the connected-account route checks the signature, records each event once and keeps no bank details", async () => {
    const now = Math.floor(Date.now() / 1000);
    const id = `evt_e2e_connect_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
    const bank = { id: "ba_e2e", object: "bank_account", account_holder_name: "Jane E2e", bank_name: "STRIPE TEST BANK", last4: "4321", routing_number: "110000000", fingerprint: "fp_e2e_secret" };
    const event = { id, object: "event", api_version: "2026-08-26.dahlia", created: now, livemode: false, pending_webhooks: 1, request: { id: null, idempotency_key: null }, type: "account.external_account.updated", account: "acct_e2e_not_a_partner", data: { object: bank } };
    expect((await signedStripeDelivery("/api/stripe/connect-webhook", event)).status).toBe(200);
    expect(await (await signedStripeDelivery("/api/stripe/connect-webhook", event)).json()).toMatchObject({ duplicate: true });
    const forged = await fetch(`${base}/api/stripe/connect-webhook`, { method: "POST", headers: { "content-type": "application/json", "stripe-signature": `t=${now},v1=${"0".repeat(64)}` }, body: JSON.stringify(event) });
    expect(forged.status).toBe(400);
    const stored = await database.select().from(webhookEvents).where(eq(webhookEvents.id, id));
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ provider: "stripe_connect" });
    const text = JSON.stringify(stored[0].payload);
    for (const detail of ["Jane E2e", "STRIPE TEST BANK", "4321", "110000000", "fp_e2e_secret"]) expect(text).not.toContain(detail);
  });
});

describe("refunds", () => {
  it("15a: a refund before the transfer releases the payout; nothing is sent", async () => {
    const w = stripeWorld();
    const partner = await approvedPartner(w);
    const first = await referredPayment(w, partner.code, 9900, 40);
    await referredPayment(w, partner.code, 9900, 40);
    const prepared = await prepareSettlement(w.deps, { kind: "system", origin: "e2e" }, { partnerId: partner.partnerId, currency: "eur", runKey: unique("run") });
    if (prepared.kind !== "created") throw new Error(JSON.stringify(prepared, (_k, v) => (typeof v === "bigint" ? v.toString() : v)));
    w.billing.setCharge(first.chargeId, { refunded: 9900 });
    await processChargeAdjustments(w.deps, first.chargeId, "test");
    expect(await executeSettlement(w.deps, prepared.settlementId)).toMatchObject({ state: "canceled" });
    expect(w.stripe.created.transfers).toBe(0);

    await admin.page.goto(`${base}/admin/partners/payouts/${prepared.settlementId}`);
    await admin.page.waitForText("Cancelled");
    const portal = await portalFor(partner.email);
    await portal.page.goto(`${base}/partner/payouts`);
    await portal.page.waitForText(t.payouts.empty);
    await portal.context.close();
  });
});
