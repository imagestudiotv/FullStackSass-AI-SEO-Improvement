import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestDb, type TestDb } from "@/test/db";

/**
 * Who a claim is for, through the REAL tenant guard: only the session and the
 * membership row decide. The daily.concurrency test mocks requireOrg to race the
 * ledger; this one mocks only the session, so a session naming someone else's
 * workspace meets the code that production runs.
 */

const state = vi.hoisted(() => ({ db: null as unknown, session: null as unknown }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }) }));
vi.mock("@/lib/auth-guard", () => ({ getSession: async () => state.session }));
vi.mock("@/lib/auth", () => ({
  ensureOrganization: async () => {
    throw new Error("ensureOrganization should not be reached");
  },
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
  notFound: () => {
    throw new Error("notFound");
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { claimDailyCreditsAction } from "@/lib/credits/daily-actions";
import { creditLedger, creditSettings, member, organization, plans, subscriptions, user, websiteMembers, websites } from "@/lib/db/schema";

let test: TestDb;

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

beforeEach(async () => {
  state.session = null;
  await test.db.delete(creditSettings);
  await test.db.insert(creditSettings).values({ key: "daily_free", value: 3 });
});

/** A paying workspace (or a free one) with its owner, who is a member of nothing else. */
async function workspace(paying = true) {
  const now = new Date();
  const id = randomUUID().slice(0, 8);
  const orgId = `org_${id}`;
  const userId = `user_${id}`;
  await test.db.insert(organization).values({ id: orgId, name: id, slug: orgId, createdAt: now });
  await test.db.insert(user).values({ id: userId, name: id, email: `${id}@example.com`, createdAt: now, updatedAt: now });
  await test.db.insert(member).values({ id: `m_${id}`, organizationId: orgId, userId, role: "owner", createdAt: now });
  const [site] = await test.db.insert(websites).values({ organizationId: orgId, domain: `${id}.example`, url: `https://${id}.example` }).returning({ id: websites.id });
  if (paying) {
    const [plan] = await test.db
      .insert(plans)
      .values({ name: "Plan", tier: `tier_${id}`, priceCents: 1000, articleLimit: 10, keywordLimit: 100, siteLimit: 1, monthlyCredits: 0 })
      .returning({ id: plans.id });
    await test.db.insert(subscriptions).values({ organizationId: orgId, websiteId: site.id, planId: plan.id, status: "active", currentPeriodStart: new Date(now.getTime() - 86_400_000) });
  }
  return { orgId, userId, siteId: site.id };
}

function signIn(userId: string, activeOrganizationId: string | null) {
  state.session = { user: { id: userId }, session: { id: `sess_${userId}`, activeOrganizationId } };
}

const dailyRows = async (orgId: string) => (await test.db.select().from(creditLedger).where(eq(creditLedger.organizationId, orgId))).filter((row) => row.type === "daily_grant");

describe("who a claim is for", () => {
  it("without a session: no claim, nothing written", async () => {
    const paying = await workspace();
    await expect(claimDailyCreditsAction()).rejects.toThrow("redirect:/sign-in");
    expect(await dailyRows(paying.orgId)).toEqual([]);
  });

  it("a member claims for their own workspace", async () => {
    const own = await workspace();
    signIn(own.userId, own.orgId);
    expect(await claimDailyCreditsAction()).toMatchObject({ outcome: "claimed", amount: 3 });
    expect(await dailyRows(own.orgId)).toHaveLength(1);
  });

  it("a session naming a workspace the user is not in cannot claim for it", async () => {
    const own = await workspace(false);
    const victim = await workspace();
    signIn(own.userId, victim.orgId);
    // The membership row decides: this user's own, free workspace answers, and the victim is untouched.
    expect(await claimDailyCreditsAction()).toMatchObject({ outcome: "not_eligible" });
    expect(await dailyRows(victim.orgId)).toEqual([]);
    expect(await dailyRows(own.orgId)).toEqual([]);
  });

  it("arguments a client sends change nothing", async () => {
    const own = await workspace();
    const victim = await workspace();
    signIn(own.userId, own.orgId);
    const forge = claimDailyCreditsAction as unknown as (input: unknown) => ReturnType<typeof claimDailyCreditsAction>;
    await forge({ organizationId: victim.orgId, orgId: victim.orgId, activeOrganizationId: victim.orgId });
    expect(await dailyRows(victim.orgId)).toEqual([]);
    expect(await dailyRows(own.orgId)).toHaveLength(1);
  });

  it("an editor invited to someone's website cannot claim the owner's credits", async () => {
    const owner = await workspace();
    const editor = await workspace(false);
    await test.db.insert(websiteMembers).values({ websiteId: owner.siteId, userId: editor.userId, role: "editor" });
    signIn(editor.userId, editor.orgId);
    expect(await claimDailyCreditsAction()).toMatchObject({ outcome: "not_eligible" });
    expect(await dailyRows(owner.orgId)).toEqual([]);
  });
});
