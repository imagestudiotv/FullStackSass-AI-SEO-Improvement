import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";

import {
  partnerAttributions,
  partnerCoupons,
  partnerReviewCases,
  partnerSignupEligibility,
  session,
  websiteInvitations,
  websites,
} from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { partnerTestDeps, seedPartner, seedUser, seedWorkspace, setControl } from "@/test/partners";

/**
 * Part 2: who referred a NEW customer. Eligibility is captured once, at
 * account creation; a valid click locks the founding workspace to its
 * partner; invited team members, existing accounts, extra workspaces,
 * self-referrals, expired or tampered tracking never qualify; a coupon of
 * another partner opens a review case and changes nothing.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
  isDatabaseConfigured: () => true,
}));

import type { CouponRecord } from "../ports/repositories";
import { attributeByCoupon, captureSignupEligibility, eligibilityForOrganization } from "./attribute-new-customer";
import { recordReferralClick } from "./record-referral-click";

let test: TestDb;

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
  await setControl(test.db, "partner_program", true);
});

/** A visitor opens the partner's link; returns the cookie token. */
async function click(env: ReturnType<typeof partnerTestDeps>, code: string) {
  const outcome = await recordReferralClick(env.deps, { code, existingToken: null, landingPath: "/", referrerHost: null, visitor: randomUUID() });
  return outcome.setCookie!.token;
}

/** A brand-new account, created the way Better Auth's hook sees it: the user, then its workspace. */
async function signUp(env: ReturnType<typeof partnerTestDeps>, options: { email?: string; token?: string | null; ip?: string; ua?: string } = {}) {
  const createdAt = env.clock.now();
  const person = await seedUser(test.db, { email: options.email, createdAt });
  const orgId = await seedWorkspace(test.db, person.id, { createdAt });
  const result = await captureSignupEligibility(env.deps, {
    userId: person.id,
    email: person.email,
    createdAt,
    method: "email",
    trackingToken: options.token ?? null,
    ipAddress: options.ip ?? null,
    userAgent: options.ua ?? null,
  });
  return { person, orgId, result };
}

describe("signup attribution", () => {
  it("locks a genuine new signup's founding workspace to the partner whose link was opened", async () => {
    const env = partnerTestDeps(test.db);
    const partner = await seedPartner(test.db);
    const token = await click(env, partner.code);
    env.clock.advance(3 * 24 * 60 * 60 * 1000);
    const { orgId, result } = await signUp(env, { token });
    if (!result.ok) throw new Error(result.reason);
    expect(result.value).toMatchObject({ eligible: true, linkOutcome: "attribute" });
    expect(result.value.attribution).toMatchObject({ organizationId: orgId, partnerId: partner.partnerId, source: "link", status: "active" });
  });

  it("captures eligibility once: a second capture changes nothing", async () => {
    const env = partnerTestDeps(test.db);
    const partner = await seedPartner(test.db);
    const { person, result } = await signUp(env, { token: await click(env, partner.code) });
    expect(result.ok).toBe(true);
    const again = await captureSignupEligibility(env.deps, {
      userId: person.id,
      email: person.email,
      createdAt: env.clock.now(),
      method: "email",
      trackingToken: null,
      ipAddress: null,
      userAgent: null,
    });
    expect(again).toEqual({ ok: false, reason: "already_processed" });
  });

  it("excludes an invited team member, even with a partner cookie and their own empty workspace", async () => {
    const env = partnerTestDeps(test.db);
    const partner = await seedPartner(test.db);
    const owner = await seedUser(test.db);
    const ownerOrg = await seedWorkspace(test.db, owner.id);
    const [site] = await test.db
      .insert(websites)
      .values({ organizationId: ownerOrg, url: "https://client.example", domain: "client.example", status: "ready" })
      .returning({ id: websites.id });
    const email = `invitee-${randomUUID()}@example.test`;
    await test.db.insert(websiteInvitations).values({
      websiteId: site.id,
      email,
      role: "editor",
      tokenHash: randomUUID(),
      expiresAt: new Date("2026-10-08T00:00:00Z"),
    });
    const { result } = await signUp(env, { email, token: await click(env, partner.code) });
    expect(result).toMatchObject({ ok: true, value: { eligible: false, exclusions: ["invited"], attribution: null } });
  });

  it("does not attribute expired or tampered tracking, or a self-referral", async () => {
    const env = partnerTestDeps(test.db);
    const partner = await seedPartner(test.db);
    const token = await click(env, partner.code);

    env.clock.advance(91 * 24 * 60 * 60 * 1000);
    expect((await signUp(env, { token })).result).toMatchObject({ ok: true, value: { eligible: true, linkOutcome: "click_expired", attribution: null } });

    const tampered = `${token.slice(0, 42)}${token.endsWith("A") ? "B" : "A"}`;
    expect((await signUp(env, { token: tampered })).result).toMatchObject({ ok: true, value: { linkOutcome: "no_click", attribution: null } });

    const fresh = await click(env, partner.code);
    expect((await signUp(env, { token: fresh, email: partner.email.toUpperCase() })).result).toMatchObject({
      ok: true,
      value: { linkOutcome: "self_referral", attribution: null },
    });
  });

  it("holds a signup from the partner's own network for review instead of rejecting it", async () => {
    const env = partnerTestDeps(test.db);
    const partner = await seedPartner(test.db);
    await test.db.insert(session).values({
      id: randomUUID(),
      token: randomUUID(),
      userId: partner.userId,
      expiresAt: new Date("2027-01-01T00:00:00Z"),
      ipAddress: "203.0.113.7",
      userAgent: "Mozilla/5.0 Partner",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const { result } = await signUp(env, { token: await click(env, partner.code), ip: "203.0.113.7", ua: "Mozilla/5.0 Partner" });
    if (!result.ok) throw new Error(result.reason);
    expect(result.value.attribution).toMatchObject({ status: "review" });
    const cases = await test.db.select().from(partnerReviewCases).where(eq(partnerReviewCases.attributionId, result.value.attribution!.id));
    expect(cases).toMatchObject([{ kind: "fraud_signal", status: "open" }]);
  });

  it("matches an IPv6 signup against the /64 form Better Auth stores for sessions", async () => {
    const env = partnerTestDeps(test.db);
    const partner = await seedPartner(test.db);
    await test.db.insert(session).values({
      id: randomUUID(),
      token: randomUUID(),
      userId: partner.userId,
      expiresAt: new Date("2027-01-01T00:00:00Z"),
      // As Better Auth stores 2001:db8:763d:a5::1.
      ipAddress: "2001:0db8:763d:00a5:0000:0000:0000:0000",
      userAgent: "Mozilla/5.0 Partner",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    // Another address in the same /64: the same network.
    const { result } = await signUp(env, { token: await click(env, partner.code), ip: "2001:db8:763d:a5:1234::9", ua: "Mozilla/5.0 Other" });
    if (!result.ok) throw new Error(result.reason);
    expect(result.value.attribution).toMatchObject({ status: "review" });
  });

  it("never attributes an existing account or a later workspace of the same person", async () => {
    const env = partnerTestDeps(test.db);
    const partner = await seedPartner(test.db);
    // Signed up without any link.
    const { person, orgId } = await signUp(env);
    expect(await test.db.select().from(partnerAttributions).where(eq(partnerAttributions.organizationId, orgId))).toHaveLength(0);
    // Later the same person clicks a partner link: there is no second capture for an existing account.
    await click(env, partner.code);
    const [record] = await test.db.select().from(partnerSignupEligibility).where(eq(partnerSignupEligibility.userId, person.id));
    expect(record.linkOutcome).toBe("no_click");
    // A second workspace they open later is not their founding one.
    env.clock.advance(5 * 24 * 60 * 60 * 1000);
    const second = await seedWorkspace(test.db, person.id, { createdAt: env.clock.now() });
    const repos = env.deps.uow.repositories;
    expect(await eligibilityForOrganization(env.deps, repos, second)).toBeNull();
  });

  it("completes a link attribution when the workspace was created after signup", async () => {
    const env = partnerTestDeps(test.db);
    const partner = await seedPartner(test.db);
    const token = await click(env, partner.code);
    const createdAt = env.clock.now();
    const person = await seedUser(test.db, { createdAt });
    // The hook could not create the workspace: capture runs with none.
    const capture = await captureSignupEligibility(env.deps, { userId: person.id, email: person.email, createdAt, method: "google", trackingToken: token, ipAddress: null, userAgent: null });
    expect(capture).toMatchObject({ ok: true, value: { attribution: null, linkOutcome: "attribute" } });
    // The app creates it on the next request.
    const orgId = await seedWorkspace(test.db, person.id, { createdAt: new Date(createdAt.getTime() + 5_000) });
    await env.deps.uow.transaction((repos) => eligibilityForOrganization(env.deps, repos, orgId));
    const [attribution] = await test.db.select().from(partnerAttributions).where(eq(partnerAttributions.organizationId, orgId));
    expect(attribution).toMatchObject({ partnerId: partner.partnerId, source: "link" });
  });

  it("never lets a later link replace a locked attribution", async () => {
    const env = partnerTestDeps(test.db);
    const first = await seedPartner(test.db);
    const second = await seedPartner(test.db);
    const { orgId, result } = await signUp(env, { token: await click(env, first.code) });
    if (!result.ok) throw new Error(result.reason);
    await env.deps.uow.transaction((repos) =>
      repos.attributions.createOrGet({
        organizationId: orgId,
        foundingUserId: "someone",
        partnerId: second.partnerId,
        source: "link",
        clickId: null,
        couponId: null,
        status: "active",
        lockedAt: new Date(),
        ruleVersion: 1,
        reviewReason: null,
        fraudSignals: {},
      }),
    );
    const [attribution] = await test.db.select().from(partnerAttributions).where(eq(partnerAttributions.organizationId, orgId));
    expect(attribution.partnerId).toBe(first.partnerId);
  });
});

describe("coupon attribution", () => {
  async function coupon(partnerId: string): Promise<CouponRecord> {
    const [row] = await test.db
      .insert(partnerCoupons)
      .values({
        environment: "test",
        partnerId,
        code: `SAVE${randomUUID().slice(0, 6).toUpperCase()}`,
        campaign: "Launch",
        discountType: "percent_first_payment",
        percentOffBasisPoints: 1000,
        duration: "once",
        createdByEmail: "admin@repget.test",
        status: "active",
        stripeCouponId: `co_${randomUUID()}`,
        stripePromotionCodeId: `promo_${randomUUID()}`,
      })
      .returning();
    return {
      ...row,
      environment: "test",
      duration: "once",
      appliesToProducts: [],
      status: "active",
    } as CouponRecord;
  }

  it("attributes an eligible, unattributed first payment to the coupon's partner", async () => {
    const env = partnerTestDeps(test.db);
    const partner = await seedPartner(test.db);
    const { orgId } = await signUp(env);
    env.clock.advance(10 * 24 * 60 * 60 * 1000);
    const realCoupon = await coupon(partner.partnerId);
    const result = await env.deps.uow.transaction((repos) =>
      attributeByCoupon(env.deps, repos, { organizationId: orgId, coupon: realCoupon, paidAt: env.clock.now(), priorPayment: false, paymentReference: "inpay_1" }),
    );
    expect(result.decision).toMatchObject({ outcome: "attribute", partnerId: partner.partnerId });
    expect(result.attribution).toMatchObject({ source: "coupon", couponId: realCoupon.id });
  });

  it("opens a review case for another partner's coupon and keeps the original partner", async () => {
    const env = partnerTestDeps(test.db);
    const original = await seedPartner(test.db);
    const other = await seedPartner(test.db);
    const { orgId } = await signUp(env, { token: await click(env, original.code) });
    const otherCoupon = await coupon(other.partnerId);
    const result = await env.deps.uow.transaction((repos) =>
      attributeByCoupon(env.deps, repos, { organizationId: orgId, coupon: otherCoupon, paidAt: env.clock.now(), priorPayment: false, paymentReference: "inpay_2" }),
    );
    expect(result.decision.outcome).toBe("conflict");
    expect(result.attribution?.partnerId).toBe(original.partnerId);
    const cases = await test.db.select().from(partnerReviewCases).where(eq(partnerReviewCases.organizationId, orgId));
    expect(cases).toMatchObject([{ kind: "coupon_conflict", status: "open" }]);
  });

  it("does not attribute after a prior payment, after 90 days, or without signup eligibility", async () => {
    const env = partnerTestDeps(test.db);
    const partner = await seedPartner(test.db);
    const c = await coupon(partner.partnerId);
    const { orgId } = await signUp(env);
    const run = (input: { paidAt: Date; priorPayment: boolean; organizationId?: string }) =>
      env.deps.uow.transaction((repos) =>
        attributeByCoupon(env.deps, repos, { organizationId: input.organizationId ?? orgId, coupon: c, paidAt: input.paidAt, priorPayment: input.priorPayment, paymentReference: "x" }),
      );
    expect((await run({ paidAt: env.clock.now(), priorPayment: true })).decision).toMatchObject({ reason: "existing_customer" });
    expect((await run({ paidAt: new Date(env.clock.now().getTime() + 90 * 24 * 60 * 60 * 1000), priorPayment: false })).decision).toMatchObject({
      reason: "coupon_window_expired",
    });
    // An account that existed before the program captured anything has no eligibility.
    const existing = await seedUser(test.db);
    const existingOrg = await seedWorkspace(test.db, existing.id);
    expect((await run({ paidAt: env.clock.now(), priorPayment: false, organizationId: existingOrg })).decision).toMatchObject({ reason: "not_eligible" });
  });
});
