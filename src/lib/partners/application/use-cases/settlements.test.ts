import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";

import {
  partnerBankPayoutAttempts,
  partnerCommissions,
  partnerLedgerEntries,
  partnerProfiles,
  partnerReviewCases,
  partnerSettlements,
  partnerStripeAccounts,
  partnerTransferAttempts,
} from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import {
  fakeBilling,
  fakePayouts,
  partnerTestDeps,
  readiness,
  seedPartner,
  seedStripeCustomer,
  seedUser,
  seedWorkspace,
  setControl,
} from "@/test/partners";

/**
 * Part 4: monthly settlements and Stripe payouts - commission owed, the
 * transfer to the partner's Stripe balance, and the bank payout - recorded
 * and shown separately. Real repositories on PGlite, a controlled clock, and
 * a fake Stripe Connect (idempotent like Stripe; lost answers on demand).
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
  isDatabaseConfigured: () => true,
}));

import type { AdminContext } from "../contracts/commands";
import { captureSignupEligibility } from "./attribute-new-customer";
import { applyPayoutEvent } from "./execute-bank-payout";
import { executeSettlement } from "./execute-transfer";
import { computeBalances } from "./mature-commissions";
import { prepareSettlement, runMonthlySettlements } from "./prepare-settlement";
import { processChargeAdjustments } from "./process-adjustment";
import { processInvoice } from "./process-payment";
import { recordReferralClick } from "./record-referral-click";
import { requestTransferReversal, syncTransferReversals } from "./reconcile-settlement";

let test: TestDb;
const DAY = 86_400_000;
const admin: AdminContext = { kind: "admin", userId: "a", email: "admin@repget.test" };

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
  await setControl(test.db, "partner_program", true);
  await setControl(test.db, "partner_commissions", true);
  await setControl(test.db, "partner_payouts", true);
});

function world() {
  const billing = fakeBilling();
  const stripe = fakePayouts();
  stripe.fund("eur", 1_000_000);
  const env = partnerTestDeps(test.db, { billing: billing.source, connect: stripe.gateway, payouts: stripe.gateway });
  return { ...env, billing, stripe };
}
type World = ReturnType<typeof world>;

/** A partner whose Stripe account is ready, with one referred customer per amount, each paid `daysAgo` days ago. */
async function partnerWithCommissions(w: World, amounts: number[], daysAgo = 40) {
  const partner = await seedPartner(test.db);
  const accountId = `acct_${randomUUID().replace(/-/g, "").slice(0, 14)}`;
  await test.db.insert(partnerStripeAccounts).values({ partnerId: partner.partnerId, environment: "test", stripeAccountId: accountId, status: "ready", detailsSubmitted: true, payoutsEnabled: true, transfersCapability: "active", payoutInterval: "manual", creationKey: `k-${randomUUID()}` });
  w.stripe.accounts.set(accountId, readiness(accountId, { status: "ready", detailsSubmitted: true, payoutsEnabled: true, transfersCapability: "active", requirementsCurrentlyDue: [], metadataPartnerId: partner.partnerId }));
  const charges: string[] = [];
  const now = w.clock.now();
  for (const amount of amounts) {
    // The visitor opens the link and signs up before paying; processing happens now.
    w.clock.set(new Date(now.getTime() - (daysAgo + 1) * DAY));
    const click = await recordReferralClick(w.deps, { code: partner.code, existingToken: null, landingPath: "/", referrerHost: null, visitor: randomUUID() });
    const createdAt = w.clock.now();
    const person = await seedUser(test.db, { createdAt });
    const orgId = await seedWorkspace(test.db, person.id, { createdAt });
    await captureSignupEligibility(w.deps, { userId: person.id, email: person.email, createdAt, method: "email", trackingToken: click.setCookie!.token, ipAddress: null, userAgent: null });
    const customerId = await seedStripeCustomer(test.db, orgId);
    w.clock.set(now);
    const invoice = w.billing.invoice({ customerId, total: amount, collections: [{ cash: amount, paidAt: new Date(now.getTime() - daysAgo * DAY) }] });
    await processInvoice(w.deps, invoice.invoiceId, "test");
    charges.push(invoice.collections[0].chargeId!);
  }
  return { ...partner, accountId, charges };
}

async function settlementOf(partnerId: string) {
  const rows = await test.db.select().from(partnerSettlements).where(eq(partnerSettlements.partnerId, partnerId));
  return rows.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

describe("the monthly run", () => {
  it("carries EUR 24.75 forward below the EUR 25.00 threshold, and pays once more is mature", async () => {
    const w = world();
    const partner = await partnerWithCommissions(w, [9900]);
    expect(await prepareSettlement(w.deps, { kind: "system", origin: "test" }, { partnerId: partner.partnerId, currency: "eur", runKey: "2026-10" })).toEqual({ kind: "carried_forward", reason: "below_threshold", payable: BigInt(2475) });
    expect(await settlementOf(partner.partnerId)).toHaveLength(0);

    // A second commission, but only 10 days old: not mature, still below.
    const today = w.clock.now();
    w.clock.set(new Date(today.getTime() - 11 * DAY));
    const click = await recordReferralClick(w.deps, { code: partner.code, existingToken: null, landingPath: "/", referrerHost: null, visitor: randomUUID() });
    const createdAt = w.clock.now();
    const person = await seedUser(test.db, { createdAt });
    const orgId = await seedWorkspace(test.db, person.id, { createdAt });
    await captureSignupEligibility(w.deps, { userId: person.id, email: person.email, createdAt, method: "email", trackingToken: click.setCookie!.token, ipAddress: null, userAgent: null });
    w.clock.set(today);
    const invoice = w.billing.invoice({ customerId: await seedStripeCustomer(test.db, orgId), total: 9900, collections: [{ cash: 9900, paidAt: new Date(w.clock.now().getTime() - 10 * DAY) }] });
    await processInvoice(w.deps, invoice.invoiceId, "test");
    expect(await prepareSettlement(w.deps, { kind: "system", origin: "test" }, { partnerId: partner.partnerId, currency: "eur", runKey: "2026-10" })).toMatchObject({ kind: "carried_forward", reason: "below_threshold" });

    // A month later both are mature: EUR 49.50 is paid in one settlement.
    w.clock.advance(31 * DAY);
    const run = await runMonthlySettlements(w.deps);
    const mine = run.results.find((r) => r.partnerId === partner.partnerId);
    expect(mine?.outcome).toMatchObject({ kind: "created", transferAmount: BigInt(4950), offset: BigInt(0) });
    expect(run.runKey).toBe("2026-11");
    // Running the same month again prepares nothing new: the earnings are reserved.
    const again = await runMonthlySettlements(w.deps);
    expect(again.results.find((r) => r.partnerId === partner.partnerId)?.outcome).toMatchObject({ kind: "carried_forward", reason: "nothing_payable" });
    expect(await settlementOf(partner.partnerId)).toHaveLength(1);
  });

  it("does not pay a suspended or held partner, an unready account, or while payouts are switched off", async () => {
    const w = world();
    const held = await partnerWithCommissions(w, [9900, 9900]);
    await test.db.update(partnerProfiles).set({ payoutHoldReason: "Investigation" }).where(eq(partnerProfiles.id, held.partnerId));
    expect(await prepareSettlement(w.deps, { kind: "system", origin: "t" }, { partnerId: held.partnerId, currency: "eur", runKey: "r" })).toEqual({ kind: "skipped", reason: "payout_hold" });
    const suspended = await partnerWithCommissions(w, [9900, 9900]);
    await test.db.update(partnerProfiles).set({ status: "suspended" }).where(eq(partnerProfiles.id, suspended.partnerId));
    expect(await prepareSettlement(w.deps, { kind: "system", origin: "t" }, { partnerId: suspended.partnerId, currency: "eur", runKey: "r" })).toEqual({ kind: "skipped", reason: "partner_suspended" });
    const unready = await partnerWithCommissions(w, [9900, 9900]);
    await test.db.update(partnerStripeAccounts).set({ status: "restricted" }).where(eq(partnerStripeAccounts.partnerId, unready.partnerId));
    expect(await prepareSettlement(w.deps, { kind: "system", origin: "t" }, { partnerId: unready.partnerId, currency: "eur", runKey: "r" })).toEqual({ kind: "skipped", reason: "onboarding_incomplete" });
    await setControl(test.db, "partner_payouts", false);
    try {
      const ok = await partnerWithCommissions(w, [9900, 9900]);
      expect(await prepareSettlement(w.deps, { kind: "system", origin: "t" }, { partnerId: ok.partnerId, currency: "eur", runKey: "r" })).toEqual({ kind: "skipped", reason: "payouts_disabled" });
    } finally {
      await setControl(test.db, "partner_payouts", true);
    }
  });

  it("never moves live money without PARTNER_LIVE_PAYOUTS", async () => {
    const w = world();
    const partner = await partnerWithCommissions(w, [9900, 9900]);
    const live = { ...w.deps, settings: { ...w.deps.settings, environment: () => "live" as const, moneyMovementAllowed: (e: string) => e === "test" } };
    expect(await prepareSettlement(live, { kind: "system", origin: "t" }, { partnerId: partner.partnerId, currency: "eur", runKey: "r" })).toEqual({ kind: "skipped", reason: "money_movement_blocked" });
  });
});

describe("transfer, then bank payout", () => {
  async function prepared(w: World, amounts = [9900, 9900]) {
    const partner = await partnerWithCommissions(w, amounts);
    const outcome = await prepareSettlement(w.deps, { kind: "system", origin: "test" }, { partnerId: partner.partnerId, currency: "eur", runKey: `run-${randomUUID()}` });
    if (outcome.kind !== "created") throw new Error(`setup: ${JSON.stringify(outcome, (_k, v) => (typeof v === "bigint" ? v.toString() : v))}`);
    return { partner, settlementId: outcome.settlementId };
  }

  it("records commission owed, the transfer, and the bank payout separately; balances reconcile with the ledger", async () => {
    const w = world();
    const { partner, settlementId } = await prepared(w);
    expect(await executeSettlement(w.deps, settlementId)).toMatchObject({ state: "payout_pending" });
    expect(w.stripe.created).toEqual({ transfers: 1, payouts: 1 });

    let balances = await computeBalances(w.deps, partner.partnerId, "test", "eur");
    expect(balances).toMatchObject({ netEarned: BigInt(4950), netTransferred: BigInt(4950), liability: BigInt(0), bankPaid: BigInt(0), reserved: BigInt(0) });
    const commissions = await test.db.select().from(partnerCommissions).where(eq(partnerCommissions.partnerId, partner.partnerId));
    expect(commissions.every((c) => c.status === "paid" && c.paidSettlementId === settlementId)).toBe(true);
    const ledger = await test.db.select().from(partnerLedgerEntries).where(eq(partnerLedgerEntries.partnerId, partner.partnerId));
    expect(ledger.filter((e) => e.kind === "transfer_confirmed").map((e) => e.amount)).toEqual([BigInt(-4950)]);

    // Stripe pays the bank: a verified Connect payout.paid event.
    const [payout] = await test.db.select().from(partnerBankPayoutAttempts).where(eq(partnerBankPayoutAttempts.settlementId, settlementId));
    w.stripe.setPayoutStatus(payout.stripePayoutId!, "paid");
    expect(await applyPayoutEvent(w.deps, { accountId: partner.accountId, payoutId: payout.stripePayoutId!, livemode: false })).toBe("applied");
    expect((await settlementOf(partner.partnerId))[0].state).toBe("paid");
    balances = await computeBalances(w.deps, partner.partnerId, "test", "eur");
    expect(balances.bankPaid).toBe(BigInt(4950));
    // A bank payout never touches the liability a second time.
    expect(balances.liability).toBe(BigInt(0));
    expect((await test.db.select().from(partnerLedgerEntries).where(eq(partnerLedgerEntries.partnerId, partner.partnerId))).length).toBe(ledger.length);
  });

  it("retries a failed bank payout as a new payout - never a second transfer", async () => {
    const w = world();
    const { partner, settlementId } = await prepared(w);
    await executeSettlement(w.deps, settlementId);
    const [first] = await test.db.select().from(partnerBankPayoutAttempts).where(eq(partnerBankPayoutAttempts.settlementId, settlementId));
    w.stripe.setPayoutStatus(first.stripePayoutId!, "failed");
    await applyPayoutEvent(w.deps, { accountId: partner.accountId, payoutId: first.stripePayoutId!, livemode: false });
    expect((await settlementOf(partner.partnerId))[0].state).toBe("payout_failed");
    w.clock.advance(DAY);
    expect(await executeSettlement(w.deps, settlementId)).toMatchObject({ state: "payout_pending" });
    expect(w.stripe.created).toEqual({ transfers: 1, payouts: 2 });
    expect(await test.db.select().from(partnerTransferAttempts).where(eq(partnerTransferAttempts.settlementId, settlementId))).toHaveLength(1);
  });

  it("confirms a transfer whose answer was lost by its transfer group, without sending another", async () => {
    const w = world();
    const { settlementId } = await prepared(w);
    w.stripe.loseNextTransferAnswer();
    expect(await executeSettlement(w.deps, settlementId)).toMatchObject({ state: "transfer_unknown" });
    // The commissions stay reserved while the outcome is unknown.
    w.clock.advance(15 * 60 * 1000);
    expect(await executeSettlement(w.deps, settlementId)).toMatchObject({ state: "payout_pending" });
    expect(w.stripe.created.transfers).toBe(1);
  });

  it("repeats a timed-out request with the same idempotency key, inside Stripe's window", async () => {
    const w = world();
    const { settlementId } = await prepared(w);
    w.stripe.timeoutNextTransfer();
    expect(await executeSettlement(w.deps, settlementId)).toMatchObject({ state: "transfer_unknown" });
    w.clock.advance(15 * 60 * 1000);
    expect(await executeSettlement(w.deps, settlementId)).toMatchObject({ state: "payout_pending" });
    const attempts = await test.db.select().from(partnerTransferAttempts).where(eq(partnerTransferAttempts.settlementId, settlementId));
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({ status: "confirmed", operationId: `partner-transfer:${settlementId}:1` });
    expect(w.stripe.created.transfers).toBe(1);
  });

  it("waits when the platform balance cannot cover it, and releases a restricted account's payout", async () => {
    const w = world();
    const { settlementId } = await prepared(w);
    w.stripe.fund("eur", 100);
    expect(await executeSettlement(w.deps, settlementId)).toMatchObject({ state: "reserved", detail: "funds_unavailable" });
    expect(w.stripe.created.transfers).toBe(0);

    const restricted = await prepared(w);
    w.stripe.fund("eur", 1_000_000);
    w.stripe.accounts.set(restricted.partner.accountId, readiness(restricted.partner.accountId, { status: "restricted", detailsSubmitted: true, metadataPartnerId: restricted.partner.partnerId }));
    expect(await executeSettlement(w.deps, restricted.settlementId)).toMatchObject({ state: "canceled" });
    const commissions = await test.db.select().from(partnerCommissions).where(eq(partnerCommissions.partnerId, restricted.partner.partnerId));
    expect(commissions.every((c) => c.status === "available")).toBe(true);
  });

  it("after repeated attempts without enough platform balance, opens a funding case and releases the payout", async () => {
    const w = world();
    const { partner, settlementId } = await prepared(w);
    w.stripe.fund("eur", 100);
    await test.db.update(partnerSettlements).set({ attempts: 8 }).where(eq(partnerSettlements.id, settlementId));
    expect(await executeSettlement(w.deps, settlementId)).toMatchObject({ state: "canceled" });
    expect(w.stripe.created.transfers).toBe(0);
    const cases = await test.db.select().from(partnerReviewCases).where(eq(partnerReviewCases.settlementId, settlementId));
    expect(cases.map((c) => c.kind)).toEqual(["payout_funding"]);
    const commissions = await test.db.select().from(partnerCommissions).where(eq(partnerCommissions.partnerId, partner.partnerId));
    expect(commissions.every((c) => c.status === "available")).toBe(true);
  });

  it("asks a person when, three days after the transfer, the connected balance still does not cover the bank payout", async () => {
    const w = world();
    const { partner, settlementId } = await prepared(w);
    // The transfer is made, but the money is not there in EUR (converted to the account's currency, or withdrawn).
    const originalCreate = w.stripe.gateway.createTransfer.bind(w.stripe.gateway);
    w.stripe.gateway.createTransfer = async (input) => {
      const outcome = await originalCreate(input);
      w.stripe.drainConnected(partner.accountId, "eur");
      return outcome;
    };
    expect(await executeSettlement(w.deps, settlementId)).toMatchObject({ state: "transferred", detail: "connected_balance_pending" });
    expect(w.stripe.created.payouts).toBe(0);
    w.clock.advance(2 * DAY);
    expect(await executeSettlement(w.deps, settlementId)).toMatchObject({ state: "transferred" });
    expect(await test.db.select().from(partnerReviewCases).where(eq(partnerReviewCases.settlementId, settlementId))).toEqual([]);
    w.clock.advance(2 * DAY);
    expect(await executeSettlement(w.deps, settlementId)).toMatchObject({ state: "needs_review" });
    const cases = await test.db.select().from(partnerReviewCases).where(eq(partnerReviewCases.settlementId, settlementId));
    expect(cases.map((c) => c.kind)).toEqual(["payout_discrepancy"]);
    expect(w.stripe.created).toEqual({ transfers: 1, payouts: 0 });
  });

  it("releases a payout whose partner was held after it was prepared", async () => {
    const w = world();
    const { partner, settlementId } = await prepared(w);
    await test.db.update(partnerProfiles).set({ payoutHoldReason: "Fraud review" }).where(eq(partnerProfiles.id, partner.partnerId));
    expect(await executeSettlement(w.deps, settlementId)).toMatchObject({ state: "canceled" });
    expect(w.stripe.created.transfers).toBe(0);
  });

  it("releases a payout whose commission was refunded before the transfer", async () => {
    const w = world();
    const { partner, settlementId } = await prepared(w);
    w.billing.setCharge(partner.charges[0], { refunded: 9900 });
    await processChargeAdjustments(w.deps, partner.charges[0], "test");
    expect(await executeSettlement(w.deps, settlementId)).toMatchObject({ state: "canceled" });
    expect(w.stripe.created.transfers).toBe(0);
  });

  it("offsets a refund after payout against the next payout, or recovers it once by transfer reversal", async () => {
    const w = world();
    const { partner, settlementId } = await prepared(w, [9900, 9900]);
    await executeSettlement(w.deps, settlementId);
    w.billing.setCharge(partner.charges[0], { refunded: 9900 });
    await processChargeAdjustments(w.deps, partner.charges[0], "test");
    expect((await computeBalances(w.deps, partner.partnerId, "test", "eur")).liability).toBe(BigInt(-2475));

    // Recovered by transfer reversal: confirmed by Stripe, recorded once (the transfer.reversed event changes nothing more).
    const recovered = await requestTransferReversal(w.deps, admin, { settlementId, amount: BigInt(2475), reason: "Refunded customer" });
    expect(recovered).toEqual({ ok: true, value: { status: "confirmed" } });
    const [attempt] = await test.db.select().from(partnerTransferAttempts).where(eq(partnerTransferAttempts.settlementId, settlementId));
    await syncTransferReversals(w.deps, attempt.stripeTransferId!);
    const balances = await computeBalances(w.deps, partner.partnerId, "test", "eur");
    expect(balances).toMatchObject({ liability: BigInt(0), netTransferred: BigInt(2475) });
    // More than is owed cannot be reversed.
    expect(await requestTransferReversal(w.deps, admin, { settlementId, amount: BigInt(1), reason: "Too much" })).toMatchObject({ ok: false, detail: "more_than_owed" });
  });

  it("records a reversal made outside RepGet once, with a review case", async () => {
    const w = world();
    const { partner, settlementId } = await prepared(w);
    await executeSettlement(w.deps, settlementId);
    const [attempt] = await test.db.select().from(partnerTransferAttempts).where(eq(partnerTransferAttempts.settlementId, settlementId));
    w.stripe.reverseOutside(attempt.stripeTransferId!, 1000);
    await syncTransferReversals(w.deps, attempt.stripeTransferId!);
    await syncTransferReversals(w.deps, attempt.stripeTransferId!);
    const reversals = (await test.db.select().from(partnerLedgerEntries).where(eq(partnerLedgerEntries.partnerId, partner.partnerId))).filter((e) => e.kind === "transfer_reversal");
    expect(reversals.map((e) => e.amount)).toEqual([BigInt(1000)]);
    const cases = await test.db.select().from(partnerReviewCases).where(eq(partnerReviewCases.settlementId, settlementId));
    expect(cases.map((c) => c.kind)).toContain("payout_discrepancy");
  });

  it("never marks anything paid for a payout RepGet did not create", async () => {
    const w = world();
    const { partner, settlementId } = await prepared(w);
    await executeSettlement(w.deps, settlementId);
    const foreign = w.stripe.foreignPayout(partner.accountId, 4950);
    expect(await applyPayoutEvent(w.deps, { accountId: partner.accountId, payoutId: foreign, livemode: false })).toBe("not_ours");
    expect((await settlementOf(partner.partnerId))[0].state).toBe("payout_pending");
    const cases = await test.db.select().from(partnerReviewCases).where(eq(partnerReviewCases.partnerId, partner.partnerId));
    expect(cases.map((c) => c.kind)).toContain("unexpected_payout");
    // Nor for the wrong environment.
    expect(await applyPayoutEvent(w.deps, { accountId: partner.accountId, payoutId: foreign, livemode: true })).toBe("wrong_environment");
  });

  it("keeps payouts already submitted moving while new payouts are switched off", async () => {
    const w = world();
    const { partner, settlementId } = await prepared(w);
    await executeSettlement(w.deps, settlementId);
    await setControl(test.db, "partner_payouts", false);
    try {
      const [payout] = await test.db.select().from(partnerBankPayoutAttempts).where(eq(partnerBankPayoutAttempts.settlementId, settlementId));
      w.stripe.setPayoutStatus(payout.stripePayoutId!, "paid");
      w.clock.advance(2 * 60 * 60 * 1000);
      expect(await executeSettlement(w.deps, settlementId)).toMatchObject({ state: "paid" });
    } finally {
      await setControl(test.db, "partner_payouts", true);
    }
    expect((await settlementOf(partner.partnerId))[0].state).toBe("paid");
  });

  it("refuses a second settlement while one is not transferred yet", async () => {
    const w = world();
    const { partner } = await prepared(w);
    // The first settlement has not been sent: its earnings are reserved, nothing else is payable.
    expect(await prepareSettlement(w.deps, { kind: "system", origin: "t" }, { partnerId: partner.partnerId, currency: "eur", runKey: `run-${randomUUID()}` })).toMatchObject({ kind: "carried_forward" });
  });
});
