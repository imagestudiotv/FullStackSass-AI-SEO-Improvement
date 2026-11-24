import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/inngest/client", () => ({ inngest: { send: vi.fn() } }));

import { partnerLedgerEntries, partnerPayPalAccounts, partnerPayPalPayouts, partnerProfiles, partnerSettlements } from "@/lib/db/schema";
import type { Database } from "@/lib/db/types";
import { settingsFromEnv } from "@/lib/partners/infrastructure/settings";
import { fakeBilling, partnerTestDeps, seedPartner, seedStripeCustomer, seedUser, seedWorkspace, setControl } from "@/test/partners";
import { createPostgresTestDb, testPostgresUrl } from "@/test/postgres";

import type { PayPalPayoutEvidence, PayPalPayoutGateway } from "../ports/payout-gateway";
import { captureSignupEligibility } from "./attribute-new-customer";
import { executeSettlement } from "./execute-transfer";
import { syncPayPalPayoutItem } from "./paypal-payouts";
import { cancelSettlement, prepareSettlement } from "./prepare-settlement";
import { processInvoice } from "./process-payment";
import { recordReferralClick } from "./record-referral-click";

/**
 * PayPal payouts on a REAL Postgres, where PayPal's webhook, the sweep and an
 * administrator act on one payout at the same moment: it is sent once, settled
 * once and announced once; and a release raced with the sending never leaves
 * the commissions both released and paid.
 */

const available = Boolean(testPostgresUrl());
let env: Awaited<ReturnType<typeof createPostgresTestDb>>;
let dbs: Database[];
const DAY = 86_400_000;

beforeAll(async () => {
  if (!available) return;
  env = await createPostgresTestDb(4, { prefix: "partner_audit_nov24" });
  dbs = env.dbs as unknown as Database[];
  for (const key of ["partner_program", "partner_commissions", "partner_payouts"] as const) await setControl(dbs[0], key, true);
}, 120_000);

afterAll(async () => {
  if (available) await env.dispose();
});

async function setup() {
  const billing = fakeBilling();
  const made = new Map<string, PayPalPayoutEvidence>();
  const gateway: PayPalPayoutGateway = {
    environment: () => "test",
    async createPayout(input) {
      const existing = made.get(input.senderBatchId);
      if (existing) return { kind: "succeeded", value: existing };
      const evidence: PayPalPayoutEvidence = { batchId: `B-${randomUUID().slice(0, 8)}`, senderBatchId: input.senderBatchId, batchStatus: "PENDING", itemId: `I-${randomUUID().slice(0, 8)}`, itemStatus: "PENDING", transactionId: null, amount: input.amount, currency: input.currency, fee: null, receiver: input.receiver, error: null };
      made.set(input.senderBatchId, evidence);
      return { kind: "succeeded", value: evidence };
    },
    getBatch: async (batchId) => [...made.values()].find((batch) => batch.batchId === batchId)!,
    getItem: async (itemId) => [...made.values()].find((batch) => batch.itemId === itemId)!,
  };
  const settings = settingsFromEnv({ STRIPE_SECRET_KEY: "sk_test_x", NEXT_PUBLIC_APP_URL: "https://repget.test", PARTNER_PAYOUT_FORM: "cash", PARTNER_PAYPAL_PAYOUTS: "automated", PARTNER_PAYPAL_FEE_BEARER: "repget", PARTNER_PAYPAL_PAYOUT_COUNTRIES: "IT" } as unknown as NodeJS.ProcessEnv);
  const on = (db: Database) => partnerTestDeps(db, { billing: billing.source, settings, paypalPayouts: gateway });
  const worlds = dbs.map(on);
  const base = worlds[0];
  const partner = await seedPartner(dbs[0], { country: "IT" });
  const now = base.clock.now();
  for (let i = 0; i < 2; i += 1) {
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
  await dbs[0].insert(partnerPayPalAccounts).values({ partnerId: partner.partnerId, environment: "test", recipientType: "EMAIL", receiver: "p@example.test", status: "verified", verifiedAt: now });
  await dbs[0].update(partnerProfiles).set({ payoutMethod: "paypal" }).where(eq(partnerProfiles.id, partner.partnerId));
  const prepared = await prepareSettlement(base.deps, { kind: "system", origin: "race" }, { partnerId: partner.partnerId, currency: "eur", runKey: "2026-10" });
  if (prepared.kind !== "created") throw new Error(`not created: ${prepared.kind} ${prepared.reason}`);
  return { partner, worlds, made, id: prepared.settlementId };
}

const confirmed = (partnerId: string) =>
  dbs[0].select().from(partnerLedgerEntries).where(and(eq(partnerLedgerEntries.partnerId, partnerId), eq(partnerLedgerEntries.kind, "transfer_confirmed")));
const stateOf = async (id: string) => (await dbs[0].select().from(partnerSettlements).where(eq(partnerSettlements.id, id)))[0].state;

describe.skipIf(!available)("PayPal payouts under concurrency (real Postgres)", () => {
  it("four workers send it once; the webhook and the sweep settle and announce it once", async () => {
    const { partner, worlds, made, id } = await setup();
    await Promise.all(worlds.map((world) => executeSettlement(world.deps, id)));
    expect(made.size).toBe(1);
    const item = [...made.values()][0];
    item.itemStatus = "SUCCESS";
    item.transactionId = "8XY12345AB6789012";
    await Promise.all([...worlds.map((world) => syncPayPalPayoutItem(world.deps, item.itemId!)), ...worlds.map((world) => executeSettlement(world.deps, id))]);
    expect((await confirmed(partner.partnerId)).map((entry) => entry.amount)).toEqual([BigInt(-4950)]);
    expect(await stateOf(id)).toBe("paid");
    expect(worlds.flatMap((world) => world.mail).filter((mail) => mail.kind === "Your RepGet partner payout")).toHaveLength(1);
  });

  it("a release raced with the sending leaves it either released or sent, never both", async () => {
    for (let round = 0; round < 4; round += 1) {
      const { worlds, made, id } = await setup();
      await Promise.all([
        executeSettlement(worlds[0].deps, id),
        cancelSettlement(worlds[1].deps, { kind: "admin", userId: "a", email: "admin@repget.test" }, id, "stop this payout"),
        executeSettlement(worlds[2].deps, id),
      ]);
      const state = await stateOf(id);
      const attempts = await dbs[0].select().from(partnerPayPalPayouts).where(eq(partnerPayPalPayouts.settlementId, id));
      if (state === "canceled") expect([made.size, attempts.length]).toEqual([0, 0]);
      else expect([state, made.size, attempts.length]).toEqual(["transfer_processing", 1, 1]);
    }
  });
});
