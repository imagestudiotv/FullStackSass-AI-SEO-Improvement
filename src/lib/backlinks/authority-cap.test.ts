import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { agencyWorkspaces, networkSites, plans, subscriptions, websites } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { seedWebsite } from "@/test/fixtures";

/**
 * Minimum Domain Authority by plan (client, 2026-10-02): up to 60 on the
 * standard plans, higher only on Scale.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }) }));
async function contextFor(websiteId: string) {
  const db = state.db as TestDb["db"];
  const [site] = await db.select().from(websites).where(eq(websites.id, websiteId));
  return { site, orgId: site.organizationId, userId: "owner", access: "owner" as const };
}
vi.mock("@/lib/tenant", () => ({ requireWebsite: vi.fn(contextFor) }));
vi.mock("@/lib/websites/require-editor", () => ({
  requireEditor: vi.fn(async (id: string) => ({ ok: true, context: await contextFor(id) })),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/providers/dataforseo", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/providers/dataforseo")>()),
  isDataForSeoConfigured: () => true,
}));

import { effectiveMinSourceRank, minRankCap, minRankCapFor, STANDARD_MIN_RANK_CAP } from "@/lib/backlinks/authority-cap";
import { getPartnerNetwork, setMinSourceRank } from "@/lib/backlinks/network-settings";

let test: TestDb;
beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

/** One plan row per tier (plans are unique per tier and interval). */
const planIds = new Map<string, string>();
async function planFor(tier: string) {
  if (!planIds.has(tier)) {
    const [plan] = await test.db
      .insert(plans)
      .values({ name: tier, tier, priceCents: 9900, articleLimit: 30, keywordLimit: 100, siteLimit: 1, monthlyCredits: 0 })
      .returning({ id: plans.id });
    planIds.set(tier, plan.id);
  }
  return planIds.get(tier)!;
}
/** A website whose own subscription is on `tier`. */
async function onTier(tier: string, status = "active") {
  const { orgId, websiteId } = await seedWebsite(test, { status });
  await moveTo(websiteId, tier);
  return { orgId, websiteId };
}
async function moveTo(websiteId: string, tier: string) {
  await test.db.update(subscriptions).set({ planId: await planFor(tier) }).where(eq(subscriptions.websiteId, websiteId));
}

describe("the cap", () => {
  it("is 60 on every plan but Scale, and the full 100 on Scale and for our agency workspaces", () => {
    expect(STANDARD_MIN_RANK_CAP).toBe(60);
    expect(minRankCap("starter", false)).toBe(60);
    expect(minRankCap("grow", false)).toBe(60);
    expect(minRankCap(null, false)).toBe(60);
    expect(minRankCap("scale", false)).toBe(100);
    expect(minRankCap(null, true)).toBe(100);
  });

  it("holds a stored minimum to it, and leaves no minimum alone", () => {
    expect(effectiveMinSourceRank(80, 60)).toBe(60);
    expect(effectiveMinSourceRank(40, 60)).toBe(40);
    expect(effectiveMinSourceRank(80, 100)).toBe(80);
    expect(effectiveMinSourceRank(null, 60)).toBeNull();
  });

  it("is read from the website's own plan, and only while it is paid for", async () => {
    expect(await minRankCapFor((await onTier("grow")).websiteId)).toBe(60);
    expect(await minRankCapFor((await onTier("scale")).websiteId)).toBe(100);
    expect(await minRankCapFor((await onTier("scale", "trialing")).websiteId)).toBe(100);
    expect(await minRankCapFor((await onTier("scale", "canceled")).websiteId)).toBe(60);
    const { orgId, websiteId } = await onTier("grow");
    await test.db.insert(agencyWorkspaces).values({ organizationId: orgId, articleLimit: 10, keywordLimit: 10, siteLimit: 1 });
    expect(await minRankCapFor(websiteId)).toBe(100);
  });
});

describe("saving and showing the minimum", () => {
  it("refuses a minimum above 60 on a standard plan, with what to do about it", async () => {
    const { websiteId } = await onTier("grow");
    expect(await setMinSourceRank(websiteId, 60)).toEqual({ ok: true, data: { minSourceRank: 60 } });
    const refused = await setMinSourceRank(websiteId, 65);
    expect(refused).toMatchObject({ ok: false, error: expect.stringContaining("Scale plan") });
    expect(await getPartnerNetwork(websiteId)).toMatchObject({ minSourceRank: 60, maxMinSourceRank: 60 });
  });

  it("allows up to 100 on Scale", async () => {
    const { websiteId } = await onTier("scale");
    expect(await setMinSourceRank(websiteId, 85)).toEqual({ ok: true, data: { minSourceRank: 85 } });
    expect(await getPartnerNetwork(websiteId)).toMatchObject({ minSourceRank: 85, maxMinSourceRank: 100 });
  });

  it("a minimum saved on Scale counts as 60 after a downgrade, without being deleted", async () => {
    const { websiteId } = await onTier("scale");
    await setMinSourceRank(websiteId, 90);
    await moveTo(websiteId, "grow");
    expect(await getPartnerNetwork(websiteId)).toMatchObject({ minSourceRank: 60, maxMinSourceRank: 60 });
    const [row] = await test.db.select({ min: networkSites.minSourceRank }).from(networkSites).where(eq(networkSites.websiteId, websiteId));
    expect(row.min).toBe(90);
  });
});
