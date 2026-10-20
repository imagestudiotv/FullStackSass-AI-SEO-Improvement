import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { partnerBankPayoutAttempts, partnerLedgerEntries, partnerTransferAttempts, partnerTransferReversals } from "@/lib/db/schema";
import { applyPayoutEvent } from "@/lib/partners/application/use-cases/execute-bank-payout";
import { executeSettlement } from "@/lib/partners/application/use-cases/execute-transfer";
import { prepareSettlement } from "@/lib/partners/application/use-cases/prepare-settlement";
import { processChargeAdjustments } from "@/lib/partners/application/use-cases/process-adjustment";
import { requestTransferReversal } from "@/lib/partners/application/use-cases/reconcile-settlement";
import { fill, partnerCopy } from "@/lib/partners/presentation/copy";

import { Browser } from "./browser";
import { ADMIN, approvedPartner, database, openProgram, person, referredPayment, signedInAdmin, signIn, STATE, stripeWorld, unique, type World } from "./driver";

/**
 * Flows 10-13, 15 (after payout) and 16: Net 30 and the threshold, the
 * transfer and the bank payout as two steps, a failed bank payout, a refund
 * after payout, a refused reversal and balance adjustments.
 *
 * Stripe Connect is the fake in driver.ts (idempotent like Stripe); every
 * settlement step is the real use case, and every screen is the running app.
 */

const t = partnerCopy("en").portal;
const base = STATE.baseUrl;
const DAY = 86_400_000;
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

const run = () => unique("run");
const json = (value: unknown) => JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v));

async function settle(w: World, partnerId: string) {
  const prepared = await prepareSettlement(w.deps, { kind: "system", origin: "e2e" }, { partnerId, currency: "eur", runKey: run() });
  if (prepared.kind !== "created") throw new Error(`not prepared: ${json(prepared)}`);
  return prepared;
}

async function bankPayout(w: World, settlementId: string, status: "paid" | "failed" | "in_transit") {
  const attempts = await database.select().from(partnerBankPayoutAttempts).where(eq(partnerBankPayoutAttempts.settlementId, settlementId));
  const latest = attempts.sort((a, b) => b.attemptNumber - a.attemptNumber)[0];
  w.stripe.setPayoutStatus(latest.stripePayoutId!, status);
  await applyPayoutEvent(w.deps, { accountId: latest.stripeAccountId, payoutId: latest.stripePayoutId!, livemode: false });
}

describe("Net 30 and the payout threshold", () => {
  it("10: EUR 24.75 available stays below EUR 25.00 and is carried forward; with the next mature commission it is paid", async () => {
    const w = stripeWorld();
    // One mature commission and one still maturing.
    const waiting = await approvedPartner(w, { name: unique("Waiting") });
    await referredPayment(w, waiting.code, 9900, 40);
    await referredPayment(w, waiting.code, 9900, 5);
    expect(await prepareSettlement(w.deps, { kind: "system", origin: "e2e" }, { partnerId: waiting.partnerId, currency: "eur", runKey: run() })).toEqual({ kind: "carried_forward", reason: "below_threshold", payable: BigInt(2475) });
    const portal = await portalFor(waiting.email);
    await portal.page.goto(`${base}/partner`);
    await portal.page.waitForText(fill(t.overview.threshold, { amount: "€25.00" }));
    const text = await portal.page.text();
    expect(text).toMatch(/Pending\s+€24\.75/);
    expect(text).toMatch(/Available\s+€24\.75/);
    await admin.page.goto(`${base}/admin/partners/partners/${waiting.partnerId}`);
    await admin.page.waitForText("Available");
    expect(await admin.page.text()).toMatch(/Available\s+€24\.75/);

    // Controlled time: 35 days ago only the first of two commissions was mature (EUR 24.75 -> carried);
    // today both are, and they are paid together.
    const later = await approvedPartner(w, { name: unique("Later") });
    await referredPayment(w, later.code, 9900, 70);
    await referredPayment(w, later.code, 9900, 40);
    w.clock.set(new Date(Date.now() - 35 * DAY));
    expect(await prepareSettlement(w.deps, { kind: "system", origin: "e2e" }, { partnerId: later.partnerId, currency: "eur", runKey: run() })).toMatchObject({ kind: "carried_forward", reason: "below_threshold" });
    w.clock.set(new Date());
    expect(await settle(w, later.partnerId)).toMatchObject({ transferAmount: BigInt(4950), offset: BigInt(0) });
    const laterPortal = await portalFor(later.email);
    await laterPortal.page.goto(`${base}/partner`);
    await laterPortal.page.waitForText(fill(t.overview.inPayout, { amount: "€49.50" }));
    for (const p of [portal, laterPortal]) await p.context.close();
  });
});

describe("transfer, then bank payout", () => {
  it("11-12: the transfer is confirmed while the bank payout is still pending; paid only when Stripe says so", async () => {
    const w = stripeWorld();
    const partner = await approvedPartner(w, { name: unique("Payee") });
    await referredPayment(w, partner.code, 9900, 40);
    await referredPayment(w, partner.code, 9900, 40);
    const { settlementId } = await settle(w, partner.partnerId);
    expect(await executeSettlement(w.deps, settlementId)).toMatchObject({ state: expect.stringMatching(/^payout_(pending|in_transit)$/) });
    expect(w.stripe.created).toEqual({ transfers: 1, payouts: 1 });

    const portal = await portalFor(partner.email);
    await portal.page.goto(`${base}/partner/payouts`);
    await portal.page.waitForText(t.payouts.transferStates.confirmed);
    let text = await portal.page.text();
    expect(text).toContain("€49.50");
    expect(text).toMatch(new RegExp(`${t.payouts.bankStates.pending}|${t.payouts.bankStates.in_transit}`));
    expect(text).not.toContain(t.payouts.bankStates.paid);
    await portal.page.goto(`${base}/partner`);
    text = await portal.page.text();
    expect(text).toMatch(/Transferred\s+€49\.50/);
    expect(text).toMatch(/Paid to your bank\s+€0\.00/);

    await admin.page.goto(`${base}/admin/partners/payouts/${settlementId}`);
    await admin.page.waitForText(`partner-transfer:${settlementId}:1`);
    expect(await admin.page.text()).toContain(`partner-payout:${settlementId}:1`);

    await bankPayout(w, settlementId, "paid");
    await portal.page.goto(`${base}/partner/payouts`);
    await portal.page.waitForText(t.payouts.bankStates.paid);
    await portal.page.goto(`${base}/partner`);
    expect(await portal.page.text()).toMatch(/Paid to your bank\s+€49\.50/);
    await portal.context.close();
  });

  it("13: a failed bank payout is retried as a new payout, never as a second transfer", async () => {
    const w = stripeWorld();
    const partner = await approvedPartner(w, { name: unique("Retry") });
    await referredPayment(w, partner.code, 9900, 40);
    await referredPayment(w, partner.code, 9900, 40);
    const { settlementId } = await settle(w, partner.partnerId);
    await executeSettlement(w.deps, settlementId);
    await bankPayout(w, settlementId, "failed");

    await admin.page.goto(`${base}/admin/partners/payouts/${settlementId}`);
    await admin.page.waitForText("Bank payout failed");
    const portal = await portalFor(partner.email);
    await portal.page.goto(`${base}/partner/payouts`);
    await portal.page.waitForText(t.payouts.bankStates.failed);

    // The sweep runs it again.
    await executeSettlement(w.deps, settlementId);
    expect(w.stripe.created).toEqual({ transfers: 1, payouts: 2 });
    expect(await database.select().from(partnerTransferAttempts).where(eq(partnerTransferAttempts.settlementId, settlementId))).toHaveLength(1);
    expect(await database.select().from(partnerBankPayoutAttempts).where(eq(partnerBankPayoutAttempts.settlementId, settlementId))).toHaveLength(2);
    await bankPayout(w, settlementId, "paid");
    await admin.page.goto(`${base}/admin/partners/payouts/${settlementId}`);
    await admin.page.waitForText("Paid to bank");
    expect(await admin.page.text()).toContain(`partner-payout:${settlementId}:2`);
    await portal.context.close();
  });
});

describe("a refund between the transfer and the bank payout", () => {
  it("15c: is deducted from upcoming payouts while the bank payout of money already transferred goes ahead", async () => {
    const w = stripeWorld();
    const partner = await approvedPartner(w, { name: unique("Between") });
    const first = await referredPayment(w, partner.code, 9900, 40);
    await referredPayment(w, partner.code, 9900, 40);
    const { settlementId } = await settle(w, partner.partnerId);
    await executeSettlement(w.deps, settlementId);
    // Transferred, bank payout pending: the customer is refunded now.
    w.billing.setCharge(first.chargeId, { refunded: 9900 });
    await processChargeAdjustments(w.deps, first.chargeId, "test");
    await bankPayout(w, settlementId, "paid");
    expect(w.stripe.created).toEqual({ transfers: 1, payouts: 1 });
    const portal = await portalFor(partner.email);
    await portal.page.goto(`${base}/partner`);
    await portal.page.waitForText(fill(t.overview.offset, { amount: "€24.75" }));
    expect(await portal.page.text()).toMatch(/Paid to your bank\s+€49\.50/);
    await portal.context.close();
  });
});

describe("after the payout", () => {
  it("15b-16: a refund after payout is deducted from upcoming payouts; a refused reversal changes nothing; adjustments are signed ledger entries", async () => {
    const w = stripeWorld();
    const partner = await approvedPartner(w, { name: unique("Refunded") });
    const first = await referredPayment(w, partner.code, 9900, 40);
    await referredPayment(w, partner.code, 9900, 40);
    const { settlementId } = await settle(w, partner.partnerId);
    await executeSettlement(w.deps, settlementId);
    await bankPayout(w, settlementId, "paid");

    // The customer is refunded after the payout.
    w.billing.setCharge(first.chargeId, { refunded: 9900 });
    await processChargeAdjustments(w.deps, first.chargeId, "test");
    const portal = await portalFor(partner.email);
    await portal.page.goto(`${base}/partner`);
    await portal.page.waitForText(fill(t.overview.offset, { amount: "€24.75" }));

    // Recovering it by transfer reversal: Stripe refuses (e.g. the partner already withdrew it) - nothing is recorded as reversed.
    w.stripe.refuseNextReversal("balance_insufficient");
    expect(await requestTransferReversal(w.deps, ADMIN, { settlementId, amount: BigInt(2475), reason: "Customer refunded" })).toMatchObject({ ok: false });
    const reversals = await database.select().from(partnerTransferReversals);
    expect(reversals.filter((r) => r.status === "failed").length).toBeGreaterThanOrEqual(1);
    expect((await database.select().from(partnerLedgerEntries).where(eq(partnerLedgerEntries.partnerId, partner.partnerId))).filter((e) => e.kind === "transfer_reversal")).toEqual([]);

    // A further deduction, through the admin page.
    await admin.page.goto(`${base}/admin/partners/partners/${partner.partnerId}`);
    await admin.page.clickByText("Adjust balance…");
    await admin.page.fill('[role="dialog"] input[inputmode="decimal"]', "-10.00");
    await admin.page.fill('[role="dialog"] textarea', "Duplicate account found");
    await admin.page.clickByText("Add adjustment", { inDialog: true, selector: 'button[type="submit"]' });
    await admin.page.waitForText("Adjustment recorded");
    await portal.page.goto(`${base}/partner`);
    await portal.page.waitForText(fill(t.overview.offset, { amount: "€34.75" }));

    // A credit that no commission backs is refused, with the reason.
    await admin.page.goto(`${base}/admin/partners/partners/${partner.partnerId}`);
    await admin.page.clickByText("Adjust balance…");
    await admin.page.fill('[role="dialog"] input[inputmode="decimal"]', "50.00");
    await admin.page.fill('[role="dialog"] textarea', "Goodwill credit");
    await admin.page.clickByText("Add adjustment", { inDialog: true, selector: 'button[type="submit"]' });
    await admin.page.waitForText("A credit can only cancel an earlier deduction");
    const manual = (await database.select().from(partnerLedgerEntries).where(eq(partnerLedgerEntries.partnerId, partner.partnerId))).filter((e) => e.operationKey.startsWith("manual:"));
    expect(manual.map((e) => e.amount)).toEqual([BigInt(-1000)]);
    await portal.context.close();
  });
});
