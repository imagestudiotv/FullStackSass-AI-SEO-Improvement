import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { articles, calendarItems, lifecycleEmails, payments, platformControls, plans, subscriptions, websites } from "@/lib/db/schema";
import { member, organization, user } from "@/lib/db/auth-tables";
import { createTestDb, type TestDb } from "@/test/db";

/**
 * Email Autopilot (client ticket 2026-11-11): who gets the free period's day-2
 * email ("Fingers crossed!") and the win-back offer, when, and never twice -
 * re-checked when they go, so a trial that was cancelled or started its plan,
 * or a person who came back, gets nothing.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }) }));
const sent = vi.hoisted(() => ({
  sendEmail: vi.fn<(options: { to: string; subject: string; text: string; html: string }) => Promise<{ ok: true; id: string }>>(async () => ({
    ok: true as const,
    id: `msg_${Math.random().toString(36).slice(2)}`,
  })),
}));
vi.mock("@/lib/email/send", () => sent);
const jobs = vi.hoisted(() => ({
  queueJob: vi.fn<(event: { id: string; name: string; data: Record<string, unknown> }) => Promise<boolean>>(async () => true),
}));
vi.mock("@/inngest/send", () => jobs);

import { LIFECYCLE_CONTROL_KEY, setTips } from "@/lib/email/lifecycle";
import { emailsAfterSubscriptionSync, emailTrialProgress, emailTrialsProgress, emailWinback } from "@/lib/email/lifecycle-triggers";

process.env.BETTER_AUTH_SECRET = "test-secret-for-unsubscribe-links";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

let test: TestDb;
beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});
beforeEach(async () => {
  sent.sendEmail.mockClear();
  jobs.queueJob.mockClear();
  process.env.WINBACK_OFFER_ENABLED = "1";
  await test.db
    .insert(platformControls)
    .values({ key: LIFECYCLE_CONTROL_KEY, enabled: true })
    .onConflictDoUpdate({ target: platformControls.key, set: { enabled: true } });
});
afterEach(() => {
  delete process.env.WINBACK_OFFER_ENABLED;
});

/** A person who owns a workspace with one website. */
async function account() {
  const userId = `user_${randomUUID()}`;
  const orgId = `org_${randomUUID()}`;
  await test.db.insert(user).values({ id: userId, name: "Ada", email: `${userId}@example.test` });
  await test.db.insert(organization).values({ id: orgId, name: "Workspace", slug: orgId, createdAt: new Date() });
  await test.db.insert(member).values({ id: randomUUID(), organizationId: orgId, userId, role: "owner", createdAt: new Date() });
  const websiteId = await site(orgId);
  return { userId, orgId, websiteId };
}

async function site(orgId: string) {
  const [row] = await test.db
    .insert(websites)
    .values({ organizationId: orgId, url: `https://${randomUUID()}.example`, domain: `${orgId}.example`, status: "ready" })
    .returning({ id: websites.id });
  return row.id;
}

async function subscription(
  orgId: string,
  websiteId: string,
  values: { status: string; cancelAtPeriodEnd?: boolean; start?: Date; end?: Date },
) {
  const [plan] = await test.db
    .insert(plans)
    .values({ name: "Grow", tier: `t_${randomUUID()}`, priceCents: 14900, articleLimit: 30, keywordLimit: 100, siteLimit: 1, monthlyCredits: 0 })
    .returning({ id: plans.id });
  const [row] = await test.db
    .insert(subscriptions)
    .values({
      organizationId: orgId,
      websiteId,
      planId: plan.id,
      provider: "stripe",
      stripeSubscriptionId: `sub_${randomUUID()}`,
      status: values.status,
      cancelAtPeriodEnd: values.cancelAtPeriodEnd ?? false,
      currentPeriodStart: values.start ?? new Date(Date.now() - 25 * HOUR),
      currentPeriodEnd: values.end ?? new Date(Date.now() + 29 * DAY),
    })
    .returning({ id: subscriptions.id });
  return row.id;
}

const rowsOf = (kind: string, scope: string) =>
  test.db.select().from(lifecycleEmails).where(and(eq(lifecycleEmails.kind, kind), eq(lifecycleEmails.scope, scope)));

describe("the free period's day-2 email", () => {
  it("goes about a day in, once, with the website's real first figures", async () => {
    const { orgId, websiteId } = await account();
    const id = await subscription(orgId, websiteId, { status: "trialing" });
    await test.db.insert(articles).values([
      { websiteId, title: "One", status: "draft", bodyHtml: "<p>Written</p>" },
      { websiteId, title: "Two", status: "published", bodyHtml: "<p>Live</p>" },
      { websiteId, title: "Queued", status: "queued" },
    ]);
    await test.db.insert(calendarItems).values([
      { websiteId, title: "Planned", status: "planned" },
      { websiteId, title: "Done", status: "generated" },
    ]);
    expect((await emailTrialProgress(id)).status).toBe("sent");
    expect(await emailTrialProgress(id)).toEqual({ status: "duplicate" });
    const mail = sent.sendEmail.mock.calls[0][0];
    expect(mail.subject).toBe(`Fingers crossed! ${orgId}.example has started its journey with RepGet`);
    expect(mail.text).toContain("Articles written: 2");
    expect(mail.text).toContain("Articles live on your website: 1");
    expect(mail.text).toContain("Topics planned: 1");
    // Tips and reports: it carries the unsubscribe.
    expect(mail.text).toContain("/unsubscribe/");
  });

  it("not before a day, not once cancelled, not once the plan has started", async () => {
    const early = await account();
    const young = await subscription(early.orgId, early.websiteId, { status: "trialing", start: new Date(Date.now() - 2 * HOUR) });
    expect(await emailTrialProgress(young)).toEqual({ status: "skipped", reason: "too_early" });
    const cancelled = await account();
    const stopped = await subscription(cancelled.orgId, cancelled.websiteId, { status: "trialing", cancelAtPeriodEnd: true });
    expect((await emailTrialProgress(stopped)).status).toBe("skipped");
    const paid = await account();
    const started = await subscription(paid.orgId, paid.websiteId, { status: "active" });
    expect(await emailTrialProgress(started)).toEqual({ status: "skipped", reason: "not_on_free_articles" });
    expect(sent.sendEmail).not.toHaveBeenCalled();
  });

  it("the hourly job takes only free periods 24 to 48 hours old, still running and not cancelled", async () => {
    const due = await account();
    await subscription(due.orgId, due.websiteId, { status: "trialing" });
    const young = await account();
    await subscription(young.orgId, young.websiteId, { status: "trialing", start: new Date(Date.now() - 3 * HOUR) });
    const old = await account();
    await subscription(old.orgId, old.websiteId, { status: "trialing", start: new Date(Date.now() - 60 * HOUR) });
    const cancelled = await account();
    await subscription(cancelled.orgId, cancelled.websiteId, { status: "trialing", cancelAtPeriodEnd: true });
    await emailTrialsProgress();
    await emailTrialsProgress();
    expect(await rowsOf("trial_progress", `org:${due.orgId}`)).toHaveLength(1);
    for (const other of [young, old, cancelled]) expect(await rowsOf("trial_progress", `org:${other.orgId}`)).toHaveLength(0);
    expect(sent.sendEmail.mock.calls.filter(([mail]) => mail.to === `${due.userId}@example.test`)).toHaveLength(1);
  });

  it("respects an unsubscribe", async () => {
    const { userId, orgId, websiteId } = await account();
    await setTips(userId, false, "settings");
    const id = await subscription(orgId, websiteId, { status: "trialing" });
    expect(await emailTrialProgress(id)).toEqual({ status: "skipped", reason: "unsubscribed" });
    expect(sent.sendEmail).not.toHaveBeenCalled();
  });
});

describe("the win-back email", () => {
  const ended = async () => {
    const who = await account();
    const id = await subscription(who.orgId, who.websiteId, { status: "canceled" });
    return { ...who, id };
  };

  it("is queued when a customer leaves - a free period, a cancelled plan, a plan ended at once - and not otherwise", async () => {
    const { id } = await ended();
    await emailsAfterSubscriptionSync(test.db, id, { status: "trialing", cancelAtPeriodEnd: false });
    await emailsAfterSubscriptionSync(test.db, id, { status: "trialing", cancelAtPeriodEnd: true });
    await emailsAfterSubscriptionSync(test.db, id, { status: "active", cancelAtPeriodEnd: true });
    await emailsAfterSubscriptionSync(test.db, id, { status: "active", cancelAtPeriodEnd: false });
    expect(jobs.queueJob).toHaveBeenCalledTimes(4);
    expect(jobs.queueJob.mock.calls[0][0]).toEqual({
      id: `lifecycle-winback:${id}`,
      name: "email/subscription.ended",
      data: { subscriptionId: id },
    });
    jobs.queueJob.mockClear();
    // Ended by the provider after failed payments, a checkout never completed, or ended already: no.
    await emailsAfterSubscriptionSync(test.db, id, { status: "past_due", cancelAtPeriodEnd: false });
    await emailsAfterSubscriptionSync(test.db, id, { status: "unpaid", cancelAtPeriodEnd: false });
    await emailsAfterSubscriptionSync(test.db, id, { status: "incomplete", cancelAtPeriodEnd: false });
    await emailsAfterSubscriptionSync(test.db, id, { status: "canceled", cancelAtPeriodEnd: true });
    await emailsAfterSubscriptionSync(test.db, id, null);
    expect(jobs.queueJob).not.toHaveBeenCalled();
    // Unpaid, but set to cancel by the customer: they left.
    await emailsAfterSubscriptionSync(test.db, id, { status: "past_due", cancelAtPeriodEnd: true });
    expect(jobs.queueJob).toHaveBeenCalledTimes(1);
  });

  it("goes to the owner, once per PERSON ever, and says what ended", async () => {
    const { userId, orgId, id } = await ended();
    expect((await emailWinback(id)).status).toBe("sent");
    const mail = sent.sendEmail.mock.calls[0][0];
    expect(mail.to).toBe(`${userId}@example.test`);
    expect(mail.subject).toBe("Come back to RepGet: 100 extra credits and 20% off");
    expect(mail.text).toContain("Your RepGet free period has ended.");
    expect(mail.text).toContain("/billing?site=");
    expect(mail.text).toContain("/unsubscribe/");
    expect(await emailWinback(id)).toEqual({ status: "duplicate" });
    // Another of their subscriptions ending later: still once.
    const again = await subscription(orgId, await site(orgId), { status: "canceled" });
    expect(await emailWinback(again)).toEqual({ status: "duplicate" });
    expect(sent.sendEmail).toHaveBeenCalledTimes(1);
    expect(await rowsOf("winback", `user:${userId}`)).toHaveLength(1);
  });

  it("calls a plan that took money a plan", async () => {
    const { orgId, id } = await ended();
    await test.db.insert(payments).values({
      organizationId: orgId,
      provider: "stripe",
      externalId: `in_${randomUUID()}`,
      amountCents: 14900,
      currency: "eur",
      status: "paid",
      subscriptionId: id,
    });
    await emailWinback(id);
    expect(sent.sendEmail.mock.calls[0][0].text).toContain("Your RepGet plan has ended.");
  });

  it("not to someone who came back, or has another subscription running anywhere", async () => {
    const { userId, orgId, id } = await ended();
    await subscription(orgId, await site(orgId), { status: "active" });
    expect(await emailWinback(id)).toEqual({ status: "skipped", reason: "has_subscription" });

    const other = await ended();
    // A member of another workspace that is on a free period.
    const shared = await account();
    await test.db.insert(member).values({ id: randomUUID(), organizationId: shared.orgId, userId: other.userId, role: "member", createdAt: new Date() });
    await subscription(shared.orgId, shared.websiteId, { status: "trialing" });
    expect(await emailWinback(other.id)).toEqual({ status: "skipped", reason: "has_subscription" });
    expect(sent.sendEmail).not.toHaveBeenCalled();
    expect(await rowsOf("winback", `user:${userId}`)).toHaveLength(0);
  });

  it("not for a subscription running again, nor while the offer is off, nor after an unsubscribe", async () => {
    const live = await account();
    const running = await subscription(live.orgId, live.websiteId, { status: "active" });
    expect(await emailWinback(running)).toEqual({ status: "skipped", reason: "not_ended" });
    const off = await ended();
    delete process.env.WINBACK_OFFER_ENABLED;
    expect(await emailWinback(off.id)).toEqual({ status: "skipped", reason: "offer_off" });
    process.env.WINBACK_OFFER_ENABLED = "1";
    await setTips(off.userId, false, "link");
    expect(await emailWinback(off.id)).toEqual({ status: "skipped", reason: "unsubscribed" });
    expect(sent.sendEmail).not.toHaveBeenCalled();
  });
});
