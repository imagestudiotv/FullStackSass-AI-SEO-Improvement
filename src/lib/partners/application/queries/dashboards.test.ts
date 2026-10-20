import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { adminAuditLog, partnerAttributions, partnerCommissions, partnerLedgerEntries, partnerProfiles, partnerSettlements, partnerStripeAccounts, plans, subscriptions } from "@/lib/db/schema";
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
 * Part 4: the dashboards and the administrator controls, on the real
 * repositories (PGlite).
 *
 *  - The partner's five figures reconcile with the ledger and Stripe's
 *    evidence, and never count money twice; the admin area reads the same
 *    records.
 *  - A partner sees only their own records, under privacy-safe labels.
 *  - Every administrator decision is a use case with a reason and an audit
 *    entry, and none of them can mark money transferred or paid.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
  isDatabaseConfigured: () => true,
}));

import { websites } from "@/lib/db/schema";

import type { AdminContext, PartnerContext } from "../contracts/commands";
import { captureSignupEligibility } from "../use-cases/attribute-new-customer";
import { executeSettlement } from "../use-cases/execute-transfer";
import { adjustPartnerBalance, approveCommission, holdCommission, rejectCommission } from "../use-cases/manage-commission";
import { prepareSettlementNow, reconcileNow, retrySettlement } from "../use-cases/manage-settlement";
import { rebuildProjection } from "../use-cases/mature-commissions";
import { prepareSettlement, previewSettlement } from "../use-cases/prepare-settlement";
import { processChargeAdjustments } from "../use-cases/process-adjustment";
import { processInvoice } from "../use-cases/process-payment";
import { recordReferralClick } from "../use-cases/record-referral-click";
import { adminCommissions, adminExport, adminPartnerFinance, adminPayoutPreview, adminSettlementDetail } from "./admin-reports";
import { LATEST_COMMISSIONS, partnerCommissionHistory, partnerDashboard, partnerPayoutHistory, partnerReferrals } from "./partner-dashboard";

let test: TestDb;
const DAY = 86_400_000;
const admin: AdminContext = { kind: "admin", userId: "admin-user", email: "admin@repget.test" };

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

/** A partner with a ready Stripe account and one referred, paying customer per amount (paid `daysAgo` days ago). */
async function partnerWithCommissions(w: World, amounts: number[], daysAgo = 40, domain?: string, invoiceExtras: { priceId?: string; subscriptionId?: string } = {}) {
  const partner = await seedPartner(test.db);
  const accountId = `acct_${randomUUID().replace(/-/g, "").slice(0, 14)}`;
  await test.db.insert(partnerStripeAccounts).values({ partnerId: partner.partnerId, environment: "test", stripeAccountId: accountId, status: "ready", detailsSubmitted: true, payoutsEnabled: true, transfersCapability: "active", payoutInterval: "manual", creationKey: `k-${randomUUID()}` });
  w.stripe.accounts.set(accountId, readiness(accountId, { status: "ready", detailsSubmitted: true, payoutsEnabled: true, transfersCapability: "active", requirementsCurrentlyDue: [], metadataPartnerId: partner.partnerId }));
  const charges: string[] = [];
  const organizations: string[] = [];
  const now = w.clock.now();
  for (const amount of amounts) {
    w.clock.set(new Date(now.getTime() - (daysAgo + 1) * DAY));
    const click = await recordReferralClick(w.deps, { code: partner.code, existingToken: null, landingPath: "/", referrerHost: null, visitor: randomUUID() });
    const createdAt = w.clock.now();
    const person = await seedUser(test.db, { createdAt });
    const orgId = await seedWorkspace(test.db, person.id, { createdAt });
    if (domain) await test.db.insert(websites).values({ organizationId: orgId, domain, url: `https://${domain}` });
    await captureSignupEligibility(w.deps, { userId: person.id, email: person.email, createdAt, method: "email", trackingToken: click.setCookie!.token, ipAddress: null, userAgent: null });
    const customerId = await seedStripeCustomer(test.db, orgId);
    w.clock.set(now);
    const invoice = w.billing.invoice({ customerId, total: amount, collections: [{ cash: amount, paidAt: new Date(now.getTime() - daysAgo * DAY) }], ...invoiceExtras });
    await processInvoice(w.deps, invoice.invoiceId, "test");
    charges.push(invoice.collections[0].chargeId!);
    organizations.push(orgId);
  }
  const context: PartnerContext = { kind: "partner", userId: partner.userId, partnerId: partner.partnerId };
  return { ...partner, accountId, charges, organizations, context };
}

const commissionsOf = (partnerId: string) => test.db.select().from(partnerCommissions).where(eq(partnerCommissions.partnerId, partnerId));
const auditOf = async (action: string) => (await test.db.select().from(adminAuditLog).where(eq(adminAuditLog.action, action))).length;

describe("the partner dashboard", () => {
  it("shows EUR 24.75 as available but below the EUR 25.00 threshold, with nothing transferred", async () => {
    const w = world();
    const partner = await partnerWithCommissions(w, [9900]);
    await rebuildProjection(w.deps, partner.partnerId, "test", "eur");
    const dashboard = await partnerDashboard(w.deps, partner.context, { days: 90 });
    expect(dashboard!.balances).toEqual([
      expect.objectContaining({ currency: "eur", earned: BigInt(2475), pending: BigInt(0), available: BigInt(2475), inPayout: BigInt(0), transferred: BigInt(0), bankPaid: BigInt(0), offset: BigInt(0), threshold: BigInt(2500), belowThreshold: true }),
    ]);
    expect(dashboard!.metrics).toMatchObject({ clicks: 1, signups: 1, customers: 1, payingCustomers: 1, days: 90 });
    // The admin page shows the same definitions for 30 / 90 / 365 days: the click was 41 days ago.
    const finance = await adminPartnerFinance(w.deps, admin, { partnerId: partner.partnerId, page: 1 });
    expect(finance!.activity.map((a) => [a.days, a.clicks, a.signups, a.customers, a.payingCustomers])).toEqual([
      [30, 0, 0, 0, 0],
      [90, 1, 1, 1, 1],
      [365, 1, 1, 1, 1],
    ]);
  });

  it("reconciles every figure with the ledger and Stripe's evidence, without double counting", async () => {
    const w = world();
    const partner = await partnerWithCommissions(w, [9900, 9900, 9900]);
    // One more referral, paid 5 days ago: pending (Net 30).
    const late = await partnerWithCommissions(w, [], 5);
    void late;
    const prepared = await prepareSettlement(w.deps, { kind: "system", origin: "test" }, { partnerId: partner.partnerId, currency: "eur", runKey: "2026-10" });
    expect(prepared).toMatchObject({ kind: "created", transferAmount: BigInt(7425) });

    // Reserved, not yet sent: "in a payout", nothing transferred.
    let figures = (await partnerDashboard(w.deps, partner.context, { days: 30 }))!.balances[0];
    expect(figures).toMatchObject({ earned: BigInt(7425), available: BigInt(0), inPayout: BigInt(7425), transferred: BigInt(0), bankPaid: BigInt(0) });

    // Transferred and the bank payout created but still pending: transferred, not bank-paid.
    await executeSettlement(w.deps, (prepared as { settlementId: string }).settlementId);
    figures = (await partnerDashboard(w.deps, partner.context, { days: 30 }))!.balances[0];
    expect(figures).toMatchObject({ earned: BigInt(7425), inPayout: BigInt(0), transferred: BigInt(7425), bankPaid: BigInt(0), offset: BigInt(0) });

    // A refund after payment: earned drops, the correction is shown as "to deduct", nothing is hidden.
    w.billing.setCharge(partner.charges[0], { refunded: 9900 });
    await processChargeAdjustments(w.deps, partner.charges[0], "test");
    figures = (await partnerDashboard(w.deps, partner.context, { days: 30 }))!.balances[0];
    expect(figures).toMatchObject({ earned: BigInt(4950), transferred: BigInt(7425), offset: BigInt(2475) });

    // The identity behind the definitions, checked against the raw ledger.
    const ledger = await test.db.select().from(partnerLedgerEntries).where(eq(partnerLedgerEntries.partnerId, partner.partnerId));
    const sum = (kinds: string[]) => ledger.filter((e) => kinds.includes(e.kind)).reduce((total, e) => total + e.amount, BigInt(0));
    expect(figures.earned).toBe(sum(["commission_earned", "commission_adjustment"]));
    expect(figures.transferred).toBe(-sum(["transfer_confirmed", "transfer_reversal"]));
    expect(figures.earned).toBe(figures.pending + figures.available + figures.inPayout + figures.transferred - figures.offset);

    // The admin area reads the same numbers.
    const finance = await adminPartnerFinance(w.deps, admin, { partnerId: partner.partnerId, page: 1 });
    expect(finance!.balances[0]).toMatchObject({ earned: figures.earned, transferred: figures.transferred, offset: figures.offset, liability: BigInt(-2475) });

    // The partner's payout history: transfer confirmed, bank payout not paid.
    const payouts = await partnerPayoutHistory(w.deps, partner.context, { page: 1 });
    expect(payouts.rows).toEqual([expect.objectContaining({ amount: BigInt(7425), transfer: "confirmed" })]);
    expect(payouts.rows[0].bank).not.toBe("paid");
  });

  it("shows a partner only their own records, under privacy-safe customer labels", async () => {
    const w = world();
    const mine = await partnerWithCommissions(w, [9900], 40, "acme-widgets.co.uk");
    const theirs = await partnerWithCommissions(w, [9900, 9900]);

    const commissions = await partnerCommissionHistory(w.deps, mine.context, { page: 1 });
    expect(commissions.total).toBe(1);
    expect(commissions.rows[0].customer).toBe("ac•••.co.uk");
    const referrals = await partnerReferrals(w.deps, theirs.context, { page: 1 });
    expect(referrals.total).toBe(2);
    expect(referrals.rows.every((row) => /^Customer [0-9A-F]{6}$/.test(row.customer!))).toBe(true);

    // A context whose partner id is someone else's (a forged or stale session) sees nothing.
    const forged: PartnerContext = { kind: "partner", userId: mine.userId, partnerId: theirs.partnerId };
    expect(await partnerDashboard(w.deps, forged, { days: 30 })).toBeNull();
    expect((await partnerCommissionHistory(w.deps, forged, { page: 1 })).rows).toEqual([]);
    expect((await partnerPayoutHistory(w.deps, forged, { page: 1 })).rows).toEqual([]);
    expect((await partnerReferrals(w.deps, forged, { page: 1 })).rows).toEqual([]);
  });

  it("names each commission's plan from the price its invoice charged, else the subscription's plan", async () => {
    const w = world();
    const suffix = randomUUID().replace(/-/g, "").slice(0, 10);
    const [grow] = await test.db
      .insert(plans)
      .values({ name: "Grow", tier: `grow-${suffix}`, interval: "month", currency: "eur", stripePriceId: `price_grow_${suffix}`, priceCents: 9900, articleLimit: 1, keywordLimit: 1, siteLimit: 1, monthlyCredits: 0 })
      .returning();
    const [scale] = await test.db
      .insert(plans)
      .values({ name: "Scale", tier: `scale-${suffix}`, interval: "year", currency: "eur", stripePriceId: `price_scale_${suffix}`, priceCents: 299000, articleLimit: 1, keywordLimit: 1, siteLimit: 1, monthlyCredits: 0 })
      .returning();
    const byPrice = await partnerWithCommissions(w, [9900], 40, undefined, { priceId: grow.stripePriceId! });
    expect((await partnerCommissionHistory(w.deps, byPrice.context, { page: 1 })).rows[0].plan).toEqual({ name: "Grow", interval: "month", priceCents: 9900, currency: "eur" });

    // Recorded without a price: the subscription's plan; with neither, none (never a guess).
    const subscriptionId = `sub_${suffix}`;
    const bySubscription = await partnerWithCommissions(w, [9900], 40, undefined, { subscriptionId });
    await test.db.insert(subscriptions).values({ organizationId: bySubscription.organizations[0], provider: "stripe", stripeSubscriptionId: subscriptionId, status: "active", planId: scale.id });
    expect((await partnerCommissionHistory(w.deps, bySubscription.context, { page: 1 })).rows[0].plan).toMatchObject({ name: "Scale", interval: "year" });
    const unknown = await partnerWithCommissions(w, [9900], 40, undefined, { priceId: "price_not_a_repget_plan" });
    expect((await partnerCommissionHistory(w.deps, unknown.context, { page: 1 })).rows[0].plan).toBeNull();
  });

  it("counts referrals for all time without disqualified ones, and paying customers as the tier does", async () => {
    const w = world();
    const partner = await partnerWithCommissions(w, [9900, 9900, 9900], 5);
    await test.db.update(partnerAttributions).set({ status: "disqualified" }).where(eq(partnerAttributions.organizationId, partner.organizations[0]));
    await test.db.update(partnerProfiles).set({ qualifyingCustomers: 2 }).where(eq(partnerProfiles.id, partner.partnerId));
    const dashboard = (await partnerDashboard(w.deps, partner.context, { days: 30 }))!;
    expect(dashboard.totals).toEqual({ referrals: 2, payingCustomers: 2 });
    // The client's identity: Total earned = Pending + Paid, while nothing was refunded after a payout.
    const figures = dashboard.balances[0];
    expect(figures.unpaid + figures.transferred).toBe(figures.earned);
  });

  it("lists the newest commissions first, five at a time for the overview", async () => {
    const w = world();
    const partner = await partnerWithCommissions(w, [9900, 9900, 9900, 9900, 9900, 9900], 5);
    const latest = await partnerCommissionHistory(w.deps, partner.context, { page: 1, pageSize: LATEST_COMMISSIONS });
    expect(latest.rows).toHaveLength(5);
    expect(latest.total).toBe(6);
    const dates = latest.rows.map((row) => row.paidAt.getTime());
    expect(dates).toEqual([...dates].sort((a, b) => b - a));
  });

  it("refuses the admin reports without an administrator context", async () => {
    const w = world();
    const partner = { kind: "partner", userId: "u", partnerId: randomUUID() } as unknown as AdminContext;
    await expect(adminCommissions(w.deps, partner, { page: 1 })).rejects.toThrow(/administrator/);
    await expect(adminExport(w.deps, partner, { report: "ledger" })).rejects.toThrow(/administrator/);
  });
});

describe("administrator decisions", () => {
  it("holds and releases a commission (a settlement skips it meanwhile), but never a dispute hold", async () => {
    const w = world();
    const partner = await partnerWithCommissions(w, [9900, 9900]);
    const [first, second] = await commissionsOf(partner.partnerId);
    expect(await holdCommission(w.deps, admin, first.id, true, "Checking this customer")).toEqual({ ok: true, value: null });
    const plan = await previewSettlement(w.deps, partner.partnerId, "eur");
    expect(plan).toMatchObject({ kind: "carry_forward", reason: "below_threshold", payable: { amount: BigInt(2475) } });
    expect(await holdCommission(w.deps, admin, first.id, false, "Customer verified")).toEqual({ ok: true, value: null });
    expect(await previewSettlement(w.deps, partner.partnerId, "eur")).toMatchObject({ kind: "settle", transferAmount: { amount: BigInt(4950) } });

    await test.db.update(partnerCommissions).set({ holdReason: "dispute_open", status: "pending" }).where(eq(partnerCommissions.id, second.id));
    expect(await holdCommission(w.deps, admin, second.id, false, "Trying to release")).toMatchObject({ ok: false, detail: "not_an_admin_hold" });
    expect(await auditOf("partner.commission_held")).toBeGreaterThanOrEqual(1);
    expect(await auditOf("partner.commission_released")).toBeGreaterThanOrEqual(1);
    // A reason is required.
    expect(await holdCommission(w.deps, admin, first.id, true, "no")).toMatchObject({ ok: false, detail: "reason" });
  });

  it("rejects with a reversing ledger entry (the original stays), approves a held-for-review one, and cannot touch reserved money", async () => {
    const w = world();
    const partner = await partnerWithCommissions(w, [9900, 9900, 9900]);
    const [a, b, c] = await commissionsOf(partner.partnerId);
    expect(await rejectCommission(w.deps, admin, a.id, "Self-referral confirmed")).toEqual({ ok: true, value: null });
    const entries = (await test.db.select().from(partnerLedgerEntries).where(eq(partnerLedgerEntries.commissionId, a.id))).map((e) => [e.kind, e.amount]);
    expect(entries).toEqual(expect.arrayContaining([["commission_earned", BigInt(2475)], ["commission_adjustment", BigInt(-2475)]]));
    expect(await approveCommission(w.deps, admin, a.id, "Changed my mind")).toMatchObject({ ok: false, detail: "rejected" });

    await test.db.update(partnerCommissions).set({ reviewState: "needs_review", status: "pending" }).where(eq(partnerCommissions.id, b.id));
    expect(await approveCommission(w.deps, admin, b.id, "Genuine customer")).toEqual({ ok: true, value: null });
    const [approved] = await test.db.select().from(partnerCommissions).where(eq(partnerCommissions.id, b.id));
    expect(approved).toMatchObject({ reviewState: "approved", status: "available" });

    const prepared = await prepareSettlement(w.deps, { kind: "system", origin: "test" }, { partnerId: partner.partnerId, currency: "eur", runKey: "2026-10" });
    expect(prepared).toMatchObject({ kind: "created", transferAmount: BigInt(4950) });
    expect(await rejectCommission(w.deps, admin, c.id, "Too late for this")).toMatchObject({ ok: false, detail: "status_reserved" });
    expect(await holdCommission(w.deps, admin, c.id, true, "Too late for this")).toMatchObject({ ok: false, detail: "status_reserved" });
  });

  it("adjusts a balance by a signed ledger entry; a credit no commission backs is refused", async () => {
    const w = world();
    const partner = await partnerWithCommissions(w, [9900, 9900]);
    expect(await adjustPartnerBalance(w.deps, admin, { partnerId: partner.partnerId, currency: "eur", amount: BigInt(500), reason: "Goodwill" })).toMatchObject({ ok: false, detail: "unbacked_credit" });
    expect(await adjustPartnerBalance(w.deps, admin, { partnerId: partner.partnerId, currency: "eur", amount: BigInt(-1000), reason: "Duplicate account" })).toEqual({ ok: true, value: null });
    let figures = (await partnerDashboard(w.deps, partner.context, { days: 30 }))!.balances[0];
    expect(figures).toMatchObject({ earned: BigInt(3950), available: BigInt(4950), offset: BigInt(1000) });
    expect(await previewSettlement(w.deps, partner.partnerId, "eur")).toMatchObject({ kind: "settle", transferAmount: { amount: BigInt(3950) }, offset: { amount: BigInt(1000) } });
    // A credit that cancels the earlier deduction is allowed, and no more than that.
    expect(await adjustPartnerBalance(w.deps, admin, { partnerId: partner.partnerId, currency: "eur", amount: BigInt(1001), reason: "Undo deduction" })).toMatchObject({ ok: false, detail: "unbacked_credit" });
    expect(await adjustPartnerBalance(w.deps, admin, { partnerId: partner.partnerId, currency: "eur", amount: BigInt(1000), reason: "Undo deduction" })).toEqual({ ok: true, value: null });
    figures = (await partnerDashboard(w.deps, partner.context, { days: 30 }))!.balances[0];
    expect(figures).toMatchObject({ earned: BigInt(4950), offset: BigInt(0) });
    expect(await auditOf("partner.commission_adjusted")).toBeGreaterThanOrEqual(2);
  });

  it("prepares this month's payout now (once per month), retries it with an audit entry, and refuses a payout under review", async () => {
    const w = world();
    const partner = await partnerWithCommissions(w, [9900, 9900]);
    const now = await prepareSettlementNow(w.deps, admin, { partnerId: partner.partnerId, currency: "EUR", reason: "Partner asked early" });
    expect(now).toMatchObject({ ok: true, value: { kind: "created", transferAmount: BigInt(4950) } });
    const settlementId = (now as { value: { settlementId: string } }).value.settlementId;
    const [row] = await test.db.select().from(partnerSettlements).where(eq(partnerSettlements.id, settlementId));
    expect(row.runKey).toBe("2026-10");
    expect(await prepareSettlementNow(w.deps, admin, { partnerId: partner.partnerId, currency: "eur", reason: "Again please" })).toMatchObject({ ok: true, value: { kind: "carried_forward", reason: "nothing_payable" } });

    expect(await retrySettlement(w.deps, admin, settlementId, "Send it now")).toMatchObject({ ok: true, value: { state: expect.stringMatching(/^(transferred|payout_pending|payout_in_transit)$/) } });
    expect(w.stripe.created.transfers).toBe(1);
    // Retrying again sends nothing new.
    await retrySettlement(w.deps, admin, settlementId, "Send it again");
    expect(w.stripe.created.transfers).toBe(1);
    expect(await auditOf("partner.settlement_retried")).toBeGreaterThanOrEqual(2);

    await test.db.update(partnerSettlements).set({ state: "needs_review" }).where(eq(partnerSettlements.id, settlementId));
    expect(await retrySettlement(w.deps, admin, settlementId, "Push it through")).toMatchObject({ ok: false, detail: "state_needs_review" });
    const detail = await adminSettlementDetail(w.deps, admin, settlementId);
    // Under review: not retried blindly - resumed by a person (transfer confirmed, so not cancellable either).
    expect(detail).toMatchObject({ cancellable: false, retryable: false, resumable: true, transfer: "confirmed" });
    expect(detail!.ledger.map((entry) => entry.kind)).toEqual(["transfer_confirmed"]);
  });

  it("previews the next run per partner with its blockers, and runs the reconciliation with an audit entry", async () => {
    const w = world();
    const partner = await partnerWithCommissions(w, [9900, 9900]);
    await test.db.update(partnerStripeAccounts).set({ status: "restricted" }).where(eq(partnerStripeAccounts.partnerId, partner.partnerId));
    const preview = await adminPayoutPreview(w.deps, admin, { page: 1 });
    const pages = Math.ceil(preview.total / preview.pageSize);
    let row = preview.rows.find((r) => r.partner?.id === partner.partnerId);
    for (let page = 2; !row && page <= pages; page += 1) row = (await adminPayoutPreview(w.deps, admin, { page })).rows.find((r) => r.partner?.id === partner.partnerId);
    expect(row).toMatchObject({ currency: "eur", blockers: ["onboarding_incomplete"], plan: { kind: "settle" }, preparedThisMonth: false });
    expect(preview).toMatchObject({ environment: "test", payoutsOn: true, currentRunKey: "2026-10" });

    // A partner already paid this month is not offered "prepare now" again.
    const paid = await partnerWithCommissions(w, [9900, 9900, 9900, 9900]);
    expect(await prepareSettlementNow(w.deps, admin, { partnerId: paid.partnerId, currency: "eur", reason: "Paid early this month" })).toMatchObject({ ok: true, value: { kind: "created" } });
    let paidRow;
    for (let page = 1; !paidRow && page <= Math.ceil((await adminPayoutPreview(w.deps, admin, { page: 1 })).total / 25); page += 1) {
      paidRow = (await adminPayoutPreview(w.deps, admin, { page })).rows.find((r) => r.partner?.id === paid.partnerId);
    }
    expect(paidRow).toMatchObject({ preparedThisMonth: true });

    expect(await reconcileNow(w.deps, admin, "Month-end check")).toMatchObject({ ok: true });
    expect(await auditOf("partner.reconciliation_run")).toBe(1);
  });
});

describe("exports", () => {
  it("exports exact decimal amounts with no customer email or name", async () => {
    const w = world();
    const partner = await partnerWithCommissions(w, [8910]);
    const exported = await adminExport(w.deps, admin, { report: "commissions", partnerId: partner.partnerId });
    expect(exported!.header).toContain("customer_reference");
    expect(exported!.rows).toHaveLength(1);
    const row = Object.fromEntries(exported!.header.map((key, index) => [key, exported!.rows[0][index]]));
    expect(row).toMatchObject({ currency: "EUR", commissionable: "89.10", commission: "22.28", rate_bps: "2500", status: "available" });
    expect(JSON.stringify(exported)).not.toMatch(/@/);

    const ledger = await adminExport(w.deps, admin, { report: "ledger", partnerId: partner.partnerId });
    expect(ledger!.rows.map((r) => r[3])).toEqual(["commission_earned"]);
  });
});
