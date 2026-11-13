import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { and, eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { organization, user } from "@/lib/db/auth-tables";
import { creditLedger, partnerCommissions, partnerLedgerEntries, rewardedAdViews } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";

/**
 * "Watch an ad to earn credits" (ticket 2026-11-13) on a disposable database
 * with the area's migration draft applied: off unless fully configured; a
 * start only within the limit, the cooldown and the caps, one open attempt per
 * member; a claim only for the member's own open attempt, neither too early
 * nor too late, crediting exactly once however often it is sent; closing
 * early credits nothing; and the credits are ordinary service credits that
 * nothing pays out. Separate connections racing: rewarded-ads.concurrency.test.ts.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }) }));

import { claimRewardedAd, endRewardedAd, loadRewardedAdState, rewardedAdKey, startRewardedAd } from "@/lib/earn/rewarded-ads";
import { isAdUnitPath, rewardedAdsConfig, TEST_AD_UNIT_PATH, type RewardedAdsConfig } from "@/lib/earn/rewarded-ads-config";

const ROOT = path.resolve(__dirname, "../../..");
const SECOND = 1000;
const MINUTE = 60 * SECOND;

const ON = {
  REWARDED_ADS_ENABLED: "1",
  REWARDED_AD_UNIT_PATH: "/1234567/repget_rewarded",
  REWARDED_ADS_CREDITS: "2",
  REWARDED_ADS_DAILY_LIMIT: "3",
  REWARDED_ADS_COOLDOWN_SECONDS: "60",
};
const config = (extra: Record<string, string> = {}): RewardedAdsConfig => rewardedAdsConfig({ ...ON, ...extra });

let test: TestDb;
beforeAll(async () => {
  test = await createTestDb();
  const draft = readFileSync(path.join(ROOT, "drizzle-drafts/nov13/ads.sql"), "utf8");
  for (const statement of draft.split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean)) await test.client.exec(statement);
  // Twice: the draft is idempotent.
  for (const statement of draft.split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean)) await test.client.exec(statement);
  state.db = test.db;
}, 120_000);

let orgId: string;
let userId: string;
const T0 = new Date("2026-11-13T10:00:00.000Z");
const at = (ms: number) => new Date(T0.getTime() + ms);

async function member(org?: string) {
  const id = `u_${randomUUID().slice(0, 8)}`;
  await test.db.insert(user).values({ id, name: id, email: `${id}@example.com`, createdAt: T0, updatedAt: T0 });
  if (!org) {
    org = `org_${randomUUID().slice(0, 8)}`;
    await test.db.insert(organization).values({ id: org, name: org, slug: org, createdAt: T0 });
  }
  return { userId: id, orgId: org };
}

async function balance(org: string) {
  const rows = await test.db.select({ amount: creditLedger.amount }).from(creditLedger).where(eq(creditLedger.organizationId, org));
  return rows.reduce((sum, row) => sum + row.amount, 0);
}

/** Starts at `start` and claims `after` ms later. */
async function watch(start: Date, after = 20 * SECOND, cfg = config(), who = { userId, orgId }) {
  const started = await startRewardedAd(who.userId, who.orgId, start, cfg);
  if (!started.ok) return started;
  return claimRewardedAd(who.userId, who.orgId, started.sessionId, new Date(start.getTime() + after), cfg);
}

beforeEach(async () => {
  ({ userId, orgId } = await member());
});

describe("the settings", () => {
  it("are off by default, and need the switch, an ad unit, a reward and a daily limit", () => {
    expect(rewardedAdsConfig({})).toMatchObject({ enabled: false, problem: "off", adUnitPath: null });
    expect(rewardedAdsConfig({ ...ON, REWARDED_AD_UNIT_PATH: "" }).problem).toBe("no_ad_unit");
    expect(rewardedAdsConfig({ ...ON, REWARDED_AD_UNIT_PATH: "ca-pub-123" }).problem).toBe("no_ad_unit");
    // No economic default: unset or 0 keeps it off.
    expect(rewardedAdsConfig({ ...ON, REWARDED_ADS_CREDITS: "" }).problem).toBe("no_reward");
    expect(rewardedAdsConfig({ ...ON, REWARDED_ADS_CREDITS: "0" }).problem).toBe("no_reward");
    expect(rewardedAdsConfig({ ...ON, REWARDED_ADS_DAILY_LIMIT: undefined }).problem).toBe("no_limit");
    expect(rewardedAdsConfig({ ...ON, REWARDED_ADS_CREDITS: "100000" }).problem).toBe("no_reward");
    expect(config()).toMatchObject({ enabled: true, problem: null, adUnitPath: "/1234567/repget_rewarded", rewardCredits: 2, dailyLimit: 3 });
  });

  it("has conservative bounds, and the workspace cap defaults to one member's limit", () => {
    expect(config()).toMatchObject({ cooldownSeconds: 60, workspaceDailyCap: 3, globalDailyCap: 200, minSeconds: 8, sessionMinutes: 15 });
    expect(config({ REWARDED_ADS_COOLDOWN_SECONDS: "-5", REWARDED_ADS_MIN_SECONDS: "abc" })).toMatchObject({ cooldownSeconds: 300, minSeconds: 8 });
  });

  it("uses Google's sample test ad unit in test mode, and never on production", () => {
    const testing = rewardedAdsConfig({ ...ON, REWARDED_AD_UNIT_PATH: "", REWARDED_ADS_TEST_MODE: "1" });
    expect(testing).toMatchObject({ enabled: true, testMode: true, adUnitPath: TEST_AD_UNIT_PATH });
    const production = rewardedAdsConfig({ ...ON, REWARDED_ADS_TEST_MODE: "1", VERCEL_ENV: "production" });
    expect(production).toMatchObject({ enabled: false, problem: "test_mode_in_production", testMode: false, adUnitPath: null });
    expect(rewardedAdsConfig({ ...ON, VERCEL_ENV: "production" }).enabled).toBe(true);
  });

  it("accepts only Ad Manager ad unit paths", () => {
    expect(isAdUnitPath("/1234567/repget_rewarded")).toBe(true);
    expect(isAdUnitPath("/1234567,7654321/site/rewarded-web")).toBe(true);
    for (const bad of ["1234567/unit", "/abc/unit", "/1234567/", "/1234567/unit?x=1", "/1234567/<script>", "javascript:alert(1)"]) {
      expect(isAdUnitPath(bad), bad).toBe(false);
    }
  });
});

describe("while the feature is off", () => {
  it("shows nothing, starts nothing and credits nothing", async () => {
    const off = rewardedAdsConfig({});
    expect(await loadRewardedAdState(userId, orgId, T0, off)).toBeNull();
    expect(await startRewardedAd(userId, orgId, T0, off)).toEqual({ ok: false, error: "disabled", state: null });
    const started = await startRewardedAd(userId, orgId, T0, config());
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    // Switched off between the start and the claim: no credits.
    expect(await claimRewardedAd(userId, orgId, started.sessionId, at(20 * SECOND), off)).toMatchObject({ ok: false, error: "disabled" });
    expect(await balance(orgId)).toBe(0);
  });
});

describe("starting", () => {
  it("opens one attempt for the member, and a newer start closes the older one", async () => {
    const first = await startRewardedAd(userId, orgId, T0, config());
    const second = await startRewardedAd(userId, orgId, at(SECOND), config());
    expect(first.ok && second.ok).toBe(true);
    const rows = await test.db.select().from(rewardedAdViews).where(eq(rewardedAdViews.userId, userId));
    expect(rows.filter((row) => row.status === "started")).toHaveLength(1);
    expect(rows.find((row) => row.status === "cancelled")?.reason).toBe("superseded");
    // The superseded attempt can no longer be claimed.
    if (first.ok) expect(await claimRewardedAd(userId, orgId, first.sessionId, at(30 * SECOND), config())).toMatchObject({ ok: false, error: "not_open" });
  });

  it("is a database rule: a second open attempt for one member cannot be written", async () => {
    await test.db.insert(rewardedAdViews).values({ organizationId: orgId, userId, rewardCredits: 2, day: "2026-11-13", startedAt: T0 });
    await expect(test.db.insert(rewardedAdViews).values({ organizationId: orgId, userId, rewardCredits: 2, day: "2026-11-13", startedAt: T0 })).rejects.toThrow();
  });

  it("is refused at the daily limit, and allowed again the next UTC day", async () => {
    for (let i = 0; i < 3; i += 1) expect(await watch(at(i * 2 * MINUTE))).toMatchObject({ ok: true, credits: 2 });
    const refused = await startRewardedAd(userId, orgId, at(10 * MINUTE), config());
    expect(refused).toMatchObject({ ok: false, error: "daily_limit", state: { watchedToday: 3, dailyLimit: 3 } });
    expect(await balance(orgId)).toBe(6);
    expect(await watch(new Date("2026-11-14T00:05:00.000Z"))).toMatchObject({ ok: true });
  });

  it("is refused during the cooldown, which the state says when it ends", async () => {
    await watch(T0);
    const refused = await startRewardedAd(userId, orgId, at(30 * SECOND), config());
    // Granted at T0 + 20 s, 60 s of cooldown.
    expect(refused).toMatchObject({ ok: false, error: "cooldown", state: { cooldownUntil: at(80 * SECOND).toISOString() } });
    expect((await startRewardedAd(userId, orgId, at(81 * SECOND), config())).ok).toBe(true);
  });

  it("is refused once the workspace's or RepGet's cap for the day is reached", async () => {
    const colleague = await member(orgId);
    const capped = config({ REWARDED_ADS_WORKSPACE_DAILY_CAP: "1" });
    expect(await watch(T0, 20 * SECOND, capped)).toMatchObject({ ok: true });
    expect(await startRewardedAd(colleague.userId, orgId, at(MINUTE), capped)).toMatchObject({ ok: false, error: "cap" });

    const other = await member();
    const global = config({ REWARDED_ADS_GLOBAL_DAILY_CAP: "1" });
    const dayAfter = new Date("2026-11-20T10:00:00.000Z");
    expect(await watch(dayAfter, 20 * SECOND, global, other)).toMatchObject({ ok: true });
    expect(await startRewardedAd(userId, orgId, new Date(dayAfter.getTime() + MINUTE), global)).toMatchObject({ ok: false, error: "cap" });
  });

  it("is refused after too many attempts without a reward in one day", async () => {
    // dailyLimit 3 -> 14 attempts a day.
    for (let i = 0; i < 14; i += 1) {
      const started = await startRewardedAd(userId, orgId, at(i * SECOND), config());
      expect(started.ok).toBe(true);
      if (started.ok) await endRewardedAd(userId, orgId, started.sessionId, "no_fill", at(i * SECOND + 500));
    }
    expect(await startRewardedAd(userId, orgId, at(MINUTE), config())).toMatchObject({ ok: false, error: "attempts" });
    expect(await balance(orgId)).toBe(0);
  });
});

describe("claiming", () => {
  it("credits the member's workspace once, with the attempt as the ledger key", async () => {
    const started = await startRewardedAd(userId, orgId, T0, config());
    if (!started.ok) throw new Error("not started");
    const claims = await Promise.all(Array.from({ length: 5 }, () => claimRewardedAd(userId, orgId, started.sessionId, at(20 * SECOND), config())));
    expect(claims.every((claim) => claim.ok)).toBe(true);
    expect(await balance(orgId)).toBe(2);
    const rows = await test.db.select().from(creditLedger).where(eq(creditLedger.organizationId, orgId));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ type: "reward", amount: 2, referenceId: started.sessionId, idempotencyKey: rewardedAdKey(started.sessionId) });
    // Again later: still once.
    expect(await claimRewardedAd(userId, orgId, started.sessionId, at(40 * SECOND), config())).toMatchObject({ ok: true, credits: 2 });
    expect(await balance(orgId)).toBe(2);
  });

  it("refuses a claim sooner than the shortest time, and the attempt cannot be claimed afterwards", async () => {
    const started = await startRewardedAd(userId, orgId, T0, config());
    if (!started.ok) throw new Error("not started");
    expect(await claimRewardedAd(userId, orgId, started.sessionId, at(3 * SECOND), config())).toMatchObject({ ok: false, error: "too_early" });
    expect(await claimRewardedAd(userId, orgId, started.sessionId, at(30 * SECOND), config())).toMatchObject({ ok: false, error: "not_open" });
    const [row] = await test.db.select().from(rewardedAdViews).where(eq(rewardedAdViews.id, started.sessionId));
    expect(row).toMatchObject({ status: "rejected", reason: "too_early" });
    expect(await balance(orgId)).toBe(0);
  });

  it("refuses an expired attempt", async () => {
    const started = await startRewardedAd(userId, orgId, T0, config());
    if (!started.ok) throw new Error("not started");
    expect(await claimRewardedAd(userId, orgId, started.sessionId, at(16 * MINUTE), config())).toMatchObject({ ok: false, error: "expired" });
    const [row] = await test.db.select().from(rewardedAdViews).where(eq(rewardedAdViews.id, started.sessionId));
    expect(row.status).toBe("expired");
    expect(await balance(orgId)).toBe(0);
  });

  it("refuses another member's attempt, another workspace and a made-up id", async () => {
    const started = await startRewardedAd(userId, orgId, T0, config());
    if (!started.ok) throw new Error("not started");
    const stranger = await member();
    expect(await claimRewardedAd(stranger.userId, stranger.orgId, started.sessionId, at(20 * SECOND), config())).toMatchObject({ ok: false, error: "not_found" });
    expect(await claimRewardedAd(userId, stranger.orgId, started.sessionId, at(20 * SECOND), config())).toMatchObject({ ok: false, error: "not_found" });
    expect(await claimRewardedAd(userId, orgId, "not-a-uuid", at(20 * SECOND), config())).toMatchObject({ ok: false, error: "not_found" });
    expect(await claimRewardedAd(userId, orgId, randomUUID(), at(20 * SECOND), config())).toMatchObject({ ok: false, error: "not_found" });
    expect(await balance(orgId)).toBe(0);
    expect(await balance(stranger.orgId)).toBe(0);
  });

  it("credits nothing for an ad closed early, and that attempt cannot be claimed", async () => {
    const started = await startRewardedAd(userId, orgId, T0, config());
    if (!started.ok) throw new Error("not started");
    expect(await endRewardedAd(userId, orgId, started.sessionId, "closed_early", at(5 * SECOND))).toBe(true);
    // Only the member's own open attempt can be closed, once.
    expect(await endRewardedAd(userId, orgId, started.sessionId, "closed_early", at(6 * SECOND))).toBe(false);
    expect(await claimRewardedAd(userId, orgId, started.sessionId, at(20 * SECOND), config())).toMatchObject({ ok: false, error: "not_open" });
    expect(await balance(orgId)).toBe(0);
  });

  it("checks the daily limit again at the claim", async () => {
    // Two open attempts cannot exist, so this one is opened before the limit drops.
    const started = await startRewardedAd(userId, orgId, T0, config());
    if (!started.ok) throw new Error("not started");
    const lower = config({ REWARDED_ADS_DAILY_LIMIT: "1" });
    await test.db.insert(rewardedAdViews).values({ organizationId: orgId, userId, status: "granted", rewardCredits: 2, day: "2026-11-13", startedAt: at(-5 * MINUTE), endedAt: at(-4 * MINUTE) });
    expect(await claimRewardedAd(userId, orgId, started.sessionId, at(20 * SECOND), lower)).toMatchObject({ ok: false, error: "daily_limit" });
    expect(await balance(orgId)).toBe(0);
  });

  it("pays the reward promised at the start", async () => {
    const started = await startRewardedAd(userId, orgId, T0, config());
    if (!started.ok) throw new Error("not started");
    expect(await claimRewardedAd(userId, orgId, started.sessionId, at(20 * SECOND), config({ REWARDED_ADS_CREDITS: "9" }))).toMatchObject({ ok: true, credits: 2 });
    expect(await balance(orgId)).toBe(2);
  });
});

describe("what the credits are", () => {
  it("are ordinary service credits: a 'reward' ledger row, and nothing in any partner balance", async () => {
    await watch(T0);
    const rows = await test.db.select().from(creditLedger).where(and(eq(creditLedger.organizationId, orgId)));
    expect(rows.map((row) => row.type)).toEqual(["reward"]);
    expect(await test.db.select().from(partnerCommissions)).toEqual([]);
    expect(await test.db.select().from(partnerLedgerEntries)).toEqual([]);
  });

  it("never reach a payout: the partner program never reads the credit ledger", () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) files.push(full);
      }
    };
    walk(path.join(ROOT, "src/lib/partners"));
    expect(files.length).toBeGreaterThan(10);
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      // Partners only ever GIVE credits (commissions converted), through recordCredit; nothing there reads balances or rewards.
      expect(source, file).not.toMatch(/creditLedger|credit_ledger|getBalance|getAvailable|rewardedAd|rewarded_ad|rewarded-ad/);
    }
  });
});
