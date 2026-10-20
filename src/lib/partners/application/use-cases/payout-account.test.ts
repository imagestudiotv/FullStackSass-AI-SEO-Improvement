import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { partnerProfiles, partnerStripeAccounts } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { fakeConnect, partnerTestDeps, readiness, seedPartner } from "@/test/partners";

/**
 * Part 2: payout setup with Stripe-hosted onboarding. One connected account
 * per partner and environment, however often the partner clicks; a lost
 * answer is retried with the same idempotency key; the return from Stripe
 * proves nothing - readiness is read from the account; and an account that
 * is not this partner's, or not this environment's, changes nothing.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
  isDatabaseConfigured: () => true,
}));

import { readinessFromAccount } from "../../infrastructure/stripe/connect-onboarding";
import type { PartnerRecord } from "../ports/repositories";
import {
  accountReadiness,
  openPayoutDashboard,
  payoutSetupStatus,
  refreshOnboardingLink,
  startPayoutSetup,
  syncPayoutAccount,
} from "./manage-payout-account";

let test: TestDb;

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

async function access(options: Parameters<typeof seedPartner>[1] = {}) {
  const seeded = await seedPartner(test.db, options);
  const [row] = await test.db.select().from(partnerProfiles).where(eq(partnerProfiles.id, seeded.partnerId));
  const partner = { ...row, status: row.status } as unknown as PartnerRecord;
  return { context: { kind: "partner" as const, userId: seeded.userId, partnerId: seeded.partnerId }, partner };
}

describe("payout setup", () => {
  it("creates one connected account per partner, however often they click", async () => {
    const connect = fakeConnect();
    const { deps } = partnerTestDeps(test.db, { connect: connect.gateway });
    const me = await access();
    const first = await startPayoutSetup(deps, me);
    const second = await startPayoutSetup(deps, me);
    expect(first).toMatchObject({ ok: true, value: { url: expect.stringContaining("https://connect.stripe.test/setup/acct_") } });
    expect(second.ok).toBe(true);
    expect(connect.calls.filter((c) => c.method === "createConnectedAccount")).toHaveLength(1);
    const rows = await test.db.select().from(partnerStripeAccounts).where(eq(partnerStripeAccounts.partnerId, me.partner.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ environment: "test", status: "onboarding", country: "IT" });
  });

  it("retries a lost answer with the same idempotency key, so Stripe returns the same account", async () => {
    const connect = fakeConnect();
    const { deps } = partnerTestDeps(test.db, { connect: connect.gateway });
    const me = await access();
    connect.failNextCreate({ kind: "unknown", message: "ETIMEDOUT" });
    expect(await startPayoutSetup(deps, me)).toEqual({ ok: false, reason: "provider_outcome_unknown" });
    expect((await startPayoutSetup(deps, me)).ok).toBe(true);
    const keys = connect.calls.filter((c) => c.method === "createConnectedAccount").map((c) => (c.args as { idempotencyKey: string }).idempotencyKey);
    expect(keys).toHaveLength(2);
    expect(new Set(keys).size).toBe(1);
  });

  it("does not mark onboarding complete on return: readiness comes from the account", async () => {
    const connect = fakeConnect();
    const { deps } = partnerTestDeps(test.db, { connect: connect.gateway });
    const me = await access();
    await startPayoutSetup(deps, me);
    // The partner came back from Stripe ("save for later"): nothing changed.
    expect((await payoutSetupStatus(deps, me.partner.id))).toMatchObject({ configured: true, state: "setup_required" });
    const [row] = await test.db.select().from(partnerStripeAccounts).where(eq(partnerStripeAccounts.partnerId, me.partner.id));
    const accountId = row.stripeAccountId!;

    connect.accounts.set(accountId, readiness(accountId, { status: "verification_pending", detailsSubmitted: true, transfersCapability: "pending", metadataPartnerId: me.partner.id }));
    expect(await syncPayoutAccount(deps, me.context, { partnerId: me.partner.id })).toMatchObject({ ok: true, value: { state: "verification_pending" } });

    connect.accounts.set(accountId, readiness(accountId, { status: "restricted", detailsSubmitted: true, requirementsPastDue: ["external_account"], metadataPartnerId: me.partner.id }));
    expect(await syncPayoutAccount(deps, me.context, { partnerId: me.partner.id })).toMatchObject({ ok: true, value: { state: "restricted" } });

    connect.accounts.set(accountId, readiness(accountId, { status: "ready", detailsSubmitted: true, payoutsEnabled: true, transfersCapability: "active", requirementsCurrentlyDue: [], metadataPartnerId: me.partner.id }));
    expect(await syncPayoutAccount(deps, me.context, { partnerId: me.partner.id })).toMatchObject({ ok: true, value: { state: "ready" } });
    expect((await openPayoutDashboard(deps, me)).ok).toBe(true);
  });

  it("refuses another partner's account, the wrong environment, and a mismatched owner", async () => {
    const connect = fakeConnect();
    const { deps } = partnerTestDeps(test.db, { connect: connect.gateway });
    const me = await access();
    const other = await access();
    await startPayoutSetup(deps, other);
    expect(await syncPayoutAccount(deps, me.context, { partnerId: other.partner.id })).toEqual({ ok: false, reason: "forbidden" });

    const [row] = await test.db.select().from(partnerStripeAccounts).where(eq(partnerStripeAccounts.partnerId, other.partner.id));
    const system = { kind: "system" as const, origin: "test" };
    expect(await syncPayoutAccount(deps, system, { stripeAccountId: row.stripeAccountId!, livemode: true })).toMatchObject({ ok: false, detail: "wrong_environment" });
    connect.accounts.set(row.stripeAccountId!, readiness(row.stripeAccountId!, { metadataPartnerId: me.partner.id }));
    expect(await syncPayoutAccount(deps, system, { stripeAccountId: row.stripeAccountId!, livemode: false })).toMatchObject({ ok: false, detail: "account_owner_mismatch" });
    expect(await syncPayoutAccount(deps, system, { stripeAccountId: "acct_unknown", livemode: false })).toEqual({ ok: false, reason: "not_found" });
  });

  it("refuses suspended partners, unsupported countries, and a deployment without Stripe", async () => {
    const connect = fakeConnect();
    const { deps } = partnerTestDeps(test.db, { connect: connect.gateway });
    expect(await startPayoutSetup(deps, await access({ status: "suspended" }))).toMatchObject({ ok: false, reason: "forbidden" });
    expect(await startPayoutSetup(deps, await access({ country: "IN" }))).toMatchObject({ ok: false, detail: "country_not_supported" });
    const noStripe = partnerTestDeps(test.db).deps;
    expect(await startPayoutSetup(noStripe, await access())).toMatchObject({ ok: false, reason: "disabled" });
    expect(await refreshOnboardingLink(deps, await access())).toEqual({ ok: false, reason: "not_found" });
    expect(connect.calls.filter((c) => c.method === "createConnectedAccount")).toHaveLength(0);
  });
});

describe("readiness from a Stripe Account", () => {
  const account = (overrides: Partial<Stripe.Account> = {}) =>
    ({
      id: "acct_1",
      object: "account",
      charges_enabled: false,
      details_submitted: true,
      payouts_enabled: true,
      email: null,
      type: "express",
      country: "IT",
      default_currency: "eur",
      capabilities: { transfers: "active" },
      requirements: { currently_due: [], past_due: [], pending_verification: [], disabled_reason: null, current_deadline: null, eventually_due: [], errors: [], alternatives: [] },
      settings: { payouts: { schedule: { interval: "manual", delay_days: 7 } } },
      metadata: { repget_partner_id: "p1" },
      ...overrides,
    }) as unknown as Stripe.Account;

  it("maps setup, verification, restriction and readiness without guessing", () => {
    expect(readinessFromAccount(account(), "test")).toMatchObject({ status: "ready", livemode: false, payoutInterval: "manual", metadataPartnerId: "p1" });
    expect(readinessFromAccount(account({ details_submitted: false }), "test").status).toBe("onboarding");
    expect(readinessFromAccount(account({ capabilities: { transfers: "pending" } }), "test").status).toBe("verification_pending");
    expect(readinessFromAccount(account({ payouts_enabled: false }), "test").status).toBe("verification_pending");
    expect(readinessFromAccount(account({ capabilities: { transfers: "inactive" } }), "test").status).toBe("restricted");
    expect(
      readinessFromAccount(account({ requirements: { currently_due: [], past_due: ["individual.id_number"], pending_verification: [], disabled_reason: "requirements.past_due", current_deadline: 1790000000, eventually_due: [], errors: [], alternatives: [] } }), "live"),
    ).toMatchObject({ status: "restricted", livemode: true, disabledReason: "requirements.past_due" });
  });

  it("is never ready while Stripe would pay the balance out on its own schedule (Accounts v2 start on daily)", () => {
    expect(readinessFromAccount(account({ settings: { payouts: { schedule: { interval: "daily", delay_days: 7 } } } as Stripe.Account["settings"] }), "test")).toMatchObject({
      status: "verification_pending",
      payoutInterval: "daily",
    });
    expect(readinessFromAccount(account({ settings: {} as Stripe.Account["settings"] }), "test").status).toBe("verification_pending");
  });
});

describe("the payout schedule is made manual whenever an account is read", () => {
  const readyButDaily = (accountId: string, partnerId: string) =>
    readiness(accountId, { status: "verification_pending", detailsSubmitted: true, payoutsEnabled: true, transfersCapability: "active", requirementsCurrentlyDue: [], payoutInterval: "daily", metadataPartnerId: partnerId });

  it("repairs a daily schedule before storing the status, so the partner becomes ready", async () => {
    const connect = fakeConnect();
    const { deps } = partnerTestDeps(test.db, { connect: connect.gateway });
    const me = await access();
    await startPayoutSetup(deps, me);
    const [row] = await test.db.select().from(partnerStripeAccounts).where(eq(partnerStripeAccounts.partnerId, me.partner.id));
    connect.accounts.set(row.stripeAccountId!, readyButDaily(row.stripeAccountId!, me.partner.id));
    expect(await syncPayoutAccount(deps, me.context, { partnerId: me.partner.id })).toMatchObject({ ok: true, value: { state: "ready" } });
    expect(connect.calls.filter((c) => c.method === "ensureManualPayouts")).toHaveLength(1);
    const [stored] = await test.db.select().from(partnerStripeAccounts).where(eq(partnerStripeAccounts.id, row.id));
    expect(stored).toMatchObject({ status: "ready", payoutInterval: "manual" });
    // Already manual: nothing is written to Stripe again.
    await syncPayoutAccount(deps, me.context, { partnerId: me.partner.id });
    expect(connect.calls.filter((c) => c.method === "ensureManualPayouts")).toHaveLength(1);
  });

  it("when Stripe refuses the change, the account stays not ready, so nothing is sent to it", async () => {
    const connect = fakeConnect();
    connect.refuseManualPayouts();
    const accountId = "acct_daily_refused";
    connect.accounts.set(accountId, readyButDaily(accountId, "p1"));
    const read = await accountReadiness(connect.gateway, accountId);
    expect(read).toMatchObject({ status: "verification_pending", payoutInterval: "daily" });
    connect.refuseManualPayouts(false);
    expect(await accountReadiness(connect.gateway, accountId)).toMatchObject({ status: "ready", payoutInterval: "manual" });
  });
});
