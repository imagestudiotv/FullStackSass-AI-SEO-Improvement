import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { addonPurchases, addons, creditLedger, creditSpends } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { seedWebsite } from "@/test/fixtures";

/**
 * Services are bought with credits, and only credit packs by card (client,
 * 2026-10-26: "everything can be purchased by credits now ... All this will
 * still exists but will be possible to purchase and use with credits").
 */

const state = vi.hoisted(() => ({ db: null as unknown, orgId: "", guest: false }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
}));
vi.mock("@/lib/tenant", () => ({ requireOrg: vi.fn(async () => ({ orgId: state.orgId, userId: "user_1", role: "owner" })) }));
vi.mock("@/lib/websites/accessible", () => ({ hasOnlySharedWork: vi.fn(async () => state.guest) }));
vi.mock("@/lib/i18n/app-locale", async () => {
  const { getMessages } = await import("@/lib/i18n/messages");
  return { getAppMessages: async () => ({ t: getMessages("de"), locale: "de" }) };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const notifications = vi.hoisted(() => ({ notify: vi.fn() }));
vi.mock("@/lib/notifications/create", () => notifications);
const ordered = vi.hoisted(() => ({ emailServiceOrdered: vi.fn(async () => ({ sent: 1 })) }));
vi.mock("@/lib/addons/notify", () => ordered);
vi.mock("@/lib/stripe/client", () => ({ isStripeConfigured: () => true, stripe: {} }));
vi.mock("@/lib/stripe/customer", () => ({ getOrCreateCustomer: vi.fn(async () => "cus_test") }));

import { recordCredit } from "@/lib/backlinks/credits";

import { buyAddon, buyAddonWithCredits, listAddons, listPurchases } from "./actions";

let test: TestDb;
let ids: Record<string, string>;

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
  const rows = await test.db
    .insert(addons)
    .values([
      { slug: "credits_10", name: "100 credits", priceCents: 7900, creditsGranted: 100, kind: "credits", stripePriceId: "price_pack", sortOrder: 1 },
      // Still carrying the card price it was sold with before; it must not be used.
      { slug: "usa_local_citations", name: "Top 250 live USA Local Citations", priceCents: 19900, kind: "service", creditPrice: 250, stripePriceId: "price_old", sortOrder: 10 },
      { slug: "audit_fix", name: "We fix the errors for you", priceCents: 14900, kind: "quote", creditPrice: 190, sortOrder: 20 },
      { slug: "off_sale", name: "Something not for sale", priceCents: 1000, kind: "service", sortOrder: 30 },
    ])
    .returning({ id: addons.id, slug: addons.slug });
  ids = Object.fromEntries(rows.map((row) => [row.slug, row.id]));
});

beforeEach(async () => {
  const { orgId } = await seedWebsite(test);
  state.orgId = orgId;
  state.guest = false;
  notifications.notify.mockClear();
  ordered.emailServiceOrdered.mockClear();
});

async function give(amount: number) {
  await recordCredit(state.orgId, { type: "purchase", amount, idempotencyKey: `test:${randomUUID()}` });
}

async function balance() {
  const rows = await test.db.select({ amount: creditLedger.amount }).from(creditLedger).where(eq(creditLedger.organizationId, state.orgId));
  return rows.reduce((sum, row) => sum + row.amount, 0);
}

describe("buying a service with credits", () => {
  it("takes its price, records the purchase, and tells the customer and the administrators", async () => {
    await give(300);
    expect(await buyAddonWithCredits(ids.usa_local_citations)).toEqual({ ok: true, credits: 250 });
    expect(await balance()).toBe(50);

    const [purchase] = await test.db.select().from(addonPurchases).where(eq(addonPurchases.organizationId, state.orgId));
    expect(purchase).toMatchObject({ addonId: ids.usa_local_citations, stripeSessionId: null, creditsPaid: 250, pricePaidCents: 0, status: "paid" });
    const [spend] = await test.db.select().from(creditSpends).where(eq(creditSpends.organizationId, state.orgId));
    expect(spend).toMatchObject({ action: "addon:usa_local_citations", credits: 250, idempotencyKey: `addon:${purchase.id}` });
    expect(notifications.notify).toHaveBeenCalledWith(expect.objectContaining({ organizationId: state.orgId, title: "Top 250 live USA Local Citations - order received" }));
    expect(ordered.emailServiceOrdered).toHaveBeenCalledWith({ organizationId: state.orgId, service: "Top 250 live USA Local Citations", credits: 250 });

    // Billing lists it, paid in credits.
    expect(await listPurchases()).toEqual([expect.objectContaining({ name: "Top 250 live USA Local Citations", creditsPaid: 250, status: "paid" })]);
  });

  it("can be bought again: each click is its own purchase", async () => {
    await give(500);
    expect((await buyAddonWithCredits(ids.usa_local_citations)).ok).toBe(true);
    expect((await buyAddonWithCredits(ids.usa_local_citations)).ok).toBe(true);
    expect(await balance()).toBe(0);
    expect(await test.db.select().from(addonPurchases).where(eq(addonPurchases.organizationId, state.orgId))).toHaveLength(2);
  });

  it("refuses, in the reader's language, and writes nothing, when the credits do not cover it", async () => {
    await give(100);
    expect(await buyAddonWithCredits(ids.usa_local_citations)).toEqual({
      ok: false,
      needsCredits: true,
      error: "Das kostet 250 Credits, und Sie haben 100. Kaufen Sie Credits, um fortzufahren.",
    });
    expect(await balance()).toBe(100);
    expect(await test.db.select().from(addonPurchases).where(eq(addonPurchases.organizationId, state.orgId))).toHaveLength(0);
    expect(ordered.emailServiceOrdered).not.toHaveBeenCalled();
  });

  it.each(["credits_10", "audit_fix", "off_sale"])("does not sell %s for credits", async (slug) => {
    await give(1000);
    expect(await buyAddonWithCredits(ids[slug])).toEqual({ ok: false, error: "Nicht verfügbar" });
    expect(await balance()).toBe(1000);
  });

  it("is refused to someone here only for another workspace's website", async () => {
    state.guest = true;
    await give(1000);
    expect(await buyAddonWithCredits(ids.usa_local_citations)).toMatchObject({ ok: false });
    expect(await balance()).toBe(1000);
  });
});

describe("card checkout", () => {
  it("is for credit packs only", async () => {
    expect(await buyAddon(ids.usa_local_citations)).toEqual({ error: '"Top 250 live USA Local Citations" is bought with credits' });
    expect(await buyAddon(ids.audit_fix)).toEqual({ error: '"We fix the errors for you" is bought with credits' });
  });

  it("lists each service's price in credits", async () => {
    const listed = Object.fromEntries((await listAddons()).map((addon) => [addon.slug, addon.creditPrice]));
    expect(listed).toEqual({ credits_10: null, usa_local_citations: 250, audit_fix: 190, off_sale: null });
  });
});
