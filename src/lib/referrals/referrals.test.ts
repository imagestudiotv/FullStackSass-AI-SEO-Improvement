import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { adminAuditLog, creditLedger, payments, referralCodes, referrals } from "@/lib/db/schema";
import { organization } from "@/lib/db/auth-tables";
import { createTestDb, type TestDb } from "@/test/db";

/**
 * The referral program end to end on a disposable database (client,
 * 2026-10-01): the /r link, attaching only NEW customers, the reward only on
 * money, its reversal on a full refund, the cookie being cleared, and the
 * Settings totals.
 */

const state = vi.hoisted(() => ({
  db: null as unknown,
  jar: new Map<string, string>(),
  orgId: "",
}));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }) }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (state.jar.has(name) ? { name, value: state.jar.get(name)! } : undefined),
    delete: (name: string) => {
      state.jar.delete(name);
    },
  }),
}));
vi.mock("@/lib/tenant", () => ({ requireOrg: async () => ({ orgId: state.orgId }) }));
const notifyMock = vi.hoisted(() => vi.fn(async () => true));
vi.mock("@/lib/notifications/create", () => ({ notify: notifyMock }));

import { GET as referralLink } from "@/app/r/[code]/route";
import { getBalance } from "@/lib/backlinks/credits";
import { claimReferral, getReferralSummary } from "@/lib/referrals/actions";
import { parseReferralCookie, referralCookieValue, REFERRAL_COOKIE } from "@/lib/referrals/cookie";
import { attachReferral, convertReferral, reverseReferralReward } from "@/lib/referrals/core";
import { REFERRAL_REWARD_CREDITS } from "@/lib/referrals/shared";

let test: TestDb;
beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});
beforeEach(() => {
  state.jar.clear();
  notifyMock.mockClear();
});

const MIN = 60_000;
const DAY = 86_400_000;

/** A workspace created at `createdAt`. */
async function org(createdAt = new Date()) {
  const id = `org_${randomUUID().slice(0, 8)}`;
  await test.db.insert(organization).values({ id, name: id, slug: id, createdAt });
  return id;
}
/** A referrer with a code. */
async function referrer() {
  const id = await org(new Date(Date.now() - 90 * DAY));
  const code = `C${randomUUID().replace(/-/g, "").slice(0, 7).toUpperCase()}`;
  await test.db.insert(referralCodes).values({ organizationId: id, code });
  return { id, code };
}
async function pay(orgId: string, amountCents: number, status = "paid") {
  const [row] = await test.db.insert(payments).values({
    organizationId: orgId,
    provider: "stripe",
    externalId: `in_${randomUUID()}`,
    amountCents,
    currency: "eur",
    status,
  }).returning({ id: payments.id });
  return row.id;
}
async function referralOf(orgId: string) {
  const [row] = await test.db.select().from(referrals).where(eq(referrals.referredOrgId, orgId));
  return row;
}

describe("the cookie value", () => {
  it("carries the code and when the link was opened", () => {
    const at = new Date("2026-10-01T12:00:00Z");
    expect(parseReferralCookie(referralCookieValue("ABCD2345", at))).toEqual({ code: "ABCD2345", clickedAt: at });
  });
  it("reads a cookie set before the time was recorded, and rejects anything else", () => {
    expect(parseReferralCookie("abcd2345")).toEqual({ code: "ABCD2345", clickedAt: null });
    expect(parseReferralCookie("ABCD2345.x")).toBeNull();
    expect(parseReferralCookie("AB.1")).toBeNull();
    expect(parseReferralCookie("ABCD2345.1.2")).toBeNull();
    expect(parseReferralCookie(undefined)).toBeNull();
  });
});

describe("the /r link", () => {
  async function open(code: string, cookie?: string) {
    const request = new NextRequest(`https://repget.test/r/${code}`, cookie ? { headers: { cookie: `${REFERRAL_COOKIE}=${cookie}` } } : {});
    const response = await referralLink(request, { params: Promise.resolve({ code }) } as never);
    return { location: response.headers.get("location"), set: response.cookies.get(REFERRAL_COOKIE)?.value ?? null };
  }

  it("remembers a real code with the time it was opened, and always lands on the homepage", async () => {
    const r = await referrer();
    const before = Math.floor(Date.now() / 1000);
    const result = await open(r.code.toLowerCase());
    expect(result.location).toBe("https://repget.test/");
    const parsed = parseReferralCookie(result.set);
    expect(parsed?.code).toBe(r.code);
    expect(Math.floor(parsed!.clickedAt!.getTime() / 1000)).toBeGreaterThanOrEqual(before);
  });

  it("stores nothing for a code that does not exist, so it cannot block a real one", async () => {
    expect((await open("NOSUCH99")).set).toBeNull();
  });

  it("first touch wins over a later real link, but not over a code that does not exist", async () => {
    const first = await referrer();
    const second = await referrer();
    expect((await open(second.code, referralCookieValue(first.code, new Date()))).set).toBeNull();
    expect(parseReferralCookie((await open(second.code, "TYPO2345")).set)?.code).toBe(second.code);
  });
});

describe("attaching: only new customers", () => {
  it("attaches a workspace created after the link was opened", async () => {
    const r = await referrer();
    const clickedAt = new Date(Date.now() - 5 * MIN);
    const fresh = await org();
    expect(await attachReferral(fresh, r.code, { clickedAt })).toEqual({ ok: true });
    expect((await referralOf(fresh)).status).toBe("pending");
  });

  it("refuses an existing customer who clicked someone's link", async () => {
    const r = await referrer();
    const existing = await org(new Date(Date.now() - 200 * DAY));
    expect(await attachReferral(existing, r.code, { clickedAt: new Date() })).toEqual({ ok: false, reason: "not_new" });
    expect(await referralOf(existing)).toBeUndefined();
  });

  it("refuses a workspace that has already paid money, but not one whose trial charged nothing", async () => {
    const r = await referrer();
    const clickedAt = new Date(Date.now() - MIN);
    const paid = await org();
    await pay(paid, 2900);
    expect(await attachReferral(paid, r.code, { clickedAt })).toEqual({ ok: false, reason: "not_new" });
    const trial = await org();
    await pay(trial, 0);
    expect(await attachReferral(trial, r.code, { clickedAt })).toEqual({ ok: true });
  });

  it("an old cookie without a time attaches only a workspace created within its thirty days", async () => {
    const r = await referrer();
    const recent = await org(new Date(Date.now() - 3 * DAY));
    const old = await org(new Date(Date.now() - 45 * DAY));
    expect(await attachReferral(recent, r.code, { clickedAt: null })).toEqual({ ok: true });
    expect(await attachReferral(old, r.code, { clickedAt: null })).toEqual({ ok: false, reason: "not_new" });
  });

  it("still refuses self-referral, unknown codes and a second referral", async () => {
    const r = await referrer();
    expect(await attachReferral(r.id, r.code, { clickedAt: new Date(Date.now() - 365 * DAY) })).toEqual({ ok: false, reason: "self_referral" });
    const fresh = await org();
    expect(await attachReferral(fresh, "NOSUCH99")).toEqual({ ok: false, reason: "unknown_code" });
    const other = await referrer();
    expect(await attachReferral(fresh, r.code, { clickedAt: new Date(Date.now() - MIN) })).toEqual({ ok: true });
    expect(await attachReferral(fresh, other.code, { clickedAt: new Date(Date.now() - MIN) })).toEqual({ ok: false, reason: "already_referred" });
  });
});

describe("claimReferral", () => {
  it("attaches the signed-in workspace and clears the cookie", async () => {
    const r = await referrer();
    state.jar.set(REFERRAL_COOKIE, referralCookieValue(r.code, new Date(Date.now() - MIN)));
    state.orgId = await org();
    await claimReferral();
    expect((await referralOf(state.orgId)).status).toBe("pending");
    expect(state.jar.has(REFERRAL_COOKIE)).toBe(false);
  });

  it("keeps the cookie when the database fails, so the next page load retries", async () => {
    const r = await referrer();
    state.jar.set(REFERRAL_COOKIE, referralCookieValue(r.code, new Date(Date.now() - MIN)));
    state.orgId = await org();
    await test.client.exec(`
      create or replace function inject_referral_failure() returns trigger as $$
      begin raise exception 'injected referral failure'; end $$ language plpgsql;
      create trigger inject_referral_failure before insert on referrals
        for each row execute function inject_referral_failure();`);
    try {
      await expect(claimReferral()).rejects.toThrow();
    } finally {
      await test.client.exec("drop trigger if exists inject_referral_failure on referrals;");
    }
    expect(state.jar.has(REFERRAL_COOKIE)).toBe(true);
    await claimReferral();
    expect((await referralOf(state.orgId)).status).toBe("pending");
    expect(state.jar.has(REFERRAL_COOKIE)).toBe(false);
  });

  it("clears the cookie when it cannot attach, so it never reaches the next account in that browser", async () => {
    const r = await referrer();
    state.jar.set(REFERRAL_COOKIE, referralCookieValue(r.code, new Date()));
    state.orgId = await org(new Date(Date.now() - 100 * DAY));
    await claimReferral();
    expect(await referralOf(state.orgId)).toBeUndefined();
    expect(state.jar.has(REFERRAL_COOKIE)).toBe(false);
  });
});

describe("the reward", () => {
  async function pending() {
    const r = await referrer();
    const referred = await org();
    await attachReferral(referred, r.code, { clickedAt: new Date(Date.now() - MIN) });
    return { referrer: r.id, referred };
  }

  it("is not paid for a zero invoice (a trial start or a 100%-off period)", async () => {
    const w = await pending();
    expect(await convertReferral(w.referred, 0)).toBe(false);
    expect((await referralOf(w.referred)).status).toBe("pending");
    expect(await getBalance(w.referrer)).toBe(0);
  });

  it("is paid once, on the first payment of real money", async () => {
    const w = await pending();
    await pay(w.referred, 2900);
    expect(await convertReferral(w.referred, 2900)).toBe(true);
    expect(await convertReferral(w.referred, 2900)).toBe(false);
    expect(await getBalance(w.referrer)).toBe(REFERRAL_REWARD_CREDITS);
  });

  it("is reversed once when the only real payment is refunded in full, and earned again on a new payment", async () => {
    const w = await pending();
    await pay(w.referred, 2900);
    await convertReferral(w.referred, 2900);
    await test.db.update(payments).set({ status: "refunded" }).where(eq(payments.organizationId, w.referred));

    expect(await reverseReferralReward(w.referred)).toBe(true);
    expect(await reverseReferralReward(w.referred)).toBe(false);
    expect(await getBalance(w.referrer)).toBe(0);
    // Back to waiting, not a dead end: a goodwill refund to a customer who stays.
    expect(await referralOf(w.referred)).toMatchObject({ status: "pending", rewardCredits: null });
    expect(notifyMock).toHaveBeenLastCalledWith(expect.objectContaining({ organizationId: w.referrer, type: "referral.reversed" }));

    await pay(w.referred, 2900);
    expect(await convertReferral(w.referred, 2900)).toBe(true);
    expect(await getBalance(w.referrer)).toBe(REFERRAL_REWARD_CREDITS);
    await test.db.update(payments).set({ status: "refunded" }).where(eq(payments.organizationId, w.referred));
    expect(await reverseReferralReward(w.referred)).toBe(true);
    expect(await getBalance(w.referrer)).toBe(0);
  });

  it("is not paid by a replayed webhook once the payment was refunded", async () => {
    const w = await pending();
    await pay(w.referred, 2900, "refunded");
    expect(await convertReferral(w.referred, 2900)).toBe(false);
    expect(await getBalance(w.referrer)).toBe(0);
  });

  it("is not paid for a referral the old code attached to an existing customer", async () => {
    const r = await referrer();
    const existing = await org(new Date(Date.now() - 200 * DAY));
    await test.db.insert(referrals).values({ referrerOrgId: r.id, referredOrgId: existing, status: "pending", createdAt: new Date() });
    await pay(existing, 2900);
    expect(await convertReferral(existing, 2900)).toBe(false);
    expect((await referralOf(existing)).status).toBe("pending");
  });

  it("stands when the other payment was refunded only in part", async () => {
    const w = await pending();
    const partly = await pay(w.referred, 2900, "refunded");
    await test.db.insert(adminAuditLog).values({ actorEmail: "a@test", action: "payment.refunded", targetType: "payment", targetId: partly, summary: "partial", detail: { partial: true } });
    const full = await pay(w.referred, 2900, "paid");
    await convertReferral(w.referred, 2900);
    await test.db.update(payments).set({ status: "refunded" }).where(eq(payments.id, full));
    await test.db.insert(adminAuditLog).values({ actorEmail: "a@test", action: "payment.refunded", targetType: "payment", targetId: full, summary: "full", detail: { partial: false } });
    expect(await reverseReferralReward(w.referred)).toBe(false);
    expect(await getBalance(w.referrer)).toBe(REFERRAL_REWARD_CREDITS);
  });

  it("stands while another real payment remains", async () => {
    const w = await pending();
    await pay(w.referred, 2900, "refunded");
    await pay(w.referred, 2900, "paid");
    await convertReferral(w.referred, 2900);
    expect(await reverseReferralReward(w.referred)).toBe(false);
    expect(await getBalance(w.referrer)).toBe(REFERRAL_REWARD_CREDITS);
  });
});

describe("the Settings totals", () => {
  it("count every referral, not the 50 listed, and earned is net of reversals", async () => {
    const r = await referrer();
    state.orgId = r.id;
    const rows = Array.from({ length: 55 }, (_, i) => i);
    for (const i of rows) {
      const referred = await org();
      await test.db.insert(referrals).values({ referrerOrgId: r.id, referredOrgId: referred, status: i < 2 ? "rewarded" : "pending", rewardCredits: i < 2 ? 20 : null });
    }
    await test.db.insert(creditLedger).values([
      { organizationId: r.id, type: "referral", amount: 20, idempotencyKey: `t:${r.id}:1` },
      { organizationId: r.id, type: "referral", amount: 20, idempotencyKey: `t:${r.id}:2` },
      { organizationId: r.id, type: "referral", amount: -20, idempotencyKey: `t:${r.id}:3` },
    ]);

    const summary = await getReferralSummary();
    expect(summary.referrals).toHaveLength(50);
    expect(summary.pending).toBe(53);
    expect(summary.earned).toBe(20);
  });
});
