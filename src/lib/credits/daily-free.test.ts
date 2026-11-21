import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { user } from "@/lib/db/auth-tables";
import { creditSettings, freePlanAccounts } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { seedWebsite } from "@/test/fixtures";

/**
 * Daily check-in credits on the Free plan (client, 2026-11-20: "maybe 1 credit
 * daily for free users"): every UTC day, at the Free plan's own amount (1 until
 * an administrator sets another), while a paid plan keeps its own.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }) }));
vi.mock("server-only", () => ({}));

import { claimDailyCredits, readDailyStatus } from "./daily";

const NOW = new Date("2026-11-20T10:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
let test: TestDb;

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

beforeEach(async () => {
  await test.db.delete(creditSettings);
  await test.db.insert(creditSettings).values({ key: "daily_free", value: 3 });
});

/** A workspace on the Free plan: no subscription, a Free account for its website. */
async function freeWorkspace() {
  const site = await seedWebsite(test, { status: null });
  const userId = `user_${site.orgId}`;
  await test.db.insert(user).values({ id: userId, name: "Free owner", email: `${userId}@example.test`, emailVerified: true, createdAt: NOW, updatedAt: NOW });
  await test.db.insert(freePlanAccounts).values({
    organizationId: site.orgId,
    websiteId: site.websiteId,
    domain: `${site.orgId}.example`,
    userId,
  });
  return site.orgId;
}

describe("daily credits on the Free plan", () => {
  it("gives 1 credit a day by default, once a day, and again the next day", async () => {
    const orgId = await freeWorkspace();
    const status = await readDailyStatus(orgId, NOW);
    expect(status).toMatchObject({ plan: "free", eligible: true, perDay: 1, claimable: true });

    expect(await claimDailyCredits(orgId, NOW)).toMatchObject({ outcome: "claimed", amount: 1 });
    expect(await claimDailyCredits(orgId, NOW)).toMatchObject({ outcome: "already_claimed", amount: 1 });
    expect(await claimDailyCredits(orgId, new Date(NOW.getTime() + DAY))).toMatchObject({ outcome: "claimed", amount: 1 });
  });

  it("uses the administrator's Free amount, and 0 turns it off", async () => {
    const orgId = await freeWorkspace();
    await test.db.insert(creditSettings).values({ key: "free_daily_free", value: 2 });
    expect((await readDailyStatus(orgId, NOW)).perDay).toBe(2);

    await test.db.delete(creditSettings);
    await test.db.insert(creditSettings).values({ key: "free_daily_free", value: 0 });
    expect(await claimDailyCredits(orgId, NOW)).toMatchObject({ outcome: "not_eligible", amount: 0 });
    expect((await readDailyStatus(orgId, NOW)).claimable).toBe(false);
  });

  it("leaves a paid plan on its own amount, and a workspace with no plan with none", async () => {
    const paid = await seedWebsite(test);
    expect(await readDailyStatus(paid.orgId, NOW)).toMatchObject({ plan: "paid", perDay: 3 });

    const none = await seedWebsite(test, { status: null });
    expect(await readDailyStatus(none.orgId, NOW)).toMatchObject({ plan: "none", eligible: false });
  });
});
