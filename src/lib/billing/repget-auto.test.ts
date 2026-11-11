import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { automaticRepgetCoupon, repgetOfferState } from "@/lib/billing/checkouts";
import { billingCheckouts, member, organization, plans, user, websites } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";

/**
 * Whether the REPGET discount still goes on a checkout by itself (2026-11-11):
 * one use per USER ACCOUNT, across every workspace it owns, on the plans and
 * intervals it covers, while the offer is on. beginCheckout decides it again
 * under a lock (checkouts.test.ts, repget-offer.concurrency.test.ts).
 */

let test: TestDb;
let planId: string;
let siteA: string;

const grow = { tier: "grow", interval: "month", currency: "eur", priceCents: 14900 };

beforeAll(async () => {
  test = await createTestDb();
});

beforeEach(async () => {
  process.env.REPGET_OFFER_ENABLED = "1";
  await test.client.exec(`
    delete from billing_checkouts;
    delete from websites;
    delete from member;
    delete from "user";
    delete from organization;
    delete from plans;
  `);
  await test.db.insert(organization).values([
    { id: "org_a", name: "A", slug: "a", createdAt: new Date() },
    { id: "org_b", name: "B", slug: "b", createdAt: new Date() },
    { id: "org_c", name: "C", slug: "c", createdAt: new Date() },
  ]);
  await test.db.insert(user).values(
    ["user_1", "user_2"].map((id) => ({ id, name: id, email: `${id}@example.test`, emailVerified: true, createdAt: new Date(), updatedAt: new Date() })),
  );
  // One account owns A and B; another owns C.
  await test.db.insert(member).values([
    { id: "m1", organizationId: "org_a", userId: "user_1", role: "owner", createdAt: new Date() },
    { id: "m2", organizationId: "org_b", userId: "user_1", role: "owner", createdAt: new Date() },
    { id: "m3", organizationId: "org_c", userId: "user_2", role: "owner", createdAt: new Date() },
  ]);
  const [plan] = await test.db
    .insert(plans)
    .values({ name: "Grow", tier: "grow", priceCents: 14900, articleLimit: 60, keywordLimit: 500, siteLimit: 3, monthlyCredits: 250 })
    .returning();
  planId = plan.id;
  const [site] = await test.db.insert(websites).values({ organizationId: "org_a", url: "https://a.test", domain: "a.test" }).returning();
  siteA = site.id;
});

afterEach(() => {
  delete process.env.REPGET_OFFER_ENABLED;
});

const took = (status: string, offer: string | null = "REPGET") =>
  test.db.insert(billingCheckouts).values({ organizationId: "org_a", websiteId: siteA, provider: "stripe", planId, status, trialDays: 0, requestParams: offer ? { offer } : {}, createdAt: new Date() });

describe("where an account stands with REPGET", () => {
  it("never used: available, and the plan's coupon goes on by itself", async () => {
    expect(await repgetOfferState(test.db, "org_a")).toBe("available");
    expect(await automaticRepgetCoupon(test.db, "org_a", grow)).toBe("GROW40");
    expect(await automaticRepgetCoupon(test.db, "org_a", { ...grow, interval: "year", priceCents: 149000 })).toBe("GROW40Y");
  });

  it("a completed checkout used it: in that workspace and the account's other one, but not another account's", async () => {
    await took("completed");
    expect(await repgetOfferState(test.db, "org_a")).toBe("used");
    expect(await repgetOfferState(test.db, "org_b")).toBe("used");
    expect(await automaticRepgetCoupon(test.db, "org_b", grow)).toBeNull();
    expect(await repgetOfferState(test.db, "org_c")).toBe("available");
    expect(await automaticRepgetCoupon(test.db, "org_c", grow)).toBe("GROW40");
  });

  it("an open or unknown one holds it: still the account's, so still offered (beginCheckout refuses a second one)", async () => {
    await took("open");
    expect(await repgetOfferState(test.db, "org_b")).toBe("held");
    expect(await automaticRepgetCoupon(test.db, "org_b", grow)).toBe("GROW40");
  });

  it("expired, failed, or a checkout without the offer: given back, or never taken", async () => {
    await took("expired");
    await took("failed");
    await took("completed", null);
    expect(await repgetOfferState(test.db, "org_a")).toBe("available");
  });

  it("not on a plan it does not cover (the Grow + Visibility bundle, an older price), nor while switched off", async () => {
    expect(await automaticRepgetCoupon(test.db, "org_a", { ...grow, tier: "grow_visibility", priceCents: 9900 })).toBeNull();
    expect(await automaticRepgetCoupon(test.db, "org_a", { ...grow, priceCents: 9900 })).toBeNull();
    delete process.env.REPGET_OFFER_ENABLED;
    expect(await automaticRepgetCoupon(test.db, "org_a", grow)).toBeNull();
  });
});
