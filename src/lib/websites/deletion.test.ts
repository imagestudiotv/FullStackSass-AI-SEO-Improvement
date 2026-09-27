import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  adminAuditLog,
  competitors,
  organization,
  payments,
  subscriptions,
  websites,
} from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";

/**
 * Website deletion: who may delete, and never while a provider can still
 * bill. Runs the real customer and admin actions against a disposable PGlite
 * database; only the session, the admin allow-list, cache revalidation and
 * the job queue are stubbed. No provider is called - deletion never talks to
 * Stripe or PayPal, it only refuses.
 */

const state = vi.hoisted(() => ({
  db: null as unknown,
  /** What requireWebsite resolves to for the current test. */
  context: null as unknown,
}));

vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/inngest/send", () => ({ queueJob: vi.fn() }));
vi.mock("@/lib/admin/guard", () => ({
  requireAdmin: vi.fn(async () => ({ email: "ops@example.test" })),
}));
// Imported by admin/operations for refunds and credits, not by deletion.
vi.mock("@/lib/backlinks/credits", () => ({
  recordCredit: vi.fn(),
  getBalance: vi.fn(),
}));
vi.mock("@/lib/usage", () => ({ checkLimit: vi.fn() }));
vi.mock("@/lib/stripe/client", () => ({
  isStripeConfigured: () => false,
  stripe: new Proxy({}, {
    get: () => {
      throw new Error("Stripe must not be called by deletion");
    },
  }),
}));
vi.mock("@/lib/tenant", () => {
  class WebsiteNotFoundError extends Error {}
  return {
    WebsiteNotFoundError,
    requireOrg: vi.fn(),
    requireWebsite: vi.fn(async () => {
      if (!state.context) throw new WebsiteNotFoundError();
      return state.context;
    }),
  };
});

import {
  deleteOrganization,
  deleteWebsite as adminDeleteWebsite,
} from "@/lib/admin/operations";
import { deleteWebsite } from "@/lib/websites/actions";
import {
  billingBlockReason,
  deleteWebsiteIfBillingResolved,
  type SubscriptionBillingState,
} from "@/lib/websites/deletion";

let test: TestDb;

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

beforeEach(async () => {
  state.context = null;
  await test.client.exec(`
    delete from admin_audit_log;
    delete from subscriptions;
    delete from payments;
    delete from websites;
    delete from organization;
  `);
  await test.db.insert(organization).values([
    { id: "org_a", name: "Acme", slug: "acme", createdAt: new Date() },
    { id: "org_b", name: "Other", slug: "other", createdAt: new Date() },
  ]);
});

async function addSite(organizationId = "org_a", domain = "acme.test") {
  const [site] = await test.db
    .insert(websites)
    .values({ organizationId, url: `https://${domain}`, domain })
    .returning();
  return site;
}

async function addSubscription(
  values: Partial<typeof subscriptions.$inferInsert> & { websiteId: string | null },
) {
  const [row] = await test.db
    .insert(subscriptions)
    .values({ organizationId: "org_a", status: "active", ...values })
    .returning();
  return row;
}

function actAs(
  site: typeof websites.$inferSelect,
  access: "owner" | "editor" | "viewer",
) {
  state.context = {
    site,
    access,
    orgId: access === "owner" ? site.organizationId : "org_b",
    userId: "user_1",
    role: "owner",
  };
}

async function siteExists(id: string) {
  const rows = await test.db
    .select({ id: websites.id })
    .from(websites)
    .where(eq(websites.id, id));
  return rows.length === 1;
}

describe("billingBlockReason", () => {
  const base: SubscriptionBillingState = {
    status: "active",
    provider: "stripe",
    cancelAtPeriodEnd: false,
    currentPeriodEnd: null,
    stripeSubscriptionId: "sub_123",
    paypalSubscriptionId: null,
  };

  it.each(["active", "trialing", "past_due"])("blocks %s", (status) => {
    expect(billingBlockReason([{ ...base, status }])).toMatch(
      /active subscription/,
    );
  });

  it("blocks a cancellation scheduled for the period end", () => {
    const reason = billingBlockReason([
      {
        ...base,
        cancelAtPeriodEnd: true,
        currentPeriodEnd: new Date("2026-10-31T00:00:00Z"),
      },
    ]);
    expect(reason).toMatch(/set to cancel/);
    expect(reason).toMatch(/2026-10-31/);
  });

  it.each(["inactive", "incomplete", "unpaid", "paused", "something_new"])(
    "blocks %s while the provider still holds the subscription",
    (status) => {
      expect(billingBlockReason([{ ...base, status }])).toMatch(
        /not been confirmed as cancelled with Stripe/,
      );
      expect(
        billingBlockReason([
          {
            ...base,
            status,
            provider: "paypal",
            stripeSubscriptionId: null,
            paypalSubscriptionId: "I-123",
          },
        ]),
      ).toMatch(/PayPal/);
    },
  );

  it.each(["canceled", "incomplete_expired"])("allows %s", (status) => {
    expect(billingBlockReason([{ ...base, status }])).toBeNull();
  });

  it("allows a local-only row with nothing at a provider", () => {
    expect(
      billingBlockReason([
        { ...base, status: "inactive", stripeSubscriptionId: null },
      ]),
    ).toBeNull();
  });

  it("allows no subscriptions at all", () => {
    expect(billingBlockReason([])).toBeNull();
  });
});

describe("customer deleteWebsite", () => {
  it("refuses an invited editor and keeps the website", async () => {
    const site = await addSite();
    actAs(site, "editor");

    const result = await deleteWebsite(site.id);

    expect(result).toEqual({
      ok: false,
      error: "Only the workspace that owns this website can delete it.",
    });
    expect(await siteExists(site.id)).toBe(true);
  });

  it("refuses a viewer", async () => {
    const site = await addSite();
    actAs(site, "viewer");

    expect((await deleteWebsite(site.id)).ok).toBe(false);
    expect(await siteExists(site.id)).toBe(true);
  });

  it("refuses a website outside the caller's tenant", async () => {
    const site = await addSite("org_b", "other.test");

    expect(await deleteWebsite(site.id)).toEqual({
      ok: false,
      error: "That website is not available.",
    });
    expect(await siteExists(site.id)).toBe(true);
  });

  it("refuses while the subscription is active and keeps both rows", async () => {
    const site = await addSite();
    await addSubscription({ websiteId: site.id, stripeSubscriptionId: "sub_live" });
    actAs(site, "owner");

    const result = await deleteWebsite(site.id);

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(/active subscription/);
    expect(await siteExists(site.id)).toBe(true);
    const [sub] = await test.db.select().from(subscriptions);
    expect(sub.websiteId).toBe(site.id);
  });

  it("refuses while a cancellation has not taken effect", async () => {
    const site = await addSite();
    await addSubscription({
      websiteId: site.id,
      stripeSubscriptionId: "sub_ending",
      cancelAtPeriodEnd: true,
    });
    actAs(site, "owner");

    const result = await deleteWebsite(site.id);

    expect(!result.ok && result.error).toMatch(/set to cancel/);
    expect(await siteExists(site.id)).toBe(true);
  });

  it("refuses a locally inactive row Stripe may still be billing", async () => {
    // What admin "deactivate" leaves behind: local status only.
    const site = await addSite();
    await addSubscription({
      websiteId: site.id,
      status: "inactive",
      stripeSubscriptionId: "sub_still_billing",
    });
    actAs(site, "owner");

    expect((await deleteWebsite(site.id)).ok).toBe(false);
    expect(await siteExists(site.id)).toBe(true);
  });

  it("refuses when a legacy subscription pays for the only website", async () => {
    const site = await addSite();
    await addSubscription({ websiteId: null, stripeSubscriptionId: "sub_legacy" });
    actAs(site, "owner");

    expect((await deleteWebsite(site.id)).ok).toBe(false);
    expect(await siteExists(site.id)).toBe(true);
  });

  it("lets the owner delete once the subscription has ended, keeping the billing record", async () => {
    const site = await addSite();
    await test.db
      .insert(competitors)
      .values({ websiteId: site.id, domain: "rival.test", source: "manual" });
    const sub = await addSubscription({
      websiteId: site.id,
      status: "canceled",
      provider: "stripe",
      stripeCustomerId: "cus_123",
      stripeSubscriptionId: "sub_done",
    });
    await test.db.insert(payments).values({
      organizationId: "org_a",
      provider: "stripe",
      externalId: "in_123",
      amountCents: 4900,
      currency: "eur",
      status: "paid",
    });
    actAs(site, "owner");

    expect(await deleteWebsite(site.id)).toEqual({ ok: true, data: null });

    expect(await siteExists(site.id)).toBe(false);
    // Content goes with the site...
    expect(await test.db.select().from(competitors)).toHaveLength(0);
    // ...the financial record does not.
    const [kept] = await test.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, sub.id));
    expect(kept).toMatchObject({
      websiteId: null,
      organizationId: "org_a",
      status: "canceled",
      stripeCustomerId: "cus_123",
      stripeSubscriptionId: "sub_done",
    });
    expect(await test.db.select().from(payments)).toHaveLength(1);
  });

  it("lets the owner delete a website that never had a subscription", async () => {
    const site = await addSite();
    actAs(site, "owner");

    expect((await deleteWebsite(site.id)).ok).toBe(true);
    expect(await siteExists(site.id)).toBe(false);
  });

  it("ignores another site's live subscription", async () => {
    const site = await addSite();
    const other = await addSite("org_a", "second.test");
    await addSubscription({ websiteId: other.id, stripeSubscriptionId: "sub_other" });
    actAs(site, "owner");

    expect((await deleteWebsite(site.id)).ok).toBe(true);
    expect(await siteExists(other.id)).toBe(true);
  });
});

describe("deleteWebsiteIfBillingResolved", () => {
  it("does not delete a website under a different organization", async () => {
    const site = await addSite("org_b", "other.test");

    const result = await deleteWebsiteIfBillingResolved(test.db, {
      websiteId: site.id,
      organizationId: "org_a",
    });

    expect(result).toEqual({ ok: false, error: "Website not found." });
    expect(await siteExists(site.id)).toBe(true);
  });

  it("keeps the website when the pre-delete hook fails", async () => {
    const site = await addSite();

    await expect(
      deleteWebsiteIfBillingResolved(test.db, {
        websiteId: site.id,
        organizationId: "org_a",
        beforeDelete: async () => {
          throw new Error("audit log unavailable");
        },
      }),
    ).rejects.toThrow("audit log unavailable");
    expect(await siteExists(site.id)).toBe(true);
  });
});

describe("admin deleteWebsite", () => {
  async function auditCount() {
    return (await test.db.select().from(adminAuditLog)).length;
  }

  it("refuses while the subscription is active, without an audit entry", async () => {
    const site = await addSite();
    await addSubscription({ websiteId: site.id, stripeSubscriptionId: "sub_live" });

    const result = await adminDeleteWebsite(site.id, "customer asked", "DELETE");

    expect(!result.ok && result.error).toMatch(/active subscription/);
    expect(await siteExists(site.id)).toBe(true);
    expect(await auditCount()).toBe(0);
  });

  it("refuses while a cancellation is unresolved", async () => {
    const site = await addSite();
    await addSubscription({
      websiteId: site.id,
      status: "inactive",
      provider: "paypal",
      paypalSubscriptionId: "I-PENDING",
    });

    const result = await adminDeleteWebsite(site.id, "customer asked", "DELETE");

    expect(!result.ok && result.error).toMatch(/PayPal/);
    expect(await siteExists(site.id)).toBe(true);
  });

  it("deletes an ended website, audits it and keeps the subscription row", async () => {
    const site = await addSite();
    const sub = await addSubscription({
      websiteId: site.id,
      status: "canceled",
      stripeSubscriptionId: "sub_done",
    });

    const result = await adminDeleteWebsite(site.id, "customer asked", "DELETE");

    expect(result).toEqual({
      ok: true,
      data: { domain: "acme.test", articles: 0 },
    });
    expect(await siteExists(site.id)).toBe(false);
    expect(await auditCount()).toBe(1);
    const [kept] = await test.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, sub.id));
    expect(kept).toMatchObject({ websiteId: null, stripeSubscriptionId: "sub_done" });
  });
});

describe("admin deleteOrganization", () => {
  it("refuses a workspace whose subscription is only locally inactive", async () => {
    const site = await addSite();
    await addSubscription({
      websiteId: site.id,
      status: "inactive",
      stripeSubscriptionId: "sub_still_billing",
    });

    const result = await deleteOrganization("org_a", "erasure request", "DELETE");

    expect(!result.ok && result.error).toMatch(/workspace's subscription/);
    const orgs = await test.db
      .select()
      .from(organization)
      .where(eq(organization.id, "org_a"));
    expect(orgs).toHaveLength(1);
  });
});
