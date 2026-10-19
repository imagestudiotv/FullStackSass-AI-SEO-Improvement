import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/inngest/client", () => ({ inngest: { send: vi.fn() } }));

import { partnerCommissions, partnerLedgerEntries, partnerSettlementItems, partnerSettlements, partnerStripeAccounts, partnerTransferAttempts } from "@/lib/db/schema";
import type { Database } from "@/lib/db/types";
import { createPostgresTestDb, testPostgresUrl } from "@/test/postgres";
import { fakeBilling, fakePayouts, partnerTestDeps, readiness, seedPartner, seedStripeCustomer, seedUser, seedWorkspace, setControl } from "@/test/partners";

import { captureSignupEligibility } from "./attribute-new-customer";
import { executeSettlement } from "./execute-transfer";
import { holdCommission } from "./manage-commission";
import { prepareSettlement } from "./prepare-settlement";
import { processInvoice } from "./process-payment";
import { recordReferralClick } from "./record-referral-click";

/**
 * Part 4 on a REAL Postgres: concurrent monthly runs cannot reserve the same
 * earnings twice, and concurrent workers executing one settlement cannot
 * create a second transfer - the leases, the conditional state changes and
 * the "one live transfer per settlement" index each hold under contention.
 */

const available = Boolean(testPostgresUrl());
let env: Awaited<ReturnType<typeof createPostgresTestDb>>;
let dbs: Database[];
const DAY = 86_400_000;

beforeAll(async () => {
  if (!available) return;
  env = await createPostgresTestDb(4);
  dbs = env.dbs as unknown as Database[];
  for (const key of ["partner_program", "partner_commissions", "partner_payouts"] as const) await setControl(dbs[0], key, true);
}, 120_000);

afterAll(async () => {
  if (available) await env.dispose();
});

async function setup() {
  const billing = fakeBilling();
  const stripe = fakePayouts();
  stripe.fund("eur", 1_000_000);
  const depsOn = (db: Database) => partnerTestDeps(db, { billing: billing.source, connect: stripe.gateway, payouts: stripe.gateway });
  const base = depsOn(dbs[0]);
  const partner = await seedPartner(dbs[0]);
  const accountId = `acct_${randomUUID().replace(/-/g, "").slice(0, 14)}`;
  await dbs[0].insert(partnerStripeAccounts).values({ partnerId: partner.partnerId, environment: "test", stripeAccountId: accountId, status: "ready", detailsSubmitted: true, payoutsEnabled: true, transfersCapability: "active", creationKey: `k-${randomUUID()}` });
  stripe.accounts.set(accountId, readiness(accountId, { status: "ready", detailsSubmitted: true, payoutsEnabled: true, transfersCapability: "active", requirementsCurrentlyDue: [], metadataPartnerId: partner.partnerId }));
  const now = base.clock.now();
  for (let i = 0; i < 3; i += 1) {
    base.clock.set(new Date(now.getTime() - 41 * DAY));
    const click = await recordReferralClick(base.deps, { code: partner.code, existingToken: null, landingPath: "/", referrerHost: null, visitor: randomUUID() });
    const createdAt = base.clock.now();
    const person = await seedUser(dbs[0], { createdAt });
    const orgId = await seedWorkspace(dbs[0], person.id, { createdAt });
    await captureSignupEligibility(base.deps, { userId: person.id, email: person.email, createdAt, method: "email", trackingToken: click.setCookie!.token, ipAddress: null, userAgent: null });
    base.clock.set(now);
    const invoice = billing.invoice({ customerId: await seedStripeCustomer(dbs[0], orgId), total: 9900, collections: [{ cash: 9900, paidAt: new Date(now.getTime() - 40 * DAY) }] });
    await processInvoice(base.deps, invoice.invoiceId, "test");
  }
  return { partner, stripe, depsOn };
}

describe.skipIf(!available)("payouts under concurrency (real Postgres)", () => {
  it("four monthly runs at once reserve the earnings once", async () => {
    const { partner, depsOn } = await setup();
    const outcomes = await Promise.all(
      dbs.map((db) => prepareSettlement(depsOn(db).deps, { kind: "system", origin: "race" }, { partnerId: partner.partnerId, currency: "eur", runKey: "2026-10" })),
    );
    expect(outcomes.filter((o) => o.kind === "created")).toHaveLength(1);
    const settlements = await dbs[0].select().from(partnerSettlements).where(eq(partnerSettlements.partnerId, partner.partnerId));
    expect(settlements).toHaveLength(1);
    const items = await dbs[0].select().from(partnerSettlementItems).where(eq(partnerSettlementItems.settlementId, settlements[0].id));
    expect(items).toHaveLength(3);
    expect(settlements[0].transferAmount).toBe(BigInt(7425));
  });

  it("four workers executing one settlement at once create one transfer and settle the liability once", async () => {
    const { partner, stripe, depsOn } = await setup();
    const prepared = await prepareSettlement(depsOn(dbs[0]).deps, { kind: "system", origin: "race" }, { partnerId: partner.partnerId, currency: "eur", runKey: "2026-11" });
    if (prepared.kind !== "created") throw new Error("setup");
    const results = await Promise.all(dbs.map((db) => executeSettlement(depsOn(db).deps, prepared.settlementId)));
    expect(results.filter((r) => r.state !== "busy").length).toBeGreaterThanOrEqual(1);
    expect(stripe.created.transfers).toBe(1);
    const attempts = await dbs[0].select().from(partnerTransferAttempts).where(eq(partnerTransferAttempts.settlementId, prepared.settlementId));
    expect(attempts).toHaveLength(1);
    const confirmed = (await dbs[0].select().from(partnerLedgerEntries).where(eq(partnerLedgerEntries.partnerId, partner.partnerId))).filter((e) => e.kind === "transfer_confirmed");
    expect(confirmed.map((e) => e.amount)).toEqual([BigInt(-7425)]);
    // Executing again, as the sweep would, changes nothing.
    await Promise.all(dbs.map((db) => executeSettlement(depsOn(db).deps, prepared.settlementId)));
    expect(stripe.created.transfers).toBe(1);
  });

  it("a ledger write that references a partner never deadlocks against a transaction holding that partner", async () => {
    // The exact interleaving behind a deadlock found by the race below: B holds the partner (as a
    // settlement does) and then wants a commission; A holds that commission (as a refund does) and
    // writes a ledger entry, whose foreign-key check needs a share lock on the partner.
    const { partner, depsOn } = await setup();
    const [commission] = await dbs[0].select().from(partnerCommissions).where(eq(partnerCommissions.partnerId, partner.partnerId));
    const latch = () => {
      let open!: () => void;
      const promise = new Promise<void>((resolve) => (open = resolve));
      return { promise, open };
    };
    const partnerHeld = latch();
    const commissionHeld = latch();
    const b = depsOn(dbs[1]).deps.uow.transaction(async (tx) => {
      await tx.partners.lock(partner.partnerId);
      partnerHeld.open();
      await commissionHeld.promise;
      return Boolean(await tx.commissions.lockCommission(commission.id));
    });
    const a = depsOn(dbs[2]).deps.uow.transaction(async (tx) => {
      await partnerHeld.promise;
      await tx.commissions.lockCommission(commission.id);
      commissionHeld.open();
      return tx.commissions.appendLedger({
        environment: "test",
        partnerId: partner.partnerId,
        currency: "eur",
        kind: "commission_adjustment",
        amount: BigInt(-1),
        operationKey: `deadlock-check:${randomUUID()}`,
        commissionId: commission.id,
        reason: "Lock-order regression check",
        actor: "system",
      });
    });
    expect(await Promise.allSettled([a, b])).toEqual([
      { status: "fulfilled", value: true },
      { status: "fulfilled", value: true },
    ]);
  });

  it("an administrator's hold racing the monthly run never leaves a held commission inside a payout", async () => {
    const admin = { kind: "admin" as const, userId: "a", email: "admin@repget.test" };
    const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const outcomes = new Set<string>();
    for (let round = 0; round < 8; round += 1) {
      const { partner, depsOn } = await setup();
      const commissions = await dbs[0].select().from(partnerCommissions).where(eq(partnerCommissions.partnerId, partner.partnerId));
      const target = commissions[round % commissions.length];
      // Alternate who starts first, so both orders are exercised; the invariant must hold either way.
      const holdDelay = round % 2 === 0 ? 0 : 15 + round * 5;
      const runDelay = round % 2 === 0 ? round * 2 : 0;
      const [held, prepared] = await Promise.all([
        pause(holdDelay).then(() => holdCommission(depsOn(dbs[1]).deps, admin, target.id, true, "Racing the run")),
        pause(runDelay).then(() => prepareSettlement(depsOn(dbs[2]).deps, { kind: "system", origin: "race" }, { partnerId: partner.partnerId, currency: "eur", runKey: `race-${round}` })),
      ]);
      outcomes.add(held.ok ? "hold-won" : "run-won");
      const [after] = await dbs[0].select().from(partnerCommissions).where(eq(partnerCommissions.id, target.id));
      const items = prepared.kind === "created" ? await dbs[0].select().from(partnerSettlementItems).where(eq(partnerSettlementItems.settlementId, prepared.settlementId)) : [];
      const inPayout = items.some((item) => item.commissionId === target.id && item.active);
      // Exactly one of them won, and the row says which.
      expect(held.ok !== inPayout).toBe(true);
      if (held.ok) expect(after).toMatchObject({ status: "pending", holdReason: "admin:Racing the run" });
      else expect(after.status).toBe("reserved");
    }
    // Both orders happened (otherwise this test would prove only one of them).
    expect([...outcomes].sort()).toEqual(["hold-won", "run-won"]);
  });
});
