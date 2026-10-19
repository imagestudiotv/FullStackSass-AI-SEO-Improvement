import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { adminAuditLog, partnerCoupons, partnerProviderEvents, webhookEvents } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { partnerTestDeps, seedPartner } from "@/test/partners";

/**
 * Part 3: affiliate coupons (Stripe coupon + promotion code, created by an
 * administrator, with explicit duration rules) and the durable hand-off of
 * affiliate work from the platform webhook.
 */

const state = vi.hoisted(() => ({ db: null as unknown, deps: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
  isDatabaseConfigured: () => true,
}));
vi.mock("@/lib/partners/server", () => ({ partnerDeps: () => state.deps, partnerInfrastructure: () => state.deps }));
vi.mock("@/inngest/client", () => ({ inngest: { send: vi.fn(async () => ({ ids: [] })) } }));

import type { CouponGateway, CouponSpec } from "../ports/billing-source";
import type { AdminContext } from "../contracts/commands";
import { activateDueCoupons, couponTerms, createPartnerCoupon, deactivatePartnerCoupon } from "./manage-coupon";

let test: TestDb;
const admin: AdminContext = { kind: "admin", userId: "a", email: "admin@repget.test" };

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

function fakeCoupons(fail = false) {
  const specs: CouponSpec[] = [];
  const activated: string[] = [];
  const deactivated: string[] = [];
  const gateway: CouponGateway = {
    async createCouponWithCode(spec) {
      if (fail) throw Object.assign(new Error("No such product"), { statusCode: 400 });
      specs.push(spec);
      return { couponId: `co_${specs.length}`, promotionCodeId: `promo_${randomUUID()}` };
    },
    async deactivatePromotionCode(id) {
      deactivated.push(id);
    },
    async activatePromotionCode(id) {
      activated.push(id);
    },
    async productIntervals() {
      return {};
    },
  };
  return { gateway, specs, activated, deactivated };
}

const code = () => `SAVE${randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`;

describe("coupon terms (monthly and annual)", () => {
  it("defines each campaign's duration explicitly", () => {
    expect(couponTerms({ partnerId: "p", code: "X", campaign: "c", discountType: "percent_first_payment", percentOffBasisPoints: 1000 })).toMatchObject({ ok: true, value: { duration: "once", percentOffBasisPoints: 1000 } });
    expect(couponTerms({ partnerId: "p", code: "X", campaign: "c", discountType: "percent_first_3_months", percentOffBasisPoints: 2000 })).toEqual({ ok: false, reason: "invalid", detail: "annual_behaviour_unacknowledged" });
    expect(couponTerms({ partnerId: "p", code: "X", campaign: "c", discountType: "percent_first_3_months", percentOffBasisPoints: 2000, acknowledgeAnnualBehaviour: true })).toMatchObject({ ok: true, value: { duration: "repeating", durationInMonths: 3 } });
    expect(couponTerms({ partnerId: "p", code: "X", campaign: "c", discountType: "fixed_amount", amountOff: BigInt(1000), currency: "EUR" })).toMatchObject({ ok: true, value: { amountOff: BigInt(1000), currency: "eur", duration: "once" } });
    expect(couponTerms({ partnerId: "p", code: "X", campaign: "c", discountType: "custom", percentOffBasisPoints: 1500, duration: "repeating", durationInMonths: 6 })).toMatchObject({ ok: true, value: { durationInMonths: 6 } });
    expect(couponTerms({ partnerId: "p", code: "X", campaign: "c", discountType: "custom", percentOffBasisPoints: 1500, amountOff: BigInt(5) })).toMatchObject({ ok: false });
    expect(couponTerms({ partnerId: "p", code: "X", campaign: "c", discountType: "percent_first_payment", percentOffBasisPoints: 50 })).toMatchObject({ ok: false, detail: "percent" });
  });
});

describe("creating and deactivating coupons", () => {
  it("creates the Stripe coupon and code for an active partner, audited, with a stable idempotency key", async () => {
    const coupons = fakeCoupons();
    const { deps } = partnerTestDeps(test.db, { couponGateway: coupons.gateway });
    const partner = await seedPartner(test.db);
    const result = await createPartnerCoupon(deps, admin, { partnerId: partner.partnerId, code: code(), campaign: "Newsletter launch", discountType: "percent_first_payment", percentOffBasisPoints: 1000 });
    if (!result.ok) throw new Error(result.detail);
    expect(result.value).toMatchObject({ status: "active", partnerId: partner.partnerId, stripeCouponId: "co_1" });
    expect(coupons.specs[0]).toMatchObject({ idempotencyKey: `partner-coupon:${result.value.id}`, active: true, metadata: { repget_partner_id: partner.partnerId } });
    const audit = await test.db.select().from(adminAuditLog).where(eq(adminAuditLog.targetId, result.value.id));
    expect(audit.map((a) => a.action)).toEqual(["partner.coupon_created"]);
  });

  it("refuses a taken code, a suspended partner and an unacknowledged annual behaviour", async () => {
    const coupons = fakeCoupons();
    const { deps } = partnerTestDeps(test.db, { couponGateway: coupons.gateway });
    const partner = await seedPartner(test.db);
    const taken = code();
    expect((await createPartnerCoupon(deps, admin, { partnerId: partner.partnerId, code: taken, campaign: "One", discountType: "percent_first_payment", percentOffBasisPoints: 1000 })).ok).toBe(true);
    expect(await createPartnerCoupon(deps, admin, { partnerId: partner.partnerId, code: taken, campaign: "Two", discountType: "percent_first_payment", percentOffBasisPoints: 1000 })).toMatchObject({ ok: false, detail: "code_taken" });
    const suspended = await seedPartner(test.db, { status: "suspended" });
    expect(await createPartnerCoupon(deps, admin, { partnerId: suspended.partnerId, code: code(), campaign: "Three", discountType: "percent_first_payment", percentOffBasisPoints: 1000 })).toMatchObject({ ok: false, detail: "partner_suspended" });
    expect(await createPartnerCoupon(deps, admin, { partnerId: partner.partnerId, code: code(), campaign: "Four", discountType: "percent_first_3_months", percentOffBasisPoints: 1000 })).toMatchObject({ ok: false, detail: "annual_behaviour_unacknowledged" });
  });

  it("records a Stripe refusal as failed, never as active", async () => {
    const coupons = fakeCoupons(true);
    const { deps } = partnerTestDeps(test.db, { couponGateway: coupons.gateway });
    const partner = await seedPartner(test.db);
    const theCode = code();
    expect(await createPartnerCoupon(deps, admin, { partnerId: partner.partnerId, code: theCode, campaign: "Broken", discountType: "percent_first_payment", percentOffBasisPoints: 1000 })).toMatchObject({ ok: false, detail: "stripe_refused" });
    const [row] = await test.db.select().from(partnerCoupons).where(eq(partnerCoupons.code, theCode));
    expect(row.status).toBe("failed");
  });

  it("creates a future campaign inactive and activates it when its date comes; deactivates with a reason", async () => {
    const coupons = fakeCoupons();
    const env = partnerTestDeps(test.db, { couponGateway: coupons.gateway });
    const partner = await seedPartner(test.db);
    const startsAt = new Date(env.clock.now().getTime() + 2 * 24 * 60 * 60 * 1000);
    const result = await createPartnerCoupon(env.deps, admin, { partnerId: partner.partnerId, code: code(), campaign: "Black Friday", discountType: "percent_first_payment", percentOffBasisPoints: 2000, startsAt });
    if (!result.ok) throw new Error(result.detail);
    expect(result.value.status).toBe("creating");
    expect(coupons.specs.at(-1)?.active).toBe(false);
    expect((await activateDueCoupons(env.deps)).activated).toBe(0);
    env.clock.advance(3 * 24 * 60 * 60 * 1000);
    expect((await activateDueCoupons(env.deps)).activated).toBeGreaterThanOrEqual(1);
    expect(coupons.activated).toContain(result.value.stripePromotionCodeId);
    expect(await deactivatePartnerCoupon(env.deps, admin, result.value.id, "no")).toMatchObject({ ok: false, detail: "reason" });
    expect((await deactivatePartnerCoupon(env.deps, admin, result.value.id, "Campaign ended")).ok).toBe(true);
    expect(coupons.deactivated).toContain(result.value.stripePromotionCodeId);
  });
});

describe("the platform webhook hands affiliate work over durably", () => {
  it("records the work for a relevant event before the event completes, once per event id", async () => {
    state.deps = partnerTestDeps(test.db).deps;
    const { recordPartnerPlatformWork } = await import("@/lib/partners/presentation/webhooks");
    const event = { id: `evt_${randomUUID()}`, object: "event", type: "invoice.paid", livemode: false, created: 1790000000, data: { object: { object: "invoice", id: "in_handoff" } } } as unknown as Stripe.Event;
    await recordPartnerPlatformWork(event);
    await recordPartnerPlatformWork(event);
    const rows = await test.db.select().from(partnerProviderEvents).where(eq(partnerProviderEvents.stripeEventId, event.id));
    expect(rows).toMatchObject([{ eventType: "invoice:invoice.paid", objectId: "in_handoff", status: "pending", environment: "test" }]);
  });

  it("ignores live events on a test deployment and unrelated events", async () => {
    state.deps = partnerTestDeps(test.db).deps;
    const { recordPartnerPlatformWork } = await import("@/lib/partners/presentation/webhooks");
    const live = { id: `evt_${randomUUID()}`, object: "event", type: "charge.refunded", livemode: true, created: 1, data: { object: { object: "charge", id: "ch_live" } } } as unknown as Stripe.Event;
    const other = { id: `evt_${randomUUID()}`, object: "event", type: "customer.created", livemode: false, created: 1, data: { object: { id: "cus_1" } } } as unknown as Stripe.Event;
    await recordPartnerPlatformWork(live);
    await recordPartnerPlatformWork(other);
    expect(await test.db.select().from(partnerProviderEvents).where(eq(partnerProviderEvents.stripeEventId, live.id))).toHaveLength(0);
    expect(await test.db.select().from(partnerProviderEvents).where(eq(partnerProviderEvents.stripeEventId, other.id))).toHaveLength(0);
  });

  it("is part of processStripeEvent, so the recovery job records it too", async () => {
    state.deps = partnerTestDeps(test.db).deps;
    const { processStripeEvent } = await import("@/lib/billing/stripe-events");
    const event = { id: `evt_${randomUUID()}`, object: "event", type: "charge.dispute.created", livemode: false, created: 1790000000, data: { object: { object: "dispute", id: "dp_1", charge: "ch_disputed" } } } as unknown as Stripe.Event;
    await processStripeEvent(event);
    const [row] = await test.db.select().from(partnerProviderEvents).where(eq(partnerProviderEvents.stripeEventId, event.id));
    expect(row).toMatchObject({ eventType: "charge:charge.dispute.created", objectId: "ch_disputed" });
    expect(await test.db.select().from(webhookEvents).where(eq(webhookEvents.id, event.id))).toHaveLength(0);
  });
});
