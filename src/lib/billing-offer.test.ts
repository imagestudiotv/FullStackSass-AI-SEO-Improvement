import { beforeAll, describe, expect, it, vi } from "vitest";

import { plans } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";

/**
 * The starting price in marketing copy comes from the plans table (client,
 * 2026-10-01: the audit still promised "EUR 1 for the first month" after
 * that offer ended).
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }) }));

import { startingOffer } from "@/lib/billing";
import { FREE_ARTICLES } from "@/lib/plans/features";

let test: TestDb;
beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

const limits = { articleLimit: 30, keywordLimit: 100, siteLimit: 1, monthlyCredits: 10 };

describe("startingOffer", () => {
  it("is the free articles alone while no monthly plan is on sale", async () => {
    expect(await startingOffer()).toEqual({ price: null, freeArticles: FREE_ARTICLES });
  });

  it("is the cheapest ACTIVE MONTHLY plan above zero, priced as the pricing page shows it", async () => {
    await test.db.insert(plans).values([
      { name: "Scale", tier: "scale", interval: "month", priceCents: 29900, sortOrder: 1, ...limits },
      { name: "Growth", tier: "growth", interval: "month", priceCents: 9900, sortOrder: 2, ...limits },
      // Cheaper per row, but not what "a month" means.
      { name: "Growth yearly", tier: "growth", interval: "year", priceCents: 9000, ...limits },
      // The old first-month offer, switched off.
      { name: "Starter", tier: "starter", interval: "month", priceCents: 100, isActive: false, ...limits },
      { name: "Free", tier: "free", interval: "month", priceCents: 0, ...limits },
    ]);
    expect(await startingOffer()).toEqual({ price: "€99", freeArticles: FREE_ARTICLES });
  });
});
