import { randomUUID } from "node:crypto";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { partnerStripeAccounts } from "@/lib/db/schema";
import { PayoutStatus } from "@/components/partners/payout-status";
import { LOCALES } from "@/lib/i18n/config";
import { settingsFromEnv } from "@/lib/partners/infrastructure/settings";
import { PAYOUT_STATUS_COPY } from "@/lib/partners/presentation/payout-status-copy";
import { partnerCopy } from "@/lib/partners/presentation/copy";
import { balanceView, payoutRowView, payoutStatusView } from "@/lib/partners/presentation/views";
import { createTestDb, type TestDb } from "@/test/db";
import { fakePayouts, partnerTestDeps, seedPartner, seedUser, seedWorkspace, setControl } from "@/test/partners";

import { choosePayoutMethod, setPayPalRecipient, verifyPayPalRecipient } from "../use-cases/paypal-payouts";
import { chooseCreditWorkspace } from "../use-cases/partner-credits";
import { partnerPayoutStatus } from "./payout-status";

/** What a partner is told they must do to be paid, and when: only what is true for them here. */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
  isDatabaseConfigured: () => true,
}));

let test: TestDb;
beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
  await setControl(test.db, "partner_payouts", true);
});

function world(env: Record<string, string> = {}) {
  const stripe = fakePayouts();
  const settings = settingsFromEnv({ STRIPE_SECRET_KEY: "sk_test_x", NEXT_PUBLIC_APP_URL: "https://repget.test", PARTNER_PAYOUT_FORM: "cash", ...env } as unknown as NodeJS.ProcessEnv);
  const made = partnerTestDeps(test.db, { settings, connect: stripe.gateway, payouts: stripe.gateway });
  made.deps.random = { ...made.deps.random, indexes: () => [1, 2, 3, 4, 5, 6] };
  return made.deps;
}

const PAYPAL = { PARTNER_PAYPAL_PAYOUTS: "manual", PARTNER_PAYPAL_FEE_BEARER: "repget", PARTNER_PAYPAL_PAYOUT_COUNTRIES: "IT,IN" };

async function statusOf(deps: ReturnType<typeof world>, partnerId: string) {
  return partnerPayoutStatus(deps, (await deps.uow.repositories.partners.findById(partnerId))!);
}

describe("what a partner needs to do to be paid", () => {
  it("in cash, through Stripe: the state Stripe reported, the minimum, the waiting days and the next run", async () => {
    const deps = world();
    const partner = await seedPartner(test.db, { country: "IT" });
    expect(await statusOf(deps, partner.partnerId)).toEqual({
      form: "cash",
      step: "stripe_not_started",
      paused: false,
      maturityDays: 30,
      minimum: { amount: BigInt(2500), currency: "eur" },
      nextRunAt: new Date("2026-11-01T00:00:00Z"),
    });
    await test.db.insert(partnerStripeAccounts).values({ partnerId: partner.partnerId, environment: "test", stripeAccountId: `acct_${randomUUID().slice(0, 8)}`, status: "ready", creationKey: randomUUID() });
    expect((await statusOf(deps, partner.partnerId)).step).toBe("stripe_ready");
    // A country taken off the list later does not hide an account that works.
    expect((await statusOf(world({ PARTNER_PAYOUT_COUNTRIES: "FR" }), partner.partnerId)).step).toBe("stripe_ready");
  });

  it("where no method covers the country: says so, instead of a setup that cannot work; PayPal where only it does", async () => {
    const partner = await seedPartner(test.db, { country: "IN" });
    expect((await statusOf(world(), partner.partnerId)).step).toBe("country");
    const deps = world(PAYPAL);
    expect((await statusOf(deps, partner.partnerId)).step).toBe("paypal_confirm");
    await setPayPalRecipient(deps, { partnerId: partner.partnerId, email: "p@example.test" });
    await verifyPayPalRecipient(deps, { partnerId: partner.partnerId, code: "123456" });
    await choosePayoutMethod(deps, { partnerId: partner.partnerId, method: "paypal" });
    expect((await statusOf(deps, partner.partnerId)).step).toBe("paypal_ready");
    // PayPal switched off afterwards.
    expect((await statusOf(world(), partner.partnerId)).step).toBe("paypal_off");
  });

  it("in credits: a workspace the partner owns, and no run, minimum or bank", async () => {
    const deps = world({ PARTNER_PAYOUT_FORM: "credits" });
    const partner = await seedPartner(test.db, { country: "IT" });
    expect(await statusOf(deps, partner.partnerId)).toMatchObject({ form: "credits", step: "credits_no_workspace", minimum: null, nextRunAt: null });
    const workspace = await seedWorkspace(test.db, partner.userId);
    expect((await statusOf(deps, partner.partnerId)).step).toBe("credits_choose");
    await chooseCreditWorkspace(deps, { partnerId: partner.partnerId, organizationId: workspace });
    expect((await statusOf(deps, partner.partnerId)).step).toBe("credits_ready");
    await seedUser(test.db);
  });

  it("says payouts have not started while live money is not allowed or the switch is off", async () => {
    const partner = await seedPartner(test.db, { country: "IT" });
    const live = world({ STRIPE_SECRET_KEY: "sk_live_x" });
    expect((await statusOf(live, partner.partnerId)).paused).toBe(true);
    expect((await statusOf(world({ STRIPE_SECRET_KEY: "sk_live_x", PARTNER_LIVE_PAYOUTS: "enabled" }), partner.partnerId)).paused).toBe(false);
    await setControl(test.db, "partner_payouts", false);
    expect((await statusOf(world(), partner.partnerId)).paused).toBe(true);
    await setControl(test.db, "partner_payouts", true);
  });
});

describe("in words", () => {
  const base = { paused: false, maturityDays: 30, minimum: { amount: BigInt(2500), currency: "eur" }, nextRunAt: new Date("2026-12-01T00:00:00Z") };

  it.each([...LOCALES])("every status in %s is complete, with its figures filled in and no dash", (locale) => {
    const copy = PAYOUT_STATUS_COPY[locale];
    expect(copy.creditsMetaDescription.length).toBeLessThanOrEqual(158);
    for (const step of Object.keys(copy.steps) as (keyof typeof copy.steps)[]) {
      const form = step.startsWith("credits") ? ("credits" as const) : ("cash" as const);
      const html = renderToStaticMarkup(createElement(PayoutStatus, { view: payoutStatusView({ ...base, form, step, paused: step === "unavailable" }, copy, locale), contactHref: "/contact" }));
      expect(html, step).toContain("30");
      expect(html, step).not.toMatch(/\{\w+\}|undefined|—|–/);
      expect(html.includes('href="/contact"'), step).toBe(step === "country" || step === "paypal_off");
      if (form === "cash") expect(html, step).toMatch(/25[.,]00/);
      else expect(html, step).not.toMatch(/25[.,]00/);
    }
  });

  it("names no payout run while payouts have not started", () => {
    const copy = PAYOUT_STATUS_COPY.en;
    const on = payoutStatusView({ ...base, form: "cash", step: "stripe_ready" }, copy, "en");
    const off = payoutStatusView({ ...base, form: "cash", step: "stripe_ready", paused: true }, copy, "en");
    expect(on.facts.some((fact) => fact.startsWith("Next payout run"))).toBe(true);
    expect(off.facts.some((fact) => fact.startsWith("Next payout run"))).toBe(false);
    expect(off.paused).toBe(copy.paused);
  });

  it("shows no minimum, bank or Stripe for credits, and PayPal's one step for PayPal", () => {
    const portal = partnerCopy("en").portal;
    const zero = BigInt(0);
    const figures = { currency: "eur", earned: BigInt(2475), unpaid: BigInt(2475), pending: zero, available: BigInt(2475), inPayout: zero, transferred: zero, bankPaid: zero, offset: zero, liability: BigInt(2475), threshold: BigInt(2500), belowThreshold: true, updatedAt: new Date() };
    const view = balanceView(figures, portal, "en", 30, { form: "credits", definition: PAYOUT_STATUS_COPY.en.paidDefinition.credits });
    expect(view.notes).toEqual([]);
    expect(JSON.stringify(view.figures.find((figure) => figure.key === "paid"))).not.toMatch(/Stripe|bank/);
    const row = payoutRowView(
      { id: "s", createdAt: new Date("2026-10-01T00:00:00Z"), currency: "eur", amount: BigInt(4950), offset: zero, transfer: "confirmed", bank: "not_started", bankPaidAt: null, bankArrivalDate: null, method: "paypal", paidAt: new Date("2026-10-02T00:00:00Z") },
      portal,
      "en",
      PAYOUT_STATUS_COPY.en.payouts,
    );
    expect(row).toMatchObject({ transfer: "Sent", bank: "PayPal account", bankTone: "success", bankDetail: "2 Oct 2026" });
  });
});
