import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createPostgresTestDb, testPostgresUrl } from "@/test/postgres";

/**
 * "Watch an ad to earn credits" on REAL Postgres through postgres-js, the
 * production driver, with starts and claims racing on separate connections:
 * one attempt open per member, one grant per attempt, and a workspace cap
 * that holds when several members claim at once. Skipped unless
 * TEST_POSTGRES_URL names a disposable server (src/test/postgres.ts). Every
 * moment is passed in, never the database's now().
 */

const state = vi.hoisted(() => ({ db: null as unknown, pick: null as (() => unknown) | null }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get((state.pick ? state.pick() : state.db) as object, p) }) }));

import { organization, user } from "@/lib/db/auth-tables";
import { creditLedger, rewardedAdViews } from "@/lib/db/schema";
import { claimRewardedAd, startRewardedAd } from "@/lib/earn/rewarded-ads";
import { rewardedAdsConfig } from "@/lib/earn/rewarded-ads-config";

const available = Boolean(testPostgresUrl());
const T0 = new Date("2026-11-13T10:00:00.000Z");
const at = (ms: number) => new Date(T0.getTime() + ms);
const config = (extra: Record<string, string> = {}) =>
  rewardedAdsConfig({ REWARDED_ADS_ENABLED: "1", REWARDED_AD_UNIT_PATH: "/1234567/unit", REWARDED_ADS_CREDITS: "2", REWARDED_ADS_DAILY_LIMIT: "5", ...extra });

describe.skipIf(!available)("rewarded ads on real Postgres", () => {
  type Db = typeof import("@/lib/db").db;
  let dbs: Db[];
  let dispose: () => Promise<void>;

  beforeAll(async () => {
    const created = await createPostgresTestDb(3);
    dbs = created.dbs as unknown as Db[];
    dispose = created.dispose;
    // rewarded_ad_views comes from migration 0093.
    state.db = dbs[0];
  }, 400_000);

  afterAll(async () => {
    await dispose?.();
  }, 300_000);

  function spread<T>(work: () => Promise<T>[]): Promise<T[]> {
    let next = 0;
    state.pick = () => dbs[next++ % dbs.length];
    return Promise.all(work()).finally(() => {
      state.pick = null;
    });
  }

  async function member(org?: string) {
    const id = `u_${randomUUID().slice(0, 8)}`;
    await dbs[0].insert(user).values({ id, name: id, email: `${id}@example.com`, createdAt: T0, updatedAt: T0 });
    if (!org) {
      org = `org_${randomUUID().slice(0, 8)}`;
      await dbs[0].insert(organization).values({ id: org, name: org, slug: org, createdAt: T0 });
    }
    return { userId: id, orgId: org };
  }

  it("leaves one open attempt when one member starts many at once", async () => {
    const { userId, orgId } = await member();
    const starts = await spread(() => Array.from({ length: 9 }, () => startRewardedAd(userId, orgId, T0, config())));
    expect(starts.every((start) => start.ok)).toBe(true);
    const open = await dbs[0].select().from(rewardedAdViews).where(eq(rewardedAdViews.userId, userId));
    expect(open.filter((row) => row.status === "started")).toHaveLength(1);
  });

  it("grants one attempt once when its claim arrives many times at once", async () => {
    const { userId, orgId } = await member();
    const started = await startRewardedAd(userId, orgId, T0, config());
    if (!started.ok) throw new Error("not started");
    const claims = await spread(() => Array.from({ length: 9 }, () => claimRewardedAd(userId, orgId, started.sessionId, at(20_000), config())));
    expect(claims.every((claim) => claim.ok)).toBe(true);
    const rows = await dbs[0].select().from(creditLedger).where(eq(creditLedger.organizationId, orgId));
    expect(rows).toHaveLength(1);
    expect(rows[0].amount).toBe(2);
  });

  it("holds the workspace cap when several members claim at once", async () => {
    const first = await member();
    const others = await Promise.all([member(first.orgId), member(first.orgId), member(first.orgId)]);
    const capped = config({ REWARDED_ADS_WORKSPACE_DAILY_CAP: "2" });
    const sessions: { userId: string; id: string }[] = [];
    for (const who of [first, ...others]) {
      const started = await startRewardedAd(who.userId, first.orgId, T0, capped);
      if (!started.ok) throw new Error("not started");
      sessions.push({ userId: who.userId, id: started.sessionId });
    }
    const claims = await spread(() => sessions.map((s) => claimRewardedAd(s.userId, first.orgId, s.id, at(20_000), capped)));
    expect(claims.filter((claim) => claim.ok)).toHaveLength(2);
    expect(claims.filter((claim) => !claim.ok).map((claim) => !claim.ok && claim.error)).toEqual(["cap", "cap"]);
    const rows = await dbs[0].select().from(creditLedger).where(eq(creditLedger.organizationId, first.orgId));
    expect(rows.reduce((sum, row) => sum + row.amount, 0)).toBe(4);
  });
});
