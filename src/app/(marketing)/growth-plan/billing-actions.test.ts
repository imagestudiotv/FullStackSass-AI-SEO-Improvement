import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The growth plan's billing action (billing-actions.ts): nothing without a
 * session, nothing for a plan not on sale, the typed website added through
 * the onboarding website step's own addWebsite (or the workspace's existing
 * one reused), then Free's or the paid plans' details for that account.
 */

const m = vi.hoisted(() => ({
  session: null as null | { user: { id: string; email: string; createdAt: Date } },
  existing: [] as { id: string }[],
  verified: false,
  getSession: vi.fn(),
  requireOrg: vi.fn(async () => ({ orgId: "org-1", userId: "user-1" })),
  listPlans: vi.fn(),
  addWebsite: vi.fn(),
  isTrialEligible: vi.fn(async () => true),
  planScreenOffer: vi.fn(async () => null as "repget" | "winback" | null),
  hasUnfinishedPayPalApproval: vi.fn(async () => false),
  isPayPalAvailable: vi.fn(async () => true),
  getOnboardingState: vi.fn(async () => ({ hasPlan: false })),
  pendingConversions: vi.fn(async () => [{ id: "sign_up:user-1", name: "sign_up", params: { method: "email" } }]),
  claimReferral: vi.fn(async () => {}),
  tables: [] as unknown[],
}));

vi.mock("@/lib/auth-guard", () => ({ getSession: m.getSession }));
vi.mock("@/lib/tenant", () => ({ requireOrg: m.requireOrg }));
vi.mock("@/lib/billing", () => ({ listPlans: m.listPlans }));
vi.mock("@/lib/billing/checkouts", () => ({
  isTrialEligible: m.isTrialEligible,
  planScreenOffer: m.planScreenOffer,
  hasUnfinishedPayPalApproval: m.hasUnfinishedPayPalApproval,
}));
vi.mock("@/lib/paypal/actions", () => ({ isPayPalAvailable: m.isPayPalAvailable }));
vi.mock("@/lib/onboarding/steps", () => ({ getOnboardingState: m.getOnboardingState }));
vi.mock("@/lib/conversions/conversions", () => ({ pendingConversions: m.pendingConversions }));
vi.mock("@/lib/referrals/actions", () => ({ claimReferral: m.claimReferral }));
vi.mock("@/lib/websites/actions", () => ({ addWebsite: m.addWebsite }));
vi.mock("@/lib/db/schema", () => ({ websites: { name: "websites", id: "id", organizationId: "organization_id", domain: "domain" } }));
vi.mock("@/lib/db/auth-tables", () => ({ user: { name: "user", id: "id", emailVerified: "email_verified" } }));
vi.mock("drizzle-orm", () => ({ and: (...parts: unknown[]) => parts, eq: (a: unknown, b: unknown) => [a, b] }));
vi.mock("@/lib/db", () => ({
  db: {
    select: () => {
      let table: { name?: string } | null = null;
      const chain = {
        from: (t: { name?: string }) => {
          table = t;
          m.tables.push(t.name);
          return chain;
        },
        where: () => chain,
        limit: async () => (table?.name === "user" ? [{ emailVerified: m.verified }] : m.existing),
      };
      return chain;
    },
  },
}));

import { prepareGrowthPlanBilling } from "./billing-actions";

const plan = (over: Record<string, unknown>) => ({
  id: "grow-m",
  tier: "grow",
  name: "Grow",
  priceCents: 14900,
  currency: "eur",
  interval: "month",
  articleLimit: 30,
  keywordLimit: 100,
  siteLimit: 1,
  monthlyCredits: 0,
  paypalPlanId: "P-GROW",
  paypalTrialPlanId: null,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  m.session = { user: { id: "user-1", email: "ana@acme.com", createdAt: new Date("2026-11-20T10:00:00Z") } };
  m.getSession.mockImplementation(async () => m.session);
  m.existing = [];
  m.verified = false;
  m.tables = [];
  m.listPlans.mockResolvedValue([
    plan({}),
    plan({ id: "grow-y", interval: "year", name: "Grow (Annual)", priceCents: 149000 }),
    plan({ id: "scale-m", tier: "scale", name: "Scale", priceCents: 34900, paypalPlanId: null }),
  ]);
  m.addWebsite.mockResolvedValue({ ok: true, data: { id: "site-new" } });
});

describe("prepareGrowthPlanBilling", () => {
  it("does nothing without a session", async () => {
    m.session = null;
    const result = await prepareGrowthPlanBilling("acme.com", "grow");
    expect(result).toMatchObject({ ok: false, reason: "signed_out" });
    expect(m.requireOrg).not.toHaveBeenCalled();
    expect(m.addWebsite).not.toHaveBeenCalled();
    expect(m.tables).toEqual([]);
  });

  it("refuses a plan that is not on sale before touching any website", async () => {
    for (const tier of ["platinum", "", "launch-annual"]) {
      expect(await prepareGrowthPlanBilling("acme.com", tier)).toMatchObject({ ok: false, reason: "plan" });
    }
    expect(m.addWebsite).not.toHaveBeenCalled();
    expect(m.requireOrg).not.toHaveBeenCalled();
  });

  it("refuses an address that is not one, without adding anything", async () => {
    for (const domain of ["not a website", "javascript:alert(1)", "x".repeat(400)]) {
      expect(await prepareGrowthPlanBilling(domain, "grow")).toMatchObject({ ok: false, reason: "website" });
    }
    expect(m.addWebsite).not.toHaveBeenCalled();
  });

  it("adds the typed website with the onboarding step's addWebsite, as typed", async () => {
    const result = await prepareGrowthPlanBilling("https://www.acme.com/shop", "grow");
    expect(m.addWebsite).toHaveBeenCalledTimes(1);
    expect(m.addWebsite).toHaveBeenCalledWith("https://www.acme.com/shop");
    expect(result).toMatchObject({ ok: true, websiteId: "site-new", next: "/onboarding/google?site=site-new" });
    expect(m.claimReferral).toHaveBeenCalled();
  });

  it("reuses the workspace's own website for that address instead of adding a second", async () => {
    m.existing = [{ id: "site-old" }];
    const result = await prepareGrowthPlanBilling("acme.com", "grow");
    expect(m.addWebsite).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: true, websiteId: "site-old" });
    expect(m.getOnboardingState).toHaveBeenCalledWith("org-1", "site-old");
  });

  it("says addWebsite's refusal in its own words", async () => {
    m.addWebsite.mockResolvedValue({ ok: false, error: "That website is already shared with you." });
    expect(await prepareGrowthPlanBilling("acme.com", "grow")).toEqual({ ok: false, reason: "website", error: "That website is already shared with you." });
  });

  it("Free: the account's details only; no plan rows, no checkout state", async () => {
    m.verified = true;
    const result = await prepareGrowthPlanBilling("acme.com", "free");
    expect(result).toMatchObject({ ok: true, kind: "free", websiteId: "site-new", email: "ana@acme.com", emailVerified: true, hasPlan: false });
    expect(m.listPlans).not.toHaveBeenCalled();
    expect(m.isTrialEligible).not.toHaveBeenCalled();
    expect(m.hasUnfinishedPayPalApproval).not.toHaveBeenCalled();
  });

  it("paid: the tier's monthly and yearly plans as checkout charges them, and the account's trial and offer", async () => {
    m.planScreenOffer.mockResolvedValue("repget");
    m.isTrialEligible.mockResolvedValue(false);
    const result = await prepareGrowthPlanBilling("acme.com", "grow");
    if (!result.ok || result.kind !== "paid") throw new Error("expected paid");
    expect(result.trialEligible).toBe(false);
    expect(result.offer).toBe("repget");
    expect(result.plans.map((p) => [p.id, p.interval, p.paypal, p.repget])).toEqual([
      ["grow-m", "month", true, true],
      ["grow-y", "year", true, true],
    ]);
    expect(result.emailVerified).toBe(false);
    expect(result.conversions).toEqual([{ id: "sign_up:user-1", name: "sign_up", params: { method: "email" } }]);
    expect(m.hasUnfinishedPayPalApproval).toHaveBeenCalledWith(expect.anything(), { organizationId: "org-1", websiteId: "site-new" });
  });

  it("a website that already has a plan: nothing to buy, setup goes on", async () => {
    m.getOnboardingState.mockResolvedValue({ hasPlan: true });
    expect(await prepareGrowthPlanBilling("acme.com", "scale")).toMatchObject({ ok: true, hasPlan: true, next: "/onboarding/google?site=site-new" });
  });
});
