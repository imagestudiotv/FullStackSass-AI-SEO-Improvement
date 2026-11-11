import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { billingCheckouts, creditLedger, lifecycleEmails, member, organization, plans, user, websites } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";

/**
 * The win-back offer's 100 credits (lib/billing/winback.ts): added once, when a
 * plan restarted WITH the win-back discount has its first payment for money -
 * however often, and however simultaneously, the webhook delivers it.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }) }));

import { winbackOfferState } from "@/lib/billing/checkouts";
import { grantWinbackBonus, winbackBonusKey } from "@/lib/billing/winback";
import { WINBACK_BONUS_CREDITS } from "@/lib/billing/winback-offer";

let test: TestDb;
let siteId: string;
let planId: string;

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

beforeEach(async () => {
  await test.client.exec(`
    delete from credit_ledger;
    delete from billing_checkouts;
    delete from lifecycle_emails;
    delete from websites;
    delete from member;
    delete from "user";
    delete from organization;
    delete from plans;
  `);
  await test.db.insert(organization).values({ id: "org_a", name: "A", slug: "a", createdAt: new Date() });
  await test.db.insert(user).values({ id: "user_1", name: "Ada", email: "ada@example.test", emailVerified: true, createdAt: new Date(), updatedAt: new Date() });
  await test.db.insert(member).values({ id: "m1", organizationId: "org_a", userId: "user_1", role: "owner", createdAt: new Date() });
  // Sent now, by the app clock (lifecycle.ts settle() writes updatedAt so).
  await test.db.insert(lifecycleEmails).values({ scope: "user:user_1", kind: "winback", dedupeKey: "winback", userId: "user_1", status: "sent", updatedAt: new Date() });
  const [plan] = await test.db
    .insert(plans)
    .values({ name: "Grow", tier: "grow", priceCents: 14900, articleLimit: 60, keywordLimit: 500, siteLimit: 1, monthlyCredits: 0 })
    .returning();
  planId = plan.id;
  const [site] = await test.db.insert(websites).values({ organizationId: "org_a", url: "https://a.test", domain: "a.test" }).returning();
  siteId = site.id;
});

/** A completed checkout; by default made a second after the win-back email. */
const checkout = (providerSubscriptionId: string, offer: string | null, provider = "stripe", createdAt = new Date(Date.now() + 1000)) =>
  test.db.insert(billingCheckouts).values({
    organizationId: "org_a",
    websiteId: siteId,
    provider,
    planId,
    status: "completed",
    trialDays: 0,
    providerSubscriptionId,
    requestParams: offer ? { offer } : {},
    createdAt,
  });

const ledger = () => test.db.select().from(creditLedger).where(eq(creditLedger.organizationId, "org_a"));

describe("the win-back credits", () => {
  it("are added once on the first payment, however many deliveries arrive at the same moment", async () => {
    await checkout("sub_w", "WINBACK");
    const payment = { provider: "stripe" as const, providerSubscriptionId: "sub_w", amountCents: 11920 };
    const outcomes = await Promise.all(Array.from({ length: 5 }, () => grantWinbackBonus(payment)));
    expect(outcomes.filter((o) => o.status === "granted")).toHaveLength(1);
    expect(outcomes.filter((o) => o.status === "already_granted")).toHaveLength(4);
    // A retried webhook, and the next month's renewal: nothing more.
    expect(await grantWinbackBonus(payment)).toEqual({ status: "already_granted", userId: "user_1" });
    expect(await grantWinbackBonus({ ...payment, amountCents: 14900 })).toEqual({ status: "already_granted", userId: "user_1" });
    const rows = await ledger();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ amount: WINBACK_BONUS_CREDITS, type: "reward", idempotencyKey: winbackBonusKey("user_1") });
  });

  it("by PayPal the same", async () => {
    await checkout("I-WINBACK", "WINBACK", "paypal");
    expect((await grantWinbackBonus({ provider: "paypal", providerSubscriptionId: "I-WINBACK", amountCents: 11920 })).status).toBe("granted");
    expect(await ledger()).toHaveLength(1);
  });

  it("once per person: a second win-back subscription of the same person gets none", async () => {
    await checkout("sub_w", "WINBACK");
    await checkout("sub_w2", "WINBACK");
    expect((await grantWinbackBonus({ provider: "stripe", providerSubscriptionId: "sub_w", amountCents: 11920 })).status).toBe("granted");
    expect((await grantWinbackBonus({ provider: "stripe", providerSubscriptionId: "sub_w2", amountCents: 11920 })).status).toBe("already_granted");
    expect(await ledger()).toHaveLength(1);
  });

  it("REPGET won at checkout (lead's decision): the promised credits still come, once, and the win-back is then used", async () => {
    await checkout("sub_repget", "REPGET");
    expect(await winbackOfferState(test.db, "org_a")).toBe("used");
    const payment = { provider: "stripe" as const, providerSubscriptionId: "sub_repget", amountCents: 8940 };
    const outcomes = await Promise.all(Array.from({ length: 5 }, () => grantWinbackBonus(payment)));
    expect(outcomes.filter((o) => o.status === "granted")).toHaveLength(1);
    expect(await grantWinbackBonus(payment)).toEqual({ status: "already_granted", userId: "user_1" });
    const rows = await ledger();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ amount: WINBACK_BONUS_CREDITS, idempotencyKey: winbackBonusKey("user_1") });
  });

  it("a REPGET plan from before the email is not a win-back, and leaves the offer open", async () => {
    await checkout("sub_old", "REPGET", "stripe", new Date(Date.now() - 30 * 86_400_000));
    expect(await grantWinbackBonus({ provider: "stripe", providerSubscriptionId: "sub_old", amountCents: 8940 })).toEqual({ status: "skipped", reason: "not_winback" });
    expect(await winbackOfferState(test.db, "org_a")).toBe("available");
    expect(await ledger()).toHaveLength(0);
  });

  it("nothing for a zero payment, a plain checkout, an unfinished checkout, someone never emailed, or the wrong provider", async () => {
    await checkout("sub_w", "WINBACK");
    await checkout("sub_plain", null);
    await test.db.insert(billingCheckouts).values({ organizationId: "org_a", websiteId: siteId, provider: "stripe", planId, status: "open", trialDays: 0, providerSubscriptionId: "sub_open", requestParams: { offer: "WINBACK" }, createdAt: new Date() });
    expect(await grantWinbackBonus({ provider: "stripe", providerSubscriptionId: "sub_w", amountCents: 0 })).toEqual({ status: "skipped", reason: "no_money" });
    for (const id of ["sub_plain", "sub_open", "sub_unknown"]) {
      expect(await grantWinbackBonus({ provider: "stripe", providerSubscriptionId: id, amountCents: 14900 })).toEqual({ status: "skipped", reason: "not_winback" });
    }
    expect(await grantWinbackBonus({ provider: "paypal", providerSubscriptionId: "sub_w", amountCents: 11920 })).toEqual({ status: "skipped", reason: "not_winback" });
    await test.client.exec(`update lifecycle_emails set status = 'skipped';`);
    await checkout("sub_repget", "REPGET");
    expect(await grantWinbackBonus({ provider: "stripe", providerSubscriptionId: "sub_repget", amountCents: 8940 })).toEqual({ status: "skipped", reason: "no_recipient" });
    expect(await ledger()).toHaveLength(0);
  });
});
