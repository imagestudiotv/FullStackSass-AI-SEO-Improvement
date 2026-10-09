import { eq } from "drizzle-orm";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  articles,
  networkSites,
  plans,
  platformControls,
  spendReservations,
  subscriptions,
} from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { seedCalendarItem, seedWebsite } from "@/test/fixtures";

/**
 * A new account's free articles (client, 2026-10-09 - lib/billing/
 * free-articles.ts): what the trial allows, what waits for the plan, and the
 * site-wide day's cap. Starting the plan is tested in end-free-trial.test.ts;
 * here it is replaced so the queue's call to it can be seen.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
}));
const inngestMock = vi.hoisted(() => ({
  send: vi.fn(),
  createFunction: vi.fn((config: unknown, handler: unknown) => ({ config, handler })),
}));
vi.mock("@/inngest/client", () => ({ inngest: inngestMock }));
vi.mock("@/lib/notifications/create", () => ({ notify: vi.fn() }));
const endTrial = vi.hoisted(() => ({ endFreeTrialIfUsed: vi.fn() }));
vi.mock("@/lib/billing/end-free-trial", () => endTrial);

import { inManagedNetwork } from "@/lib/articles/review";
import { grantMonthlyCredits } from "@/lib/backlinks/credits";
import { isEntitledToSpend } from "@/lib/billing/entitled";
import { FREE_ARTICLES_PER_DAY } from "@/lib/billing/free-articles";
import { getOnboardingState } from "@/lib/onboarding/steps";
import { FREE_ARTICLES, FREE_ARTICLES_ONLY } from "@/lib/plans/features";
import { checkLimit } from "@/lib/usage";
import {
  queueArticleForCalendarItem,
  requeueArticle,
} from "@/inngest/functions/generate-article";

let test: TestDb;
const DAY = 24 * 60 * 60 * 1000;

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

beforeEach(async () => {
  await test.client.exec("delete from job_outbox; delete from spend_reservations");
  inngestMock.send.mockReset();
  inngestMock.send.mockResolvedValue({ ids: ["evt"] });
  endTrial.endFreeTrialIfUsed.mockReset();
  endTrial.endFreeTrialIfUsed.mockResolvedValue("not_yet");
});

afterEach(() => {
  vi.useRealTimers();
});

/** A website on a trial of `days` that started `startedDaysAgo` days ago, on a 30-article plan. */
async function onTrial(days: number, startedDaysAgo = 1, now = Date.now()) {
  const site = await seedWebsite(test, { status: "trialing", articleLimit: 30 });
  const start = new Date(now - startedDaysAgo * DAY);
  await test.db
    .update(subscriptions)
    .set({ currentPeriodStart: start, currentPeriodEnd: new Date(start.getTime() + days * DAY) })
    .where(eq(subscriptions.websiteId, site.websiteId));
  return site;
}

async function queueNew(websiteId: string) {
  return queueArticleForCalendarItem(websiteId, await seedCalendarItem(test, websiteId));
}

describe("what the free articles allow", () => {
  it("is FREE_ARTICLES articles, whatever the plan", async () => {
    const { websiteId } = await onTrial(30);
    expect(await checkLimit(websiteId, "articles")).toMatchObject({
      limit: FREE_ARTICLES,
      used: 0,
      allowed: true,
      freeArticles: true,
    });
  });

  it("leaves a 3-day trial from before the offer on its plan's allowance", async () => {
    const { websiteId } = await onTrial(3);
    expect(await checkLimit(websiteId, "articles")).toMatchObject({ limit: 30, freeArticles: false });
  });

  it("counts them over the whole trial, even when a month ends inside it", async () => {
    // Started 31 January: the entitlement month rolls over on 28 February, two days before the trial ends.
    const start = new Date("2026-01-31T10:00:00Z");
    const { websiteId } = await seedWebsite(test, { status: "trialing" });
    await test.db
      .update(subscriptions)
      .set({ currentPeriodStart: start, currentPeriodEnd: new Date(start.getTime() + 30 * DAY) })
      .where(eq(subscriptions.websiteId, websiteId));
    await test.db.insert(spendReservations).values(
      Array.from({ length: FREE_ARTICLES }, () => ({
        key: `articles:${websiteId}`,
        operation: "article.generate",
        websiteId,
        state: "consumed",
        limitValue: FREE_ARTICLES,
        countedAt: new Date("2026-02-01T09:00:00Z"),
      })),
    );

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-03-01T09:00:00Z"));
    expect(await checkLimit(websiteId, "articles")).toMatchObject({
      used: FREE_ARTICLES,
      allowed: false,
    });
  });
});

describe("what waits for the plan", () => {
  it("refuses paid features unless the caller is part of writing the articles", async () => {
    const { websiteId } = await onTrial(30);
    expect(await isEntitledToSpend(websiteId)).toEqual({ ok: false, error: FREE_ARTICLES_ONLY });
    expect(await isEntitledToSpend(websiteId, { freeArticles: true })).toEqual({ ok: true });
  });

  it("asks nothing extra of a paying website", async () => {
    const { websiteId } = await seedWebsite(test);
    expect(await isEntitledToSpend(websiteId)).toEqual({ ok: true });
  });

  it("keeps the free articles out of the Partner Network's review", async () => {
    await test.db.insert(platformControls).values({ key: "managed_review", enabled: true, updatedBy: "test" });
    const trial = await onTrial(30);
    const paying = await seedWebsite(test);
    await test.db.insert(networkSites).values([
      { websiteId: trial.websiteId, acceptingLinks: true, monthlyCap: 3 },
      { websiteId: paying.websiteId, acceptingLinks: true, monthlyCap: 3 },
    ]);
    expect(await inManagedNetwork(trial.websiteId)).toBe(false);
    expect(await inManagedNetwork(paying.websiteId)).toBe(true);
    await test.client.exec("delete from platform_controls");
  });

  it("grants no link credits", async () => {
    const { orgId, websiteId } = await onTrial(30);
    const [sub] = await test.db
      .select({ planId: subscriptions.planId })
      .from(subscriptions)
      .where(eq(subscriptions.websiteId, websiteId));
    await test.db.update(plans).set({ monthlyCredits: 25 }).where(eq(plans.id, sub.planId!));
    expect(await grantMonthlyCredits(orgId)).toBe(0);

    await test.db.update(subscriptions).set({ status: "active" }).where(eq(subscriptions.websiteId, websiteId));
    expect(await grantMonthlyCredits(orgId)).toBe(25);
  });

  it("takes the AI visibility step out of setup", async () => {
    const trial = await onTrial(30);
    const steps = (await getOnboardingState(trial.orgId)).steps.map((step) => step.id);
    expect(steps).toEqual(["website", "plan", "content"]);
    expect((await getOnboardingState(trial.orgId)).freeArticles).toBe(true);

    const paying = await seedWebsite(test);
    expect((await getOnboardingState(paying.orgId)).steps.map((step) => step.id)).toContain("visibility");
  });
});

describe("writing the free articles", () => {
  it("queues FREE_ARTICLES, then refuses and tries to start the plan", async () => {
    const { websiteId } = await onTrial(30);
    for (let i = 0; i < FREE_ARTICLES; i++) {
      expect(await queueNew(websiteId)).toMatchObject({ ok: true });
    }
    expect(endTrial.endFreeTrialIfUsed).not.toHaveBeenCalled();

    expect(await queueNew(websiteId)).toEqual({
      ok: false,
      error: expect.stringMatching(new RegExp(`${FREE_ARTICLES} free articles have been used`)),
    });
    expect(endTrial.endFreeTrialIfUsed).toHaveBeenCalledWith(websiteId);
  });

  it("takes one of the day's free articles with each, settled with the article's own", async () => {
    const { websiteId } = await onTrial(30);
    await queueNew(websiteId);
    const event = inngestMock.send.mock.calls[0][0];
    expect(event.data.reservations.map((r: { key: string }) => r.key)).toEqual([
      `articles:${websiteId}`,
      "free-articles:global",
    ]);
    // The job's id still comes from the article's allowance.
    expect(event.id).toBe(`article-generate:${event.data.reservations[0].id}`);
  });

  it("pauses new free articles once the day's are taken, without using the account's", async () => {
    await test.db.insert(spendReservations).values(
      Array.from({ length: FREE_ARTICLES_PER_DAY }, () => ({
        key: "free-articles:global",
        operation: "article.generate",
        state: "consumed",
        limitValue: FREE_ARTICLES_PER_DAY,
        windowSeconds: 86400,
        countedAt: new Date(Date.now() - 60 * 1000),
      })),
    );
    const { websiteId } = await onTrial(30);
    expect(await queueNew(websiteId)).toEqual({ ok: false, error: expect.stringMatching(/paused/) });
    expect(await checkLimit(websiteId, "articles")).toMatchObject({ used: 0 });

    // A paying website is not held by the free articles' cap.
    const paying = await seedWebsite(test);
    expect(await queueNew(paying.websiteId)).toMatchObject({ ok: true });
  });

  it("allows a failed free article to be tried again, and nothing else to be rewritten", async () => {
    const { websiteId } = await onTrial(30);
    const itemId = await seedCalendarItem(test, websiteId);
    const [failed, written] = await test.db
      .insert(articles)
      .values([
        { websiteId, calendarItemId: itemId, title: "Failed", status: "failed" },
        { websiteId, title: "Written", status: "draft", bodyHtml: "<p>hi</p>" },
      ])
      .returning({ id: articles.id });

    expect(await requeueArticle({ websiteId, articleId: written.id, status: "generating" })).toEqual({
      ok: false,
      error: FREE_ARTICLES_ONLY,
    });
    expect(await requeueArticle({ websiteId, articleId: failed.id, status: "queued" })).toEqual({
      ok: true,
      articleId: failed.id,
    });
  });
});
