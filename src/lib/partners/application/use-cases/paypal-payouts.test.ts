import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { partnerCommissions, partnerLedgerEntries, partnerPayPalPayouts, partnerReviewCases, partnerSettlements } from "@/lib/db/schema";
import { settingsFromEnv } from "@/lib/partners/infrastructure/settings";
import { createTestDb, type TestDb } from "@/test/db";
import { fakeBilling, partnerTestDeps, seedPartner, seedStripeCustomer, seedUser, seedWorkspace, setControl } from "@/test/partners";

import type { PayPalPayoutEvidence, PayPalPayoutGateway, ProviderOutcome } from "../ports/payout-gateway";

/**
 * Partners paid through PayPal (use-cases/paypal-payouts.ts). Real
 * repositories on PGlite, a controlled clock, the same commissions as the
 * Stripe settlement tests, and a fake PayPal Payouts that is idempotent like
 * PayPal (the same sender_batch_id returns the same batch) and can lose an
 * answer. What matters: one payout per settlement, the liability settled ONCE
 * and only on SUCCESS (or a second person's confirmation, in manual mode),
 * nothing settled for money that never reached the partner.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
  isDatabaseConfigured: () => true,
}));

import type { AdminContext } from "../contracts/commands";
import { captureSignupEligibility } from "./attribute-new-customer";
import { executeSettlement } from "./execute-transfer";
import {
  choosePayoutMethod,
  confirmManualPayPalPayout,
  recordManualPayPalPayout,
  setPayPalRecipient,
  syncPayPalPayoutItem,
  verifyPayPalRecipient,
} from "./paypal-payouts";
import { cancelSettlement, prepareSettlement } from "./prepare-settlement";
import { processInvoice } from "./process-payment";
import { recordReferralClick } from "./record-referral-click";

let test: TestDb;
const DAY = 86_400_000;
const adminA: AdminContext = { kind: "admin", userId: "a", email: "first@repget.test" };
const adminB: AdminContext = { kind: "admin", userId: "b", email: "second@repget.test" };

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
  await setControl(test.db, "partner_program", true);
  await setControl(test.db, "partner_commissions", true);
  await setControl(test.db, "partner_payouts", true);
});

function fakePayPalPayouts() {
  const byBatch = new Map<string, PayPalPayoutEvidence>();
  const byItem = new Map<string, PayPalPayoutEvidence>();
  const forced: ProviderOutcome<PayPalPayoutEvidence>[] = [];
  /** The payout IS made, but the caller hears "unknown". */
  let loseNextAnswer = false;
  const calls: string[] = [];
  const gateway: PayPalPayoutGateway = {
    environment: () => "test",
    async createPayout(input) {
      calls.push(input.senderBatchId);
      const existing = byBatch.get(input.senderBatchId);
      if (existing) return { kind: "succeeded", value: existing };
      const next = forced.shift();
      if (next) return next;
      const evidence: PayPalPayoutEvidence = {
        batchId: `B-${randomUUID().slice(0, 8)}`,
        senderBatchId: input.senderBatchId,
        batchStatus: "PENDING",
        itemId: `I-${randomUUID().slice(0, 8)}`,
        itemStatus: "PENDING",
        transactionId: null,
        amount: input.amount,
        currency: input.currency,
        fee: null,
        receiver: input.receiver,
        error: null,
      };
      byBatch.set(input.senderBatchId, evidence);
      byItem.set(evidence.itemId!, evidence);
      if (loseNextAnswer) {
        loseNextAnswer = false;
        return { kind: "unknown", message: "PayPal took too long to respond" };
      }
      return { kind: "succeeded", value: evidence };
    },
    async getBatch(batchId) {
      return [...byBatch.values()].find((b) => b.batchId === batchId)!;
    },
    async getItem(itemId) {
      return byItem.get(itemId)!;
    },
  };
  return {
    gateway,
    calls,
    loseNextAnswer: () => void (loseNextAnswer = true),
    refuseNext: (code: string) => void forced.push({ kind: "refused", code, message: "refused" }),
    set(itemId: string, status: string) {
      const item = byItem.get(itemId)!;
      item.itemStatus = status;
      item.transactionId = status === "SUCCESS" ? "8XY12345AB6789012" : item.transactionId;
      item.fee = status === "SUCCESS" ? BigInt(25) : item.fee;
    },
  };
}

function world(mode: "automated" | "manual" = "automated", extra: Record<string, string> = {}) {
  const billing = fakeBilling();
  const paypal = fakePayPalPayouts();
  const settings = settingsFromEnv({
    STRIPE_SECRET_KEY: "sk_test_fake",
    NEXT_PUBLIC_APP_URL: "https://repget.test",
    PARTNER_PAYPAL_PAYOUTS: mode,
    PARTNER_PAYPAL_FEE_BEARER: "repget",
    PARTNER_PAYPAL_PAYOUT_COUNTRIES: "IT,FR",
    ...extra,
  } as unknown as NodeJS.ProcessEnv);
  const env = partnerTestDeps(test.db, { billing: billing.source, settings, paypalPayouts: paypal.gateway });
  // A known code, so the test can type it.
  env.deps.random = { ...env.deps.random, indexes: () => [1, 2, 3, 4, 5, 6] };
  return { ...env, billing, paypal };
}
type World = ReturnType<typeof world>;

/** A partner with two mature EUR 24.75 commissions (EUR 49.50), paid through PayPal, address verified. */
async function payPalPartner(w: World, options: { verify?: boolean } = {}) {
  const partner = await seedPartner(test.db, { country: "IT" });
  const now = w.clock.now();
  for (let i = 0; i < 2; i += 1) {
    w.clock.set(new Date(now.getTime() - 41 * DAY));
    const click = await recordReferralClick(w.deps, { code: partner.code, existingToken: null, landingPath: "/", referrerHost: null, visitor: randomUUID() });
    const createdAt = w.clock.now();
    const person = await seedUser(test.db, { createdAt });
    const orgId = await seedWorkspace(test.db, person.id, { createdAt });
    await captureSignupEligibility(w.deps, { userId: person.id, email: person.email, createdAt, method: "email", trackingToken: click.setCookie!.token, ipAddress: null, userAgent: null });
    const customerId = await seedStripeCustomer(test.db, orgId);
    w.clock.set(now);
    const invoice = w.billing.invoice({ customerId, total: 9900, collections: [{ cash: 9900, paidAt: new Date(now.getTime() - 40 * DAY) }] });
    await processInvoice(w.deps, invoice.invoiceId, "test");
  }
  if (options.verify !== false) {
    expect(await setPayPalRecipient(w.deps, { partnerId: partner.partnerId, email: "Partner@Example.test" })).toEqual({ ok: true, value: { receiver: "partner@example.test" } });
    expect(await verifyPayPalRecipient(w.deps, { partnerId: partner.partnerId, code: "123456" })).toMatchObject({ ok: true });
    expect(await choosePayoutMethod(w.deps, { partnerId: partner.partnerId, method: "paypal" })).toEqual({ ok: true, value: null });
  }
  return partner;
}

async function prepare(w: World, partnerId: string) {
  const outcome = await prepareSettlement(w.deps, { kind: "system", origin: "test" }, { partnerId, currency: "eur", runKey: "2026-10" });
  if (outcome.kind !== "created") throw new Error(`not created: ${JSON.stringify(outcome)}`);
  return outcome.settlementId;
}

const settlement = async (id: string) => (await test.db.select().from(partnerSettlements).where(eq(partnerSettlements.id, id)))[0];
const attempts = async (id: string) => test.db.select().from(partnerPayPalPayouts).where(eq(partnerPayPalPayouts.settlementId, id));
const ledger = async (partnerId: string, kind: string) =>
  test.db.select().from(partnerLedgerEntries).where(and(eq(partnerLedgerEntries.partnerId, partnerId), eq(partnerLedgerEntries.kind, kind)));
const commissionStatuses = async (partnerId: string) =>
  (await test.db.select({ status: partnerCommissions.status }).from(partnerCommissions).where(eq(partnerCommissions.partnerId, partnerId))).map((c) => c.status).sort();

describe("setting up PayPal payouts", () => {
  it("sends a code to the PayPal address and only a correct code verifies it", async () => {
    const w = world();
    const partner = await payPalPartner(w, { verify: false });
    await setPayPalRecipient(w.deps, { partnerId: partner.partnerId, email: "partner@example.test" });
    expect(w.mail.some((m) => m.to === "partner@example.test" && m.kind.includes("Confirm your PayPal address"))).toBe(true);
    expect(await choosePayoutMethod(w.deps, { partnerId: partner.partnerId, method: "paypal" })).toMatchObject({ ok: false, detail: "paypal_not_verified" });
    expect(await verifyPayPalRecipient(w.deps, { partnerId: partner.partnerId, code: "654321" })).toMatchObject({ ok: false, reason: "invalid" });
    expect(await verifyPayPalRecipient(w.deps, { partnerId: partner.partnerId, code: "123456" })).toMatchObject({ ok: true });
  });

  it("is not offered while the fee policy is undecided, or in a country PayPal payouts do not cover", async () => {
    const undecided = world("automated", { PARTNER_PAYPAL_FEE_BEARER: "" });
    const partner = await seedPartner(test.db, { country: "IT" });
    expect(await setPayPalRecipient(undecided.deps, { partnerId: partner.partnerId, email: "p@example.test" })).toMatchObject({ ok: false, detail: "fee_policy_undecided" });
    const w = world();
    const elsewhere = await seedPartner(test.db, { country: "US" });
    expect(await setPayPalRecipient(w.deps, { partnerId: elsewhere.partnerId, email: "p@example.test" })).toMatchObject({ ok: false, detail: "country_not_supported" });
  });
});

describe("an automated PayPal payout", () => {
  it("pays once and settles the liability once, only when PayPal reports SUCCESS", async () => {
    const w = world();
    const partner = await payPalPartner(w);
    const id = await prepare(w, partner.partnerId);
    expect(await settlement(id)).toMatchObject({ payoutMethod: "paypal", stripeAccountId: null, transferAmount: BigInt(4950), state: "reserved" });

    await executeSettlement(w.deps, id);
    const [attempt] = await attempts(id);
    expect(attempt).toMatchObject({ status: "pending", mode: "automated", receiver: "partner@example.test", amount: BigInt(4950) });
    expect(await ledger(partner.partnerId, "transfer_confirmed")).toHaveLength(0);

    w.paypal.set(attempt.payoutItemId!, "SUCCESS");
    await syncPayPalPayoutItem(w.deps, attempt.payoutItemId!);
    // The webhook again, and the sweep: nothing more.
    await syncPayPalPayoutItem(w.deps, attempt.payoutItemId!);
    await executeSettlement(w.deps, id);

    expect(w.paypal.calls).toHaveLength(1);
    expect((await ledger(partner.partnerId, "transfer_confirmed")).map((e) => e.amount)).toEqual([BigInt(-4950)]);
    expect(await settlement(id)).toMatchObject({ state: "paid" });
    expect(await commissionStatuses(partner.partnerId)).toEqual(["paid", "paid"]);
    expect((await attempts(id))[0]).toMatchObject({ status: "succeeded", transactionId: "8XY12345AB6789012", fee: BigInt(25) });
  });

  it("asks again with the same sender_batch_id after a lost answer, and never pays twice", async () => {
    const w = world();
    const partner = await payPalPartner(w);
    const id = await prepare(w, partner.partnerId);
    w.paypal.loseNextAnswer();
    await executeSettlement(w.deps, id);
    expect(await settlement(id)).toMatchObject({ state: "transfer_unknown" });
    expect((await attempts(id))[0]).toMatchObject({ status: "unknown" });

    await executeSettlement(w.deps, id);
    expect(new Set(w.paypal.calls).size).toBe(1);
    expect(w.paypal.calls).toHaveLength(2);
    expect(await attempts(id)).toHaveLength(1);
    expect((await attempts(id))[0]).toMatchObject({ status: "pending" });
  });

  it("settles nothing for money that never reached the partner, and lets the settlement be released", async () => {
    const w = world();
    const partner = await payPalPartner(w);
    const id = await prepare(w, partner.partnerId);
    await executeSettlement(w.deps, id);
    const [attempt] = await attempts(id);
    w.paypal.set(attempt.payoutItemId!, "RETURNED");
    await syncPayPalPayoutItem(w.deps, attempt.payoutItemId!);
    expect(await settlement(id)).toMatchObject({ state: "needs_review" });
    expect(await ledger(partner.partnerId, "transfer_confirmed")).toHaveLength(0);
    expect((await test.db.select().from(partnerReviewCases).where(eq(partnerReviewCases.settlementId, id))).length).toBeGreaterThan(0);
    // Nothing was paid: a person can release the reservations for the next run.
    expect(await cancelSettlement(w.deps, adminA, id, "returned: wrong address")).toEqual({ ok: true, value: null });
    expect(await commissionStatuses(partner.partnerId)).toEqual(["available", "available"]);
  });

  it("returns the liability once when PayPal takes back a payout it had settled", async () => {
    const w = world();
    const partner = await payPalPartner(w);
    const id = await prepare(w, partner.partnerId);
    await executeSettlement(w.deps, id);
    const [attempt] = await attempts(id);
    w.paypal.set(attempt.payoutItemId!, "SUCCESS");
    await syncPayPalPayoutItem(w.deps, attempt.payoutItemId!);
    w.paypal.set(attempt.payoutItemId!, "REFUNDED");
    await syncPayPalPayoutItem(w.deps, attempt.payoutItemId!);
    await syncPayPalPayoutItem(w.deps, attempt.payoutItemId!);
    expect((await ledger(partner.partnerId, "transfer_reversal")).map((e) => e.amount)).toEqual([BigInt(4950)]);
    expect(await settlement(id)).toMatchObject({ state: "needs_review" });
  });

  it("does not pay a settlement whose PayPal address changed since it was prepared", async () => {
    const w = world();
    const partner = await payPalPartner(w);
    const id = await prepare(w, partner.partnerId);
    await setPayPalRecipient(w.deps, { partnerId: partner.partnerId, email: "someone-else@example.test" });
    await executeSettlement(w.deps, id);
    expect(w.paypal.calls).toHaveLength(0);
    expect(await settlement(id)).toMatchObject({ state: "reserved" });
  });

  it("cannot reserve the same commissions twice: a second settlement for the run is refused", async () => {
    const w = world();
    const partner = await payPalPartner(w);
    await prepare(w, partner.partnerId);
    const again = await prepareSettlement(w.deps, { kind: "system", origin: "test" }, { partnerId: partner.partnerId, currency: "eur", runKey: "2026-10" });
    expect(again.kind).not.toBe("created");
  });
});

describe("a manual PayPal payout", () => {
  it("is settled only when a second person confirms the transaction recorded after sending", async () => {
    const w = world("manual");
    const partner = await payPalPartner(w);
    const id = await prepare(w, partner.partnerId);
    await executeSettlement(w.deps, id);
    expect(w.paypal.calls).toHaveLength(0);
    expect(await settlement(id)).toMatchObject({ state: "reserved" });

    expect(await recordManualPayPalPayout(w.deps, adminA, { settlementId: id, transactionId: "not-an-id", note: "" })).toMatchObject({ ok: false, detail: "transaction_id" });
    expect(await recordManualPayPalPayout(w.deps, adminA, { settlementId: id, transactionId: "9AB12345CD6789012", note: "sent from PayPal" })).toMatchObject({ ok: true });
    expect(await ledger(partner.partnerId, "transfer_confirmed")).toHaveLength(0);

    expect(await confirmManualPayPalPayout(w.deps, adminA, { settlementId: id, confirmation: "9AB12345CD6789012" })).toMatchObject({ ok: false, detail: "same_person" });
    expect(await confirmManualPayPalPayout(w.deps, adminB, { settlementId: id, confirmation: "9AB12345CD6789099" })).toMatchObject({ ok: false, detail: "transaction_id_mismatch" });
    expect(await confirmManualPayPalPayout(w.deps, adminB, { settlementId: id, confirmation: "9ab12345cd6789012" })).toEqual({ ok: true, value: null });

    expect((await ledger(partner.partnerId, "transfer_confirmed")).map((e) => e.amount)).toEqual([BigInt(-4950)]);
    expect(await settlement(id)).toMatchObject({ state: "paid" });
    expect((await attempts(id))[0]).toMatchObject({ mode: "manual", status: "succeeded", recordedBy: "first@repget.test" });
  });
});
