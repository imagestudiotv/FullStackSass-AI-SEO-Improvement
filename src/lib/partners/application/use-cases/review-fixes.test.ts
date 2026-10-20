import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";

import {
  adminAuditLog,
  partnerBankPayoutAttempts,
  partnerCommissions,
  partnerLedgerEntries,
  partnerProfiles,
  partnerProviderEvents,
  partnerReviewCases,
  partnerSettlements,
  partnerStripeAccounts,
  partnerTransferReversals,
  session,
} from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { fakeBilling, fakeConnect, fakePayouts, partnerTestDeps, readiness, seedPartner, seedStripeCustomer, seedUser, seedWorkspace, setControl } from "@/test/partners";

/**
 * The defects found by the Part 5 review of the whole program, each pinned by
 * a test (PGlite, real repositories, fake Stripe):
 *
 *  - a rejected or disqualified commission is final: a later refund or
 *    dispute does not reverse it twice, and no balance counts it;
 *  - a dispute's hold cannot be replaced or released by an administrator;
 *  - one transfer reversal at a time while Stripe has not confirmed one;
 *    reversals are matched by our operation id, never a refused request;
 *  - a payout under review can be resumed (a fresh count of bank failures)
 *    or cancelled before anything reached Stripe;
 *  - while the switch is off, a transfer whose outcome is unknown is only
 *    looked up, never re-sent;
 *  - a cancelled settlement does not use up the month; a released, fully
 *    refunded commission shows as reversed;
 *  - fraud signals reach coupon attributions and attributions completed
 *    after signup;
 *  - first touch belongs to a partner who is still active; the visitor rate
 *    limit applies before the code lookup; payout setup is budgeted; an
 *    account creation unresolved for a day is not retried blindly;
 *  - a refund undone after payout is a case, not a silent balance;
 *  - failed Stripe work can be queued again by an administrator.
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
import { holdCommission, rejectCommission } from "./manage-commission";
import { disqualifyAttribution } from "./manage-fraud-case";
import { startPayoutSetup } from "./manage-payout-account";
import { resumeSettlement } from "./manage-settlement";
import { computeBalances } from "./mature-commissions";
import { cancelSettlement, prepareSettlement } from "./prepare-settlement";
import { processChargeAdjustments } from "./process-adjustment";
import { processInvoice } from "./process-payment";
import { retryFailedProviderEvents } from "./process-provider-events";
import { recordReferralClick } from "./record-referral-click";
import { requestTransferReversal, syncTransferReversals } from "./reconcile-settlement";

let test: TestDb;
const DAY = 86_400_000;
const admin: AdminContext = { kind: "admin", userId: "a", email: "admin@repget.test" };

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
  for (const key of ["partner_program", "partner_commissions", "partner_payouts"] as const) await setControl(test.db, key, true);
});

function world() {
  const billing = fakeBilling();
  const stripe = fakePayouts();
  stripe.fund("eur", 1_000_000);
  const env = partnerTestDeps(test.db, { billing: billing.source, connect: stripe.gateway, payouts: stripe.gateway });
  return { ...env, billing, stripe };
}
type World = ReturnType<typeof world>;

async function readyPartner(w: World) {
  const partner = await seedPartner(test.db);
  const accountId = `acct_${randomUUID().replace(/-/g, "").slice(0, 14)}`;
  await test.db.insert(partnerStripeAccounts).values({ partnerId: partner.partnerId, environment: "test", stripeAccountId: accountId, status: "ready", detailsSubmitted: true, payoutsEnabled: true, transfersCapability: "active", payoutInterval: "manual", creationKey: `k-${randomUUID()}` });
  w.stripe.accounts.set(accountId, readiness(accountId, { status: "ready", detailsSubmitted: true, payoutsEnabled: true, transfersCapability: "active", requirementsCurrentlyDue: [], metadataPartnerId: partner.partnerId }));
  return { ...partner, accountId };
}

/** A referred customer of the partner who paid `amount` cents `daysAgo` days ago. */
async function referredPayment(w: World, code: string, amount: number, daysAgo = 40, signup: { ip?: string; ua?: string; workspaceLater?: boolean } = {}) {
  const now = w.clock.now();
  w.clock.set(new Date(now.getTime() - (daysAgo + 1) * DAY));
  const click = await recordReferralClick(w.deps, { code, existingToken: null, landingPath: "/", referrerHost: null, visitor: randomUUID() });
  const createdAt = w.clock.now();
  const person = await seedUser(test.db, { createdAt });
  let orgId = signup.workspaceLater ? null : await seedWorkspace(test.db, person.id, { createdAt });
  await captureSignupEligibility(w.deps, { userId: person.id, email: person.email, createdAt, method: "email", trackingToken: click.setCookie!.token, ipAddress: signup.ip ?? null, userAgent: signup.ua ?? null });
  if (!orgId) orgId = await seedWorkspace(test.db, person.id, { createdAt: new Date(createdAt.getTime() + 60_000) });
  w.clock.set(now);
  const invoice = w.billing.invoice({ customerId: await seedStripeCustomer(test.db, orgId), total: amount, collections: [{ cash: amount, paidAt: new Date(now.getTime() - daysAgo * DAY) }] });
  await processInvoice(w.deps, invoice.invoiceId, "test");
  return { orgId, chargeId: invoice.collections[0].chargeId!, invoice };
}

const commissionsOf = (partnerId: string) => test.db.select().from(partnerCommissions).where(eq(partnerCommissions.partnerId, partnerId));
const ledgerOf = (commissionId: string) => test.db.select().from(partnerLedgerEntries).where(eq(partnerLedgerEntries.commissionId, commissionId));
const casesFor = (settlementId: string) => test.db.select().from(partnerReviewCases).where(eq(partnerReviewCases.settlementId, settlementId));

async function settle(w: World, partnerId: string, runKey = `run-${randomUUID()}`) {
  const outcome = await prepareSettlement(w.deps, { kind: "system", origin: "test" }, { partnerId, currency: "eur", runKey });
  if (outcome.kind !== "created") throw new Error(`setup: ${outcome.kind} ${"reason" in outcome ? outcome.reason : ""}`);
  return outcome.settlementId;
}

async function sessionFor(userId: string, ipAddress: string, userAgent: string) {
  await test.db.insert(session).values({ id: randomUUID(), token: randomUUID(), userId, expiresAt: new Date("2027-06-01T00:00:00Z"), ipAddress, userAgent, createdAt: new Date(), updatedAt: new Date() });
}

describe("rejected and disqualified commissions are final", () => {
  it("a refund or a lost dispute after a rejection does not reverse the commission again, and no balance counts it", async () => {
    const w = world();
    const partner = await readyPartner(w);
    const { chargeId } = await referredPayment(w, partner.code, 9900);
    const [commission] = await commissionsOf(partner.partnerId);
    expect(await rejectCommission(w.deps, admin, commission.id, "Self-referral confirmed")).toEqual({ ok: true, value: null });

    w.billing.setCharge(chargeId, { refunded: 4950 });
    await processChargeAdjustments(w.deps, chargeId, "test");
    w.billing.setCharge(chargeId, { refunded: 9900, disputes: [{ status: "lost", amount: 9900 }] });
    await processChargeAdjustments(w.deps, chargeId, "test");
    w.billing.setCharge(chargeId, { refunded: 0, disputes: [] });
    await processChargeAdjustments(w.deps, chargeId, "test");

    const entries = (await ledgerOf(commission.id)).map((e) => e.amount);
    expect(entries.sort()).toEqual([BigInt(-2475), BigInt(2475)].sort());
    expect(await computeBalances(w.deps, partner.partnerId, "test", "eur")).toMatchObject({ netEarned: BigInt(0), pending: BigInt(0), available: BigInt(0), held: BigInt(0), liability: BigInt(0) });
    const [after] = await test.db.select().from(partnerCommissions).where(eq(partnerCommissions.id, commission.id));
    expect(after).toMatchObject({ status: "reversed", reviewState: "rejected" });
    expect(await holdCommission(w.deps, admin, commission.id, true, "Hold it anyway")).toMatchObject({ ok: false, detail: "rejected" });
  });

  it("disqualifying a referral is final too", async () => {
    const w = world();
    const partner = await readyPartner(w);
    const { chargeId, orgId } = await referredPayment(w, partner.code, 9900);
    const [attribution] = await test.db.execute<{ id: string }>(`select id from partner_attributions where organization_id = '${orgId}'`).then((r) => (r as unknown as { rows: { id: string }[] }).rows);
    expect(await disqualifyAttribution(w.deps, admin, attribution.id, "Fake account")).toMatchObject({ ok: true, value: { rejected: 1 } });
    w.billing.setCharge(chargeId, { refunded: 9900 });
    await processChargeAdjustments(w.deps, chargeId, "test");
    const [commission] = await commissionsOf(partner.partnerId);
    expect((await ledgerOf(commission.id)).map((e) => e.amount).reduce((a, b) => a + b, BigInt(0))).toBe(BigInt(0));
  });
});

describe("holds", () => {
  it("an administrator cannot replace or release a dispute's hold", async () => {
    const w = world();
    const partner = await readyPartner(w);
    const { chargeId } = await referredPayment(w, partner.code, 9900);
    w.billing.setCharge(chargeId, { disputes: [{ status: "needs_response", amount: 9900 }] });
    await processChargeAdjustments(w.deps, chargeId, "test");
    const [commission] = await commissionsOf(partner.partnerId);
    expect(commission.holdReason).toBe("dispute_open");
    expect(await holdCommission(w.deps, admin, commission.id, true, "Checking it myself")).toMatchObject({ ok: false, detail: "held_by_dispute" });
    expect(await holdCommission(w.deps, admin, commission.id, false, "Release it")).toMatchObject({ ok: false, detail: "not_an_admin_hold" });
    const [after] = await test.db.select().from(partnerCommissions).where(eq(partnerCommissions.id, commission.id));
    expect(after.holdReason).toBe("dispute_open");
  });
});

describe("transfer reversals", () => {
  it("allows no second reversal while one has no answer, then records the one Stripe made, matched by its operation id", async () => {
    const w = world();
    const partner = await readyPartner(w);
    const first = await referredPayment(w, partner.code, 9900);
    await referredPayment(w, partner.code, 9900);
    const settlementId = await settle(w, partner.partnerId);
    await executeSettlement(w.deps, settlementId);
    w.billing.setCharge(first.chargeId, { refunded: 9900 });
    await processChargeAdjustments(w.deps, first.chargeId, "test");

    // A refused request first (nothing reversed), then one whose answer is lost (reversed at Stripe).
    w.stripe.refuseNextReversal("balance_insufficient");
    expect(await requestTransferReversal(w.deps, admin, { settlementId, amount: BigInt(2475), reason: "Customer refunded" })).toMatchObject({ ok: false });
    w.stripe.loseNextReversalAnswer();
    expect(await requestTransferReversal(w.deps, admin, { settlementId, amount: BigInt(2475), reason: "Customer refunded" })).toEqual({ ok: true, value: { status: "unknown" } });
    expect((await casesFor(settlementId)).map((c) => c.kind)).toContain("payout_discrepancy");
    // The administrator clicks again: refused, so the partner is not charged twice.
    expect(await requestTransferReversal(w.deps, admin, { settlementId, amount: BigInt(2475), reason: "Again" })).toMatchObject({ ok: false, detail: "reversal_pending" });

    // transfer.reversed / reconciliation reads the transfer: the lost one is confirmed, the refused one stays refused.
    const [transferAttempt] = await test.db.execute(`select stripe_transfer_id from partner_transfer_attempts where settlement_id = '${settlementId}'`).then((r) => (r as unknown as { rows: { stripe_transfer_id: string }[] }).rows);
    await syncTransferReversals(w.deps, transferAttempt.stripe_transfer_id);
    const reversals = (await test.db.select().from(partnerTransferReversals)).filter((r) => r.operationId.includes(":"));
    const mine = reversals.filter((r) => r.amount === BigInt(2475) && r.requestedBy === admin.email);
    expect(mine.map((r) => r.status).sort()).toEqual(["confirmed", "failed"]);
    expect(await computeBalances(w.deps, partner.partnerId, "test", "eur")).toMatchObject({ liability: BigInt(0) });
  });
});

describe("payouts under review", () => {
  it("resumes after review with a fresh count of bank failures, still without a second transfer", async () => {
    const w = world();
    const partner = await readyPartner(w);
    await referredPayment(w, partner.code, 9900);
    await referredPayment(w, partner.code, 9900);
    const settlementId = await settle(w, partner.partnerId);
    await executeSettlement(w.deps, settlementId);
    for (let i = 0; i < 3; i += 1) {
      const attempts = await test.db.select().from(partnerBankPayoutAttempts).where(eq(partnerBankPayoutAttempts.settlementId, settlementId));
      const latest = attempts.sort((a, b) => b.attemptNumber - a.attemptNumber)[0];
      w.stripe.setPayoutStatus(latest.stripePayoutId!, "failed");
      await applyPayoutEvent(w.deps, { accountId: partner.accountId, payoutId: latest.stripePayoutId!, livemode: false });
      w.clock.advance(DAY);
      await executeSettlement(w.deps, settlementId);
    }
    let [row] = await test.db.select().from(partnerSettlements).where(eq(partnerSettlements.id, settlementId));
    expect(row.state).toBe("needs_review");
    expect(w.stripe.created).toEqual({ transfers: 1, payouts: 3 });

    expect(await resumeSettlement(w.deps, admin, settlementId, "Partner fixed their bank details")).toMatchObject({ ok: true, value: { state: "payout_pending" } });
    [row] = await test.db.select().from(partnerSettlements).where(eq(partnerSettlements.id, settlementId));
    expect(row.resumedAt).not.toBeNull();
    expect(w.stripe.created).toEqual({ transfers: 1, payouts: 4 });
    expect(await resumeSettlement(w.deps, admin, settlementId, "Again")).toMatchObject({ ok: false, detail: "state_payout_pending" });
  });

  it("cancels a payout under review when nothing reached Stripe, releasing its commissions", async () => {
    const w = world();
    const partner = await readyPartner(w);
    await referredPayment(w, partner.code, 9900);
    await referredPayment(w, partner.code, 9900);
    const settlementId = await settle(w, partner.partnerId);
    await test.db.update(partnerSettlements).set({ state: "needs_review" }).where(eq(partnerSettlements.id, settlementId));
    expect(await cancelSettlement(w.deps, admin, settlementId, "Reviewed: start again")).toEqual({ ok: true, value: null });
    expect((await commissionsOf(partner.partnerId)).map((c) => c.status)).toEqual(["available", "available"]);
  });
});

describe("bank payout events", () => {
  it("match a payout whose create answer was lost by the operation id in its metadata, however old the settlement", async () => {
    const w = world();
    const partner = await readyPartner(w);
    await referredPayment(w, partner.code, 9900);
    await referredPayment(w, partner.code, 9900);
    const settlementId = await settle(w, partner.partnerId);
    await executeSettlement(w.deps, settlementId);
    const [attempt] = await test.db.select().from(partnerBankPayoutAttempts).where(eq(partnerBankPayoutAttempts.settlementId, settlementId));
    // As if the create call's answer had been lost: the payout exists at Stripe, we never learnt its id.
    await test.db.update(partnerBankPayoutAttempts).set({ stripePayoutId: null, status: "unknown" }).where(eq(partnerBankPayoutAttempts.id, attempt.id));
    w.stripe.setPayoutStatus(attempt.stripePayoutId!, "paid");
    expect(await applyPayoutEvent(w.deps, { accountId: partner.accountId, payoutId: attempt.stripePayoutId!, livemode: false })).toBe("applied");
    const [row] = await test.db.select().from(partnerSettlements).where(eq(partnerSettlements.id, settlementId));
    expect(row.state).toBe("paid");
    expect(await test.db.select().from(partnerReviewCases).where(and(eq(partnerReviewCases.partnerId, partner.partnerId), eq(partnerReviewCases.kind, "unexpected_payout")))).toEqual([]);
  });
});

describe("money movement switched off", () => {
  it("only looks up a transfer whose outcome is unknown, and re-sends it once allowed again", async () => {
    const w = world();
    const partner = await readyPartner(w);
    await referredPayment(w, partner.code, 9900);
    await referredPayment(w, partner.code, 9900);
    const settlementId = await settle(w, partner.partnerId);
    w.stripe.timeoutNextTransfer();
    expect(await executeSettlement(w.deps, settlementId)).toMatchObject({ state: "transfer_unknown" });
    await setControl(test.db, "partner_payouts", false);
    try {
      w.clock.advance(15 * 60 * 1000);
      expect(await executeSettlement(w.deps, settlementId)).toMatchObject({ state: "transfer_unknown", detail: "transfer_unknown_held" });
      expect(w.stripe.created.transfers).toBe(0);
      // Suspended meanwhile: the same.
    } finally {
      await setControl(test.db, "partner_payouts", true);
    }
    await test.db.update(partnerProfiles).set({ status: "suspended" }).where(eq(partnerProfiles.id, partner.partnerId));
    w.clock.advance(15 * 60 * 1000);
    expect(await executeSettlement(w.deps, settlementId)).toMatchObject({ detail: "transfer_unknown_held" });
    expect(w.stripe.created.transfers).toBe(0);
    await test.db.update(partnerProfiles).set({ status: "active" }).where(eq(partnerProfiles.id, partner.partnerId));
    w.clock.advance(15 * 60 * 1000);
    expect(await executeSettlement(w.deps, settlementId)).toMatchObject({ state: "payout_pending" });
    expect(w.stripe.created.transfers).toBe(1);
  });
});

describe("cancelled settlements", () => {
  it("do not use up the month, and a fully refunded commission is released as reversed", async () => {
    const w = world();
    const partner = await readyPartner(w);
    const first = await referredPayment(w, partner.code, 9900);
    await referredPayment(w, partner.code, 9900);
    await referredPayment(w, partner.code, 9900);
    const settlementId = await settle(w, partner.partnerId, "2026-10");
    w.billing.setCharge(first.chargeId, { refunded: 9900 });
    await processChargeAdjustments(w.deps, first.chargeId, "test");
    expect(await executeSettlement(w.deps, settlementId)).toMatchObject({ state: "canceled", detail: "allocations_changed" });
    const statuses = (await commissionsOf(partner.partnerId)).map((c) => c.status).sort();
    expect(statuses).toEqual(["available", "available", "reversed"]);
    // The same month again: the two left are paid.
    expect(await prepareSettlement(w.deps, { kind: "system", origin: "test" }, { partnerId: partner.partnerId, currency: "eur", runKey: "2026-10" })).toMatchObject({ kind: "created", transferAmount: BigInt(4950) });
  });
});

describe("fraud signals after signup", () => {
  it("a coupon attribution from the coupon partner's own network is held for review", async () => {
    const w = world();
    const partner = await readyPartner(w);
    await sessionFor(partner.userId, "203.0.113.50", "Mozilla/5.0 Partner");
    const coupon = await w.deps.uow.repositories.coupons.create({ environment: "test", partnerId: partner.partnerId, code: `OWN${randomUUID().slice(0, 6).toUpperCase()}`, campaign: "Own", discountType: "percent_first_payment", percentOffBasisPoints: 2000, amountOff: null, currency: null, duration: "once", durationInMonths: null, appliesToProducts: [], startsAt: null, expiresAt: null, maxRedemptions: null, firstTimeTransaction: true, createdByEmail: admin.email });
    const promo = `promo_${randomUUID().slice(0, 8)}`;
    await w.deps.uow.repositories.coupons.attachStripe(coupon!.id, { stripeCouponId: "co_x", stripePromotionCodeId: promo }, "active");
    // A new account without any link, from the partner's network and browser, pays with the partner's own coupon.
    const createdAt = new Date(w.clock.now().getTime() - DAY);
    const person = await seedUser(test.db, { createdAt });
    const orgId = await seedWorkspace(test.db, person.id, { createdAt });
    await captureSignupEligibility(w.deps, { userId: person.id, email: person.email, createdAt, method: "email", trackingToken: null, ipAddress: "203.0.113.50", userAgent: "Mozilla/5.0 Partner" });
    const invoice = w.billing.invoice({ customerId: await seedStripeCustomer(test.db, orgId), total: 7920, discount: 1980, promotionCodeIds: [promo], collections: [{ cash: 7920, paidAt: w.clock.now() }] });
    await processInvoice(w.deps, invoice.invoiceId, "test");
    const rows = await test.db.execute(`select status, source from partner_attributions where organization_id = '${orgId}'`).then((r) => (r as unknown as { rows: { status: string; source: string }[] }).rows);
    expect(rows).toEqual([{ status: "review", source: "coupon" }]);
    const [commission] = await commissionsOf(partner.partnerId);
    expect(commission.reviewState).toBe("needs_review");
  });

  it("a link attribution completed after signup keeps the signals recorded at signup", async () => {
    const w = world();
    const partner = await readyPartner(w);
    await sessionFor(partner.userId, "203.0.113.51", "Mozilla/5.0 Partner");
    const { orgId } = await referredPayment(w, partner.code, 9900, 5, { ip: "203.0.113.51", ua: "Mozilla/5.0 Partner", workspaceLater: true });
    const rows = await test.db.execute(`select status from partner_attributions where organization_id = '${orgId}'`).then((r) => (r as unknown as { rows: { status: string }[] }).rows);
    expect(rows).toEqual([{ status: "review" }]);
  });
});

describe("tracking and payout setup limits", () => {
  it("gives the browser to the new partner when the first touch's partner was suspended", async () => {
    const w = world();
    const first = await seedPartner(test.db);
    const second = await seedPartner(test.db);
    const visitor = randomUUID();
    const a = await recordReferralClick(w.deps, { code: first.code, existingToken: null, landingPath: "/", referrerHost: null, visitor });
    expect(a.setCookie).not.toBeNull();
    // Still active: first touch stands.
    expect((await recordReferralClick(w.deps, { code: second.code, existingToken: a.setCookie!.token, landingPath: "/", referrerHost: null, visitor })).setCookie).toBeNull();
    await test.db.update(partnerProfiles).set({ status: "suspended" }).where(eq(partnerProfiles.id, first.partnerId));
    expect((await recordReferralClick(w.deps, { code: second.code, existingToken: a.setCookie!.token, landingPath: "/", referrerHost: null, visitor })).setCookie).not.toBeNull();
  });

  it("limits a visitor before looking codes up, and budgets a partner's Stripe calls", async () => {
    const env = partnerTestDeps(test.db, { connect: fakeConnect().gateway });
    env.admitted.burst = false;
    expect(await recordReferralClick(env.deps, { code: "nosuchcode", existingToken: null, landingPath: "/", referrerHost: null, visitor: randomUUID() })).toMatchObject({ reason: "rate_limited" });
    const partner = await seedPartner(test.db);
    const [record] = await test.db.select().from(partnerProfiles).where(eq(partnerProfiles.id, partner.partnerId));
    const access = { context: { kind: "partner" as const, userId: partner.userId, partnerId: partner.partnerId }, partner: (await env.deps.uow.repositories.partners.findById(record.id))! };
    expect(await startPayoutSetup(env.deps, access)).toMatchObject({ ok: false, reason: "rate_limited" });
  });

  it("does not retry an account creation left unresolved for more than a day", async () => {
    const connect = fakeConnect();
    const env = partnerTestDeps(test.db, { connect: connect.gateway });
    const partner = await seedPartner(test.db);
    const reservedAt = new Date(env.clock.now().getTime() - 2 * DAY);
    await test.db.insert(partnerStripeAccounts).values({ partnerId: partner.partnerId, environment: "test", creationKey: `partner-account:${partner.partnerId}:test`, country: "IT", status: "creating", createdAt: reservedAt, updatedAt: reservedAt });
    const access = { context: { kind: "partner" as const, userId: partner.userId, partnerId: partner.partnerId }, partner: (await env.deps.uow.repositories.partners.findById(partner.partnerId))! };
    expect(await startPayoutSetup(env.deps, access)).toMatchObject({ ok: false, reason: "provider_outcome_unknown", detail: "account_unresolved" });
    expect(connect.calls.filter((c) => c.method === "createConnectedAccount")).toHaveLength(0);
    const cases = await test.db.select().from(partnerReviewCases).where(and(eq(partnerReviewCases.partnerId, partner.partnerId), eq(partnerReviewCases.kind, "payout_discrepancy")));
    expect(cases).toHaveLength(1);
  });
});

describe("after payout", () => {
  it("a refund undone after the commission was paid opens a case instead of a silent balance", async () => {
    const w = world();
    const partner = await readyPartner(w);
    const first = await referredPayment(w, partner.code, 9900);
    await referredPayment(w, partner.code, 9900);
    w.billing.setCharge(first.chargeId, { refunded: 4950 });
    await processChargeAdjustments(w.deps, first.chargeId, "test");
    const settlementId = await settle(w, partner.partnerId);
    await executeSettlement(w.deps, settlementId);
    w.billing.setCharge(first.chargeId, { refunded: 0 });
    await processChargeAdjustments(w.deps, first.chargeId, "test");
    const cases = await test.db.select().from(partnerReviewCases).where(and(eq(partnerReviewCases.partnerId, partner.partnerId), eq(partnerReviewCases.kind, "financial_inconsistency")));
    expect(cases.map((c) => c.summary)).toEqual([expect.stringContaining("12.38")]);
  });
});

describe("failed Stripe work", () => {
  it("can be queued again by an administrator, with an audit entry", async () => {
    const w = world();
    const eventId = `evt_${randomUUID()}`;
    await test.db.insert(partnerProviderEvents).values({ environment: "test", stripeEventId: eventId, eventType: "invoice:invoice.paid", objectId: "in_missing", eventCreatedAt: new Date(), status: "failed", attempts: 12, nextAttemptAt: new Date(), lastError: "boom" });
    expect(await retryFailedProviderEvents(w.deps, admin, "Stripe outage over")).toMatchObject({ ok: true });
    const [row] = await test.db.select().from(partnerProviderEvents).where(eq(partnerProviderEvents.stripeEventId, eventId));
    expect(row).toMatchObject({ status: "pending", attempts: 0, lastError: null });
    expect(await test.db.select().from(adminAuditLog).where(eq(adminAuditLog.action, "partner.provider_events_retried"))).toHaveLength(1);
  });
});
