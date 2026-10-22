import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { articles, notifications, subscriptions } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { seedWebsite } from "@/test/fixtures";

/**
 * Starting the plan once a new account's free articles are written
 * (lib/billing/end-free-trial.ts). Stripe and the webhook's sync are
 * replaced at their boundary; nothing leaves the process.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
}));
const stripeMock = vi.hoisted(() => ({ retrieve: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/stripe/client", () => ({
  stripe: { subscriptions: { retrieve: stripeMock.retrieve, update: stripeMock.update } },
}));
const sync = vi.hoisted(() => ({ syncStripeSubscription: vi.fn() }));
vi.mock("@/lib/billing/stripe-events", () => sync);

import { endFreeTrialIfUsed } from "@/lib/billing/end-free-trial";
import { FREE_ARTICLES } from "@/lib/plans/features";

let test: TestDb;
const DAY = 24 * 60 * 60 * 1000;

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

beforeEach(() => {
  stripeMock.retrieve.mockReset();
  stripeMock.retrieve.mockResolvedValue({ status: "trialing" });
  stripeMock.update.mockReset();
  stripeMock.update.mockResolvedValue({});
  sync.syncStripeSubscription.mockReset();
});

/** A website on a 30-day free-articles trial at Stripe, started a day ago. */
async function onFreeArticles(trialDays = 30) {
  const site = await seedWebsite(test, { status: "trialing" });
  const start = new Date(Date.now() - DAY);
  const subscriptionId = `sub_${site.websiteId.slice(0, 8)}`;
  await test.db
    .update(subscriptions)
    .set({
      provider: "stripe",
      stripeSubscriptionId: subscriptionId,
      currentPeriodStart: start,
      currentPeriodEnd: new Date(start.getTime() + trialDays * DAY),
    })
    .where(eq(subscriptions.websiteId, site.websiteId));
  return { ...site, subscriptionId };
}

async function written(websiteId: string, n: number, body: string | null = "<p>hi</p>") {
  await test.db.insert(articles).values(
    Array.from({ length: n }, (_, i) => ({ websiteId, title: `Article ${i}`, status: body ? "draft" : "failed", bodyHtml: body })),
  );
}

describe("starting the plan after the free articles", () => {
  it("waits until all of them are written", async () => {
    const { websiteId } = await onFreeArticles();
    await written(websiteId, FREE_ARTICLES - 1);
    // One that failed is not a written article.
    await written(websiteId, 1, null);

    expect(await endFreeTrialIfUsed(websiteId)).toBe("not_yet");
    expect(stripeMock.update).not.toHaveBeenCalled();
  });

  it("ends the trial at Stripe once they are, once, and records the paid plan at once", async () => {
    const { websiteId, subscriptionId } = await onFreeArticles();
    await written(websiteId, FREE_ARTICLES);

    expect(await endFreeTrialIfUsed(websiteId)).toBe("ended");
    expect(stripeMock.update).toHaveBeenCalledWith(
      subscriptionId,
      { trial_end: "now" },
      { idempotencyKey: `free-articles-used:${subscriptionId}` },
    );
    expect(sync.syncStripeSubscription).toHaveBeenCalledWith(subscriptionId);
  });

  it("does not touch a trial Stripe has already ended", async () => {
    const { websiteId, subscriptionId } = await onFreeArticles();
    await written(websiteId, FREE_ARTICLES);
    stripeMock.retrieve.mockResolvedValue({ status: "active" });

    expect(await endFreeTrialIfUsed(websiteId)).toBe("ended");
    expect(stripeMock.update).not.toHaveBeenCalled();
    expect(sync.syncStripeSubscription).toHaveBeenCalledWith(subscriptionId);
  });

  it("leaves paying websites and older 3-day trials alone", async () => {
    const paying = await seedWebsite(test);
    await written(paying.websiteId, FREE_ARTICLES);
    expect(await endFreeTrialIfUsed(paying.websiteId)).toBe("not_on_free_articles");

    const legacy = await onFreeArticles(3);
    await written(legacy.websiteId, FREE_ARTICLES);
    expect(await endFreeTrialIfUsed(legacy.websiteId)).toBe("not_on_free_articles");
    expect(stripeMock.retrieve).not.toHaveBeenCalled();
  });

  it("never throws when Stripe cannot be reached", async () => {
    const { websiteId } = await onFreeArticles();
    await written(websiteId, FREE_ARTICLES);
    stripeMock.retrieve.mockRejectedValue(new Error("connection reset"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await endFreeTrialIfUsed(websiteId)).toBe("failed");
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});

describe("through PayPal, which cannot cut the free days short", () => {
  /** A website on its free articles through PayPal, started a day ago. */
  async function onPayPalFreeArticles() {
    const site = await seedWebsite(test, { status: "trialing" });
    const start = new Date(Date.now() - DAY);
    await test.db
      .update(subscriptions)
      .set({
        provider: "paypal",
        paypalSubscriptionId: `I-${site.websiteId.slice(0, 8)}`,
        currentPeriodStart: start,
        currentPeriodEnd: new Date(start.getTime() + 30 * DAY),
      })
      .where(eq(subscriptions.websiteId, site.websiteId));
    return site;
  }

  const told = (organizationId: string) =>
    test.db.select().from(notifications).where(eq(notifications.organizationId, organizationId));

  it("waits for all of them, then tells the customer once that the plan now waits for them", async () => {
    const { orgId, websiteId } = await onPayPalFreeArticles();
    await written(websiteId, FREE_ARTICLES - 1);
    expect(await endFreeTrialIfUsed(websiteId)).toBe("not_yet");
    expect(await told(orgId)).toEqual([]);

    await written(websiteId, 1);
    expect(await endFreeTrialIfUsed(websiteId)).toBe("waits_for_customer");
    expect(await told(orgId)).toEqual([
      expect.objectContaining({
        type: "billing.free_articles_written",
        title: `Your ${FREE_ARTICLES} free articles are written`,
        body: expect.stringMatching(/^To write more now, start your plan in Billing - otherwise PayPal starts it on \d{1,2} [A-Z][a-z]+ \d{4}\.$/),
        href: `/billing?site=${websiteId}#plan`,
      }),
    ]);

    // A later run, or a refused fourth article, says nothing more.
    expect(await endFreeTrialIfUsed(websiteId)).toBe("waits_for_customer");
    expect(await told(orgId)).toHaveLength(1);
    expect(stripeMock.retrieve).not.toHaveBeenCalled();
    expect(stripeMock.update).not.toHaveBeenCalled();
  });
});
