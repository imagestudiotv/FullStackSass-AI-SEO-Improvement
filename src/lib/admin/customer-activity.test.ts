import { randomUUID } from "node:crypto";

import { beforeAll, describe, expect, it, vi } from "vitest";

import { member, organization, user } from "@/lib/db/auth-tables";
import {
  agencyWorkspaces,
  articles,
  articleVersions,
  billingCheckouts,
  calendarItems,
  feedback,
  freePlanAccounts,
  lifecycleEmails,
  payments,
  plans,
  publishLogs,
  socialSuggestions,
  spendReservations,
  subscriptions,
  usageEvents,
  videoIdeas,
  websites,
} from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";

/**
 * Admin -> Customer activity's queries on a disposable database: the feed's
 * events from each table, newest first, its filters (type, plan, search,
 * our own workspaces, range), the "Needs attention" box and one workspace's
 * timeline. firstArticleStatus is stubbed: it has its own tests.
 */

vi.mock("server-only", () => ({}));
const state = vi.hoisted(() => ({ db: null as unknown, admin: true }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }) }));
vi.mock("@/lib/admin/guard", () => ({
  requireAdmin: async () => {
    if (!state.admin) throw new Error("not admin");
    return { email: "boss@repget.test" };
  },
  adminEmails: () => ["boss@repget.test"],
}));
vi.mock("@/lib/articles/first-article-status", () => ({
  firstArticleStatus: vi.fn(async () => ({ code: "research_not_started", message: "Its research has not started yet; it starts within ten minutes.", waiting: true })),
}));

import { getCustomerActivity, getCustomerTimeline } from "./customer-activity";

let test: TestDb;
const NOW = new Date();
const HOUR = 60 * 60 * 1000;
const ago = (hours: number) => new Date(NOW.getTime() - hours * HOUR);
const filters = { plan: "all", search: "", includeOurs: false };

async function account(name: string, at: Date, email = `${name}-${randomUUID().slice(0, 6)}@example.com`) {
  const userId = `u_${name}_${randomUUID().slice(0, 6)}`;
  const orgId = `org_${name}_${randomUUID().slice(0, 6)}`;
  await test.db.insert(user).values({ id: userId, name, email, createdAt: at, updatedAt: at });
  await test.db.insert(organization).values({ id: orgId, name: `${name} workspace`, slug: orgId, createdAt: at });
  await test.db.insert(member).values({ id: `m_${userId}`, organizationId: orgId, userId, role: "owner", createdAt: at });
  return { userId, orgId, email };
}

async function site(orgId: string, domain: string, at: Date, status = "ready") {
  const [row] = await test.db
    .insert(websites)
    .values({ organizationId: orgId, url: `https://${domain}`, domain, status, createdAt: at, updatedAt: at })
    .returning({ id: websites.id });
  return row.id;
}

const ids: Record<string, string> = {};

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;

  const [grow] = await test.db
    .insert(plans)
    .values({ name: "Grow", tier: `grow-${randomUUID().slice(0, 6)}`, priceCents: 4900, articleLimit: 10, keywordLimit: 10, siteLimit: 1, monthlyCredits: 0 })
    .returning({ id: plans.id });

  // Trial: started 7 h ago, ends in 5 h, nothing written, no content plan.
  const trial = await account("tara", ago(8));
  ids.trialOrg = trial.orgId;
  ids.trialSite = await site(trial.orgId, "tara-trial.example", ago(8));
  await test.db.insert(usageEvents).values({ organizationId: trial.orgId, websiteId: ids.trialSite, kind: "llm", metadata: { purpose: "onboarding_extraction" }, createdAt: ago(7.9) });
  const [sub] = await test.db
    .insert(subscriptions)
    .values({ organizationId: trial.orgId, websiteId: ids.trialSite, planId: grow.id, status: "trialing", stripeSubscriptionId: "sub_trial", currentPeriodEnd: new Date(NOW.getTime() + 5 * HOUR), createdAt: ago(7), updatedAt: ago(7) })
    .returning({ id: subscriptions.id });
  ids.trialSub = sub.id;
  await test.db.insert(billingCheckouts).values({ organizationId: trial.orgId, websiteId: ids.trialSite, provider: "stripe", planId: grow.id, status: "completed", trialDays: 3, providerSubscriptionId: "sub_trial" });
  // A research run 3 h ago that brought no plan.
  await test.db.insert(spendReservations).values({ key: `research:site:${ids.trialSite}`, operation: "research", limitValue: 3, state: "consumed", organizationId: trial.orgId, websiteId: ids.trialSite, createdAt: ago(3) });

  // Free: content plan, an article written and delivered live, a failed one, social, video, feedback.
  const free = await account("fern", ago(30 * 24));
  ids.freeOrg = free.orgId;
  ids.freeSite = await site(free.orgId, "fern-free.example", ago(30 * 24));
  await test.db.insert(freePlanAccounts).values({ organizationId: free.orgId, websiteId: ids.freeSite, domain: "fern-free.example", userId: free.userId, startedAt: ago(29 * 24) });
  await test.db.insert(calendarItems).values([1, 2, 3].map((n) => ({ websiteId: ids.freeSite, title: `Topic ${n}`, createdAt: ago(28 * 24) })));
  const [written] = await test.db.insert(articles).values({ websiteId: ids.freeSite, title: "How to brew", bodyHtml: "<p>Brew</p>", status: "published", createdAt: ago(27 * 24) }).returning({ id: articles.id });
  ids.writtenArticle = written.id;
  await test.db.insert(articleVersions).values({ articleId: written.id, bodyHtml: "<p>Brew</p>", createdAt: ago(26 * 24) });
  await test.db.insert(articleVersions).values({ articleId: written.id, bodyHtml: "<p>Brew edited</p>", createdAt: ago(2) });
  await test.db.insert(publishLogs).values({ articleId: written.id, status: "published", remoteStatus: "publish", createdAt: ago(25 * 24) });
  const [failed] = await test.db.insert(articles).values({ websiteId: ids.freeSite, title: "Broken topic", status: "failed", error: "Model timed out", createdAt: ago(4), updatedAt: ago(3) }).returning({ id: articles.id });
  ids.failedArticle = failed.id;
  await test.db.insert(socialSuggestions).values({ websiteId: ids.freeSite, platform: "linkedin", kind: "post", day: "2026-11-25", body: "Hello", status: "posted", postedAt: ago(20) });
  await test.db.insert(videoIdeas).values({ websiteId: ids.freeSite, day: "2026-11-25", style: "pov", language: "en", title: "Brew POV", script: {}, caption: "c", approvedAt: ago(22), postedAt: ago(21) });
  await test.db.insert(feedback).values({ kind: "problem", message: "The editor is slow", email: free.email, source: "app", userId: free.userId, organizationId: free.orgId, createdAt: ago(19) });

  // Paid: a successful and a failed payment, a website whose analysis failed, a cancellation.
  const paid = await account("pia", ago(60));
  ids.paidOrg = paid.orgId;
  ids.paidSite = await site(paid.orgId, "pia-paid.example", ago(60));
  await test.db.insert(calendarItems).values({ websiteId: ids.paidSite, title: "Paid topic", createdAt: ago(59) });
  ids.failedSite = await site(paid.orgId, "pia-broken.example", ago(10), "failed");
  const [paidSub] = await test.db
    .insert(subscriptions)
    .values({ organizationId: paid.orgId, websiteId: ids.paidSite, planId: grow.id, status: "active", createdAt: ago(50), updatedAt: ago(50) })
    .returning({ id: subscriptions.id });
  await test.db.insert(payments).values({ organizationId: paid.orgId, provider: "stripe", externalId: `in_${randomUUID()}`, amountCents: 4900, currency: "eur", status: "paid", description: "Grow monthly", subscriptionId: paidSub.id, paidAt: ago(48) });
  const [failedPayment] = await test.db
    .insert(payments)
    .values({ organizationId: paid.orgId, provider: "stripe", externalId: `in_${randomUUID()}`, amountCents: 8900, currency: "eur", status: "failed", description: "Scale monthly", paidAt: ago(5) })
    .returning({ id: payments.id });
  ids.failedPayment = failedPayment.id;
  await test.db.insert(lifecycleEmails).values({ organizationId: paid.orgId, scope: "organization", kind: "cancellation_confirmed", dedupeKey: `${paidSub.id}:2026-12-24T00:00:00.000Z`, status: "sent", createdAt: ago(6) });
  // Older than the default 7 days.
  await test.db.insert(payments).values({ organizationId: paid.orgId, provider: "stripe", externalId: `in_${randomUUID()}`, amountCents: 4900, currency: "eur", status: "paid", description: "Old payment", paidAt: ago(24 * 10) });

  // Ours: an agency workspace and an administrator's workspace.
  const agency = await account("agency", ago(2));
  await test.db.insert(agencyWorkspaces).values({ organizationId: agency.orgId });
  await site(agency.orgId, "our-agency.example", ago(2));
  const boss = await account("boss", ago(2), "boss@repget.test");
  await site(boss.orgId, "repget-own.example", ago(2));

  // Signed up, no workspace yet.
  ids.orphanEmail = `orphan-${randomUUID().slice(0, 6)}@example.com`;
  await test.db.insert(user).values({ id: `u_orphan_${randomUUID().slice(0, 6)}`, name: "Ozzy", email: ids.orphanEmail, createdAt: ago(1), updatedAt: ago(1) });
}, 180_000);

describe("getCustomerActivity", () => {
  it("reads every event of the last 7 days from its own table, newest first, with customer, domain and badge", async () => {
    const result = await getCustomerActivity({ filters, now: NOW });
    const kinds = new Set(result.rows.map((row) => row.kind));
    for (const kind of [
      "signup", "workspace_created", "website_added", "analysis_done", "analysis_failed", "trial_started", "plan_started",
      "plan_cancelled", "payment_paid", "payment_failed", "research_empty", "article_started", "article_failed",
      "feedback_sent",
    ]) {
      expect(kinds, kind).toContain(kind);
    }
    // Older than 7 days: free start (29 d), content plan (28 d), the written article (26 d)...
    expect(kinds).not.toContain("free_started");
    expect(result.rows.filter((row) => row.kind === "content_plan").map((row) => row.domain)).toEqual(["pia-paid.example"]);
    expect(result.rows.some((row) => row.text.includes("Old payment"))).toBe(false);

    const times = result.rows.map((row) => row.at.getTime());
    expect([...times].sort((a, b) => b - a)).toEqual(times);

    const trial = result.rows.find((row) => row.kind === "trial_started")!;
    expect(trial.text).toBe("Trial started on Grow");
    expect(trial.domain).toBe("tara-trial.example");
    expect(trial.customer.name).toBe("tara workspace");
    expect(trial.customer.badge).toEqual({ kind: "trial", label: "Trial · Grow" });
    expect(trial.customer.ownerEmail).toMatch(/^tara-/);

    const orphan = result.rows.find((row) => row.kind === "signup" && row.label === ids.orphanEmail)!;
    expect(orphan.customer).toMatchObject({ organizationId: null, name: null, ownerEmail: ids.orphanEmail });

    // Ours are hidden by default.
    expect(result.rows.some((row) => row.domain === "our-agency.example" || row.domain === "repget-own.example")).toBe(false);
    expect(result.rows.some((row) => row.label === "boss@repget.test")).toBe(false);
    expect(result.hiddenOurs).toBe(2);
    expect(result.truncated).toBe(false);
  });

  it("reads the older events on a longer range", async () => {
    const result = await getCustomerActivity({ filters, range: "30d", now: NOW });
    const kinds = new Set(result.rows.map((row) => row.kind));
    for (const kind of ["free_started", "content_plan", "article_written", "article_delivered", "social_posted", "video_approved", "video_posted"]) {
      expect(kinds, kind).toContain(kind);
    }
    expect(result.rows.find((row) => row.kind === "content_plan" && row.domain === "fern-free.example")?.text).toBe("Content plan built: 3 topics");
    // The first version only: the later edit is not a second "written".
    expect(result.rows.filter((row) => row.kind === "article_written")).toHaveLength(1);
    expect(result.rows.find((row) => row.kind === "article_delivered")?.href).toBe(`/admin/articles/${ids.writtenArticle}`);
  });

  it("filters by type, plan, search and our own workspaces, and pages back with Load older", async () => {
    const problems = await getCustomerActivity({ group: "problems", filters, now: NOW });
    expect(new Set(problems.rows.map((row) => row.group))).toEqual(new Set(["problems"]));
    expect(problems.rows.map((row) => row.kind)).toEqual(expect.arrayContaining(["payment_failed", "analysis_failed", "article_failed", "research_empty"]));

    const trials = await getCustomerActivity({ filters: { ...filters, plan: "trial" }, now: NOW });
    expect(new Set(trials.rows.map((row) => row.customer.organizationId))).toEqual(new Set([ids.trialOrg]));

    const search = await getCustomerActivity({ filters: { ...filters, search: "PIA-BROKEN" }, now: NOW });
    expect(new Set(search.rows.map((row) => row.customer.organizationId))).toEqual(new Set([ids.paidOrg]));

    const byEmail = await getCustomerActivity({ filters: { ...filters, search: ids.orphanEmail }, now: NOW });
    expect(byEmail.rows.map((row) => row.kind)).toEqual(["signup"]);

    const ours = await getCustomerActivity({ filters: { ...filters, includeOurs: true }, now: NOW });
    expect(ours.rows.some((row) => row.domain === "our-agency.example")).toBe(true);
    expect(ours.rows.some((row) => row.domain === "repget-own.example")).toBe(true);
    expect(ours.rows.find((row) => row.domain === "our-agency.example")?.customer.badge?.label).toBe("Agency");

    const older = await getCustomerActivity({ filters, before: ago(24 * 7), now: NOW });
    expect(older.rows.some((row) => row.text.includes("Old payment"))).toBe(true);
    expect(older.rows.every((row) => row.at < ago(24 * 7))).toBe(true);
    expect(older.attention).toEqual([]);
  });

  it("lists what needs attention, each with its customer, why, since when and a link", async () => {
    const { attention } = await getCustomerActivity({ filters, now: NOW });
    const rules = attention.map((item) => item.rule).sort();
    expect(rules).toEqual(["analysis_failed", "article_failed", "no_content_plan", "payment_failed", "trial_ending_no_article", "trial_no_article"]);
    const noPlan = attention.find((item) => item.rule === "no_content_plan")!;
    expect(noPlan.domain).toBe("tara-trial.example");
    expect(noPlan.why).toContain("Its research has not started yet");
    expect(attention.find((item) => item.rule === "payment_failed")?.href).toBe(`/admin/payments?org=${encodeURIComponent(ids.paidOrg)}&status=failed`);
    expect(attention.find((item) => item.rule === "article_failed")?.href).toBe(`/admin/articles/${ids.failedArticle}`);
    expect(attention.find((item) => item.rule === "trial_no_article")?.customer.name).toBe("tara workspace");
    const since = attention.map((item) => item.since.getTime());
    expect([...since].sort((a, b) => a - b)).toEqual(since);
  });

  it("is for administrators only", async () => {
    state.admin = false;
    await expect(getCustomerActivity({ filters, now: NOW })).rejects.toThrow("not admin");
    await expect(getCustomerTimeline(ids.trialOrg, NOW)).rejects.toThrow("not admin");
    state.admin = true;
  });
});

describe("getCustomerTimeline", () => {
  it("shows one workspace's whole life with its websites, plan dates, articles per day and first-article status", async () => {
    const timeline = (await getCustomerTimeline(ids.freeOrg, NOW))!;
    expect(timeline.workspace.name).toBe("fern workspace");
    expect(timeline.badge).toEqual({ kind: "free", label: "Free" });
    expect(timeline.freeStartedAt?.getTime()).toBe(ago(29 * 24).getTime());
    expect(timeline.websites.map((w) => w.domain)).toEqual(["fern-free.example"]);
    expect(timeline.websites[0].firstArticle?.code).toBe("research_not_started");
    expect(timeline.articlesPerDay.reduce((sum, day) => sum + day.started, 0)).toBe(2);
    expect(timeline.articlesPerDay.reduce((sum, day) => sum + day.written, 0)).toBe(1);
    const kinds = timeline.rows.map((row) => row.kind);
    expect(kinds).toEqual(expect.arrayContaining(["signup", "workspace_created", "free_started", "content_plan", "article_written", "article_delivered", "social_posted", "video_posted", "feedback_sent"]));
    expect(new Set(timeline.rows.map((row) => row.customer.organizationId))).toEqual(new Set([ids.freeOrg]));
    expect(timeline.attention.map((item) => item.rule)).toEqual(["article_failed"]);

    const trial = (await getCustomerTimeline(ids.trialOrg, NOW))!;
    expect(trial.subscriptions[0]).toMatchObject({ planName: "Grow", status: "trialing", trial: true });
    expect(trial.subscriptions[0].periodEnd?.getTime()).toBe(NOW.getTime() + 5 * HOUR);

    expect(await getCustomerTimeline("org_missing", NOW)).toBeNull();
  });
});
