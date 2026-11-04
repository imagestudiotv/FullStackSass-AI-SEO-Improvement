import { describe, expect, it } from "vitest";

import { activationProblems, CATALOG_VERSION, catalogRows, TIERS } from "../../../scripts/plan-catalog.mjs";
import { planFeatures, signUpForPlan } from "./features";

/** What the plans table should hold for a catalog that is ready to sell. */
const readyRows = () =>
  catalogRows().map((row) => ({
    tier: row.tier,
    interval: row.interval,
    currency: "eur",
    price_cents: row.priceCents,
    article_limit: row.articleLimit,
    social_post_limit: row.socialPostLimit,
    stripe_price_id: `price_${row.tier}_${row.interval}`,
  }));

describe("the plan catalog", () => {
  it("is the client's line-up (design of 2026-11-04)", () => {
    expect(TIERS.map((t) => [t.name, t.monthlyCents, t.articleLimit, t.socialPostLimit])).toEqual([
      ["Launch", 9900, 30, 60],
      ["Grow", 14900, 60, 90],
      ["Scale", 34900, 100, 240],
    ]);
  });

  it("is a new version, so no plan a subscriber holds is repriced", () => {
    expect(CATALOG_VERSION).toBeGreaterThan(1);
  });

  it("gives every tier a monthly row and an annual row at ten months' price", () => {
    const rows = catalogRows();
    expect(rows).toHaveLength(TIERS.length * 2);
    for (const tier of TIERS) {
      const annual = rows.find((row) => row.tier === tier.tier && row.interval === "year");
      expect(annual?.priceCents).toBe(tier.monthlyCents * 10);
      expect(annual?.name).toBe(`${tier.name} (Annual)`);
    }
  });

  it("gives each plan enough credits for the social posts it advertises, at the client's 1 credit a post", () => {
    for (const tier of TIERS) expect(tier.monthlyCredits).toBeGreaterThanOrEqual(tier.socialPostLimit);
  });

  it("gets more expensive and larger up the line", () => {
    const by = (key: "monthlyCents" | "articleLimit" | "socialPostLimit") => TIERS.map((t) => t[key]);
    for (const key of ["monthlyCents", "articleLimit", "socialPostLimit"] as const) {
      expect(by(key)).toEqual([...by(key)].sort((a, b) => a - b));
    }
  });
});

describe("activating a catalog", () => {
  it("allows a complete catalog with every Stripe price", () => {
    expect(activationProblems(readyRows())).toEqual([]);
  });

  it("refuses a plan nobody could pay for, unless told this is a local database", () => {
    const rows = readyRows().map((row) => (row.tier === "launch" ? { ...row, stripe_price_id: null } : row));
    expect(activationProblems(rows)).toEqual([
      "launch/month: no Stripe price - run stripe:setup",
      "launch/year: no Stripe price - run stripe:setup",
    ]);
    expect(activationProblems(rows, { requireStripe: false })).toEqual([]);
  });

  it("refuses a missing row, even locally", () => {
    const rows = readyRows().filter((row) => !(row.tier === "scale" && row.interval === "year"));
    expect(activationProblems(rows, { requireStripe: false })).toEqual(["scale/year: not in the database - run db:seed"]);
  });

  it("refuses a row that has drifted from the catalog, even locally", () => {
    const rows = readyRows().map((row) => (row.tier === "grow" && row.interval === "month" ? { ...row, price_cents: 9900 } : row));
    expect(activationProblems(rows, { requireStripe: false })).toEqual(["grow/month: differs from scripts/plan-catalog.mjs - run db:seed"]);
  });
});

describe("the plan surfaces", () => {
  const picker = { id: "p", name: "Grow", currency: "eur", interval: "month", priceCents: 14900, keywordLimit: 300, siteLimit: 3, monthlyCredits: 250 };

  it("carries a plan's button through the website step to the plan step", () => {
    expect(signUpForPlan("launch")).toBe("/sign-up?next=%2Fonboarding%2Fwebsite%3Fplan%3Dlaunch");
  });

  it("states the plan's own articles and social posts", () => {
    const features = planFeatures({ ...picker, tier: "grow", articleLimit: 60, socialPostLimit: 90 });
    expect(features).toContain("60 branded articles a month - 2 a day, with images");
    expect(features).toContain("90 social posts a month");
  });

  it("states no social posts for a plan from before they were stated", () => {
    const features = planFeatures({ ...picker, tier: "grow", articleLimit: 30, socialPostLimit: 0 });
    expect(features.some((line) => line.includes("social posts"))).toBe(false);
  });
});
