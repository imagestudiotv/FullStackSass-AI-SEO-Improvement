import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";

import {
  partnerBankPayoutAttempts,
  partnerCommissions,
  partnerLedgerEntries,
  partnerPayPalPayouts,
  partnerProviderEvents,
  partnerSettlements,
  partnerStripeAccounts,
  payments,
  subscriptions,
} from "@/lib/db/schema";
import { settingsFromEnv } from "@/lib/partners/infrastructure/settings";
import { createTestDb, type TestDb } from "@/test/db";
import { fakeBilling, fakePayouts, partnerTestDeps, readiness, seedPartner, seedStripeCustomer, seedUser, seedWorkspace, setControl } from "@/test/partners";

import type { PayPalPayoutEvidence, PayPalPayoutGateway, ProviderOutcome } from "../ports/payout-gateway";

/**
 * The cash audit of 2026-11-24 (Daniel: "test properly if there is anything
 * wrong at any step"): every way a partner, a referral or a payout could be
 * lost - or paid twice - that the audit found, each pinned by a test.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
  isDatabaseConfigured: () => true,
}));

import type { AdminContext } from "../contracts/commands";
import { sendApplicationNotice } from "./application-notices";
import { captureSignupEligibility } from "./attribute-new-customer";
import { executeSettlement } from "./execute-transfer";
import { syncPayoutAccount } from "./manage-payout-account";
import { resumeSettlement } from "./manage-settlement";
import { computeBalances } from "./mature-commissions";
import { choosePayoutMethod, setPayPalRecipient, syncPayPalPayoutItem, verifyPayPalRecipient } from "./paypal-payouts";
import { cancelSettlement, prepareSettlement, runMonthlySettlements } from "./prepare-settlement";
import { processChargeAdjustments } from "./process-adjustment";
import { processInvoice } from "./process-payment";
import { processPayPalSale } from "./process-paypal-sale";
import { reconcileCommissions } from "./reconcile-commissions";
import { recordReferralClick } from "./record-referral-click";
import { refreshPartnerTier } from "./refresh-partner-tier";
import { rejectApplication } from "./review-application";
import { submitApplication } from "./submit-application";

let test: TestDb;
const DAY = 86_400_000;
const admin: AdminContext = { kind: "admin", userId: "a", email: "admin@repget.test" };
const system = { kind: "system", origin: "test" } as const;

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
  await setControl(test.db, "partner_program", true);
  await setControl(test.db, "partner_commissions", true);
  await setControl(test.db, "partner_payouts", true);
});

/** PayPal Payouts as documented: idempotent per request id, and "refused" answers on demand. */
function fakePayPal() {
  const byBatch = new Map<string, PayPalPayoutEvidence>();
  const answers: ProviderOutcome<PayPalPayoutEvidence>[] = [];
  let loseNext = false;
  const calls: string[] = [];
  const gateway: PayPalPayoutGateway = {
    environment: () => "test",
    async createPayout(input) {
      calls.push(input.senderBatchId);
      const forced = answers.shift();
      if (forced) return forced;
      const existing = byBatch.get(input.senderBatchId);
      if (existing) return { kind: "succeeded", value: existing };
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
      if (loseNext) {
        loseNext = false;
        return { kind: "unknown", message: "PayPal took too long to respond" };
      }
      return { kind: "succeeded", value: evidence };
    },
    async getBatch(batchId) {
      return [...byBatch.values()].find((batch) => batch.batchId === batchId)!;
    },
    async getItem(itemId) {
      return [...byBatch.values()].find((batch) => batch.itemId === itemId)!;
    },
  };
  return {
    gateway,
    calls,
    made: byBatch,
    loseNextAnswer: () => void (loseNext = true),
    refuseNext: (code: string) => void answers.push({ kind: "refused", code, message: code }),
  };
}

function world() {
  const billing = fakeBilling();
  const paypal = fakePayPal();
  const stripe = fakePayouts();
  stripe.fund("eur", 1_000_000);
  const settings = settingsFromEnv({
    STRIPE_SECRET_KEY: "sk_test_fake",
    NEXT_PUBLIC_APP_URL: "https://repget.test",
    PARTNER_PAYOUT_FORM: "cash",
    PARTNER_PAYPAL_PAYOUTS: "automated",
    PARTNER_PAYPAL_FEE_BEARER: "repget",
    PARTNER_PAYPAL_PAYOUT_COUNTRIES: "IT",
    ADMIN_EMAILS: "owner@repget.test, Second@repget.test",
  } as unknown as NodeJS.ProcessEnv);
  const env = partnerTestDeps(test.db, { billing: billing.source, settings, paypalPayouts: paypal.gateway, connect: stripe.gateway, payouts: stripe.gateway });
  env.deps.random = { ...env.deps.random, indexes: () => [1, 2, 3, 4, 5, 6] };
  return { ...env, billing, paypal, stripe };
}
type World = ReturnType<typeof world>;

async function referred(w: World, code: string) {
  const click = await recordReferralClick(w.deps, { code, existingToken: null, landingPath: "/", referrerHost: null, visitor: randomUUID() });
  const createdAt = w.clock.now();
  const person = await seedUser(test.db, { createdAt });
  const orgId = await seedWorkspace(test.db, person.id, { createdAt });
  await captureSignupEligibility(w.deps, { userId: person.id, email: person.email, createdAt, method: "email", trackingToken: click.setCookie!.token, ipAddress: null, userAgent: null });
  return orgId;
}

/** New customers of this partner, each having paid `amount` 40 days ago. */
async function commissions(w: World, code: string, amounts: number[]) {
  const now = w.clock.now();
  const charges: string[] = [];
  for (const amount of amounts) {
    w.clock.set(new Date(now.getTime() - 41 * DAY));
    const orgId = await referred(w, code);
    const customerId = await seedStripeCustomer(test.db, orgId);
    w.clock.set(now);
    const invoice = w.billing.invoice({ customerId, total: amount, collections: [{ cash: amount, paidAt: new Date(now.getTime() - 40 * DAY) }] });
    await processInvoice(w.deps, invoice.invoiceId, "test");
    charges.push(invoice.collections[0].chargeId!);
  }
  return charges;
}

async function payPalPartner(w: World, amounts = [9900, 9900]) {
  const partner = await seedPartner(test.db, { country: "IT" });
  const charges = await commissions(w, partner.code, amounts);
  await setPayPalRecipient(w.deps, { partnerId: partner.partnerId, email: "partner@example.test" });
  await verifyPayPalRecipient(w.deps, { partnerId: partner.partnerId, code: "123456" });
  await choosePayoutMethod(w.deps, { partnerId: partner.partnerId, method: "paypal" });
  return { ...partner, charges };
}

async function stripePartner(w: World, amounts = [9900, 9900]) {
  const partner = await seedPartner(test.db);
  const accountId = `acct_${randomUUID().replace(/-/g, "").slice(0, 14)}`;
  await test.db.insert(partnerStripeAccounts).values({ partnerId: partner.partnerId, environment: "test", stripeAccountId: accountId, status: "ready", detailsSubmitted: true, payoutsEnabled: true, transfersCapability: "active", payoutInterval: "manual", creationKey: `k-${randomUUID()}` });
  w.stripe.accounts.set(accountId, readiness(accountId, { status: "ready", detailsSubmitted: true, payoutsEnabled: true, transfersCapability: "active", requirementsCurrentlyDue: [], metadataPartnerId: partner.partnerId }));
  const charges = await commissions(w, partner.code, amounts);
  return { ...partner, accountId, charges };
}

async function prepare(w: World, partnerId: string, runKey = "2026-10") {
  const outcome = await prepareSettlement(w.deps, system, { partnerId, currency: "eur", runKey });
  if (outcome.kind !== "created") throw new Error(`not created: ${outcome.kind} ${outcome.reason}`);
  return outcome.settlementId;
}

const settlement = async (id: string) => (await test.db.select().from(partnerSettlements).where(eq(partnerSettlements.id, id)))[0];
const attempts = async (id: string) => test.db.select().from(partnerPayPalPayouts).where(eq(partnerPayPalPayouts.settlementId, id));
const bankPayouts = async (id: string) => test.db.select().from(partnerBankPayoutAttempts).where(eq(partnerBankPayoutAttempts.settlementId, id));
const statuses = async (partnerId: string) =>
  (await test.db.select({ status: partnerCommissions.status }).from(partnerCommissions).where(eq(partnerCommissions.partnerId, partnerId))).map((row) => row.status).sort();
const liability = async (w: World, partnerId: string) => (await computeBalances(w.deps, partnerId, "test", "eur")).liability;

describe("the monthly run", () => {
  it("pays every other partner when one partner's settlement throws", async () => {
    const w = world();
    const first = await stripePartner(w);
    const second = await stripePartner(w);
    const ours = new Set([first.partnerId, second.partnerId]);
    const uow = w.deps.uow;
    const repos = uow.repositories;
    let failed: string | null = null;
    // Whichever of the two comes first in the run fails, as a dropped connection would.
    w.deps.uow = {
      transaction: (work) => uow.transaction(work),
      repositories: {
        ...repos,
        stripeAccounts: {
          ...repos.stripeAccounts,
          find: async (partnerId, environment) => {
            if (failed === null && ours.has(partnerId)) {
              failed = partnerId;
              throw new Error("connection lost");
            }
            return repos.stripeAccounts.find(partnerId, environment);
          },
        },
      },
    };
    const run = await runMonthlySettlements(w.deps);
    const other = failed === first.partnerId ? second.partnerId : first.partnerId;
    expect(run.results.find((result) => result.partnerId === other)?.outcome.kind).toBe("created");
    expect(run.results.find((result) => result.partnerId === failed)?.outcome).toMatchObject({ kind: "skipped", reason: "error" });
    // The run is repeated (the next days' cron): the failed one is paid, the other one only once.
    const again = await runMonthlySettlements(w.deps);
    expect(again.results.find((result) => result.partnerId === failed)?.outcome.kind).toBe("created");
    expect(again.results.find((result) => result.partnerId === other)?.outcome.kind).not.toBe("created");
  });
});

describe("a PayPal payout whose first answer was lost", () => {
  it.each(["USER_BUSINESS_ERROR", "AUTHORIZATION_ERROR", "RATE_LIMIT_REACHED", "auth"])(
    "is never written off because the repeat was refused (%s): the first one may have paid",
    async (code) => {
      const w = world();
      const partner = await payPalPartner(w);
      const id = await prepare(w, partner.partnerId);
      w.paypal.loseNextAnswer();
      await executeSettlement(w.deps, id);
      expect((await attempts(id))[0].status).toBe("unknown");

      w.paypal.refuseNext(code);
      await executeSettlement(w.deps, id);
      expect((await attempts(id)).map((attempt) => attempt.status)).toEqual(["unknown"]);
      // A person cannot release it either: PayPal may have paid it.
      expect(await cancelSettlement(w.deps, admin, id, "PayPal refused it")).toMatchObject({ ok: false });
      expect(await statuses(partner.partnerId)).toEqual(["reserved", "reserved"]);

      // It settles once, when PayPal reports the payout it made the first time.
      const made = [...w.paypal.made.values()][0];
      made.itemStatus = "SUCCESS";
      made.transactionId = "8XY12345AB6789012";
      await syncPayPalPayoutItem(w.deps, made.itemId!);
      expect(await settlement(id)).toMatchObject({ state: "paid" });
      expect(await statuses(partner.partnerId)).toEqual(["paid", "paid"]);
      expect(new Set(w.paypal.calls).size).toBe(1);
    },
  );
});

describe("a PayPal payout that cannot go now", () => {
  it("is tried again after a refusal that will pass (no funds, rate limit, credentials), without a person", async () => {
    const w = world();
    const partner = await payPalPartner(w);
    const id = await prepare(w, partner.partnerId);
    w.paypal.refuseNext("INSUFFICIENT_FUNDS");
    await executeSettlement(w.deps, id);
    expect(await settlement(id)).toMatchObject({ state: "reserved" });
    await executeSettlement(w.deps, id);
    expect((await attempts(id)).map((attempt) => attempt.status).sort()).toEqual(["failed", "pending"]);
    expect(new Set(w.paypal.calls).size).toBe(2);
  });

  it("is released when a dispute changed what it pays, so the rest is paid by the next run", async () => {
    const w = world();
    const partner = await payPalPartner(w, [9900, 9900, 9900]);
    const id = await prepare(w, partner.partnerId);
    w.billing.setCharge(partner.charges[0], { disputes: [{ status: "needs_response", amount: 9900 }] });
    await processChargeAdjustments(w.deps, partner.charges[0], "test");
    await executeSettlement(w.deps, id);
    expect(await settlement(id)).toMatchObject({ state: "canceled" });
    expect(w.paypal.calls).toHaveLength(0);
    const next = await prepare(w, partner.partnerId);
    expect(await settlement(next)).toMatchObject({ transferAmount: BigInt(4950) });
  });

  it("is released after a week it could not be sent (the address was never confirmed again)", async () => {
    const w = world();
    const partner = await payPalPartner(w);
    const id = await prepare(w, partner.partnerId);
    await setPayPalRecipient(w.deps, { partnerId: partner.partnerId, email: "new@example.test" });
    await executeSettlement(w.deps, id);
    expect(await settlement(id)).toMatchObject({ state: "reserved" });
    w.clock.set(new Date(w.clock.now().getTime() + 8 * DAY));
    await executeSettlement(w.deps, id);
    expect(await settlement(id)).toMatchObject({ state: "canceled" });
    expect(await statuses(partner.partnerId)).toEqual(["available", "available"]);
  });

  it("goes to review when PayPal denied the whole batch, even with no item in it", async () => {
    const w = world();
    const partner = await payPalPartner(w);
    const id = await prepare(w, partner.partnerId);
    await executeSettlement(w.deps, id);
    const made = [...w.paypal.made.values()][0];
    made.itemStatus = null;
    made.batchStatus = "DENIED";
    await executeSettlement(w.deps, id);
    expect(await settlement(id)).toMatchObject({ state: "needs_review" });
    expect(await cancelSettlement(w.deps, admin, id, "denied by PayPal")).toEqual({ ok: true, value: null });
  });
});

describe("a PayPal payout under review", () => {
  it("that PayPal took back can be paid again: released by a person, and paid by a later run", async () => {
    const w = world();
    const partner = await payPalPartner(w);
    const id = await prepare(w, partner.partnerId);
    await executeSettlement(w.deps, id);
    const made = [...w.paypal.made.values()][0];
    made.itemStatus = "SUCCESS";
    await syncPayPalPayoutItem(w.deps, made.itemId!);
    expect(await liability(w, partner.partnerId)).toBe(BigInt(0));
    made.itemStatus = "REFUNDED";
    await syncPayPalPayoutItem(w.deps, made.itemId!);
    expect(await liability(w, partner.partnerId)).toBe(BigInt(4950));

    // Resuming it would leave it "reserved" for ever, blocking every later payout of this partner.
    expect(await resumeSettlement(w.deps, admin, id, "please try again")).toMatchObject({ ok: false });
    expect(await settlement(id)).toMatchObject({ state: "needs_review" });

    expect(await cancelSettlement(w.deps, admin, id, "the partner sent it back by mistake")).toEqual({ ok: true, value: null });
    expect(await statuses(partner.partnerId)).toEqual(["available", "available"]);
    const next = await prepare(w, partner.partnerId, "2026-11");
    expect(await settlement(next)).toMatchObject({ transferAmount: BigInt(4950), state: "reserved" });
    const entries = await test.db.select().from(partnerLedgerEntries).where(and(eq(partnerLedgerEntries.partnerId, partner.partnerId), eq(partnerLedgerEntries.kind, "transfer_reversal")));
    expect(entries.map((entry) => entry.amount)).toEqual([BigInt(4950)]);
  });

  it("whose outcome is unknown is resumed as unknown, never as a new payout", async () => {
    const w = world();
    const partner = await payPalPartner(w);
    const id = await prepare(w, partner.partnerId);
    w.paypal.loseNextAnswer();
    await executeSettlement(w.deps, id);
    w.paypal.refuseNext("AUTHORIZATION_ERROR");
    await executeSettlement(w.deps, id);
    expect(await settlement(id)).toMatchObject({ state: "needs_review" });
    expect(await resumeSettlement(w.deps, admin, id, "Payouts access is back")).toMatchObject({ ok: true });
    expect(await attempts(id)).toHaveLength(1);
    expect((await attempts(id))[0]).toMatchObject({ status: "pending" });
    expect(new Set(w.paypal.calls).size).toBe(1);
  });
});

describe("a partner's PayPal address", () => {
  it("tells the partner's own address when the payout address changes", async () => {
    const w = world();
    const partner = await payPalPartner(w);
    expect(w.mail.filter((mail) => mail.to === partner.email && mail.kind.includes("payout address"))).toHaveLength(1);
  });
});

describe("a partner whose bank account is not in euros", () => {
  it("is paid to the bank in the currency Stripe converted the transfer to", async () => {
    const w = world();
    const partner = await stripePartner(w);
    // EUR 49.50 arrives as RON 246.00 in the partner's Stripe balance.
    w.stripe.convertTransfersTo("ron", (amount) => (amount * BigInt(24600)) / BigInt(4950));
    const id = await prepare(w, partner.partnerId);
    await executeSettlement(w.deps, id);
    const [payout] = await bankPayouts(id);
    expect(payout).toMatchObject({ currency: "ron", amount: BigInt(24600), status: "pending" });
    w.stripe.setPayoutStatus(payout.stripePayoutId!, "paid");
    await executeSettlement(w.deps, id);
    expect(await settlement(id)).toMatchObject({ state: "paid" });
    // The euro figures stay euros: what was owed, sent and reached the bank.
    expect(await computeBalances(w.deps, partner.partnerId, "test", "eur")).toMatchObject({ liability: BigInt(0), bankPaid: BigInt(4950) });
    expect(w.stripe.created).toEqual({ transfers: 1, payouts: 1 });
  });

  it("waits while the converted money is not available yet, and is paid exactly what arrived", async () => {
    const w = world();
    const partner = await stripePartner(w);
    w.stripe.convertTransfersTo("usd", (amount) => amount + BigInt(500));
    w.stripe.holdConnected(true);
    const id = await prepare(w, partner.partnerId);
    await executeSettlement(w.deps, id);
    expect(await bankPayouts(id)).toHaveLength(0);
    expect(await settlement(id)).toMatchObject({ state: "transferred", lastError: "connected_balance_pending" });
    w.stripe.holdConnected(false);
    await executeSettlement(w.deps, id);
    expect(await bankPayouts(id)).toMatchObject([{ currency: "usd", amount: BigInt(5450) }]);
  });
});

describe("a Stripe account RepGet can no longer read", () => {
  it("is recorded as deauthorized", async () => {
    const w = world();
    const partner = await stripePartner(w, []);
    w.stripe.accounts.set(partner.accountId, readiness(partner.accountId, { status: "deauthorized", payoutInterval: null, metadataPartnerId: null }));
    expect(await syncPayoutAccount(w.deps, system, { stripeAccountId: partner.accountId, livemode: false })).toMatchObject({ ok: true });
    const [row] = await test.db.select().from(partnerStripeAccounts).where(eq(partnerStripeAccounts.stripeAccountId, partner.accountId));
    expect(row.status).toBe("deauthorized");
  });
});

describe("a referred customer who pays with PayPal", () => {
  async function payPalCustomer(w: World, code: string) {
    const orgId = await referred(w, code);
    const saleId = `SALE-${randomUUID().slice(0, 8)}`;
    const sale = { environment: "test" as const, saleId, subscriptionId: "I-SUB", state: "completed", verified: true, cash: BigInt(9900), currency: "eur", tax: BigInt(0), paidAt: w.clock.now(), refunded: BigInt(0), reversed: false, evidence: {} };
    w.deps.paypalSales = { environment: () => "test", loadSale: async () => sale, organizationForSale: async () => orgId };
    return { orgId, saleId };
  }

  it("counts towards the partner's level while subscribed, like one paying by card", async () => {
    const w = world();
    const partner = await seedPartner(test.db);
    const { orgId, saleId } = await payPalCustomer(w, partner.code);
    await processPayPalSale(w.deps, { saleId, environment: "test" });
    const [row] = await test.db
      .insert(subscriptions)
      .values({ organizationId: orgId, provider: "paypal", paypalSubscriptionId: `I-${randomUUID()}`, status: "active", currentPeriodEnd: new Date(w.clock.now().getTime() + 20 * DAY) })
      .returning({ id: subscriptions.id });
    expect(await refreshPartnerTier(w.deps, partner.partnerId)).toMatchObject({ qualifyingCustomers: 1 });
    await test.db.update(subscriptions).set({ status: "past_due" }).where(eq(subscriptions.id, row.id));
    expect(await refreshPartnerTier(w.deps, partner.partnerId)).toMatchObject({ qualifyingCustomers: 0 });
  });

  it("has a missed sale recovered by the daily reconciliation, once, and never a one-off purchase", async () => {
    const w = world();
    const partner = await seedPartner(test.db);
    const { orgId, saleId } = await payPalCustomer(w, partner.code);
    const oneOff = `CAP-${randomUUID().slice(0, 8)}`;
    await test.db.insert(payments).values([
      { organizationId: orgId, provider: "paypal", externalId: saleId, amountCents: 9900, currency: "eur", status: "paid", providerObject: "paypal_sale", paidAt: w.clock.now() },
      { organizationId: orgId, provider: "paypal", externalId: oneOff, amountCents: 7900, currency: "eur", status: "paid", providerObject: "paypal_capture", paidAt: w.clock.now() },
    ]);
    await reconcileCommissions(w.deps);
    await reconcileCommissions(w.deps);
    const work = await test.db.select().from(partnerProviderEvents);
    expect(work.filter((event) => event.objectId === saleId).map((event) => event.eventType)).toEqual(["paypal_sale:reconcile.missed_payment"]);
    expect(work.filter((event) => event.objectId === oneOff)).toHaveLength(0);
  });
});

describe("applications", () => {
  const answers = { website: "https://creator.example", audience: "Small business owners in Italy", promotion: "Videos and a newsletter", country: "IT" };
  const apply = async (w: World) => {
    const person = await seedUser(test.db);
    const submitted = await submitApplication(w.deps, { kind: "applicant", userId: person.id, email: person.email, name: person.name }, answers);
    if (!submitted.ok) throw new Error(submitted.reason);
    return { ...person, applicationId: submitted.value.applicationId };
  };

  it("tell every administrator, so an applicant is not left waiting", async () => {
    const w = world();
    const { applicationId } = await apply(w);
    expect(await sendApplicationNotice(w.deps, { applicationId, stage: "submitted" })).toBe(2);
    expect(w.mail.map((mail) => mail.to)).toEqual(["owner@repget.test", "second@repget.test"]);
  });

  it("that are not approved tell the applicant, as the form promised", async () => {
    const w = world();
    const person = await apply(w);
    expect(await rejectApplication(w.deps, admin, person.applicationId, "not a fit for now")).toMatchObject({ ok: true });
    expect(await sendApplicationNotice(w.deps, { applicationId: person.applicationId, stage: "rejected" })).toBe(1);
    expect(w.mail).toEqual([expect.objectContaining({ to: person.email })]);
    // Nothing about a decision that has not been made.
    const other = await apply(w);
    expect(await sendApplicationNotice(w.deps, { applicationId: other.applicationId, stage: "rejected" })).toBe(0);
  });
});
