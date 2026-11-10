import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { addons, creditLedger, member, partnerCommissions, partnerCreditGrants, partnerLedgerEntries, partnerSettlements } from "@/lib/db/schema";
import { settingsFromEnv } from "@/lib/partners/infrastructure/settings";
import { createTestDb, type TestDb } from "@/test/db";
import { fakeBilling, partnerTestDeps, seedPartner, seedStripeCustomer, seedUser, seedWorkspace, setControl } from "@/test/partners";

/**
 * Partners paid in RepGet credits (use-cases/partner-credits.ts; owner's
 * decisions 2026-11-07): the smallest pack's rate (EUR 79.00 for 100
 * credits), into a workspace the partner owns, each commission once it is 30
 * days old with no minimum. Real repositories on PGlite; commissions from the
 * same Stripe path as the settlement tests.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
  isDatabaseConfigured: () => true,
}));

import { captureSignupEligibility } from "./attribute-new-customer";
import { chooseCreditWorkspace, convertMaturedCommissions, convertPartnerCommissions, creditsForTotal } from "./partner-credits";
import { processChargeAdjustments } from "./process-adjustment";
import { prepareSettlement } from "./prepare-settlement";
import { processInvoice } from "./process-payment";
import { recordReferralClick } from "./record-referral-click";

let test: TestDb;
const DAY = 86_400_000;

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
  await setControl(test.db, "partner_program", true);
  await setControl(test.db, "partner_commissions", true);
  await setControl(test.db, "partner_payouts", true);
  // The smallest pack sets the rate; a bigger, cheaper-per-credit one does not.
  await test.db.insert(addons).values([
    { slug: `credits_${randomUUID()}`, name: "100 credits", priceCents: 7900, creditsGranted: 100, kind: "credits" },
    { slug: `credits_${randomUUID()}`, name: "500 credits", priceCents: 27900, creditsGranted: 500, kind: "credits" },
  ]);
});

function world(form: "credits" | "cash" = "credits") {
  const billing = fakeBilling();
  const settings = settingsFromEnv({ STRIPE_SECRET_KEY: "sk_test_fake", NEXT_PUBLIC_APP_URL: "https://repget.test", PARTNER_PAYOUT_FORM: form } as unknown as NodeJS.ProcessEnv);
  const env = partnerTestDeps(test.db, { billing: billing.source, settings });
  return { ...env, billing };
}
type World = ReturnType<typeof world>;

/** A partner who owns a workspace (chosen for credits). */
async function partner(w: World) {
  const p = await seedPartner(test.db);
  const workspace = await seedWorkspace(test.db, p.userId);
  expect(await chooseCreditWorkspace(w.deps, { partnerId: p.partnerId, organizationId: workspace })).toEqual({ ok: true, value: null });
  return { ...p, workspace };
}

/** One referred customer paying EUR 99.00 `daysAgo` days ago: a EUR 24.75 commission. Returns its charge. */
async function commission(w: World, code: string, daysAgo = 40) {
  const now = w.clock.now();
  w.clock.set(new Date(now.getTime() - (daysAgo + 1) * DAY));
  const click = await recordReferralClick(w.deps, { code, existingToken: null, landingPath: "/", referrerHost: null, visitor: randomUUID() });
  const createdAt = w.clock.now();
  const person = await seedUser(test.db, { createdAt });
  const orgId = await seedWorkspace(test.db, person.id, { createdAt });
  await captureSignupEligibility(w.deps, { userId: person.id, email: person.email, createdAt, method: "email", trackingToken: click.setCookie!.token, ipAddress: null, userAgent: null });
  const customerId = await seedStripeCustomer(test.db, orgId);
  w.clock.set(now);
  const invoice = w.billing.invoice({ customerId, total: 9900, collections: [{ cash: 9900, paidAt: new Date(now.getTime() - daysAgo * DAY) }] });
  await processInvoice(w.deps, invoice.invoiceId, "test");
  return invoice.collections[0].chargeId!;
}

const balance = async (organizationId: string) =>
  (await test.db.select().from(creditLedger).where(and(eq(creditLedger.organizationId, organizationId), eq(creditLedger.type, "partner_commission")))).reduce((sum, row) => sum + row.amount, 0);

describe("the rate", () => {
  it("is the smallest pack's: whole credits only, fractions kept for later", () => {
    const pack = { priceCents: 7900, credits: 100 };
    expect(creditsForTotal(BigInt(2475), pack)).toBe(31); // 31.33
    expect(creditsForTotal(BigInt(4950), pack)).toBe(62); // 62.66
    expect(creditsForTotal(BigInt(9900), pack)).toBe(125); // 125.31
  });
});

describe("partners paid in credits", () => {
  it("converts matured commissions once, into the chosen workspace, at EUR 79 for 100 credits", async () => {
    const w = world();
    const p = await partner(w);
    await commission(w, p.code);
    await commission(w, p.code);
    expect(await convertPartnerCommissions(w.deps, { partnerId: p.partnerId, currency: "eur" })).toMatchObject({ kind: "converted", amount: BigInt(4950), credits: 62 });
    // Again, and the sweep: nothing more.
    expect(await convertPartnerCommissions(w.deps, { partnerId: p.partnerId, currency: "eur" })).toMatchObject({ kind: "skipped" });
    await convertMaturedCommissions(w.deps);

    expect(await balance(p.workspace)).toBe(62);
    const [settlement] = await test.db.select().from(partnerSettlements).where(eq(partnerSettlements.partnerId, p.partnerId));
    expect(settlement).toMatchObject({ payoutMethod: "credits", state: "paid", transferAmount: BigInt(4950), stripeAccountId: null });
    const ledger = await test.db.select().from(partnerLedgerEntries).where(and(eq(partnerLedgerEntries.partnerId, p.partnerId), eq(partnerLedgerEntries.kind, "transfer_confirmed")));
    expect(ledger.map((entry) => entry.amount)).toEqual([BigInt(-4950)]);
    const statuses = (await test.db.select({ s: partnerCommissions.status }).from(partnerCommissions).where(eq(partnerCommissions.partnerId, p.partnerId))).map((r) => r.s);
    expect(statuses).toEqual(["paid", "paid"]);
    const [grant] = await test.db.select().from(partnerCreditGrants).where(eq(partnerCreditGrants.partnerId, p.partnerId));
    expect(grant).toMatchObject({ organizationId: p.workspace, credits: 62, packCents: 7900, packCredits: 100 });
  });

  it("never loses a fraction: four separate EUR 24.75 conversions give 31, 31, 31 and 32 (125 in all)", async () => {
    const w = world();
    const p = await partner(w);
    const credits: number[] = [];
    for (let i = 0; i < 4; i += 1) {
      await commission(w, p.code);
      const result = await convertPartnerCommissions(w.deps, { partnerId: p.partnerId, currency: "eur" });
      credits.push(result.kind === "converted" ? result.credits : -1);
    }
    expect(credits).toEqual([31, 31, 31, 32]);
    expect(await balance(p.workspace)).toBe(125);
  });

  it("waits for maturity: a commission under 30 days old is not converted yet", async () => {
    const w = world();
    const p = await partner(w);
    await commission(w, p.code, 10);
    expect(await convertPartnerCommissions(w.deps, { partnerId: p.partnerId, currency: "eur" })).toMatchObject({ kind: "skipped", reason: "nothing_payable" });
    expect(await balance(p.workspace)).toBe(0);
  });

  it("a refund after converting reduces FUTURE credits; credits already granted stay", async () => {
    const w = world();
    const p = await partner(w);
    const charge = await commission(w, p.code);
    await convertPartnerCommissions(w.deps, { partnerId: p.partnerId, currency: "eur" });
    expect(await balance(p.workspace)).toBe(31);
    // The customer is refunded in full after the commission was paid as credits.
    w.billing.setCharge(charge, { refunded: 9900 });
    await processChargeAdjustments(w.deps, charge, "test");
    // The next commission is owed back first: nothing converted, credits already granted untouched.
    await commission(w, p.code);
    expect(await convertPartnerCommissions(w.deps, { partnerId: p.partnerId, currency: "eur" })).toMatchObject({ kind: "skipped" });
    expect(await balance(p.workspace)).toBe(31);
  });

  it("only into a workspace the partner owns, and nothing without one", async () => {
    const w = world();
    const p = await seedPartner(test.db);
    const someoneElse = await seedUser(test.db, {});
    const theirs = await seedWorkspace(test.db, someoneElse.id);
    expect(await chooseCreditWorkspace(w.deps, { partnerId: p.partnerId, organizationId: theirs })).toMatchObject({ ok: false, detail: "not_owner" });
    await commission(w, p.code);
    expect(await convertPartnerCommissions(w.deps, { partnerId: p.partnerId, currency: "eur" })).toMatchObject({ kind: "skipped", reason: "no_credit_workspace" });
  });

  it("stops if the partner no longer owns the chosen workspace", async () => {
    const w = world();
    const p = await partner(w);
    await commission(w, p.code);
    await test.db.update(member).set({ role: "member" }).where(and(eq(member.organizationId, p.workspace), eq(member.userId, p.userId)));
    expect(await convertPartnerCommissions(w.deps, { partnerId: p.partnerId, currency: "eur" })).toMatchObject({ kind: "skipped", reason: "workspace_not_owned" });
  });

  it("credits and cash never both pay: no cash settlement while partners are paid in credits, no credits while in cash", async () => {
    const w = world("credits");
    const p = await partner(w);
    await commission(w, p.code);
    await commission(w, p.code);
    expect(await prepareSettlement(w.deps, { kind: "system", origin: "test" }, { partnerId: p.partnerId, currency: "eur", runKey: "2026-10" })).toEqual({ kind: "skipped", reason: "cash_payouts_off" });
    const cash = world("cash");
    expect(await convertPartnerCommissions(cash.deps, { partnerId: p.partnerId, currency: "eur" })).toMatchObject({ kind: "skipped", reason: "cash_form" });
  });
});
