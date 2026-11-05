import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createPostgresTestDb, testPostgresUrl } from "@/test/postgres";

/**
 * Website projects on REAL Postgres, through postgres-js, the production driver.
 * Skipped unless TEST_POSTGRES_URL names a disposable server (src/test/postgres.ts).
 *
 * Each action call picks its own connection, so simultaneous payments really do
 * race on separate connections rather than taking turns. PGlite cannot do that.
 */

const state = vi.hoisted(() => ({
  dbs: [] as unknown[],
  next: 0,
  orgId: "",
  userId: "user_ws",
  guest: false,
  admin: { userId: "admin_1", email: "admin@repget.test" } as { userId: string; email: string } | null,
}));
vi.mock("@/lib/db", () => ({
  db: new Proxy(
    {},
    {
      get: (_t, p) => {
        const pool = state.dbs as object[];
        const target = pool[state.next++ % pool.length];
        const value = Reflect.get(target, p);
        return typeof value === "function" ? value.bind(target) : value;
      },
    },
  ),
}));
vi.mock("@/lib/tenant", () => ({
  requireOrg: vi.fn(async () => ({ orgId: state.orgId, userId: state.userId, role: "owner" })),
}));
vi.mock("@/lib/websites/accessible", () => ({ hasOnlySharedWork: vi.fn(async () => state.guest) }));
vi.mock("@/lib/i18n/app-locale", async () => {
  const { getMessages } = await import("@/lib/i18n/messages");
  return { getAppMessages: async () => ({ t: getMessages("en"), locale: "en" }) };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const notifications = vi.hoisted(() => ({ notify: vi.fn() }));
vi.mock("@/lib/notifications/create", () => notifications);
const emails = vi.hoisted(() => ({ emailWebsiteProjectToAdmins: vi.fn(async () => ({ sent: 1 })) }));
vi.mock("./notify", () => emails);
vi.mock("@/lib/admin/guard", () => ({
  requireAdmin: vi.fn(async () => {
    if (!state.admin) throw new Error("Not found");
    return state.admin;
  }),
  adminEmails: () => [],
}));

const checkout = vi.hoisted(() => ({ create: vi.fn(async () => ({ url: "https://checkout.stripe.test/session" })) }));
vi.mock("@/lib/stripe/client", () => ({ isStripeConfigured: () => true, stripe: { checkout: { sessions: { create: checkout.create } } } }));
vi.mock("@/lib/stripe/customer", () => ({ getOrCreateCustomer: vi.fn(async () => "cus_test") }));

import { buyAddon } from "@/lib/addons/actions";
import { isEntitledToSpend } from "@/lib/billing/entitled";
import { walletOf } from "@/lib/credits/spend";
import {
  addonPurchases,
  addons,
  backlinkRequests,
  creditLedger,
  creditSpends,
  organization,
  websiteProjects,
  websites,
} from "@/lib/db/schema";
import { user } from "@/lib/db/auth-tables";
import { fulfilAddonPurchase } from "@/lib/addons/fulfil";

import { payWebsiteProject, requestWebsiteQuote } from "./actions";
import { declineWebsiteProject, fulfilWebsiteProject, quoteWebsiteProject } from "./admin";
import { hasWebsiteProject } from "./queries";

const available = Boolean(testPostgresUrl());

describe.skipIf(!available)("website projects on real Postgres", () => {
  type Db = typeof import("@/lib/db").db;
  let dbs: Db[];
  let dispose: () => Promise<void>;

  beforeAll(async () => {
    const created = await createPostgresTestDb(4);
    dbs = created.dbs as unknown as Db[];
    state.dbs = dbs;
    dispose = created.dispose;
    await dbs[0].insert(user).values({ id: state.userId, name: "Ada", email: "ada@example.com", emailVerified: true, createdAt: new Date(), updatedAt: new Date() });
  }, 600_000);

  afterAll(async () => {
    await dispose?.();
  }, 300_000);

  async function workspace(balance: number) {
    const orgId = `org_${randomUUID().slice(0, 8)}`;
    await dbs[0].insert(organization).values({ id: orgId, name: "W", slug: orgId, createdAt: new Date() });
    if (balance) await dbs[0].insert(creditLedger).values({ organizationId: orgId, type: "purchase", amount: balance });
    return orgId;
  }

  const request = (overrides: Record<string, string> = {}) => ({
    kind: "new" as const,
    requestKey: randomUUID(),
    brief: "A site for our family bakery, with an order form.",
    existingUrl: "",
    requirements: "",
    contactName: "Ada",
    contactEmail: "ada@example.com",
    contactPhone: "",
    ...overrides,
  });

  async function requested(orgId: string, overrides: Record<string, string> = {}) {
    state.orgId = orgId;
    const result = await requestWebsiteQuote(request(overrides));
    if (!result.ok) throw new Error(result.error);
    return result.id;
  }

  async function quoted(orgId: string, credits: number) {
    const id = await requested(orgId);
    expect(await quoteWebsiteProject(id, { scope: "Five pages and an order form.", credits })).toEqual({ ok: true });
    return id;
  }

  const project = async (id: string) => (await dbs[0].select().from(websiteProjects).where(eq(websiteProjects.id, id)))[0];
  const balance = async (orgId: string) => (await walletOf(dbs[0], orgId)).balance;
  const spends = (orgId: string) => dbs[0].select().from(creditSpends).where(eq(creditSpends.organizationId, orgId));
  const orders = (orgId: string) => dbs[0].select().from(addonPurchases).where(eq(addonPurchases.organizationId, orgId));

  beforeEach(() => {
    state.guest = false;
    state.admin = { userId: "admin_1", email: "admin@repget.test" };
    notifications.notify.mockClear();
    emails.emailWebsiteProjectToAdmins.mockClear();
  });

  it("comes with the two options, unpriced, as quotes", async () => {
    const rows = await dbs[0].select().from(addons);
    const options = rows.filter((row) => row.slug === "website_new" || row.slug === "website_redesign");
    expect(options).toHaveLength(2);
    for (const option of options) {
      expect(option).toMatchObject({ kind: "quote", creditPrice: null, priceCents: 0, creditsGranted: 0, stripePriceId: null });
    }
  });

  describe("quote before payment", () => {
    it("a request charges nothing, orders nothing, and cannot be paid at any figure", async () => {
      const orgId = await workspace(1000);
      const id = await requested(orgId);
      expect(await project(id)).toMatchObject({ status: "quote_requested", creditCost: null, creditsPaid: null });

      for (const figure of [0, 1, 100, 1000]) {
        expect(await payWebsiteProject(id, figure)).toMatchObject({ ok: false, reason: "unavailable" });
      }
      expect(await balance(orgId)).toBe(1000);
      expect(await spends(orgId)).toHaveLength(0);
      expect(await orders(orgId)).toHaveLength(0);
      expect((await project(id)).status).toBe("quote_requested");
    });

    it("the database itself refuses a quoted or paid row with no price", async () => {
      const orgId = await workspace(0);
      const base = { organizationId: orgId, kind: "new", requestKey: randomUUID(), brief: "b", contactName: "n", contactEmail: "e@e.co" };
      await expect(dbs[0].insert(websiteProjects).values({ ...base, status: "quoted" })).rejects.toThrow();
      await expect(dbs[0].insert(websiteProjects).values({ ...base, status: "paid" })).rejects.toThrow();
      await expect(dbs[0].insert(websiteProjects).values({ ...base, status: "quoted", scope: "s", creditCost: 0 })).rejects.toThrow();
      await expect(dbs[0].insert(websiteProjects).values({ ...base, status: "paid", scope: "s", creditCost: 5 })).rejects.toThrow();
    });

    it("a declined quote cannot be paid", async () => {
      const orgId = await workspace(500);
      const id = await quoted(orgId, 100);
      expect(await declineWebsiteProject(id, "Outside what we build")).toEqual({ ok: true });
      expect(await payWebsiteProject(id, 100)).toMatchObject({ ok: false, reason: "unavailable" });
      expect(await balance(orgId)).toBe(500);
    });

    it("an unpaid project cannot be marked delivered", async () => {
      const orgId = await workspace(500);
      const id = await quoted(orgId, 100);
      expect(await fulfilWebsiteProject(id, "Delivered")).toMatchObject({ ok: false });
      expect((await project(id)).status).toBe("quoted");
    });
  });

  describe("paying", () => {
    it("takes the price, records one order with the same identity, and is delivered through to Billing", async () => {
      const orgId = await workspace(300);
      const id = await quoted(orgId, 250);
      expect(await payWebsiteProject(id, 250)).toEqual({ ok: true, credits: 250 });

      expect(await balance(orgId)).toBe(50);
      expect(await project(id)).toMatchObject({ status: "paid", creditsPaid: 250 });
      const [spend] = await spends(orgId);
      expect(spend).toMatchObject({ action: "addon:website_new", credits: 250, idempotencyKey: `addon:${id}` });
      const [order] = await orders(orgId);
      expect(order).toMatchObject({ id, creditsPaid: 250, pricePaidCents: 0, status: "paid", stripeSessionId: null });

      expect(await fulfilWebsiteProject(id, "Live at the new address")).toEqual({ ok: true });
      expect(await project(id)).toMatchObject({ status: "fulfilled", deliveryNote: "Live at the new address" });
      const [delivered] = await orders(orgId);
      expect(delivered.status).toBe("fulfilled");
      expect(delivered.fulfilledAt).not.toBeNull();
      // Delivering twice changes nothing.
      expect(await fulfilWebsiteProject(id, "Again")).toMatchObject({ ok: false });
      expect((await project(id)).deliveryNote).toBe("Live at the new address");
    });

    it("re-checks the current price: an old figure is refused, and the customer pays only the new one", async () => {
      const orgId = await workspace(1000);
      const id = await quoted(orgId, 100);
      expect(await quoteWebsiteProject(id, { scope: "More pages than first agreed.", credits: 300 })).toEqual({ ok: true });

      expect(await payWebsiteProject(id, 100)).toMatchObject({ ok: false, reason: "price_changed", credits: 300 });
      expect(await balance(orgId)).toBe(1000);
      expect(await spends(orgId)).toHaveLength(0);

      // A lowered price is refused as well: the customer agrees to the figure they see.
      expect(await quoteWebsiteProject(id, { scope: "Fewer pages after all, please.", credits: 50 })).toEqual({ ok: true });
      expect(await payWebsiteProject(id, 300)).toMatchObject({ ok: false, reason: "price_changed", credits: 50 });
      expect(await payWebsiteProject(id, 50)).toEqual({ ok: true, credits: 50 });
      expect(await balance(orgId)).toBe(950);
    });

    it("a price cannot change once paid", async () => {
      const orgId = await workspace(500);
      const id = await quoted(orgId, 100);
      await payWebsiteProject(id, 100);
      expect(await quoteWebsiteProject(id, { scope: "Changed after payment.", credits: 900 })).toMatchObject({ ok: false });
      expect(await declineWebsiteProject(id, "Too late")).toMatchObject({ ok: false });
      expect(await project(id)).toMatchObject({ status: "paid", creditCost: 100, creditsPaid: 100 });
    });

    it("refuses insufficient credits and writes nothing", async () => {
      const orgId = await workspace(99);
      const id = await quoted(orgId, 100);
      expect(await payWebsiteProject(id, 100)).toMatchObject({ ok: false, reason: "not_enough", credits: 100, available: 99 });
      expect(await balance(orgId)).toBe(99);
      expect(await spends(orgId)).toHaveLength(0);
      expect(await orders(orgId)).toHaveLength(0);
      expect((await project(id)).status).toBe("quoted");
      expect(emails.emailWebsiteProjectToAdmins).not.toHaveBeenCalledWith(expect.objectContaining({ stage: "paid" }));
    });

    it("counts what backlinks hold: reserved credits cannot pay for it", async () => {
      const orgId = await workspace(150);
      const [site] = await dbs[0].insert(websites).values({ organizationId: orgId, url: `https://${orgId}.test`, domain: `${orgId}.test` }).returning({ id: websites.id });
      await dbs[0].insert(backlinkRequests).values({ websiteId: site.id, targetUrl: `https://${orgId}.test/`, creditsReserved: 100, status: "pending" } as typeof backlinkRequests.$inferInsert);
      expect(await walletOf(dbs[0], orgId)).toEqual({ balance: 150, reserved: 100, available: 50 });

      const id = await quoted(orgId, 100);
      expect(await payWebsiteProject(id, 100)).toMatchObject({ ok: false, reason: "not_enough", available: 50 });
      expect(await balance(orgId)).toBe(150);
    });

    it("a duplicate payment after success takes nothing more", async () => {
      const orgId = await workspace(300);
      const id = await quoted(orgId, 100);
      expect(await payWebsiteProject(id, 100)).toEqual({ ok: true, credits: 100 });
      expect(await payWebsiteProject(id, 100)).toEqual({ ok: true, credits: 100 });
      expect(await balance(orgId)).toBe(200);
      expect(await spends(orgId)).toHaveLength(1);
      expect(await orders(orgId)).toHaveLength(1);
      expect(emails.emailWebsiteProjectToAdmins.mock.calls.filter(([event]: unknown[]) => (event as { stage: string }).stage === "paid")).toHaveLength(1);
    });
  });

  describe("at the same moment", () => {
    it("the same project paid from many connections charges once", async () => {
      const orgId = await workspace(1000);
      const id = await quoted(orgId, 100);
      const results = await Promise.all(Array.from({ length: 8 }, () => payWebsiteProject(id, 100)));
      expect(results.every((result) => result.ok)).toBe(true);
      expect(await balance(orgId)).toBe(900);
      expect(await spends(orgId)).toHaveLength(1);
      expect(await orders(orgId)).toHaveLength(1);
    }, 60_000);

    it("two projects racing for credits that cover one: one wins and the balance never goes negative", async () => {
      const orgId = await workspace(100);
      const first = await quoted(orgId, 100);
      const second = await quoted(orgId, 100);
      const results = await Promise.all([payWebsiteProject(first, 100), payWebsiteProject(second, 100)]);
      expect(results.filter((result) => result.ok)).toHaveLength(1);
      expect(results.filter((result) => !result.ok && result.reason === "not_enough")).toHaveLength(1);
      expect(await balance(orgId)).toBe(0);
      expect(await orders(orgId)).toHaveLength(1);
    }, 60_000);

    it("a payment racing a price change charges a price the row actually held, once", async () => {
      const orgId = await workspace(1000);
      const id = await quoted(orgId, 100);
      const [paid, changed] = await Promise.all([payWebsiteProject(id, 100), quoteWebsiteProject(id, { scope: "Bigger scope agreed.", credits: 400 })]);
      const row = await project(id);
      if (paid.ok) {
        // The payment got the row first: the old price, and the change was refused.
        expect(changed.ok).toBe(false);
        expect(row).toMatchObject({ status: "paid", creditCost: 100, creditsPaid: 100 });
        expect(await balance(orgId)).toBe(900);
      } else {
        expect(paid.reason).toBe("price_changed");
        expect(row).toMatchObject({ status: "quoted", creditCost: 400, creditsPaid: null });
        expect(await balance(orgId)).toBe(1000);
      }
    }, 60_000);

    it("one form submitted many times makes one project", async () => {
      const orgId = await workspace(0);
      state.orgId = orgId;
      const body = request();
      const results = await Promise.all(Array.from({ length: 6 }, () => requestWebsiteQuote(body)));
      const ids = new Set(results.map((result) => (result.ok ? result.id : "refused")));
      expect(ids.size).toBe(1);
      expect(await dbs[0].select().from(websiteProjects).where(eq(websiteProjects.organizationId, orgId))).toHaveLength(1);
    }, 60_000);
  });

  describe("workspaces", () => {
    it("a project id from another workspace finds nothing: no charge to either", async () => {
      const victim = await workspace(500);
      const id = await quoted(victim, 100);

      const attacker = await workspace(500);
      state.orgId = attacker;
      expect(await payWebsiteProject(id, 100)).toMatchObject({ ok: false, reason: "unavailable" });
      expect(await balance(victim)).toBe(500);
      expect(await balance(attacker)).toBe(500);
      expect((await project(id)).status).toBe("quoted");
    });

    it("the workspace cannot be chosen from the browser: extra input is ignored", async () => {
      const mine = await workspace(0);
      const other = await workspace(0);
      state.orgId = mine;
      const result = await requestWebsiteQuote({ ...request(), organizationId: other } as never);
      if (!result.ok) throw new Error(result.error);
      expect((await project(result.id)).organizationId).toBe(mine);
    });

    it("is refused to someone here only for another workspace's website", async () => {
      const orgId = await workspace(500);
      const id = await quoted(orgId, 100);
      state.guest = true;
      expect(await payWebsiteProject(id, 100)).toMatchObject({ ok: false, reason: "unavailable" });
      expect(await requestWebsiteQuote(request())).toMatchObject({ ok: false });
      expect(await balance(orgId)).toBe(500);
    });

    it("an administrator's actions need an administrator", async () => {
      const orgId = await workspace(500);
      const id = await requested(orgId);
      state.admin = null;
      await expect(quoteWebsiteProject(id, { scope: "Five pages and a form.", credits: 1 })).rejects.toThrow();
      await expect(declineWebsiteProject(id, "No")).rejects.toThrow();
      await expect(fulfilWebsiteProject(id, "Done")).rejects.toThrow();
      expect((await project(id)).status).toBe("quote_requested");
    });
  });

  describe("input", () => {
    it("says which fields are wrong and saves nothing", async () => {
      const orgId = await workspace(0);
      state.orgId = orgId;
      const result = await requestWebsiteQuote(request({ brief: "short", contactEmail: "nope", existingUrl: "javascript:alert(1)" }));
      expect(result).toMatchObject({ ok: false, fields: { brief: expect.any(String), contactEmail: expect.any(String), existingUrl: expect.any(String) } });
      expect(await hasWebsiteProject(orgId)).toBe(false);
    });

    it("an existing address is optional, and kept when given", async () => {
      const orgId = await workspace(0);
      const without = await requested(orgId, { kind: "redesign" });
      const withUrl = await requested(orgId, { kind: "redesign", existingUrl: "acme.example.com/shop" });
      expect((await project(without)).existingUrl).toBeNull();
      expect((await project(withUrl)).existingUrl).toBe("https://acme.example.com/shop");
    });

    it("caps requests waiting for a first answer", async () => {
      const orgId = await workspace(0);
      for (let i = 0; i < 5; i++) await requested(orgId);
      state.orgId = orgId;
      expect(await requestWebsiteQuote(request())).toMatchObject({ ok: false });
    });

    it("an administrator's price must be a whole number above 0", async () => {
      const orgId = await workspace(0);
      const id = await requested(orgId);
      for (const credits of [0, -5, 1.5, Number.NaN, 2_000_000]) {
        expect(await quoteWebsiteProject(id, { scope: "Five pages and a form.", credits })).toMatchObject({ ok: false });
      }
      expect((await project(id)).status).toBe("quote_requested");
    });
  });

  describe("no domain, and how far that goes", () => {
    it("a workspace with no website and no plan can ask, buy credits by verified payment, pay, and be delivered", async () => {
      const orgId = await workspace(0);
      const id = await quoted(orgId, 100);
      expect(await payWebsiteProject(id, 100)).toMatchObject({ ok: false, reason: "not_enough", available: 0 });

      // The credit pack arrives only through the webhook's fulfilment; a replay grants nothing more.
      const [pack] = await dbs[0]
        .insert(addons)
        .values({ slug: `credits_${randomUUID().slice(0, 8)}`, name: "Pack", priceCents: 7900, creditsGranted: 100, kind: "credits", stripePriceId: "price_test" })
        .returning({ id: addons.id });

      // Starting checkout needs no website, and grants nothing: not the session, not the success address.
      state.orgId = orgId;
      vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.test");
      expect(await buyAddon(pack.id)).toEqual({ url: "https://checkout.stripe.test/session" });
      vi.unstubAllEnvs();
      expect(await balance(orgId)).toBe(0);
      expect(checkout.create).toHaveBeenCalledWith(expect.objectContaining({ mode: "payment", metadata: { organizationId: orgId, addonId: pack.id } }));

      const session = { organizationId: orgId, addonId: pack.id, stripeSessionId: `cs_${randomUUID()}`, amountTotal: 7900, currency: "eur" };
      expect(await fulfilAddonPurchase(session)).toBe(true);
      expect(await fulfilAddonPurchase(session)).toBe(false);
      expect(await balance(orgId)).toBe(100);

      expect(await payWebsiteProject(id, 100)).toEqual({ ok: true, credits: 100 });
      expect(await balance(orgId)).toBe(0);
      expect(await hasWebsiteProject(orgId)).toBe(true);
    });

    it("a project and credits buy no plan-paid feature: a website in that workspace still has no entitlement", async () => {
      const orgId = await workspace(1000);
      const id = await quoted(orgId, 100);
      await payWebsiteProject(id, 100);
      const [site] = await dbs[0].insert(websites).values({ organizationId: orgId, url: `https://${orgId}.test`, domain: `${orgId}.test` }).returning({ id: websites.id });
      expect(await isEntitledToSpend(site.id)).toMatchObject({ ok: false });
      expect(await isEntitledToSpend(site.id, { freeArticles: true })).toMatchObject({ ok: false });
    });
  });
});
