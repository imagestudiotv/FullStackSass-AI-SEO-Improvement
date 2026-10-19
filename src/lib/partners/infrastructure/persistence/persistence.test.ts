import { randomUUID } from "node:crypto";

import { eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";

import {
  partnerAttributions,
  partnerBankPayoutAttempts,
  partnerCommissions,
  partnerLedgerEntries,
  partnerPaymentFacts,
  partnerProgramVersions,
  partnerSettlementItems,
  partnerSettlements,
  partnerTransferAttempts,
} from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { seedPartner, seedUser } from "@/test/partners";

/**
 * Part 1: the partner program's tables, as the migrations create them, in a
 * disposable PGlite database. What must hold no matter which code path -
 * or person - writes: one profile per user, one attribution per customer
 * organization, one commission per economic payment, one live transfer and
 * one live bank payout per settlement, one active allocation per commission,
 * and an append-only ledger.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
  isDatabaseConfigured: () => true,
}));

import { parseProgramPolicy, DEFAULT_PROGRAM_POLICY } from "../../domain/policies/program";
import { repositoriesFor } from "./unit-of-work";

let test: TestDb;
const big = (n: number) => BigInt(n);

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

/** Runs a statement expected to fail, inside a savepoint, and returns the error. */
async function failure(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
  } catch (error) {
    const e = error as { message?: string; cause?: { message?: string; code?: string }; code?: string };
    return `${e.code ?? e.cause?.code ?? ""} ${e.message ?? ""} ${e.cause?.message ?? ""}`;
  }
  throw new Error("expected the statement to fail");
}

async function seedFact(partnerId: string, invoicePaymentId = `inpay_${randomUUID()}`) {
  const orgId = `org_${randomUUID()}`;
  const [attribution] = await test.db
    .insert(partnerAttributions)
    .values({
      organizationId: orgId,
      foundingUserId: `user_${randomUUID()}`,
      partnerId,
      source: "link",
      lockedAt: new Date(),
      ruleVersion: 1,
    })
    .returning({ id: partnerAttributions.id });
  const now = new Date();
  const [fact] = await test.db
    .insert(partnerPaymentFacts)
    .values({
      environment: "test",
      invoicePaymentId,
      invoiceId: `in_${randomUUID()}`,
      organizationId: orgId,
      attributionId: attribution.id,
      currency: "eur",
      cashCollected: big(9900),
      eligibleBase: big(9900),
      taxShare: big(0),
      invoiceTotal: big(9900),
      invoiceTax: big(0),
      invoiceDiscount: big(0),
      invoiceSubtotal: big(9900),
      invoiceStartingBalance: big(0),
      invoiceAmountPaid: big(9900),
      paidAt: now,
      outcome: "commissioned",
      evidence: {},
      evidenceVersion: 1,
      lastSyncedAt: now,
    })
    .returning({ id: partnerPaymentFacts.id });
  return { orgId, attributionId: attribution.id, factId: fact.id };
}

async function versionId() {
  const [row] = await test.db.select({ id: partnerProgramVersions.id }).from(partnerProgramVersions).limit(1);
  return row.id;
}

async function seedCommission(partnerId: string) {
  const fact = await seedFact(partnerId);
  const [commission] = await test.db
    .insert(partnerCommissions)
    .values({
      environment: "test",
      partnerId,
      attributionId: fact.attributionId,
      paymentFactId: fact.factId,
      currency: "eur",
      baseAmount: big(9900),
      rateBasisPoints: 2500,
      tierKey: "base",
      amount: big(2475),
      programVersion: 1,
      programVersionId: await versionId(),
      earnedAt: new Date(),
      maturesAt: new Date(),
    })
    .returning({ id: partnerCommissions.id });
  return { ...fact, commissionId: commission.id };
}

async function seedSettlement(partnerId: string, runKey = `run-${randomUUID()}`, state = "transferred") {
  const [settlement] = await test.db
    .insert(partnerSettlements)
    .values({
      environment: "test",
      partnerId,
      currency: "eur",
      runKey,
      state,
      grossAmount: big(5000),
      offsetAmount: big(0),
      transferAmount: big(5000),
      stripeAccountId: "acct_test",
      transferGroup: `partner-settlement-${randomUUID()}`,
      createdBy: "test",
    })
    .returning({ id: partnerSettlements.id });
  return settlement.id;
}

describe("migrations 0063 and 0064", () => {
  it("seed version 1 of the program policy, matching the code's defaults", async () => {
    const rows = await test.db.select().from(partnerProgramVersions);
    expect(rows).toHaveLength(1);
    expect(parseProgramPolicy(rows[0].policy)).toEqual(DEFAULT_PROGRAM_POLICY);
    const repos = repositoriesFor(test.db);
    expect((await repos.programs.versionAt(new Date("2020-01-01T00:00:00Z"))).policy.version).toBe(1);
  });

  it("enable row level security on every partner table", async () => {
    const result = await test.db.execute(sql`
      select c.relname as name, c.relrowsecurity as rls
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'partner\\_%'`);
    const rows = (result as unknown as { rows: { name: string; rls: boolean }[] }).rows;
    expect(rows.length).toBe(20);
    expect(rows.filter((row) => !row.rls)).toEqual([]);
  });

  it("leave every partner switch off: a missing row is disabled", async () => {
    const repos = repositoriesFor(test.db);
    const controls = await repos.controls.read();
    expect(Object.values(controls).map((c) => c.enabled)).toEqual([false, false, false]);
  });
});

describe("the ledger is append-only", () => {
  it("refuses UPDATE, DELETE and TRUNCATE, and writes an operation once", async () => {
    const partner = await seedPartner(test.db);
    const repos = repositoriesFor(test.db);
    const entry = {
      environment: "test" as const,
      partnerId: partner.partnerId,
      currency: "eur",
      kind: "commission_adjustment" as const,
      amount: big(-100),
      operationKey: `test:${randomUUID()}`,
      reason: "test",
      actor: "system",
    };
    expect(await repos.commissions.appendLedger(entry)).toBe(true);
    expect(await repos.commissions.appendLedger(entry)).toBe(false);

    expect(await failure(() => test.db.update(partnerLedgerEntries).set({ amount: big(1) }).where(eq(partnerLedgerEntries.operationKey, entry.operationKey)))).toMatch(/append-only/);
    expect(await failure(() => test.db.delete(partnerLedgerEntries).where(eq(partnerLedgerEntries.operationKey, entry.operationKey)))).toMatch(/append-only/);
    expect(await failure(() => test.db.execute(sql`truncate partner_ledger_entries`))).toMatch(/append-only/);

    const sums = await repos.commissions.ledgerSum(partner.partnerId, "test", "eur");
    expect(sums).toEqual({ liability: big(-100), netEarned: big(-100), netTransferred: big(0) });
  });
});

describe("uniqueness guarantees", () => {
  it("one partner profile per user, whatever the retry", async () => {
    const owner = await seedUser(test.db);
    const repos = repositoriesFor(test.db);
    const input = {
      userId: owner.id,
      displayName: "Owner",
      contactEmail: owner.email,
      country: "IT",
      applicationId: (await seedPartner(test.db)).applicationId,
      approvedAt: new Date(),
      approvedByEmail: "admin@repget.test",
    };
    const first = await repos.partners.createOrGet({ ...input, referralCode: "abcdefghjk" });
    const second = await repos.partners.createOrGet({ ...input, referralCode: "zyxwvutsrq" });
    expect(first?.created).toBe(true);
    expect(second?.created).toBe(false);
    expect(second?.partner.id).toBe(first?.partner.id);
    expect(second?.partner.referralCode).toBe("abcdefghjk");
  });

  it("a referral code collision is reported, never a second profile", async () => {
    const taken = await seedPartner(test.db, { code: "mnpqrstuvw" });
    const owner = await seedUser(test.db);
    const repos = repositoriesFor(test.db);
    const result = await repos.partners.createOrGet({
      userId: owner.id,
      referralCode: taken.code,
      displayName: "Owner",
      contactEmail: owner.email,
      country: null,
      applicationId: taken.applicationId,
      approvedAt: new Date(),
      approvedByEmail: "admin@repget.test",
    });
    expect(result).toBeNull();
  });

  it("one open application per user", async () => {
    const owner = await seedUser(test.db);
    const repos = repositoriesFor(test.db);
    const input = {
      userId: owner.id,
      answers: { website: "https://x.example", audience: "a", promotion: "b", country: "IT" },
      applicantEmail: owner.email,
      applicantName: owner.name,
      submittedAt: new Date(),
    };
    expect(await repos.applications.create(input)).not.toBeNull();
    expect(await repos.applications.create(input)).toBeNull();
  });

  it("one locked attribution per customer organization", async () => {
    const a = await seedPartner(test.db);
    const b = await seedPartner(test.db);
    const repos = repositoriesFor(test.db);
    const orgId = `org_${randomUUID()}`;
    const base = {
      organizationId: orgId,
      foundingUserId: "u",
      source: "link" as const,
      clickId: null,
      couponId: null,
      status: "active" as const,
      lockedAt: new Date(),
      ruleVersion: 1,
      reviewReason: null,
      fraudSignals: {},
    };
    const first = await repos.attributions.createOrGet({ ...base, partnerId: a.partnerId });
    const second = await repos.attributions.createOrGet({ ...base, partnerId: b.partnerId });
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.attribution.partnerId).toBe(a.partnerId);
  });

  it("one commission per economic payment", async () => {
    const partner = await seedPartner(test.db);
    const { factId, attributionId } = await seedCommission(partner.partnerId).then(async (c) => ({ factId: c.factId, attributionId: c.attributionId }));
    const repos = repositoriesFor(test.db);
    const again = await repos.commissions.createCommission({
      environment: "test",
      partnerId: partner.partnerId,
      attributionId,
      paymentFactId: factId,
      currency: "eur",
      baseAmount: big(9900),
      rateBasisPoints: 2500,
      tierKey: "base",
      amount: big(2475),
      programVersion: 1,
      programVersionId: await versionId(),
      earnedAt: new Date(),
      maturesAt: new Date(),
      status: "pending",
      reviewState: "approved",
      holdReason: null,
    });
    expect(again).toBeNull();
  });

  it("reversed commission amounts cannot exceed the commission", async () => {
    const partner = await seedPartner(test.db);
    const { commissionId } = await seedCommission(partner.partnerId);
    expect(await failure(() => test.db.update(partnerCommissions).set({ reversedAmount: big(2476) }).where(eq(partnerCommissions.id, commissionId)))).toMatch(/amounts_check|23514/);
  });

  it("one active allocation per commission", async () => {
    const partner = await seedPartner(test.db);
    const { commissionId } = await seedCommission(partner.partnerId);
    const first = await seedSettlement(partner.partnerId);
    const second = await seedSettlement(partner.partnerId);
    await test.db.insert(partnerSettlementItems).values({ settlementId: first, commissionId, amount: big(2475) });
    expect(await failure(() => test.db.insert(partnerSettlementItems).values({ settlementId: second, commissionId, amount: big(2475) }))).toMatch(/23505|active_uidx/);
    // Once released, the commission can be allocated again.
    await test.db.update(partnerSettlementItems).set({ active: false }).where(eq(partnerSettlementItems.settlementId, first));
    await test.db.insert(partnerSettlementItems).values({ settlementId: second, commissionId, amount: big(2475) });
  });

  it("one pre-transfer settlement per partner and currency, and one per monthly run", async () => {
    const partner = await seedPartner(test.db);
    await seedSettlement(partner.partnerId, "2026-11", "reserved");
    expect(await failure(() => seedSettlement(partner.partnerId, "2026-12", "transfer_unknown"))).toMatch(/23505|open_uidx/);
    expect(await failure(() => seedSettlement(partner.partnerId, "2026-11", "paid"))).toMatch(/23505|run_uidx/);
  });

  it("one transfer that may have moved money per settlement", async () => {
    const partner = await seedPartner(test.db);
    const settlementId = await seedSettlement(partner.partnerId);
    const attempt = (n: number, status: string) =>
      test.db.insert(partnerTransferAttempts).values({
        settlementId,
        attemptNumber: n,
        operationId: `op-${randomUUID()}`,
        environment: "test",
        stripeAccountId: "acct_test",
        currency: "eur",
        amount: big(5000),
        status,
      });
    await attempt(1, "retryable_failure");
    await attempt(2, "unknown");
    expect(await failure(() => attempt(3, "processing"))).toMatch(/23505|live_uidx/);
  });

  it("one bank payout that may still pay per settlement; a failed one allows a retry", async () => {
    const partner = await seedPartner(test.db);
    const settlementId = await seedSettlement(partner.partnerId);
    const payout = (n: number, status: string) =>
      test.db.insert(partnerBankPayoutAttempts).values({
        settlementId,
        attemptNumber: n,
        operationId: `op-${randomUUID()}`,
        environment: "test",
        stripeAccountId: "acct_test",
        currency: "eur",
        amount: big(5000),
        status,
      });
    await payout(1, "failed");
    await payout(2, "pending");
    expect(await failure(() => payout(3, "unknown"))).toMatch(/23505|live_uidx/);
  });

  it("financial rows cannot be deleted out from under their history", async () => {
    const partner = await seedPartner(test.db);
    await seedCommission(partner.partnerId);
    expect(await failure(() => test.db.execute(sql`delete from partner_profiles where id = ${partner.partnerId}`))).toMatch(/23503|foreign key/);
  });
});
