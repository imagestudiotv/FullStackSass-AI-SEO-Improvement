import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const inngestMock = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("@/inngest/client", () => ({ inngest: inngestMock }));

import { beginCheckout, type CheckoutProviderOps } from "@/lib/billing/checkouts";
import { billingCheckouts, organization, plans, websites } from "@/lib/db/schema";
import type { Database } from "@/lib/db/types";
import { createPostgresTestDb, testPostgresUrl } from "@/test/postgres";

/**
 * One REPGET redemption per workspace, on a real Postgres with separate
 * connections. Skipped unless TEST_POSTGRES_URL names a disposable server.
 */

const available = Boolean(testPostgresUrl());
const OFFER = "REPGET";

describe.skipIf(!available)("one REPGET redemption per workspace", () => {
  let a: Database;
  let b: Database;
  let dispose: () => Promise<void>;
  let planId: string;
  let sites: string[];
  /** What Stripe says about an open session. Unreachable unless a test says otherwise. */
  let ops: CheckoutProviderOps;

  const begin = (database: Database, websiteId: string, organizationId = "org_a") =>
    beginCheckout(database, { organizationId, websiteId, provider: "stripe", planId, offer: OFFER }, ops);
  /** A checkout that took the offer, in a given state, as Stripe's answer left it. */
  const earlier = async (status: string, websiteId: string) =>
    (await a.insert(billingCheckouts).values({ organizationId: "org_a", websiteId, provider: "stripe", planId, status, trialDays: 30, stripeSessionId: `cs_${status}`, requestParams: { offer: OFFER }, createdAt: new Date(Date.now() - 3_600_000) }).returning())[0];

  beforeAll(async () => {
    const created = await createPostgresTestDb(2);
    [a, b] = created.dbs as unknown as Database[];
    dispose = created.dispose;
  }, 120_000);

  afterAll(async () => {
    await dispose?.();
  });

  beforeEach(async () => {
    await a.delete(organization);
    await a.delete(plans);
    const unreachable = async () => {
      throw new Error("provider unreachable");
    };
    ops = { expireStripeCheckout: unreachable, payPalApprovalState: unreachable, stripeSessionState: unreachable, findStripeSession: unreachable };
    const [plan] = await a.insert(plans).values({ name: "Grow", tier: "grow", interval: "month", priceCents: 14900, articleLimit: 30, keywordLimit: 100, siteLimit: 1, monthlyCredits: 0 }).returning();
    planId = plan.id;
    await a.insert(organization).values([
      { id: "org_a", name: "Acme", slug: "acme", createdAt: new Date() },
      { id: "org_b", name: "Other", slug: "other", createdAt: new Date() },
    ]);
    const rows = await a
      .insert(websites)
      .values([
        { organizationId: "org_a", url: "https://one.test", domain: "one.test" },
        { organizationId: "org_a", url: "https://two.test", domain: "two.test" },
        { organizationId: "org_b", url: "https://other.test", domain: "other.test" },
      ])
      .returning();
    sites = rows.map((row) => row.id);
  });

  it("two checkouts at once, on two connections and two websites: exactly one gets it", async () => {
    for (let round = 0; round < 5; round++) {
      await a.delete(billingCheckouts);
      const results = await Promise.all([begin(a, sites[0]), begin(b, sites[1])]);
      expect(results.map((result) => result.kind).sort()).toEqual(["create", "refuse"]);
      const held = await a.select().from(billingCheckouts);
      expect(held).toHaveLength(1);
      expect(held[0].requestParams).toEqual({ offer: OFFER });
    }
  });

  it("another workspace is not affected", async () => {
    const results = await Promise.all([begin(a, sites[0]), begin(b, sites[2], "org_b")]);
    expect(results.map((result) => result.kind)).toEqual(["create", "create"]);
  });

  it("a completed checkout used it, for good", async () => {
    await earlier("completed", sites[0]);
    expect(await begin(a, sites[1])).toMatchObject({ kind: "refuse", error: expect.stringContaining("already used") });
  });

  it("an open checkout Stripe says is still open holds it, on another website, and is not closed", async () => {
    const open = await earlier("open", sites[0]);
    ops.stripeSessionState = vi.fn(async () => ({ state: "open" as const, url: null, expiresAt: null }));
    ops.expireStripeCheckout = vi.fn();
    expect(await begin(a, sites[1])).toMatchObject({ kind: "refuse", error: expect.stringContaining("another checkout") });
    expect(ops.expireStripeCheckout).not.toHaveBeenCalled();
    const [row] = await a.select().from(billingCheckouts).where(eq(billingCheckouts.id, open.id));
    expect(row.status).toBe("open");
  });

  it("one Stripe cannot answer for still holds it: not known is not free", async () => {
    await earlier("unresolved", sites[0]);
    expect(await begin(a, sites[1])).toMatchObject({ kind: "refuse" });
  });

  it("one that has expired gives it back, so opening a checkout does not spend it", async () => {
    await earlier("open", sites[0]);
    ops.stripeSessionState = vi.fn(async () => ({ state: "expired" as const }));
    expect(await begin(a, sites[1])).toMatchObject({ kind: "create" });
  });

  it("one already expired or failed gives it back", async () => {
    await earlier("expired", sites[0]);
    await earlier("failed", sites[0]);
    expect(await begin(a, sites[1])).toMatchObject({ kind: "create" });
  });

  it("a checkout without the offer neither holds it nor is held by it", async () => {
    await a.insert(billingCheckouts).values({ organizationId: "org_a", websiteId: sites[0], provider: "stripe", planId, status: "completed", trialDays: 0, requestParams: {}, createdAt: new Date() });
    expect(await begin(a, sites[1])).toMatchObject({ kind: "create" });
    expect(await beginCheckout(a, { organizationId: "org_b", websiteId: sites[2], provider: "stripe", planId }, ops)).toMatchObject({ kind: "create" });
  });
});
