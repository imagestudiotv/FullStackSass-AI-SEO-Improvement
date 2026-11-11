import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { articles, emailPreferences, lifecycleEmails, payments, platformControls, plans, subscriptions, websites } from "@/lib/db/schema";
import { member, organization, user } from "@/lib/db/auth-tables";
import { createTestDb, type TestDb } from "@/test/db";

/**
 * The lifecycle emails on a disposable database (docs/emails.md): the kill
 * switch, the claim that makes an email go once, unsubscribe stopping tips
 * but not essential emails, the signed link, and the moments that must be
 * re-checked before sending - the setup reminder, the free period ending,
 * the first payment, a subscription's change.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }) }));
const sent = vi.hoisted(() => ({
  sendEmail: vi.fn(async (_options: { to: string; subject: string; text: string; html: string; headers?: Record<string, string> }) => ({
    ok: true as const,
    id: `msg_${Math.random().toString(36).slice(2)}`,
  })),
}));
vi.mock("@/lib/email/send", () => sent);
// The win-back is queued for later when a subscription ends (lifecycle-autopilot.test.ts tests it).
vi.mock("@/inngest/send", () => ({ queueJob: vi.fn(async () => true) }));

import { POST as unsubscribeRoute } from "@/app/api/email/unsubscribe/route";
import { LIFECYCLE_CONTROL_KEY, sendLifecycleEmail, setTips, wantsTips } from "@/lib/email/lifecycle";
import {
  emailFirstPayment,
  emailsAfterSubscriptionSync,
  emailSetupReminder,
  emailTrialEnding,
  emailTrialsEnding,
  emailWeeklySummary,
  isoWeek,
} from "@/lib/email/lifecycle-triggers";
import { unsubscribeToken, verifyUnsubscribeToken } from "@/lib/email/unsubscribe-token";

const SECRET = "test-secret-for-unsubscribe-links";
process.env.BETTER_AUTH_SECRET = SECRET;

const DAY = 86_400_000;

let test: TestDb;
beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});
beforeEach(async () => {
  sent.sendEmail.mockClear();
  await switchEmails(true);
});

async function switchEmails(enabled: boolean) {
  await test.db
    .insert(platformControls)
    .values({ key: LIFECYCLE_CONTROL_KEY, enabled })
    .onConflictDoUpdate({ target: platformControls.key, set: { enabled } });
}

/** A person, their workspace (they own it) and, optionally, a website on a subscription. */
async function account(options: { locale?: string | null; website?: boolean } = {}) {
  const userId = `user_${randomUUID()}`;
  const orgId = `org_${randomUUID()}`;
  await test.db.insert(user).values({ id: userId, name: "Ada", email: `${userId}@example.test`, locale: options.locale ?? null });
  await test.db.insert(organization).values({ id: orgId, name: "Ada's Workspace", slug: orgId, createdAt: new Date() });
  await test.db.insert(member).values({ id: randomUUID(), organizationId: orgId, userId, role: "owner", createdAt: new Date() });
  let websiteId: string | null = null;
  if (options.website) {
    const [site] = await test.db
      .insert(websites)
      .values({ organizationId: orgId, url: `https://${orgId}.example`, domain: `${orgId}.example`, status: "ready" })
      .returning({ id: websites.id });
    websiteId = site.id;
  }
  return { userId, orgId, websiteId };
}

async function subscription(
  orgId: string,
  websiteId: string,
  values: { status: string; cancelAtPeriodEnd?: boolean; start?: Date; end?: Date; provider?: string; stripeId?: string },
) {
  const [plan] = await test.db
    .insert(plans)
    .values({ name: "Growth", tier: `t_${randomUUID()}`, priceCents: 4900, articleLimit: 30, keywordLimit: 100, siteLimit: 1, monthlyCredits: 0 })
    .returning({ id: plans.id });
  const [row] = await test.db
    .insert(subscriptions)
    .values({
      organizationId: orgId,
      websiteId,
      planId: plan.id,
      provider: values.provider ?? "stripe",
      stripeSubscriptionId: values.stripeId ?? `sub_${randomUUID()}`,
      status: values.status,
      cancelAtPeriodEnd: values.cancelAtPeriodEnd ?? false,
      currentPeriodStart: values.start ?? new Date(Date.now() - 29 * DAY),
      currentPeriodEnd: values.end ?? new Date(Date.now() + 20 * 60 * 60 * 1000),
    })
    .returning({ id: subscriptions.id, stripeSubscriptionId: subscriptions.stripeSubscriptionId });
  return row;
}

const rowsOf = (kind: string, scope: string) =>
  test.db.select().from(lifecycleEmails).where(and(eq(lifecycleEmails.kind, kind), eq(lifecycleEmails.scope, scope)));

describe("sendLifecycleEmail", () => {
  it("sends nothing, and writes nothing, while the kill switch is off", async () => {
    await switchEmails(false);
    const { userId } = await account();
    const outcome = await sendLifecycleEmail({ kind: "welcome", userId, dedupeKey: "signup", build: () => ({ kind: "welcome", invited: false }) });
    expect(outcome).toEqual({ status: "skipped", reason: "disabled" });
    expect(sent.sendEmail).not.toHaveBeenCalled();
    expect(await rowsOf("welcome", `user:${userId}`)).toHaveLength(0);
  });

  it("is off when no administrator ever switched it on", async () => {
    await test.db.delete(platformControls).where(eq(platformControls.key, LIFECYCLE_CONTROL_KEY));
    const { userId } = await account();
    const outcome = await sendLifecycleEmail({ kind: "welcome", userId, dedupeKey: "signup", build: () => ({ kind: "welcome", invited: false }) });
    expect(outcome.status).toBe("skipped");
    expect(sent.sendEmail).not.toHaveBeenCalled();
  });

  it("sends the same kind and key once, however often it is asked", async () => {
    const { userId } = await account({ locale: "de" });
    const request = { kind: "welcome" as const, userId, dedupeKey: "signup", build: () => ({ kind: "welcome" as const, invited: false }) };
    const outcomes = await Promise.all([sendLifecycleEmail(request), sendLifecycleEmail(request), sendLifecycleEmail(request)]);
    expect(outcomes.filter((outcome) => outcome.status === "sent")).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === "duplicate")).toHaveLength(2);
    expect(sent.sendEmail).toHaveBeenCalledTimes(1);
    // In the account's language.
    expect(sent.sendEmail.mock.calls[0][0].subject).toBe("Willkommen bei RepGet");
    const [row] = await rowsOf("welcome", `user:${userId}`);
    expect(row).toMatchObject({ status: "sent", recipient: `${userId}@example.test`, locale: "de" });
  });

  it("tries a failed email again, up to three times", async () => {
    const { orgId } = await account();
    sent.sendEmail.mockResolvedValueOnce({ ok: false, error: "Resend is down" } as never);
    const request = { kind: "referral_reward" as const, organizationId: orgId, dedupeKey: "ref:1", build: () => ({ kind: "referral_reward" as const, credits: 50 }) };
    expect(await sendLifecycleEmail(request)).toEqual({ status: "failed", reason: "Resend is down" });
    expect(await sendLifecycleEmail(request)).toMatchObject({ status: "sent" });
    expect(await sendLifecycleEmail(request)).toEqual({ status: "duplicate" });
    const [row] = await rowsOf("referral_reward", `org:${orgId}`);
    expect(row).toMatchObject({ status: "sent", attempts: 2 });
  });

  it("stops tips and reports after an unsubscribe, but not essential emails", async () => {
    const { userId, orgId } = await account();
    await setTips(userId, false, "link");
    const tips = await sendLifecycleEmail({ kind: "setup_reminder", userId, dedupeKey: "signup", build: () => ({ kind: "setup_reminder" }) });
    expect(tips).toEqual({ status: "skipped", reason: "unsubscribed" });
    const essential = await sendLifecycleEmail({
      kind: "referral_reward",
      organizationId: orgId,
      dedupeKey: "ref:2",
      build: () => ({ kind: "referral_reward", credits: 50 }),
    });
    expect(essential.status).toBe("sent");
    expect(sent.sendEmail).toHaveBeenCalledTimes(1);
    // An essential email has no unsubscribe header or link.
    expect(sent.sendEmail.mock.calls[0][0].headers).toBeUndefined();
  });

  it("puts a working one-click unsubscribe on every tips email", async () => {
    const { userId } = await account();
    await sendLifecycleEmail({ kind: "setup_reminder", userId, dedupeKey: "signup", build: () => ({ kind: "setup_reminder" }) });
    const call = sent.sendEmail.mock.calls[0][0];
    expect(call.headers?.["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    const header = call.headers?.["List-Unsubscribe"] ?? "";
    const url = new URL(header.slice(1, -1));
    expect(url.pathname).toBe("/api/email/unsubscribe");
    expect(call.text).toContain("/unsubscribe/");

    const body = new FormData();
    body.set("List-Unsubscribe", "One-Click");
    const response = await unsubscribeRoute(new NextRequest(`https://app.test/api/email/unsubscribe${url.search}`, { method: "POST", body }));
    expect(response.status).toBe(200);
    expect(await wantsTips(userId)).toBe(false);
  });

  it("skips an email with nothing to say", async () => {
    const { orgId } = await account();
    expect(await sendLifecycleEmail({ kind: "weekly_summary", organizationId: orgId, dedupeKey: "2026-W01", build: () => null })).toEqual({
      status: "skipped",
      reason: "nothing_to_send",
    });
    expect(sent.sendEmail).not.toHaveBeenCalled();
  });
});

describe("the unsubscribe token", () => {
  it("names the person it was made for", () => {
    const token = unsubscribeToken("user_1", SECRET)!;
    expect(verifyUnsubscribeToken(token, SECRET)).toBe("user_1");
  });

  it("rejects a forged, altered or foreign token", () => {
    const token = unsubscribeToken("user_1", SECRET)!;
    const [, signature] = token.split(".");
    // Someone else's id under user_1's signature.
    expect(verifyUnsubscribeToken(`${Buffer.from("user_2").toString("base64url")}.${signature}`, SECRET)).toBeNull();
    // A signature made with another key.
    expect(verifyUnsubscribeToken(unsubscribeToken("user_1", "another-secret"), SECRET)).toBeNull();
    // Truncated, malformed, empty.
    expect(verifyUnsubscribeToken(token.slice(0, -2), SECRET)).toBeNull();
    expect(verifyUnsubscribeToken(`${token}.x`, SECRET)).toBeNull();
    expect(verifyUnsubscribeToken("", SECRET)).toBeNull();
    expect(verifyUnsubscribeToken(token, null)).toBeNull();
  });

  it("is refused by the unsubscribe route when forged", async () => {
    const { userId } = await account();
    const forged = `${Buffer.from(userId).toString("base64url")}.${"A".repeat(43)}`;
    const response = await unsubscribeRoute(
      new NextRequest(`https://app.test/api/email/unsubscribe?token=${encodeURIComponent(forged)}`, { method: "POST", body: new FormData() }),
    );
    expect(response.status).toBe(400);
    expect(await wantsTips(userId)).toBe(true);
  });

  it("can turn tips back on from the page", async () => {
    const { userId } = await account();
    await setTips(userId, false, "link");
    const body = new FormData();
    body.set("action", "resubscribe");
    const token = unsubscribeToken(userId)!;
    const response = await unsubscribeRoute(
      new NextRequest(`https://app.test/api/email/unsubscribe?token=${encodeURIComponent(token)}`, { method: "POST", body }),
    );
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toContain("done=on");
    const [row] = await test.db.select().from(emailPreferences).where(eq(emailPreferences.userId, userId));
    expect(row).toMatchObject({ tips: true, tipsChangedVia: "link" });
  });
});

describe("the setup reminder", () => {
  it("is skipped when a website was added in the meantime", async () => {
    const { userId } = await account({ website: true });
    expect(await emailSetupReminder(userId)).toEqual({ status: "skipped", reason: "has_website" });
    expect(sent.sendEmail).not.toHaveBeenCalled();
  });

  it("goes to someone who still has no website", async () => {
    const { userId } = await account();
    expect((await emailSetupReminder(userId)).status).toBe("sent");
    expect(sent.sendEmail.mock.calls[0][0].text).toContain("/onboarding");
  });
});

describe("the free period ending", () => {
  it("is sent about a day before, once", async () => {
    const { orgId, websiteId } = await account({ website: true });
    const row = await subscription(orgId, websiteId!, { status: "trialing" });
    expect((await emailTrialEnding(row.id)).status).toBe("sent");
    expect(await emailTrialEnding(row.id)).toEqual({ status: "duplicate" });
    expect(sent.sendEmail.mock.calls[0][0].text).toContain(`/billing?site=${websiteId}`);
  });

  it("is skipped once the plan is paid", async () => {
    const { orgId, websiteId } = await account({ website: true });
    const row = await subscription(orgId, websiteId!, { status: "active" });
    expect(await emailTrialEnding(row.id)).toEqual({ status: "skipped", reason: "not_on_free_articles" });
    expect(sent.sendEmail).not.toHaveBeenCalled();
  });

  it("is skipped once cancelled, and never sent for a trial further away", async () => {
    const { orgId, websiteId } = await account({ website: true });
    const cancelled = await subscription(orgId, websiteId!, { status: "trialing", cancelAtPeriodEnd: true });
    expect((await emailTrialEnding(cancelled.id)).status).toBe("skipped");
    await test.db.update(subscriptions).set({ cancelAtPeriodEnd: false, currentPeriodEnd: new Date(Date.now() + 5 * DAY) }).where(eq(subscriptions.id, cancelled.id));
    await emailTrialsEnding();
    expect(await rowsOf("trial_ending", `org:${orgId}`)).toHaveLength(0);
  });
});

describe("billing changes", () => {
  it("emails a cancellation, a failed payment and a free period ended unpaid - each once, on the change", async () => {
    const { orgId, websiteId } = await account({ website: true });
    const row = await subscription(orgId, websiteId!, { status: "active", cancelAtPeriodEnd: true, end: new Date(Date.now() + 10 * DAY) });

    await emailsAfterSubscriptionSync(test.db, row.id, { status: "active", cancelAtPeriodEnd: false });
    await emailsAfterSubscriptionSync(test.db, row.id, { status: "active", cancelAtPeriodEnd: false });
    // Nothing changed: no email.
    await emailsAfterSubscriptionSync(test.db, row.id, { status: "active", cancelAtPeriodEnd: true });
    expect(sent.sendEmail).toHaveBeenCalledTimes(1);
    expect(sent.sendEmail.mock.calls[0][0].subject).toBe("Your cancellation is confirmed");

    await test.db.update(subscriptions).set({ status: "past_due", cancelAtPeriodEnd: false }).where(eq(subscriptions.id, row.id));
    await emailsAfterSubscriptionSync(test.db, row.id, { status: "active", cancelAtPeriodEnd: false });
    expect(sent.sendEmail.mock.calls[1][0].subject).toBe("Your payment did not go through");

    const trial = await account({ website: true });
    const trialRow = await subscription(trial.orgId, trial.websiteId!, { status: "canceled" });
    await emailsAfterSubscriptionSync(test.db, trialRow.id, { status: "trialing", cancelAtPeriodEnd: false });
    expect(sent.sendEmail.mock.calls[2][0].subject).toBe("Your free period has ended");
  });

  it("gives a scheduled cancellation's own date, not the period's end (Stripe cancel_at)", async () => {
    const { orgId, websiteId } = await account({ website: true });
    const periodEnd = new Date(Date.UTC(2027, 0, 20, 12));
    const cancelAt = new Date(Date.UTC(2027, 0, 9, 12));
    const row = await subscription(orgId, websiteId!, { status: "active", cancelAtPeriodEnd: true, end: periodEnd });
    await test.db.update(subscriptions).set({ cancelAt }).where(eq(subscriptions.id, row.id));
    await emailsAfterSubscriptionSync(test.db, row.id, { status: "active", cancelAtPeriodEnd: false });
    const { text } = sent.sendEmail.mock.calls[0][0];
    expect(text).toContain("9 January 2027");
    expect(text).not.toContain("20 January 2027");
  });

  it("emails nobody about a subscription detached from its website", async () => {
    const { orgId, websiteId } = await account({ website: true });
    const row = await subscription(orgId, websiteId!, { status: "past_due" });
    await test.db.update(subscriptions).set({ websiteId: null }).where(eq(subscriptions.id, row.id));
    await emailsAfterSubscriptionSync(test.db, row.id, { status: "active", cancelAtPeriodEnd: false });
    expect(sent.sendEmail).not.toHaveBeenCalled();
  });

  it("welcomes a plan on its first payment of money only", async () => {
    const { orgId, websiteId } = await account({ website: true });
    const row = await subscription(orgId, websiteId!, { status: "active" });
    const pay = (amountCents: number) =>
      test.db.insert(payments).values({
        organizationId: orgId,
        provider: "stripe",
        externalId: `in_${randomUUID()}`,
        amountCents,
        currency: "eur",
        status: "paid",
        providerSubscriptionId: row.stripeSubscriptionId,
      });
    await pay(0);
    expect((await emailFirstPayment({ provider: "stripe", providerSubscriptionId: row.stripeSubscriptionId!, amountCents: 0 })).status).toBe("skipped");
    await pay(4900);
    expect((await emailFirstPayment({ provider: "stripe", providerSubscriptionId: row.stripeSubscriptionId!, amountCents: 4900 })).status).toBe("sent");
    await pay(4900);
    expect(await emailFirstPayment({ provider: "stripe", providerSubscriptionId: row.stripeSubscriptionId!, amountCents: 4900 })).toEqual({
      status: "skipped",
      reason: "not_first_payment",
    });
    expect(sent.sendEmail).toHaveBeenCalledTimes(1);
    expect(sent.sendEmail.mock.calls[0][0].subject).toBe("Welcome to your Growth plan");
  });
});

describe("the weekly summary", () => {
  it("sends nothing for a quiet week, and only real, non-zero figures otherwise", async () => {
    const quiet = await account({ website: true });
    expect(await emailWeeklySummary(quiet.orgId)).toEqual({ status: "skipped", reason: "nothing_to_send" });

    const busy = await account({ website: true });
    await test.db.insert(articles).values([
      { websiteId: busy.websiteId!, title: "One", status: "published", firstLiveAt: new Date(Date.now() - DAY) },
      { websiteId: busy.websiteId!, title: "Two", status: "published", firstLiveAt: new Date(Date.now() - 30 * DAY) },
    ]);
    expect((await emailWeeklySummary(busy.orgId)).status).toBe("sent");
    const text = sent.sendEmail.mock.calls[0][0].text;
    expect(text).toContain("Articles published: 1");
    expect(text).toContain("Articles live in total: 2");
    expect(text).not.toContain("Videos posted");
    expect(text).not.toContain("Credit balance");
  });

  it("is keyed by ISO week", () => {
    expect(isoWeek(new Date("2026-11-02T08:00:00Z"))).toBe("2026-W45");
    expect(isoWeek(new Date("2027-01-01T08:00:00Z"))).toBe("2026-W53");
  });
});
