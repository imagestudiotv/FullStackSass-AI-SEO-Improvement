import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { articles, audits, creditLedger, creditSettings, freePlanAccounts, freePlanEvents, plans, subscriptions, usageEvents, websites } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { seedWebsite } from "@/test/fixtures";

/**
 * The Free plan (Daniel, 2026-11-19) on a real in-process database: starting
 * it (idempotent, one per workspace / website / domain, a confirmed email,
 * the launch cap), its limits, what stays locked, and the AI cost
 * protection - the per-account monthly cap and the day's kill switch.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
  isDatabaseConfigured: () => true,
}));
async function contextFor(websiteId: string) {
  const db = state.db as TestDb["db"];
  const [site] = await db.select().from(websites).where(eq(websites.id, websiteId));
  return { site, orgId: site.organizationId, ownerOrgId: site.organizationId, userId: "owner", access: "owner" as const };
}
vi.mock("@/lib/tenant", () => ({ requireWebsite: vi.fn(contextFor) }));
vi.mock("@/lib/websites/require-editor", () => ({
  requireEditor: vi.fn(async (id: string) => ({ ok: true, context: await contextFor(id) })),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/admin/guard", () => ({ requireAdmin: async () => ({ email: "admin@repget.test" }) }));
vi.mock("@/lib/i18n/app-locale", async () => {
  const { getMessages } = await import("@/lib/i18n/messages");
  return { getAppMessages: async () => ({ t: getMessages("en"), locale: "en" }) };
});
const inngestMock = vi.hoisted(() => ({
  send: vi.fn(),
  createFunction: vi.fn((config: unknown, handler: unknown) => ({ config, handler })),
}));
vi.mock("@/inngest/client", () => ({ inngest: inngestMock }));
vi.mock("@/lib/ai/client", () => ({
  anthropic: { messages: { create: vi.fn() } },
  isAiConfigured: () => true,
  MODELS: { GENERATION: "claude-sonnet-5", EXTRACTION: "claude-haiku-4-5" },
}));

import { requeueArticle } from "@/inngest/functions/generate-article";
import { ensureMonthlyCredits } from "@/lib/backlinks/credits";
import { listPlans } from "@/lib/billing";
import { isEntitledToSpend } from "@/lib/billing/entitled";
import { startAudit } from "@/lib/audit/actions";
import { freePerDayFor } from "@/lib/chat/quota";
import { runGeoCheck } from "@/lib/geo/actions";
import { socialAccess } from "@/lib/social/accounts";
import { checkLimit } from "@/lib/usage";
import { videoAccess } from "@/lib/video/settings";
import {
  FREE_PLAN,
  FREE_PLAN_LOCKED,
  FREE_PLAN_PAUSED,
  FREE_PLAN_PAUSED_TODAY,
  freePlanCounter,
  freePlanDisplay,
  freePlanMessage,
  isRetiredFromSale,
  localiseFreePlanMessage,
} from "./free-plan";
import {
  FREE_PLAN_CAP_KEY,
  freePlanDaySpendCents,
  freePlanPause,
  isFreePlanWebsite,
  mayCheckoutTier,
  readFreePlanCap,
  recordFreePlanEvent,
  startFreePlan,
} from "./free-plan-server";

let test: TestDb;
beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});
beforeEach(async () => {
  inngestMock.send.mockReset();
  inngestMock.send.mockResolvedValue({ ids: [] });
  // Every test starts with no Free accounts and no cap setting, so counts are its own.
  await test.db.delete(freePlanAccounts);
  await test.db.delete(creditSettings);
  await test.db.delete(usageEvents);
});
afterEach(() => {
  vi.unstubAllEnvs();
});

/** A workspace with one website and no plan. */
async function unpaidSite(domain?: string) {
  const { orgId, websiteId } = await seedWebsite(test, { status: null });
  if (domain) await test.db.update(websites).set({ domain }).where(eq(websites.id, websiteId));
  return { orgId, websiteId };
}

async function startFree(site: { orgId: string; websiteId: string }, emailVerified = true) {
  return startFreePlan({ organizationId: site.orgId, userId: null, websiteId: site.websiteId, emailVerified });
}

describe("starting Free", () => {
  it("needs a confirmed email", async () => {
    const site = await unpaidSite();
    expect(await startFree(site, false)).toEqual({ ok: false, reason: "email_unverified" });
    expect(await isFreePlanWebsite(site.websiteId)).toBe(false);
  });

  it("starts once, and a second press answers ok without a second row (idempotent)", async () => {
    const site = await unpaidSite();
    expect(await startFree(site)).toEqual({ ok: true, alreadyStarted: false });
    expect(await startFree(site)).toEqual({ ok: true, alreadyStarted: true });
    const rows = await test.db.select().from(freePlanAccounts).where(eq(freePlanAccounts.organizationId, site.orgId));
    expect(rows).toHaveLength(1);
    expect(await isFreePlanWebsite(site.websiteId)).toBe(true);
  });

  it("covers one website per workspace", async () => {
    const site = await unpaidSite();
    await startFree(site);
    const [second] = await test.db
      .insert(websites)
      .values({ organizationId: site.orgId, url: "https://second.example", domain: "second.example", status: "ready" })
      .returning();
    expect(await startFree({ orgId: site.orgId, websiteId: second.id })).toEqual({ ok: false, reason: "other_website" });
  });

  it("refuses a domain already on another Free account, www or not", async () => {
    const domain = `shop-${randomUUID().slice(0, 8)}.example`;
    await startFree(await unpaidSite(domain));
    expect(await startFree(await unpaidSite(`www.${domain.toUpperCase()}`))).toEqual({ ok: false, reason: "domain_taken" });
  });

  it("refuses a website that already pays, and a website of another workspace", async () => {
    const paid = await seedWebsite(test, { status: "active" });
    expect(await startFree(paid)).toEqual({ ok: false, reason: "has_plan" });
    const other = await unpaidSite();
    expect(await startFreePlan({ organizationId: other.orgId, userId: null, websiteId: paid.websiteId, emailVerified: true })).toEqual({
      ok: false,
      reason: "not_found",
    });
  });

  it("stops at the cap: the next sign-up gets no Free allowance", async () => {
    await test.db.insert(creditSettings).values({ key: FREE_PLAN_CAP_KEY, value: 2 });
    expect(await readFreePlanCap()).toBe(2);
    expect((await startFree(await unpaidSite())).ok).toBe(true);
    expect((await startFree(await unpaidSite())).ok).toBe(true);
    const late = await unpaidSite();
    expect(await startFree(late)).toEqual({ ok: false, reason: "full" });
    expect((await checkLimit(late.websiteId, "articles")).reason).toBe("no_active_plan");
  });

  it("takes the cap from FREE_PLAN_CAP when no administrator set one, else 500", async () => {
    expect(await readFreePlanCap()).toBe(500);
    vi.stubEnv("FREE_PLAN_CAP", "120");
    expect(await readFreePlanCap()).toBe(120);
  });

  it("moves to a new website when the Free one was deleted, without taking another spot", async () => {
    const site = await unpaidSite();
    await startFree(site);
    await test.db.delete(websites).where(eq(websites.id, site.websiteId));
    const [next] = await test.db
      .insert(websites)
      .values({ organizationId: site.orgId, url: "https://next.example", domain: `next-${randomUUID().slice(0, 6)}.example`, status: "ready" })
      .returning();
    expect(await startFree({ orgId: site.orgId, websiteId: next.id })).toEqual({ ok: true, alreadyStarted: false });
    expect(await test.db.select().from(freePlanAccounts).where(eq(freePlanAccounts.organizationId, site.orgId))).toHaveLength(1);
  });
});

describe("Free's allowances", () => {
  it("are FREE_PLAN's: 4 articles a month and 10 search terms", async () => {
    const site = await unpaidSite();
    await startFree(site);
    expect(await checkLimit(site.websiteId, "articles")).toMatchObject({ allowed: true, limit: FREE_PLAN.articlesPerMonth, free: true });
    expect(await checkLimit(site.websiteId, "keywords")).toMatchObject({ limit: FREE_PLAN.searchTerms, free: true });
  });

  it("give way to a plan once bought: the subscription's limits, and nothing locked", async () => {
    const site = await unpaidSite();
    await startFree(site);
    const [plan] = await test.db
      .insert(plans)
      .values({ name: "Grow", tier: `test_${randomUUID()}`, priceCents: 14900, articleLimit: 60, keywordLimit: 500, siteLimit: 1, monthlyCredits: 0 })
      .returning();
    await test.db.insert(subscriptions).values({ organizationId: site.orgId, websiteId: site.websiteId, planId: plan.id, status: "trialing", currentPeriodStart: new Date() });
    const limit = await checkLimit(site.websiteId, "keywords");
    expect(limit.limit).toBe(500);
    expect(limit.free).toBeUndefined();
    expect(await isFreePlanWebsite(site.websiteId)).toBe(false);
    expect(await isEntitledToSpend(site.websiteId)).toEqual({ ok: true });
  });

  it("grant no credits: the social posts are a monthly limit of their own (lib/social/social.test.ts), so nothing piles up", async () => {
    const site = await unpaidSite();
    await startFree(site);
    await ensureMonthlyCredits(site.orgId);
    await ensureMonthlyCredits(site.orgId);
    expect(await test.db.select().from(creditLedger).where(eq(creditLedger.organizationId, site.orgId))).toEqual([]);
  });

  it("allow 3 Growth Copilot messages a day, where a paid workspace has 5", async () => {
    const site = await unpaidSite();
    await startFree(site);
    expect(await freePerDayFor(site.orgId)).toBe(FREE_PLAN.copilotPerDay);
    expect(await freePerDayFor((await seedWebsite(test, { status: "active" })).orgId)).toBe(5);
  });
});

describe("what Free may spend on", () => {
  it("writes articles and checks its website, and posts to every platform", async () => {
    const site = await unpaidSite();
    await startFree(site);
    expect(await isEntitledToSpend(site.websiteId, { freeArticles: true })).toEqual({ ok: true });
    expect(await isEntitledToSpend(site.websiteId, { free: true })).toEqual({ ok: true });
    expect((await socialAccess(site.websiteId)).level).toBe("paid");
  });

  it("needs an upgrade for everything else - locked by default - and for AI video", async () => {
    const site = await unpaidSite();
    await startFree(site);
    expect(await isEntitledToSpend(site.websiteId)).toEqual({ ok: false, error: FREE_PLAN_LOCKED });
    expect(await isEntitledToSpend(site.websiteId, { freeArticles: true, free: false })).toEqual({ ok: false, error: FREE_PLAN_LOCKED });
    expect(await videoAccess(site.websiteId)).toBe("none");
  });

  it("runs one limited SEO audit a month", async () => {
    const site = await unpaidSite();
    await startFree(site);
    expect(await startAudit(site.websiteId)).toEqual({ ok: true, data: null });
    await test.db.insert(audits).values({ websiteId: site.websiteId, score: 70 });
    expect(await startAudit(site.websiteId)).toEqual({ ok: false, error: freePlanMessage("auditUsed") });
  });

  it("takes one AI visibility snapshot a month, and only when its owner asks", async () => {
    const site = await unpaidSite();
    await startFree(site);
    const { geoPrompts } = await import("@/lib/db/schema");
    await test.db.insert(geoPrompts).values({ websiteId: site.websiteId, prompt: "best florist in Dublin", active: true });
    expect(await runGeoCheck(site.websiteId)).toEqual({ ok: true, data: null });
    // The second press this month is refused by the slot even before any result is written.
    expect((await runGeoCheck(site.websiteId)).ok).toBe(false);
  });
});

describe("the AI cost protection", () => {
  /** A recorded AI cost; without a website, as a deleted website's rows are. */
  async function spend(orgId: string, usd: number, at = new Date(), websiteId: string | null = null) {
    await test.db.insert(usageEvents).values({ organizationId: orgId, websiteId, kind: "llm", costUsd: usd.toFixed(6), createdAt: at });
  }

  /** A workspace paying for one website, with a second website on Free. */
  async function paidAndFree() {
    const paid = await seedWebsite(test, { status: "active" });
    const [second] = await test.db
      .insert(websites)
      .values({ organizationId: paid.orgId, url: "https://side.example", domain: `side-${randomUUID().slice(0, 8)}.example`, status: "ready" })
      .returning();
    const free = { orgId: paid.orgId, websiteId: second.id };
    expect(await startFree(free)).toEqual({ ok: true, alreadyStarted: false });
    return { paid, free };
  }

  it("counts the Free website's own spend, not the paid website's beside it in the same workspace", async () => {
    vi.stubEnv("FREE_PLAN_MONTHLY_AI_COST_CAP_CENTS", "300");
    vi.stubEnv("FREE_PLAN_DAILY_AI_BUDGET_CENTS", "100000");
    const { paid, free } = await paidAndFree();
    await spend(paid.orgId, 40, new Date(), paid.websiteId);
    // Rows with no website left (a deleted one) are not Free's either while the workspace pays: they may be the paid one's.
    await spend(paid.orgId, 40);
    expect(await freePlanPause(free.websiteId)).toEqual({ paused: false });
    expect(await isEntitledToSpend(free.websiteId, { freeArticles: true })).toEqual({ ok: true });
    await spend(free.orgId, 3, new Date(), free.websiteId);
    expect(await freePlanPause(free.websiteId)).toEqual({ paused: true, reason: "monthly_cap" });
    expect(await isEntitledToSpend(paid.websiteId)).toEqual({ ok: true });
  });

  it("counts the Free website of a workspace that pays for another in the day's budget, and only it", async () => {
    vi.stubEnv("FREE_PLAN_MONTHLY_AI_COST_CAP_CENTS", "100000");
    vi.stubEnv("FREE_PLAN_DAILY_AI_BUDGET_CENTS", "500");
    const { paid, free } = await paidAndFree();
    await spend(paid.orgId, 100, new Date(), paid.websiteId);
    expect(await freePlanDaySpendCents()).toBe(0);
    await spend(free.orgId, 5, new Date(), free.websiteId);
    expect(await freePlanDaySpendCents()).toBe(500);
    expect(await isEntitledToSpend(free.websiteId, { freeArticles: true })).toEqual({ ok: false, error: FREE_PLAN_PAUSED_TODAY });
  });

  it("keeps a deleted Free website's month: starting Free on a new website does not reset the cap", async () => {
    vi.stubEnv("FREE_PLAN_MONTHLY_AI_COST_CAP_CENTS", "300");
    vi.stubEnv("FREE_PLAN_DAILY_AI_BUDGET_CENTS", "100000");
    const site = await unpaidSite();
    await startFree(site);
    await spend(site.orgId, 3.5, new Date(), site.websiteId);
    await test.db.delete(websites).where(eq(websites.id, site.websiteId));
    const [next] = await test.db
      .insert(websites)
      .values({ organizationId: site.orgId, url: "https://again.example", domain: `again-${randomUUID().slice(0, 6)}.example`, status: "ready" })
      .returning();
    await startFree({ orgId: site.orgId, websiteId: next.id });
    expect(await freePlanPause(next.id)).toEqual({ paused: true, reason: "monthly_cap" });
  });

  it("pauses one Free workspace at its monthly AI cost cap, not the others", async () => {
    vi.stubEnv("FREE_PLAN_MONTHLY_AI_COST_CAP_CENTS", "300");
    vi.stubEnv("FREE_PLAN_DAILY_AI_BUDGET_CENTS", "100000");
    const heavy = await unpaidSite();
    const light = await unpaidSite();
    await startFree(heavy);
    await startFree(light);
    await spend(heavy.orgId, 2.99, new Date(), heavy.websiteId);
    expect(await freePlanPause(heavy.websiteId)).toEqual({ paused: false });
    await spend(heavy.orgId, 0.02, new Date(), heavy.websiteId);
    expect(await freePlanPause(heavy.websiteId)).toEqual({ paused: true, reason: "monthly_cap" });
    expect(await isEntitledToSpend(heavy.websiteId, { freeArticles: true })).toEqual({ ok: false, error: FREE_PLAN_PAUSED });
    expect(await isEntitledToSpend(light.websiteId, { freeArticles: true })).toEqual({ ok: true });
  });

  it("counts only this month's spend toward the cap", async () => {
    vi.stubEnv("FREE_PLAN_MONTHLY_AI_COST_CAP_CENTS", "300");
    const site = await unpaidSite();
    await startFree(site);
    await spend(site.orgId, 50, new Date(Date.UTC(2020, 0, 15)), site.websiteId);
    expect(await freePlanPause(site.websiteId)).toEqual({ paused: false });
  });

  it("pauses every Free workspace once all of them together reach the day's budget", async () => {
    vi.stubEnv("FREE_PLAN_DAILY_AI_BUDGET_CENTS", "500");
    const a = await unpaidSite();
    const b = await unpaidSite();
    await startFree(a);
    await startFree(b);
    await spend(a.orgId, 2.5, new Date(), a.websiteId);
    await spend(b.orgId, 2.5, new Date(), b.websiteId);
    expect(await freePlanPause(b.websiteId)).toEqual({ paused: true, reason: "daily_budget" });
    // A paying workspace's spend is not Free spend, and it is never paused.
    const paid = await seedWebsite(test, { status: "active" });
    await spend(paid.orgId, 100);
    expect(await isEntitledToSpend(paid.websiteId)).toEqual({ ok: true });
  });

  it("stops all Free generation when the daily budget is set to 0 (the kill switch)", async () => {
    vi.stubEnv("FREE_PLAN_DAILY_AI_BUDGET_CENTS", "0");
    const site = await unpaidSite();
    await startFree(site);
    expect(await isEntitledToSpend(site.websiteId, { freeArticles: true })).toEqual({ ok: false, error: FREE_PLAN_PAUSED_TODAY });
  });

  it("says what is true when paused or out of posts: upgrade, or wait - never that credits help", () => {
    for (const locale of ["en", "es", "fr", "it", "de"] as const) {
      for (const key of ["paused", "pausedToday", "postsUsed"] as const) {
        expect(freePlanMessage(key, locale)).not.toMatch(/credit|crédit/i);
      }
    }
  });
});

describe("rewriting an article on Free", () => {
  async function article(websiteId: string, status: string) {
    const [row] = await test.db.insert(articles).values({ websiteId, title: "Soft light", targetKeyword: "soft light", status }).returning();
    return row;
  }

  it("is refused for a written article - a rewrite takes no article from the month - while a failed one may be tried again", async () => {
    const site = await unpaidSite();
    await startFree(site);
    const written = await article(site.websiteId, "draft");
    expect(await requeueArticle({ websiteId: site.websiteId, articleId: written.id, status: "queued" })).toEqual({
      ok: false,
      error: freePlanMessage("rewriteLocked"),
    });
    const [unchanged] = await test.db.select().from(articles).where(eq(articles.id, written.id));
    expect(unchanged.status).toBe("draft");
    expect(localiseFreePlanMessage(freePlanMessage("rewriteLocked"), "fr")).toBe(freePlanMessage("rewriteLocked", "fr"));

    const failed = await article(site.websiteId, "failed");
    expect(await requeueArticle({ websiteId: site.websiteId, articleId: failed.id, status: "queued" })).toMatchObject({ ok: true });
  });
});

describe("Launch, retired from sale", () => {
  it("leaves the plans on sale, while its subscribers may still switch billing period on it", async () => {
    const tag = randomUUID().slice(0, 6);
    const [launch] = await test.db
      .insert(plans)
      .values({ name: "Launch", tier: "launch", interval: `month_${tag}`, priceCents: 9900, articleLimit: 30, keywordLimit: 300, siteLimit: 3, monthlyCredits: 250, isActive: true })
      .returning();
    expect((await listPlans()).some((plan) => plan.tier === "launch")).toBe(false);
    expect(isRetiredFromSale("launch")).toBe(true);

    const newcomer = await unpaidSite();
    expect(await mayCheckoutTier(newcomer.websiteId, "launch")).toBe(false);
    expect(await mayCheckoutTier(newcomer.websiteId, "grow")).toBe(true);

    const subscriber = await unpaidSite();
    await test.db.insert(subscriptions).values({ organizationId: subscriber.orgId, websiteId: subscriber.websiteId, planId: launch.id, status: "active" });
    expect(await mayCheckoutTier(subscriber.websiteId, "launch")).toBe(true);
    await test.db.delete(subscriptions).where(eq(subscriptions.planId, launch.id));
    await test.db.delete(plans).where(eq(plans.id, launch.id));
  });
});

describe("the Free card's data (shared by every surface)", () => {
  it("is the card's words and figures, in every language", () => {
    const card = freePlanDisplay("en", freePlanCounter(430, 500));
    expect(card).toMatchObject({ name: "Free", price: "€0", priceCents: 0, cta: "Start Free · No card required" });
    expect(card.features[0]).toBe("**4 AI SEO articles** per month");
    expect(card.counter).toMatchObject({ taken: 430, cap: 500, percent: 86, full: false, text: "430 / 500 free spots taken" });
    for (const locale of ["es", "fr", "it", "de"] as const) {
      expect(freePlanDisplay(locale).features).toHaveLength(7);
      expect(freePlanDisplay(locale).features.join(" ")).not.toContain("{");
    }
  });

  it("says the spots are taken at the cap and sends the button to the paid plans' free trial", () => {
    const card = freePlanDisplay("en", freePlanCounter(500, 500));
    expect(card.counter?.full).toBe(true);
    expect(card.cta).toBe("Start a 3-day free trial");
    expect(card.ctaHref).toContain("plan%3Dgrow");
    expect(card.fullNote).toContain("3-day free trial");
  });

  it("puts a server's English Free line into the reader's language", () => {
    expect(localiseFreePlanMessage(freePlanMessage("auditUsed"), "de")).toBe(freePlanMessage("auditUsed", "de"));
    expect(localiseFreePlanMessage("Something else", "de")).toBe("Something else");
  });
});


describe("Admin -> Free plan launch", () => {
  it("counts signups, milestones, upgrade clicks and spend, and sets the cap without a deploy", async () => {
    const { getFreePlanLaunch, setFreePlanCap } = await import("@/lib/admin/free-plan");
    const { freePlanEvents, usageEvents: usage } = await import("@/lib/db/schema");
    const a = await unpaidSite();
    const b = await unpaidSite();
    await startFree(a);
    await startFree(b);
    await test.db.insert(usage).values({ organizationId: a.orgId, websiteId: a.websiteId, kind: "llm", costUsd: "1.250000" });
    await test.db.insert(freePlanEvents).values({ organizationId: b.orgId, kind: "upgrade_click", source: "indicator" });

    const data = await getFreePlanLaunch();
    expect(data.taken).toBe(2);
    expect(data.cap).toBe(500);
    expect(data.launchedAt).not.toBeNull();
    expect(data.totals.spendCents).toBe(125);
    expect(data.totals.averageCents).toBe(63);
    expect(data.totals.upgradeClicks).toBe(1);
    expect(data.totals.supportRequests).toBe(0);
    expect(data.perDay).toHaveLength(30);
    expect(data.accounts.find((row) => row.organizationId === a.orgId)?.spendTotalCents).toBe(125);

    expect(await setFreePlanCap(120)).toEqual({ ok: true });
    expect(await readFreePlanCap()).toBe(120);
    expect((await setFreePlanCap(-1)).ok).toBe(false);
    // The counter is fresh on the homepage and the pricing page, in every language.
    const { revalidatePath } = await import("next/cache");
    const paths = vi.mocked(revalidatePath).mock.calls.map((call) => call[0]);
    expect(paths).toEqual(expect.arrayContaining(["/", "/pricing", "/de", "/de/pricing"]));
  });

  it("puts only the Free website's spend on its row, not a paid website's beside it", async () => {
    const { getFreePlanLaunch } = await import("@/lib/admin/free-plan");
    const paid = await seedWebsite(test, { status: "active" });
    const [side] = await test.db
      .insert(websites)
      .values({ organizationId: paid.orgId, url: "https://side.example", domain: `side-${randomUUID().slice(0, 8)}.example`, status: "ready" })
      .returning();
    await startFree({ orgId: paid.orgId, websiteId: side.id });
    await test.db.insert(usageEvents).values([
      { organizationId: paid.orgId, websiteId: paid.websiteId, kind: "llm", costUsd: "20.000000" },
      { organizationId: paid.orgId, websiteId: side.id, kind: "llm", costUsd: "0.500000" },
    ]);
    const row = (await getFreePlanLaunch()).accounts.find((account) => account.organizationId === paid.orgId);
    expect(row).toMatchObject({ spendTotalCents: 50, spendMonthCents: 50 });
  });

  it("records an upgrade click at most once a minute per workspace and prompt", async () => {
    const site = await unpaidSite();
    await startFree(site);
    const now = new Date("2026-12-03T10:00:00Z");
    const click = (source: string, at: Date) => recordFreePlanEvent({ organizationId: site.orgId, userId: null, kind: "upgrade_click", source }, at);
    await click("indicator", now);
    await click("indicator", new Date(now.getTime() + 10_000));
    await click("videos", new Date(now.getTime() + 10_000));
    await click("indicator", new Date(now.getTime() + 61_000));
    const rows = await test.db.select().from(freePlanEvents).where(eq(freePlanEvents.organizationId, site.orgId));
    expect(rows.map((row) => row.source).sort()).toEqual(["indicator", "indicator", "videos"]);
  });
});

describe("the Partner Network", () => {
  it("never lists a Free website to receive a link, while a paying one is listed", async () => {
    const { onFreePlan } = await import("./free-plan-server");
    const { sql } = await import("drizzle-orm");
    const free = await unpaidSite();
    await startFree(free);
    const paid = await seedWebsite(test, { status: "active" });
    const rows = await test.db
      .select({ id: websites.id, free: sql<boolean>`${onFreePlan(websites.id)}` })
      .from(websites)
      .where(sql`${websites.id} in (${free.websiteId}, ${paid.websiteId})`);
    expect(Object.fromEntries(rows.map((row) => [row.id, row.free]))).toEqual({ [free.websiteId]: true, [paid.websiteId]: false });
  });
});
