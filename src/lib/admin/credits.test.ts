import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { addons, adminAuditLog, creditSettings } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";

/** Admin -> Credits: the daily credits, and the price of each action and service (client, 2026-10-26). */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
}));
const guard = vi.hoisted(() => ({ requireAdmin: vi.fn(async () => ({ email: "ops@repget.test" })) }));
vi.mock("@/lib/admin/guard", () => guard);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { getCreditsAdmin, saveCreditSettings } from "@/lib/admin/credits";
import { readCreditSettings } from "@/lib/credits/prices";

let test: TestDb;

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

beforeEach(async () => {
  await test.db.delete(creditSettings);
  await test.db.delete(adminAuditLog);
  await test.db.delete(addons);
  guard.requireAdmin.mockClear();
});

/** The catalogue as it ships: a credit pack, a service and a quote. */
async function catalogue() {
  const rows = await test.db
    .insert(addons)
    .values([
      { slug: "credits_10", name: "100 credits", priceCents: 7900, creditsGranted: 100, kind: "credits", sortOrder: 1 },
      { slug: "usa_local_citations", name: "Top 250 live USA Local Citations", priceCents: 19900, kind: "service", creditPrice: 250, sortOrder: 10 },
      { slug: "audit_fix", name: "We fix the errors for you", priceCents: 14900, kind: "quote", creditPrice: 190, sortOrder: 20 },
    ])
    .returning({ id: addons.id, slug: addons.slug });
  return Object.fromEntries(rows.map((row) => [row.slug, row.id]));
}

describe("credit settings", () => {
  it("save the daily credits and prices, and record who changed what", async () => {
    const result = await saveCreditSettings({ dailyFree: 3, prices: { audit_rerun: 5 } });
    expect(result).toMatchObject({ ok: true, data: { dailyFree: 3, prices: { audit_rerun: 5 }, updatedBy: "ops@repget.test" } });
    expect(await readCreditSettings()).toMatchObject({ dailyFree: 3, prices: { audit_rerun: 5 } });

    const [entry] = await test.db.select().from(adminAuditLog);
    expect(entry).toMatchObject({
      actorEmail: "ops@repget.test",
      action: "credits.settings_saved",
      summary: "Changed credit prices: daily credits 0 -> 3, audit_rerun 0 -> 5",
    });
  });

  it("save the trial's daily credits, and keep them when left out", async () => {
    const result = await saveCreditSettings({ dailyFree: 3, trialDailyFree: 15, prices: {} });
    expect(result).toMatchObject({ ok: true, data: { dailyFree: 3, trialDailyFree: 15 } });
    const [entry] = await test.db.select().from(adminAuditLog);
    expect(entry.summary).toBe("Changed credit prices: daily credits 0 -> 3, trial daily credits 0 -> 15");

    await saveCreditSettings({ dailyFree: 4, prices: {} });
    expect(await readCreditSettings()).toMatchObject({ dailyFree: 4, trialDailyFree: 15 });
  });

  it("change nothing, and log nothing, when nothing changed", async () => {
    const ids = await catalogue();
    await saveCreditSettings({ dailyFree: 2, prices: { audit_rerun: 1 }, addonPrices: { [ids.usa_local_citations]: 250 } });
    await test.db.delete(adminAuditLog);
    expect((await saveCreditSettings({ dailyFree: 2, prices: { audit_rerun: 1 }, addonPrices: { [ids.usa_local_citations]: 250 } })).ok).toBe(true);
    expect(await test.db.select().from(adminAuditLog)).toHaveLength(0);
  });

  it.each([
    [{ dailyFree: -1, prices: {} }, "Daily credits must be a whole number from 0 to 100"],
    [{ dailyFree: 1.5, prices: {} }, "Daily credits must be a whole number from 0 to 100"],
    [{ dailyFree: 101, prices: {} }, "Daily credits must be a whole number from 0 to 100"],
    [{ dailyFree: 0, trialDailyFree: 101, prices: {} }, "Trial daily credits must be a whole number from 0 to 100"],
    [{ dailyFree: 0, trialDailyFree: -1, prices: {} }, "Trial daily credits must be a whole number from 0 to 100"],
    [{ dailyFree: 0, prices: { audit_rerun: 1001 } }, "Prices must be whole numbers from 0 to 1000 credits"],
    [{ dailyFree: 0, prices: { audit_rerun: Number.NaN } }, "Prices must be whole numbers from 0 to 1000 credits"],
    [{ dailyFree: 0, prices: { made_up: 1 } }, "That action no longer exists - reload the page"],
    [{ dailyFree: 0, prices: {}, addonPrices: { "00000000-0000-4000-8000-000000000000": 5 } }, "That service no longer exists - reload the page"],
  ])("refuse %o", async (input, error) => {
    expect(await saveCreditSettings(input)).toEqual({ ok: false, error });
    expect(await test.db.select().from(creditSettings)).toHaveLength(0);
  });

  it("price the services in credits, where 0 takes one off sale, and leave credit packs alone", async () => {
    const ids = await catalogue();
    expect(await saveCreditSettings({ dailyFree: 0, prices: {}, addonPrices: { [ids.credits_10]: 5 } })).toEqual({
      ok: false,
      error: "That service no longer exists - reload the page",
    });
    expect(
      await saveCreditSettings({ dailyFree: 0, prices: {}, addonPrices: { [ids.usa_local_citations]: 1_000_000 } }),
    ).toEqual({ ok: false, error: "Service prices must be whole numbers from 0 to 100,000 credits" });

    const result = await saveCreditSettings({
      dailyFree: 0,
      prices: {},
      addonPrices: { [ids.usa_local_citations]: 300, [ids.audit_fix]: 0 },
    });
    expect(result.ok).toBe(true);
    const prices = Object.fromEntries(
      (await test.db.select({ slug: addons.slug, creditPrice: addons.creditPrice }).from(addons)).map((row) => [row.slug, row.creditPrice]),
    );
    expect(prices).toEqual({ credits_10: null, usa_local_citations: 300, audit_fix: null });
    const [entry] = await test.db.select().from(adminAuditLog).where(eq(adminAuditLog.action, "credits.settings_saved"));
    expect(entry.summary).toBe("Changed credit prices: usa_local_citations 250 -> 300, audit_fix 190 -> not for sale");
  });

  it("are for administrators only", async () => {
    guard.requireAdmin.mockRejectedValueOnce(new Error("not an admin"));
    await expect(saveCreditSettings({ dailyFree: 5, prices: {} })).rejects.toThrow("not an admin");
    guard.requireAdmin.mockRejectedValueOnce(new Error("not an admin"));
    await expect(getCreditsAdmin()).rejects.toThrow("not an admin");
    expect(await test.db.select().from(creditSettings)).toHaveLength(0);
  });

  it("show every action and service, spent or not", async () => {
    await catalogue();
    const admin = await getCreditsAdmin();
    expect(admin.usage).toEqual([
      { action: "audit_rerun", spends: 0, credits: 0 },
      { action: "addon:usa_local_citations", spends: 0, credits: 0 },
      { action: "addon:audit_fix", spends: 0, credits: 0 },
    ]);
    expect(admin.addons.map((addon) => [addon.slug, addon.creditPrice])).toEqual([
      ["usa_local_citations", 250],
      ["audit_fix", 190],
    ]);
  });
});
